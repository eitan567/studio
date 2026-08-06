import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { Photo, AlbumConfig, AlbumPage } from '@/lib/types';
import {
    buildAlbumBackupPayload,
    parseAlbumBackupPayload,
    hydratePagesFromBackup,
} from '@/lib/album-backup';
import type { AlbumBackupPayload, AlbumBackupPhotoRef } from '@/lib/album-backup';
import { extractSupabaseStoragePath, buildSupabaseStorageUrl } from '@/lib/supabase-media-normalizer';

export interface FullBackupProgress {
    phase: 'preparing' | 'downloading' | 'zipping' | 'done';
    current: number;
    total: number;
    label?: string;
}

export interface FullRestoreProgress {
    phase: 'extracting' | 'uploading' | 'creating' | 'done';
    current: number;
    total: number;
    label?: string;
}

interface PhotoFileEntry {
    ref: AlbumBackupPhotoRef;
    fileName: string;
    blob: Blob;
}

function sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function getFileNameFromRef(ref: AlbumBackupPhotoRef, index: number): string {
    if (ref.fileName) return sanitizeFileName(ref.fileName);
    if (ref.storagePath) {
        const parts = ref.storagePath.split('/');
        return sanitizeFileName(parts[parts.length - 1] || `photo_${index}`);
    }
    return `photo_${index}.jpg`;
}

function resolvePhotoDownloadUrl(ref: AlbumBackupPhotoRef): string | null {
    // 1. Try extracting storagePath from ref.storagePath or ref.sourceUrl
    const rawStoragePath = ref.storagePath || (ref.sourceUrl ? extractSupabaseStoragePath(ref.sourceUrl) : null);
    if (rawStoragePath) {
        const fullResUrl = buildSupabaseStorageUrl(rawStoragePath);
        if (fullResUrl) return fullResUrl;
    }

    // 2. If sourceUrl is a blob URL or data URL, return directly (in-memory original)
    if (ref.sourceUrl && (ref.sourceUrl.startsWith('blob:') || ref.sourceUrl.startsWith('data:'))) {
        return ref.sourceUrl;
    }

    // 3. If sourceUrl is an http URL, strip query params and ensure it uses /object/ instead of /render/
    if (ref.sourceUrl && ref.sourceUrl.startsWith('http')) {
        let cleanUrl = ref.sourceUrl.split('?')[0];
        cleanUrl = cleanUrl.replace('/storage/v1/render/image/public/', '/storage/v1/object/public/');
        return cleanUrl;
    }

    return null;
}

export async function createFullAlbumBackupZip(params: {
    albumId?: string | null;
    albumName: string;
    config: Partial<AlbumConfig>;
    pages: AlbumPage[];
    galleryPhotos?: Photo[];
    onProgress?: (progress: FullBackupProgress) => void;
}): Promise<Blob> {
    const { albumId, albumName, config, pages, galleryPhotos, onProgress } = params;

    onProgress?.({ phase: 'preparing', current: 0, total: 1, label: 'Building backup payload...' });

    const payload = buildAlbumBackupPayload({
        albumId,
        albumName,
        config,
        pages,
        galleryPhotos,
    });

    const requiredPhotos = payload.requiredPhotos || [];
    const photoEntries: PhotoFileEntry[] = [];

    // Download each photo
    const total = requiredPhotos.length;
    for (let i = 0; i < requiredPhotos.length; i++) {
        const ref = requiredPhotos[i];
        const url = resolvePhotoDownloadUrl(ref);
        onProgress?.({
            phase: 'downloading',
            current: i + 1,
            total,
            label: `Downloading photo ${i + 1}/${total}: ${ref.fileName || ref.storagePath || 'photo'}`,
        });

        if (!url) continue;

        try {
            const response = await fetch(url);
            if (!response.ok) continue;
            const blob = await response.blob();
            const fileName = getFileNameFromRef(ref, i);
            photoEntries.push({ ref, fileName, blob });
        } catch {
            // Skip photos that fail to download
        }
    }

    // Create ZIP
    onProgress?.({ phase: 'zipping', current: 0, total: 1, label: 'Creating ZIP file...' });

    const zip = new JSZip();

    // Add photos in photos/ folder and ensure ref.fileName matches zip entry filename
    const usedFileNames = new Set<string>();
    for (const entry of photoEntries) {
        let fileName = entry.fileName;
        // Ensure unique file names
        if (usedFileNames.has(fileName)) {
            const ext = fileName.includes('.') ? '.' + fileName.split('.').pop() : '';
            const base = fileName.includes('.') ? fileName.slice(0, fileName.lastIndexOf('.')) : fileName;
            let counter = 1;
            while (usedFileNames.has(`${base}_${counter}${ext}`)) counter++;
            fileName = `${base}_${counter}${ext}`;
        }
        usedFileNames.add(fileName);
        entry.ref.fileName = fileName; // Ensure ref.fileName matches zip filename
        zip.file(`photos/${fileName}`, entry.blob);
    }

    // Add album.json (now containing updated ref.fileName entries)
    zip.file('album.json', JSON.stringify(payload, null, 2));

    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

    onProgress?.({ phase: 'done', current: 1, total: 1, label: 'Full backup ready!' });

    return zipBlob;
}

export function downloadFullBackupZip(zipBlob: Blob, albumName: string): void {
    const safeName = (albumName || 'album')
        .trim()
        .replace(/[^a-zA-Z0-9-_]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase() || 'album';
    const dateStamp = new Date().toISOString().slice(0, 10);
    saveAs(zipBlob, `${safeName}-full-backup-${dateStamp}.zip`);
}

export interface FullRestoreResult {
    albumId: string;
    albumName: string;
    photosUploaded: number;
    pagesCount: number;
}

export async function restoreFullAlbumFromZip(
    zipFile: File,
    onProgress?: (progress: FullRestoreProgress) => void,
): Promise<FullRestoreResult> {
    onProgress?.({ phase: 'extracting', current: 0, total: 1, label: 'Reading ZIP file...' });

    const zip = await JSZip.loadAsync(zipFile);

    // Extract album.json
    const albumJsonFile = zip.file('album.json');
    if (!albumJsonFile) {
        throw new Error('Invalid backup ZIP: missing album.json');
    }

    const albumJsonText = await albumJsonFile.async('string');
    let parsedJson: unknown;
    try {
        parsedJson = JSON.parse(albumJsonText);
    } catch {
        throw new Error('Invalid backup ZIP: album.json is not valid JSON');
    }

    const backupPayload = parseAlbumBackupPayload(parsedJson);

    // Collect photo files from the ZIP
    const photoFiles: { name: string; file: JSZip.JSZipObject }[] = [];
    zip.folder('photos')?.forEach((relativePath, file) => {
        if (!file.dir) {
            photoFiles.push({ name: relativePath, file });
        }
    });

    onProgress?.({
        phase: 'extracting',
        current: 1,
        total: 1,
        label: `Found ${photoFiles.length} photo(s) in backup`,
    });

    // Upload each photo
    const uploadedPhotos: Photo[] = [];
    const total = photoFiles.length;

    for (let i = 0; i < photoFiles.length; i++) {
        const photoEntry = photoFiles[i];
        onProgress?.({
            phase: 'uploading',
            current: i + 1,
            total,
            label: `Uploading photo ${i + 1}/${total}: ${photoEntry.name}`,
        });

        try {
            const blob = await photoEntry.file.async('blob');

            // Determine a reasonable MIME type from the file extension
            const ext = photoEntry.name.split('.').pop()?.toLowerCase() || 'jpg';
            const mimeMap: Record<string, string> = {
                jpg: 'image/jpeg',
                jpeg: 'image/jpeg',
                png: 'image/png',
                webp: 'image/webp',
                gif: 'image/gif',
                bmp: 'image/bmp',
                tiff: 'image/tiff',
                tif: 'image/tiff',
                heic: 'image/heic',
                heif: 'image/heif',
                avif: 'image/avif',
            };
            const mimeType = mimeMap[ext] || 'image/jpeg';
            const file = new File([blob], photoEntry.name, { type: mimeType });

            const formData = new FormData();
            formData.append('file', file);
            // Use 'ignore' to avoid re-uploading duplicates
            formData.append('duplicate_action', 'ignore');

            const response = await fetch('/api/photos/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) continue;

            const data = await response.json();
            if (data.success && data.photo) {
                const photo: Photo = {
                    id: data.photo.id || crypto.randomUUID(),
                    src: data.photo.url || data.url || '',
                    alt: data.photo.original_name || photoEntry.name,
                    width: data.photo.width || undefined,
                    height: data.photo.height || undefined,
                    remoteUrl: data.photo.url || data.url || '',
                    storagePath: data.photo.storage_path || data.photo.storagePath || undefined,
                };
                uploadedPhotos.push(photo);
            }
        } catch {
            // Skip photos that fail to upload
        }
    }

    // Hydrate pages with newly uploaded photos
    onProgress?.({
        phase: 'creating',
        current: 0,
        total: 1,
        label: 'Creating album...',
    });

    const hydrated = hydratePagesFromBackup(backupPayload.album.pages, uploadedPhotos, {
        clearMissingPhotos: true,
    });

    // Build the photos array for the album gallery
    const galleryPhotos = uploadedPhotos.map((p) => ({
        id: p.id,
        src: p.remoteUrl || p.src,
        alt: p.alt,
        width: p.width,
        height: p.height,
        remoteUrl: p.remoteUrl,
        storagePath: p.storagePath,
    }));

    // Create new album via API with (Restored) suffix to prevent name confusion
    const rawAlbumName = backupPayload.album.name?.trim() || 'Restored Album';
    const albumName = rawAlbumName.endsWith('(Restored)')
        ? rawAlbumName
        : `${rawAlbumName} (Restored)`;

    const response = await fetch('/api/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: albumName,
            config: backupPayload.album.config || {},
            pages: hydrated.pages,
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to create album: ${errorBody}`);
    }

    const albumData = await response.json();
    const newAlbumId = albumData.album?.id;

    if (!newAlbumId) {
        throw new Error('Album created but no ID returned');
    }

    // Save gallery photos to the album
    const saveResponse = await fetch(`/api/albums/${newAlbumId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            photos: galleryPhotos,
        }),
    });

    if (!saveResponse.ok) {
        // Album was created but gallery save failed — not fatal
        console.warn('Album created but failed to save gallery photos');
    }

    onProgress?.({
        phase: 'done',
        current: 1,
        total: 1,
        label: 'Full restore complete!',
    });

    return {
        albumId: newAlbumId,
        albumName,
        photosUploaded: uploadedPhotos.length,
        pagesCount: hydrated.pages.length,
    };
}
