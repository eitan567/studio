/**
 * useTemplates Hook
 * 
 * Centralized hook for accessing templates in React components.
 * Uses the templates-cache module which loads from Supabase DB
 * with in-memory caching and static fallback.
 */

import { useMemo, useEffect, useState } from 'react';
import {
    getGridTemplatesSync,
    getAdvancedTemplatesSync,
    getCoverTemplatesSync,
    preloadCache,
    GridTemplate
} from '@/lib/templates-cache';
import { AdvancedTemplate } from '@/lib/advanced-layout-types';

// Re-export types for convenience
export type { GridTemplate, AdvancedTemplate };

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

    const gridTemplates = useMemo(() => getGridTemplatesSync(), [trigger]);
    const advancedTemplates = useMemo(() => getAdvancedTemplatesSync(), [trigger]);
    const coverTemplates = useMemo(() => getCoverTemplatesSync(), [trigger]);

    // Combined templates for dropdowns
    const allTemplates = useMemo(() => [
        ...gridTemplates,
        ...advancedTemplates
    ], [gridTemplates, advancedTemplates]);

    const allCoverTemplates = useMemo(() => [
        ...coverTemplates,
        ...advancedTemplates
    ], [coverTemplates, advancedTemplates]);

    return {
        gridTemplates,
        advancedTemplates,
        coverTemplates,
        allTemplates,
        allCoverTemplates,

        // Utility functions
        findTemplate: (id: string) => {
            const baseId = id.replace(/-r\d+$/, ''); // Remove rotation suffix
            return gridTemplates.find(t => t.id === baseId)
                || advancedTemplates.find(t => t.id === baseId);
        },

        findGridTemplate: (id: string) => {
            const baseId = id.replace(/-r\d+$/, '');
            return gridTemplates.find(t => t.id === baseId) || gridTemplates[0];
        },

        findAdvancedTemplate: (id: string) => {
            const baseId = id.replace(/-r\d+$/, '');
            return advancedTemplates.find(t => t.id === baseId);
        },

        findCoverTemplate: (id: string) => {
            const baseId = id.replace(/-r\d+$/, '');
            return coverTemplates.find(t => t.id === baseId)
                || advancedTemplates.find(t => t.id === baseId);
        },

        defaultGridTemplate: gridTemplates[0],
        defaultCoverTemplate: coverTemplates[0],
    };
}

// Static exports for non-React contexts (sync versions)
export const LAYOUT_TEMPLATES = getGridTemplatesSync();
export const COVER_TEMPLATES = getCoverTemplatesSync();
export const ADVANCED_TEMPLATES = getAdvancedTemplatesSync();

/**
 * Get photo count from any template type
 * Works with GridTemplate, AdvancedTemplate, or any object with photoCount/grid/regions
 */
export function getPhotoCount(template: GridTemplate | AdvancedTemplate | null | undefined): number {
    if (!template) return 1;

    // Explicit photoCount property (AdvancedTemplate or GridTemplate with photoCount)
    if ('photoCount' in template && typeof template.photoCount === 'number') {
        return template.photoCount;
    }

    // Grid templates: count grid items
    if ('grid' in template && Array.isArray(template.grid)) {
        return template.grid.length;
    }

    // Advanced templates with regions
    if ('regions' in template && Array.isArray(template.regions)) {
        return template.regions.length;
    }

    return 1;
}

/**
 * Get templates for a page based on whether it's a cover
 */
export function getTemplatesForPage(isCover: boolean) {
    const grid = getGridTemplatesSync();
    const cover = getCoverTemplatesSync();
    const advanced = getAdvancedTemplatesSync();

    return isCover
        ? [...cover, ...advanced]
        : [...grid, ...advanced];
}

/**
 * Find a template by ID (works for both grid and advanced)
 */
export function findTemplateById(id: string) {
    const baseId = id.replace(/-r\d+$/, '');
    const grid = getGridTemplatesSync();
    const advanced = getAdvancedTemplatesSync();

    return grid.find(t => t.id === baseId) || advanced.find(t => t.id === baseId);
}

/**
 * Get template photo count
 */
export function getTemplatePhotoCount(templateId: string): number {
    const template = findTemplateById(templateId);
    if (!template) return 1;

    // Grid templates have grid array length
    if ('grid' in template && template.grid) {
        return template.grid.length;
    }

    // Advanced templates have photoCount property
    if ('photoCount' in template && typeof template.photoCount === 'number') {
        return template.photoCount;
    }

    // Advanced templates with regions
    if ('regions' in template && Array.isArray(template.regions)) {
        return template.regions.length;
    }

    return 1;
}
