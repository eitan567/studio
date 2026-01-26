
import { createClient } from './supabase';

const supabase = createClient();

export type ImageSize = 'thumbnail' | 'preview' | 'full';

export const ImageSizes: Record<ImageSize, { width: number; height: number; quality: number }> = {
    thumbnail: { width: 300, height: 300, quality: 70 }, // Increased slightly for higher density screens
    preview: { width: 800, height: 800, quality: 80 },
    full: { width: 2000, height: 2000, quality: 90 },
};

export interface TransformOptions {
    width?: number;
    height?: number;
    quality?: number;
    resize?: 'cover' | 'contain' | 'fill';
    format?: 'origin' | 'webp' | 'avif';
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
    // unless configured with imgproxy. To avoid broken images locally, we skip transformations.
    if (isLocal) {
        const { data } = supabase.storage.from('photos').getPublicUrl(storagePath);
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
                quality: options.quality || 80,
                format: options.format || 'webp',
                resize: options.resize || 'cover',
            },
        });

    return data.publicUrl;
}

/**
 * Next.js Image Loader function
 * Compatible with next/image 'loader' prop
 */
export default function supabaseLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
    // If src is already a full URL, we might need to extract the path or just append params if it supports it.
    // But typically for next/image with a custom loader, 'src' is the partial path provided to <Image src="..." />.
    // However, in our app, we often pass full authenticated URLs or public URLs.
    // We need to handle both cases or force usage of storage paths.

    // CASE 1: src is a storage path (e.g. "user_id/filename.jpg")
    if (!src.startsWith('http')) {
        return getOptimizedImageUrl(src, { width, quality, resize: 'contain' });
    }

    // CASE 2: src is already a Supabase URL
    // We can try to inject transform params if it matches our Supabase URL.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl && src.startsWith(supabaseUrl)) {
        const url = new URL(src);
        url.searchParams.set('width', width.toString());
        url.searchParams.set('quality', (quality || 75).toString());
        url.searchParams.set('format', 'webp');
        url.searchParams.set('resize', 'contain'); // Force contain to prevent cropping
        return url.toString();
    }

    // CASE 3: External URL (Unsplash, etc) - return as is
    return src;
}
