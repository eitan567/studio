import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;

const globalForGenkit = globalThis as unknown as { __genkit: ReturnType<typeof genkit> | undefined };

if (!globalForGenkit.__genkit) {
  console.log('Genkit Init - Initializing New Instance');
  console.log('Genkit Init - API Key present:', !!apiKey);
  console.log('Genkit Init - Env Vars:', {
    GOOGLE_GENAI_API_KEY: !!process.env.GOOGLE_GENAI_API_KEY,
    GOOGLE_API_KEY: !!process.env.GOOGLE_API_KEY
  });

  globalForGenkit.__genkit = genkit({
    plugins: [googleAI({ apiKey })],
    model: 'googleai/gemini-2.5-flash',
  });
}

export const ai = globalForGenkit.__genkit!;
