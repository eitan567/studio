import React from 'react';
import { createPortal } from 'react-dom';
import { FlipHorizontal, Hash, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { Photo } from '@/lib/types';
import { LayoutRegion, TemplateImageRotationMode, regionToClipPath } from '@/lib/advanced-layout-types';
import { PhotoRenderer } from './photo-renderer';
import { EmptyPhotoSlot } from '../album-editor/empty-photo-slot';
import { cn } from '@/lib/utils';
import { getRegionVisualRotationDeg } from '@/lib/layout-region-rotation';
import { useOptionalAlbumEditor } from '../album-editor/context';

// Canva-like placeholder background
const CanvaPlaceholder = ({ className }: { className?: string }) => (
    <div className={cn("absolute inset-0 bg-[#d4eaf7] overflow-hidden select-none pointer-events-none", className)}>
        <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid slice"
            className="w-full h-full"
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#d4eaf7" />
                    <stop offset="100%" stopColor="#eef8ff" />
                </linearGradient>
                <linearGradient id="hillGradient1" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#90d5ac" />
                    <stop offset="100%" stopColor="#76c893" />
                </linearGradient>
                <linearGradient id="hillGradient2" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#76c893" />
                    <stop offset="100%" stopColor="#52b788" />
                </linearGradient>
            </defs>

            {/* Sky */}
            <rect width="100" height="100" fill="url(#skyGradient)" />

            {/* Sun */}
            <circle cx="85" cy="15" r="8" fill="#fdf2a4" />

            {/* Clouds */}
            <g fill="white" opacity="0.6">
                <circle cx="20" cy="20" r="5" />
                <circle cx="25" cy="22" r="6" />
                <circle cx="30" cy="20" r="5" />

                <circle cx="60" cy="35" r="4" />
                <circle cx="65" cy="37" r="5" />
                <circle cx="70" cy="35" r="4" />
            </g>

            {/* Far Hill */}
            <path
                d="M-10,100 Q50,40 110,100 Z"
                fill="url(#hillGradient1)"
                opacity="0.9"
            />

            {/* Near Hill */}
            <path
                d="M-20,100 Q30,60 80,110 Z"
                fill="url(#hillGradient2)"
            />
            <path
                d="M40,110 Q80,70 120,100 Z"
                fill="url(#hillGradient2)"
                opacity="0.8"
            />
        </svg>
    </div>
);

const clampNumber = (value: number, min: number, max: number): number => {
    return Math.min(max, Math.max(min, value));
};

const buildRoundedPolygonClipPath = (
    pointsPercent: Array<[number, number]>,
    widthPx: number,
    heightPx: number,
    radiusPx: number
): string | null => {
    if (pointsPercent.length < 3 || widthPx <= 0 || heightPx <= 0 || radiusPx <= 0) {
        return null;
    }

    const toPixels = (p: [number, number]): [number, number] => [
        (clampNumber(p[0], 0, 100) / 100) * widthPx,
        (clampNumber(p[1], 0, 100) / 100) * heightPx
    ];

    const rawPoints = pointsPercent.map(toPixels);
    const points = rawPoints.slice();

    if (points.length > 1) {
        const first = points[0];
        const last = points[points.length - 1];
        const closeDist = Math.hypot(last[0] - first[0], last[1] - first[1]);
        if (closeDist < 0.001) points.pop();
    }

    if (points.length < 3) return null;

    const toObjBBoxPoint = (p: [number, number]) => {
        const x = clampNumber(p[0] / widthPx, 0, 1);
        const y = clampNumber(p[1] / heightPx, 0, 1);
        return `${x.toFixed(6)} ${y.toFixed(6)}`;
    };

    const corners = points.map((curr, i) => {
        const prev = points[(i - 1 + points.length) % points.length];
        const next = points[(i + 1) % points.length];

        const inVecRaw: [number, number] = [prev[0] - curr[0], prev[1] - curr[1]];
        const outVecRaw: [number, number] = [next[0] - curr[0], next[1] - curr[1]];

        const inLen = Math.hypot(inVecRaw[0], inVecRaw[1]);
        const outLen = Math.hypot(outVecRaw[0], outVecRaw[1]);

        if (inLen < 0.001 || outLen < 0.001) {
            return { start: curr, end: curr, control: curr };
        }

        const inVec: [number, number] = [inVecRaw[0] / inLen, inVecRaw[1] / inLen];
        const outVec: [number, number] = [outVecRaw[0] / outLen, outVecRaw[1] / outLen];

        const dot = clampNumber((inVec[0] * outVec[0]) + (inVec[1] * outVec[1]), -1, 1);
        const angle = Math.acos(dot);

        if (angle < 0.01 || Math.abs(Math.PI - angle) < 0.01) {
            return { start: curr, end: curr, control: curr };
        }

        const tanHalf = Math.tan(angle / 2);
        if (!Number.isFinite(tanHalf) || tanHalf <= 0.0001) {
            return { start: curr, end: curr, control: curr };
        }

        const maxRadiusForEdges = Math.min(inLen, outLen) * tanHalf;
        const effectiveRadius = Math.min(radiusPx, maxRadiusForEdges);
        const offset = effectiveRadius / tanHalf;

        const start: [number, number] = [
            curr[0] + (inVec[0] * offset),
            curr[1] + (inVec[1] * offset)
        ];

        const end: [number, number] = [
            curr[0] + (outVec[0] * offset),
            curr[1] + (outVec[1] * offset)
        ];

        return { start, end, control: curr };
    });

    if (corners.length < 3) return null;

    let d = `M ${toObjBBoxPoint(corners[0].start)} `;
    for (let i = 0; i < corners.length; i++) {
        const current = corners[i];
        const next = corners[(i + 1) % corners.length];
        d += `Q ${toObjBBoxPoint(current.control)} ${toObjBBoxPoint(current.end)} `;
        d += `L ${toObjBBoxPoint(next.start)} `;
    }
    d += 'Z';

    return d;
};

export const ShapeRegion = ({
    region,
    photo,
    photoGap,
    backgroundColor,
    gapColor,
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
    onReplace,
    onEnhanceWithAi,
    pageId,
    useSimpleImage = false,
    cornerRadius = 0,
    imageRotationMode = 'follow-frame',
    forceGapStroke = false,
    priority,
    chronologicalIndex,
}: {
    region: LayoutRegion;
    photo?: Photo;
    photoGap: number;
    backgroundColor: string;
    gapColor?: string;
    containerWidth: number;
    containerHeight: number;
    onUpdatePanAndZoom?: (panAndZoom: any) => void;
    onInteractionChange?: (isInteracting: boolean) => void;
    isPreview?: boolean;
    onDrop?: (e: React.DragEvent) => void;
    onDragOver?: (e: React.DragEvent) => void;
    onDragLeave?: (e: React.DragEvent) => void;
    isDragOver?: boolean;
    onRemovePhoto?: (photoId: string) => void;
    onReplace?: (e: React.MouseEvent, anchorElement?: HTMLElement) => void;
    onEnhanceWithAi?: (pageId: string, photoId: string, photo: Photo) => void;
    pageId?: string;
    useSimpleImage?: boolean;
    cornerRadius?: number;
    imageRotationMode?: TemplateImageRotationMode;
    forceGapStroke?: boolean;
    priority?: boolean;
    chronologicalIndex?: Record<string, number>;
}) => {
    const rootRef = React.useRef<HTMLDivElement>(null);
    const reactInstanceId = React.useId();
    const albumEditor = useOptionalAlbumEditor();
    const scrollToGallery = albumEditor?.scrollToGallery;
    // Keep clip/mask ids unique per instance to avoid collisions between regions/templates.
    const safeRegionId = String(region.id ?? 'region').replace(/[^a-zA-Z0-9_-]/g, '-');
    const safeInstanceId = reactInstanceId.replace(/[^a-zA-Z0-9_-]/g, '');
    const shapeId = `shape-${safeRegionId}-${safeInstanceId}`;

    const isRect = region.shape === 'rect';
    const isCircle = region.shape === 'circle';

    const photoGapNum = typeof photoGap === 'string' ? parseFloat(photoGap) : photoGap;
    const cornerRadiusNum = Number(cornerRadius) || 0;
    const gapPaintColor = gapColor ?? backgroundColor;
    // contentInset is HALF the gap (shared between slots)
    const baseInset = photoGapNum / 2;

    const EDGE_EPSILON = 0.75;
    const EDGE_SEGMENT_MIN_SPAN = 0.2;
    const boundaryEpsilonX = Math.max(
        EDGE_EPSILON,
        ((baseInset + 0.5) / Math.max(1, containerWidth)) * 100
    );
    const boundaryEpsilonY = Math.max(
        EDGE_EPSILON,
        ((baseInset + 0.5) / Math.max(1, containerHeight)) * 100
    );
    const polygonPoints = (region.shape === 'polygon' && region.points && region.points.length >= 3)
        ? region.points
        : undefined;
    const isPolygonRegion = !!polygonPoints;

    const hasPolygonBoundaryEdge = (edge: 'left' | 'top' | 'right' | 'bottom'): boolean => {
        if (!polygonPoints || polygonPoints.length < 2) return false;
        const target = edge === 'left' || edge === 'top' ? 0 : 100;

        for (let i = 0; i < polygonPoints.length; i++) {
            const curr = polygonPoints[i];
            const next = polygonPoints[(i + 1) % polygonPoints.length];
            if (edge === 'left' || edge === 'right') {
                const onEdge = Math.abs(curr[0] - target) <= boundaryEpsilonX && Math.abs(next[0] - target) <= boundaryEpsilonX;
                if (onEdge && Math.abs(curr[1] - next[1]) >= EDGE_SEGMENT_MIN_SPAN) return true;
            } else {
                const onEdge = Math.abs(curr[1] - target) <= boundaryEpsilonY && Math.abs(next[1] - target) <= boundaryEpsilonY;
                if (onEdge && Math.abs(curr[0] - next[0]) >= EDGE_SEGMENT_MIN_SPAN) return true;
            }
        }

        return false;
    };

    const isSegmentOnPageBoundary = (a: [number, number], b: [number, number]) =>
        (Math.abs(a[0] - 0) <= boundaryEpsilonX && Math.abs(b[0] - 0) <= boundaryEpsilonX) ||
        (Math.abs(a[0] - 100) <= boundaryEpsilonX && Math.abs(b[0] - 100) <= boundaryEpsilonX) ||
        (Math.abs(a[1] - 0) <= boundaryEpsilonY && Math.abs(b[1] - 0) <= boundaryEpsilonY) ||
        (Math.abs(a[1] - 100) <= boundaryEpsilonY && Math.abs(b[1] - 100) <= boundaryEpsilonY);

    // Dimensions in relative percentages and pixels
    const widthPx = (region.bounds.width / 100) * containerWidth;
    const heightPx = (region.bounds.height / 100) * containerHeight;

    // Detect if edges touch page boundaries (0% or 100%)
    const isAtLeft = region.bounds.x <= boundaryEpsilonX || hasPolygonBoundaryEdge('left');
    const isAtTop = region.bounds.y <= boundaryEpsilonY || hasPolygonBoundaryEdge('top');
    const isAtRight = (region.bounds.x + region.bounds.width) >= 100 - boundaryEpsilonX || hasPolygonBoundaryEdge('right');
    const isAtBottom = (region.bounds.y + region.bounds.height) >= 100 - boundaryEpsilonY || hasPolygonBoundaryEdge('bottom');

    // For polygon regions, legacy behavior used painted strokes (no physical inset).
    // When gap color is transparent we must keep physical spacing, otherwise the gap disappears visually.
    const usePhysicalInsetForPolygon = isPolygonRegion && gapPaintColor === 'transparent' && photoGapNum > 0;
    const keepLegacyPolygonStrokeGap = isPolygonRegion && !usePhysicalInsetForPolygon;

    // Directional insets: 0 if at boundary, baseInset if internal
    const insetL = keepLegacyPolygonStrokeGap ? 0 : (isAtLeft ? 0 : baseInset);
    const insetT = keepLegacyPolygonStrokeGap ? 0 : (isAtTop ? 0 : baseInset);
    const insetR = keepLegacyPolygonStrokeGap ? 0 : (isAtRight ? 0 : baseInset);
    const insetB = keepLegacyPolygonStrokeGap ? 0 : (isAtBottom ? 0 : baseInset);
    const shouldForceGapStroke = forceGapStroke && photoGapNum > 0;

    const maskId = `mask-outside-${safeRegionId}-${safeInstanceId}`;

    // Convert directional pixel insets to percentages RELATIVE TO THE PAGE
    const pInsetL = (insetL / containerWidth) * 100;
    const pInsetT = (insetT / containerHeight) * 100;
    const pInsetW = ((insetL + insetR) / containerWidth) * 100;
    const pInsetH = ((insetT + insetB) / containerHeight) * 100;

    // Convert polygon points to percentage string relative to the *adjusted* region container (0-100)
    // and compute a clipped polygon for accurate photo-fit calculations.
    const clipPolygonToBox = (
        polygon: Array<[number, number]>,
        minX: number,
        minY: number,
        maxX: number,
        maxY: number
    ): Array<[number, number]> => {
        if (polygon.length < 3) return polygon;

        const clipEdge = (
            input: Array<[number, number]>,
            isInside: (p: [number, number]) => boolean,
            intersect: (a: [number, number], b: [number, number]) => [number, number]
        ): Array<[number, number]> => {
            const out: Array<[number, number]> = [];
            for (let i = 0; i < input.length; i++) {
                const curr = input[i];
                const prev = input[(i + input.length - 1) % input.length];
                const currInside = isInside(curr);
                const prevInside = isInside(prev);

                if (currInside) {
                    if (!prevInside) out.push(intersect(prev, curr));
                    out.push(curr);
                } else if (prevInside) {
                    out.push(intersect(prev, curr));
                }
            }
            return out;
        };

        const intersectAtX = (x: number) => (a: [number, number], b: [number, number]): [number, number] => {
            const dx = b[0] - a[0];
            if (Math.abs(dx) < 1e-9) return [x, a[1]];
            const t = (x - a[0]) / dx;
            return [x, a[1] + ((b[1] - a[1]) * t)];
        };

        const intersectAtY = (y: number) => (a: [number, number], b: [number, number]): [number, number] => {
            const dy = b[1] - a[1];
            if (Math.abs(dy) < 1e-9) return [a[0], y];
            const t = (y - a[1]) / dy;
            return [a[0] + ((b[0] - a[0]) * t), y];
        };

        let output = polygon.slice();
        output = clipEdge(output, (p) => p[0] >= minX, intersectAtX(minX)); // left
        if (output.length < 3) return output;
        output = clipEdge(output, (p) => p[0] <= maxX, intersectAtX(maxX)); // right
        if (output.length < 3) return output;
        output = clipEdge(output, (p) => p[1] >= minY, intersectAtY(minY)); // top
        if (output.length < 3) return output;
        output = clipEdge(output, (p) => p[1] <= maxY, intersectAtY(maxY)); // bottom
        return output;
    };

    let svgPoints = "";
    let fitClipPolygon: Array<[number, number]> | undefined;
    let clipPathPolygonPoints: Array<[number, number]> | undefined;
    if (region.shape === 'polygon' && polygonPoints) {
        const newX = region.bounds.x + pInsetL;
        const newY = region.bounds.y + pInsetT;
        const newW = region.bounds.width - pInsetW;
        const newH = region.bounds.height - pInsetH;

        const pointsForSvg: string[] = [];
        const pointsForFitRaw: Array<[number, number]> = [];
        for (const p of polygonPoints) {
            const relX = ((p[0] - newX) / newW) * 100;
            const relY = ((p[1] - newY) / newH) * 100;
            pointsForSvg.push(`${relX},${relY}`);
            pointsForFitRaw.push([relX, relY]);
        }
        svgPoints = pointsForSvg.join(' ');
        const clipped = clipPolygonToBox(pointsForFitRaw, 0, 0, 100, 100);
        fitClipPolygon = clipped.length >= 3 ? clipped : undefined;
        clipPathPolygonPoints = fitClipPolygon || (pointsForFitRaw.length >= 3 ? pointsForFitRaw : undefined);
    }
    if (!fitClipPolygon && isRect) {
        fitClipPolygon = [[0, 0], [100, 0], [100, 100], [0, 100]];
    }

    const adjustedRegionWidthPx = Math.max(1, widthPx - (insetL + insetR));
    const adjustedRegionHeightPx = Math.max(1, heightPx - (insetT + insetB));
    const roundedPolygonClipPathD = (region.shape === 'polygon' && clipPathPolygonPoints && cornerRadiusNum > 0)
        ? buildRoundedPolygonClipPath(
            clipPathPolygonPoints,
            adjustedRegionWidthPx,
            adjustedRegionHeightPx,
            cornerRadiusNum
        )
        : null;
    const hasValidRoundedPolygonClipPath = !!roundedPolygonClipPathD && !/(NaN|Infinity)/.test(roundedPolygonClipPathD);

    // INTERNAL STROKES: Only needed for non-rect complex shapes to fill the 'gap' area
    const renderInternalStrokes = () => {
        if (photoGapNum <= 0 || region.shape !== 'polygon') return null;
        if (usePhysicalInsetForPolygon) return null;

        let p = polygonPoints || [];
        if (p.length < 2) return null;

        const n = p.length;
        const segments = [];

        for (let i = 0; i < n; i++) {
            const curr = p[i];
            const next = p[(i + 1) % n];
            // Only draw strokes for internal edges (not on page bounds)
            const isOnBound = isSegmentOnPageBoundary(curr, next);

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
                        stroke={gapPaintColor}
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

    // Canva path frames are authored to follow their frame orientation intrinsically.
    // Keep them in follow-frame regardless of the template-wide image mode toggle.
    const effectiveImageRotationMode: TemplateImageRotationMode =
        region.shape === 'path' ? 'follow-frame' : imageRotationMode;

    const frameRotationDeg = typeof region.rotation === 'number' ? region.rotation : 0;
    const visualFrameRotationDeg = getRegionVisualRotationDeg(region);
    const targetPhotoWorldRotationDeg = effectiveImageRotationMode === 'keep-horizontal' ? 0 : visualFrameRotationDeg;
    const photoExtraRotationDeg = targetPhotoWorldRotationDeg - frameRotationDeg;
    const shouldAdjustPhotoRotation = Math.abs(photoExtraRotationDeg) > 0.0001;
    const frameAspectRatio = Math.max(
        0.01,
        adjustedRegionWidthPx / Math.max(1, adjustedRegionHeightPx)
    );
    const rotationRad = Math.abs(photoExtraRotationDeg) * (Math.PI / 180);
    const sinAbs = Math.abs(Math.sin(rotationRad));
    const cosAbs = Math.abs(Math.cos(rotationRad));
    const keepHorizontalCoverScale = effectiveImageRotationMode === 'keep-horizontal'
        ? Math.max(
            1,
            cosAbs + (sinAbs / frameAspectRatio),
            cosAbs + (sinAbs * frameAspectRatio)
        )
        : 1;

    const renderContent = () => {
        if (!photo || !photo.src) {
            if (region.shape === 'path') {
                return <CanvaPlaceholder className={cn(isPreview && "opacity-60")} />;
            }
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

        const photoRenderer = (
            <PhotoRenderer
                photo={photo}
                onUpdate={(pz) => onUpdatePanAndZoom?.(pz)}
                onInteractionChange={onInteractionChange}
                // We ALWAYS render the replace button externally in ShapeRegion to prevent clipping.
                // So we do NOT pass onReplace to PhotoRenderer here.
                onReplace={undefined}
                pageId={pageId}
                photoId={photo.id}
                useSimpleImage={useSimpleImage}
                priority={priority}
                preserveAspectRatio={region.preserveAspectRatio}
                fitRotationDeg={shouldAdjustPhotoRotation ? photoExtraRotationDeg : 0}
                fitUseRotatedViewportBasis={
                    effectiveImageRotationMode === 'follow-frame' &&
                    shouldAdjustPhotoRotation
                }
                fitClipPolygon={fitClipPolygon}
                clipOverflow
            />
        );

        if (!shouldAdjustPhotoRotation) {
            return photoRenderer;
        }

        return (
            <div
                className="absolute inset-0"
                style={{
                    transform: `rotate(${photoExtraRotationDeg}deg) scale(${keepHorizontalCoverScale})`,
                    transformOrigin: '50% 50%'
                }}
            >
                {photoRenderer}
            </div>
        );
    };

    // Right-click actions menu, anchored by cursor position.
    const galleryPhotoId = photo ? (photo.originalId || photo.id) : undefined;
    const photoNumber = galleryPhotoId ? chronologicalIndex?.[galleryPhotoId] : undefined;
    const hasGalleryJump = photoNumber !== undefined && !!scrollToGallery;
    const hasEnhanceAction = !!(photo?.src && pageId && onEnhanceWithAi);
    const hasFlipAction = !!(photo?.src && onUpdatePanAndZoom);
    const hasAnyAction = !!(photo?.src && (onReplace || onRemovePhoto || hasGalleryJump || hasEnhanceAction || hasFlipAction));
    const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number } | null>(null);

    const closeContextMenu = React.useCallback(() => {
        setContextMenu(null);
    }, []);

    React.useEffect(() => {
        if (!contextMenu) return;

        const handlePointerDown = () => closeContextMenu();
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeContextMenu();
        };
        const handleScroll = () => closeContextMenu();

        window.addEventListener('mousedown', handlePointerDown);
        window.addEventListener('keydown', handleEscape);
        window.addEventListener('scroll', handleScroll, true);

        return () => {
            window.removeEventListener('mousedown', handlePointerDown);
            window.removeEventListener('keydown', handleEscape);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [contextMenu, closeContextMenu]);

    const openContextMenu = (e: React.MouseEvent) => {
        if (!hasAnyAction) return;
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    const runReplaceFromMenu = () => {
        if (!onReplace || !rootRef.current) return;
        const syntheticEvent = {
            preventDefault: () => { },
            stopPropagation: () => { },
            currentTarget: rootRef.current,
        } as unknown as React.MouseEvent;
        onReplace(syntheticEvent, rootRef.current);
    };

    const actionCount = (onReplace ? 1 : 0) + (hasFlipAction ? 1 : 0) + (hasEnhanceAction ? 1 : 0) + (onRemovePhoto ? 1 : 0) + (hasGalleryJump ? 1 : 0);
    const menuWidth = 200;
    const menuHeight = 12 + (actionCount * 34);
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;
    const menuLeft = contextMenu ? Math.max(8, Math.min(contextMenu.x, viewportWidth - menuWidth - 8)) : 8;
    const menuTop = contextMenu ? Math.max(8, Math.min(contextMenu.y, viewportHeight - menuHeight - 8)) : 8;

    const contextMenuOverlay = contextMenu && hasAnyAction && typeof document !== 'undefined'
        ? createPortal(
            <div
                className="fixed inset-0 z-[500]"
                onMouseDown={closeContextMenu}
                onContextMenu={(e) => {
                    e.preventDefault();
                    closeContextMenu();
                }}
            >
                <div
                    className="absolute w-[200px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                    style={{ left: `${menuLeft}px`, top: `${menuTop}px` }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onContextMenu={(e) => e.preventDefault()}
                >
                    {onReplace && (
                        <button
                            type="button"
                            className="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-sm leading-5 hover:bg-accent hover:text-accent-foreground"
                            onClick={() => {
                                runReplaceFromMenu();
                                closeContextMenu();
                            }}
                        >
                            <RefreshCw className="h-4 w-4 shrink-0 opacity-80" />
                            <span>Replace photo</span>
                        </button>
                    )}
                    {hasFlipAction && (
                        <button
                            type="button"
                            className="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-sm leading-5 hover:bg-accent hover:text-accent-foreground"
                            onClick={() => {
                                onUpdatePanAndZoom?.({
                                    scale: photo?.panAndZoom?.scale ?? 1,
                                    x: photo?.panAndZoom?.x ?? 50,
                                    y: photo?.panAndZoom?.y ?? 50,
                                    flipHorizontal: !(photo?.panAndZoom?.flipHorizontal ?? false),
                                });
                                closeContextMenu();
                            }}
                        >
                            <FlipHorizontal className="h-4 w-4 shrink-0 opacity-80" />
                            <span>{photo?.panAndZoom?.flipHorizontal ? 'Reset horizontal flip' : 'Flip horizontal'}</span>
                        </button>
                    )}
                    {hasEnhanceAction && (
                        <button
                            type="button"
                            className="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-sm leading-5 hover:bg-accent hover:text-accent-foreground"
                            onClick={() => {
                                onEnhanceWithAi?.(pageId!, photo!.id, photo!);
                                closeContextMenu();
                            }}
                        >
                            <Sparkles className="h-4 w-4 shrink-0 opacity-80" />
                            <span>Enhance with AI</span>
                        </button>
                    )}
                    {onRemovePhoto && (
                        <button
                            type="button"
                            className="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-sm leading-5 hover:bg-accent hover:text-accent-foreground"
                            onClick={() => {
                                onRemovePhoto(photo!.id);
                                closeContextMenu();
                            }}
                        >
                            <Trash2 className="h-4 w-4 shrink-0 opacity-80" />
                            <span>Remove photo</span>
                        </button>
                    )}
                    {hasGalleryJump && (
                        <button
                            type="button"
                            className="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-sm leading-5 hover:bg-accent hover:text-accent-foreground"
                            onClick={() => {
                                scrollToGallery?.(galleryPhotoId!);
                                closeContextMenu();
                            }}
                        >
                            <Hash className="h-4 w-4 shrink-0 opacity-80" />
                            <span>Go to photo #{photoNumber}</span>
                        </button>
                    )}
                </div>
            </div>,
            document.body
        )
        : null;

    // SVG Path specific logic: Parse the native viewBox and calculate normalization transform
    const vb = region.viewBox ? region.viewBox.split(' ').map(Number) : [0, 0, 100, 100];
    const [vx, vy, vw, vh] = vb;
    const pathTransform = region.viewBox
        ? `scale(${1 / vw}, ${1 / vh}) translate(${-vx}, ${-vy})`
        : "scale(0.01, 0.01)";

    // Local clip-path calculation using the adjusted container's relative coordinates
    const clipPathStyle = isCircle ? 'circle(closest-side)' : (
        (region.shape === 'path' || (region.shape === 'polygon' && hasValidRoundedPolygonClipPath)) ? `url(#${shapeId}-clip)` : (
            svgPoints ? `polygon(${svgPoints.split(' ').map(p => {
                const [sx, sy] = p.split(',');
                return `${sx}% ${sy}%`;
            }).join(', ')})` : 'none'
        )
    );

    const commonStyle: React.CSSProperties = {
        left: `calc(${region.bounds.x}% + ${insetL}px)`,
        top: `calc(${region.bounds.y}% + ${insetT}px)`,
        width: `calc(${region.bounds.width}% - ${insetL + insetR}px)`,
        height: `calc(${region.bounds.height}% - ${insetT + insetB}px)`,
        zIndex: region.zIndex ?? 0,
        transform: region.rotation ? `rotate(${region.rotation}deg)` : undefined,
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
        onDrop(e);
    };

    // CLEAN RECT PATH: 1:1 Parity with Grid Slots, but with wrapper for Replace Button
    if (isRect) {
        return (
            <div
                ref={rootRef}
                id={shapeId}
                className={cn(
                    "absolute pointer-events-auto transition-all duration-200 group",
                    (!photo || !photo.src) && "cursor-pointer",
                    cornerRadiusNum === 0 && "rounded-none"
                )}
                style={{
                    ...commonStyle,
                    borderRadius: `${cornerRadiusNum}px`,
                    overflow: 'hidden'
                }}
                onClick={(e) => {
                    // Handle click on empty slot
                    if ((!photo || !photo.src) && onReplace) {
                        e.preventDefault();
                        e.stopPropagation();
                        onReplace(e, rootRef.current || undefined);
                    }
                }}
            >
                <div
                    className={cn(
                        "absolute inset-0 overflow-hidden transition-all duration-200",
                        "ring-2 ring-transparent hover:ring-primary/20",
                        isDragOver && "ring-primary ring-offset-2",
                        isDragOver && (!photo || !photo.src) && "bg-primary/10"
                    )}
                    style={{
                        borderRadius: `${cornerRadiusNum}px`,
                        backgroundColor: photoGapNum > 0 ? gapPaintColor : 'transparent',
                        borderTop: shouldForceGapStroke && !isAtTop ? `${photoGapNum}px solid ${gapPaintColor}` : undefined,
                        borderRight: shouldForceGapStroke && !isAtRight ? `${photoGapNum}px solid ${gapPaintColor}` : undefined,
                        borderBottom: shouldForceGapStroke && !isAtBottom ? `${photoGapNum}px solid ${gapPaintColor}` : undefined,
                        borderLeft: shouldForceGapStroke && !isAtLeft ? `${photoGapNum}px solid ${gapPaintColor}` : undefined,
                        ['--tw-ring-offset-color' as any]: gapPaintColor,
                    }}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onContextMenu={openContextMenu}
                >
                    {renderContent()}
                </div>
                {contextMenuOverlay}
            </div>
        );
    }

    // ADVANCED PATH: SVG/Clip-Path for Circles and Polygons
    return (
        <div
            ref={rootRef}
            id={shapeId}
            className={cn(
                "absolute pointer-events-none transition-all duration-200 group"
            )}
            style={commonStyle}
        >
            <div
                className={cn(
                    "absolute inset-0 pointer-events-auto overflow-hidden transition-all duration-200",
                    isDragOver && (!photo || !photo.src) && "bg-primary/10",
                    (!photo || !photo.src) && "cursor-pointer"
                )}
                style={{
                    backgroundColor: photoGapNum > 0 ? gapPaintColor : 'transparent',
                    clipPath: clipPathStyle,
                    WebkitClipPath: clipPathStyle,
                }}
                onClick={(e) => {
                    if ((!photo || !photo.src) && onReplace) {
                        e.preventDefault();
                        e.stopPropagation();
                        onReplace(e, rootRef.current || undefined);
                    }
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onContextMenu={openContextMenu}
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
                            stroke={gapPaintColor}
                            strokeWidth={photoGapNum}
                            vectorEffect="non-scaling-stroke"
                        />
                    )}
                    {region.shape === 'path' && region.path && (
                        <path
                            d={region.path}
                            transform={`scale(${100 / vw}, ${100 / vh}) translate(${-vx}, ${-vy})`}
                            fill="none"
                            stroke={gapPaintColor}
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
                    <clipPath id={`${shapeId}-clip`} clipPathUnits="objectBoundingBox">
                        {region.shape === 'path' && region.path && (
                            <path d={region.path} transform={pathTransform} />
                        )}
                        {region.shape === 'polygon' && hasValidRoundedPolygonClipPath && (
                            <path d={roundedPolygonClipPathD} />
                        )}
                    </clipPath>
                    <mask id={maskId} maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox">
                        <rect x="-1" y="-1" width="3" height="3" fill="white" />
                        {isCircle ? (
                            <ellipse cx="0.5" cy="0.5" rx="0.5" ry="0.5" fill="black" />
                        ) : (
                            region.shape === 'path' ? (
                                <path d={region.path} fill="black" transform={pathTransform} />
                            ) : hasValidRoundedPolygonClipPath ? (
                                <path d={roundedPolygonClipPathD} fill="black" />
                            ) : (
                                <polygon points={svgPoints} fill="black" transform="scale(0.01, 0.01)" />
                            )
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
                                fill="none" stroke={gapPaintColor} strokeWidth="4"
                                strokeLinejoin="round" vectorEffect="non-scaling-stroke"
                            />
                        </>
                    ) : region.shape === 'path' ? (
                        <>
                            <path
                                d={region.path}
                                transform={pathTransform}
                                fill="none" stroke={isDragOver ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.2)"} strokeWidth="8"
                                strokeLinejoin="round" vectorEffect="non-scaling-stroke"
                            />
                            <path
                                d={region.path}
                                transform={pathTransform}
                                fill="none" stroke={gapPaintColor} strokeWidth="4"
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
                                fill="none" stroke={gapPaintColor} strokeWidth="4"
                                strokeLinejoin="round" vectorEffect="non-scaling-stroke"
                            />
                        </>
                    )}
                </g>
            </svg>

            {/* Right-click context menu portal */}
            {contextMenuOverlay}
        </div>
    );
};

