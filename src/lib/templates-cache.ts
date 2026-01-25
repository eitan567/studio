/**
 * Template Cache - Module-Level In-Memory Cache
 * 
 * Loads templates from Supabase once per server instance.
 * STRICT MODE: Only loads from DB. No static fallback.
 */

import { createClient } from '@/lib/supabase';
import { AdvancedTemplate } from '@/lib/advanced-layout-types';

// Types
export interface GridTemplate {
    id: string;
    name: string;
    grid: string[];
    photoCount?: number; // Optional, derived from grid.length if not specified
}

// Internal DB Row Type (Reflects Joined Data)
export interface DBTemplate {
    id: string;
    name: string;
    type_id: number;
    category_id: number;
    // Joined relations
    template_type?: { code: string };
    template_category?: { code: string };
    // Other fields
    photo_count: number;
    grid?: string[];
    regions?: AdvancedTemplate['regions'];
    created_by?: string;
    is_system?: boolean;
    is_active?: boolean;
    sort_order?: number;
}

// Cache storage
let gridTemplatesCache: GridTemplate[] | null = null;
let advancedTemplatesCache: AdvancedTemplate[] | null = null;
let coverTemplatesCache: GridTemplate[] | null = null;
let cacheInitialized = false;
let cacheError: Error | null = null;

// Cache TTL (1 hour in ms)
const CACHE_TTL = 60 * 60 * 1000;
let cacheExpiry = 0;

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

        // Fetch all active templates with Joins
        // resolving type_id -> template_type.code
        const { data, error } = await supabase
            .from('templates')
            .select(`
                *,
                template_type:template_types ( code ),
                template_category:template_categories ( code )
            `)
            .eq('is_active', true)
            .order('sort_order');

        if (error) throw error;

        if (data && data.length > 0) {

            // Logic: GRID vs ADVANCED based on JOINED code
            // We default to 'GRID' if join fails/missing

            const rawGrids = data.filter((t: DBTemplate) => {
                const code = t.template_type?.code;
                return code === 'GRID' || !code;
            });

            const rawAdvanced = data.filter((t: DBTemplate) =>
                t.template_type?.code === 'ADVANCED'
            );

            gridTemplatesCache = rawGrids.map((t: DBTemplate) => ({
                id: t.id,
                name: t.name,
                grid: t.grid || []
            }));

            // Covers are grids
            coverTemplatesCache = [...gridTemplatesCache];

            advancedTemplatesCache = rawAdvanced.map((t: DBTemplate) => ({
                id: t.id,
                name: t.name,
                // Use joined category code
                category: (t.template_category?.code?.toLowerCase() || 'custom') as AdvancedTemplate['category'],
                photoCount: t.photo_count,
                regions: t.regions || [],
                createdBy: t.created_by as AdvancedTemplate['createdBy'],
                isCustom: t.created_by === 'user'
            }));

            console.log(`[TemplateCache] Loaded ${gridTemplatesCache.length} grid, ${advancedTemplatesCache.length} advanced from DB`);
        } else {
            console.warn('[TemplateCache] No templates found in DB.');
            gridTemplatesCache = [];
            advancedTemplatesCache = [];
            coverTemplatesCache = [];
        }

        cacheInitialized = true;
        cacheExpiry = now + CACHE_TTL;
        cacheError = null;

    } catch (error) {
        console.error('[TemplateCache] Failed to load from DB:', error);
        cacheError = error as Error;
        // NO FALLBACK
        gridTemplatesCache = [];
        advancedTemplatesCache = [];
        coverTemplatesCache = [];

        // Don't mark initialized so we retry next time
        cacheInitialized = false;
    }
}

/**
 * Get grid templates (for regular pages)
 */
export async function getGridTemplates(): Promise<GridTemplate[]> {
    await initializeCache();
    return gridTemplatesCache || [];
}

/**
 * Get advanced templates (shapes, circles, etc.)
 */
export async function getAdvancedTemplates(): Promise<AdvancedTemplate[]> {
    await initializeCache();
    return advancedTemplatesCache || [];
}

/**
 * Get cover templates
 */
export async function getCoverTemplates(): Promise<GridTemplate[]> {
    await initializeCache();
    return coverTemplatesCache || [];
}

/**
 * Get all templates combined
 */
export async function getAllTemplates() {
    const [grid, advanced, cover] = await Promise.all([
        getGridTemplates(),
        getAdvancedTemplates(),
        getCoverTemplates(),
    ]);
    return { grid, advanced, cover };
}

/**
 * SYNC versions for use in components that can't be async
 * Note: If cache isn't loaded, these return empty arrays.
 * Components should handle empty states or trigger preload.
 */
export function getGridTemplatesSync(): GridTemplate[] {
    return gridTemplatesCache || [];
}

export function getAdvancedTemplatesSync(): AdvancedTemplate[] {
    return advancedTemplatesCache || [];
}

export function getCoverTemplatesSync(): GridTemplate[] {
    return coverTemplatesCache || [];
}

/**
 * Force refresh the cache (call after admin updates templates)
 */
export function invalidateCache(): void {
    cacheInitialized = false;
    cacheExpiry = 0;
    gridTemplatesCache = null;
    advancedTemplatesCache = null;
    coverTemplatesCache = null;
    console.log('[TemplateCache] Cache invalidated');
}

let preloadPromise: Promise<void> | null = null;

/**
 * Preload the cache (call on app initialization)
 * Handles concurrent calls by returning the existing promise.
 */
export async function preloadCache(): Promise<void> {
    if (cacheInitialized && Date.now() < cacheExpiry) {
        return;
    }

    if (preloadPromise) {
        // console.log('[TemplateCache] Preload already in progress, joining...');
        return preloadPromise;
    }

    console.log('[TemplateCache] Preloading...');
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
        gridCount: gridTemplatesCache?.length ?? 0,
        advancedCount: advancedTemplatesCache?.length ?? 0,
        error: cacheError?.message ?? null,
    };
}
