import React, { useRef, useState, useEffect } from 'react';
import { AlbumPage, AlbumConfig, PhotoPanAndZoom, Photo } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PageLayout } from '../page-layout';
import { LAYOUT_TEMPLATES } from '../layout-templates';
import { AdvancedTemplate, LayoutRegion, regionToClipPath } from '@/lib/advanced-layout-types';
import { PhotoRenderer } from '../photo-renderer';
import { Image as ImageIcon, Plus } from 'lucide-react';
import { ShapeRegion } from '../shape-region';

interface LayoutCanvasProps {
    page: AlbumPage;
    config?: AlbumConfig;
    onUpdatePage: (page: AlbumPage) => void;
    advancedTemplate?: AdvancedTemplate | null;
}

export const LayoutCanvas = ({ page, config, onUpdatePage, advancedTemplate }: LayoutCanvasProps) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    // --- Define Logic Base Resolution ---
    const BASE_PAGE_PX = 450;

    // --- Parse Configuration ---
    let configW = 20;
    let configH = 20;
    if (config?.size) {
        const parts = config.size.split('x').map(Number);
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            configW = parts[0];
            configH = parts[1];
        }
    }

    // --- Calculate Logical Container Dimensions ---
    const pxPerUnit = BASE_PAGE_PX / configH;
    const pageW_px = configW * pxPerUnit;
    const pageH_px = BASE_PAGE_PX;

    // Double page spread for Split mode, single for Full mode
    const isFull = page.spreadMode === 'full';
    const logicalWidth = pageW_px * 2;
    const logicalHeight = pageH_px;

    // --- Auto-Scale to Fit Viewport ---
    useEffect(() => {
        if (!wrapperRef.current) return;

        const measure = () => {
            const wrapper = wrapperRef.current;
            if (!wrapper) return;
            const { width: availW, height: availH } = wrapper.getBoundingClientRect();

            if (availW === 0 || availH === 0) return;

            const scaleX = availW / logicalWidth;
            const scaleY = availH / logicalHeight;
            const fitScale = Math.min(scaleX, scaleY);

            setScale(fitScale * 0.85); // 15% padding for better viewing
        };

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(wrapperRef.current);

        return () => observer.disconnect();
    }, [logicalWidth, logicalHeight]);

    // Get spacing values - use px as base unit
    const photoGap = page.photoGap ?? config?.photoGap ?? 0;
    const pageMargin = page.pageMargin ?? config?.pageMargin ?? 0;
    const backgroundColor = config?.backgroundColor || '#ffffff';

    // Gap value as px string for PageLayout
    const gapValue = `${photoGap}px`;

    // Get layout template
    const template = LAYOUT_TEMPLATES.find(t => t.id === page.layout) || LAYOUT_TEMPLATES[0];

    // Dummy handlers for PageLayout
    const handleUpdatePhotoPanAndZoom = (pageId: string, photoId: string, panAndZoom: PhotoPanAndZoom) => {
        // No-op for dummy page
    };

    const handleDropPhoto = (pageId: string, targetPhotoId: string, droppedPhotoId: string) => {
        // No-op for dummy page
    };

    const handleInteractionChange = (isInteracting: boolean) => {
        // No-op for dummy page
    };

    // Render advanced template if selected
    const renderAdvancedTemplate = () => {
        if (!advancedTemplate) return null;

        // Sort regions by zIndex
        const sortedRegions = [...advancedTemplate.regions].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

        return (
            <div
                className="h-full w-full relative overflow-hidden"
                style={{
                    padding: `${pageMargin}px`,
                    backgroundColor
                }}
            >
                <div className="relative w-full h-full">
                    {sortedRegions.map((region, index) => {
                        const photo = page.photos[index];
                        return (
                            <ShapeRegion
                                key={region.id || index}
                                region={region}
                                photo={photo}
                                photoGap={photoGap}
                                backgroundColor={backgroundColor}
                                containerWidth={logicalWidth - pageMargin * 2}
                                containerHeight={logicalHeight - pageMargin * 2}
                                onUpdatePanAndZoom={(panAndZoom) => {
                                    if (photo?.id) {
                                        handleUpdatePhotoPanAndZoom(page.id, photo.id, panAndZoom);
                                    }
                                }}
                                onInteractionChange={handleInteractionChange}
                            />
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div
            ref={wrapperRef}
            className="w-full h-full flex items-center justify-center bg-muted/20 overflow-hidden"
        >
            <div
                style={{
                    width: logicalWidth,
                    height: logicalHeight,
                    transform: `scale(${scale})`,
                    border: '1px solid #ccc',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
                    backgroundColor,
                }}
                className="relative"
            >
                {advancedTemplate ? (
                    /* Advanced Template Mode */
                    renderAdvancedTemplate()
                ) : isFull ? (
                    /* Full Mode: Single layout across entire spread */
                    <div
                        className="h-full w-full bg-white relative overflow-hidden"
                        style={{
                            padding: `${pageMargin}px`,
                            backgroundColor
                        }}
                    >
                        <PageLayout
                            page={{ ...page, id: 'full-spread' }}
                            photoGap={gapValue}
                            onUpdatePhotoPanAndZoom={handleUpdatePhotoPanAndZoom}
                            onInteractionChange={handleInteractionChange}
                            onDropPhoto={handleDropPhoto}
                            overrideLayout={page.layout}
                            photoIndexOffset={0}
                        />
                    </div>
                ) : (
                    /* Split Mode: Two-page spread layout */
                    <div className="flex h-full w-full">
                        {/* Left Page */}
                        <div
                            className="flex-1 bg-white relative overflow-hidden"
                            style={{
                                padding: `${pageMargin}px`,
                                backgroundColor
                            }}
                        >
                            <PageLayout
                                page={{ ...page, id: 'left-page' }}
                                photoGap={gapValue}
                                onUpdatePhotoPanAndZoom={handleUpdatePhotoPanAndZoom}
                                onInteractionChange={handleInteractionChange}
                                onDropPhoto={handleDropPhoto}
                                overrideLayout={page.spreadLayouts?.left || page.layout}
                                photoIndexOffset={0}
                            />
                        </div>

                        {/* Center Spine */}
                        <div className="w-px bg-muted-foreground/30" />

                        {/* Right Page */}
                        <div
                            className="flex-1 bg-white relative overflow-hidden"
                            style={{
                                padding: `${pageMargin}px`,
                                backgroundColor
                            }}
                        >
                            <PageLayout
                                page={{ ...page, id: 'right-page' }}
                                photoGap={gapValue}
                                onUpdatePhotoPanAndZoom={handleUpdatePhotoPanAndZoom}
                                onInteractionChange={handleInteractionChange}
                                onDropPhoto={handleDropPhoto}
                                overrideLayout={page.spreadLayouts?.right || page.layout}
                                photoIndexOffset={template.photoCount}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
