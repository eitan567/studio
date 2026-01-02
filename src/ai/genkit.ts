import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;
console.log('Genkit Init - API Key present:', !!apiKey);
console.log('Genkit Init - Env Vars:', {
  GOOGLE_GENAI_API_KEY: !!process.env.GOOGLE_GENAI_API_KEY,
  GOOGLE_API_KEY: !!process.env.GOOGLE_API_KEY
});

export const ai = genkit({
  plugins: [googleAI({ apiKey })],
  model: 'googleai/gemini-2.5-flash',
});
