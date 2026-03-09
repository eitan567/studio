'use server';

/**
 * @fileOverview AI tool to generate album background images using Gemini.
 *
 * - aiGenerateBackground - A function that generates a background image based on a prompt.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { vertexAI } from '@genkit-ai/google-genai';

const AIGenerateBackgroundInputSchema = z.object({
    prompt: z
        .string()
        .describe('A description of the background image to generate (e.g., "soft gradient with flowers", "vintage paper texture")'),
    style: z
        .string()
        .optional()
        .describe('Optional style hints (e.g., "watercolor", "minimalist", "elegant")'),
});

export type AIGenerateBackgroundInput = z.infer<typeof AIGenerateBackgroundInputSchema>;

const AIGenerateBackgroundOutputSchema = z.object({
    imageUrl: z
        .string()
        .describe('URL or data URI of the generated background image'),
    success: z.boolean().describe('Whether the generation was successful'),
    error: z.string().optional().describe('Error message if generation failed'),
});

export type AIGenerateBackgroundOutput = z.infer<typeof AIGenerateBackgroundOutputSchema>;

export async function aiGenerateBackground(
    input: AIGenerateBackgroundInput
): Promise<AIGenerateBackgroundOutput> {
    return aiGenerateBackgroundFlow(input);
}

const aiGenerateBackgroundFlow = ai.defineFlow(
    {
        name: 'aiGenerateBackgroundFlow',
        inputSchema: AIGenerateBackgroundInputSchema,
        outputSchema: AIGenerateBackgroundOutputSchema,
    },
    async (input) => {
        try {
            const prompt = `Generate a beautiful album background image based on this description: ${input.prompt}${input.style ? `. Style: ${input.style}` : ''}. 
The image should be suitable as a photo album page background - subtle, elegant, and not too busy so it doesn't compete with the photos.`;

            const tryModel = async (model: string): Promise<{ imageUrl?: string; error?: string }> => {
                try {
                    const response = await ai.generate({
                        model: vertexAI.model(model),
                        prompt,
                        config: {
                            temperature: 0.4,
                        },
                    });

                    if (response.media?.url) {
                        return { imageUrl: response.media.url };
                    }

                    const mediaPart = response.message?.content?.find((part: any) => part?.media?.url);
                    if (mediaPart?.media?.url) {
                        return { imageUrl: mediaPart.media.url };
                    }

                    return { error: 'No image returned by model' };
                } catch (err) {
                    return {
                        error: err instanceof Error ? err.message : 'Model call failed',
                    };
                }
            };

            const modelCandidates = [
                'imagen-4.0-fast-generate-001',
                'imagen-4.0-generate-001',
                'imagen-4.0-ultra-generate-001',
                'imagen-3.0-generate-002',
                'imagen-3.0-generate-001',
                'imagen-3.0-fast-generate-001',
                'gemini-2.5-flash-image',
                'gemini-3.1-flash-image-preview',
                'gemini-3-pro-image-preview',
            ];

            let lastError: string | undefined;
            for (const candidate of modelCandidates) {
                const result = await tryModel(candidate);
                if (result.imageUrl) {
                    return {
                        imageUrl: result.imageUrl,
                        success: true,
                    };
                }
                lastError = result.error || lastError;
            }

            return {
                imageUrl: '',
                success: false,
                error: lastError || 'No image was generated. Try a different prompt.',
            };
        } catch (error) {
            return {
                imageUrl: '',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            };
        }
    }
);
