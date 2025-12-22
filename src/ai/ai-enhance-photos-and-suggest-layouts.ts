'use server';

/**
 * @fileOverview An AI tool to enhance photos and suggest optimal album layouts.
 *
 * - aiEnhancePhotosAndSuggestLayouts - A function that enhances photos and suggests layouts.
 * - AIEnhancePhotosAndSuggestLayoutsInput - The input type for the aiEnhancePhotosAndSuggestLayouts function.
 * - AIEnhancePhotosAndSuggestLayoutsOutput - The return type for the aiEnhancePhotosAndSuggestLayouts function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AIEnhancePhotosAndSuggestLayoutsInputSchema = z.object({
  photoDataUris: z
    .array(z.string())
    .describe(
      'An array of photo data URIs that must include a MIME type and use Base64 encoding. Expected format: data:<mimetype>;base64,<encoded_data>.'
    ),
  albumStylePreference: z
    .string()
    .optional()
    .describe('Optional style preferences for the album (e.g., modern, classic, minimalist).'),
});
export type AIEnhancePhotosAndSuggestLayoutsInput = z.infer<
  typeof AIEnhancePhotosAndSuggestLayoutsInputSchema
>;

const AIEnhancePhotosAndSuggestLayoutsOutputSchema = z.object({
  enhancedPhotoDataUris: z
    .array(z.string())
    .describe(
      'An array of enhanced photo data URIs, in the same format as the input.'
    ),
  layoutSuggestions: z
    .array(z.string())
    .describe('Suggestions for optimal album layouts based on the photos.'),
  styleRecommendations: z
    .string()
    .describe('Personalized style recommendations to improve the album look and feel.'),
});
export type AIEnhancePhotosAndSuggestLayoutsOutput = z.infer<
  typeof AIEnhancePhotosAndSuggestLayoutsOutputSchema
>;

export async function aiEnhancePhotosAndSuggestLayouts(
  input: AIEnhancePhotosAndSuggestLayoutsInput
): Promise<AIEnhancePhotosAndSuggestLayoutsOutput> {
  return aiEnhancePhotosAndSuggestLayoutsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiEnhancePhotosAndSuggestLayoutsPrompt',
  input: {schema: AIEnhancePhotosAndSuggestLayoutsInputSchema},
  output: {schema: AIEnhancePhotosAndSuggestLayoutsOutputSchema},
  prompt: `You are an AI assistant that enhances photos and suggests optimal album layouts.

You will receive an array of photo data URIs, and optionally, style preferences for the album.

Enhance the photos to improve their visual appeal.

Suggest optimal album layouts based on the content of the images.

Provide personalized style recommendations to improve the overall look and feel of the photobook.

Here are the photo descriptions:
{{#each photoDataUris}}
Photo {{@index}}: {{this}}
{{/each}}

Album Style Preference: {{{albumStylePreference}}}

Output the enhanced photos, layout suggestions, and style recommendations in the format specified by the output schema.

Consider the content of the images when suggesting layouts and styles. What adjustments might make certain photos 'pop' as part of the layout?
`,
});

const aiEnhancePhotosAndSuggestLayoutsFlow = ai.defineFlow(
  {
    name: 'aiEnhancePhotosAndSuggestLayoutsFlow',
    inputSchema: AIEnhancePhotosAndSuggestLayoutsInputSchema,
    outputSchema: AIEnhancePhotosAndSuggestLayoutsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
