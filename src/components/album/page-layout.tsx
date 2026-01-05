import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { AlbumPage, Photo, PhotoPanAndZoom } from '@/lib/types';
import { LAYOUT_TEMPLATES } from './layout-templates';
import { PhotoRenderer } from './photo-renderer';

export interface PageLayoutProps {
    page: AlbumPage;
    photoGap?: number | string;
    onUpdatePhotoPanAndZoom: (pageId: string, photoId: string, panAndZoom: PhotoPanAndZoom) => void;
    onInteractionChange: (isInteracting: boolean) => void;
    onDropPhoto: (pageId: string, targetPhotoId: string, droppedPhotoId: string) => void;
    overridePhotos?: Photo[];
    overrideLayout?: string;
    templateSource?: typeof LAYOUT_TEMPLATES;
}

const PageLayoutComponent = ({
    page,
    photoGap,
    onUpdatePhotoPanAndZoom,
    onInteractionChange,
    onDropPhoto,
    overridePhotos,
    overrideLayout,
    templateSource = LAYOUT_TEMPLATES
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
        ? (photoGap === '0%' ? '2%' : photoGap) // Minimum 2% gap for visibility
        : `${Math.max(photoGap ?? 0, 5)}px`; // Minimum 5px gap
    // console.log('[PageLayout]', sourceId, 'gapValue:', gapValue);

    return (
        <div
            className={cn("grid grid-cols-12 grid-rows-12 h-full w-full")}
            style={{ gap: gapValue }}
        >
            {template.grid.map((gridClass, index) => {
                const photo = photos[index];
                if (!photo) return <div key={index} className={cn("bg-muted rounded-sm", gridClass)} />;

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

