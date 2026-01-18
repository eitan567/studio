import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { AlbumPage, Photo, PhotoPanAndZoom } from '@/lib/types';
import { LAYOUT_TEMPLATES } from './layout-templates';
import { PhotoRenderer } from './photo-renderer';
import { EmptyPhotoSlot } from './empty-photo-slot';
import { ADVANCED_TEMPLATES } from '@/lib/advanced-layout-types';
import { ShapeRegion } from './shape-region';
import { rotateGridTemplate, rotateAdvancedTemplate, RotationAngle } from '@/lib/template-rotation';
import { SuggestionFan } from './suggestion-fan';

// Parse layout ID to extract base template and rotation
function parseLayoutId(layoutId: string): { baseId: string; rotation: RotationAngle } {
    const rotationMatch = layoutId.match(/_r(90|180|270)$/);
    if (rotationMatch) {
        const rotation = parseInt(rotationMatch[1]) as RotationAngle;
        const baseId = layoutId.replace(/_r(90|180|270)$/, '');
        return { baseId, rotation };
    }
    return { baseId: layoutId, rotation: 0 };
}

export interface PageLayoutProps {
    page: AlbumPage;
    photoGap?: number | string;
    onUpdatePhotoPanAndZoom: (pageId: string, photoId: string, panAndZoom: PhotoPanAndZoom) => void;
    onInteractionChange: (isInteracting: boolean) => void;
    onDropPhoto: (pageId: string, targetPhotoId: string, droppedPhotoId: string, sourceInfo?: { pageId: string; photoId: string }) => void;
    overridePhotos?: Photo[];
    overrideLayout?: string;
    templateSource?: typeof LAYOUT_TEMPLATES;
    useSimpleImage?: boolean;
    photoIndexOffset?: number;
    onRemovePhoto?: (pageId: string, photoId: string) => void;
    cornerRadius?: number;
    // Background color for gap strokes (from album config)
    backgroundColor?: string;
    // For suggestion fan feature
    allPhotos?: Photo[];
    previousPagePhotos?: Photo[];
}

const PageLayoutComponent = ({
    page,
    photoGap,
    onUpdatePhotoPanAndZoom,
    onInteractionChange,
    onDropPhoto,
    overridePhotos,
    overrideLayout,
    templateSource = LAYOUT_TEMPLATES,
    useSimpleImage,
    photoIndexOffset = 0,
    onRemovePhoto,
    cornerRadius = 0,
    backgroundColor: configBackgroundColor,
    allPhotos = [],
    previousPagePhotos = []
}: PageLayoutProps) => {
    const photos = overridePhotos || page.photos;
    const rawLayout = overrideLayout || page.layout;

    // Parse rotation from layout ID
    const { baseId: layout, rotation } = parseLayoutId(rawLayout);
    // console.log('[PageLayout] Rendering with:', { rawLayout, layout, rotation, cornerRadius });

    // Check for templates in both sources using the BASE layout ID
    // First, try to find in templateSource (which may include both grid and advanced templates)
    const foundTemplate = templateSource.find(t => t.id === layout);

    // Determine if it's a grid template (has 'grid' property) or advanced template (has 'regions' property)
    const isGridTemplate = foundTemplate && 'grid' in foundTemplate;
    const isAdvancedTemplate = foundTemplate && 'regions' in foundTemplate;

    // If not found in templateSource, also check ADVANCED_TEMPLATES directly
    let advancedTemplate = isAdvancedTemplate
        ? foundTemplate as any // Found in templateSource as advanced
        : (!foundTemplate ? ADVANCED_TEMPLATES.find(t => t.id === layout) : null);

    // Apply rotation to advanced template if needed
    if (advancedTemplate && rotation !== 0) {
        advancedTemplate = rotateAdvancedTemplate(advancedTemplate, rotation);
    }

    // Grid template for legacy grid rendering
    let template = isGridTemplate ? foundTemplate : (!advancedTemplate ? templateSource[0] : null);

    // Apply rotation to grid template if needed
    if (template && 'grid' in template && rotation !== 0) {
        template = {
            ...template,
            grid: rotateGridTemplate(template.grid, rotation)
        };
    }

    const [dragOverPhotoId, setDragOverPhotoId] = useState<string | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

    // Suggestion fan state
    const [suggestionAnchor, setSuggestionAnchor] = useState<{ rect: DOMRect; slotIndex: number } | null>(null);

    // Calculate suggestions based on highest photo index on current/previous page
    const getSuggestions = (): Photo[] => {
        if (allPhotos.length === 0) return [];

        // Find photos with src (non-empty) on current page
        const currentPagePhotos = photos.filter(p => p.src);

        // Use current page photos, or fallback to previous page
        const referencePhotos = currentPagePhotos.length > 0 ? currentPagePhotos : previousPagePhotos.filter(p => p.src);

        if (referencePhotos.length === 0) {
            // No reference, return first 4 unused photos
            const usedIds = new Set(photos.filter(p => p.src).map(p => p.originalId || p.id));
            return allPhotos.filter(p => !usedIds.has(p.id)).slice(0, 4);
        }

        // Find highest index in allPhotos that matches any reference photo's originalId
        let highestIndex = -1;
        referencePhotos.forEach(refPhoto => {
            const originalId = refPhoto.originalId || refPhoto.id;
            const idx = allPhotos.findIndex(p => p.id === originalId);
            if (idx > highestIndex) highestIndex = idx;
        });

        // Get 4 photos BEFORE the highest index and 4 photos AFTER
        const beforePhotos: Photo[] = [];
        const afterPhotos: Photo[] = [];

        // 4 photos after (higher index)
        for (let i = 1; i <= 4 && highestIndex + i < allPhotos.length; i++) {
            afterPhotos.push(allPhotos[highestIndex + i]);
        }

        // 4 photos before (lower index)
        for (let i = 1; i <= 4 && highestIndex - i >= 0; i++) {
            beforePhotos.unshift(allPhotos[highestIndex - i]);
        }

        // Return: first the "after" photos, then the "before" photos
        return [...afterPhotos, ...beforePhotos];
    };

    const handleEmptySlotClick = (e: React.MouseEvent, slotIndex: number, anchorElement?: HTMLElement) => {
        e.preventDefault();
        e.stopPropagation();

        const target = anchorElement || (e.currentTarget as HTMLElement);
        const domRect = target.getBoundingClientRect();
        // Explicitly copy properties because DOMRect properties are not enumerable in some contexts
        const rect = {
            top: domRect.top,
            left: domRect.left,
            width: domRect.width,
            height: domRect.height,
            bottom: domRect.bottom,
            right: domRect.right,
            x: domRect.x,
            y: domRect.y
        } as DOMRect; // Cast to satisfy type, though it's compatible structural type

        setSuggestionAnchor({ rect, slotIndex });
    };

    const handleSuggestionSelect = (photo: Photo, slotIndex: number) => {
        // Calculate array index from slotIndex (which is actualIndex)
        const arrayIndex = slotIndex - (photoIndexOffset || 0);
        const targetPhoto = photos[arrayIndex];

        if (targetPhoto && targetPhoto.src) {
            // Replace existing photo
            onDropPhoto(page.id, targetPhoto.id, photo.id);
        } else {
            // Insert into empty slot
            onDropPhoto(page.id, `__INSERT_AT__${slotIndex}`, photo.id);
        }
        setSuggestionAnchor(null);
    };

    // Measure container for Advanced Templates (needed for pixel-perfect SVG gaps)
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

    // Ensure gap is formatted correctly (handle string vs number)
    const gapValueStr = typeof photoGap === 'string' ? photoGap : `${photoGap ?? 0}px`;
    const gapValueNum = typeof photoGap === 'number' ? photoGap : parseInt(String(photoGap || 0), 10) || 0;

    // --- Render Advanced Template (Regions) ---
    if (advancedTemplate) {
        // Sort regions by zIndex
        const sortedRegions = [...advancedTemplate.regions].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
        const { width: W, height: H } = containerSize;

        return (
            <div
                ref={containerRef}
                className={cn("w-full h-full relative")}
            >
                {/* Only render regions if we have dimensions, otherwise wait for measure */}
                {W > 0 && H > 0 && sortedRegions.map((region, index) => {
                    const photo = photos[index];
                    const actualIndex = index + photoIndexOffset;

                    return (
                        <ShapeRegion
                            key={region.id || index}
                            region={region}
                            photo={photo}
                            photoGap={gapValueNum}
                            backgroundColor={page.backgroundColor || configBackgroundColor || '#ffffff'}
                            containerWidth={W}
                            containerHeight={H}
                            onUpdatePanAndZoom={(panAndZoom: PhotoPanAndZoom) => {
                                if (photo?.id) {
                                    onUpdatePhotoPanAndZoom(page.id, photo.id, panAndZoom);
                                }
                            }}
                            onInteractionChange={onInteractionChange}
                            onDrop={(droppedPhotoId) => {
                                const targetId = photo?.id || `__INSERT_AT__${actualIndex}`;
                                onDropPhoto(page.id, targetId, droppedPhotoId);
                                setDragOverPhotoId(null);
                            }}
                            onDragOver={() => setDragOverPhotoId(photo?.id || `__empty_${actualIndex}`)}
                            onDragLeave={() => setDragOverPhotoId(null)}
                            isDragOver={dragOverPhotoId === (photo?.id || `__empty_${actualIndex}`)}
                            onRemovePhoto={(photoId) => onRemovePhoto?.(page.id, photoId)}
                            onReplace={(e, anchor) => handleEmptySlotClick(e, actualIndex, anchor)}
                            cornerRadius={cornerRadius}
                        />
                    );
                })}

                {/* Suggestion Fan Portal - Must be in BOTH template paths! */}
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
    }

    // --- Render Grid Template (Legacy) ---
    return (
        <>
            <div
                ref={containerRef}
                className={cn("grid grid-cols-12 grid-rows-12 h-full w-full")}
                style={{ gap: gapValueStr }}
            >
                {template && template.grid.map((gridClass, index) => {
                    const photo = photos[index];
                    const actualIndex = index + photoIndexOffset;
                    const emptySlotId = `__empty_${actualIndex}`;

                    /* Allow dropping on empty slots too - check for missing photo OR empty src */
                    if (!photo || !photo.src) {
                        return (
                            <div
                                key={index}
                                className={cn(gridClass, "cursor-pointer")}
                                onClick={(e) => handleEmptySlotClick(e, actualIndex)}
                            >
                                <EmptyPhotoSlot
                                    className={cn(
                                        dragOverPhotoId === emptySlotId && "ring-2 ring-primary ring-offset-2 bg-primary/10"
                                    )}
                                    style={{ borderRadius: `${cornerRadius}px` }}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        setDragOverPhotoId(emptySlotId);
                                    }}
                                    onDragLeave={() => setDragOverPhotoId(null)}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        setDragOverPhotoId(null);
                                        const droppedPhotoId = e.dataTransfer.getData('photoId');
                                        if (droppedPhotoId) {
                                            // Use special ID format to indicate insertion at index
                                            onDropPhoto(page.id, `__INSERT_AT__${actualIndex}`, droppedPhotoId);
                                        }
                                    }}
                                />
                            </div>
                        );
                    }

                    return (
                        <div
                            key={photo.id}
                            className={cn(
                                "relative overflow-hidden transition-all duration-200 group ring-2 ring-transparent hover:ring-primary/20",
                                gridClass,
                                dragOverPhotoId === photo.id && "ring-2 ring-primary ring-offset-2"
                            )}
                            style={{ borderRadius: `${cornerRadius}px` }}
                            onDragOver={(e) => {
                                e.preventDefault();
                                setDragOverPhotoId(photo.id);
                            }}
                            onDragLeave={() => setDragOverPhotoId(null)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setDragOverPhotoId(null);

                                // Check if this is an album-to-album swap (CTRL+drag from another frame)
                                const albumPhotoId = e.dataTransfer.getData('albumPhotoId');
                                const sourcePageId = e.dataTransfer.getData('sourcePageId');

                                if (albumPhotoId && sourcePageId) {
                                    // Album-to-album swap
                                    if (albumPhotoId !== photo.id) {
                                        onDropPhoto(page.id, photo.id, albumPhotoId, { pageId: sourcePageId, photoId: albumPhotoId });
                                    }
                                } else {
                                    // Regular gallery drop
                                    const droppedPhotoId = e.dataTransfer.getData('photoId');
                                    if (droppedPhotoId && droppedPhotoId !== photo.id) {
                                        onDropPhoto(page.id, photo.id, droppedPhotoId);
                                    }
                                }
                            }}
                        >
                            <PhotoRenderer
                                photo={photo}
                                onUpdate={(panAndZoom) => onUpdatePhotoPanAndZoom(page.id, photo.id, panAndZoom)}
                                onInteractionChange={onInteractionChange}
                                useSimpleImage={useSimpleImage}
                                onRemove={() => onRemovePhoto?.(page.id, photo.id)}
                                onReplace={(e, anchor) => handleEmptySlotClick(e, actualIndex, anchor)}
                                pageId={page.id}
                                photoId={photo.id}
                            />
                        </div>
                    );
                })}
            </div>

            {/* Suggestion Fan Portal */}
            {
                suggestionAnchor && (
                    <SuggestionFan
                        key={`fan-${suggestionAnchor.slotIndex}`}
                        suggestions={getSuggestions()}
                        onSelect={(photo) => handleSuggestionSelect(photo, suggestionAnchor.slotIndex)}
                        onClose={() => setSuggestionAnchor(null)}
                        anchorRect={suggestionAnchor.rect}
                    />
                )
            }
        </>
    );
};

export const PageLayout = React.memo(PageLayoutComponent, (prev, next) => {
    // Custom Equality Check
    // We ignore 'page.coverTexts' changes by comparing strict fields that affect layout

    // Simple props check
    if (prev.photoGap !== next.photoGap) return false;
    if (prev.cornerRadius !== next.cornerRadius) return false;
    if (prev.overrideLayout !== next.overrideLayout) return false;
    if (prev.page.layout !== next.page.layout) return false;
    if (prev.page.id !== next.page.id) return false;
    // CRITICAL: Check if onDropPhoto handler changed (e.g. captured new photos)
    if (prev.onDropPhoto !== next.onDropPhoto) return false;

    // Photos check (length and IDs equal?)
    const prevPhotos = prev.overridePhotos || prev.page.photos;
    const nextPhotos = next.overridePhotos || next.page.photos;

    if (prevPhotos.length !== nextPhotos.length) return false;

    // Provide a reasonable shallow check for photos (ID and panZoom)
    // Deep check might be expensive, but better than re-render.
    // JSON stringify is a quick hack for deep objects, usually fast enough for small arrays.
    // Or just check IDs and PanZoom
    for (let i = 0; i < prevPhotos.length; i++) {
        if (prevPhotos[i].id !== nextPhotos[i].id) return false;
        if (prevPhotos[i].panAndZoom !== nextPhotos[i].panAndZoom) return false;
        // Also check src if replaced?
        if (prevPhotos[i].src !== nextPhotos[i].src) return false;
    }

    return true;
});

