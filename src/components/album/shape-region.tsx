import React from 'react';
import { Photo } from '@/lib/types';
import { LayoutRegion, regionToClipPath } from '@/lib/advanced-layout-types';
import { PhotoRenderer } from './photo-renderer';
import { EmptyPhotoSlot } from './empty-photo-slot';
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
    onDragLeave,
    isDragOver = false
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
    isDragOver?: boolean;
}) => {
    // Unique ID for the mask (though we use clip-path now, keeping IDs unique is good practice)
    const shapeId = `shape-${region.id}`;

    const isRect = region.shape === 'rect';
    const isCircle = region.shape === 'circle';

    // Dimensions in relative percentages and pixels
    const widthPx = (region.bounds.width / 100) * containerWidth;
    const heightPx = (region.bounds.height / 100) * containerHeight;

    // Content size and centering for circles
    const contentSizePx = Math.min(widthPx, heightPx);
    const contentWidthPx = isCircle ? contentSizePx : widthPx;
    const contentHeightPx = isCircle ? contentSizePx : heightPx;

    const photoGapNum = typeof photoGap === 'string' ? parseFloat(photoGap) : photoGap;
    // contentInset is HALF the gap (shared between slots)
    const contentInset = photoGapNum / 2;

    const maskId = `mask-outside-${region.id}`;

    // Convert polygon points to percentage string relative to the region (0-100)
    let svgPoints = "";
    if (region.shape === 'polygon' && region.points) {
        svgPoints = region.points
            .map(p => {
                const relX = ((p[0] - region.bounds.x) / region.bounds.width) * 100;
                const relY = ((p[1] - region.bounds.y) / region.bounds.height) * 100;
                return `${relX},${relY}`;
            })
            .join(' ');
    }

    // INTERNAL STROKES: Only needed for non-rect complex shapes to fill the 'gap' area
    const renderInternalStrokes = () => {
        if (photoGapNum <= 0 || region.shape !== 'polygon') return null;

        let p = region.points || [];
        if (p.length < 2) return null;

        const n = p.length;
        const segments = [];
        const EPSILON = 0.5;

        for (let i = 0; i < n; i++) {
            const curr = p[i];
            const next = p[(i + 1) % n];
            // Only draw strokes for internal edges (not on page bounds)
            const isOnBound =
                (Math.abs(curr[0] - 0) < EPSILON && Math.abs(next[0] - 0) < EPSILON) ||
                (Math.abs(curr[0] - 100) < EPSILON && Math.abs(next[0] - 100) < EPSILON) ||
                (Math.abs(curr[1] - 0) < EPSILON && Math.abs(next[1] - 0) < EPSILON) ||
                (Math.abs(curr[1] - 100) < EPSILON && Math.abs(next[1] - 100) < EPSILON);

            if (!isOnBound) {
                const relP1X = ((curr[0] - region.bounds.x) / region.bounds.width) * 100;
                const relP1Y = ((curr[1] - region.bounds.y) / region.bounds.height) * 100;
                const relP2X = ((next[0] - region.bounds.x) / region.bounds.width) * 100;
                const relP2Y = ((next[1] - region.bounds.y) / region.bounds.height) * 100;

                segments.push(
                    <line
                        key={i}
                        x1={`${relP1X}%`}
                        y1={`${relP1Y}%`}
                        x2={`${relP2X}%`}
                        y2={`${relP2Y}%`}
                        stroke={backgroundColor}
                        strokeWidth={photoGapNum}
                        vectorEffect="non-scaling-stroke"
                        strokeLinecap="round"
                        pointerEvents="none"
                    />
                );
            }
        }
        return segments;
    };

    const renderContent = () => {
        if (!photo || !photo.src) {
            return (
                <EmptyPhotoSlot
                    className={cn(
                        "w-full h-full",
                        isPreview && "bg-primary/20",
                    )}
                    showText={!isPreview}
                />
            );
        }

        return (
            <PhotoRenderer
                photo={photo}
                onUpdate={(pz) => onUpdatePanAndZoom?.(pz)}
                onInteractionChange={onInteractionChange}
            />
        );
    };

    // Calculate highlight insets in percentages for SVG use
    const hInsetX = widthPx > 0 ? (contentInset / widthPx) * 100 : 0;
    const hInsetY = heightPx > 0 ? (contentInset / heightPx) * 100 : 0;

    return (
        <div
            id={shapeId}
            className="absolute pointer-events-auto transition-all duration-300"
            style={{
                left: `${region.bounds.x}%`,
                top: `${region.bounds.y}%`,
                width: `${region.bounds.width}%`,
                height: `${region.bounds.height}%`,
                zIndex: region.zIndex ?? 0,
            }}
        >
            {/* 
                THE CONTENT WRAPPER
                This implements the 'photoGap' via inset and handles all interactions.
            */}
            <div
                className={cn(
                    "absolute overflow-hidden transition-all duration-300",
                    isRect && "rounded-sm",
                    isRect && isDragOver && "ring-2 ring-primary ring-offset-2",
                    isDragOver && (!photo || !photo.src) && "bg-primary/10"
                )}
                style={{
                    // Centering logic for circles
                    left: isCircle ? '50%' : `${contentInset}px`,
                    top: isCircle ? '50%' : `${contentInset}px`,
                    right: isCircle ? 'auto' : `${contentInset}px`,
                    bottom: isCircle ? 'auto' : `${contentInset}px`,
                    transform: isCircle ? 'translate(-50%, -50%)' : 'none',
                    width: isCircle ? `${(contentWidthPx / widthPx) * 100}%` : 'auto',
                    height: isCircle ? `${(contentHeightPx / heightPx) * 100}%` : 'auto',
                    backgroundColor: photoGapNum > 0 ? backgroundColor : 'transparent',
                    clipPath: isRect ? 'none' : regionToClipPath(region),
                    WebkitClipPath: isRect ? 'none' : regionToClipPath(region),
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
                    if (photoId) onDrop(photoId);
                }}
            >
                {renderContent()}
            </div>

            {/* 
                SVG OVERLAYS: Only for non-rectangular shapes.
                Rectangular gaps/highlights are handled by the Content Wrapper (CSS inset + ring).
            */}
            {!isRect && (
                <>
                    {/* Stroke Layer (Internal Gaps) */}
                    {photoGapNum > 0 && (
                        <svg
                            className="absolute inset-0 pointer-events-none"
                            width="100%"
                            height="100%"
                            viewBox="0 0 100 100"
                            preserveAspectRatio={isCircle ? "xMidYMid meet" : "none"}
                            style={{ overflow: 'visible', zIndex: 10 }}
                        >
                            {isCircle && (
                                <ellipse
                                    cx="50"
                                    cy="50"
                                    rx="50"
                                    ry="50"
                                    fill="none"
                                    stroke={backgroundColor}
                                    strokeWidth={photoGapNum}
                                    vectorEffect="non-scaling-stroke"
                                />
                            )}
                            {renderInternalStrokes()}
                        </svg>
                    )}

                    {/* Foreground Highlight (Ring Effect) */}
                    <svg
                        className={cn(
                            "absolute inset-0 pointer-events-none transition-opacity duration-300",
                            isDragOver ? "opacity-100" : "opacity-0"
                        )}
                        width="100%"
                        height="100%"
                        viewBox="0 0 100 100"
                        preserveAspectRatio={isCircle ? "xMidYMid meet" : "none"}
                        style={{ overflow: 'visible', zIndex: 100 }}
                    >
                        <defs>
                            <mask id={maskId}>
                                <rect x="-100" y="-100" width="300" height="300" fill="white" />
                                {isCircle ? (
                                    <ellipse
                                        cx="50" cy="50"
                                        rx={50 - hInsetX} ry={50 - hInsetY}
                                        fill="black"
                                    />
                                ) : (
                                    <polygon
                                        points={svgPoints}
                                        fill="black"
                                        transform={`translate(50,50) scale(${1 - (hInsetX / 50)}, ${1 - (hInsetY / 50)}) translate(-50,-50)`}
                                    />
                                )}
                            </mask>
                        </defs>

                        <g mask={`url(#${maskId})`}>
                            {isCircle ? (
                                <>
                                    <ellipse
                                        cx="50" cy="50" rx={50 - hInsetX} ry={50 - hInsetY}
                                        fill="none" stroke="hsl(var(--primary))" strokeWidth="8"
                                        strokeLinejoin="round" vectorEffect="non-scaling-stroke"
                                    />
                                    <ellipse
                                        cx="50" cy="50" rx={50 - hInsetX} ry={50 - hInsetY}
                                        fill="none" stroke="#ffffff" strokeWidth="4"
                                        strokeLinejoin="round" vectorEffect="non-scaling-stroke"
                                    />
                                </>
                            ) : (
                                <>
                                    <polygon
                                        points={svgPoints}
                                        fill="none" stroke="hsl(var(--primary))" strokeWidth="8"
                                        strokeLinejoin="round" vectorEffect="non-scaling-stroke"
                                        transform={`translate(50,50) scale(${1 - (hInsetX / 50)}, ${1 - (hInsetY / 50)}) translate(-50,-50)`}
                                    />
                                    <polygon
                                        points={svgPoints}
                                        fill="none" stroke="#ffffff" strokeWidth="4"
                                        strokeLinejoin="round" vectorEffect="non-scaling-stroke"
                                        transform={`translate(50,50) scale(${1 - (hInsetX / 50)}, ${1 - (hInsetY / 50)}) translate(-50,-50)`}
                                    />
                                </>
                            )}
                        </g>
                    </svg>
                </>
            )}
        </div>
    );
};
