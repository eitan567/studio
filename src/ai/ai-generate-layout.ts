'use server';

/**
 * @fileOverview AI tool to generate album layout templates using Gemini.
 *
 * - aiGenerateLayout - A function that generates layout templates based on a prompt.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { AdvancedTemplate, LayoutRegion, ShapeType, TemplateCategory } from '@/lib/advanced-layout-types';
import { v4 as uuidv4 } from 'uuid';

const AIGenerateLayoutInputSchema = z.object({
    prompt: z
        .string()
        .describe('A description of the layout to generate (e.g., "4 photos with a circle in the center", "diagonal strips")'),
    photoCount: z
        .number()
        .min(1)
        .max(12)
        .describe('Number of photos the layout should support'),
    style: z
        .string()
        .optional()
        .describe('Optional style hints (e.g., "modern", "classic", "artistic")'),
});

export type AIGenerateLayoutInput = z.infer<typeof AIGenerateLayoutInputSchema>;

const AIGenerateLayoutOutputSchema = z.object({
    template: z.any().describe('The generated AdvancedTemplate object'),
    success: z.boolean().describe('Whether the generation was successful'),
    error: z.string().optional().describe('Error message if generation failed'),
});

export type AIGenerateLayoutOutput = z.infer<typeof AIGenerateLayoutOutputSchema>;

export async function aiGenerateLayout(
    input: AIGenerateLayoutInput
): Promise<AIGenerateLayoutOutput> {
    return aiGenerateLayoutFlow(input);
}

const aiGenerateLayoutFlow = ai.defineFlow(
    {
        name: 'aiGenerateLayoutFlow',
        inputSchema: AIGenerateLayoutInputSchema,
        outputSchema: AIGenerateLayoutOutputSchema,
    },
    async (input) => {
        try {
            const systemPrompt = `You are an expert album layout designer. Generate creative photo layout templates.

You must return a valid JSON object with the following structure:
{
  "name": "Layout Name",
  "category": "geometric" | "artistic" | "diagonal" | "grid",
  "regions": [
    {
      "id": "unique-id",
      "shape": "rect" | "circle" | "ellipse" | "polygon",
      "bounds": { "x": 0-100, "y": 0-100, "width": 0-100, "height": 0-100 },
      "radius": { "rx": 0-50, "ry": 0-50 },  // Only for circle/ellipse
      "points": [[x1,y1], [x2,y2], ...],    // Only for polygon, coordinates 0-100
      "zIndex": 0-10,                         // Higher = on top
      "rotation": 0-360                       // Optional rotation in degrees
    }
  ]
}

IMPORTANT RULES:
1. All coordinates are PERCENTAGES from 0 to 100
2. The entire page should be covered by photo regions (no gaps unless intentional overlap)
3. For circles: use shape "circle" with radius { rx: value, ry: value } where rx=ry
4. For polygons: provide points as array of [x%, y%] coordinates
5. Use zIndex to handle overlapping regions (higher values appear on top)
6. Be creative! Mix shapes, use diagonals, create interesting compositions
7. ONLY return the JSON object, no other text`;

            const userPrompt = `Create a layout for ${input.photoCount} photos based on this description: "${input.prompt}"${input.style ? `. Style: ${input.style}` : ''}

Return ONLY a valid JSON object with the layout definition.`;

            const response = await ai.generate({
                model: 'googleai/gemini-2.5-flash',
                prompt: userPrompt,
                system: systemPrompt,
                config: {
                    temperature: 0.8,
                },
            });

            // Extract JSON from response
            const text = response.text;

            // Try to parse JSON from the response
            let layoutData;
            try {
                // Try to find JSON in the response
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    layoutData = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('No JSON found in response');
                }
            } catch (parseError) {
                return {
                    template: null,
                    success: false,
                    error: `Failed to parse AI response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
                };
            }

            // Validate and transform the layout data
            const regions: LayoutRegion[] = layoutData.regions.map((r: any, index: number) => ({
                id: r.id || `region-${index}`,
                shape: validateShape(r.shape),
                bounds: {
                    x: clamp(r.bounds?.x ?? 0, 0, 100),
                    y: clamp(r.bounds?.y ?? 0, 0, 100),
                    width: clamp(r.bounds?.width ?? 50, 1, 100),
                    height: clamp(r.bounds?.height ?? 50, 1, 100),
                },
                radius: r.radius ? {
                    rx: clamp(r.radius.rx ?? 25, 0, 50),
                    ry: clamp(r.radius.ry ?? 25, 0, 50),
                } : undefined,
                points: r.points,
                zIndex: r.zIndex ?? 0,
                rotation: r.rotation ?? 0,
            }));

            const template: AdvancedTemplate = {
                id: `ai-${uuidv4().slice(0, 8)}`,
                name: layoutData.name || 'AI Generated Layout',
                category: validateCategory(layoutData.category),
                regions,
                photoCount: input.photoCount,
                isCustom: true,
                createdBy: 'ai',
                description: input.prompt,
            };

            return {
                template,
                success: true,
            };
        } catch (error) {
            return {
                template: null,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            };
        }
    }
);

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function validateShape(shape: string): ShapeType {
    const validShapes: ShapeType[] = ['rect', 'circle', 'ellipse', 'polygon', 'path'];
    return validShapes.includes(shape as ShapeType) ? (shape as ShapeType) : 'rect';
}

function validateCategory(category: string): TemplateCategory {
    const validCategories: TemplateCategory[] = ['grid', 'geometric', 'artistic', 'diagonal', 'custom'];
    return validCategories.includes(category as TemplateCategory) ? (category as TemplateCategory) : 'custom';
}
