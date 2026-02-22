import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { AlbumPage, Photo, PhotoPanAndZoom } from '@/lib/types';
import { useTemplates, AdvancedTemplate } from '@/hooks/useTemplates';
import { ShapeRegion } from './shape-region';
import { rotateAdvancedTemplate, RotationAngle } from '@/lib/template-rotation';
import { parseLayoutId } from '@/lib/layout-id-utils';
import { SuggestionFan } from '../album-editor/suggestion-fan';
import { generateJustifiedLayout, generateSmartJustifiedLayout } from '@/lib/justified-layout-util';
import { isLikelyBackgroundRegion } from '@/lib/layout-background-region';
import { computeLowerOverlapFlags } from '@/lib/layout-overlap';


export interface PageLayoutProps {
    page: AlbumPage;
    photoGap?: number | string;
    onUpdatePhotoPanAndZoom: (pageId: string, photoId: string, panAndZoom: PhotoPanAndZoom) => void;
    onInteractionChange: (isInteracting: boolean) => void;
    onDropPhoto: (pageId: string, targetPhotoId: string, droppedPhotoId: string, sourceInfo?: { pageId: string; photoId: string }) => void;
    overridePhotos?: Photo[];
    overrideLayout?: string | number;
    templateSource?: AdvancedTemplate[];
    useSimpleImage?: boolean;
    photoIndexOffset?: number;
    onRemovePhoto?: (pageId: string, photoId: string) => void;
    onEnhancePhotoWithAi?: (pageId: string, photoId: string, photo: Photo) => void;
    cornerRadius?: number;
    backgroundColor?: string;
    allPhotos?: Photo[];
    previousPagePhotos?: Photo[];
    priority?: boolean;
    chronologicalIndex?: Record<string, number>;
    aspectRatio?: number;
}

const PageLayoutComponent = ({
    page,
    photoGap,
    onUpdatePhotoPanAndZoom,
    onInteractionChange,
    onDropPhoto,
    overridePhotos,
    overrideLayout,
    templateSource,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    useSimpleImage,
    photoIndexOffset = 0,
    onRemovePhoto,
    onEnhancePhotoWithAi,
    cornerRadius = 0,
    backgroundColor: configBackgroundColor,
    allPhotos = [],
    previousPagePhotos = [],
    priority = false,
    chronologicalIndex,
    aspectRatio
}: PageLayoutProps) => {
    const { templates } = useTemplates();
    const effectiveTemplateSource = templateSource || templates;

    const photos = overridePhotos || page.photos;
    const rawLayout = overrideLayout || page.layout;
    logger.debug('[PageLayout] DEBUG received:', { overrideLayout, 'page.layout': page.layout, rawLayout, photosLength: photos.length });

    // Parse rotation from layout ID
    const { baseId: layout, rotation } = parseLayoutId(rawLayout);

    // Find the template
    let template = effectiveTemplateSource.find(t => String(t.id) === String(layout));

    // Dynamic Layout Generation (Justified)
    if (layout === 'dynamic-justified') {
        // logger.debug('[PageLayout] Generating standard justified layout for', photos.length, 'photos');
        template = generateJustifiedLayout(photos, 2);
    }
    // Dynamic Layout Generation (Smart Justified)
    else if (layout === 'dynamic-justified-smart') {
        logger.debug('[PageLayout] Generating SMART justified layout for', photos.length, 'photos, aspectRatio:', aspectRatio);
        template = generateSmartJustifiedLayout(photos, aspectRatio || 1.5);
    }

    // Fallback to first template if not found
    if (!template) {
        template = effectiveTemplateSource[0];
    }

    // Apply rotation if needed
    if (template && rotation !== 0) {
        template = rotateAdvancedTemplate(template, rotation);
    }

    const [dragOverPhotoId, setDragOverPhotoId] = useState<string | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

    // Suggestion fan state
    const [suggestionAnchor, setSuggestionAnchor] = useState<{ rect: DOMRect; slotIndex: number } | null>(null);

    // Calculate suggestions based on highest photo index on current/previous page
    const getSuggestions = (): Photo[] => {
        if (allPhotos.length === 0) return [];

        const currentPagePhotos = photos.filter(p => p.src);
        const referencePhotos = currentPagePhotos.length > 0 ? currentPagePhotos : previousPagePhotos.filter(p => p.src);

        if (referencePhotos.length === 0) {
            const usedIds = new Set(photos.filter(p => p.src).map(p => p.originalId || p.id));
            return allPhotos.filter(p => !usedIds.has(p.id)).slice(0, 4);
        }

        let highestIndex = -1;
        referencePhotos.forEach(refPhoto => {
            const originalId = refPhoto.originalId || refPhoto.id;
            const idx = allPhotos.findIndex(p => p.id === originalId);
            if (idx > highestIndex) highestIndex = idx;
        });

        const afterPhotos: Photo[] = [];
        const beforePhotos: Photo[] = [];

        for (let i = 1; i <= 4 && highestIndex + i < allPhotos.length; i++) {
            afterPhotos.push(allPhotos[highestIndex + i]);
        }

        for (let i = 1; i <= 4 && highestIndex - i >= 0; i++) {
            beforePhotos.unshift(allPhotos[highestIndex - i]);
        }

        return [...afterPhotos, ...beforePhotos];
    };

    const handleEmptySlotClick = (e: React.MouseEvent, slotIndex: number, anchorElement?: HTMLElement) => {
        e.preventDefault();
        e.stopPropagation();

        const target = anchorElement || (e.currentTarget as HTMLElement);
        const domRect = target.getBoundingClientRect();
        const rect = {
            top: domRect.top,
            left: domRect.left,
            width: domRect.width,
            height: domRect.height,
            bottom: domRect.bottom,
            right: domRect.right,
            x: domRect.x,
            y: domRect.y
        } as DOMRect;

        setSuggestionAnchor({ rect, slotIndex });
    };

    const handleSuggestionSelect = (photo: Photo, slotIndex: number) => {
        const arrayIndex = slotIndex - (photoIndexOffset || 0);
        const targetPhoto = photos[arrayIndex];

        if (targetPhoto && targetPhoto.src) {
            onDropPhoto(page.id, targetPhoto.id, photo.id);
        } else {
            onDropPhoto(page.id, `__INSERT_AT__${slotIndex}`, photo.id);
        }
        setSuggestionAnchor(null);
    };

    // Measure container for pixel-perfect positioning
    React.useEffect(() => {
        if (!containerRef.current) return;

        const measure = () => {
            if (containerRef.current) {
                const { width, height } = containerRef.current.getBoundingClientRect();
                setContainerSize({ width, height });
            }
        };

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(containerRef.current);

        return () => observer.disconnect();
    }, []);

    // Ensure gap is formatted correctly
    const gapValueNum = typeof photoGap === 'number' ? photoGap : parseInt(String(photoGap || 0), 10) || 0;
    const templateImageRotationMode = template?._imageRotationMode || 'follow-frame';

    // Sort regions by zIndex
    const sortedRegions = template?.regions ? [...template.regions].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)) : [];
    const overlapWithLowerFlags = computeLowerOverlapFlags(sortedRegions);
    const { width: W, height: H } = containerSize;

    return (
        <div
            ref={containerRef}
            className={cn("w-full h-full relative")}
        >
            {/* Render regions when we have dimensions */}
            {W > 0 && H > 0 && sortedRegions.map((region, index) => {
                const photo = photos[index];
                const actualIndex = index + photoIndexOffset;
                const regionImageMode = isLikelyBackgroundRegion(region, sortedRegions)
                    ? 'keep-horizontal'
                    : templateImageRotationMode;

                return (
                    <ShapeRegion
                        key={region.id || index}
                        region={region}
                        photo={photo}
                        photoGap={gapValueNum}
                        backgroundColor={page.backgroundColor || configBackgroundColor || 'transparent'}
                        containerWidth={W}
                        containerHeight={H}
                        onUpdatePanAndZoom={(panAndZoom: PhotoPanAndZoom) => {
                            if (photo?.id) {
                                onUpdatePhotoPanAndZoom(page.id, photo.id, panAndZoom);
                            }
                        }}
                        onInteractionChange={onInteractionChange}
                        onDrop={(e) => {
                            setDragOverPhotoId(null);
                            const albumPhotoId = e.dataTransfer.getData('albumPhotoId');
                            const sourcePageId = e.dataTransfer.getData('sourcePageId');

                            if (albumPhotoId && sourcePageId) {
                                if (photo?.id && albumPhotoId !== photo.id) {
                                    onDropPhoto(page.id, photo.id, albumPhotoId, { pageId: sourcePageId, photoId: albumPhotoId });
                                }
                            } else {
                                const selectedPhotoIds = e.dataTransfer.getData('selectedPhotoIds');
                                if (selectedPhotoIds) {
                                    onDropPhoto(page.id, '__REPLACE_ALL__', selectedPhotoIds);
                                    return;
                                }

                                const droppedPhotoId = e.dataTransfer.getData('photoId');
                                const targetId = photo?.id || `__INSERT_AT__${actualIndex}`;
                                if (droppedPhotoId) {
                                    onDropPhoto(page.id, targetId, droppedPhotoId);
                                }
                            }
                        }}
                        onDragOver={() => setDragOverPhotoId(photo?.id || `__empty_${actualIndex}`)}
                        onDragLeave={() => setDragOverPhotoId(null)}
                        isDragOver={dragOverPhotoId === (photo?.id || `__empty_${actualIndex}`)}
                        onRemovePhoto={(photoId) => onRemovePhoto?.(page.id, photoId)}
                        onReplace={(e, anchor) => handleEmptySlotClick(e, actualIndex, anchor)}
                        onEnhanceWithAi={onEnhancePhotoWithAi}
                        pageId={page.id}
                        cornerRadius={cornerRadius}
                        imageRotationMode={regionImageMode}
                        forceGapStroke={overlapWithLowerFlags[index]}
                        priority={priority}
                        chronologicalIndex={chronologicalIndex}
                    />
                );
            })}

            {/* Suggestion Fan Portal */}
            {suggestionAnchor && (
                <SuggestionFan
                    key={`fan-${suggestionAnchor.slotIndex}`}
                    suggestions={getSuggestions()}
                    onSelect={(photo) => handleSuggestionSelect(photo, suggestionAnchor.slotIndex)}
                    onClose={() => setSuggestionAnchor(null)}
                    anchorRect={suggestionAnchor.rect}
                />
            )}
        </div>
    );
};

export const PageLayout = React.memo(PageLayoutComponent, (prev, next) => {
    // Custom Equality Check
    if (prev.photoGap !== next.photoGap) return false;
    if (prev.cornerRadius !== next.cornerRadius) return false;
    if (prev.overrideLayout !== next.overrideLayout) return false;
    if (prev.page.layout !== next.page.layout) return false;
    if (prev.page.id !== next.page.id) return false;
    if (prev.priority !== next.priority) return false;
    if (prev.onDropPhoto !== next.onDropPhoto) return false;
    if (prev.onEnhancePhotoWithAi !== next.onEnhancePhotoWithAi) return false;
    if (prev.allPhotos !== next.allPhotos) return false;
    if (prev.previousPagePhotos !== next.previousPagePhotos) return false;
    if (prev.chronologicalIndex !== next.chronologicalIndex) return false;

    const prevPhotos = prev.overridePhotos || prev.page.photos;
    const nextPhotos = next.overridePhotos || next.page.photos;

    if (prevPhotos.length !== nextPhotos.length) return false;

    for (let i = 0; i < prevPhotos.length; i++) {
        if (prevPhotos[i].id !== nextPhotos[i].id) return false;
        if (prevPhotos[i].panAndZoom !== nextPhotos[i].panAndZoom) return false;
        if (prevPhotos[i].src !== nextPhotos[i].src) return false;
    }

    return true;
});
