'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { AlbumPage, Photo, PhotoPanAndZoom } from '@/lib/types';
import { AdvancedTemplate, ADVANCED_TEMPLATES } from '@/lib/advanced-layout-types';
import { ShapePhotoFrame } from './shape-photo-frame';

export interface AdvancedPageLayoutProps {
    page: AlbumPage;
    template: AdvancedTemplate;
    photoGap?: number;
    onUpdatePhotoPanAndZoom: (pageId: string, photoId: string, panAndZoom: PhotoPanAndZoom) => void;
    onInteractionChange: (isInteracting: boolean) => void;
    onDropPhoto: (pageId: string, targetPhotoId: string, droppedPhotoId: string, sourceInfo?: { pageId: string; photoId: string }) => void;
    overridePhotos?: Photo[];
    useSimpleImage?: boolean;
    className?: string;
}

export const AdvancedPageLayout = ({
    page,
    template,
    photoGap = 0,
    onUpdatePhotoPanAndZoom,
    onInteractionChange,
    onDropPhoto,
    overridePhotos,
    useSimpleImage,
    className,
}: AdvancedPageLayoutProps) => {
    const photos = overridePhotos || page.photos;

    return (
        <div
            className={cn("relative w-full h-full overflow-hidden", className)}
            style={{ position: 'relative' }}
        >
            {template.regions.map((region, index) => {
                const photo = photos[index];

                return (
                    <ShapePhotoFrame
                        key={region.id}
                        region={region}
                        photo={photo}
                        pageId={page.id}
                        photoIndex={index}
                        onUpdatePhotoPanAndZoom={onUpdatePhotoPanAndZoom}
                        onInteractionChange={onInteractionChange}
                        onDropPhoto={onDropPhoto}
                        useSimpleImage={useSimpleImage}
                        gap={photoGap}
                    />
                );
            })}
        </div>
    );
};

/**
 * Helper to find an advanced template by ID
 */
export function findAdvancedTemplate(id: string): AdvancedTemplate | undefined {
    return ADVANCED_TEMPLATES.find(t => t.id === id);
}

/**
 * Get all available advanced templates
 */
export function getAdvancedTemplates(): AdvancedTemplate[] {
    return ADVANCED_TEMPLATES;
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: AdvancedTemplate['category']): AdvancedTemplate[] {
    return ADVANCED_TEMPLATES.filter(t => t.category === category);
}
