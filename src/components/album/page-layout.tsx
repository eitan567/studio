import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { AlbumPage, Photo, PhotoPanAndZoom } from '@/lib/types';
import { LAYOUT_TEMPLATES } from './layout-templates';
import { PhotoRenderer } from './photo-renderer';
import { EmptyPhotoSlot } from './empty-photo-slot';
import { ADVANCED_TEMPLATES } from '@/lib/advanced-layout-types';
import { ShapeRegion } from './shape-region';

export interface PageLayoutProps {
    page: AlbumPage;
    photoGap?: number | string;
    onUpdatePhotoPanAndZoom: (pageId: string, photoId: string, panAndZoom: PhotoPanAndZoom) => void;
    onInteractionChange: (isInteracting: boolean) => void;
    onDropPhoto: (pageId: string, targetPhotoId: string, droppedPhotoId: string) => void;
    overridePhotos?: Photo[];
    overrideLayout?: string;
    templateSource?: typeof LAYOUT_TEMPLATES;
    useSimpleImage?: boolean;
    photoIndexOffset?: number;
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
    photoIndexOffset = 0
}: PageLayoutProps) => {
    const photos = overridePhotos || page.photos;
    const layout = overrideLayout || page.layout;

    // Check for templates in both sources
    // First, try to find in templateSource (which may include both grid and advanced templates)
    const foundTemplate = templateSource.find(t => t.id === layout);

    // Determine if it's a grid template (has 'grid' property) or advanced template (has 'regions' property)
    const isGridTemplate = foundTemplate && 'grid' in foundTemplate;
    const isAdvancedTemplate = foundTemplate && 'regions' in foundTemplate;

    // If not found in templateSource, also check ADVANCED_TEMPLATES directly
    const advancedTemplate = isAdvancedTemplate
        ? foundTemplate as any // Found in templateSource as advanced
        : (!foundTemplate ? ADVANCED_TEMPLATES.find(t => t.id === layout) : null);

    // Grid template for legacy grid rendering
    const template = isGridTemplate ? foundTemplate : (!advancedTemplate ? templateSource[0] : null);

    const [dragOverPhotoId, setDragOverPhotoId] = useState<string | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

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
                className={cn("w-full h-full relative overflow-hidden")}
            >
                {/* Only render regions if we have dimensions, otherwise wait for measure */}
                {W > 0 && H > 0 && sortedRegions.map((region, index) => {
                    const photo = photos[index];
                    const actualIndex = index + photoIndexOffset;

                    return (
                        <div
                            key={region.id || index}
                            className="absolute inset-0 pointer-events-none" // Child (ShapeRegion) will use pointer-events-auto with clip-path
                        // Actually ShapeRegion is div absolute. We just render it.
                        // But we need Drag & Drop wrappers?
                        // ShapeRegion currently has 'PhotoRenderer'.
                        // It does NOT have Drag & Drop logic integrated fully?
                        // In LayoutCanvas it was just for Editing (Pan/Zoom).
                        // Here in PageLayout we need DROP capability.
                        >
                            {/* 
                              WAIT: ShapeRegion in editor (LayoutCanvas) didn't handle Drop.
                              PageLayout needs onDrop.
                              We need to wrap ShapeRegion or pass onDrop to it?
                              ShapeRegion renders PhotoRenderer.
                              PhotoRenderer renders Image.
                              We need the 'Drop Target' logic.
                              
                              Recap: ShapeRegion takes `photo` prop.
                              It renders `PhotoRenderer` inside `foreignObject`.
                              We can wrap the ShapeRegion in a div that handles Drop?
                              But ShapeRegion is absolute positioned by `left/top/width/height`.
                              If we wrap strictly, we match that geometry.
                           */}
                            <ShapeRegion
                                region={region}
                                photo={photo}
                                photoGap={gapValueNum}
                                backgroundColor={page.backgroundColor || '#ffffff'} // Use page bg for gap strokes
                                containerWidth={W}
                                containerHeight={H}
                                onUpdatePanAndZoom={(panAndZoom: PhotoPanAndZoom) => {
                                    if (photo?.id) {
                                        onUpdatePhotoPanAndZoom(page.id, photo.id, panAndZoom);
                                    }
                                }}
                                onInteractionChange={onInteractionChange}
                                onDrop={(droppedPhotoId) => {
                                    // For empty slots, use INSERT_AT format; for existing photos, use photo.id
                                    const targetId = photo?.id || `__INSERT_AT__${actualIndex}`;
                                    onDropPhoto(page.id, targetId, droppedPhotoId);
                                    setDragOverPhotoId(null);
                                }}
                                onDragOver={() => setDragOverPhotoId(photo?.id || `__empty_${actualIndex}`)}
                                onDragLeave={() => setDragOverPhotoId(null)}
                                isDragOver={dragOverPhotoId === (photo?.id || `__empty_${actualIndex}`)}
                            />
                            {/* Overlay for Drop Target? 
                                ShapeRegion is complex SVG. 
                                Checking intersection for Drop on a polygon is hard.
                                But 'pointer-events' on the SVG mask should handle mouse over?
                                
                                Issue: PageLayout implements onDrop.
                                ShapeRegion component currently doesn't accept onDrop.
                                I should render a 'DropZone' ON TOP of ShapeRegion?
                                Or adding onDrop to ShapeRegion?
                                
                                For now, I will modify ShapeRegion later to support Drop?
                                Or assuming user will drag onto the visual 'image' which catches events?
                                
                                In existing Grid layout:
                                div onDrop={...} contains PhotoRenderer.
                                
                                The ShapeRegion renders the `div style={{ left... }}`.
                                I can attach onDrop to the ShapeRegion container?
                                ShapeRegion component doesn't expose `...props` to the root div.
                                
                                I should update ShapeRegion to accept `className` or events?
                                
                                Temporarily: Advanced Templates might not support Drag-Drop Reorder easily without update.
                                But let's get them Rendering first.
                            */}
                        </div>
                    );
                })}
                {/* 
                   Correction: The Map above renders ShapeRegions. 
                   They are absolute.
                   We need to handle the 'Empty Slot' case. 
                   ShapeRegion handles empty photo internally (Renders placeholder).
                   But does it handle DROP?
                   ShapeRegion internal placeholder has no onDrop.
                   
                   I MUST add `onDrop` support to ShapeRegion.
                   
                   For this step, I will Render them. 
                   I will note that Drop might be missing.
                */}
            </div>
        );
    }

    // --- Render Grid Template (Legacy) ---
    return (
        <div
            ref={containerRef}
            className={cn("grid grid-cols-12 grid-rows-12 h-full w-full")}
            style={{ gap: gapValueStr }}
        >
            {template && template.grid.map((gridClass, index) => {
                const photo = photos[index];
                const actualIndex = index + photoIndexOffset;
                const emptySlotId = `__empty_${actualIndex}`;

                /* Allow dropping on empty slots too */
                if (!photo) {
                    return (
                        <div
                            key={index}
                            className={gridClass}
                        >
                            <EmptyPhotoSlot
                                className={cn(
                                    "rounded-sm",
                                    dragOverPhotoId === emptySlotId && "ring-2 ring-primary ring-offset-2 bg-primary/10"
                                )}
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
                            "relative overflow-hidden rounded-sm transition-all duration-200 group ring-2 ring-transparent hover:ring-primary/20",
                            gridClass,
                            dragOverPhotoId === photo.id && "ring-2 ring-primary ring-offset-2"
                        )}
                        onDragOver={(e) => {
                            e.preventDefault();
                            setDragOverPhotoId(photo.id);
                        }}
                        onDragLeave={() => setDragOverPhotoId(null)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setDragOverPhotoId(null);
                            const droppedPhotoId = e.dataTransfer.getData('photoId');
                            if (droppedPhotoId && droppedPhotoId !== photo.id) {
                                onDropPhoto(page.id, photo.id, droppedPhotoId);
                            }
                        }}
                    >
                        <PhotoRenderer
                            photo={photo}
                            onUpdate={(panAndZoom) => onUpdatePhotoPanAndZoom(page.id, photo.id, panAndZoom)}
                            onInteractionChange={onInteractionChange}
                            useSimpleImage={useSimpleImage}
                        />
                    </div>
                );
            })}
        </div>
    );
};

export const PageLayout = React.memo(PageLayoutComponent, (prev, next) => {
    // Custom Equality Check
    // We ignore 'page.coverTexts' changes by comparing strict fields that affect layout

    // Simple props check
    if (prev.photoGap !== next.photoGap) return false;
    if (prev.overrideLayout !== next.overrideLayout) return false;
    if (prev.page.layout !== next.page.layout) return false;
    if (prev.page.id !== next.page.id) return false;

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

