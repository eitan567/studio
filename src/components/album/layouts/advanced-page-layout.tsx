'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { AlbumPage, Photo, PhotoPanAndZoom } from '@/lib/types';
import { ADVANCED_TEMPLATES, AdvancedTemplate } from '@/hooks/useTemplates';
import { ShapePhotoFrame } from './shape-photo-frame';
import { isLikelyBackgroundRegion } from '@/lib/layout-background-region';

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
    const sortedRegions = [...template.regions].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    const templateMode = template._imageRotationMode || 'follow-frame';

    return (
        <div
            className={cn("relative w-full h-full overflow-hidden", className)}
            style={{ position: 'relative' }}
        >
            {sortedRegions.map((region, index) => {
                const photo = photos[index];
                const regionImageMode = isLikelyBackgroundRegion(region, sortedRegions) ? 'keep-horizontal' : templateMode;

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
                        imageRotationMode={regionImageMode}
                    />
                );
            })}
        </div>
    );
};

/**
 * Helper to find an advanced template by ID
 */
export function findAdvancedTemplate(id: string | number): AdvancedTemplate | undefined {
    return ADVANCED_TEMPLATES.find(t => String(t.id) === String(id));
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
