import { useState, useRef, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Photo } from '@/lib/types';
import { usePhotoUpload } from '@/hooks/usePhotoUpload';
import { logger } from '@/lib/logger';
import placeholderImagesData from '@/lib/placeholder-images.json';
import exifr from 'exifr';

const placeholderImages = placeholderImagesData.placeholderImages;

interface UsePhotoGalleryManagerProps {
    allPhotos: Photo[];
    setAllPhotos: React.Dispatch<React.SetStateAction<Photo[]>>;
    updateThumbnail: (url: string) => void;
    albumThumbnailUrl?: string;
    allowDuplicates?: boolean; // Prop added for future extensibility if needed by uploads
    onRemovePhotosFromAlbum?: (photoIds: string[]) => void;
    onPhotoUploadComplete?: (tempId: string, finalPhoto: Photo) => void;
}

export function usePhotoGalleryManager({
    allPhotos,
    setAllPhotos,
    updateThumbnail,
    albumThumbnailUrl,
    onRemovePhotosFromAlbum,
    onPhotoUploadComplete,
}: UsePhotoGalleryManagerProps) {
    const { toast } = useToast();
    const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
    const { uploadPhoto } = usePhotoUpload();

    const photoScrollRef = useRef<HTMLDivElement>(null);
    const folderUploadRef = useRef<HTMLInputElement>(null);
    const photoUploadRef = useRef<HTMLInputElement>(null);

    // Track sort direction: 'asc' (oldest first) or 'desc' (newest first)
    // Start as 'desc' so first click shows a change (sorts to 'asc')
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    const scanFiles = useCallback(async (items: DataTransferItemList): Promise<File[]> => {
        const files: File[] = [];

        // Helper for FileSystemEntry recursion
        const traverseFileTree = async (item: any, path = '') => {
            if (item.isFile) {
                const file = await new Promise<File>((resolve, reject) => {
                    item.file((f: File) => resolve(f), reject);
                });
                if (file.type.startsWith('image/')) {
                    files.push(file);
                }
            } else if (item.isDirectory) {
                const dirReader = item.createReader();
                const entries = await new Promise<any[]>((resolve, reject) => {
                    const allEntries: any[] = [];
                    const readEntries = () => {
                        dirReader.readEntries((batch: any[]) => {
                            if (batch.length === 0) {
                                resolve(allEntries);
                            } else {
                                allEntries.push(...batch);
                                readEntries();
                            }
                        }, reject);
                    };
                    readEntries();
                });

                for (const entry of entries) {
                    await traverseFileTree(entry, path + item.name + '/');
                }
            }
        };

        const promises = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            // @ts-ignore - webkitGetAsEntry is non-standard
            const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : (typeof item.getAsEntry === 'function' ? item.getAsEntry() : null);

            if (entry) {
                promises.push(traverseFileTree(entry));
            } else {
                // Fallback for standard files if entry API fails
                const file = item.getAsFile();
                if (file && file.type.startsWith('image/')) {
                    files.push(file);
                }
            }
        }
        await Promise.all(promises);
        return files;
    }, []);

    const processUploadedFiles = useCallback(async (input: FileList | DataTransferItemList | null) => {
        if (!input) return;

        setIsLoadingPhotos(true);
        let imageFiles: File[] = [];

        // Handle specific DataTransferItemList (Drag & Drop with Folders)
        if (input instanceof DataTransferItemList && input.length > 0) {
            imageFiles = await scanFiles(input);
        }
        // Handle FileList (Files inputs or simple drops)
        else if (input instanceof FileList || (input as any).length !== undefined) {
            imageFiles = Array.from(input as FileList).filter(file => file.type.startsWith('image/'));
        }

        if (imageFiles.length === 0) {
            toast({
                title: 'No images found',
                description: 'Please select valid image files.',
                variant: 'destructive'
            });
            setIsLoadingPhotos(false);
            return;
        }

        const newFiles = imageFiles;

        // Create temp photos for optimistic UI with EXIF data
        const tempPhotos: Photo[] = await Promise.all(newFiles.map(async file => {
            let captureDate: Date | undefined = undefined;
            try {
                const exif = await exifr.parse(file);
                if (exif?.DateTimeOriginal) {
                    captureDate = new Date(exif.DateTimeOriginal);
                }
            } catch (e) {
                // ignore
            }

            return {
                id: crypto.randomUUID(), // Temp ID
                src: URL.createObjectURL(file),
                alt: file.name,
                width: 800, // approximated
                height: 600, // approximated
                isUploading: true,
                captureDate: captureDate // Only use EXIF date, no fallback to lastModified
            };
        }));

        setAllPhotos(prev => [...prev, ...tempPhotos]);

        // Auto-scroll logic
        setTimeout(() => {
            const scrollContainer = photoScrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                // If sorting newest first (desc), scroll to top. Otherwise bottom.
                const topPosition = sortDirection === 'desc' ? 0 : scrollContainer.scrollHeight;
                scrollContainer.scrollTo({ top: topPosition, behavior: 'smooth' });
            }
        }, 100);

        toast({
            title: 'Uploading Photos',
            description: `Uploading ${imageFiles.length} image(s)...`,
        });

        const tasks = newFiles.map((file, index) => ({
            file,
            tempId: tempPhotos[index].id
        }));

        let successCount = 0;
        const failedUploads: { file: string; error: any }[] = [];

        // PARALLEL BATCH PROCESSING - 3 at a time for performance
        const BATCH_SIZE = 3;

        try {
            for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
                const chunk = tasks.slice(i, i + BATCH_SIZE);

                // Process chunk in parallel
                const results = await Promise.all(chunk.map(async ({ file, tempId }) => {
                    let attempts = 0;
                    const maxAttempts = 3;
                    let success = false;
                    let lastError = 'Unknown error';
                    let uploadedPhoto: Photo | undefined;

                    while (attempts < maxAttempts && !success) {
                        attempts++;
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 60000);

                        try {
                            // @ts-ignore - signal/skipStateUpdates supported
                            const result = await uploadPhoto(file, {
                                signal: controller.signal,
                                skipStateUpdates: true
                            });

                            clearTimeout(timeoutId);

                            if (result.success && result.photo) {
                                success = true;
                                uploadedPhoto = result.photo;
                            } else {
                                throw new Error(result.error || 'Upload failed');
                            }

                        } catch (e: any) {
                            clearTimeout(timeoutId);
                            lastError = e.name === 'AbortError' ? 'Timeout' : (e.message || String(e));

                            if (attempts < maxAttempts) {
                                await new Promise(r => setTimeout(r, 1000 * attempts));
                            }
                        }
                    }

                    return { tempId, success, photo: uploadedPhoto, error: success ? null : lastError, fileName: file.name };
                }));

                // Update state once per batch
                setAllPhotos(prev => prev.map(p => {
                    const result = results.find(r => r.tempId === p.id);
                    if (result) {
                        if (result.success && result.photo) {
                            // OPTIMISTIC CONSISTENCY: Notify album editor to swap temp ID with real ID
                            if (onPhotoUploadComplete) {
                                onPhotoUploadComplete(p.id, result.photo);
                            }

                            // Success: Update ID to real ID, keep Blob URL as SRC to avoid flicker, store Real URL in remoteUrl
                            return {
                                ...result.photo,
                                src: p.src, // Keep Blob URL
                                remoteUrl: result.photo.src, // Store Real URL
                                isUploading: false
                            };
                        } else {
                            failedUploads.push({ file: result.fileName, error: result.error });
                            return { ...p, isUploading: false, error: result.error || 'Upload Failed' };
                        }
                    }
                    return p;
                }));

                successCount += results.filter(r => r.success).length;

                // Thumbnail update on first batch
                if (i === 0) {
                    const firstSuccess = results.find(r => r.success && r.photo);
                    if (firstSuccess?.photo) {
                        try {
                            const isPlaceholder = !albumThumbnailUrl || placeholderImages.some(p => p.imageUrl === albumThumbnailUrl);
                            if (isPlaceholder) {
                                updateThumbnail(firstSuccess.photo.src);
                            }
                        } catch (e) {
                            logger.warn('Thumbnail update failed (non-critical):', e);
                        }
                    }
                }
            }

            if (successCount > 0) {
                toast({
                    title: 'Upload Complete',
                    description: `${successCount} photo(s) added to gallery.`,
                });
            }

            if (failedUploads.length > 0) {
                toast({
                    title: 'Upload Partially Failed',
                    description: `${failedUploads.length} images failed.`,
                    variant: 'destructive'
                });
            }

        } catch (error) {
            logger.error('Batch process error:', error);
            toast({
                title: 'Upload Process Error',
                description: 'Critical error during upload.',
                variant: 'destructive'
            });
            setAllPhotos(prev => prev.map(p =>
                p.isUploading ? { ...p, isUploading: false, error: 'Process Terminated' } : p
            ));
        } finally {
            setIsLoadingPhotos(false);
        }
    }, [uploadPhoto, updateThumbnail, albumThumbnailUrl, setAllPhotos, toast]);

    const handleSortPhotos = useCallback(() => {
        // Get current direction and toggle
        const nextDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        setSortDirection(nextDirection);

        // Toast AFTER state updates
        toast({
            title: "Sorted",
            description: nextDirection === 'asc'
                ? "Photos sorted by number (#1 -> #N)"
                : "Photos sorted by number (#N -> #1)"
        });
    }, [sortDirection, toast]);

    // Chronological index: maps photo.id -> 1-based position sorted by capture date
    const chronologicalIndex = useMemo(() => {
        const sorted = [...allPhotos].sort((a, b) => {
            const dateA = a.captureDate ? new Date(a.captureDate).getTime() : null;
            const dateB = b.captureDate ? new Date(b.captureDate).getTime() : null;

            // 1. Primary Sort: Presence of date (Defined dates always come first for numbering)
            if (dateA !== null && dateB === null) return -1;
            if (dateA === null && dateB !== null) return 1;

            // 2. Both have dates: Sort ASC (always ASC for numbering)
            if (dateA !== null && dateB !== null) {
                if (dateA !== dateB) return dateA - dateB;
            }

            // 2. Secondary Sort: Filename
            const nameA = a.alt || '';
            const nameB = b.alt || '';
            if (nameA !== nameB) return nameA.localeCompare(nameB);

            // 3. Absolute Tie-breaker: ID
            return a.id.localeCompare(b.id);
        });
        const indexMap: Record<string, number> = {};
        sorted.forEach((photo, i) => {
            indexMap[photo.id] = i + 1;
        });
        return indexMap;
    }, [allPhotos]);

    const sortedPhotos = useMemo(() => {
        return [...allPhotos].sort((a, b) => {
            const indexA = chronologicalIndex[a.id] || 0;
            const indexB = chronologicalIndex[b.id] || 0;

            if (sortDirection === 'asc') {
                return indexA - indexB;
            } else {
                return indexB - indexA;
            }
        });
    }, [allPhotos, chronologicalIndex, sortDirection]);


    const handleClearGallery = useCallback(async () => {
        // 1. Optimistic Update
        const photosToDeleteSnapshot = [...allPhotos];

        // Notify Album to clear used photos
        if (onRemovePhotosFromAlbum && photosToDeleteSnapshot.length > 0) {
            onRemovePhotosFromAlbum(photosToDeleteSnapshot.map(p => p.id));
        }

        setAllPhotos([]);

        // 2. Background Deletion
        try {
            const getStoragePath = (url: string) => {
                try {
                    const parts = url.split('/photos/');
                    if (parts.length > 1) return decodeURIComponent(parts[1]);
                    return null;
                } catch (e) { return null; }
            };

            const photosToDelete = photosToDeleteSnapshot.map(p => ({
                id: p.id,
                storage_path: getStoragePath(p.remoteUrl || p.src)
            })).filter(p => p.storage_path);

            if (photosToDelete.length > 0) {
                await fetch('/api/photos/batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ photos: photosToDelete })
                });
            }

            toast({
                title: 'Gallery Cleared',
                description: 'All photos have been permanently deleted.',
            });
        } catch (e) {
            logger.error('Failed to clear gallery (server sync)', e);
            toast({ title: 'Warning', description: 'Gallery cleared locally, but server sync may have failed.', variant: 'destructive' });
        }
    }, [allPhotos, setAllPhotos, toast]);

    const handleDeletePhotos = useCallback(async (ids: string[]) => {
        // Optimistic
        setAllPhotos(prev => prev.filter(p => !ids.includes(p.id)));

        // Notify Album
        if (onRemovePhotosFromAlbum) {
            onRemovePhotosFromAlbum(ids);
        }

        try {
            const getStoragePath = (url: string) => {
                try {
                    const parts = url.split('/photos/');
                    if (parts.length > 1) return decodeURIComponent(parts[1]);
                    return null;
                } catch (e) { return null; }
            };

            const photosToDelete = allPhotos.filter(p => ids.includes(p.id)).map(p => ({
                id: p.id,
                storage_path: getStoragePath(p.remoteUrl || p.src)
            })).filter(p => p.storage_path);

            if (photosToDelete.length > 0) {
                await fetch('/api/photos/batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ photos: photosToDelete })
                });
            }
            toast({
                title: 'Photos Deleted',
                description: `${ids.length} photos removed from gallery.`
            });

        } catch (e) {
            logger.error("Delete failed", e);
            toast({ title: "Error", description: "Failed to delete from server", variant: "destructive" });
        }
    }, [allPhotos, setAllPhotos, toast]);

    const uploadPhotos = useCallback((files: FileList) => {
        processUploadedFiles(files);
    }, [processUploadedFiles]);


    return {
        isLoadingPhotos,
        setIsLoadingPhotos,
        processUploadedFiles,
        uploadPhotos,
        handleSortPhotos,
        handleClearGallery,
        handleDeletePhotos,
        photoScrollRef,
        folderUploadRef,
        photoUploadRef,
        sortedPhotos,
        chronologicalIndex
    };
}
