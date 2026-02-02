import { useRef, useState, useEffect } from 'react';
import { AlbumPage, AlbumConfig, PhotoPanAndZoom, Photo } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PageLayout } from '../layouts/page-layout';
import { useTemplates, getPhotoCount } from '@/hooks/useTemplates';
import { AdvancedTemplate, LayoutRegion, regionToClipPath } from '@/lib/advanced-layout-types';
import { PhotoRenderer } from '../layouts/photo-renderer';
import { Image as ImageIcon, Plus } from 'lucide-react';
import { ShapeRegion } from '../layouts/shape-region';
import { ToolMode } from './layout-sidebar-left';
import { Segment, Point } from '@/lib/layout-geometry';

interface LayoutCanvasProps {
    page: AlbumPage;
    config?: AlbumConfig;
    onUpdatePage: (page: AlbumPage) => void;
    advancedTemplate?: AdvancedTemplate | null;
    // New Vector Props
    toolMode?: ToolMode;
    strokes?: Segment[];
    onUpdateStrokes?: (strokes: Segment[]) => void;
}

export const LayoutCanvas = ({
    page,
    config,
    onUpdatePage,
    advancedTemplate,
    toolMode = 'select',
    strokes = [],
    onUpdateStrokes
}: LayoutCanvasProps) => {
    const { findGridTemplate, defaultGridTemplate } = useTemplates();
    const wrapperRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);

    // --- STATE ---
    const [scale, setScale] = useState(1);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentStroke, setCurrentStroke] = useState<Segment | null>(null);
    const [currentPath, setCurrentPath] = useState<Point[]>([]);

    // --- CONFIG & DIMENSIONS ---
    const BASE_PAGE_PX = 450;

    // Parse Config
    let configW = 20;
    let configH = 20;
    if (config?.size) {
        const parts = config.size.split('x').map(Number);
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            configW = parts[0];
            configH = parts[1];
        }
    }

    // Calculate Logical Container Dimensions
    const pxPerUnit = BASE_PAGE_PX / configH;
    const pageW_px = configW * pxPerUnit;
    const pageH_px = BASE_PAGE_PX;

    // Double page spread for Split mode, single for Full mode
    const isFull = page.spreadMode === 'full';
    const logicalWidth = pageW_px * 2;
    const logicalHeight = pageH_px;

    // Get spacing values
    const photoGap = page.photoGap ?? config?.photoGap ?? 0;
    const pageMargin = page.pageMargin ?? config?.pageMargin ?? 0;
    const backgroundColor = config?.backgroundColor || '#ffffff';

    // --- AUTO-SCALE & CENTER ---
    useEffect(() => {
        if (!wrapperRef.current) return;

        const measure = () => {
            const wrapper = wrapperRef.current;
            if (!wrapper) return;
            const { width: availW, height: availH } = wrapper.getBoundingClientRect();

            if (availW === 0 || availH === 0) return;

            // Compute Scale
            const scaleX = availW / logicalWidth;
            const scaleY = availH / logicalHeight;
            const fitScale = Math.min(scaleX, scaleY) * 0.85; // 15% padding

            setScale(fitScale);
        };

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(wrapperRef.current);

        return () => observer.disconnect();
    }, [logicalWidth, logicalHeight]);


    // --- SNAP LOGIC ---
    const SNAP_THRESHOLD = 2.5; // 2.5% of canvas size

    const snapPoint = (p: Point, activeStrokes: Segment[]): Point => {
        let bestP = [...p] as Point;
        let minDesc = SNAP_THRESHOLD * SNAP_THRESHOLD; // Squared distance

        // 1. Snap to Borders
        if (Math.abs(p[0] - 0) < SNAP_THRESHOLD) bestP[0] = 0;
        if (Math.abs(p[0] - 100) < SNAP_THRESHOLD) bestP[0] = 100;
        if (Math.abs(p[1] - 0) < SNAP_THRESHOLD) bestP[1] = 0;
        if (Math.abs(p[1] - 100) < SNAP_THRESHOLD) bestP[1] = 100;

        // 2. Snap to Existing Points (Endpoints)
        activeStrokes.forEach(s => {
            [s.p1, s.p2].forEach(ep => {
                const dx = p[0] - ep[0];
                const dy = p[1] - ep[1];
                const d2 = dx * dx + dy * dy;
                if (d2 < minDesc) {
                    minDesc = d2;
                    bestP = [...ep] as Point;
                }
            });
        });

        return bestP;
    };

    // --- DRAWING HANDLERS ---
    const getPoint = (e: React.MouseEvent<HTMLDivElement>): Point | null => {
        const rect = e.currentTarget.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;

        // Calculate relative position within the container (0 to 1)
        const relX = (e.clientX - rect.left) / rect.width;
        const relY = (e.clientY - rect.top) / rect.height;

        // Convert to 0-100 logical units, BUT we must respect the container's aspect ratio
        // to prevent warping. The geometry engine assumes a 1:1 unit scale.
        // So 1 unit in X must be the same physical distance as 1 unit in Y.

        // We Use 100 as the "base" for the Height (y is always 0-100)
        // And x will be 0 to (100 * aspectRatio)
        const aspectRatio = logicalWidth / logicalHeight;
        let x = relX * 100 * aspectRatio;
        let y = relY * 100;

        // SNAP TO EDGES (Adjusted for aspect ratio)
        const EDGE_SNAP = 1.5;
        const maxX = 100 * aspectRatio;
        if (x < EDGE_SNAP) x = 0;
        if (x > maxX - EDGE_SNAP) x = maxX;
        if (y < EDGE_SNAP) y = 0;
        if (y > 100 - EDGE_SNAP) y = 100;

        const p: Point = [
            Math.max(0, Math.min(maxX, x)),
            Math.max(0, Math.min(100, y))
        ];

        return toolMode === 'freehand' ? p : snapPoint(p, strokes);
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (toolMode === 'select' || !onUpdateStrokes) return;

        const start = getPoint(e);
        if (!start) return;

        setIsDrawing(true);
        if (toolMode === 'freehand') {
            setCurrentPath([start]);
            setCurrentStroke(null);
        } else {
            setCurrentStroke({ p1: start, p2: start });
            setCurrentPath([]);
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDrawing) return;
        const current = getPoint(e);
        if (!current) return;

        if (toolMode === 'freehand') {
            const last = currentPath[currentPath.length - 1];
            if (last) {
                const dx = current[0] - last[0];
                const dy = current[1] - last[1];
                if (dx * dx + dy * dy > 0.05) {
                    setCurrentPath([...currentPath, current]);
                }
            }
        } else if (currentStroke) {
            setCurrentStroke({ ...currentStroke, p2: current });
        }
    };

    const handleMouseUp = () => {
        if (!isDrawing || !onUpdateStrokes) return;

        let newSegments: Segment[] = [];

        if (toolMode === 'freehand' && currentPath.length > 1) {
            for (let i = 0; i < currentPath.length - 1; i++) {
                newSegments.push({ p1: currentPath[i], p2: currentPath[i + 1] });
            }
        } else if (currentStroke && (Math.abs(currentStroke.p1[0] - currentStroke.p2[0]) > 0.1 || Math.abs(currentStroke.p1[1] - currentStroke.p2[1]) > 0.1)) {
            if (toolMode === 'rect') {
                const x1 = Math.min(currentStroke.p1[0], currentStroke.p2[0]);
                const y1 = Math.min(currentStroke.p1[1], currentStroke.p2[1]);
                const x2 = Math.max(currentStroke.p1[0], currentStroke.p2[0]);
                const y2 = Math.max(currentStroke.p1[1], currentStroke.p2[1]);
                newSegments = [
                    { p1: [x1, y1], p2: [x2, y1] },
                    { p1: [x2, y1], p2: [x2, y2] },
                    { p1: [x2, y2], p2: [x1, y2] },
                    { p1: [x1, y2], p2: [x1, y1] }
                ];
            } else if (toolMode === 'circle') {
                const cx = (currentStroke.p1[0] + currentStroke.p2[0]) / 2;
                const cy = (currentStroke.p1[1] + currentStroke.p2[1]) / 2;
                const rx = Math.abs(currentStroke.p2[0] - currentStroke.p1[0]) / 2;
                const ry = Math.abs(currentStroke.p2[1] - currentStroke.p1[1]) / 2;

                const steps = 128; // Increased for "Smooth Circle" feel
                const poly: Point[] = [];
                for (let i = 0; i < steps; i++) {
                    const angle = (Math.PI * 2 * i) / steps;
                    // Support independent rx and ry for true ellipses
                    poly.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]);
                }
                for (let i = 0; i < steps; i++) {
                    newSegments.push({ p1: poly[i], p2: poly[(i + 1) % steps] });
                }
            } else {
                newSegments = [currentStroke];
            }
        }

        if (newSegments.length > 0) {
            onUpdateStrokes([...strokes, ...newSegments]);
        }

        setIsDrawing(false);
        setCurrentStroke(null);
        setCurrentPath([]);
    };

    return (
        <div
            ref={wrapperRef}
            className="w-full h-full bg-muted/20 overflow-hidden relative flex items-center justify-center select-none"
        >
            <div
                ref={canvasRef}
                style={{
                    width: logicalWidth,
                    height: logicalHeight,
                    transform: `scale(${scale})`,
                    backgroundColor,
                    border: '1px solid #ccc',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                }}
                className="relative overflow-hidden"
            >
                {/* 
                  Drawing & Content Area
                  This container is offset by pageMargin to match the logical 0-100 coordinate space 
                  used by processLayoutGeometry and AdvancedTemplate regions.
                */}
                <div
                    className={cn(
                        "absolute inset-0 z-10",
                        toolMode !== 'select' && "cursor-crosshair"
                    )}
                    style={{
                        padding: 0, // No padding here, we use margin to shift the whole thing
                        margin: `${pageMargin}px`,
                        width: logicalWidth - (pageMargin * 2),
                        height: logicalHeight - (pageMargin * 2)
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {/* Content Layer (Non-interactive during drawing) */}
                    <div className={cn("absolute inset-0 w-full h-full", toolMode !== 'select' && "pointer-events-none")}>
                        {advancedTemplate ? (
                            <div className="relative w-full h-full">
                                {[...advancedTemplate.regions]
                                    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
                                    .map((region, index) => (
                                        <ShapeRegion
                                            key={region.id || index}
                                            region={region}
                                            photo={page.photos[index]}
                                            photoGap={photoGap}
                                            backgroundColor={backgroundColor}
                                            containerWidth={logicalWidth - pageMargin * 2}
                                            containerHeight={logicalHeight - pageMargin * 2}
                                            onUpdatePanAndZoom={() => { }}
                                            onInteractionChange={() => { }}
                                            pageId={page.id}
                                        />
                                    ))}
                            </div>
                        ) : isFull ? (
                            <div className="h-full w-full bg-white relative overflow-hidden flex items-center justify-center border-2 border-dashed border-gray-200 text-gray-400">
                                Start Drawing to Create Layout
                            </div>
                        ) : (
                            <div className="flex h-full w-full">
                                <div className="flex-1 border-r border-dashed border-gray-200" />
                                <div className="flex-1" />
                            </div>
                        )}
                    </div>

                    {/* Vector Overlay (Matches the logical coordinate space) */}
                    {(strokes.length > 0 || currentStroke || currentPath.length > 0) && (
                        <svg
                            className="absolute inset-0 pointer-events-none z-50 overflow-visible"
                            viewBox={`0 0 ${100 * (logicalWidth / logicalHeight)} 100`}
                            preserveAspectRatio="none"
                        >
                            {strokes.map((s, i) => (
                                <line
                                    key={i}
                                    x1={s.p1[0]} y1={s.p1[1]}
                                    x2={s.p2[0]} y2={s.p2[1]}
                                    stroke="black"
                                    strokeWidth="0.5"
                                    vectorEffect="non-scaling-stroke"
                                />
                            ))}
                            {currentPath.length > 1 && (
                                <polyline
                                    points={currentPath.map(p => `${p[0]},${p[1]}`).join(' ')}
                                    fill="none"
                                    stroke="red"
                                    strokeWidth="0.75"
                                    strokeDasharray="1 1"
                                    vectorEffect="non-scaling-stroke"
                                />
                            )}
                            {currentStroke && toolMode === 'pencil' && (
                                <line
                                    x1={currentStroke.p1[0]} y1={currentStroke.p1[1]}
                                    x2={currentStroke.p2[0]} y2={currentStroke.p2[1]}
                                    stroke="red"
                                    strokeWidth="0.75"
                                    strokeDasharray="1 1"
                                    vectorEffect="non-scaling-stroke"
                                />
                            )}
                            {currentStroke && toolMode === 'rect' && (
                                <rect
                                    x={Math.min(currentStroke.p1[0], currentStroke.p2[0])}
                                    y={Math.min(currentStroke.p1[1], currentStroke.p2[1])}
                                    width={Math.abs(currentStroke.p2[0] - currentStroke.p1[0])}
                                    height={Math.abs(currentStroke.p2[1] - currentStroke.p1[1])}
                                    fill="rgba(0,0,255,0.1)"
                                    stroke="blue"
                                    strokeWidth="0.5"
                                    vectorEffect="non-scaling-stroke"
                                />
                            )}
                            {currentStroke && toolMode === 'circle' && (
                                <ellipse
                                    cx={(currentStroke.p1[0] + currentStroke.p2[0]) / 2}
                                    cy={(currentStroke.p1[1] + currentStroke.p2[1]) / 2}
                                    rx={Math.abs(currentStroke.p2[0] - currentStroke.p1[0]) / 2}
                                    ry={Math.abs(currentStroke.p2[1] - currentStroke.p1[1]) / 2}
                                    fill="rgba(0,0,255,0.1)"
                                    stroke="blue"
                                    strokeWidth="0.5"
                                    vectorEffect="non-scaling-stroke"
                                />
                            )}
                        </svg>
                    )}
                </div>
            </div>
        </div>
    );
};
