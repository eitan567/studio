/**
 * Template Cache - Module-Level In-Memory Cache
 * 
 * Loads templates from Supabase once per server instance.
 * Falls back to static templates if DB is unavailable.
 */

import { createClient } from '@/lib/supabase';
import { LAYOUT_TEMPLATES as STATIC_LAYOUT_TEMPLATES, COVER_TEMPLATES as STATIC_COVER_TEMPLATES } from '@/components/album/layout-templates';
import { ADVANCED_TEMPLATES as STATIC_ADVANCED_TEMPLATES, AdvancedTemplate } from '@/lib/advanced-layout-types';

// Types
export interface GridTemplate {
    id: string;
    name: string;
    grid: string[];
    photoCount?: number; // Optional, derived from grid.length if not specified
}

export interface DBTemplate {
    id: string;
    name: string;
    type: 'grid' | 'advanced' | 'cover';
    category?: string;
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

        // Fetch all active templates
        const { data, error } = await supabase
            .from('templates')
            .select('*')
            .eq('is_active', true)
            .order('sort_order');

        if (error) throw error;

        if (data && data.length > 0) {
            // Separate by type
            gridTemplatesCache = data
                .filter((t: DBTemplate) => t.type === 'grid')
                .map((t: DBTemplate) => ({
                    id: t.id,
                    name: t.name,
                    grid: t.grid || []
                }));

            advancedTemplatesCache = data
                .filter((t: DBTemplate) => t.type === 'advanced')
                .map((t: DBTemplate) => ({
                    id: t.id,
                    name: t.name,
                    category: t.category as AdvancedTemplate['category'],
                    photoCount: t.photo_count,
                    regions: t.regions || [],
                    createdBy: t.created_by as AdvancedTemplate['createdBy'],
                }));

            coverTemplatesCache = data
                .filter((t: DBTemplate) => t.type === 'cover')
                .map((t: DBTemplate) => ({
                    id: t.id,
                    name: t.name,
                    grid: t.grid || []
                }));

            console.log(`[TemplateCache] Loaded ${gridTemplatesCache.length} grid, ${advancedTemplatesCache.length} advanced, ${coverTemplatesCache.length} cover templates from DB`);
        } else {
            console.log('[TemplateCache] No templates in DB, using static fallback');
        }

        cacheInitialized = true;
        cacheExpiry = now + CACHE_TTL;
        cacheError = null;

    } catch (error) {
        console.error('[TemplateCache] Failed to load from DB, using static fallback:', error);
        cacheError = error as Error;
        // Keep using static templates as fallback
        cacheInitialized = true; // Prevent repeated failed attempts
        cacheExpiry = now + (5 * 60 * 1000); // Retry in 5 minutes on error
    }
}

/**
 * Get grid templates (for regular pages)
 */
export async function getGridTemplates(): Promise<GridTemplate[]> {
    await initializeCache();
    if (gridTemplatesCache && gridTemplatesCache.length > 0) {
        return gridTemplatesCache;
    }
    return STATIC_LAYOUT_TEMPLATES;
}

/**
 * Get advanced templates (shapes, circles, etc.)
 */
export async function getAdvancedTemplates(): Promise<AdvancedTemplate[]> {
    await initializeCache();
    if (advancedTemplatesCache && advancedTemplatesCache.length > 0) {
        return advancedTemplatesCache;
    }
    return STATIC_ADVANCED_TEMPLATES;
}

/**
 * Get cover templates
 */
export async function getCoverTemplates(): Promise<GridTemplate[]> {
    await initializeCache();
    if (coverTemplatesCache && coverTemplatesCache.length > 0) {
        return coverTemplatesCache;
    }
    return STATIC_COVER_TEMPLATES;
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
 * These return cached data or static fallback immediately
 */
export function getGridTemplatesSync(): GridTemplate[] {
    if (gridTemplatesCache && gridTemplatesCache.length > 0) {
        return gridTemplatesCache;
    }
    return STATIC_LAYOUT_TEMPLATES;
}

export function getAdvancedTemplatesSync(): AdvancedTemplate[] {
    if (advancedTemplatesCache && advancedTemplatesCache.length > 0) {
        return advancedTemplatesCache;
    }
    return STATIC_ADVANCED_TEMPLATES;
}

export function getCoverTemplatesSync(): GridTemplate[] {
    if (coverTemplatesCache && coverTemplatesCache.length > 0) {
        return coverTemplatesCache;
    }
    return STATIC_COVER_TEMPLATES;
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

/**
 * Preload the cache (call on app initialization)
 */
export async function preloadCache(): Promise<void> {
    console.log('[TemplateCache] Preloading...');
    await initializeCache();
}

/**
 * Get cache status (for debugging/monitoring)
 */
export function getCacheStatus() {
    return {
        initialized: cacheInitialized,
        expiresAt: cacheExpiry ? new Date(cacheExpiry).toISOString() : null,
        gridCount: gridTemplatesCache?.length ?? 'using static',
        advancedCount: advancedTemplatesCache?.length ?? 'using static',
        coverCount: coverTemplatesCache?.length ?? 'using static',
        error: cacheError?.message ?? null,
    };
}
