import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AlbumPage, Photo, AlbumConfig } from '@/lib/types';
import { LAYOUT_TEMPLATES, COVER_TEMPLATES } from '@/components/album/layout-templates';
import { useToast } from '@/hooks/use-toast';

interface UseAlbumGenerationProps {
    setAlbumPages: (pages: AlbumPage[]) => void;
    setAllPhotos: (photos: Photo[]) => void;
    setIsLoadingPhotos: (isLoading: boolean) => void;
    randomSeed: string;
}

export function useAlbumGeneration({
    setAlbumPages,
    setAllPhotos,
    setIsLoadingPhotos,
    randomSeed
}: UseAlbumGenerationProps) {
    const { toast } = useToast();

    const generateEmptyAlbum = useCallback(() => {
        const emptyPhoto = (id?: string) => ({
            id: id || uuidv4(),
            src: '',
            alt: 'Drop photo here',
            width: 600,
            height: 400,
            panAndZoom: { scale: 1, x: 50, y: 50 }
        });

        const newPages: AlbumPage[] = [
            // Cover page
            {
                id: 'cover',
                type: 'spread',
                photos: [emptyPhoto()],
                layout: '1-full',
                isCover: true,
                coverLayouts: { front: '1-full', back: '1-full' },
                coverType: 'full',
                spineText: '',
                spineWidth: 20,
                spineColor: '#ffffff',
                spineTextColor: '#000000',
                spineFontFamily: 'Tahoma'
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
                spreadMode: 'split',
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

        // --- 1. Randomize Cover Configuration ---
        const coverTypes: ('full' | 'split')[] = ['full', 'split'];
        const randomCoverType = coverTypes[Math.floor(Math.random() * coverTypes.length)];

        let coverLayoutShim = { front: '4-mosaic-1', back: '4-mosaic-1' };
        let fullCoverLayout = '1-full';
        let coverPhotos: Photo[] = [];

        if (randomCoverType === 'split') {
            const frontTemplate = COVER_TEMPLATES[Math.floor(Math.random() * COVER_TEMPLATES.length)];
            const backTemplate = COVER_TEMPLATES[Math.floor(Math.random() * COVER_TEMPLATES.length)];

            coverLayoutShim = { front: frontTemplate.id, back: backTemplate.id };
            const totalCoverPhotos = frontTemplate.photoCount + backTemplate.photoCount;

            for (let i = 0; i < totalCoverPhotos; i++) {
                if (photos.length > 0) {
                    const randomIndex = Math.floor(Math.random() * photos.length);
                    const randomPhoto = photos[randomIndex];
                    coverPhotos.push({ ...randomPhoto, id: uuidv4(), originalId: randomPhoto.id, remoteUrl: randomPhoto.remoteUrl, panAndZoom: defaultPanAndZoom });
                }
            }
        } else {
            const fullTemplate = COVER_TEMPLATES[Math.floor(Math.random() * COVER_TEMPLATES.length)];
            fullCoverLayout = fullTemplate.id;

            for (let i = 0; i < fullTemplate.photoCount; i++) {
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
            spineText: '',
            spineWidth: 20,
            spineColor: '#ffffff',
            spineTextColor: '#000000',
            spineFontFamily: 'Tahoma'
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
        while (photosPool.length > 0) {
            const isSplit = Math.random() > 0.5;

            if (isSplit) {
                let leftTemplate = LAYOUT_TEMPLATES[Math.floor(Math.random() * LAYOUT_TEMPLATES.length)];
                let rightTemplate = LAYOUT_TEMPLATES[Math.floor(Math.random() * LAYOUT_TEMPLATES.length)];
                const totalNeeded = leftTemplate.photoCount + rightTemplate.photoCount;

                if (photosPool.length < totalNeeded) {
                    if (photosPool.length >= 2) {
                        leftTemplate = LAYOUT_TEMPLATES.find(t => t.photoCount === 1) || LAYOUT_TEMPLATES[0];
                        rightTemplate = LAYOUT_TEMPLATES.find(t => t.photoCount === 1) || LAYOUT_TEMPLATES[0];
                    } else {
                        leftTemplate = LAYOUT_TEMPLATES.find(t => t.photoCount === 1) || LAYOUT_TEMPLATES[0];
                        rightTemplate = LAYOUT_TEMPLATES[0];
                        const fallbackTemplate = LAYOUT_TEMPLATES.find(t => t.photoCount === photosPool.length) || LAYOUT_TEMPLATES.find(t => t.photoCount === 1) || LAYOUT_TEMPLATES[0];
                        const pagePhotos = photosPool.splice(0, fallbackTemplate.photoCount);
                        newPages.push({
                            id: uuidv4(),
                            type: 'spread',
                            photos: pagePhotos.map(p => ({ ...p, id: uuidv4(), originalId: p.id, remoteUrl: p.remoteUrl, panAndZoom: defaultPanAndZoom })),
                            layout: fallbackTemplate.id,
                            spreadMode: 'full'
                        });
                        continue;
                    }
                }

                const leftPhotosCount = leftTemplate.photoCount;
                const rightPhotosCount = rightTemplate.photoCount;

                if (photosPool.length >= leftPhotosCount + rightPhotosCount) {
                    const pagePhotos = photosPool.splice(0, leftPhotosCount + rightPhotosCount);
                    newPages.push({
                        id: uuidv4(),
                        type: 'spread',
                        photos: pagePhotos.map(p => ({ ...p, id: uuidv4(), originalId: p.id, remoteUrl: p.remoteUrl, panAndZoom: defaultPanAndZoom })),
                        layout: '4-grid',
                        spreadMode: 'split',
                        spreadLayouts: {
                            left: leftTemplate.id,
                            right: rightTemplate.id
                        }
                    });
                } else {
                    const fallbackTemplate = LAYOUT_TEMPLATES.find(t => t.photoCount === 1) || LAYOUT_TEMPLATES[0];
                    const pagePhotos = photosPool.splice(0, Math.min(photosPool.length, fallbackTemplate.photoCount));
                    newPages.push({
                        id: uuidv4(),
                        type: 'spread',
                        photos: pagePhotos.map(p => ({ ...p, id: uuidv4(), originalId: p.id, remoteUrl: p.remoteUrl, panAndZoom: defaultPanAndZoom })),
                        layout: fallbackTemplate.id,
                        spreadMode: 'full'
                    });
                }

            } else {
                let selectedTemplate = LAYOUT_TEMPLATES[Math.floor(Math.random() * LAYOUT_TEMPLATES.length)];
                if (photosPool.length < selectedTemplate.photoCount) {
                    const exactFit = LAYOUT_TEMPLATES.find(t => t.photoCount === photosPool.length);
                    if (exactFit) {
                        selectedTemplate = exactFit;
                    } else {
                        selectedTemplate = LAYOUT_TEMPLATES.find(t => t.photoCount === 1)!;
                    }
                }

                const pagePhotos = photosPool.splice(0, selectedTemplate.photoCount);

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
    }, [setAlbumPages]);

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

    return {
        generateEmptyAlbum,
        extractExifDate,
        generateInitialPages,
        generateDummyPhotos
    };
}
