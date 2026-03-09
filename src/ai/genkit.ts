import { genkit } from 'genkit';
import { logger } from '@/lib/logger';
import { vertexAI } from '@genkit-ai/google-genai';
import { createVertexAIPluginOptions } from '@/ai/vertex-ai-auth';

const globalForGenkit = globalThis as unknown as { __genkit: ReturnType<typeof genkit> | undefined };

if (!globalForGenkit.__genkit) {
  logger.info('Genkit Init: Initializing New Instance');
  logger.debug('Genkit Init: Vertex env:', {
    GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || null,
    GOOGLE_CLOUD_LOCATION: process.env.GOOGLE_CLOUD_LOCATION || 'global',
    VERCEL: !!process.env.VERCEL,
  });

  globalForGenkit.__genkit = genkit({
    plugins: [vertexAI(createVertexAIPluginOptions())],
    model: vertexAI.model('gemini-3.0-flash'),
  });
}

export const ai = globalForGenkit.__genkit!;
