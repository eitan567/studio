'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { LayoutRegion, regionToClipPath } from '@/lib/advanced-layout-types';
import { Photo, PhotoPanAndZoom } from '@/lib/types';
import { PhotoRenderer } from './photo-renderer';
import { Image as ImageIcon, Plus } from 'lucide-react';

interface ShapePhotoFrameProps {
    region: LayoutRegion;
    photo?: Photo;
    pageId: string;
    photoIndex: number;
    onUpdatePhotoPanAndZoom: (pageId: string, photoId: string, panAndZoom: PhotoPanAndZoom) => void;
    onInteractionChange: (isInteracting: boolean) => void;
    onDropPhoto: (pageId: string, targetPhotoId: string, droppedPhotoId: string) => void;
    useSimpleImage?: boolean;
    gap?: number; // Gap as pixels to apply as inset
}

export const ShapePhotoFrame = ({
    region,
    photo,
    pageId,
    photoIndex,
    onUpdatePhotoPanAndZoom,
    onInteractionChange,
    onDropPhoto,
    useSimpleImage,
    gap = 0,
}: ShapePhotoFrameProps) => {
    const [isDragOver, setIsDragOver] = useState(false);

    // Calculate clip-path for the shape
    const clipPath = regionToClipPath(region);

    // Calculate position and size from bounds (percentages)
    const style: React.CSSProperties = {
        position: 'absolute',
        left: `${region.bounds.x}%`,
        top: `${region.bounds.y}%`,
        width: `${region.bounds.width}%`,
        height: `${region.bounds.height}%`,
        zIndex: region.zIndex ?? 0,
        // Apply rotation if specified
        transform: region.rotation ? `rotate(${region.rotation}deg)` : undefined,
    };

    // Inner container with clip-path and gap (as inset/padding)
    const innerStyle: React.CSSProperties = {
        width: '100%',
        height: '100%',
        clipPath,
        WebkitClipPath: clipPath,
        // Gap creates visual spacing by slightly shrinking the clipped area
        padding: gap > 0 ? `${gap}px` : 0,
        boxSizing: 'border-box',
    };

    const emptySlotId = `__empty_${photoIndex}`;

    // Handle drag events
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const droppedPhotoId = e.dataTransfer.getData('photoId');
        if (droppedPhotoId) {
            if (photo) {
                onDropPhoto(pageId, photo.id, droppedPhotoId);
            } else {
                onDropPhoto(pageId, `__INSERT_AT__${photoIndex}`, droppedPhotoId);
            }
        }
    };

    // Render empty slot
    if (!photo || !photo.src) {
        return (
            <div style={style}>
                <div
                    style={innerStyle}
                    className={cn(
                        "bg-muted flex flex-col items-center justify-center transition-all duration-200",
                        isDragOver && "ring-2 ring-primary ring-inset bg-primary/10"
                    )}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <div className="relative text-muted-foreground/50">
                        <ImageIcon className="w-8 h-8" />
                        <Plus className="w-3 h-3 absolute -bottom-1 -right-1 bg-muted rounded-full" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground/50 mt-2">
                        Drop photo here
                    </span>
                </div>
            </div>
        );
    }

    // Render photo with shape mask
    return (
        <div
            style={style}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div
                style={innerStyle}
                className={cn(
                    "overflow-hidden transition-all duration-200",
                    isDragOver && "ring-2 ring-primary ring-inset"
                )}
            >
                <div className="w-full h-full relative">
                    <PhotoRenderer
                        photo={photo}
                        onUpdate={(panAndZoom) => onUpdatePhotoPanAndZoom(pageId, photo.id, panAndZoom)}
                        onInteractionChange={onInteractionChange}
                        useSimpleImage={useSimpleImage}
                    />
                </div>
            </div>
        </div>
    );
};
