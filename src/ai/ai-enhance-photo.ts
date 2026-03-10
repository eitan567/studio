'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { vertexAI } from '@genkit-ai/google-genai';
import sharp from 'sharp';

const SUPPORTED_ENHANCEMENT_MODELS = [
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-image-preview',
  'gemini-3-pro-image-preview',
] as const;
const MODEL_SELECTION_OPTIONS = ['auto', ...SUPPORTED_ENHANCEMENT_MODELS] as const;

type SupportedEnhancementModel = (typeof SUPPORTED_ENHANCEMENT_MODELS)[number];
type ModelSelection = (typeof MODEL_SELECTION_OPTIONS)[number];
const DEFAULT_ENHANCEMENT_MODEL: SupportedEnhancementModel = 'gemini-3.1-flash-image-preview';

const AIEnhancePhotoInputSchema = z.object({
  imageUrl: z
    .string()
    .describe('Source image URL or data URI to enhance'),
  referenceImageUrl: z
    .string()
    .optional()
    .describe('Optional reference image URL or data URI used for guidance'),
  selectedModel: z
    .enum(MODEL_SELECTION_OPTIONS)
    .optional()
    .describe('Optional model selection. "auto" uses fallback order.'),
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

type ImageDimensions = { width: number; height: number };

async function getImageDimensions(imageUrl: string): Promise<ImageDimensions> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Could not fetch image for metadata (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const metadata = await sharp(Buffer.from(arrayBuffer)).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Image metadata is missing width/height');
  }

  return { width: metadata.width, height: metadata.height };
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
    const requestText = userPrompt || '';
    const selectedModel: ModelSelection = input.selectedModel || DEFAULT_ENHANCEMENT_MODEL;

    if (manualMode && !userPrompt) {
      return {
        success: false,
        imageUrl: '',
        appliedPrompt: '',
        error: 'Manual mode requires a custom prompt',
      };
    }

    const hasReferenceImage = Boolean(input.referenceImageUrl);
    const isTransferRequest = hasReferenceImage;
    let referenceIdentityProfile = '';
    let sourceDimensions: ImageDimensions | null = null;

    try {
      sourceDimensions = await getImageDimensions(input.imageUrl);
    } catch {
      sourceDimensions = null;
    }

    if (hasReferenceImage) {
      try {
        const profileResponse = await ai.generate({
          model: vertexAI.model('gemini-2.5-flash'),
          prompt: [
            { text: 'You are extracting identity and appearance details from REFERENCE only.' },
            { text: 'REFERENCE IMAGE:' },
            { media: { url: input.referenceImageUrl! } },
            { text: `User request context: ${requestText || 'No extra request'}` },
            { text: 'Return concise bullets describing only the main subject in REFERENCE: face, hair, clothing, accessories, pose, and color details.' },
            { text: 'Do not mention background composition. Do not invent unknown details.' },
          ],
          config: {
            temperature: 0.05,
          },
        });

        referenceIdentityProfile = (profileResponse.text || '').trim();
      } catch {
        referenceIdentityProfile = '';
      }
    }

    const hardRules = [
      'Edit only the SOURCE image.',
      'The final image must keep SOURCE as the base canvas.',
      'Never swap SOURCE and REFERENCE roles.',
      'Preserve SOURCE composition, framing, perspective, and aspect ratio unless the user explicitly asks otherwise.',
      'Do not add text, logos, watermark, or frames unless explicitly requested by the user.',
      ...(hasReferenceImage
        ? [
            'REFERENCE-derived details are guidance only.',
            'Never use REFERENCE background/composition as output.',
            'If adding a person/object from REFERENCE, match the SAME REFERENCE identity and blend into SOURCE naturally.',
            'Never invent a different person when REFERENCE identity is provided.',
            'If identity cannot be matched reliably, keep SOURCE unchanged instead of adding an unrelated person.',
          ]
        : []),
    ];

    const qualityGuidance = manualMode
      ? []
      : [
          'Enhance this photo for a premium photo album print.',
          'Improve sharpness, lighting balance, color fidelity, and natural detail.',
          input.presetPrompt?.trim(),
        ].filter(Boolean);

    const instructions = [
      'Hard rules (must follow):',
      ...hardRules.map((rule) => `- ${rule}`),
      qualityGuidance.length > 0 ? '\nQuality guidance:' : '',
      ...qualityGuidance.map((rule) => `- ${rule}`),
      '\nUser request:',
      requestText || 'Enhance naturally while keeping a realistic look.',
      hasReferenceImage ? '\nReference-derived guidance:' : '',
      ...(hasReferenceImage
        ? [
            referenceIdentityProfile || '- Use reference only as guidance and keep SOURCE as the final base image.',
            isTransferRequest
              ? '- The user asked to transfer details from REFERENCE into SOURCE. Do not invent an unrelated person.'
              : '- Use REFERENCE only when relevant to the user request.',
          ]
        : []),
    ]
      .filter(Boolean)
      .join('\n');

    const basePrompt = [
      { text: 'You are a professional photo enhancement engine.' },
      { text: 'SOURCE IMAGE (this must remain the base canvas of the output):' },
      { media: { url: input.imageUrl } },
      ...(hasReferenceImage
        ? [
            { text: 'REFERENCE IMAGE (identity lock only, never the output canvas):' },
            { media: { url: input.referenceImageUrl! } },
            { text: 'When transferring a person/object, it must be the SAME identity as REFERENCE, not a new random person.' },
          ]
        : []),
      { text: instructions },
      { text: 'Return exactly one edited version of SOURCE IMAGE and no additional text.' },
    ];

    const evaluateResultAgainstInputs = async (
      resultUrl: string
    ): Promise<{ pass: boolean; reason?: string }> => {
      if (sourceDimensions) {
        try {
          const resultDimensions = await getImageDimensions(resultUrl);
          const sourceAspect = sourceDimensions.width / sourceDimensions.height;
          const resultAspect = resultDimensions.width / resultDimensions.height;
          const sourceLandscape = sourceDimensions.width >= sourceDimensions.height;
          const resultLandscape = resultDimensions.width >= resultDimensions.height;
          const aspectDelta = Math.abs(sourceAspect - resultAspect) / sourceAspect;

          if (sourceLandscape !== resultLandscape) {
            return {
              pass: false,
              reason:
                `Orientation mismatch: source ${sourceDimensions.width}x${sourceDimensions.height}, ` +
                `result ${resultDimensions.width}x${resultDimensions.height}`,
            };
          }

          if (aspectDelta > 0.08) {
            return {
              pass: false,
              reason:
                `Aspect ratio mismatch: source ${sourceAspect.toFixed(4)}, result ${resultAspect.toFixed(4)}`,
            };
          }
        } catch (err) {
          return {
            pass: false,
            reason: err instanceof Error ? err.message : 'Result metadata validation failed',
          };
        }
      }

      if (!hasReferenceImage) {
        return { pass: true };
      }

      try {
        const qaResponse = await ai.generate({
          model: vertexAI.model('gemini-2.5-flash'),
          prompt: [
            { text: 'You are a strict QA validator for image editing results.' },
            { text: 'SOURCE IMAGE (must be the base composition of RESULT):' },
            { media: { url: input.imageUrl } },
            { text: 'REFERENCE IMAGE (guidance only):' },
            { media: { url: input.referenceImageUrl! } },
            { text: 'RESULT IMAGE:' },
            { media: { url: resultUrl } },
            { text: `User request: ${requestText || 'No extra request'}` },
            { text: `Transfer requested: ${isTransferRequest ? 'yes' : 'no'}` },
            {
              text:
                'Reply as JSON only with this exact schema:\n' +
                '{"base_canvas_ok":boolean,"identity_match_score":0-100,"transfer_applied":boolean,"pass":boolean,"reason":string}\n' +
                'Set base_canvas_ok=false if RESULT composition is based on REFERENCE instead of SOURCE.\n' +
                'Set identity_match_score by similarity of transferred person to REFERENCE subject (face/hair/clothing).\n' +
                'If transfer was requested, set pass=true only when base_canvas_ok=true, transfer_applied=true and identity_match_score>=80.\n' +
                'If transfer was not requested, set pass=true only when base_canvas_ok=true.',
            },
          ],
          config: {
            temperature: 0,
          },
        });

        const qaText = (qaResponse.text || '').trim();
        const jsonMatch = qaText.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        if (!parsed || typeof parsed !== 'object') {
          return { pass: false, reason: qaText || 'QA produced non-JSON response' };
        }

        const baseCanvasOk = parsed.base_canvas_ok === true;
        const identityMatchScore = Number(parsed.identity_match_score || 0);
        const transferApplied = parsed.transfer_applied === true;
        const reason = typeof parsed.reason === 'string' ? parsed.reason : 'QA rejected result';

        if (!baseCanvasOk) {
          return { pass: false, reason: `Base-canvas mismatch: ${reason}` };
        }

        if (isTransferRequest) {
          if (!transferApplied) {
            return { pass: false, reason: `Transfer not applied: ${reason}` };
          }
          if (identityMatchScore < 80) {
            return { pass: false, reason: `Identity mismatch (${identityMatchScore}/100): ${reason}` };
          }
        }

        return { pass: true };
      } catch (err) {
        return {
          pass: false,
          reason: err instanceof Error ? err.message : 'QA validation failed',
        };
      }
    };

    const tryModel = async (
      model: string,
      correction?: string
    ): Promise<{ url?: string; error?: string }> => {
      try {
        const prompt = correction
          ? [
              ...basePrompt,
              {
                text:
                  `QA correction from previous attempt: ${correction}\n` +
                  'Regenerate and strictly fix this while preserving SOURCE as the base canvas.',
              },
            ]
          : basePrompt;

        const response = await ai.generate({
          model: vertexAI.model(model),
          prompt,
          config: {
            temperature: hasReferenceImage ? 0.15 : 0.3,
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

    const autoModelOrder: SupportedEnhancementModel[] = hasReferenceImage
      ? [
          'gemini-3-pro-image-preview',
          'gemini-3.1-flash-image-preview',
          'gemini-2.5-flash-image',
        ]
      : [
          'gemini-2.5-flash-image',
          'gemini-3.1-flash-image-preview',
          'gemini-3-pro-image-preview',
        ];

    const modelCandidates: SupportedEnhancementModel[] = selectedModel === 'auto'
      ? autoModelOrder
      : [selectedModel];

    let lastError: string | undefined;
    for (const candidate of modelCandidates) {
      let correction: string | undefined;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const result = await tryModel(candidate, correction);
        if (!result.url) {
          lastError = result.error || lastError;
          break;
        }

        const qaCheck = await evaluateResultAgainstInputs(result.url);
        if (qaCheck.pass) {
          return {
            success: true,
            imageUrl: result.url,
            appliedPrompt: instructions,
            modelUsed: `${candidate}${attempt === 1 ? ' (retry)' : ''}`,
          };
        }

        correction = qaCheck.reason || `QA rejected output from ${candidate}`;
        lastError = correction;
      }
    }

    return {
      success: false,
      imageUrl: '',
      appliedPrompt: instructions,
      error: lastError || 'Failed to enhance image',
    };
  }
);

