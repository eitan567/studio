/**
 * useTemplates Hook - Unified Template System
 * 
 * All templates are now AdvancedTemplate with regions.
 * Provides centralized access to templates in React components.
 */

import { useMemo, useEffect, useState } from 'react';
import {
    getTemplatesSync,
    getCoverTemplatesSync,
    getTemplateTypesSync,
    getTemplateCategoriesSync,
    getTemplateClassificationsSync,
    preloadCache,
    invalidateCache, // Add this
    AdvancedTemplate
} from '@/lib/templates-cache';
import { useSettings } from '@/hooks/use-settings';
import { parseLayoutId } from '@/lib/layout-id-utils';

// Re-export types for convenience
export type { AdvancedTemplate };
// Legacy alias
export type GridTemplate = AdvancedTemplate;

/**
 * Hook to access all templates (cached/DB-backed)
 */
export function useTemplates() {
    const [trigger, setTrigger] = useState(0);

    // Preload cache on mount
    useEffect(() => {
        preloadCache().then(() => {
            // Force re-render after cache is loaded
            setTrigger(t => t + 1);
        });
    }, []);

    const { settings } = useSettings();

    // All templates - unified
    const allRawTemplates = useMemo(() => getTemplatesSync(), [trigger]);
    const rawCoverTemplates = useMemo(() => getCoverTemplatesSync(), [trigger]);

    // Reference data
    const templateTypes = useMemo(() => getTemplateTypesSync(), [trigger]);
    const templateCategories = useMemo(() => getTemplateCategoriesSync(), [trigger]);
    const templateClassifications = useMemo(() => getTemplateClassificationsSync(), [trigger]);

    // Filter by visibility settings
    const templates = useMemo(() => {
        // Show all if 'grid' or 'advanced' categories are visible
        const showGrid = settings?.visibleTemplateCategories?.includes('grid');
        const showAdvanced = settings?.visibleTemplateCategories?.includes('advanced');

        if (!showGrid && !showAdvanced) return [];

        return allRawTemplates.filter(t => {
            // Robust string comparison for hidden IDs
            const tid = String(t.id);
            if (settings?.hiddenTemplateIds?.some(hid => String(hid).trim() === tid)) return false;

            // Filter by category
            if (t.category === 'grid' && !showGrid) return false;
            if (t.category !== 'grid' && !showAdvanced) return false;
            return true;
        });
    }, [allRawTemplates, settings?.visibleTemplateCategories, settings?.hiddenTemplateIds]);

    const coverTemplates = useMemo(() => {
        const visible = settings?.visibleTemplateCategories?.includes('cover')
            ? rawCoverTemplates
            : [];
        return visible.filter(t => {
            const tid = String(t.id);
            return !settings?.hiddenTemplateIds?.some(hid => String(hid).trim() === tid);
        });
    }, [rawCoverTemplates, settings?.visibleTemplateCategories, settings?.hiddenTemplateIds]);

    // advancedTemplates = templates that are NOT grid (for backward compatibility)
    const advancedTemplates = useMemo(() => {
        return templates.filter(t => t.category !== 'grid');
    }, [templates]);

    // gridTemplates = only templates with category 'grid' (mutually exclusive with advancedTemplates)
    const gridTemplates = useMemo(() => {
        return templates.filter(t => t.category === 'grid');
    }, [templates]);

    return {
        // Unified templates
        templates,
        allTemplates: templates,

        // Legacy aliases for compatibility
        gridTemplates,
        advancedTemplates,
        coverTemplates,

        // Raw (unfiltered) for lookups
        rawGridTemplates: allRawTemplates,
        rawAdvancedTemplates: allRawTemplates,
        rawCoverTemplates,

        // Combined templates for dropdowns
        allCoverTemplates: coverTemplates,

        // Reference data
        templateTypes,
        templateCategories,
        templateClassifications,

        // Utility functions
        findTemplate: (id: string | number | null | undefined) => {
            if (id == null) return undefined;
            const { baseId } = parseLayoutId(id);
            return allRawTemplates.find(t => String(t.id) === String(baseId));
        },

        // Legacy aliases
        findGridTemplate: (id: string | number | null | undefined) => {
            if (id == null) return allRawTemplates[0];
            const { baseId } = parseLayoutId(id);
            return allRawTemplates.find(t => String(t.id) === String(baseId)) || allRawTemplates[0];
        },

        findAdvancedTemplate: (id: string | number | null | undefined) => {
            if (id == null) return undefined;
            const { baseId } = parseLayoutId(id);
            return allRawTemplates.find(t => String(t.id) === String(baseId));
        },

        findCoverTemplate: (id: string | number | null | undefined) => {
            if (id == null) return undefined;
            const { baseId } = parseLayoutId(id);
            return rawCoverTemplates.find(t => String(t.id) === String(baseId));
        },

        defaultGridTemplate: templates[0] || allRawTemplates[0],
        defaultCoverTemplate: coverTemplates[0] || rawCoverTemplates[0],

        // Refresh function
        refresh: async () => {
            invalidateCache();
            await preloadCache();
            setTrigger(t => t + 1);
        }
    };
}

// Static exports for non-React contexts (sync versions)
export const LAYOUT_TEMPLATES = getTemplatesSync();
export const COVER_TEMPLATES = getCoverTemplatesSync();
export const ADVANCED_TEMPLATES = getTemplatesSync();

/**
 * Get photo count from any template type
 * Uses regions.length for all templates now
 */
export function getPhotoCount(template: AdvancedTemplate | null | undefined): number {
    if (!template) return 1;

    // Explicit photoCount property
    if ('photoCount' in template && typeof template.photoCount === 'number') {
        return template.photoCount;
    }

    // Count regions
    if ('regions' in template && Array.isArray(template.regions)) {
        return template.regions.length;
    }

    return 1;
}

/**
 * Get templates for a page based on whether it's a cover
 */
export function getTemplatesForPage(isCover: boolean) {
    const templates = getTemplatesSync();
    const cover = getCoverTemplatesSync();

    return isCover ? cover : templates;
}

/**
 * Find a template by ID
 */
export function findTemplateById(id: string | number | null | undefined) {
    if (id == null) return undefined;
    const { baseId } = parseLayoutId(id);
    const templates = getTemplatesSync();
    return templates.find(t => String(t.id) === String(baseId));
}

/**
 * Get template photo count by ID
 */
export function getTemplatePhotoCount(templateId: string | number): number {
    const template = findTemplateById(templateId);
    return getPhotoCount(template);
}
