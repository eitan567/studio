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
    isDragOver = false,
    onRemovePhoto,
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
    onRemovePhoto?: (photoId: string) => void;
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
    const baseInset = photoGapNum / 2;

    // Detect if edges touch page boundaries (0% or 100%)
    const EPSILON = 0.5;
    const isAtLeft = region.bounds.x < EPSILON;
    const isAtTop = region.bounds.y < EPSILON;
    const isAtRight = (region.bounds.x + region.bounds.width) > 100 - EPSILON;
    const isAtBottom = (region.bounds.y + region.bounds.height) > 100 - EPSILON;

    // Directional insets: 0 if at boundary, baseInset if internal
    const insetL = isAtLeft ? 0 : baseInset;
    const insetT = isAtTop ? 0 : baseInset;
    const insetR = isAtRight ? 0 : baseInset;
    const insetB = isAtBottom ? 0 : baseInset;

    const maskId = `mask-outside-${region.id}`;

    // Convert directional pixel insets to percentages RELATIVE TO THE PAGE
    const pInsetL = (insetL / containerWidth) * 100;
    const pInsetT = (insetT / containerHeight) * 100;
    const pInsetW = ((insetL + insetR) / containerWidth) * 100;
    const pInsetH = ((insetT + insetB) / containerHeight) * 100;

    // Convert polygon points to percentage string relative to the *adjusted* region container (0-100)
    let svgPoints = "";
    if (region.shape === 'polygon' && region.points) {
        const newX = region.bounds.x + pInsetL;
        const newY = region.bounds.y + pInsetT;
        const newW = region.bounds.width - pInsetW;
        const newH = region.bounds.height - pInsetH;

        svgPoints = region.points
            .map(p => {
                const relX = ((p[0] - newX) / newW) * 100;
                const relY = ((p[1] - newY) / newH) * 100;
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
                // Projection must match the *adjusted* container coordinates
                const newX = region.bounds.x + pInsetL;
                const newY = region.bounds.y + pInsetT;
                const newW = region.bounds.width - pInsetW;
                const newH = region.bounds.height - pInsetH;

                const relP1X = ((curr[0] - newX) / newW) * 100;
                const relP1Y = ((curr[1] - newY) / newH) * 100;
                const relP2X = ((next[0] - newX) / newW) * 100;
                const relP2Y = ((next[1] - newY) / newH) * 100;

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
                onRemove={() => onRemovePhoto?.(photo.id)}
            />
        );
    };

    // Local clip-path calculation using the adjusted container's relative coordinates
    const clipPathStyle = isCircle ? 'circle(closest-side)' : (
        svgPoints ? `polygon(${svgPoints.split(' ').map(p => {
            const [sx, sy] = p.split(',');
            return `${sx}% ${sy}%`;
        }).join(', ')})` : 'none'
    );

    const commonStyle: React.CSSProperties = {
        left: `calc(${region.bounds.x}% + ${insetL}px)`,
        top: `calc(${region.bounds.y}% + ${insetT}px)`,
        width: `calc(${region.bounds.width}% - ${insetL + insetR}px)`,
        height: `calc(${region.bounds.height}% - ${insetT + insetB}px)`,
        zIndex: region.zIndex ?? 0,
    };

    const handleDragOver = (e: React.DragEvent) => {
        if (isPreview || !onDragOver) return;
        e.preventDefault();
        e.stopPropagation();
        onDragOver(e);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        if (isPreview || !onDragLeave) return;
        e.preventDefault();
        e.stopPropagation();
        onDragLeave(e);
    };

    const handleDrop = (e: React.DragEvent) => {
        if (isPreview || !onDrop) return;
        e.preventDefault();
        e.stopPropagation();
        const photoId = e.dataTransfer.getData('photoId');
        if (photoId) onDrop(photoId);
    };

    // CLEAN RECT PATH: 1:1 Parity with Grid Slots
    if (isRect) {
        return (
            <div
                id={shapeId}
                className={cn(
                    "absolute pointer-events-auto transition-all duration-200 rounded-sm overflow-hidden group",
                    "ring-2 ring-transparent hover:ring-primary/20",
                    isDragOver && "ring-primary ring-offset-2",
                    isDragOver && (!photo || !photo.src) && "bg-primary/10"
                )}
                style={{
                    ...commonStyle,
                    backgroundColor: photoGapNum > 0 ? backgroundColor : 'transparent',
                    ['--tw-ring-offset-color' as any]: backgroundColor,
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {renderContent()}
            </div>
        );
    }

    // ADVANCED PATH: SVG/Clip-Path for Circles and Polygons
    return (
        <div
            id={shapeId}
            className="absolute pointer-events-auto transition-all duration-200 group"
            style={commonStyle}
        >
            <div
                className={cn(
                    "absolute inset-0 pointer-events-auto overflow-hidden transition-all duration-200",
                    isDragOver && (!photo || !photo.src) && "bg-primary/10"
                )}
                style={{
                    backgroundColor: photoGapNum > 0 ? backgroundColor : 'transparent',
                    clipPath: clipPathStyle,
                    WebkitClipPath: clipPathStyle,
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {renderContent()}
            </div>

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
                    "absolute inset-0 pointer-events-none transition-opacity duration-200",
                    isDragOver ? "opacity-100" : "opacity-0 group-hover:opacity-100"
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
                            <ellipse cx="50" cy="50" rx="50" ry="50" fill="black" />
                        ) : (
                            <polygon points={svgPoints} fill="black" />
                        )}
                    </mask>
                </defs>

                <g mask={`url(#${maskId})`}>
                    {isCircle ? (
                        <>
                            <ellipse
                                cx="50" cy="50" rx="50" ry="50"
                                fill="none" stroke={isDragOver ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.2)"} strokeWidth="8"
                                strokeLinejoin="round" vectorEffect="non-scaling-stroke"
                            />
                            <ellipse
                                cx="50" cy="50" rx="50" ry="50"
                                fill="none" stroke={backgroundColor} strokeWidth="4"
                                strokeLinejoin="round" vectorEffect="non-scaling-stroke"
                            />
                        </>
                    ) : (
                        <>
                            <polygon
                                points={svgPoints}
                                fill="none" stroke={isDragOver ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.2)"} strokeWidth="8"
                                strokeLinejoin="round" vectorEffect="non-scaling-stroke"
                            />
                            <polygon
                                points={svgPoints}
                                fill="none" stroke={backgroundColor} strokeWidth="4"
                                strokeLinejoin="round" vectorEffect="non-scaling-stroke"
                            />
                        </>
                    )}
                </g>
            </svg>
        </div>
    );
};

