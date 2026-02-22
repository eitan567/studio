'use server';

/**
 * @fileOverview AI tool to generate album background images using Gemini.
 *
 * - aiGenerateBackground - A function that generates a background image based on a prompt.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

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

            const tryModel = async (model: string): Promise<string | null> => {
                const response = await ai.generate({
                    model,
                    prompt,
                    config: {
                        temperature: 0.4,
                    },
                });

                if (response.media?.url) {
                    return response.media.url;
                }

                const mediaPart = response.message?.content?.find((part: any) => part?.media?.url);
                if (mediaPart?.media?.url) {
                    return mediaPart.media.url;
                }

                return null;
            };

            const modelCandidates = [
                'googleai/nano-banana-pro-preview',
                'googleai/gemini-2.5-flash-image',
                'googleai/gemini-2.0-flash-exp-image-generation',
                'googleai/imagen-4.0-fast-generate-001',
            ];

            for (const candidate of modelCandidates) {
                const imageUrl = await tryModel(candidate);
                if (imageUrl) {
                    return {
                        imageUrl,
                        success: true,
                    };
                }
            }

            return {
                imageUrl: '',
                success: false,
                error: 'No image was generated. Try a different prompt.',
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
