import React from 'react';
import { Photo } from '@/lib/types';
import { LayoutRegion, regionToClipPath } from '@/lib/advanced-layout-types';
import { PhotoRenderer } from './photo-renderer';
import { Image as ImageIcon, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export const ShapeRegion = ({
    region,
    photo,
    photoGap,
    backgroundColor,
    containerWidth,
    containerHeight,
    onUpdatePanAndZoom,
    onInteractionChange,
    isPreview = false,
    onDrop,
    onDragOver,
    onDragLeave
}: {
    region: LayoutRegion;
    photo?: Photo;
    photoGap: number;
    backgroundColor: string;
    containerWidth: number;
    containerHeight: number;
    onUpdatePanAndZoom?: (panAndZoom: any) => void;
    onInteractionChange?: (isInteracting: boolean) => void;
    isPreview?: boolean;
    onDrop?: (photoId: string) => void;
    onDragOver?: (e: React.DragEvent) => void;
    onDragLeave?: (e: React.DragEvent) => void;
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
        if (photoGap <= 0) return null;
        if (region.shape !== 'polygon' && region.shape !== 'rect') return null;

        let p = region.points || [];

        // If it's a rect, synthesize 4 points for the stroke logic
        if (region.shape === 'rect') {
            const { x, y, width, height } = region.bounds;
            p = [
                [x, y],
                [x + width, y],
                [x + width, y + height],
                [x, y + height]
            ];
        }

        if (p.length < 2) return null;

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

            // Boundary check (Page edges are at 0 and 100)
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

    const isRectNoGap = region.shape === 'rect' && photoGap <= 0;

    return (
        <div
            className="absolute pointer-events-auto"
            style={{
                left: `${region.bounds.x}%`,
                top: `${region.bounds.y}%`,
                width: `${region.bounds.width}%`,
                height: `${region.bounds.height}%`,
                zIndex: region.zIndex ?? 0,
                overflow: isRectNoGap ? 'hidden' : 'visible',
            }}
        >
            {isRectNoGap ? (
                /* Optimized Rect Rendering: Skip SVG and masks for perfect pixel alignment */
                <div
                    className="w-full h-full relative"
                    style={{ backgroundColor }}
                    onDragOver={(e) => {
                        if (isPreview || !onDragOver) return;
                        e.preventDefault();
                        e.stopPropagation();
                        onDragOver(e);
                    }}
                    onDragLeave={(e) => {
                        if (isPreview || !onDragLeave) return;
                        e.preventDefault();
                        e.stopPropagation();
                        onDragLeave(e);
                    }}
                    onDrop={(e) => {
                        if (isPreview || !onDrop) return;
                        e.preventDefault();
                        e.stopPropagation();
                        const photoId = e.dataTransfer.getData('photoId');
                        if (photoId) {
                            onDrop(photoId);
                        }
                    }}
                >
                    {!photo ? (
                        <div className={cn(
                            "absolute inset-0 flex flex-col items-center justify-center text-muted-foreground",
                            isPreview ? "bg-primary/20" : "bg-muted/20"
                        )}>
                            {!isPreview && (
                                <>
                                    <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                                    <div className="absolute bottom-2 right-2">
                                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                                            <Plus className="w-4 h-4 text-primary" />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="w-full h-full relative">
                            <PhotoRenderer
                                photo={photo}
                                onUpdate={onUpdatePanAndZoom || (() => { })}
                                onInteractionChange={onInteractionChange}
                            />
                        </div>
                    )}
                </div>
            ) : (
                /* Standard SVG Clipping Path for non-rect shapes or when Gap > 0 */
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
                        <div
                            className="w-full h-full relative"
                            style={{
                                backgroundColor,
                                clipPath: regionToClipPath(region),
                                WebkitClipPath: regionToClipPath(region)
                            }}
                            onDragOver={(e) => {
                                if (isPreview || !onDragOver) return;
                                e.preventDefault();
                                e.stopPropagation();
                                onDragOver(e);
                            }}
                            onDragLeave={(e) => {
                                if (isPreview || !onDragLeave) return;
                                e.preventDefault();
                                e.stopPropagation();
                                onDragLeave(e);
                            }}
                            onDrop={(e) => {
                                if (isPreview || !onDrop) return;
                                e.preventDefault();
                                e.stopPropagation();
                                const photoId = e.dataTransfer.getData('photoId');
                                if (photoId) {
                                    onDrop(photoId);
                                }
                            }}
                        >
                            {!photo ? (
                                <div className={cn(
                                    "absolute inset-0 flex flex-col items-center justify-center text-muted-foreground",
                                    isPreview ? "bg-primary/20" : "bg-muted/20"
                                )}>
                                    {!isPreview && (
                                        <>
                                            <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                                            <div className="absolute bottom-2 right-2">
                                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <Plus className="w-4 h-4 text-primary" />
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="w-full h-full relative">
                                    <PhotoRenderer
                                        photo={photo}
                                        onUpdate={onUpdatePanAndZoom || (() => { })}
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
                            {renderInternalStrokes()}
                        </>
                    )}
                </svg>
            )}
        </div>
    );
};
