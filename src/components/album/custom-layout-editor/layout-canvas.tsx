import React, { useRef, useState, useEffect } from 'react';
import { AlbumPage, AlbumConfig, PhotoPanAndZoom } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PageLayout } from '../page-layout';
import { LAYOUT_TEMPLATES } from '../layout-templates';
import { AdvancedTemplate, LayoutRegion, regionToClipPath } from '@/lib/advanced-layout-types';
import { PhotoRenderer } from '../photo-renderer';
import { Image as ImageIcon, Plus } from 'lucide-react';

interface LayoutCanvasProps {
    page: AlbumPage;
    config?: AlbumConfig;
    onUpdatePage: (page: AlbumPage) => void;
    advancedTemplate?: AdvancedTemplate | null;
}

// Render a single shape region with photo using SVG for complex shapes
const ShapeRegion = ({
    region,
    photo,
    photoGap,
    backgroundColor,
    containerWidth,
    containerHeight,
    onUpdatePanAndZoom,
    onInteractionChange
}: {
    region: LayoutRegion;
    photo?: { id: string; src: string; alt?: string; panAndZoom?: any };
    photoGap: number;
    backgroundColor: string;
    containerWidth: number;
    containerHeight: number;
    onUpdatePanAndZoom?: (panAndZoom: any) => void;
    onInteractionChange?: (isInteracting: boolean) => void;
}) => {
    // Unique ID for the mask
    const maskId = `mask-${region.id}`;

    // Dimensions in pixels
    const widthPx = (region.bounds.width / 100) * containerWidth;
    const heightPx = (region.bounds.height / 100) * containerHeight;
    const leftPx = (region.bounds.x / 100) * containerWidth;
    const topPx = (region.bounds.y / 100) * containerHeight;

    // Convert polygon points to pixel string relative to the region
    let svgPoints = "";
    if (region.shape === 'polygon' && region.points) {
        svgPoints = region.points
            .map(p => {
                const pX_px = (p[0] / 100) * containerWidth;
                const pY_px = (p[1] / 100) * containerHeight;
                return `${pX_px - leftPx},${pY_px - topPx}`;
            })
            .join(' ');
    }

    // Calculate internal edges for custom stroking
    // We render these as separate extended segments to ensure clean boundary cuts
    const renderInternalStrokes = () => {
        if (region.shape !== 'polygon' || !region.points || photoGap <= 0) return null;

        const p = region.points;
        const n = p.length;
        const segments = [];

        for (let i = 0; i < n; i++) {
            const curr = p[i];
            const next = p[(i + 1) % n];

            // Points are already relative to the Page (0-100), not the region.
            const p1x = curr[0];
            const p1y = curr[1];
            const p2x = next[0];
            const p2y = next[1];

            const EPSILON = 0.5;

            // Check if points are on the page boundary
            const isP1Bound = Math.abs(p1x) < EPSILON || Math.abs(p1x - 100) < EPSILON ||
                Math.abs(p1y) < EPSILON || Math.abs(p1y - 100) < EPSILON;

            const isP2Bound = Math.abs(p2x) < EPSILON || Math.abs(p2x - 100) < EPSILON ||
                Math.abs(p2y) < EPSILON || Math.abs(p2y - 100) < EPSILON;

            // Check if the edge ITSELF lies ON the boundary (to exclude it)
            // An edge is on boundary if both points are on the SAME boundary side (e.g. both Top)
            const isLeft = Math.abs(p1x) < EPSILON && Math.abs(p2x) < EPSILON;
            const isRight = Math.abs(p1x - 100) < EPSILON && Math.abs(p2x - 100) < EPSILON;
            const isTop = Math.abs(p1y) < EPSILON && Math.abs(p2y) < EPSILON;
            const isBottom = Math.abs(p1y - 100) < EPSILON && Math.abs(p2y - 100) < EPSILON;
            const isEdgeOnBoundary = isLeft || isRight || isTop || isBottom;

            if (!isEdgeOnBoundary) {
                // It's an internal edge.
                // Calculate pixel coords relative to this region's SVG
                let x1 = ((curr[0] / 100) * containerWidth) - leftPx;
                let y1 = ((curr[1] / 100) * containerHeight) - topPx;
                let x2 = ((next[0] / 100) * containerWidth) - leftPx;
                let y2 = ((next[1] / 100) * containerHeight) - topPx;

                // Extend segments ONLY at boundary endpoints to ensure clean cuts.
                // Do NOT extend at internal vertices (where they join), to avoid artifacts.
                const dx = x2 - x1;
                const dy = y2 - y1;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                const ux = dx / len;
                const uy = dy / len;

                const extension = photoGap * 2;

                if (isP1Bound) {
                    x1 -= ux * extension;
                    y1 -= uy * extension;
                }

                if (isP2Bound) {
                    x2 += ux * extension;
                    y2 += uy * extension;
                }

                segments.push(
                    <line
                        key={i}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={backgroundColor}
                        strokeWidth={photoGap}
                        strokeLinecap="round" // Smooth merges at internal corners
                        pointerEvents="none"
                    />
                );
            }
        }
        return segments;
    };

    return (
        <div
            className="absolute"
            style={{
                left: leftPx,
                top: topPx,
                width: widthPx,
                height: heightPx,
                zIndex: region.zIndex ?? 0,
                // Remove local overflow clipping so that:
                // 1. Strokes adjacent to neighbors can be seen (filling their gap)
                // 2. Extended strokes at boundaries are not clipped by the region box (but by the page)
                overflow: 'visible',
            }}
        >
            <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${widthPx} ${heightPx}`}
                preserveAspectRatio="none"
                style={{ overflow: 'visible' }} // Allow stroke to bleed out
            >
                <defs>
                    <mask id={maskId}>
                        {/* Visible area: The shape itself in white */}
                        {region.shape === 'circle' && (
                            <ellipse
                                cx={widthPx / 2}
                                cy={heightPx / 2}
                                rx={widthPx / 2}
                                ry={heightPx / 2}
                                fill="white"
                            />
                        )}
                        {region.shape === 'rect' && (
                            <rect
                                x="0"
                                y="0"
                                width={widthPx}
                                height={heightPx}
                                fill="white"
                            />
                        )}
                        {region.shape === 'polygon' && (
                            <polygon points={svgPoints} fill="white" />
                        )}
                    </mask>
                </defs>

                {/* The Content: A foreignObject clipped by the mask */}
                <foreignObject
                    x="0"
                    y="0"
                    width={widthPx}
                    height={heightPx}
                    mask={`url(#${maskId})`}
                    style={{
                        // Ensure internal content handles overflow correctly
                        overflow: 'hidden'
                    }}
                >
                    {/* Inner content container */}
                    <div className="w-full h-full relative" style={{ backgroundColor }}>
                        {!photo ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground bg-muted/20">
                                <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                                <div className="absolute bottom-2 right-2">
                                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Plus className="w-4 h-4 text-primary" />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="w-full h-full relative">
                                <PhotoRenderer
                                    photo={photo}
                                    containerWidth={widthPx}
                                    containerHeight={heightPx}
                                    onUpdatePanAndZoom={onUpdatePanAndZoom}
                                    onInteractionChange={onInteractionChange}
                                />
                            </div>
                        )}
                    </div>
                </foreignObject>

                {/* Visible Internal Stroke for Gaps */}
                {photoGap > 0 && (
                    <>
                        {region.shape === 'circle' && (
                            <ellipse
                                cx={widthPx / 2}
                                cy={heightPx / 2}
                                rx={widthPx / 2}
                                ry={heightPx / 2}
                                fill="none"
                                stroke={backgroundColor}
                                strokeWidth={photoGap}
                                pointerEvents="none"
                            />
                        )}
                        {region.shape === 'rect' && (
                            /* Only stroke internal edges for rects too? 
                               Usually rect templates use gaps between Grid items.
                               Standard rect behavior with border is okay if we want uniform gaps.
                               But sticking to consistent behavior:
                            */
                            <rect
                                x="0"
                                y="0"
                                width={widthPx}
                                height={heightPx}
                                fill="none"
                                stroke={backgroundColor}
                                strokeWidth={photoGap}
                                pointerEvents="none"
                            />
                        )}
                        {renderInternalStrokes()}
                    </>
                )}
            </svg>
        </div>
    );
};

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
