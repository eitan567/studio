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

// CRC32 calculation table for ZIP format
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c;
}

function calculateCRC32(buffer: Uint8Array): number {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buffer.length; i++) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ buffer[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

async function calculateBlobCRC32(blob: Blob): Promise<number> {
    const arrayBuffer = await blob.arrayBuffer();
    return calculateCRC32(new Uint8Array(arrayBuffer));
}

function getDosDateTime(date: Date = new Date()): { dosDate: number; dosTime: number } {
    const year = Math.max(1980, date.getFullYear());
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = Math.floor(date.getSeconds() / 2);

    const dosDate = ((year - 1980) << 9) | (month << 5) | day;
    const dosTime = (hours << 11) | (minutes << 5) | seconds;

    return { dosDate, dosTime };
}

interface ZipEntryInfo {
    fileName: string;
    crc32: number;
    uncompressedSize: number;
    offset: number;
    dosDate: number;
    dosTime: number;
}

/**
 * FastZipBuilder creates STORE (uncompressed) ZIP files without allocating giant single-block ArrayBuffers.
 * Blobs are passed directly to browser's Blob constructor, eliminating V8 ArrayBuffer allocation errors.
 */
class FastZipBuilder {
    private parts: (Blob | Uint8Array)[] = [];
    private entries: ZipEntryInfo[] = [];
    private currentOffset = 0;
    private encoder = new TextEncoder();

    public async addFile(fileName: string, data: Blob | string | Uint8Array): Promise<void> {
        let blob: Blob;
        let crc32: number;

        if (typeof data === 'string') {
            const bytes = this.encoder.encode(data);
            blob = new Blob([bytes]);
            crc32 = calculateCRC32(bytes);
        } else if (data instanceof Uint8Array) {
            blob = new Blob([data]);
            crc32 = calculateCRC32(data);
        } else {
            blob = data;
            crc32 = await calculateBlobCRC32(blob);
        }

        const fileNameBytes = this.encoder.encode(fileName);
        const { dosDate, dosTime } = getDosDateTime();
        const uncompressedSize = blob.size;
        const offset = this.currentOffset;

        // Local File Header (30 bytes + fileNameBytes.length)
        const header = new Uint8Array(30 + fileNameBytes.length);
        const view = new DataView(header.buffer);

        view.setUint32(0, 0x04034b50, true);   // Signature PK\x03\x04
        view.setUint16(4, 20, true);           // Version needed (2.0)
        view.setUint16(6, 0x0800, true);       // General bit flag (UTF-8 filename)
        view.setUint16(8, 0, true);            // Compression method (0 = STORE)
        view.setUint16(10, dosTime, true);
        view.setUint16(12, dosDate, true);
        view.setUint32(14, crc32, true);
        view.setUint32(18, uncompressedSize, true); // Compressed size
        view.setUint32(22, uncompressedSize, true); // Uncompressed size
        view.setUint16(26, fileNameBytes.length, true);
        view.setUint16(28, 0, true);           // Extra field length

        header.set(fileNameBytes, 30);

        this.parts.push(header);
        this.parts.push(blob);

        this.currentOffset += header.length + uncompressedSize;

        this.entries.push({
            fileName,
            crc32,
            uncompressedSize,
            offset,
            dosDate,
            dosTime,
        });
    }

    public getEntryCount(): number {
        return this.entries.length;
    }

    public buildBlob(): Blob {
        const centralDirectoryStart = this.currentOffset;
        let centralDirectorySize = 0;

        for (const entry of this.entries) {
            const fileNameBytes = this.encoder.encode(entry.fileName);
            // Central Directory Header (46 bytes + fileNameBytes.length)
            const cdHeader = new Uint8Array(46 + fileNameBytes.length);
            const view = new DataView(cdHeader.buffer);

            view.setUint32(0, 0x02014b50, true); // Signature PK\x01\x02
            view.setUint16(4, 20, true);         // Version made by
            view.setUint16(6, 20, true);         // Version needed
            view.setUint16(8, 0x0800, true);     // General bit flag (UTF-8 filename)
            view.setUint16(10, 0, true);         // Compression method (0 = STORE)
            view.setUint16(12, entry.dosTime, true);
            view.setUint16(14, entry.dosDate, true);
            view.setUint32(16, entry.crc32, true);
            view.setUint32(20, entry.uncompressedSize, true); // Compressed size
            view.setUint32(24, entry.uncompressedSize, true); // Uncompressed size
            view.setUint16(28, fileNameBytes.length, true);
            view.setUint16(30, 0, true);         // Extra field length
            view.setUint16(32, 0, true);         // File comment length
            view.setUint16(34, 0, true);         // Disk number start
            view.setUint16(36, 0, true);         // Internal file attributes
            view.setUint32(38, 0, true);         // External file attributes
            view.setUint32(42, entry.offset, true); // Relative offset of local header

            cdHeader.set(fileNameBytes, 46);

            this.parts.push(cdHeader);
            centralDirectorySize += cdHeader.length;
        }

        // End of Central Directory (EOCD) record (22 bytes)
        const eocd = new Uint8Array(22);
        const eocdView = new DataView(eocd.buffer);

        eocdView.setUint32(0, 0x06054b50, true); // EOCD signature PK\x05\x06
        eocdView.setUint16(4, 0, true);          // Disk number
        eocdView.setUint16(6, 0, true);          // Disk with central directory
        eocdView.setUint16(8, this.entries.length, true);  // Entries on this disk
        eocdView.setUint16(10, this.entries.length, true); // Total entries
        eocdView.setUint32(12, centralDirectorySize, true);
        eocdView.setUint32(16, centralDirectoryStart, true);
        eocdView.setUint16(20, 0, true);          // Comment length

        this.parts.push(eocd);

        return new Blob(this.parts, { type: 'application/zip' });
    }
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

    console.log(`[FullBackup] Starting full backup for album "${albumName}" (ID: ${albumId || 'new'})...`);
    onProgress?.({ phase: 'preparing', current: 0, total: 1, label: 'Building backup payload...' });

    const payload = buildAlbumBackupPayload({
        albumId,
        albumName,
        config,
        pages,
        galleryPhotos,
    });

    const requiredPhotos = payload.requiredPhotos || [];
    console.log(`[FullBackup] Album backup payload built. Required photos count: ${requiredPhotos.length}`);

    const zipBuilder = new FastZipBuilder();

    // 1. Pre-assign unique file names for every photo ref synchronously so ref.fileName in album.json matches zip file entries
    const usedFileNames = new Set<string>();
    for (let i = 0; i < requiredPhotos.length; i++) {
        const ref = requiredPhotos[i];
        let fileName = getFileNameFromRef(ref, i);
        if (usedFileNames.has(fileName)) {
            const ext = fileName.includes('.') ? '.' + fileName.split('.').pop() : '';
            const base = fileName.includes('.') ? fileName.slice(0, fileName.lastIndexOf('.')) : fileName;
            let counter = 1;
            while (usedFileNames.has(`${base}_${counter}${ext}`)) counter++;
            fileName = `${base}_${counter}${ext}`;
        }
        usedFileNames.add(fileName);
        ref.fileName = fileName;
    }

    // 2. Add album.json (now containing accurate ref.fileName for every photo ref)
    await zipBuilder.addFile('album.json', JSON.stringify(payload, null, 2));

    // 3. Download photos in concurrent batches directly into zip structure without storing intermediate array
    const total = requiredPhotos.length;
    let completedCount = 0;
    let successCount = 0;
    let failCount = 0;
    const CONCURRENCY = 6;

    for (let i = 0; i < total; i += CONCURRENCY) {
        const chunk = requiredPhotos.slice(i, i + CONCURRENCY);
        await Promise.all(
            chunk.map(async (ref) => {
                const url = resolvePhotoDownloadUrl(ref);
                if (url) {
                    try {
                        console.log(`[FullBackup] Downloading photo (${completedCount + 1}/${total}): ${ref.fileName} from ${url}`);
                        const response = await fetch(url);
                        if (response.ok) {
                            const blob = await response.blob();
                            await zipBuilder.addFile(`photos/${ref.fileName}`, blob);
                            successCount++;
                        } else {
                            failCount++;
                            console.warn(`[FullBackup] Photo download HTTP error ${response.status} for ${ref.fileName}`);
                        }
                    } catch (err) {
                        failCount++;
                        console.error(`[FullBackup] Network/fetch error downloading photo ${ref.fileName}:`, err);
                    }
                } else {
                    failCount++;
                    console.warn(`[FullBackup] Could not resolve download URL for photo:`, ref);
                }
                completedCount++;
                onProgress?.({
                    phase: 'downloading',
                    current: completedCount,
                    total,
                    label: `Downloading photos (${completedCount}/${total})...`,
                });
            })
        );
    }

    console.log(`[FullBackup] Photo downloads completed. Success: ${successCount}, Failed/Skipped: ${failCount}`);

    // 4. Create ZIP Blob instantly using chunked Blob construction
    onProgress?.({ phase: 'zipping', current: 0, total: 100, label: 'Finalizing ZIP file...' });
    const zipBlob = zipBuilder.buildBlob();

    console.log(`[FullBackup] ZIP file generated successfully! Files count: ${zipBuilder.getEntryCount()}, Total size: ${(zipBlob.size / (1024 * 1024)).toFixed(2)} MB`);
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
