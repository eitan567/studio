import type { AlbumPage, Photo } from '@/lib/types';

const STORAGE_OBJECT_SEGMENT = '/storage/v1/object/public/photos/';
const STORAGE_RENDER_SEGMENT = '/storage/v1/render/image/public/photos/';

function normalizeBaseUrl(baseUrl?: string | null): string | null {
    if (!baseUrl || typeof baseUrl !== 'string') return null;
    const trimmed = baseUrl.trim();
    if (!trimmed) return null;
    return trimmed.replace(/\/+$/, '');
}

export function buildSupabaseStorageUrl(
    storagePath: string | null | undefined,
    baseUrl: string | null | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL
): string | null {
    if (typeof storagePath !== 'string') return null;
    const normalizedPath = storagePath.trim().replace(/^\/+/, '');
    if (!normalizedPath) return null;

    const normalizedBase = normalizeBaseUrl(baseUrl);
    if (!normalizedBase) return null;

    return `${normalizedBase}${STORAGE_OBJECT_SEGMENT}${normalizedPath}`;
}

export function extractSupabaseStoragePath(value: string | null | undefined): string | null {
    if (typeof value !== 'string') return null;
    const input = value.trim();
    if (!input) return null;
    if (input.startsWith('blob:') || input.startsWith('data:')) return null;

    // If we already got a raw storage path (user_id/filename.jpg), keep it.
    if (!input.startsWith('http')) {
        return input.replace(/^\/+/, '') || null;
    }

    const objectIndex = input.indexOf(STORAGE_OBJECT_SEGMENT);
    const renderIndex = input.indexOf(STORAGE_RENDER_SEGMENT);
    const segment = objectIndex >= 0 ? STORAGE_OBJECT_SEGMENT : renderIndex >= 0 ? STORAGE_RENDER_SEGMENT : null;
    if (!segment) return null;

    const [, trailing = ''] = input.split(segment);
    if (!trailing) return null;

    const [rawPath = ''] = trailing.split('?');
    const normalizedPath = rawPath.replace(/^\/+/, '');
    return normalizedPath || null;
}

export function normalizeSupabaseStorageUrl(
    value: string | null | undefined,
    baseUrl: string | null | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL
): string | null | undefined {
    if (typeof value !== 'string') return value;

    const storagePath = extractSupabaseStoragePath(value);
    if (!storagePath) return value;

    return buildSupabaseStorageUrl(storagePath, baseUrl) || value;
}

export function normalizePhotoMediaUrls<T extends Partial<Photo> | Record<string, unknown>>(photo: T): T {
    if (!photo || typeof photo !== 'object') return photo;

    const normalized = {
        ...photo
    } as T & {
        src?: unknown;
        remoteUrl?: unknown;
        url?: unknown;
        storagePath?: unknown;
        storage_path?: unknown;
    };

    const rawStoragePath =
        (typeof normalized.storagePath === 'string' ? normalized.storagePath : null) ||
        (typeof normalized.storage_path === 'string' ? normalized.storage_path : null) ||
        (typeof normalized.src === 'string' ? extractSupabaseStoragePath(normalized.src) : null) ||
        (typeof normalized.remoteUrl === 'string' ? extractSupabaseStoragePath(normalized.remoteUrl) : null) ||
        (typeof normalized.url === 'string' ? extractSupabaseStoragePath(normalized.url) : null);

    const normalizedStoragePath = rawStoragePath?.trim().replace(/^\/+/, '') || null;
    if (normalizedStoragePath) {
        normalized.storagePath = normalizedStoragePath as unknown;
        normalized.storage_path = normalizedStoragePath as unknown;
        const resolvedUrl = buildSupabaseStorageUrl(normalizedStoragePath);

        if (resolvedUrl) {
            normalized.src = resolvedUrl as unknown;
            normalized.remoteUrl = resolvedUrl as unknown;
            normalized.url = resolvedUrl as unknown;
        }
    }

    if (typeof normalized.src === 'string') {
        normalized.src = normalizeSupabaseStorageUrl(normalized.src) as unknown;
    }
    if (typeof normalized.remoteUrl === 'string') {
        normalized.remoteUrl = normalizeSupabaseStorageUrl(normalized.remoteUrl) as unknown;
    }
    if (typeof normalized.url === 'string') {
        normalized.url = normalizeSupabaseStorageUrl(normalized.url) as unknown;
    }

    return normalized as T;
}

export function normalizeAlbumPageMediaUrls(page: AlbumPage): AlbumPage {
    const normalizedPage: AlbumPage = {
        ...page,
        photos: Array.isArray(page.photos)
            ? page.photos.map((photo) => normalizePhotoMediaUrls(photo))
            : [],
    };

    if (typeof normalizedPage.backgroundImage === 'string') {
        normalizedPage.backgroundImage = normalizeSupabaseStorageUrl(normalizedPage.backgroundImage) ?? undefined;
    }

    if (Array.isArray(normalizedPage.coverImages)) {
        normalizedPage.coverImages = normalizedPage.coverImages.map((coverImage) => ({
            ...coverImage,
            url: normalizeSupabaseStorageUrl(coverImage.url) || coverImage.url,
        }));
    }

    return normalizedPage;
}

export function normalizeAlbumMediaUrls<T extends Record<string, unknown>>(album: T): T {
    if (!album || typeof album !== 'object') return album;

    const normalized = { ...album } as T & {
        pages?: unknown;
        photos?: unknown;
        thumbnail_url?: unknown;
    };

    if (typeof normalized.thumbnail_url === 'string') {
        normalized.thumbnail_url = normalizeSupabaseStorageUrl(normalized.thumbnail_url);
    }

    if (Array.isArray(normalized.photos)) {
        normalized.photos = normalized.photos.map((photo) => normalizePhotoMediaUrls(photo as Record<string, unknown>));
    }

    if (Array.isArray(normalized.pages)) {
        normalized.pages = normalized.pages.map((page) => normalizeAlbumPageMediaUrls(page as AlbumPage));
    }

    return normalized as T;
}
