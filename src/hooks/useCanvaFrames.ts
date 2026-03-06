'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { AdvancedTemplate, LayoutRegion } from '@/lib/advanced-layout-types';

export interface CanvaFrame {
    id: string;
    name: string;
    path: string;
    view_box: string;
    category: string;
    frame_type: 'simple' | 'complex';
    svg_content: string | null;
    is_public: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

let cachedPublicFrameTemplates: AdvancedTemplate[] | null = null;
let pendingPublicFramesFetch: Promise<AdvancedTemplate[]> | null = null;

async function loadPublicCanvaFrameTemplates(): Promise<AdvancedTemplate[]> {
    if (cachedPublicFrameTemplates) {
        return cachedPublicFrameTemplates;
    }

    if (pendingPublicFramesFetch) {
        return pendingPublicFramesFetch;
    }

    pendingPublicFramesFetch = (async () => {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
            .from('canva_frames')
            .select('*')
            .eq('is_public', true)
            .order('name', { ascending: true });

        if (fetchError) {
            throw new Error(fetchError.message);
        }

        const templates = (data as CanvaFrame[]).map(frameToTemplate);
        cachedPublicFrameTemplates = templates;
        return templates;
    })();

    try {
        return await pendingPublicFramesFetch;
    } finally {
        pendingPublicFramesFetch = null;
    }
}

/**
 * Convert a database CanvaFrame to an AdvancedTemplate format
 * This allows frames from the DB to be used with the existing template system
 */
function frameToTemplate(frame: CanvaFrame): AdvancedTemplate {
    // Create a single region from the frame's path data
    const region: LayoutRegion = {
        id: 'main',
        shape: 'path',
        path: frame.path,
        viewBox: frame.view_box,
        bounds: parseBoundsFromViewBox(frame.view_box),
        zIndex: 1
    };

    return {
        id: frame.id,
        name: frame.name,
        category: (frame.category as 'grid' | 'geometric' | 'artistic' | 'diagonal' | 'custom') || 'custom',
        photoCount: 1,
        createdBy: null,
        regions: [region]
    };
}

/**
 * Parse viewBox string to get bounds
 * viewBox format: "minX minY width height"
 */
function parseBoundsFromViewBox(viewBox: string): { x: number; y: number; width: number; height: number } {
    const parts = viewBox.split(' ').map(Number);
    if (parts.length >= 4) {
        return {
            x: parts[0] || 0,
            y: parts[1] || 0,
            width: parts[2] || 100,
            height: parts[3] || 100
        };
    }
    return { x: 0, y: 0, width: 100, height: 100 };
}

/**
 * Hook to fetch canva frames from the database
 * Returns frames as AdvancedTemplate[] for compatibility with existing components
 */
export function useCanvaFrames() {
    const [frames, setFrames] = useState<AdvancedTemplate[]>([]);
    const [loading, setLoading] = useState(!cachedPublicFrameTemplates);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (cachedPublicFrameTemplates) {
            setFrames(cachedPublicFrameTemplates);
            setLoading(false);
            return;
        }

        let cancelled = false;

        async function fetchFrames() {
            try {
                const templates = await loadPublicCanvaFrameTemplates();
                if (cancelled) return;
                setFrames(templates);
            } catch (err) {
                if (cancelled) return;
                console.error('Error fetching canva frames:', err);
                setError(err instanceof Error ? err : new Error('Failed to fetch frames'));
            } finally {
                if (cancelled) return;
                setLoading(false);
            }
        }

        fetchFrames();

        return () => {
            cancelled = true;
        };
    }, []);

    return { frames, loading, error };
}

/**
 * Fetch frames by category
 */
export async function fetchFramesByCategory(category: string): Promise<AdvancedTemplate[]> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('canva_frames')
        .select('*')
        .eq('category', category)
        .eq('is_public', true)
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching frames by category:', error);
        return [];
    }

    return (data as CanvaFrame[]).map(frameToTemplate);
}

/**
 * Fetch a single frame by ID
 */
export async function fetchFrameById(id: string): Promise<AdvancedTemplate | null> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('canva_frames')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching frame:', error);
        return null;
    }

    return frameToTemplate(data as CanvaFrame);
}
