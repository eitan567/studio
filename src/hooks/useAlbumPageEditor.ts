import { useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import { AlbumPage, Photo, PhotoPanAndZoom } from '@/lib/types';
import { useTemplates, getPhotoCount } from '@/hooks/useTemplates';

// Helper to parse layout ID
function parseLayoutId(layoutId: string): { baseId: string; rotation: number } {
    const rotationMatch = layoutId.match(/_r(90|180|270)$/);
    if (rotationMatch) {
        const rotation = parseInt(rotationMatch[1]);
        const baseId = layoutId.replace(/_r(90|180|270)$/, '');
        return { baseId, rotation };
    }
    return { baseId: layoutId, rotation: 0 };
}

interface UseAlbumPageEditorProps {
    setAlbumPages: React.Dispatch<React.SetStateAction<AlbumPage[]>>;
    allPhotos: Photo[];
    allowDuplicates: boolean;
    usedPhotoIds: Set<string>;
}

export function useAlbumPageEditor({
    setAlbumPages,
    allPhotos,
    allowDuplicates,
    usedPhotoIds,
}: UseAlbumPageEditorProps) {
    const { findTemplate, findCoverTemplate, defaultGridTemplate, defaultCoverTemplate } = useTemplates();
    const { toast } = useToast();

    // Use refs to keep latest values without breaking callback memoization
    const allPhotosRef = useRef(allPhotos);
    const allowDuplicatesRef = useRef(allowDuplicates);
    const usedPhotoIdsRef = useRef(usedPhotoIds);

    useEffect(() => {
        allPhotosRef.current = allPhotos;
        allowDuplicatesRef.current = allowDuplicates;
        usedPhotoIdsRef.current = usedPhotoIds;
    }, [allPhotos, allowDuplicates, usedPhotoIds]);

    const deletePage = useCallback((pageId: string) => {
        setAlbumPages(prev => prev.filter(p => p.id !== pageId));
        toast({
            title: "Page Deleted",
            variant: "destructive"
        });
    }, [setAlbumPages, toast]);

    const addSpreadPage = useCallback((afterIndex: number) => {
        const createEmptyPhoto = () => ({
            id: uuidv4(),
            src: '',
            alt: 'Drop photo here',
            panAndZoom: { scale: 1, x: 50, y: 50 }
        });

        const newSpread: AlbumPage = {
            id: uuidv4(),
            type: 'spread',
            photos: [createEmptyPhoto(), createEmptyPhoto(), createEmptyPhoto(), createEmptyPhoto()],
            layout: '4-grid'
        };

        setAlbumPages(prev => {
            const newPages = [...prev];
            newPages.splice(afterIndex + 1, 0, newSpread);
            return newPages;
        });

        toast({
            title: "Spread Added",
            description: "A new double-page spread has been added."
        });
    }, [setAlbumPages, toast]);

    const updatePageLayout = useCallback((pageId: string, newLayoutId: string) => {
        setAlbumPages(prevPages => {
            return prevPages.map(page => {
                if (page.id !== pageId) return page;

                const { baseId } = parseLayoutId(newLayoutId);
                const newTemplate = findTemplate(baseId);
                if (!newTemplate) return page;

                const newPhotoCount = getPhotoCount(newTemplate);
                const currentPhotos = [...page.photos];
                const defaultPanAndZoom = { scale: 1, x: 50, y: 50 };

                if (currentPhotos.length < newPhotoCount) {
                    const emptySlotCount = newPhotoCount - currentPhotos.length;
                    for (let i = 0; i < emptySlotCount; i++) {
                        currentPhotos.push({
                            id: uuidv4(),
                            src: '',
                            alt: 'Drop photo here',
                            panAndZoom: defaultPanAndZoom
                        });
                    }
                } else if (currentPhotos.length > newPhotoCount) {
                    currentPhotos.splice(newPhotoCount);
                }

                return {
                    ...page,
                    layout: newLayoutId,
                    photos: currentPhotos
                };
            });
        });
    }, [setAlbumPages, findTemplate]);

    const handleRemovePhoto = useCallback((pageId: string, photoId: string) => {
        setAlbumPages(prevPages => {
            return prevPages.map(page => {
                if (page.id !== pageId) return page;

                const newPhotos = page.photos.map(photo => {
                    if (photo.id === photoId) {
                        return {
                            id: uuidv4(),
                            src: '',
                            alt: 'Drop photo here',
                            width: 600,
                            height: 400,
                            panAndZoom: { scale: 1, x: 50, y: 50 }
                        };
                    }
                    return photo;
                });

                return {
                    ...page,
                    photos: newPhotos
                };
            });
        });

        toast({
            title: "Photo Removed",
            description: "The photo has been removed from the frame."
        });
    }, [setAlbumPages, toast]);

    const handleUpdateCoverLayout = useCallback((pageId: string, side: 'front' | 'back' | 'full', newLayout: string) => {
        setAlbumPages(prevPages => {
            return prevPages.map(page => {
                if (page.id !== pageId || !page.isCover) return page;

                if (side === 'full') {
                    const { baseId: baseLayoutId } = parseLayoutId(newLayout);
                    const template = findCoverTemplate(baseLayoutId) || defaultCoverTemplate;
                    const requiredPhotos = getPhotoCount(template);
                    let currentPhotos = [...page.photos];

                    if (currentPhotos.length < requiredPhotos) {
                        const missingCount = requiredPhotos - currentPhotos.length;
                        for (let i = 0; i < missingCount; i++) {
                            currentPhotos.push({
                                id: uuidv4(),
                                src: '',
                                alt: 'Drop photo here',
                                width: 600,
                                height: 400
                            });
                        }
                    } else if (currentPhotos.length > requiredPhotos) {
                        currentPhotos.splice(requiredPhotos);
                    }

                    return {
                        ...page,
                        layout: newLayout,
                        photos: currentPhotos
                    };
                }

                const currentFrontLayout = page.coverLayouts?.front || '1-full';
                const currentBackLayout = page.coverLayouts?.back || '1-full';

                const frontLayout = side === 'front' ? newLayout : currentFrontLayout;
                const backLayout = side === 'back' ? newLayout : currentBackLayout;

                const { baseId: frontBaseId } = parseLayoutId(frontLayout);
                const { baseId: backBaseId } = parseLayoutId(backLayout);
                const frontTemplate = findCoverTemplate(frontBaseId) || defaultCoverTemplate;
                const backTemplate = findCoverTemplate(backBaseId) || defaultCoverTemplate;

                const requiredBackPhotos = getPhotoCount(backTemplate);
                const requiredFrontPhotos = getPhotoCount(frontTemplate);
                const totalRequired = requiredBackPhotos + requiredFrontPhotos;

                let currentPhotos = [...page.photos];

                if (currentPhotos.length < totalRequired) {
                    const missingCount = totalRequired - currentPhotos.length;
                    for (let i = 0; i < missingCount; i++) {
                        currentPhotos.push({
                            id: uuidv4(),
                            src: '',
                            alt: 'Drop photo here',
                            width: 600,
                            height: 400
                        });
                    }
                } else if (currentPhotos.length > totalRequired) {
                    currentPhotos.splice(totalRequired);
                }

                return {
                    ...page,
                    photos: currentPhotos,
                    coverLayouts: {
                        front: frontLayout,
                        back: backLayout
                    }
                };
            });
        });
    }, [setAlbumPages, findCoverTemplate, defaultCoverTemplate]);

    const handleUpdateSpreadLayout = useCallback((pageId: string, side: 'left' | 'right', newLayout: string) => {
        setAlbumPages(prevPages => {
            return prevPages.map(page => {
                if (page.id !== pageId || page.isCover) return page;

                const currentLeftLayout = page.spreadLayouts?.left || defaultGridTemplate.id;
                const currentRightLayout = page.spreadLayouts?.right || defaultGridTemplate.id;

                const leftLayout = side === 'left' ? newLayout : currentLeftLayout;
                const rightLayout = side === 'right' ? newLayout : currentRightLayout;

                const { baseId: leftBaseId } = parseLayoutId(leftLayout);
                const { baseId: rightBaseId } = parseLayoutId(rightLayout);
                const leftTemplate = findTemplate(leftBaseId) || defaultGridTemplate;
                const rightTemplate = findTemplate(rightBaseId) || defaultGridTemplate;

                const { baseId: oldLeftBaseId } = parseLayoutId(currentLeftLayout);
                const oldLeftTemplate = findTemplate(oldLeftBaseId) || defaultGridTemplate;
                const oldLeftCount = getPhotoCount(oldLeftTemplate);

                const newLeftCount = getPhotoCount(leftTemplate);
                const newRightCount = getPhotoCount(rightTemplate);

                let currentPhotos = [...page.photos];

                if (side === 'left') {
                    const diff = newLeftCount - oldLeftCount;

                    if (diff > 0) {
                        const newSlots = Array(diff).fill(null).map(() => ({
                            id: uuidv4(),
                            src: '',
                            alt: 'Drop photo here',
                            width: 600,
                            height: 400,
                            panAndZoom: { scale: 1, x: 50, y: 50 }
                        }));
                        currentPhotos.splice(oldLeftCount, 0, ...newSlots);
                    } else if (diff < 0) {
                        currentPhotos.splice(newLeftCount, Math.abs(diff));
                    }
                } else {
                    const totalRequired = newLeftCount + newRightCount;
                    if (currentPhotos.length < totalRequired) {
                        const missing = totalRequired - currentPhotos.length;
                        const newSlots = Array(missing).fill(null).map(() => ({
                            id: uuidv4(),
                            src: '',
                            alt: 'Drop photo here',
                            width: 600,
                            height: 400,
                            panAndZoom: { scale: 1, x: 50, y: 50 }
                        }));
                        currentPhotos.push(...newSlots);
                    } else if (currentPhotos.length > totalRequired) {
                        currentPhotos.splice(totalRequired);
                    }
                }

                return {
                    ...page,
                    photos: currentPhotos,
                    spreadLayouts: {
                        left: leftLayout,
                        right: rightLayout
                    }
                };
            });
        });
    }, [setAlbumPages, defaultGridTemplate, findTemplate]);

    const handleUpdateCoverType = useCallback((pageId: string, newType: 'split' | 'full') => {
        setAlbumPages(prevPages => {
            return prevPages.map(page => {
                if (page.id !== pageId || !page.isCover) return page;

                // When switching cover type, we need to ensure the photos array matches the required count
                // for the new type's layouts.
                let requiredCount = 0;
                if (newType === 'full') {
                    const { baseId } = parseLayoutId(page.layout || defaultCoverTemplate.id);
                    const template = findCoverTemplate(baseId) || defaultCoverTemplate;
                    requiredCount = getPhotoCount(template);
                } else {
                    const currentFrontLayout = page.coverLayouts?.front || '1-full';
                    const currentBackLayout = page.coverLayouts?.back || '1-full';

                    const { baseId: frontBaseId } = parseLayoutId(currentFrontLayout);
                    const { baseId: backBaseId } = parseLayoutId(currentBackLayout);

                    const frontTemplate = findCoverTemplate(frontBaseId) || defaultCoverTemplate;
                    const backTemplate = findCoverTemplate(backBaseId) || defaultCoverTemplate;

                    requiredCount = getPhotoCount(frontTemplate) + getPhotoCount(backTemplate);
                }

                let currentPhotos = [...page.photos];
                if (currentPhotos.length < requiredCount) {
                    const missingCount = requiredCount - currentPhotos.length;
                    for (let i = 0; i < missingCount; i++) {
                        currentPhotos.push({
                            id: uuidv4(),
                            src: '',
                            alt: 'Drop photo here',
                            width: 600,
                            height: 400
                        });
                    }
                } else if (currentPhotos.length > requiredCount) {
                    currentPhotos.splice(requiredCount);
                }

                return {
                    ...page,
                    coverType: newType,
                    photos: currentPhotos
                };
            });
        });
    }, [setAlbumPages, findCoverTemplate, defaultCoverTemplate]);

    const handleUpdateSpineText = useCallback((pageId: string, text: string) => {
        setAlbumPages(prevPages => prevPages.map(page => {
            if (page.id !== pageId) return page;
            return { ...page, spineText: text };
        }));
    }, [setAlbumPages]);

    const handleUpdateSpineSettings = useCallback((pageId: string, settings: { width?: number; color?: string; opacity?: number; textColor?: string; fontSize?: number; fontFamily?: string }) => {
        setAlbumPages(prevPages => prevPages.map(page => {
            if (page.id !== pageId) return page;
            return {
                ...page,
                spineWidth: settings.width ?? page.spineWidth,
                spineColor: settings.color ?? page.spineColor,
                spineOpacity: settings.opacity ?? page.spineOpacity,
                spineTextColor: settings.textColor ?? page.spineTextColor,
                spineFontSize: settings.fontSize ?? page.spineFontSize,
                spineFontFamily: settings.fontFamily ?? page.spineFontFamily
            };
        }));
    }, [setAlbumPages]);

    const handleUpdateTitleSettings = useCallback((pageId: string, settings: { text?: string; color?: string; fontSize?: number; fontFamily?: string; position?: { x: number; y: number } }) => {
        setAlbumPages(prevPages => prevPages.map(page => {
            if (page.id !== pageId) return page;
            return {
                ...page,
                titleText: settings.text !== undefined ? settings.text : page.titleText,
                titleColor: settings.color ?? page.titleColor,
                titleFontSize: settings.fontSize ?? page.titleFontSize,
                titleFontFamily: settings.fontFamily ?? page.titleFontFamily,
                titlePosition: settings.position ?? page.titlePosition
            };
        }));
    }, [setAlbumPages]);

    const handleUpdatePage = useCallback((updatedPage: AlbumPage) => {
        setAlbumPages(prevPages => prevPages.map(page =>
            page.id === updatedPage.id ? updatedPage : page
        ));
    }, [setAlbumPages]);

    const updatePhotoPanAndZoom = useCallback((pageId: string, photoId: string, panAndZoom: PhotoPanAndZoom) => {
        setAlbumPages(pages => pages.map(page => {
            if (page.id !== pageId) return page;
            return {
                ...page,
                photos: page.photos.map(photo => {
                    if (photo.id !== photoId) return photo;
                    return { ...photo, panAndZoom };
                })
            };
        }));
    }, [setAlbumPages]);

    const handleDropPhoto = useCallback((pageId: string, targetPhotoId: string, droppedPhotoId: string, sourceInfo?: { pageId: string; photoId: string }) => {
        // Handle album-to-album swap (CTRL+drag between frames)
        if (sourceInfo) {
            // Skip if trying to swap with itself
            if (sourceInfo.photoId === targetPhotoId) return;

            setAlbumPages(prevPages => {
                // Find source and target photos FIRST
                let sourcePhoto: Photo | undefined;
                let targetPhoto: Photo | undefined;

                // Helper to resolve target photo (handles both ID and INSERT_AT)
                const resolveTargetPhoto = (page: AlbumPage, targetId: string) => {
                    if (targetId.startsWith('__INSERT_AT__')) {
                        const idx = parseInt(targetId.replace('__INSERT_AT__', ''), 10);
                        return page.photos[idx]; // Might be undefined or empty slot
                    }
                    return page.photos.find(p => p.id === targetId);
                };

                for (const page of prevPages) {
                    if (page.id === sourceInfo.pageId) {
                        sourcePhoto = page.photos.find(p => p.id === sourceInfo.photoId);
                    }
                    if (page.id === pageId) {
                        targetPhoto = resolveTargetPhoto(page, targetPhotoId);
                    }
                }

                if (!sourcePhoto) return prevPages;

                // Check if swapping within the same page (SPLIT mode case)
                const isSamePage = sourceInfo.pageId === pageId;

                // Capture these for use in map callbacks
                const capturedSourcePhoto = sourcePhoto;
                const capturedTargetPhoto = targetPhoto;

                // Perform the swap
                return prevPages.map(page => {
                    // Same page swap
                    if (isSamePage && page.id === pageId) {
                        return {
                            ...page,
                            photos: page.photos.map((p, index) => {
                                const isTarget = targetPhotoId.startsWith('__INSERT_AT__')
                                    ? index === parseInt(targetPhotoId.replace('__INSERT_AT__', ''), 10)
                                    : p.id === targetPhotoId;

                                // Replace source photo slot with target content (or empty)
                                if (p.id === sourceInfo.photoId) {
                                    if (capturedTargetPhoto && capturedTargetPhoto.src) {
                                        return {
                                            ...capturedTargetPhoto,
                                            id: sourceInfo.photoId,
                                            panAndZoom: { scale: 1, x: 50, y: 50 }
                                        };
                                    } else {
                                        return {
                                            id: sourceInfo.photoId,
                                            src: '',
                                            alt: 'Drop photo here',
                                            width: 600,
                                            height: 400,
                                            panAndZoom: { scale: 1, x: 50, y: 50 }
                                        };
                                    }
                                }
                                // Replace target photo slot with source content
                                if (isTarget) {
                                    return {
                                        ...capturedSourcePhoto,
                                        id: p.id, // Keep existing slot ID
                                        panAndZoom: { scale: 1, x: 50, y: 50 }
                                    } as Photo;
                                }
                                return p;
                            })
                        };
                    }

                    // Different pages - update source page (Remove Source)
                    if (!isSamePage && page.id === sourceInfo.pageId) {
                        return {
                            ...page,
                            photos: page.photos.map(p => {
                                if (p.id === sourceInfo.photoId) {
                                    // If we are swapping with a valid target, take it. Else clear.
                                    if (capturedTargetPhoto && capturedTargetPhoto.src) {
                                        return {
                                            ...capturedTargetPhoto,
                                            id: sourceInfo.photoId,
                                            panAndZoom: { scale: 1, x: 50, y: 50 }
                                        };
                                    } else {
                                        return {
                                            id: sourceInfo.photoId,
                                            src: '',
                                            alt: 'Drop photo here',
                                            width: 600,
                                            height: 400,
                                            panAndZoom: { scale: 1, x: 50, y: 50 }
                                        };
                                    }
                                }
                                return p;
                            })
                        };
                    }

                    // Different pages - update target page (Insert Source)
                    if (!isSamePage && page.id === pageId) {
                        return {
                            ...page,
                            photos: page.photos.map((p, index) => {
                                const isTarget = targetPhotoId.startsWith('__INSERT_AT__')
                                    ? index === parseInt(targetPhotoId.replace('__INSERT_AT__', ''), 10)
                                    : p.id === targetPhotoId;

                                if (isTarget) {
                                    return {
                                        ...capturedSourcePhoto,
                                        id: p.id, // Keep slot ID
                                        panAndZoom: { scale: 1, x: 50, y: 50 }
                                    } as Photo;
                                }
                                return p;
                            })
                        };
                    }

                    return page;
                });
            });

            toast({
                title: "Photos Swapped",
                description: "Photos have been swapped between frames."
            });
            return;
        }

        // Regular gallery drop (existing logic)
        const droppedPhoto = allPhotosRef.current.find(p => p.id === droppedPhotoId);
        if (!droppedPhoto) return;

        if (!allowDuplicatesRef.current && usedPhotoIdsRef.current.has(droppedPhotoId)) {
            toast({
                title: "Photo already in album",
                description: "Duplicate photos are not allowed with current settings.",
                variant: "destructive"
            });
            return;
        }

        setAlbumPages(prevPages => prevPages.map(page => {
            if (page.id !== pageId) return page;

            if (targetPhotoId.startsWith('__INSERT_AT__')) {
                const index = parseInt(targetPhotoId.replace('__INSERT_AT__', ''), 10);
                if (isNaN(index)) return page;

                const newPhotos = [...page.photos];
                const newPhotoObj = {
                    ...droppedPhoto,
                    id: uuidv4(),
                    originalId: droppedPhoto.id,
                    remoteUrl: droppedPhoto.remoteUrl,
                    panAndZoom: { scale: 1, x: 50, y: 50 },
                    width: droppedPhoto.width || 800,
                    height: droppedPhoto.height || 600
                };

                while (newPhotos.length < index) {
                    newPhotos.push({
                        id: uuidv4(),
                        src: '',
                        alt: 'Drop photo here',
                        width: 600,
                        height: 400
                    });
                }

                newPhotos[index] = newPhotoObj;

                return {
                    ...page,
                    photos: newPhotos
                };
            }

            return {
                ...page,
                photos: page.photos.map(p => {
                    if (p.id === targetPhotoId) {
                        return {
                            ...droppedPhoto,
                            id: targetPhotoId,
                            originalId: droppedPhoto.id,
                            remoteUrl: droppedPhoto.remoteUrl,
                            panAndZoom: { scale: 1, x: 50, y: 50 },
                            width: droppedPhoto.width || 800,
                            height: droppedPhoto.height || 600
                        };
                    }
                    return p;
                })
            };
        }));
    }, [setAlbumPages, toast]);

    const handleRemovePhotosFromAlbum = useCallback((photoIds: string[]) => {
        setAlbumPages(prevPages => {
            return prevPages.map(page => {
                // Check if page has any of the photos to be removed
                const hasPhotoToRemove = page.photos.some(p => photoIds.includes(p.originalId || p.id));

                if (!hasPhotoToRemove) return page;

                // Replace removed photos with empty slots
                const newPhotos = page.photos.map(photo => {
                    if (photoIds.includes(photo.originalId || photo.id)) {
                        return {
                            id: uuidv4(),
                            src: '',
                            alt: 'Drop photo here',
                            width: 600,
                            height: 400,
                            panAndZoom: { scale: 1, x: 50, y: 50 }
                        };
                    }
                    return photo;
                });

                return {
                    ...page,
                    photos: newPhotos
                };
            });
        });
    }, [setAlbumPages]);

    // Replace a photo ID across all pages (for optimistic upload consistency)
    const replacePhotoId = useCallback((tempId: string, newPhoto: Photo) => {
        setAlbumPages(prevPages => {
            let hasChanges = false;

            const nextPages = prevPages.map(page => {
                const photos = page.photos.map(p => {
                    // Check if this photo needs replacing (either by explicit ID or originalId)
                    // We check both because sometimes the tempId becomes the originalId
                    if (p.id === tempId || p.originalId === tempId || (p.src === newPhoto.src && p.src.startsWith('blob:'))) {
                        hasChanges = true;
                        return {
                            ...p,
                            // Update identification
                            id: p.id === tempId ? newPhoto.id : p.id, // Only change node ID if it matched tempId exactly
                            originalId: newPhoto.id, // Always point to the new master ID

                            // Update Source Data
                            remoteUrl: newPhoto.remoteUrl || newPhoto.src,
                            width: newPhoto.width || p.width,
                            height: newPhoto.height || p.height,

                            // Preserve local state (pan/zoom)
                            panAndZoom: p.panAndZoom,
                        };
                    }
                    return p;
                });

                return { ...page, photos };
            });

            return hasChanges ? nextPages : prevPages;
        });
    }, [setAlbumPages]);

    return {
        deletePage,
        addSpreadPage,
        updatePageLayout,
        handleRemovePhoto,
        handleUpdateCoverLayout,
        handleUpdateSpreadLayout,
        handleUpdateCoverType,
        handleUpdateSpineText,
        handleUpdateSpineSettings,
        handleUpdateTitleSettings,
        handleUpdatePage,
        updatePhotoPanAndZoom,
        handleDropPhoto,
        handleRemovePhotosFromAlbum,
        replacePhotoId
    };
}
