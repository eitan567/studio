'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AIEnhancePhotoInputSchema = z.object({
  imageUrl: z
    .string()
    .describe('Source image URL or data URI to enhance'),
  presetPrompt: z
    .string()
    .optional()
    .describe('Preset enhancement instruction'),
  customPrompt: z
    .string()
    .optional()
    .describe('Additional user instructions'),
  manualMode: z
    .boolean()
    .optional()
    .describe('When true, only user custom prompt is used'),
});

export type AIEnhancePhotoInput = z.infer<typeof AIEnhancePhotoInputSchema>;

const AIEnhancePhotoOutputSchema = z.object({
  success: z.boolean(),
  imageUrl: z.string(),
  appliedPrompt: z.string(),
  modelUsed: z.string().optional(),
  error: z.string().optional(),
});

export type AIEnhancePhotoOutput = z.infer<typeof AIEnhancePhotoOutputSchema>;

export async function aiEnhancePhoto(
  input: AIEnhancePhotoInput
): Promise<AIEnhancePhotoOutput> {
  return aiEnhancePhotoFlow(input);
}

const aiEnhancePhotoFlow = ai.defineFlow(
  {
    name: 'aiEnhancePhotoFlow',
    inputSchema: AIEnhancePhotoInputSchema,
    outputSchema: AIEnhancePhotoOutputSchema,
  },
  async (input) => {
    const userPrompt = input.customPrompt?.trim();
    const manualMode = input.manualMode === true;

    if (manualMode && !userPrompt) {
      return {
        success: false,
        imageUrl: '',
        appliedPrompt: '',
        error: 'Manual mode requires a custom prompt',
      };
    }

    const instructions = manualMode
      ? (userPrompt || '')
      : [
          'Enhance this photo for a premium photo album print.',
          'Keep the same composition and aspect ratio.',
          'Do not add text, logos, watermark, frames, or new objects.',
          'Improve sharpness, lighting balance, color fidelity, and natural detail.',
          input.presetPrompt?.trim(),
          userPrompt,
        ]
          .filter(Boolean)
          .join('\n');

    const prompt = [
      { text: 'You are a professional photo enhancement engine.' },
      { media: { url: input.imageUrl } },
      { text: instructions },
      { text: 'Return only one enhanced image.' },
    ];

    const tryModel = async (
      model: string
    ): Promise<{ url?: string; error?: string }> => {
      try {
        const response = await ai.generate({
          model,
          prompt,
          config: {
            temperature: 0.3,
          },
        });

        if (response.media?.url) {
          return { url: response.media.url };
        }

        const mediaPart = response.message?.content?.find((part: any) => part?.media?.url);
        if (mediaPart?.media?.url) {
          return { url: mediaPart.media.url };
        }

        return { error: 'No image returned by model' };
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : 'Model call failed',
        };
      }
    };

    const modelCandidates = [
      'googleai/nano-banana-pro-preview',
      'googleai/gemini-2.5-flash-image',
      'googleai/gemini-2.0-flash-exp-image-generation',
      'googleai/imagen-4.0-fast-generate-001',
    ];

    let lastError: string | undefined;
    for (const candidate of modelCandidates) {
      const result = await tryModel(candidate);
      if (result.url) {
        return {
          success: true,
          imageUrl: result.url,
          appliedPrompt: instructions,
          modelUsed: candidate,
        };
      }
      lastError = result.error || lastError;
    }

    return {
      success: false,
      imageUrl: '',
      appliedPrompt: instructions,
      error: lastError || 'Failed to enhance image',
    };
  }
);
