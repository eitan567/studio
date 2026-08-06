import type { AlbumConfig, AlbumPage, Photo, PhotoPanAndZoom } from '@/lib/types';
import {
    extractSupabaseStoragePath,
    normalizeAlbumPageMediaUrls,
    normalizePhotoMediaUrls,
} from '@/lib/supabase-media-normalizer';

export const ALBUM_BACKUP_SCHEMA_VERSION = 1;

export interface AlbumBackupPhotoRef {
    key: string;
    originalId?: string;
    storagePath?: string;
    sourceUrl?: string;
    fileName?: string;
    alt?: string;
}

export interface AlbumBackupPayload {
    schemaVersion: typeof ALBUM_BACKUP_SCHEMA_VERSION;
    exportedAt: string;
    source?: {
        albumId?: string;
        albumName?: string;
    };
    album: {
        name: string;
        config: Partial<AlbumConfig>;
        pages: AlbumPage[];
    };
    requiredPhotos: AlbumBackupPhotoRef[];
}

export interface HydratedBackupPagesResult {
    pages: AlbumPage[];
    missingRefs: AlbumBackupPhotoRef[];
    resolvedCount: number;
}

type LookupBucket = Map<string, Photo[]>;

interface GalleryPhotoLookup {
    byId: LookupBucket;
    byStoragePath: LookupBucket;
    byUrl: LookupBucket;
    byFileName: LookupBucket;
    byAlt: LookupBucket;
}

const DEFAULT_PAN_AND_ZOOM: PhotoPanAndZoom = {
    scale: 1,
    x: 50,
    y: 50,
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function clonePages(pages: AlbumPage[]): AlbumPage[] {
    if (typeof structuredClone === 'function') {
        return structuredClone(pages);
    }
    return JSON.parse(JSON.stringify(pages)) as AlbumPage[];
}

function normalizeText(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function normalizeLookupKey(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed ? trimmed.toLowerCase() : null;
}

function normalizeStoragePath(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = value.trim().replace(/^\/+/, '');
    return trimmed.length > 0 ? trimmed : null;
}

function normalizeUrlForLookup(value: string | null | undefined): string | null {
    const input = normalizeText(value);
    if (!input) return null;
    if (input.startsWith('blob:') || input.startsWith('data:')) return null;

    try {
        const url = new URL(input);
        url.hash = '';
        url.search = '';
        return normalizeLookupKey(url.toString());
    } catch {
        return normalizeLookupKey(input);
    }
}

function extractFileNameFromValue(value: string | null | undefined): string | null {
    const input = normalizeText(value);
    if (!input) return null;

    const source = input.includes('?') ? input.split('?')[0] : input;
    const pieces = source.split('/');
    const lastPart = pieces[pieces.length - 1] || '';
    return normalizeText(lastPart);
}

function addLookupEntry(map: LookupBucket, key: string | null | undefined, photo: Photo) {
    const normalizedKey = normalizeLookupKey(key);
    if (!normalizedKey) return;

    const existing = map.get(normalizedKey);
    if (existing) {
        existing.push(photo);
        return;
    }
    map.set(normalizedKey, [photo]);
}

function getSingleMatch(map: LookupBucket, key: string | null | undefined, uniqueOnly = false): Photo | null {
    const normalizedKey = normalizeLookupKey(key);
    if (!normalizedKey) return null;
    const matches = map.get(normalizedKey);
    if (!matches || matches.length === 0) return null;
    if (uniqueOnly && matches.length !== 1) return null;
    return matches[0] || null;
}

function buildPhotoRefFromPhoto(photo: Photo): AlbumBackupPhotoRef | null {
    const normalizedPhoto = normalizePhotoMediaUrls(photo);
    const sourceUrl = normalizeText(normalizedPhoto.remoteUrl) || normalizeText(normalizedPhoto.src);
    const explicitOriginalId = normalizeText(normalizedPhoto.originalId);
    const storagePath = normalizeStoragePath(
        normalizedPhoto.storagePath || extractSupabaseStoragePath(sourceUrl || normalizedPhoto.src)
    );
    const hasReference = !!sourceUrl || !!storagePath || !!explicitOriginalId;
    if (!hasReference) return null;

    const originalId = explicitOriginalId || normalizeText(normalizedPhoto.id);
    const alt = normalizeText(normalizedPhoto.alt);
    const fileName =
        extractFileNameFromValue(storagePath) ||
        extractFileNameFromValue(sourceUrl) ||
        extractFileNameFromValue(alt);
    const sourceUrlKey = normalizeUrlForLookup(sourceUrl);

    const key =
        normalizeLookupKey(storagePath) ||
        normalizeLookupKey(originalId) ||
        normalizeLookupKey(sourceUrlKey) ||
        normalizeLookupKey(fileName) ||
        normalizeLookupKey(alt);

    if (!key) return null;

    return {
        key,
        originalId: originalId || undefined,
        storagePath: storagePath || undefined,
        sourceUrl: sourceUrl || undefined,
        fileName: fileName || undefined,
        alt: alt || undefined,
    };
}

function normalizeBackupPhotoRef(rawRef: unknown): AlbumBackupPhotoRef | null {
    if (!isRecord(rawRef)) return null;

    const normalized: AlbumBackupPhotoRef = {
        key: normalizeLookupKey(normalizeText(rawRef.key) || '') || '',
        originalId: normalizeText(rawRef.originalId) || undefined,
        storagePath: normalizeStoragePath(normalizeText(rawRef.storagePath)) || undefined,
        sourceUrl: normalizeText(rawRef.sourceUrl) || undefined,
        fileName: normalizeText(rawRef.fileName) || undefined,
        alt: normalizeText(rawRef.alt) || undefined,
    };

    if (!normalized.key) {
        const reconstructedKey =
            normalizeLookupKey(normalized.storagePath) ||
            normalizeLookupKey(normalized.originalId) ||
            normalizeUrlForLookup(normalized.sourceUrl) ||
            normalizeLookupKey(normalized.fileName) ||
            normalizeLookupKey(normalized.alt);
        if (!reconstructedKey) return null;
        normalized.key = reconstructedKey;
    }

    return normalized;
}

function buildGalleryPhotoLookup(galleryPhotos: Photo[]): GalleryPhotoLookup {
    const lookup: GalleryPhotoLookup = {
        byId: new Map<string, Photo[]>(),
        byStoragePath: new Map<string, Photo[]>(),
        byUrl: new Map<string, Photo[]>(),
        byFileName: new Map<string, Photo[]>(),
        byAlt: new Map<string, Photo[]>(),
    };

    for (const photo of galleryPhotos || []) {
        const normalizedPhoto = normalizePhotoMediaUrls(photo);
        const sourceUrl = normalizeText(normalizedPhoto.remoteUrl) || normalizeText(normalizedPhoto.src);
        const storagePath = normalizeStoragePath(
            normalizedPhoto.storagePath || extractSupabaseStoragePath(sourceUrl || normalizedPhoto.src)
        );
        const fileName =
            extractFileNameFromValue(storagePath) ||
            extractFileNameFromValue(sourceUrl) ||
            extractFileNameFromValue(normalizedPhoto.alt);

        addLookupEntry(lookup.byId, normalizedPhoto.id, normalizedPhoto);
        addLookupEntry(lookup.byStoragePath, storagePath, normalizedPhoto);
        addLookupEntry(lookup.byUrl, normalizeUrlForLookup(sourceUrl), normalizedPhoto);
        addLookupEntry(lookup.byFileName, fileName, normalizedPhoto);
        addLookupEntry(lookup.byAlt, normalizedPhoto.alt, normalizedPhoto);
    }

    return lookup;
}

function matchBackupRefToGalleryPhoto(ref: AlbumBackupPhotoRef, lookup: GalleryPhotoLookup): Photo | null {
    const byStoragePath = getSingleMatch(lookup.byStoragePath, ref.storagePath);
    if (byStoragePath) return byStoragePath;

    const byId = getSingleMatch(lookup.byId, ref.originalId);
    if (byId) return byId;

    const byUrl = getSingleMatch(lookup.byUrl, normalizeUrlForLookup(ref.sourceUrl));
    if (byUrl) return byUrl;

    const byFileName = getSingleMatch(lookup.byFileName, ref.fileName, true);
    if (byFileName) return byFileName;

    const byAlt = getSingleMatch(lookup.byAlt, ref.alt, true);
    if (byAlt) return byAlt;

    return null;
}

function createEmptyPhotoSlot(slotPhoto: Photo): Photo {
    return {
        ...slotPhoto,
        src: '',
        remoteUrl: undefined,
        originalId: undefined,
        storagePath: undefined,
        alt: 'Drop photo here',
        width: slotPhoto.width || 600,
        height: slotPhoto.height || 400,
        panAndZoom: slotPhoto.panAndZoom || DEFAULT_PAN_AND_ZOOM,
    };
}

export function describeBackupPhotoRef(ref: AlbumBackupPhotoRef): string {
    return (
        ref.fileName ||
        ref.alt ||
        ref.storagePath ||
        ref.sourceUrl ||
        ref.originalId ||
        ref.key
    );
}

export function collectRequiredPhotoRefsFromPages(
    pages: AlbumPage[],
    galleryPhotos?: Photo[]
): AlbumBackupPhotoRef[] {
    const refsByKey = new Map<string, AlbumBackupPhotoRef>();

    for (const page of pages || []) {
        for (const slotPhoto of page.photos || []) {
            const ref = buildPhotoRefFromPhoto(slotPhoto);
            if (!ref) continue;
            refsByKey.set(ref.key, ref);
        }
        for (const coverImg of page.coverImages || []) {
            if (coverImg.url) {
                const ref = buildPhotoRefFromPhoto({
                    id: coverImg.originalId || coverImg.id,
                    src: coverImg.url,
                    alt: 'Cover Image',
                    storagePath: coverImg.storagePath,
                });
                if (ref) refsByKey.set(ref.key, ref);
            }
        }
    }

    for (const photo of galleryPhotos || []) {
        const ref = buildPhotoRefFromPhoto(photo);
        if (!ref) continue;
        if (!refsByKey.has(ref.key)) {
            refsByKey.set(ref.key, ref);
        }
    }

    return Array.from(refsByKey.values());
}

export function buildAlbumBackupPayload(params: {
    albumId?: string | null;
    albumName: string;
    config: Partial<AlbumConfig>;
    pages: AlbumPage[];
    galleryPhotos?: Photo[];
}): AlbumBackupPayload {
    const normalizedPages = clonePages(params.pages || []).map((page) => normalizeAlbumPageMediaUrls(page));

    return {
        schemaVersion: ALBUM_BACKUP_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        source: {
            albumId: params.albumId || undefined,
            albumName: params.albumName || undefined,
        },
        album: {
            name: params.albumName || 'Imported Album',
            config: params.config || {},
            pages: normalizedPages,
        },
        requiredPhotos: collectRequiredPhotoRefsFromPages(normalizedPages, params.galleryPhotos),
    };
}

export function parseAlbumBackupPayload(rawPayload: unknown): AlbumBackupPayload {
    if (!isRecord(rawPayload)) {
        throw new Error('Backup file is invalid. Expected a JSON object.');
    }

    const schemaVersionRaw = rawPayload.schemaVersion ?? rawPayload.version;
    const schemaVersion =
        typeof schemaVersionRaw === 'number'
            ? schemaVersionRaw
            : typeof schemaVersionRaw === 'string'
                ? Number(schemaVersionRaw)
                : NaN;

    if (schemaVersion !== ALBUM_BACKUP_SCHEMA_VERSION) {
        throw new Error(`Unsupported backup version: ${String(schemaVersionRaw || 'unknown')}.`);
    }

    const rawAlbum = rawPayload.album;
    if (!isRecord(rawAlbum)) {
        throw new Error('Backup file is missing album data.');
    }

    if (!Array.isArray(rawAlbum.pages)) {
        throw new Error('Backup file is missing album pages.');
    }

    const pages = clonePages(rawAlbum.pages as AlbumPage[]).map((page) => normalizeAlbumPageMediaUrls(page));
    const config = isRecord(rawAlbum.config) ? (rawAlbum.config as Partial<AlbumConfig>) : {};
    const rawSource = isRecord(rawPayload.source) ? rawPayload.source : null;

    const parsedRequired = Array.isArray(rawPayload.requiredPhotos)
        ? rawPayload.requiredPhotos
            .map((ref) => normalizeBackupPhotoRef(ref))
            .filter((ref): ref is AlbumBackupPhotoRef => !!ref)
        : [];

    const requiredPhotos =
        parsedRequired.length > 0 ? parsedRequired : collectRequiredPhotoRefsFromPages(pages);

    return {
        schemaVersion: ALBUM_BACKUP_SCHEMA_VERSION,
        exportedAt: normalizeText(rawPayload.exportedAt) || new Date().toISOString(),
        source: rawSource
            ? {
                albumId: normalizeText(rawSource.albumId) || undefined,
                albumName: normalizeText(rawSource.albumName) || undefined,
            }
            : undefined,
        album: {
            name: normalizeText(rawAlbum.name) || 'Imported Album',
            config,
            pages,
        },
        requiredPhotos,
    };
}

export function getMissingBackupPhotoRefs(requiredRefs: AlbumBackupPhotoRef[], galleryPhotos: Photo[]): AlbumBackupPhotoRef[] {
    const lookup = buildGalleryPhotoLookup(galleryPhotos);
    const seenKeys = new Set<string>();
    const missing: AlbumBackupPhotoRef[] = [];

    for (const rawRef of requiredRefs || []) {
        const ref = normalizeBackupPhotoRef(rawRef);
        if (!ref) continue;
        if (seenKeys.has(ref.key)) continue;
        seenKeys.add(ref.key);

        const match = matchBackupRefToGalleryPhoto(ref, lookup);
        if (!match) {
            missing.push(ref);
        }
    }

    return missing;
}

export function hydratePagesFromBackup(
    backupPages: AlbumPage[],
    galleryPhotos: Photo[],
    options?: { clearMissingPhotos?: boolean }
): HydratedBackupPagesResult {
    const clearMissingPhotos = options?.clearMissingPhotos ?? true;
    const lookup = buildGalleryPhotoLookup(galleryPhotos);
    const missingByKey = new Map<string, AlbumBackupPhotoRef>();
    let resolvedCount = 0;

    const normalizedPages = clonePages(backupPages || []).map((page) => normalizeAlbumPageMediaUrls(page));
    const hydratedPages = normalizedPages.map((page) => ({
        ...page,
        photos: (page.photos || []).map((slotPhoto) => {
            const slotRef = buildPhotoRefFromPhoto(slotPhoto);
            if (!slotRef) return normalizePhotoMediaUrls(slotPhoto);

            const match = matchBackupRefToGalleryPhoto(slotRef, lookup);
            if (!match) {
                missingByKey.set(slotRef.key, slotRef);
                return clearMissingPhotos ? createEmptyPhotoSlot(slotPhoto) : normalizePhotoMediaUrls(slotPhoto);
            }

            resolvedCount += 1;
            const normalizedMatch = normalizePhotoMediaUrls(match);
            const resolvedSource =
                normalizeText(normalizedMatch.remoteUrl) ||
                normalizeText(normalizedMatch.src) ||
                normalizeText(slotPhoto.remoteUrl) ||
                normalizeText(slotPhoto.src) ||
                '';

            const resolvedStoragePath = normalizeStoragePath(
                normalizedMatch.storagePath || extractSupabaseStoragePath(resolvedSource)
            );

            return {
                ...slotPhoto,
                src: resolvedSource,
                remoteUrl: resolvedSource || undefined,
                originalId: normalizedMatch.id || slotPhoto.originalId,
                storagePath: resolvedStoragePath || undefined,
                alt: normalizeText(slotPhoto.alt) || normalizeText(normalizedMatch.alt) || 'Photo',
                width: slotPhoto.width || normalizedMatch.width,
                height: slotPhoto.height || normalizedMatch.height,
            };
        }),
        coverImages: page.coverImages?.map((coverImg) => {
            if (!coverImg.url) return coverImg;
            const coverRef = buildPhotoRefFromPhoto({
                id: coverImg.originalId || coverImg.id,
                src: coverImg.url,
                alt: 'Cover Image',
                storagePath: coverImg.storagePath,
            });
            if (!coverRef) return coverImg;
            const match = matchBackupRefToGalleryPhoto(coverRef, lookup);
            if (!match) return coverImg;
            const normalizedMatch = normalizePhotoMediaUrls(match);
            const resolvedSource =
                normalizeText(normalizedMatch.remoteUrl) ||
                normalizeText(normalizedMatch.src) ||
                coverImg.url;
            const resolvedStoragePath = normalizeStoragePath(
                normalizedMatch.storagePath || extractSupabaseStoragePath(resolvedSource)
            );
            return {
                ...coverImg,
                url: resolvedSource,
                originalId: normalizedMatch.id || coverImg.originalId,
                storagePath: resolvedStoragePath || coverImg.storagePath,
            };
        }),
    }));

    return {
        pages: hydratedPages,
        missingRefs: Array.from(missingByKey.values()),
        resolvedCount,
    };
}
