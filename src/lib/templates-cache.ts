/**
 * Template Cache - Unified Template System
 * 
 * All templates use region-based format (AdvancedTemplate).
 * Loads templates from Supabase once per server instance.
 */

import { createClient } from '@/lib/supabase';
import { AdvancedTemplate, LayoutRegion } from '@/lib/advanced-layout-types';
import { logger } from '@/lib/logger';
import { LAYOUT_TEMPLATES, COVER_TEMPLATES } from '@/components/album/layouts/templates';

// Re-export the unified type
export type { AdvancedTemplate };

// Legacy GridTemplate type - kept for compatibility but maps to AdvancedTemplate
export interface GridTemplate extends AdvancedTemplate { }

// Internal DB Row Type (Reflects Joined Data)
export interface DBTemplate {
    id: string | number;
    slug?: string;
    name: string;
    type_id: number;
    category_id: number;
    template_type?: { code: string };
    template_category?: { code: string };
    photo_count: number;
    grid?: string[];
    regions?: AdvancedTemplate['regions'];
    // Simplified: removed created_by and is_system checks
    is_active?: boolean;
    sort_order?: number;
    description?: string;
    // Keep template_classification for type classification
    template_classification?: { code: string };
}

// Unified cache storage
let templatesCache: AdvancedTemplate[] | null = null;
let coverTemplatesCache: AdvancedTemplate[] | null = null;
let cacheInitialized = false;
let cacheError: Error | null = null;

// Cache TTL (1 hour in ms)
const CACHE_TTL = 60 * 60 * 1000;
let cacheExpiry = 0;

/**
 * Helper: Convert CSS grid classes to region bounds
 * Grid uses 12x12 system, converts to percentages (0-100)
 */
function gridClassToRegion(id: string, gridClass: string): LayoutRegion {
    // Parse col-span-X, col-start-X col-end-Y, row-span-X, row-start-X row-end-Y
    let x = 0, y = 0, width = 100, height = 100;

    // Column parsing
    const colSpan = gridClass.match(/col-span-(\d+)/);
    const colStart = gridClass.match(/col-start-(\d+)/);
    const colEnd = gridClass.match(/col-end-(\d+)/);

    if (colSpan) {
        width = (parseInt(colSpan[1]) / 12) * 100;
    } else if (colStart && colEnd) {
        const start = parseInt(colStart[1]) - 1; // 1-indexed to 0-indexed
        const end = parseInt(colEnd[1]) - 1;
        x = (start / 12) * 100;
        width = ((end - start) / 12) * 100;
    }

    // Row parsing
    const rowSpan = gridClass.match(/row-span-(\d+)/);
    const rowStart = gridClass.match(/row-start-(\d+)/);
    const rowEnd = gridClass.match(/row-end-(\d+)/);

    if (rowSpan) {
        height = (parseInt(rowSpan[1]) / 12) * 100;
    } else if (rowStart && rowEnd) {
        const start = parseInt(rowStart[1]) - 1;
        const end = parseInt(rowEnd[1]) - 1;
        y = (start / 12) * 100;
        height = ((end - start) / 12) * 100;
    }

    return {
        id,
        shape: 'rect',
        bounds: { x, y, width, height }
    };
}

/**
 * Convert a DB grid template to AdvancedTemplate format
 * Smart layout: calculates proper X/Y positions when col-start/row-start are missing
 */
function convertGridToAdvanced(dbTemplate: DBTemplate): AdvancedTemplate {
    const gridClasses = dbTemplate.grid || [];

    // Parse all grid classes to get dimensions and explicit positions
    const parsed = gridClasses.map((gridClass, index) => {
        let x = -1, y = -1, width = 100, height = 100; // -1 means "needs calculation"

        // Column parsing
        const colSpan = gridClass.match(/col-span-(\d+)/);
        const colStart = gridClass.match(/col-start-(\d+)/);
        const colEnd = gridClass.match(/col-end-(\d+)/);

        if (colStart && colEnd) {
            const start = parseInt(colStart[1]) - 1;
            const end = parseInt(colEnd[1]) - 1;
            x = (start / 12) * 100;
            width = ((end - start) / 12) * 100;
        } else if (colStart) {
            x = ((parseInt(colStart[1]) - 1) / 12) * 100;
            width = colSpan ? (parseInt(colSpan[1]) / 12) * 100 : 100;
        } else if (colSpan) {
            width = (parseInt(colSpan[1]) / 12) * 100;
        }

        // Row parsing
        const rowSpan = gridClass.match(/row-span-(\d+)/);
        const rowStart = gridClass.match(/row-start-(\d+)/);
        const rowEnd = gridClass.match(/row-end-(\d+)/);

        if (rowStart && rowEnd) {
            const start = parseInt(rowStart[1]) - 1;
            const end = parseInt(rowEnd[1]) - 1;
            y = (start / 12) * 100;
            height = ((end - start) / 12) * 100;
        } else if (rowStart) {
            y = ((parseInt(rowStart[1]) - 1) / 12) * 100;
            height = rowSpan ? (parseInt(rowSpan[1]) / 12) * 100 : 100;
        } else if (rowSpan) {
            height = (parseInt(rowSpan[1]) / 12) * 100;
        }

        return { id: `r${index + 1}`, x, y, width, height };
    });

    // Smart layout: fill in missing X/Y positions
    // Row-based filling: stack horizontally until row is full, then move to next row
    let currentX = 0;
    let currentY = 0;
    let rowHeight = 0;

    const regions: LayoutRegion[] = parsed.map((p, index) => {
        // If explicit position not set, calculate based on flow
        let x = p.x >= 0 ? p.x : currentX;
        let y = p.y >= 0 ? p.y : currentY;

        // Check if it fits in current row
        if (p.x < 0 && currentX + p.width > 100.01) {
            // Move to next row
            currentY += rowHeight;
            currentX = 0;
            x = 0;
            y = currentY;
            rowHeight = 0;
        }

        // Update tracking for next region
        if (p.x < 0) {
            currentX = x + p.width;
            rowHeight = Math.max(rowHeight, p.height);
        }

        return {
            id: p.id,
            shape: 'rect' as const,
            bounds: { x, y, width: p.width, height: p.height }
        };
    });

    return {
        id: dbTemplate.id,
        name: dbTemplate.name,
        category: 'grid',
        photoCount: dbTemplate.photo_count || regions.length,
        regions,
        createdBy: 'system' as AdvancedTemplate['createdBy'],
        isCustom: false
    };
}

/**
 * Parse description JSON to extract template settings
 */
function parseTemplateDescription(description?: string): { _pageMargin?: number; _photoGap?: number; type?: 'single' | 'spread' | 'both' } {
    if (!description) return {};
    try {
        const parsed = JSON.parse(description);
        return {
            _pageMargin: typeof parsed._pageMargin === 'number' ? parsed._pageMargin : undefined,
            _photoGap: typeof parsed._photoGap === 'number' ? parsed._photoGap : undefined,
            type: parsed.type
        };
    } catch {
        return {};
    }
}

/**
 * Initialize the cache from Supabase
 */
async function initializeCache(): Promise<void> {
    const now = Date.now();

    // Skip if cache is still valid
    if (cacheInitialized && now < cacheExpiry) {
        return;
    }

    try {
        const supabase = createClient();

        // Force cache refresh by invalidating before query
        cacheExpiry = 0;

        // Fetch all active templates with joins
        const { data: templatesData, error } = await supabase
            .from('templates')
            .select(`
                *,
                template_type:template_types ( code ),
                template_category:template_categories ( code ),
                template_classification:template_classifications ( code )
            `)
            .eq('is_active', true)
            .order('sort_order');

        if (error) throw error;

        const data = templatesData;

        if (data && data.length > 0) {
            logger.info(`[Templates] Found ${data.length} templates in DB`);

            // Convert ALL templates to AdvancedTemplate format
            const mappedTemplates = data.map((t: DBTemplate) => {
                logger.debug(`[Templates] Processing template: ${t.id}`);

                // Parse description for page settings
                const descSettings = parseTemplateDescription(t.description);
                const typeCode = t.template_type?.code;

                // Simplified template - removed created_by and is_system checks
                const baseTemplate = {
                    id: t.id,
                    name: t.name,
                    category: (t.template_category?.code?.toLowerCase() || 'grid') as AdvancedTemplate['category'],
                    createdBy: 'system' as AdvancedTemplate['createdBy'],
                    isCustom: false,
                    // Use template_classification code if available
                    type: (t.template_classification?.code?.toLowerCase() || descSettings.type) as AdvancedTemplate['type'],
                    _pageMargin: descSettings._pageMargin,
                    _photoGap: descSettings._photoGap,
                };

                // Safely parse regions if it's a string (in case Supabase returns JSON as string)
                let regions = t.regions;
                if (typeof regions === 'string') {
                    try {
                        regions = JSON.parse(regions);
                    } catch (e) {
                        logger.error('Failed to parse regions JSON', e);
                        regions = [];
                    }
                }

                // If template has valid regions already, use them directly
                if (regions && Array.isArray(regions) && regions.length > 0) {
                    return {
                        ...baseTemplate,
                        photoCount: t.photo_count || regions.length,
                        regions: regions
                    };
                }

                // Safely parse grid if it's a string
                let gridClasses = t.grid;
                if (typeof gridClasses === 'string') {
                    try {
                        gridClasses = JSON.parse(gridClasses);
                    } catch (e) {
                        gridClasses = [];
                    }
                }

                // If it's old GRID type without regions, convert it
                if (typeCode === 'GRID' || (!typeCode && gridClasses)) {
                    // Update t.grid locally for the conversion function
                    t.grid = gridClasses;
                    const converted = convertGridToAdvanced(t);
                    return {
                        ...baseTemplate,
                        ...converted,
                        category: 'grid' as const
                    };
                }

                // Fallback for templates without regions
                const template = {
                    ...baseTemplate,
                    photoCount: t.photo_count || 1,
                    regions: []
                };

                return template;
            });

            // Deduplicate by ID
            const seenIds = new Map<string, AdvancedTemplate>();
            for (const template of mappedTemplates) {
                const sId = String(template.id);
                if (!seenIds.has(sId)) {
                    seenIds.set(sId, template);
                }
            }
            templatesCache = Array.from(seenIds.values());

            // Covers use same templates
            coverTemplatesCache = [...templatesCache];

            logger.info(`Loaded ${templatesCache.length} unified templates from DB (deduplicated from ${data.length})`);
        } else {
            logger.warn('No templates found in DB, using static fallback.');
            // Use static templates from templates.tsx
            templatesCache = [...LAYOUT_TEMPLATES];
            coverTemplatesCache = [...COVER_TEMPLATES];
        }

        cacheInitialized = true;
        cacheExpiry = now + CACHE_TTL;
        cacheError = null;

    } catch (error) {
        logger.error('Failed to load from DB, using static fallback:', error);
        cacheError = error as Error;
        // Use static templates as fallback
        templatesCache = [...LAYOUT_TEMPLATES];
        coverTemplatesCache = [...COVER_TEMPLATES];
        cacheInitialized = true;
        cacheExpiry = now + CACHE_TTL;
    }
}

/**
 * Get all templates (unified - no grid/advanced distinction)
 */
export async function getTemplates(): Promise<AdvancedTemplate[]> {
    await initializeCache();
    return templatesCache || [];
}

// Legacy aliases for compatibility
export async function getGridTemplates(): Promise<AdvancedTemplate[]> {
    return getTemplates();
}

export async function getAdvancedTemplates(): Promise<AdvancedTemplate[]> {
    return getTemplates();
}

export async function getCoverTemplates(): Promise<AdvancedTemplate[]> {
    await initializeCache();
    return coverTemplatesCache || [];
}

/**
 * Get all templates combined
 */
export async function getAllTemplates() {
    const templates = await getTemplates();
    const cover = await getCoverTemplates();
    return {
        grid: templates,
        advanced: templates,
        cover,
        all: templates
    };
}

/**
 * SYNC versions for use in components that can't be async
 */
export function getTemplatesSync(): AdvancedTemplate[] {
    return templatesCache || LAYOUT_TEMPLATES;
}

// Legacy aliases
export function getGridTemplatesSync(): AdvancedTemplate[] {
    return getTemplatesSync();
}

export function getAdvancedTemplatesSync(): AdvancedTemplate[] {
    return getTemplatesSync();
}

export function getCoverTemplatesSync(): AdvancedTemplate[] {
    return coverTemplatesCache || COVER_TEMPLATES;
}

/**
 * Force refresh the cache
 */
export function invalidateCache(): void {
    cacheInitialized = false;
    cacheExpiry = 0;
    templatesCache = null;
    coverTemplatesCache = null;
    logger.info('Cache invalidated');
}

let preloadPromise: Promise<void> | null = null;

/**
 * Preload the cache (call on app initialization)
 */
export async function preloadCache(): Promise<void> {
    if (cacheInitialized && Date.now() < cacheExpiry) {
        return;
    }

    if (preloadPromise) {
        return preloadPromise;
    }

    logger.debug('Preloading templates...');
    preloadPromise = initializeCache().finally(() => {
        preloadPromise = null;
    });

    return preloadPromise;
}

/**
 * Get cache status (for debugging/monitoring)
 */
export function getCacheStatus() {
    return {
        initialized: cacheInitialized,
        expiresAt: cacheExpiry ? new Date(cacheExpiry).toISOString() : null,
        templateCount: templatesCache?.length ?? 0,
        coverCount: coverTemplatesCache?.length ?? 0,
        error: cacheError?.message ?? null,
    };
}
