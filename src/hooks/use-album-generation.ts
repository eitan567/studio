import { useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AlbumPage, Photo, AlbumConfig } from '@/lib/types';
import { logger } from '@/lib/logger';
import { getPhotoCount, useTemplates } from '@/hooks/useTemplates';
import { useToast } from '@/hooks/use-toast';
import { UserSettings } from '@/hooks/use-settings';

interface UseAlbumGenerationProps {
    setAlbumPages: (pages: AlbumPage[]) => void;
    setAllPhotos: (photos: Photo[]) => void;
    setIsLoadingPhotos: (isLoading: boolean) => void;
    randomSeed: string;
    settings: UserSettings;
}

export function useAlbumGeneration({
    setAlbumPages,
    setAllPhotos,
    setIsLoadingPhotos,
    randomSeed,
    settings
}: UseAlbumGenerationProps) {
    const { gridTemplates, coverTemplates, rawGridTemplates, rawCoverTemplates } = useTemplates();
    const { toast } = useToast();

    // Use settings directly from props
    const generateEmptyAlbum = useCallback(() => {
        logger.info('Using settings for empty album:', {
            spineWidth: settings.defaultSpineWidth,
            spineOpacity: settings.defaultSpineOpacity,
            photoGap: settings.defaultPhotoGap,
            pageMargin: settings.defaultPageMargin
        });

        const emptyPhoto = (id?: string) => ({
            id: id || uuidv4(),
            src: '',
            alt: 'Drop photo here',
            width: 600,
            height: 400,
            panAndZoom: { scale: 1, x: 50, y: 50 }
        });

        // Determine default cover type
        const defaultCoverType: 'full' | 'split' = settings.autoFillLayoutMode === 'split' ? 'split' : 'full';

        const newPages: AlbumPage[] = [
            // Cover page
            {
                id: 'cover',
                type: 'spread',
                photos: [emptyPhoto()],
                layout: defaultCoverType === 'full' ? '1-full' : 'cover',
                isCover: true,
                coverLayouts: { front: '1-full', back: '1-full' },
                coverType: defaultCoverType,
                spineText: settings.defaultSpineText,
                spineWidth: settings.defaultSpineWidth,
                spineColor: settings.defaultSpineColor,
                spineOpacity: settings.defaultSpineOpacity,
                spineTextColor: settings.defaultSpineTextColor,
                spineFontFamily: settings.defaultSpineFontFamily,
                spineFontSize: settings.defaultSpineFontSize,
                spineFontWeight: settings.defaultSpineFontWeight,
                spineFontStyle: settings.defaultSpineFontStyle,
                spineTextAlign: settings.defaultSpineTextAlign
            },
            // First single page (right side)
            {
                id: uuidv4(),
                type: 'single',
                photos: [emptyPhoto()],
                layout: '1-full'
            },
            // Double spread (empty)
            {
                id: uuidv4(),
                type: 'spread',
                photos: [emptyPhoto(), emptyPhoto()],
                layout: '2-horizontal',
                spreadMode: defaultCoverType,
                spreadLayouts: { left: '1-full', right: '1-full' }
            },
            // Last single page (left side)
            {
                id: uuidv4(),
                type: 'single',
                photos: [emptyPhoto()],
                layout: '1-full'
            }
        ];

        setAlbumPages(newPages);
    }, [setAlbumPages]);

    const extractExifDate = useCallback((arrayBuffer: ArrayBuffer): Date | undefined => {
        try {
            const view = new DataView(arrayBuffer);
            if (view.getUint16(0) !== 0xFFD8) return undefined;

            let offset = 2;
            while (offset < view.byteLength - 2) {
                const marker = view.getUint16(offset);
                offset += 2;

                if (marker === 0xFFE1) {
                    const length = view.getUint16(offset);
                    offset += 2;

                    const exifHeader = String.fromCharCode(
                        view.getUint8(offset), view.getUint8(offset + 1),
                        view.getUint8(offset + 2), view.getUint8(offset + 3)
                    );
                    if (exifHeader !== 'Exif') return undefined;

                    const tiffOffset = offset + 6;
                    const littleEndian = view.getUint16(tiffOffset) === 0x4949;
                    const ifd0Offset = tiffOffset + view.getUint32(tiffOffset + 4, littleEndian);
                    const ifd0Count = view.getUint16(ifd0Offset, littleEndian);
                    let exifIfdOffset = 0;

                    for (let i = 0; i < ifd0Count; i++) {
                        const entryOffset = ifd0Offset + 2 + i * 12;
                        const tag = view.getUint16(entryOffset, littleEndian);
                        if (tag === 0x8769) {
                            exifIfdOffset = tiffOffset + view.getUint32(entryOffset + 8, littleEndian);
                            break;
                        }
                    }

                    if (exifIfdOffset) {
                        const exifCount = view.getUint16(exifIfdOffset, littleEndian);
                        for (let i = 0; i < exifCount; i++) {
                            const entryOffset = exifIfdOffset + 2 + i * 12;
                            const tag = view.getUint16(entryOffset, littleEndian);
                            if (tag === 0x9003 || tag === 0x9004) {
                                const valueOffset = tiffOffset + view.getUint32(entryOffset + 8, littleEndian);
                                let dateStr = '';
                                for (let j = 0; j < 19; j++) {
                                    dateStr += String.fromCharCode(view.getUint8(valueOffset + j));
                                }
                                const [datePart, timePart] = dateStr.split(' ');
                                const [year, month, day] = datePart.split(':').map(Number);
                                const [hour, min, sec] = timePart.split(':').map(Number);
                                return new Date(year, month - 1, day, hour, min, sec);
                            }
                        }
                    }
                    return undefined;
                } else if ((marker & 0xFF00) === 0xFF00) {
                    offset += view.getUint16(offset);
                } else {
                    break;
                }
            }
        } catch {
            return undefined;
        }
        return undefined;
    }, []);

    const generateInitialPages = useCallback((photos: Photo[]) => {
        let photosPool = [...photos];
        const newPages: AlbumPage[] = [];
        const defaultPanAndZoom = { scale: 1, x: 50, y: 50 };

        // --- 1. Randomize Cover Configuration (respecting settings) ---
        let randomCoverType: 'full' | 'split' = 'full';

        if (settings.autoFillLayoutMode === 'auto') {
            const coverTypes: ('full' | 'split')[] = ['full', 'split'];
            randomCoverType = coverTypes[Math.floor(Math.random() * coverTypes.length)];
        } else {
            randomCoverType = settings.autoFillLayoutMode;
        }

        let coverLayoutShim = { front: '4-mosaic-1', back: '4-mosaic-1' };
        let fullCoverLayout = '1-full';
        let coverPhotos: Photo[] = [];

        // Filter templates based on max photos setting
        const maxPhotos = settings.autoFillMaxPhotosPerPage;
        const validCoverTemplates = maxPhotos > 0
            ? coverTemplates.filter(t => getPhotoCount(t) <= maxPhotos)
            : coverTemplates;

        // Fallback if no templates match filter - use raw templates to ensure we ALWAYs have something
        const availableCoverTemplates = validCoverTemplates.length > 0 ? validCoverTemplates : rawCoverTemplates;

        if (randomCoverType === 'split') {
            const frontTemplate = availableCoverTemplates[Math.floor(Math.random() * availableCoverTemplates.length)];
            const backTemplate = availableCoverTemplates[Math.floor(Math.random() * availableCoverTemplates.length)];

            coverLayoutShim = { front: frontTemplate.id, back: backTemplate.id };
            const totalCoverPhotos = getPhotoCount(frontTemplate) + getPhotoCount(backTemplate);

            for (let i = 0; i < totalCoverPhotos; i++) {
                if (photos.length > 0) {
                    const randomIndex = Math.floor(Math.random() * photos.length);
                    const randomPhoto = photos[randomIndex];
                    coverPhotos.push({ ...randomPhoto, id: uuidv4(), originalId: randomPhoto.id, remoteUrl: randomPhoto.remoteUrl, panAndZoom: defaultPanAndZoom });
                }
            }
        } else {
            const fullTemplate = availableCoverTemplates[Math.floor(Math.random() * availableCoverTemplates.length)];
            fullCoverLayout = fullTemplate.id;

            for (let i = 0; i < getPhotoCount(fullTemplate); i++) {
                if (photos.length > 0) {
                    const randomIndex = Math.floor(Math.random() * photos.length);
                    const randomPhoto = photos[randomIndex];
                    coverPhotos.push({ ...randomPhoto, id: uuidv4(), originalId: randomPhoto.id, remoteUrl: randomPhoto.remoteUrl, panAndZoom: defaultPanAndZoom });
                }
            }
        }

        newPages.push({
            id: 'cover',
            type: 'spread',
            photos: coverPhotos,
            layout: randomCoverType === 'full' ? fullCoverLayout : 'cover',
            isCover: true,
            coverLayouts: coverLayoutShim,
            coverType: randomCoverType,
            spineText: settings.defaultSpineText,
            spineWidth: settings.defaultSpineWidth,
            spineColor: settings.defaultSpineColor,
            spineOpacity: settings.defaultSpineOpacity,
            spineTextColor: settings.defaultSpineTextColor,
            spineFontFamily: settings.defaultSpineFontFamily,
            spineFontSize: settings.defaultSpineFontSize,
            spineFontWeight: settings.defaultSpineFontWeight,
            spineFontStyle: settings.defaultSpineFontStyle,
            spineTextAlign: settings.defaultSpineTextAlign
        });

        // --- 2. Randomize Inner Pages ---
        if (photosPool.length > 0) {
            const firstPagePhotos = photosPool.splice(0, 1);
            newPages.push({
                id: uuidv4(),
                type: 'single',
                photos: firstPagePhotos.map(p => ({ ...p, id: uuidv4(), originalId: p.id, remoteUrl: p.remoteUrl, panAndZoom: defaultPanAndZoom })),
                layout: '1-full'
            });
        }

        // --- 3. Reserve photo for Last Single Page ---
        let lastPagePhoto: typeof photosPool[0] | null = null;
        if (photosPool.length > 0) {
            lastPagePhoto = photosPool.pop()!;
        }

        // --- 4. Inner Spreads ---

        // Filter grid templates based on max photos
        const validGridTemplates = maxPhotos > 0
            ? gridTemplates.filter(t => getPhotoCount(t) <= maxPhotos)
            : gridTemplates;
        // Ensure at least one template exists (fallback to default/all if strict filtering leaves none)
        const availableGridTemplates = validGridTemplates.length > 0 ? validGridTemplates : rawGridTemplates;

        while (photosPool.length > 0) {
            let isSplit = false;
            if (settings.autoFillLayoutMode === 'auto') {
                isSplit = Math.random() > 0.5;
            } else {
                isSplit = settings.autoFillLayoutMode === 'split';
            }

            if (isSplit) {
                let leftTemplate = availableGridTemplates[Math.floor(Math.random() * availableGridTemplates.length)];
                let rightTemplate = availableGridTemplates[Math.floor(Math.random() * availableGridTemplates.length)];

                // Smart matching logic could go here (comparing aspect ratios)

                const totalNeeded = getPhotoCount(leftTemplate) + getPhotoCount(rightTemplate);

                if (photosPool.length < totalNeeded) {
                    if (photosPool.length >= 2) {
                        leftTemplate = availableGridTemplates.find(t => getPhotoCount(t) === 1) || availableGridTemplates[0];
                        rightTemplate = availableGridTemplates.find(t => getPhotoCount(t) === 1) || availableGridTemplates[0];
                    } else {
                        // Fallback to single page or spread with 1 photo if we only have 1 left
                        leftTemplate = availableGridTemplates.find(t => getPhotoCount(t) === 1) || availableGridTemplates[0];
                        rightTemplate = availableGridTemplates[0]; // Empty or default

                        // Actually, if only 1 photo left, we might just want a full spread or single page?
                        // But logic here was "try to make a split spread". 
                        // Let's use a simpler fallback: just make a spread with whatever fits
                        const fallbackTemplate = availableGridTemplates.find(t => getPhotoCount(t) === photosPool.length) || availableGridTemplates[0];
                        const pagePhotos = photosPool.splice(0, Math.min(photosPool.length, getPhotoCount(fallbackTemplate)));

                        newPages.push({
                            id: uuidv4(),
                            type: 'spread',
                            photos: pagePhotos.map(p => ({ ...p, id: uuidv4(), originalId: p.id, remoteUrl: p.remoteUrl, panAndZoom: defaultPanAndZoom })),
                            layout: fallbackTemplate.id,
                            spreadMode: 'full' // Fallback to full if we can't make a nice split
                        });
                        continue;
                    }
                }

                const leftPhotosCount = getPhotoCount(leftTemplate);
                const rightPhotosCount = getPhotoCount(rightTemplate);

                if (photosPool.length >= leftPhotosCount + rightPhotosCount) {
                    const pagePhotos = photosPool.splice(0, leftPhotosCount + rightPhotosCount);
                    newPages.push({
                        id: uuidv4(),
                        type: 'spread',
                        photos: pagePhotos.map(p => ({ ...p, id: uuidv4(), originalId: p.id, remoteUrl: p.remoteUrl, panAndZoom: defaultPanAndZoom })),
                        layout: '4-grid', // This is just a placeholder/container layout name? Or does it matter? Usually for split spreads the layout prop on the page itself is less used than spreadLayouts
                        spreadMode: 'split',
                        spreadLayouts: {
                            left: leftTemplate.id,
                            right: rightTemplate.id
                        }
                    });
                } else {
                    // Not enough photos for selected split templates
                    const fallbackTemplate = availableGridTemplates.find(t => getPhotoCount(t) === 1) || availableGridTemplates[0];
                    const pagePhotos = photosPool.splice(0, Math.min(photosPool.length, getPhotoCount(fallbackTemplate)));
                    newPages.push({
                        id: uuidv4(),
                        type: 'spread',
                        photos: pagePhotos.map(p => ({ ...p, id: uuidv4(), originalId: p.id, remoteUrl: p.remoteUrl, panAndZoom: defaultPanAndZoom })),
                        layout: fallbackTemplate.id,
                        spreadMode: 'full'
                    });
                }

            } else {
                // Full Spread
                let selectedTemplate = availableGridTemplates[Math.floor(Math.random() * availableGridTemplates.length)];

                // Try to find exact fit if we are running low on photos
                if (photosPool.length < getPhotoCount(selectedTemplate)) {
                    const exactFit = availableGridTemplates.find(t => getPhotoCount(t) === photosPool.length);
                    if (exactFit) {
                        selectedTemplate = exactFit;
                    } else {
                        // If no exact fit, find smallest
                        selectedTemplate = availableGridTemplates.find(t => getPhotoCount(t) === 1) || availableGridTemplates[0];
                    }
                }

                const pagePhotos = photosPool.splice(0, Math.min(photosPool.length, getPhotoCount(selectedTemplate)));

                newPages.push({
                    id: uuidv4(),
                    type: 'spread',
                    photos: pagePhotos.map(p => ({ ...p, id: uuidv4(), originalId: p.id, remoteUrl: p.remoteUrl, panAndZoom: defaultPanAndZoom })),
                    layout: selectedTemplate.id,
                    spreadMode: 'full'
                });
            }
        }

        // --- 5. Last Single Page ---
        if (lastPagePhoto) {
            newPages.push({
                id: uuidv4(),
                type: 'single',
                photos: [{ ...lastPagePhoto, id: uuidv4(), originalId: lastPagePhoto.id, remoteUrl: lastPagePhoto.remoteUrl, panAndZoom: defaultPanAndZoom }],
                layout: '1-full'
            });
        } else if (newPages.length > 1) {
            const firstPagePhoto = newPages[1]?.photos?.[0];
            if (firstPagePhoto) {
                newPages.push({
                    id: uuidv4(),
                    type: 'single',
                    photos: [{ ...firstPagePhoto, id: uuidv4(), originalId: firstPagePhoto.originalId || firstPagePhoto.id, panAndZoom: defaultPanAndZoom }],
                    layout: '1-full'
                });
            }
        }

        setAlbumPages(newPages);
    }, [setAlbumPages, gridTemplates, coverTemplates, settings, rawGridTemplates, rawCoverTemplates]);

    const generateDummyPhotos = useCallback(() => {
        if (!randomSeed) {
            toast({
                title: 'Please wait',
                description: 'Component is initializing.',
                variant: 'destructive'
            });
            return;
        }
        setIsLoadingPhotos(true);
        toast({
            title: 'Generating Dummy Photos',
            description: 'Please wait while we create 100 sample images with various aspect ratios.',
        });
        setTimeout(() => {
            const dimensions = [
                { w: 1200, h: 800 },
                { w: 800, h: 1200 },
                { w: 1000, h: 1000 },
                { w: 1600, h: 900 },
                { w: 900, h: 1600 }
            ];

            const dummyPhotos: Photo[] = Array.from({ length: 100 }, (_, i) => {
                const seed = `${randomSeed}-${i}`;
                const dim = dimensions[i % dimensions.length];
                return {
                    id: `dummy-${seed}-${i}`,
                    src: `https://picsum.photos/seed/${seed}/${dim.w}/${dim.h}`,
                    alt: `Dummy photo ${i + 1}`,
                    width: dim.w,
                    height: dim.h,
                };
            });

            const preloadImage = (src: string) => {
                return new Promise((resolve) => {
                    const img = new window.Image();
                    img.src = src;
                    // @ts-ignore
                    img.onload = resolve;
                    // @ts-ignore
                    img.onerror = resolve;
                });
            };

            Promise.all(dummyPhotos.map(photo => preloadImage(photo.src)))
                .then(() => {
                    setAllPhotos(dummyPhotos);
                    setIsLoadingPhotos(false);
                    toast({
                        title: 'Photos Loaded',
                        description: '100 sample photos have been loaded to the gallery.',
                    });
                });
        }, 1500);
    }, [randomSeed, setIsLoadingPhotos, setAllPhotos, toast]);

    const autoFillAlbum = useCallback((currentPages: AlbumPage[], photos: Photo[]) => {
        let photoIndex = 0;
        const newPages = currentPages.map(page => {
            const newPhotos = page.photos.map(photo => {
                // If we have photos left to assign
                if (photoIndex < photos.length) {
                    const nextPhoto = photos[photoIndex];
                    photoIndex++;
                    return {
                        ...photo,
                        id: uuidv4(), // New ID for the slot to ensure uniqueness
                        originalId: nextPhoto.id,
                        src: nextPhoto.src,
                        alt: nextPhoto.alt,
                        width: nextPhoto.width,
                        height: nextPhoto.height,
                        // Preserve existing pan/zoom or reset? Usually reset for new photo
                        panAndZoom: { scale: 1, x: 50, y: 50 }
                    };
                }
                // If ran out of photos, clear the slot
                return {
                    ...photo,
                    id: uuidv4(),
                    originalId: undefined,
                    src: '',
                    alt: 'Drop photo here',
                    width: 600,
                    height: 400,
                    panAndZoom: { scale: 1, x: 50, y: 50 }
                };
            });

            return {
                ...page,
                photos: newPhotos
            };
        });

        setAlbumPages(newPages);
    }, [setAlbumPages, settings]);

    return {
        generateEmptyAlbum,
        extractExifDate,
        generateInitialPages,
        generateDummyPhotos,
        autoFillAlbum
    };
}
