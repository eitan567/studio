import { useState, useRef, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Photo } from '@/lib/types';
import { usePhotoUpload } from '@/hooks/usePhotoUpload';
import placeholderImagesData from '@/lib/placeholder-images.json';

const placeholderImages = placeholderImagesData.placeholderImages;

interface UsePhotoGalleryManagerProps {
    allPhotos: Photo[];
    setAllPhotos: React.Dispatch<React.SetStateAction<Photo[]>>;
    updateThumbnail: (url: string) => void;
    albumThumbnailUrl?: string;
    allowDuplicates?: boolean; // Prop added for future extensibility if needed by uploads
}

export function usePhotoGalleryManager({
    allPhotos,
    setAllPhotos,
    updateThumbnail,
    albumThumbnailUrl,
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

    const processUploadedFiles = useCallback(async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        setIsLoadingPhotos(true);
        const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

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

        // Create temp photos for optimistic UI
        const tempPhotos: Photo[] = newFiles.map(file => ({
            id: crypto.randomUUID(), // Temp ID
            src: URL.createObjectURL(file),
            alt: file.name,
            width: 800, // approximated
            height: 600, // approximated
            isUploading: true,
            captureDate: new Date(file.lastModified)
        }));

        setAllPhotos(prev => [...prev, ...tempPhotos]);

        // Auto-scroll logic
        setTimeout(() => {
            const scrollContainer = photoScrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
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
                            console.warn('Thumbnail update failed (non-critical):', e);
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
            console.error('Batch process error:', error);
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

            // Final Cleanup

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
                ? "Photos sorted by date (Oldest -> Newest)"
                : "Photos sorted by date (Newest -> Oldest)"
        });
    }, [sortDirection, toast]);

    const sortedPhotos = useMemo(() => {
        return [...allPhotos].sort((a, b) => {
            const dateA = a.captureDate ? new Date(a.captureDate).getTime() : 0;
            const dateB = b.captureDate ? new Date(b.captureDate).getTime() : 0;

            // Both have dates - sort by date
            if (dateA && dateB) {
                const diff = sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
                if (diff !== 0) return diff;
            }

            // One has date, one doesn't - photos with dates come first
            if (dateA && !dateB) return -1;
            if (!dateA && dateB) return 1;

            // Neither has date (or dates are equal) - use ID as stable fallback
            return sortDirection === 'asc'
                ? a.id.localeCompare(b.id)
                : b.id.localeCompare(a.id);
        });
    }, [allPhotos, sortDirection]);


    const handleClearGallery = useCallback(async () => {
        // 1. Optimistic Update
        const photosToDeleteSnapshot = [...allPhotos];
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
            console.error('Failed to clear gallery (server sync)', e);
            toast({ title: 'Warning', description: 'Gallery cleared locally, but server sync may have failed.', variant: 'destructive' });
        }
    }, [allPhotos, setAllPhotos, toast]);

    const handleDeletePhotos = useCallback(async (ids: string[]) => {
        // Optimistic
        setAllPhotos(prev => prev.filter(p => !ids.includes(p.id)));

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
            console.error("Delete failed", e);
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
        sortedPhotos
    };
}
