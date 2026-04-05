import type { CoverImage, Photo } from '@/lib/types';
import { extractSupabaseStoragePath } from '@/lib/supabase-media-normalizer';

type PhotoReferenceLike = Partial<Pick<Photo, 'id' | 'originalId' | 'src' | 'remoteUrl' | 'storagePath'>>
    & Partial<Pick<CoverImage, 'url' | 'originalId' | 'storagePath'>>;

function normalizeText(value: string | null | undefined): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed || null;
}

function normalizeStoragePath(value: string | null | undefined): string | null {
    const normalized = normalizeText(value);
    if (!normalized) return null;
    return normalized.replace(/^\/+/, '') || null;
}

export function buildPhotoReferenceKeys(reference: PhotoReferenceLike | null | undefined): string[] {
    if (!reference) return [];

    const keys = new Set<string>();
    const candidates = [
        normalizeText(reference.remoteUrl),
        normalizeText(reference.src),
        normalizeText(reference.url),
    ].filter((value): value is string => !!value);

    const id = normalizeText(reference.id);
    if (id) keys.add(`id:${id}`);

    const originalId = normalizeText(reference.originalId);
    if (originalId) keys.add(`id:${originalId}`);

    const storageCandidates = new Set<string>();
    const explicitStoragePath = normalizeStoragePath(reference.storagePath);
    if (explicitStoragePath) storageCandidates.add(explicitStoragePath);

    candidates.forEach((candidate) => {
        keys.add(`url:${candidate}`);
        const extractedStoragePath = normalizeStoragePath(extractSupabaseStoragePath(candidate));
        if (extractedStoragePath) {
            storageCandidates.add(extractedStoragePath);
        }
    });

    storageCandidates.forEach((storagePath) => {
        keys.add(`path:${storagePath}`);
    });

    return Array.from(keys);
}

export function createGalleryPhotoReferenceResolver(allPhotos: Photo[]) {
    const lookup = new Map<string, string>();

    allPhotos.forEach((photo) => {
        buildPhotoReferenceKeys(photo).forEach((key) => {
            if (!lookup.has(key)) {
                lookup.set(key, photo.id);
            }
        });
    });

    return (reference: PhotoReferenceLike | null | undefined): string | null => {
        const keys = buildPhotoReferenceKeys(reference);
        for (const key of keys) {
            const match = lookup.get(key);
            if (match) return match;
        }
        return null;
    };
}
