import { useState, useRef, useCallback } from 'react';
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

        // BATCH_SIZE 2 is good for stability
        const BATCH_SIZE = 2;

        try {
            for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
                const chunk = tasks.slice(i, i + BATCH_SIZE);

                await Promise.all(chunk.map(async ({ file, tempId }) => {
                    let attempts = 0;
                    const maxAttempts = 3;
                    let success = false;
                    let lastError = 'Unknown error';

                    while (attempts < maxAttempts && !success) {
                        attempts++;
                        // Create a dedicated AbortController for this request
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s hard timeout

                        try {
                            // Pass signal and skipStateUpdates to avoid global state conflicts
                            // @ts-ignore - signal/skipStateUpdates added to hook recently
                            const result = await uploadPhoto(file, {
                                signal: controller.signal,
                                skipStateUpdates: true
                            });

                            clearTimeout(timeoutId);

                            if (result.success && result.photo) {
                                success = true;
                                // Success: Swap temp with real immediately
                                setAllPhotos(prev => prev.map(p =>
                                    p.id === tempId ? { ...result.photo!, isUploading: false } : p
                                ));
                                successCount++;

                                // Opportunistic thumbnail update
                                const isPlaceholder = !albumThumbnailUrl || placeholderImages.some(p => p.imageUrl === albumThumbnailUrl);
                                if (isPlaceholder && successCount === 1) {
                                    updateThumbnail(result.photo.src);
                                }
                            } else {
                                throw new Error(result.error || 'Upload failed');
                            }

                        } catch (e: any) {
                            clearTimeout(timeoutId);
                            lastError = e.name === 'AbortError' ? 'Timeout (Network Aborted)' : (e.message || String(e));

                            if (attempts < maxAttempts) {
                                // Wait before retry (exponential backoff: 1s, 2s)
                                await new Promise(r => setTimeout(r, 1000 * attempts));
                            }
                        }
                    }

                    if (!success) {
                        console.warn(`Final failure for ${file.name}:`, lastError);
                        failedUploads.push({ file: file.name, error: lastError });
                        // Mark as error instead of removing
                        setAllPhotos(prev => prev.map(p =>
                            p.id === tempId ? { ...p, isUploading: false, error: lastError } : p
                        ));
                    }
                }));
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
                description: 'Critical error during upload batch.',
                variant: 'destructive'
            });
            // Safety mark all remaining
            setAllPhotos(prev => prev.map(p =>
                tempPhotos.some(tp => tp.id === p.id) && p.isUploading
                    ? { ...p, isUploading: false, error: 'Process Error' }
                    : p
            ));
        } finally {
            setIsLoadingPhotos(false);

            // Cleanup stuck photos
            setAllPhotos(prev => prev.map(p => {
                const isTempPhoto = tempPhotos.some(tp => tp.id === p.id);
                if (isTempPhoto && p.isUploading) {
                    return { ...p, isUploading: false, error: 'Stuck (Final Cleanup)' };
                }
                return p;
            }));

            setTimeout(() => {
                tempPhotos.forEach(p => URL.revokeObjectURL(p.src));
            }, 2000);
        }
    }, [uploadPhoto, updateThumbnail, albumThumbnailUrl, setAllPhotos, toast]);

    const handleSortPhotos = useCallback(() => {
        setAllPhotos(prev => [...prev].sort((a, b) => {
            if (!a.captureDate && !b.captureDate) return 0;
            if (!a.captureDate) return 1;
            if (!b.captureDate) return -1;
            // Oldest first
            return new Date(a.captureDate).getTime() - new Date(b.captureDate).getTime();
        }));
        toast({
            title: "Sorted",
            description: "Photos sorted by date (Oldest -> Newest)"
        });
    }, [setAllPhotos, toast]);


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
                storage_path: getStoragePath(p.src)
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
                storage_path: getStoragePath(p.src)
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
        photoUploadRef
    };
}
