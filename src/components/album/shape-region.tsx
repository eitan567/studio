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
    // Unique ID for the mask (though we use clip-path now, keeping IDs unique is good practice)
    const shapeId = `shape-${region.id}`;

    // Dimensions in pixels (for legacy consistency if needed, but we use percentages for layout)
    const widthPx = (region.bounds.width / 100) * containerWidth;
    const heightPx = (region.bounds.height / 100) * containerHeight;

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

    // Calculate internal edges for custom stroking
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

            // Check if the edge ITSELF lies ON the boundary
            const isLeft = Math.abs(p1x) < EPSILON && Math.abs(p2x) < EPSILON;
            const isRight = Math.abs(p1x - 100) < EPSILON && Math.abs(p2x - 100) < EPSILON;
            const isTop = Math.abs(p1y) < EPSILON && Math.abs(p2y) < EPSILON;
            const isBottom = Math.abs(p1y - 100) < EPSILON && Math.abs(p2y - 100) < EPSILON;
            const isEdgeOnBoundary = isLeft || isRight || isTop || isBottom;

            if (!isEdgeOnBoundary) {
                // Calculate relative coords in the 0-100 SVG coordinate system
                let x1 = ((curr[0] - region.bounds.x) / region.bounds.width) * 100;
                let y1 = ((curr[1] - region.bounds.y) / region.bounds.height) * 100;
                let x2 = ((next[0] - region.bounds.x) / region.bounds.width) * 100;
                let y2 = ((next[1] - region.bounds.y) / region.bounds.height) * 100;

                const dx = x2 - x1;
                const dy = y2 - y1;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                const ux = dx / len;
                const uy = dy / len;

                const extension = 5;

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
                        vectorEffect="non-scaling-stroke"
                        strokeLinecap="round"
                        pointerEvents="none"
                    />
                );
            }
        }
        return segments;
    };

    // For circular shapes, we want the CONTENT container to be a square matching the diameter.
    // This prevents PhotoRenderer from over-scaling the photo to fill the "extra" width in Full mode.
    const isCircle = region.shape === 'circle';
    const contentWidthPx = isCircle ? Math.min(widthPx, heightPx) : widthPx;
    const contentHeightPx = isCircle ? Math.min(widthPx, heightPx) : heightPx;

    const isRectNoGap = region.shape === 'rect' && photoGap <= 0;

    // Helper render for the photo content to avoid repetition
    const renderContent = () => {
        if (!photo || !photo.src) {
            return (
                <EmptyPhotoSlot
                    className={cn(
                        isPreview && "bg-primary/20"
                    )}
                    showText={!isPreview}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop ? (e) => {
                        e.preventDefault();
                        const droppedPhotoId = e.dataTransfer.getData('photoId');
                        if (droppedPhotoId) onDrop(droppedPhotoId);
                    } : undefined}
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

    return (
        <div
            id={shapeId}
            className="absolute pointer-events-auto"
            style={{
                left: `${region.bounds.x}%`,
                top: `${region.bounds.y}%`,
                width: `${region.bounds.width}%`,
                height: `${region.bounds.height}%`,
                zIndex: region.zIndex ?? 0,
            }}
        >
            {/* 
                THE CONTENT LAYER 
                Rendered outside SVG to avoid transformation distortion.
            */}
            <div
                className="absolute"
                style={{
                    // Center the square content inside the potentially rectangular region
                    left: isCircle ? '50%' : '0',
                    top: isCircle ? '50%' : '0',
                    transform: isCircle ? 'translate(-50%, -50%)' : 'none',
                    width: isCircle ? `${(contentWidthPx / widthPx) * 100}%` : '100%',
                    height: isCircle ? `${(contentHeightPx / heightPx) * 100}%` : '100%',
                    backgroundColor: photoGap > 0 ? backgroundColor : 'transparent',
                    clipPath: regionToClipPath(region),
                    WebkitClipPath: regionToClipPath(region),
                    overflow: 'hidden'
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
                {renderContent()}
            </div>

            {/* 
                THE STROKE LAYER (Overlay)
                Always absolute positioned 0,0,100,100 to match root div.
            */}
            {photoGap > 0 && !isRectNoGap && (
                <svg
                    className="absolute inset-0 pointer-events-none"
                    width="100%"
                    height="100%"
                    viewBox="0 0 100 100"
                    preserveAspectRatio={region.shape === 'circle' ? "xMidYMid meet" : "none"}
                    style={{ overflow: 'visible', zIndex: 10 }}
                >
                    {region.shape === 'circle' && (
                        <ellipse
                            cx="50"
                            cy="50"
                            rx="50"
                            ry="50"
                            fill="none"
                            stroke={backgroundColor}
                            strokeWidth={photoGap}
                            vectorEffect="non-scaling-stroke"
                        />
                    )}
                    {renderInternalStrokes()}
                </svg>
            )}
        </div>
    );
};
