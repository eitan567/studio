import { useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import { AlbumPage, CoverImage, Photo, PhotoPanAndZoom } from '@/lib/types';
import { useTemplates, getPhotoCount } from '@/hooks/useTemplates';
import { AdvancedTemplate } from '@/lib/advanced-layout-types';
import { parseLayoutId } from '@/lib/layout-id-utils';
import { extractSupabaseStoragePath } from '@/lib/supabase-media-normalizer';
import { createGalleryPhotoReferenceResolver } from '@/lib/photo-reference';


interface UseAlbumPageEditorProps {
    albumPages: AlbumPage[];
    setAlbumPages: React.Dispatch<React.SetStateAction<AlbumPage[]>>;
    allPhotos: Photo[];
    allowDuplicates: boolean;
    usedPhotoIds: Set<string>;
    customTemplates?: AdvancedTemplate[];
}

export function useAlbumPageEditor({
    albumPages,
    setAlbumPages,
    allPhotos,
    allowDuplicates,
    usedPhotoIds,
    customTemplates = [],
}: UseAlbumPageEditorProps) {
    const { findTemplate, findCoverTemplate, defaultGridTemplate, defaultCoverTemplate } = useTemplates();
    const { toast } = useToast();

    // Use refs to keep latest values without breaking callback memoization
    const allPhotosRef = useRef(allPhotos);
    const allowDuplicatesRef = useRef(allowDuplicates);
    const usedPhotoIdsRef = useRef(usedPhotoIds);
    const albumPagesRef = useRef(albumPages);
    const customTemplatesRef = useRef(customTemplates);

    useEffect(() => {
        allPhotosRef.current = allPhotos;
        allowDuplicatesRef.current = allowDuplicates;
        usedPhotoIdsRef.current = usedPhotoIds;
        albumPagesRef.current = albumPages;
        customTemplatesRef.current = customTemplates;
    }, [allPhotos, allowDuplicates, usedPhotoIds, albumPages, customTemplates]);

    const isPageLocked = useCallback((pageId: string) => {
        return albumPagesRef.current.some(page => page.id === pageId && !!page.isLocked);
    }, []);

    const findCustomTemplate = useCallback((id: string | number | null | undefined) => {
        if (id == null) return undefined;
        const { baseId } = parseLayoutId(id);
        return customTemplatesRef.current.find((template) => String(template.id) === String(baseId));
    }, []);

    const findGridTemplateWithCustom = useCallback((id: string | number | null | undefined) => {
        return findTemplate(id) || findCustomTemplate(id);
    }, [findCustomTemplate, findTemplate]);

    const findCoverTemplateWithCustom = useCallback((id: string | number | null | undefined) => {
        return findCoverTemplate(id) || findTemplate(id) || findCustomTemplate(id);
    }, [findCoverTemplate, findCustomTemplate, findTemplate]);

    const deletePage = useCallback((pageId: string) => {
        if (isPageLocked(pageId)) return;

        setAlbumPages(prev => prev.filter(p => p.id !== pageId));
        toast({
            title: "Page Deleted",
            variant: "destructive"
        });
    }, [isPageLocked, setAlbumPages, toast]);

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
            photos: [createEmptyPhoto(), createEmptyPhoto()],
            layout: defaultGridTemplate?.id || '',
            spreadLayouts: {
                left: defaultGridTemplate?.id || '',
                right: defaultGridTemplate?.id || ''
            }
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

    const movePage = useCallback((pageId: string, direction: 'up' | 'down') => {
        const isMovablePage = (page?: AlbumPage) => !!page && !page.isCover && page.type !== 'single';

        setAlbumPages(prevPages => {
            const currentIndex = prevPages.findIndex(page => page.id === pageId);
            if (currentIndex === -1) return prevPages;

            const currentPage = prevPages[currentIndex];
            if (!isMovablePage(currentPage)) return prevPages;

            const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
            if (targetIndex < 0 || targetIndex >= prevPages.length) return prevPages;

            const targetPage = prevPages[targetIndex];
            if (!isMovablePage(targetPage)) return prevPages;

            const nextPages = [...prevPages];
            [nextPages[currentIndex], nextPages[targetIndex]] = [nextPages[targetIndex], nextPages[currentIndex]];
            return nextPages;
        });
    }, [setAlbumPages]);

    const updatePageLayout = useCallback((pageId: string, newLayoutId: string) => {
        if (isPageLocked(pageId)) return;

        setAlbumPages(prevPages => {
            return prevPages.map(page => {
                if (page.id !== pageId) return page;

                const { baseId } = parseLayoutId(newLayoutId);
                const { baseId: currentBaseId } = parseLayoutId(page.layout || defaultGridTemplate?.id || '');
                const didBaseTemplateChange = String(currentBaseId) !== String(baseId);
                const shouldClearDynamicFrames = didBaseTemplateChange && (page.coverImages?.length ?? 0) > 0;
                console.log('[updatePageLayout] Called with:', { pageId, newLayoutId, baseId, currentPhotosLength: page.photos?.length });

                // Dynamic layouts generate their template based on photos
                // DON'T truncate photos for dynamic layouts!
                if (String(baseId).startsWith('dynamic-justified')) {
                    return {
                        ...page,
                        layout: newLayoutId,
                        coverImages: shouldClearDynamicFrames ? [] : page.coverImages,
                        // CRITICAL: Also update spreadLayouts so album-cover.tsx sees the new layout
                        spreadLayouts: {
                            left: newLayoutId,
                            right: newLayoutId
                        }
                    };
                }

                const newTemplate = findGridTemplateWithCustom(baseId);
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
                    photos: currentPhotos,
                    coverImages: shouldClearDynamicFrames ? [] : page.coverImages
                };
            });
        });
    }, [defaultGridTemplate, findGridTemplateWithCustom, isPageLocked, setAlbumPages]);

    const handleRemovePhoto = useCallback((pageId: string, photoId: string) => {
        if (isPageLocked(pageId)) return;

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
    }, [isPageLocked, setAlbumPages, toast]);

    const handleUpdateCoverLayout = useCallback((pageId: string, side: 'front' | 'back' | 'full', newLayout: string) => {
        if (isPageLocked(pageId)) return;

        setAlbumPages(prevPages => {
            return prevPages.map(page => {
                if (page.id !== pageId || !page.isCover) return page;

                if (side === 'full') {
                    const { baseId: baseLayoutId } = parseLayoutId(newLayout);
                    const { baseId: currentBaseId } = parseLayoutId(page.layout || defaultCoverTemplate?.id || '');
                    const didBaseTemplateChange = String(currentBaseId) !== String(baseLayoutId);
                    const shouldClearDynamicFrames = didBaseTemplateChange && (page.coverImages?.length ?? 0) > 0;

                    // CRITICAL: Dynamic layouts should preserve all photos - don't truncate!
                    if (String(baseLayoutId).startsWith('dynamic-justified')) {
                        console.log('[handleUpdateCoverLayout] Dynamic layout - PRESERVING photos:', page.photos?.length);
                        return {
                            ...page,
                            layout: newLayout,
                            coverImages: shouldClearDynamicFrames ? [] : page.coverImages
                            // Keep photos unchanged!
                        };
                    }

                    const fallbackId = String(defaultCoverTemplate?.id || '');
                    const fallbackTemplate: any = { id: fallbackId, regions: [], category: 'cover', name: 'Fallback' };
                    const template = findCoverTemplateWithCustom(baseLayoutId) || defaultCoverTemplate || fallbackTemplate;
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
                        photos: currentPhotos,
                        coverImages: shouldClearDynamicFrames ? [] : page.coverImages
                    };
                }

                const currentFrontLayout = page.coverLayouts?.front || defaultCoverTemplate?.id || '';
                const currentBackLayout = page.coverLayouts?.back || defaultCoverTemplate?.id || '';

                const frontLayout = side === 'front' ? newLayout : currentFrontLayout;
                const backLayout = side === 'back' ? newLayout : currentBackLayout;

                const { baseId: frontBaseId } = parseLayoutId(frontLayout);
                const { baseId: backBaseId } = parseLayoutId(backLayout);

                const { baseId: oldFrontBaseId } = parseLayoutId(currentFrontLayout);
                const { baseId: oldBackBaseId } = parseLayoutId(currentBackLayout);
                const didBaseTemplateChange = String(oldFrontBaseId) !== String(frontBaseId) || String(oldBackBaseId) !== String(backBaseId);
                const shouldClearDynamicFrames = didBaseTemplateChange && (page.coverImages?.length ?? 0) > 0;

                // CRITICAL: Dynamic layouts should preserve all photos - don't truncate!
                if (String(frontBaseId).startsWith('dynamic-justified') || String(backBaseId).startsWith('dynamic-justified')) {
                    return {
                        ...page,
                        coverLayouts: {
                            front: frontLayout,
                            back: backLayout
                        },
                        coverImages: shouldClearDynamicFrames ? [] : page.coverImages
                        // Keep photos unchanged!
                    };
                }

                const fallbackTemplate: any = { id: defaultCoverTemplate?.id || '', regions: [], category: 'cover', name: 'Fallback' };
                const frontTemplate = findCoverTemplateWithCustom(frontBaseId) || defaultCoverTemplate || fallbackTemplate;
                const backTemplate = findCoverTemplateWithCustom(backBaseId) || defaultCoverTemplate || fallbackTemplate;

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
                    },
                    coverImages: shouldClearDynamicFrames ? [] : page.coverImages
                };
            });
        });
    }, [defaultCoverTemplate, findCoverTemplateWithCustom, isPageLocked, setAlbumPages]);

    const handleUpdateSpreadLayout = useCallback((pageId: string, side: 'left' | 'right', newLayout: string) => {
        if (isPageLocked(pageId)) return;

        setAlbumPages(prevPages => {
            return prevPages.map(page => {
                if (page.id !== pageId || page.isCover) return page;

                const currentLeftLayout = page.spreadLayouts?.left || defaultGridTemplate?.id || '';
                const currentRightLayout = page.spreadLayouts?.right || defaultGridTemplate?.id || '';

                const leftLayout = side === 'left' ? newLayout : currentLeftLayout;
                const rightLayout = side === 'right' ? newLayout : currentRightLayout;

                const { baseId: oldLeftBaseId } = parseLayoutId(currentLeftLayout);
                const { baseId: oldRightBaseId } = parseLayoutId(currentRightLayout);
                const { baseId: leftBaseId } = parseLayoutId(leftLayout);
                const { baseId: rightBaseId } = parseLayoutId(rightLayout);
                const didBaseTemplateChange = String(oldLeftBaseId) !== String(leftBaseId)
                    || String(oldRightBaseId) !== String(rightBaseId);
                const shouldClearDynamicFrames = didBaseTemplateChange && (page.coverImages?.length ?? 0) > 0;

                // CRITICAL: Dynamic layouts should preserve all photos - don't do any truncation!
                if (String(leftBaseId).startsWith('dynamic-justified') || String(rightBaseId).startsWith('dynamic-justified')) {
                    return {
                        ...page,
                        coverImages: shouldClearDynamicFrames ? [] : page.coverImages,
                        spreadLayouts: {
                            left: leftLayout,
                            right: rightLayout
                        }
                        // Keep photos unchanged!
                    };
                }

                // Fallback template to prevent crash if templates not loaded
                const fallbackId = String(defaultGridTemplate?.id || '');
                const fallbackTemplate: any = { id: fallbackId, regions: [], category: 'grid', name: 'Fallback' };
                const leftTemplate = findGridTemplateWithCustom(leftBaseId) || defaultGridTemplate || fallbackTemplate;
                const rightTemplate = findGridTemplateWithCustom(rightBaseId) || defaultGridTemplate || fallbackTemplate;

                const oldLeftTemplate = findGridTemplateWithCustom(oldLeftBaseId) || defaultGridTemplate || fallbackTemplate;
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
                    coverImages: shouldClearDynamicFrames ? [] : page.coverImages,
                    spreadLayouts: {
                        left: leftLayout,
                        right: rightLayout
                    }
                };
            });
        });
    }, [defaultGridTemplate, findGridTemplateWithCustom, isPageLocked, setAlbumPages]);

    const handleUpdateCoverType = useCallback((pageId: string, newType: 'split' | 'full') => {
        if (isPageLocked(pageId)) return;

        setAlbumPages(prevPages => {
            return prevPages.map(page => {
                if (page.id !== pageId || !page.isCover) return page;

                // When switching cover type, we need to ensure the photos array matches the required count
                // for the new type's layouts.
                let requiredCount = 0;
                if (newType === 'full') {
                    const { baseId } = parseLayoutId(page.layout || defaultCoverTemplate?.id);
                    const template = findCoverTemplateWithCustom(baseId) || defaultCoverTemplate;
                    requiredCount = getPhotoCount(template);
                } else {
                    const currentFrontLayout = page.coverLayouts?.front || defaultCoverTemplate?.id || '';
                    const currentBackLayout = page.coverLayouts?.back || defaultCoverTemplate?.id || '';

                    const { baseId: frontBaseId } = parseLayoutId(currentFrontLayout);
                    const { baseId: backBaseId } = parseLayoutId(currentBackLayout);

                    const frontTemplate = findCoverTemplateWithCustom(frontBaseId) || defaultCoverTemplate;
                    const backTemplate = findCoverTemplateWithCustom(backBaseId) || defaultCoverTemplate;

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
    }, [defaultCoverTemplate, findCoverTemplateWithCustom, isPageLocked, setAlbumPages]);

    const handleUpdateSpineText = useCallback((pageId: string, text: string) => {
        if (isPageLocked(pageId)) return;

        setAlbumPages(prevPages => prevPages.map(page => {
            if (page.id !== pageId) return page;
            return { ...page, spineText: text };
        }));
    }, [isPageLocked, setAlbumPages]);

    const handleUpdateSpineSettings = useCallback((pageId: string, settings: { width?: number; color?: string; opacity?: number; textColor?: string; fontSize?: number; fontFamily?: string }) => {
        if (isPageLocked(pageId)) return;

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
    }, [isPageLocked, setAlbumPages]);

    const handleUpdateTitleSettings = useCallback((pageId: string, settings: { text?: string; color?: string; fontSize?: number; fontFamily?: string; position?: { x: number; y: number } }) => {
        if (isPageLocked(pageId)) return;

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
    }, [isPageLocked, setAlbumPages]);

    const togglePageLock = useCallback((pageId: string) => {
        let nextLockedState: boolean | null = null;

        setAlbumPages(prevPages => prevPages.map(page => {
            if (page.id !== pageId) return page;
            const nextLocked = !page.isLocked;
            nextLockedState = nextLocked;
            return { ...page, isLocked: nextLocked };
        }));

        if (nextLockedState === null) return;

        toast({
            title: nextLockedState ? "Page Locked" : "Page Unlocked",
            description: nextLockedState
                ? "Editing is disabled for this page."
                : "Editing has been re-enabled for this page."
        });
    }, [setAlbumPages, toast]);

    const handleUpdatePage = useCallback((updatedPage: AlbumPage) => {
        if (isPageLocked(updatedPage.id)) return;

        setAlbumPages(prevPages => prevPages.map(page =>
            page.id === updatedPage.id ? updatedPage : page
        ));
    }, [isPageLocked, setAlbumPages]);

    const updatePhotoPanAndZoom = useCallback((pageId: string, photoId: string, panAndZoom: PhotoPanAndZoom) => {
        if (isPageLocked(pageId)) return;

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
    }, [isPageLocked, setAlbumPages]);

    const handleDropPhoto = useCallback((pageId: string, targetPhotoId: string, droppedPhotoId: string, sourceInfo?: { pageId: string; photoId: string }) => {
        if (isPageLocked(pageId)) return;
        if (sourceInfo && isPageLocked(sourceInfo.pageId)) return;

        // Handle Multi-Photo Drop (Dynamic Justified Layout)
        if (targetPhotoId === '__REPLACE_ALL__') {
            try {
                const photoIds = JSON.parse(droppedPhotoId);
                console.log('[handleDropPhoto] Received photoIds:', photoIds);
                console.log('[handleDropPhoto] allPhotosRef.current count:', allPhotosRef.current.length);
                if (Array.isArray(photoIds)) {
                    setAlbumPages(prevPages => prevPages.map(page => {
                        if (page.id === pageId) {
                            const newPhotos = photoIds
                                .map((id: string) => {
                                    const found = allPhotosRef.current.find(p => p.id === id);
                                    if (!found) console.warn('[handleDropPhoto] Photo not found in ref:', id);
                                    return found;
                                })
                                .filter((p): p is Photo => !!p)
                                .map((p) => {
                                    const droppedSource = p.remoteUrl || p.src;
                                    return {
                                        ...p,
                                        id: uuidv4(), // Dynamic slots must always have unique IDs
                                        originalId: p.originalId || p.id,
                                        remoteUrl: droppedSource,
                                        storagePath: p.storagePath || extractSupabaseStoragePath(droppedSource) || undefined,
                                        panAndZoom: { scale: 1, x: 50, y: 50 },
                                        width: p.width || 800,
                                        height: p.height || 600
                                    };
                                }); // Filters out undefined photos

                            console.log('[handleDropPhoto] newPhotos count:', newPhotos.length);

                            if (newPhotos.length > 0) {
                                return {
                                    ...page,
                                    photos: newPhotos,
                                    layout: 'dynamic-justified',
                                    // Sync spreadLayouts and coverLayouts
                                    spreadLayouts: {
                                        left: 'dynamic-justified',
                                        right: 'dynamic-justified'
                                    },
                                    coverLayouts: {
                                        front: 'dynamic-justified',
                                        back: 'dynamic-justified'
                                    },
                                    spreadMode: undefined, // Reset spread mode for regular pages (forces full spread logic in some places)
                                    coverType: 'full', // Force full cover type for dynamic justified to ensure isFullSpread=true in AlbumCover
                                };
                            }
                        }
                        return page;
                    }));
                    return;
                }
            } catch (e) {
                // Not JSON or single photo dropped on background?
                // Fallthrough to regular logic if parsing fails (though unlikely if invoked with __REPLACE_ALL__)
            }
        }

        // Handle album-to-album swap (CTRL+drag between frames)
        if (sourceInfo) {
            // Skip if trying to swap with itself
            if (sourceInfo.photoId === targetPhotoId) return;

            setAlbumPages(prevPages => {
                type ResolvedDragItem =
                    | { kind: 'photo'; item: Photo; index: number }
                    | { kind: 'coverImage'; item: CoverImage; index: number };

                const resolveGalleryPhotoId = createGalleryPhotoReferenceResolver(allPhotosRef.current);

                const emptyPhotoSlot = (slotId: string): Photo => ({
                    id: slotId,
                    src: '',
                    alt: 'Drop photo here',
                    width: 600,
                    height: 400,
                    panAndZoom: { scale: 1, x: 50, y: 50 }
                });

                const getPhotoSource = (photo: Photo | null | undefined) => (photo?.remoteUrl || photo?.src || '').trim();
                const getCoverImageSource = (image: CoverImage | null | undefined) => (image?.url || '').trim();
                const isFilledPhoto = (photo: Photo | null | undefined) => getPhotoSource(photo).length > 0;
                const isFilledCoverImage = (image: CoverImage | null | undefined) => getCoverImageSource(image).length > 0;

                const resolveDragItem = (page: AlbumPage, id: string): ResolvedDragItem | null => {
                    if (id.startsWith('__INSERT_AT__')) {
                        const index = parseInt(id.replace('__INSERT_AT__', ''), 10);
                        if (isNaN(index) || index < 0 || index >= page.photos.length) return null;
                        return {
                            kind: 'photo',
                            item: page.photos[index],
                            index
                        };
                    }

                    const photoIndex = page.photos.findIndex((photo) => photo.id === id);
                    if (photoIndex >= 0) {
                        return {
                            kind: 'photo',
                            item: page.photos[photoIndex],
                            index: photoIndex
                        };
                    }

                    const coverImages = page.coverImages || [];
                    const coverImageIndex = coverImages.findIndex((image) => image.id === id);
                    if (coverImageIndex >= 0) {
                        return {
                            kind: 'coverImage',
                            item: coverImages[coverImageIndex],
                            index: coverImageIndex
                        };
                    }

                    return null;
                };

                const buildPhotoFromSource = (slotId: string, source: Photo | CoverImage | null | undefined): Photo => {
                    if (!source) return emptyPhotoSlot(slotId);

                    if ('url' in source) {
                        const sourceUrl = getCoverImageSource(source);
                        if (!sourceUrl) return emptyPhotoSlot(slotId);

                        const resolvedOriginalId = source.originalId || resolveGalleryPhotoId(source) || undefined;
                        const normalizedAspectRatio = Number(source.aspectRatio);
                        const fallbackAspectRatio = Number.isFinite(normalizedAspectRatio) && normalizedAspectRatio > 0
                            ? normalizedAspectRatio
                            : 1;

                        return {
                            id: slotId,
                            src: sourceUrl,
                            remoteUrl: sourceUrl,
                            alt: source.frameName || 'Dynamic photo',
                            width: 1000,
                            height: 1000 / fallbackAspectRatio,
                            originalId: resolvedOriginalId,
                            storagePath: source.storagePath || extractSupabaseStoragePath(sourceUrl) || undefined,
                            panAndZoom: { scale: 1, x: 50, y: 50 }
                        };
                    }

                    const sourceUrl = getPhotoSource(source);
                    if (!sourceUrl) return emptyPhotoSlot(slotId);

                    return {
                        ...source,
                        id: slotId,
                        src: source.src || sourceUrl,
                        remoteUrl: source.remoteUrl || sourceUrl,
                        originalId: source.originalId || source.id,
                        storagePath: source.storagePath || extractSupabaseStoragePath(sourceUrl) || undefined,
                        panAndZoom: { scale: 1, x: 50, y: 50 },
                        width: source.width || 800,
                        height: source.height || 600
                    };
                };

                const buildCoverImageFromSource = (
                    frame: CoverImage,
                    source: Photo | CoverImage | null | undefined
                ): CoverImage => {
                    if (!source) {
                        return {
                            ...frame,
                            url: '',
                            originalId: undefined,
                            storagePath: undefined,
                            panAndZoom: { scale: 1, x: 50, y: 50 }
                        };
                    }

                    if ('url' in source) {
                        const sourceUrl = getCoverImageSource(source);
                        if (!sourceUrl) {
                            return {
                                ...frame,
                                url: '',
                                originalId: undefined,
                                storagePath: undefined,
                                panAndZoom: { scale: 1, x: 50, y: 50 }
                            };
                        }

                        const resolvedOriginalId = source.originalId || resolveGalleryPhotoId(source) || undefined;
                        const normalizedAspectRatio = Number(source.aspectRatio);

                        return {
                            ...frame,
                            url: sourceUrl,
                            originalId: resolvedOriginalId,
                            storagePath: source.storagePath || extractSupabaseStoragePath(sourceUrl) || undefined,
                            aspectRatio: Number.isFinite(normalizedAspectRatio) && normalizedAspectRatio > 0
                                ? normalizedAspectRatio
                                : frame.aspectRatio,
                            panAndZoom: { scale: 1, x: 50, y: 50 }
                        };
                    }

                    const sourceUrl = getPhotoSource(source);
                    if (!sourceUrl) {
                        return {
                            ...frame,
                            url: '',
                            originalId: undefined,
                            storagePath: undefined,
                            panAndZoom: { scale: 1, x: 50, y: 50 }
                        };
                    }

                    const resolvedAspectRatio = (source.width && source.height && source.width > 0 && source.height > 0)
                        ? (source.width / source.height)
                        : frame.aspectRatio;

                    return {
                        ...frame,
                        url: sourceUrl,
                        originalId: source.originalId || source.id,
                        storagePath: source.storagePath || extractSupabaseStoragePath(sourceUrl) || undefined,
                        aspectRatio: resolvedAspectRatio,
                        panAndZoom: { scale: 1, x: 50, y: 50 }
                    };
                };

                let sourceItem: ResolvedDragItem | null = null;
                let targetItem: ResolvedDragItem | null = null;

                for (const page of prevPages) {
                    if (page.id === sourceInfo.pageId) {
                        sourceItem = resolveDragItem(page, sourceInfo.photoId);
                    }
                    if (page.id === pageId) {
                        targetItem = resolveDragItem(page, targetPhotoId);
                    }
                }

                if (!sourceItem) return prevPages;

                const sourceContent = sourceItem.kind === 'photo'
                    ? (isFilledPhoto(sourceItem.item) ? sourceItem.item : null)
                    : (isFilledCoverImage(sourceItem.item) ? sourceItem.item : null);
                const targetContent = !targetItem
                    ? null
                    : targetItem.kind === 'photo'
                        ? (isFilledPhoto(targetItem.item) ? targetItem.item : null)
                        : (isFilledCoverImage(targetItem.item) ? targetItem.item : null);

                return prevPages.map(page => {
                    if (page.id !== sourceInfo.pageId && page.id !== pageId) return page;

                    let didChange = false;
                    let nextPhotos = page.photos;
                    let nextCoverImages = page.coverImages;

                    if (page.id === sourceInfo.pageId) {
                        if (sourceItem.kind === 'photo') {
                            nextPhotos = page.photos.map((photo) => {
                                if (photo.id !== sourceInfo.photoId) return photo;
                                didChange = true;
                                return buildPhotoFromSource(sourceInfo.photoId, targetContent);
                            });
                        } else {
                            const currentCoverImages = page.coverImages || [];
                            nextCoverImages = currentCoverImages.map((image) => {
                                if (image.id !== sourceInfo.photoId) return image;
                                didChange = true;
                                return buildCoverImageFromSource(image, targetContent);
                            });
                        }
                    }

                    if (page.id === pageId) {
                        if (targetPhotoId.startsWith('__INSERT_AT__')) {
                            const targetIndex = parseInt(targetPhotoId.replace('__INSERT_AT__', ''), 10);
                            if (!isNaN(targetIndex)) {
                                nextPhotos = (nextPhotos || page.photos).map((photo, index) => {
                                    if (index !== targetIndex) return photo;
                                    didChange = true;
                                    return buildPhotoFromSource(photo.id, sourceContent);
                                });
                            }
                        } else if (targetItem?.kind === 'photo') {
                            nextPhotos = (nextPhotos || page.photos).map((photo) => {
                                if (photo.id !== targetPhotoId) return photo;
                                didChange = true;
                                return buildPhotoFromSource(photo.id, sourceContent);
                            });
                        } else if (targetItem?.kind === 'coverImage') {
                            const currentCoverImages = nextCoverImages || page.coverImages || [];
                            nextCoverImages = currentCoverImages.map((image) => {
                                if (image.id !== targetPhotoId) return image;
                                didChange = true;
                                return buildCoverImageFromSource(image, sourceContent);
                            });
                        }
                    }

                    if (!didChange) return page;

                    return {
                        ...page,
                        photos: nextPhotos,
                        coverImages: nextCoverImages
                    };
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
                const droppedSource = droppedPhoto.remoteUrl || droppedPhoto.src;
                const newPhotoObj = {
                    ...droppedPhoto,
                    id: uuidv4(),
                    originalId: droppedPhoto.id,
                    remoteUrl: droppedSource,
                    storagePath: droppedPhoto.storagePath || extractSupabaseStoragePath(droppedSource) || undefined,
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
                        const droppedSource = droppedPhoto.remoteUrl || droppedPhoto.src;
                        return {
                            ...droppedPhoto,
                            id: targetPhotoId,
                            originalId: droppedPhoto.id,
                            remoteUrl: droppedSource,
                            storagePath: droppedPhoto.storagePath || extractSupabaseStoragePath(droppedSource) || undefined,
                            panAndZoom: { scale: 1, x: 50, y: 50 },
                            width: droppedPhoto.width || 800,
                            height: droppedPhoto.height || 600
                        };
                    }
                    return p;
                })
            };
        }));
    }, [isPageLocked, setAlbumPages, toast]);

    const handleRemovePhotosFromAlbum = useCallback((photoIds: string[]) => {
        setAlbumPages(prevPages => {
            const photoIdSet = new Set(photoIds);
            const resolveGalleryPhotoId = createGalleryPhotoReferenceResolver(allPhotosRef.current);

            return prevPages.map(page => {
                if (page.isLocked) return page;

                const matchesRemovedPhoto = (reference: {
                    id?: string;
                    originalId?: string;
                    src?: string;
                    remoteUrl?: string;
                    url?: string;
                    storagePath?: string;
                }) => {
                    const resolvedPhotoId = resolveGalleryPhotoId(reference);
                    return resolvedPhotoId ? photoIdSet.has(resolvedPhotoId) : false;
                };

                const hasPhotoToRemove = page.photos.some(matchesRemovedPhoto)
                    || (page.coverImages || []).some(matchesRemovedPhoto);

                if (!hasPhotoToRemove) return page;

                const newPhotos = page.photos.map(photo => {
                    if (matchesRemovedPhoto(photo)) {
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

                const currentCoverImages = page.coverImages || [];
                const newCoverImages = currentCoverImages.filter((image) => !matchesRemovedPhoto(image));

                return {
                    ...page,
                    photos: newPhotos,
                    coverImages: currentCoverImages.length > 0 ? newCoverImages : page.coverImages
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
                            storagePath: newPhoto.storagePath || extractSupabaseStoragePath(newPhoto.remoteUrl || newPhoto.src) || p.storagePath,
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

    const replacePhotoInSlot = useCallback((pageId: string, slotPhotoId: string, galleryPhoto: Photo) => {
        if (isPageLocked(pageId)) return;

        setAlbumPages(prevPages => {
            return prevPages.map(page => {
                if (page.id !== pageId) return page;

                const nextPhotos = page.photos.map(slotPhoto => {
                    if (slotPhoto.id !== slotPhotoId) return slotPhoto;

                    return {
                        ...galleryPhoto,
                        id: slotPhotoId,
                        originalId: galleryPhoto.id,
                        remoteUrl: galleryPhoto.remoteUrl || galleryPhoto.src,
                        storagePath: galleryPhoto.storagePath || extractSupabaseStoragePath(galleryPhoto.remoteUrl || galleryPhoto.src) || slotPhoto.storagePath,
                        panAndZoom: { scale: 1, x: 50, y: 50 },
                        width: galleryPhoto.width || slotPhoto.width || 800,
                        height: galleryPhoto.height || slotPhoto.height || 600,
                    };
                });

                const gallerySource = galleryPhoto.remoteUrl || galleryPhoto.src;
                const galleryAspectRatio = (galleryPhoto.width && galleryPhoto.height && galleryPhoto.width > 0 && galleryPhoto.height > 0)
                    ? (galleryPhoto.width / galleryPhoto.height)
                    : undefined;
                const nextCoverImages = (page.coverImages || []).map((image) => {
                    if (image.id !== slotPhotoId) return image;

                    return {
                        ...image,
                        url: gallerySource,
                        originalId: galleryPhoto.id,
                        storagePath: galleryPhoto.storagePath || extractSupabaseStoragePath(gallerySource) || image.storagePath,
                        aspectRatio: galleryAspectRatio && galleryAspectRatio > 0 ? galleryAspectRatio : image.aspectRatio,
                        panAndZoom: { scale: 1, x: 50, y: 50 },
                    };
                });

                return {
                    ...page,
                    photos: nextPhotos,
                    coverImages: nextCoverImages,
                };
            });
        });
    }, [isPageLocked, setAlbumPages]);

    return {
        deletePage,
        addSpreadPage,
        movePage,
        updatePageLayout,
        handleRemovePhoto,
        handleUpdateCoverLayout,
        handleUpdateSpreadLayout,
        handleUpdateCoverType,
        handleUpdateSpineText,
        handleUpdateSpineSettings,
        handleUpdateTitleSettings,
        togglePageLock,
        handleUpdatePage,
        updatePhotoPanAndZoom,
        handleDropPhoto,
        handleRemovePhotosFromAlbum,
        replacePhotoId,
        replacePhotoInSlot
    };
}
