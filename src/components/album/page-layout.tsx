import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { AlbumPage, Photo, PhotoPanAndZoom } from '@/lib/types';
import { LAYOUT_TEMPLATES } from './layout-templates';
import { PhotoRenderer } from './photo-renderer';
import { Image as ImageIcon, Plus } from 'lucide-react';

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
    const template = templateSource.find(t => t.id === layout) || templateSource[0];

    const [dragOverPhotoId, setDragOverPhotoId] = useState<string | null>(null);

    // Ensure gap is formatted correctly (handle string vs number)
    // DEBUG: Log the photoGap value with source identifier
    // const sourceId = `${page.id}-${layout}`;
    // console.log('[PageLayout]', sourceId, 'photoGap:', photoGap, 'type:', typeof photoGap);
    const gapValue = typeof photoGap === 'string'
        ? photoGap
        : `${photoGap ?? 0}px`;
    // console.log('[PageLayout]', sourceId, 'gapValue:', gapValue);

    return (
        <div
            className={cn("grid grid-cols-12 grid-rows-12 h-full w-full")}
            style={{ gap: gapValue }}
        >
            {template.grid.map((gridClass, index) => {
                const photo = photos[index];
                const actualIndex = index + photoIndexOffset;
                const emptySlotId = `__empty_${actualIndex}`;

                /* Allow dropping on empty slots too */
                if (!photo) {
                    return (
                        <div
                            key={index}
                            className={cn(
                                "bg-muted rounded-sm transition-all duration-200 flex flex-col items-center justify-center gap-2 text-muted-foreground/50",
                                gridClass,
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
                        >
                            <div className="relative">
                                <ImageIcon className="w-8 h-8" />
                                <Plus className="w-3 h-3 absolute -bottom-1 -right-1 bg-muted rounded-full" />
                            </div>
                            <span className="text-xs font-medium">Drop photo here</span>
                        </div>
                    );
                }

                return (
                    <div
                        key={photo.id}
                        className={cn(
                            "relative overflow-hidden rounded-sm transition-all duration-200 group ring-2 ring-transparent hover:ring-primary/20",
                            gridClass,
                            dragOverPhotoId === photo.id && "ring-primary ring-offset-2"
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

