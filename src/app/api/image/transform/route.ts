import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

export const runtime = 'nodejs';

const STORAGE_OBJECT_SEGMENT = '/storage/v1/object/public/photos/';
const STORAGE_RENDER_SEGMENT = '/storage/v1/render/image/public/photos/';
const MAX_DIMENSION = 2400;

function clampNumber(value: string | null, fallback: number, min: number, max: number): number {
    const parsed = Number.parseInt(value || '', 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

function parseOptionalDimension(value: string | null): number | undefined {
    if (value === null || value === '') return undefined;
    return clampNumber(value, 1, 1, MAX_DIMENSION);
}

function isAllowedSourceUrl(src: string): boolean {
    try {
        const sourceUrl = new URL(src);
        const configuredBaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (!configuredBaseUrl) return false;

        const configuredUrl = new URL(configuredBaseUrl);
        const configuredOrigin = configuredUrl.origin;
        const isConfiguredLocal =
            configuredUrl.hostname === '127.0.0.1' ||
            configuredUrl.hostname === 'localhost';
        const isLoopbackSource =
            sourceUrl.hostname === '127.0.0.1' ||
            sourceUrl.hostname === 'localhost';
        const isMatchingOrigin = sourceUrl.origin === configuredOrigin;
        const isPhotoStoragePath =
            sourceUrl.pathname.includes(STORAGE_OBJECT_SEGMENT) ||
            sourceUrl.pathname.includes(STORAGE_RENDER_SEGMENT);

        if (!isPhotoStoragePath) return false;

        if (isConfiguredLocal) {
            return isLoopbackSource;
        }

        return isMatchingOrigin;
    } catch {
        return false;
    }
}

function getFitMode(resize: string | null): 'inside' | 'cover' | 'fill' {
    if (resize === 'cover') return 'cover';
    if (resize === 'fill') return 'fill';
    return 'inside';
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const src = searchParams.get('src');

        if (!src || !isAllowedSourceUrl(src)) {
            return NextResponse.json({ error: 'Invalid image source' }, { status: 400 });
        }

        const width = parseOptionalDimension(searchParams.get('w'));
        const height = parseOptionalDimension(searchParams.get('h'));
        const quality = clampNumber(searchParams.get('q'), 80, 1, 100);
        const resize = searchParams.get('resize');
        const requestedFormat = searchParams.get('format');
        const format = requestedFormat === 'avif' ? 'avif' : 'webp';

        // The local transform route is fed with original Supabase assets that can be several MB.
        // Next.js fetch cache rejects entries above 2MB, which floods dev logs without helping us.
        const upstreamResponse = await fetch(src, { cache: 'no-store' });

        if (!upstreamResponse.ok) {
            return NextResponse.json({ error: 'Failed to fetch source image' }, { status: upstreamResponse.status });
        }

        const inputBuffer = Buffer.from(await upstreamResponse.arrayBuffer());

        const pipeline = sharp(inputBuffer, { sequentialRead: true }).rotate().resize({
            width,
            height,
            fit: getFitMode(resize),
            withoutEnlargement: true,
            background: { r: 255, g: 255, b: 255, alpha: 0 },
        });

        const outputBuffer = format === 'avif'
            ? await pipeline.avif({ quality }).toBuffer()
            : await pipeline.webp({ quality }).toBuffer();

        return new NextResponse(outputBuffer, {
            headers: {
                'Content-Type': format === 'avif' ? 'image/avif' : 'image/webp',
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (error) {
        console.error('Image transform failed:', error);
        return NextResponse.json({ error: 'Image transform failed' }, { status: 500 });
    }
}
