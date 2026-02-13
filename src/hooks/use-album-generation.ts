import { useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AlbumPage, Photo } from '@/lib/types';
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
    const {
        templates,
        gridTemplates,
        coverTemplates,
        rawGridTemplates,
        rawCoverTemplates,
        templateClassifications,
        defaultGridTemplate,
        defaultCoverTemplate
    } = useTemplates();
    const { toast } = useToast();

    const singleAndBothClassificationIds = useMemo(() => {
        const ids = new Set<number>();
        templateClassifications.forEach(c => {
            const code = String(c?.code || '').trim().toLowerCase();
            if (code === 'single' || code === 'both') {
                ids.add(Number(c.id));
            }
        });
        return ids;
    }, [templateClassifications]);

    const spreadAndBothClassificationIds = useMemo(() => {
        const ids = new Set<number>();
        templateClassifications.forEach(c => {
            const code = String(c?.code || '').trim().toLowerCase();
            if (code === 'spread' || code === 'both') {
                ids.add(Number(c.id));
            }
        });
        return ids;
    }, [templateClassifications]);

    const isClassificationEligible = useCallback((
        t: { classification_type_id?: number | null },
        target: 'single' | 'spread'
    ) => {
        if (t.classification_type_id != null) {
            const id = Number(t.classification_type_id);
            const allowedIds = target === 'single'
                ? singleAndBothClassificationIds
                : spreadAndBothClassificationIds;
            return allowedIds.has(id);
        }
        return false;
    }, [singleAndBothClassificationIds, spreadAndBothClassificationIds]);

    const getInnerTemplatesPool = useCallback((target: 'single' | 'spread') => {
        const source = templates.length > 0 ? templates : gridTemplates;
        return source.filter(t => isClassificationEligible(t, target));
    }, [templates, gridTemplates, isClassificationEligible]);

    const getCoverTemplatesPool = useCallback(() => {
        const source = coverTemplates.length > 0 ? coverTemplates : rawCoverTemplates;
        return source.filter(t => isClassificationEligible(t, 'spread'));
    }, [coverTemplates, rawCoverTemplates, isClassificationEligible]);

    const pickRandomTemplate = (pool: typeof templates) => {
        if (pool.length === 0) return undefined;
        const index = Math.floor(Math.random() * pool.length);
        return pool[index];
    };

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

        const singleTemplatesPool = getInnerTemplatesPool('single');
        const spreadTemplatesPool = getInnerTemplatesPool('spread');
        const coverSpreadTemplatesPool = getCoverTemplatesPool();

        const defaultSingleTemplate = singleTemplatesPool[0] || defaultGridTemplate || gridTemplates[0] || rawGridTemplates[0];
        const defaultSpreadTemplate = spreadTemplatesPool[0] || defaultGridTemplate || gridTemplates[0] || rawGridTemplates[0];
        const defaultCoverPageTemplate = coverSpreadTemplatesPool[0] || defaultCoverTemplate || coverTemplates[0] || rawCoverTemplates[0];

        const defaultSingleSlots = Math.max(1, getPhotoCount(defaultSingleTemplate));
        const defaultSpreadSlotsPerSide = Math.max(1, getPhotoCount(defaultSpreadTemplate));
        const defaultSingleLayoutId = String(defaultSingleTemplate?.id || defaultGridTemplate?.id || '');
        const defaultSpreadLayoutId = String(defaultSpreadTemplate?.id || defaultGridTemplate?.id || '');
        const defaultCoverLayoutId = String(defaultCoverPageTemplate?.id || defaultCoverTemplate?.id || '');

        const newPages: AlbumPage[] = [
            // Cover page
            {
                id: 'cover',
                type: 'spread',
                photos: [emptyPhoto()],
                layout: defaultCoverType === 'full' ? defaultCoverLayoutId : 'cover',
                isCover: true,
                coverLayouts: { front: defaultCoverLayoutId, back: defaultCoverLayoutId },
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
                photos: Array.from({ length: defaultSingleSlots }, () => emptyPhoto()),
                layout: defaultSingleLayoutId
            },
            // Double spread (empty)
            {
                id: uuidv4(),
                type: 'spread',
                photos: Array.from({ length: defaultSpreadSlotsPerSide * 2 }, () => emptyPhoto()),
                layout: 'spread', // Changed from 2-horizontal to generic spread layout handle if applicable, or dynamic
                spreadMode: defaultCoverType,
                spreadLayouts: { left: defaultSpreadLayoutId, right: defaultSpreadLayoutId }
            },
            // Last single page (left side)
            {
                id: uuidv4(),
                type: 'single',
                photos: Array.from({ length: defaultSingleSlots }, () => emptyPhoto()),
                layout: defaultSingleLayoutId
            }
        ];

        setAlbumPages(newPages);
    }, [
        setAlbumPages,
        settings,
        getInnerTemplatesPool,
        getCoverTemplatesPool,
        defaultGridTemplate,
        defaultCoverTemplate,
        gridTemplates,
        coverTemplates,
        rawGridTemplates,
        rawCoverTemplates
    ]);

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
        const innerSingleTemplatesPool = getInnerTemplatesPool('single');
        const innerSpreadTemplatesPool = getInnerTemplatesPool('spread');
        const coverSpreadTemplatesPool = getCoverTemplatesPool();

        const fallbackSingleTemplate = defaultGridTemplate || gridTemplates[0] || rawGridTemplates[0];
        const fallbackSpreadTemplate = defaultGridTemplate || gridTemplates[0] || rawGridTemplates[0];
        const fallbackCoverTemplate = defaultCoverTemplate || coverTemplates[0] || rawCoverTemplates[0];

        const firstSingleTemplate = pickRandomTemplate(innerSingleTemplatesPool) || fallbackSingleTemplate;
        const firstSingleSlots = Math.max(1, getPhotoCount(firstSingleTemplate));
        const lastSingleTemplate = pickRandomTemplate(innerSingleTemplatesPool) || fallbackSingleTemplate;
        const lastSingleSlots = Math.max(1, getPhotoCount(lastSingleTemplate));

        // --- 1. Randomize Cover Configuration (respecting settings) ---
        let randomCoverType: 'full' | 'split' = 'full';

        if (settings.autoFillLayoutMode === 'auto') {
            const coverTypes: ('full' | 'split')[] = ['full', 'split'];
            randomCoverType = coverTypes[Math.floor(Math.random() * coverTypes.length)];
        } else {
            randomCoverType = settings.autoFillLayoutMode;
        }

        let coverLayoutShim = { front: '', back: '' };
        let fullCoverLayout = '';
        let coverPhotos: Photo[] = [];

        if (randomCoverType === 'split') {
            const frontTemplate = pickRandomTemplate(coverSpreadTemplatesPool) || fallbackCoverTemplate;
            const backTemplate = pickRandomTemplate(coverSpreadTemplatesPool) || fallbackCoverTemplate;

            coverLayoutShim = { front: String(frontTemplate.id), back: String(backTemplate.id) };
            const totalCoverPhotos = getPhotoCount(frontTemplate) + getPhotoCount(backTemplate);

            for (let i = 0; i < totalCoverPhotos; i++) {
                if (photos.length > 0) {
                    const randomIndex = Math.floor(Math.random() * photos.length);
                    const randomPhoto = photos[randomIndex];
                    coverPhotos.push({ ...randomPhoto, id: uuidv4(), originalId: randomPhoto.id, remoteUrl: randomPhoto.remoteUrl, panAndZoom: defaultPanAndZoom });
                } else {
                    coverPhotos.push({
                        id: uuidv4(),
                        src: '',
                        alt: 'Drop photo here',
                        width: 600,
                        height: 400,
                        panAndZoom: defaultPanAndZoom
                    });
                }
            }
        } else {
            const fullTemplate = pickRandomTemplate(coverSpreadTemplatesPool) || fallbackCoverTemplate;
            fullCoverLayout = String(fullTemplate.id);
            const requiredCount = getPhotoCount(fullTemplate);

            for (let i = 0; i < requiredCount; i++) {
                if (photos.length > 0) {
                    const randomIndex = Math.floor(Math.random() * photos.length);
                    const randomPhoto = photos[randomIndex];
                    coverPhotos.push({ ...randomPhoto, id: uuidv4(), originalId: randomPhoto.id, remoteUrl: randomPhoto.remoteUrl, panAndZoom: defaultPanAndZoom });
                } else {
                    coverPhotos.push({
                        id: uuidv4(),
                        src: '',
                        alt: 'Drop photo here',
                        width: 600,
                        height: 400,
                        panAndZoom: defaultPanAndZoom
                    });
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
            const firstPagePhotos = photosPool.splice(0, Math.min(firstSingleSlots, photosPool.length));
            const mappedFirstPagePhotos: Photo[] = firstPagePhotos.map(p => ({
                ...p,
                id: uuidv4(),
                originalId: p.id,
                remoteUrl: p.remoteUrl,
                panAndZoom: defaultPanAndZoom
            }));
            while (mappedFirstPagePhotos.length < firstSingleSlots) {
                mappedFirstPagePhotos.push({
                    id: uuidv4(),
                    src: '',
                    alt: 'Drop photo here',
                    width: 600,
                    height: 400,
                    panAndZoom: defaultPanAndZoom
                });
            }
            newPages.push({
                id: uuidv4(),
                type: 'single',
                photos: mappedFirstPagePhotos,
                layout: String(firstSingleTemplate?.id || defaultGridTemplate?.id || '')
            });
        }

        // --- 3. Reserve photo for Last Single Page ---
        let lastPagePhotos: Photo[] = [];
        if (photosPool.length > 0) {
            const reserveCount = Math.min(lastSingleSlots, photosPool.length);
            lastPagePhotos = photosPool.splice(photosPool.length - reserveCount, reserveCount);
        }

        // --- 4. Inner Spreads ---

        while (photosPool.length > 0) {
            let isSplit = false;
            if (settings.autoFillLayoutMode === 'auto') {
                isSplit = Math.random() > 0.5;
            } else {
                isSplit = settings.autoFillLayoutMode === 'split';
            }

            if (isSplit) {
                const leftTemplate = pickRandomTemplate(innerSpreadTemplatesPool) || fallbackSpreadTemplate;
                const rightTemplate = pickRandomTemplate(innerSpreadTemplatesPool) || fallbackSpreadTemplate;

                const currentTotalNeeded = getPhotoCount(leftTemplate) + getPhotoCount(rightTemplate);
                const pagePhotos = [];
                for (let i = 0; i < currentTotalNeeded; i++) {
                    if (photosPool.length > 0) {
                        const p = photosPool.shift()!;
                        pagePhotos.push({ ...p, id: uuidv4(), originalId: p.id, remoteUrl: p.remoteUrl, panAndZoom: defaultPanAndZoom });
                    } else {
                        pagePhotos.push({ id: uuidv4(), src: '', alt: 'Drop photo here', width: 600, height: 400, panAndZoom: defaultPanAndZoom });
                    }
                }

                newPages.push({
                    id: uuidv4(),
                    type: 'spread',
                    photos: pagePhotos,
                    layout: 'cover', // This is just a placeholder/container layout name? Or does it matter? Usually for split spreads the layout prop on the page itself is less used than spreadLayouts
                    spreadMode: 'split',
                    spreadLayouts: {
                        left: String(leftTemplate.id),
                        right: String(rightTemplate.id)
                    }
                });

            } else {
                // Full Spread
                const selectedTemplate = pickRandomTemplate(innerSpreadTemplatesPool) || fallbackSpreadTemplate;

                const requiredCount = getPhotoCount(selectedTemplate);
                const pagePhotos = [];
                for (let i = 0; i < requiredCount; i++) {
                    if (photosPool.length > 0) {
                        const p = photosPool.shift()!;
                        pagePhotos.push({ ...p, id: uuidv4(), originalId: p.id, remoteUrl: p.remoteUrl, panAndZoom: defaultPanAndZoom });
                    } else {
                        pagePhotos.push({
                            id: uuidv4(),
                            src: '',
                            alt: 'Drop photo here',
                            width: 600,
                            height: 400,
                            panAndZoom: defaultPanAndZoom
                        });
                    }
                }

                newPages.push({
                    id: uuidv4(),
                    type: 'spread',
                    photos: pagePhotos,
                    layout: String(selectedTemplate.id),
                    spreadMode: 'full'
                });
            }
        }

        // --- 5. Last Single Page ---
        if (lastPagePhotos.length > 0) {
            const mappedLastPagePhotos: Photo[] = lastPagePhotos.map(p => ({
                ...p,
                id: uuidv4(),
                originalId: p.id,
                remoteUrl: p.remoteUrl,
                panAndZoom: defaultPanAndZoom
            }));
            while (mappedLastPagePhotos.length < lastSingleSlots) {
                mappedLastPagePhotos.push({
                    id: uuidv4(),
                    src: '',
                    alt: 'Drop photo here',
                    width: 600,
                    height: 400,
                    panAndZoom: defaultPanAndZoom
                });
            }
            newPages.push({
                id: uuidv4(),
                type: 'single',
                photos: mappedLastPagePhotos,
                layout: String(lastSingleTemplate?.id || defaultGridTemplate?.id || '')
            });
        } else if (newPages.length > 1) {
            const firstPagePhoto = newPages[1]?.photos?.[0];
            if (firstPagePhoto) {
                const fallbackLastPhotos: Photo[] = [{
                    ...firstPagePhoto,
                    id: uuidv4(),
                    originalId: firstPagePhoto.originalId || firstPagePhoto.id,
                    panAndZoom: defaultPanAndZoom
                }];
                while (fallbackLastPhotos.length < lastSingleSlots) {
                    fallbackLastPhotos.push({
                        id: uuidv4(),
                        src: '',
                        alt: 'Drop photo here',
                        width: 600,
                        height: 400,
                        panAndZoom: defaultPanAndZoom
                    });
                }
                newPages.push({
                    id: uuidv4(),
                    type: 'single',
                    photos: fallbackLastPhotos,
                    layout: String(lastSingleTemplate?.id || defaultGridTemplate?.id || '')
                });
            }
        }

        setAlbumPages(newPages);
    }, [
        setAlbumPages,
        gridTemplates,
        coverTemplates,
        settings,
        rawGridTemplates,
        rawCoverTemplates,
        defaultGridTemplate,
        defaultCoverTemplate,
        getInnerTemplatesPool,
        getCoverTemplatesPool
    ]);

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
        const innerSingleTemplatesPool = getInnerTemplatesPool('single');
        const innerSpreadTemplatesPool = getInnerTemplatesPool('spread');
        const coverSpreadTemplatesPool = getCoverTemplatesPool();

        const fallbackSingleTemplate = defaultGridTemplate || gridTemplates[0] || rawGridTemplates[0];
        const fallbackSpreadTemplate = defaultGridTemplate || gridTemplates[0] || rawGridTemplates[0];
        const fallbackCoverTemplate = defaultCoverTemplate || coverTemplates[0] || rawCoverTemplates[0];

        const defaultPanAndZoom = { scale: 1, x: 50, y: 50 };
        const createEmptyPhoto = () => ({
            id: uuidv4(),
            src: '',
            alt: 'Drop photo here',
            width: 600,
            height: 400,
            panAndZoom: defaultPanAndZoom
        });
        const newPages = currentPages.map(page => {
            let nextLayout = page.layout;
            let nextSpreadLayouts = page.spreadLayouts;
            let nextCoverLayouts = page.coverLayouts;
            let targetSlots = Math.max(1, page.photos.length);

            if (page.isCover) {
                if (page.coverType === 'split') {
                    const frontTemplate = pickRandomTemplate(coverSpreadTemplatesPool) || fallbackCoverTemplate;
                    const backTemplate = pickRandomTemplate(coverSpreadTemplatesPool) || fallbackCoverTemplate;
                    nextLayout = 'cover';
                    nextCoverLayouts = {
                        front: String(frontTemplate?.id || ''),
                        back: String(backTemplate?.id || '')
                    };
                    targetSlots = Math.max(1, getPhotoCount(frontTemplate)) + Math.max(1, getPhotoCount(backTemplate));
                } else {
                    const coverTemplate = pickRandomTemplate(coverSpreadTemplatesPool) || fallbackCoverTemplate;
                    nextLayout = String(coverTemplate?.id || page.layout || '');
                    targetSlots = Math.max(1, getPhotoCount(coverTemplate));
                }
            } else if (page.type === 'single') {
                const selectedSingleTemplate = pickRandomTemplate(innerSingleTemplatesPool) || fallbackSingleTemplate;
                nextLayout = String(selectedSingleTemplate?.id || page.layout || '');
                targetSlots = Math.max(1, getPhotoCount(selectedSingleTemplate));
            } else if (page.spreadMode === 'split') {
                const leftTemplate = pickRandomTemplate(innerSpreadTemplatesPool) || fallbackSpreadTemplate;
                const rightTemplate = pickRandomTemplate(innerSpreadTemplatesPool) || fallbackSpreadTemplate;
                nextSpreadLayouts = {
                    left: String(leftTemplate?.id || ''),
                    right: String(rightTemplate?.id || '')
                };
                targetSlots = Math.max(1, getPhotoCount(leftTemplate)) + Math.max(1, getPhotoCount(rightTemplate));
            } else {
                const spreadTemplate = pickRandomTemplate(innerSpreadTemplatesPool) || fallbackSpreadTemplate;
                nextLayout = String(spreadTemplate?.id || page.layout || '');
                targetSlots = Math.max(1, getPhotoCount(spreadTemplate));
            }

            const existingPhotos = page.photos || [];
            const newPhotos = Array.from({ length: targetSlots }, (_, index) => {
                const photo = existingPhotos[index] || createEmptyPhoto();
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
                        panAndZoom: defaultPanAndZoom
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
                    panAndZoom: defaultPanAndZoom
                };
            });

            return {
                ...page,
                layout: nextLayout,
                spreadLayouts: nextSpreadLayouts,
                coverLayouts: nextCoverLayouts,
                photos: newPhotos
            };
        });

        setAlbumPages(newPages);
    }, [
        setAlbumPages,
        getInnerTemplatesPool,
        getCoverTemplatesPool,
        defaultGridTemplate,
        defaultCoverTemplate,
        gridTemplates,
        coverTemplates,
        rawGridTemplates,
        rawCoverTemplates
    ]);

    return {
        generateEmptyAlbum,
        extractExifDate,
        generateInitialPages,
        generateDummyPhotos,
        autoFillAlbum
    };
}
