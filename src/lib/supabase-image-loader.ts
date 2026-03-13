
import { createClient } from './supabase';
import { buildSupabaseStorageUrl, normalizeSupabaseStorageUrl } from './supabase-media-normalizer';

const supabase = createClient();

export type ImageSize = 'thumbnail' | 'preview' | 'full';

export const ImageSizes: Record<ImageSize, { width: number; height: number; quality: number }> = {
    thumbnail: { width: 620, height: 620, quality: 90 },
    preview: { width: 800, height: 800, quality: 90 },
    full: { width: 2000, height: 2000, quality: 90 },
};

export interface TransformOptions {
    width?: number;
    height?: number;
    quality?: number;
    resize?: 'cover' | 'contain' | 'fill';
    format?: 'origin' | 'webp' | 'avif';
}

function isLocalSupabaseUrl(url: string): boolean {
    return url.includes('127.0.0.1') || url.includes('localhost');
}

function buildLocalTransformUrl(src: string, options: TransformOptions = {}): string {
    const params = new URLSearchParams();
    params.set('src', src);

    if (options.width) params.set('w', options.width.toString());
    if (options.height) params.set('h', options.height.toString());
    if (options.quality !== undefined) params.set('q', options.quality.toString());
    if (options.resize) params.set('resize', options.resize);
    if (options.format) params.set('format', options.format);

    return `/api/image/transform?${params.toString()}`;
}

function shouldUseLocalTransformFallback(options: TransformOptions): boolean {
    return typeof options.width === 'number' && typeof options.height === 'number';
}

/**
 * Generates an optimized public URL for a Supabase Storage image.
 * Uses the 'transform' API if available (requires Pro plan or configured self-hosting).
 * Fallback to standard URL if local dev (or handle local dev specifically if needed).
 */
export function getOptimizedImageUrl(storagePath: string, options: TransformOptions = {}): string {
    if (!storagePath) return '';

    const isLocal = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('127.0.0.1') ||
        process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('localhost');

    // Supabase Local Storage typically doesn't support the /render/image API out of the box
    // unless configured with imgproxy. Use a local app route so local thumbnails are resized for real.
    if (isLocal) {
        const { data } = supabase.storage.from('photos').getPublicUrl(storagePath);
        if (shouldUseLocalTransformFallback(options)) {
            return buildLocalTransformUrl(data.publicUrl, options);
        }

        return data.publicUrl;
    }

    // In local development (127.0.0.1), transformation API might behave differently or be absent.
    // Standard getPublicUrl typically returns the raw file URL.
    // We apply transformation params which Supabase Storage handles if the image server is active.

    const { data } = supabase.storage
        .from('photos')
        .getPublicUrl(storagePath, {
            transform: {
                width: options.width,
                height: options.height,
                quality: options.quality ?? 80,
                format: (options.format || 'webp') as any,
                resize: options.resize || 'cover',
            },
        });

    return data.publicUrl;
}

export function buildSupabaseImageUrl(src: string, options: TransformOptions = {}): string {
    if (!src) return '';

    if (!src.startsWith('http')) {
        const isLocal = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('127.0.0.1') ||
            process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('localhost');

        if (isLocal) {
            const publicUrl = buildSupabaseStorageUrl(src);
            if (!publicUrl) return src;
            return shouldUseLocalTransformFallback(options)
                ? buildLocalTransformUrl(publicUrl, options)
                : publicUrl;
        }

        return getOptimizedImageUrl(src, options);
    }

    if (src.includes('/storage/v1/object/public/') || src.includes('/storage/v1/render/image/public/')) {
        const normalizedSrc = normalizeSupabaseStorageUrl(src) || src;
        const isLocal = isLocalSupabaseUrl(normalizedSrc);

        if (isLocal) {
            return shouldUseLocalTransformFallback(options)
                ? buildLocalTransformUrl(normalizedSrc, options)
                : normalizedSrc;
        }

        const transformSrc = normalizedSrc
            .replace(/\/storage\/v1\/object\/public\//, '/storage/v1/render/image/public/');

        try {
            const url = new URL(transformSrc);
            if (options.width) url.searchParams.set('width', options.width.toString());
            if (options.height) url.searchParams.set('height', options.height.toString());
            url.searchParams.set('quality', (options.quality ?? 80).toString());
            url.searchParams.set('format', options.format || 'webp');
            url.searchParams.set('resize', options.resize || 'contain');
            return url.toString();
        } catch (e) {
            return normalizedSrc;
        }
    }

    try {
        const url = new URL(src);
        if (options.width) url.searchParams.set('w', options.width.toString());
        if (options.height) url.searchParams.set('h', options.height.toString());
        return url.toString();
    } catch (e) {
        return src;
    }
}

/**
 * Next.js Image Loader function
 * Compatible with next/image 'loader' prop
 */
export default function supabaseLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
    return buildSupabaseImageUrl(src, { width, quality, resize: 'contain' });
}
