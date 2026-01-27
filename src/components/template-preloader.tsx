'use client';

/**
 * TemplatePreloader Component
 * 
 * Preloads templates from Supabase into the in-memory cache
 * on application startup. This is a "silent" component that
 * renders nothing but triggers the cache preload.
 */

import { useEffect } from 'react';
import { preloadCache, getCacheStatus } from '@/lib/templates-cache';
import { logger } from '@/lib/logger';

export function TemplatePreloader() {
    useEffect(() => {
        // Preload templates on mount
        preloadCache().then(() => {
            const status = getCacheStatus();
            logger.debug('Cache loaded:', status);
        }).catch((error) => {
            logger.error('Failed to preload:', error);
        });
    }, []);

    // This component renders nothing
    return null;
}

export default TemplatePreloader;
