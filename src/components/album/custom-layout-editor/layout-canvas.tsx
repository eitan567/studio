'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { AlbumPage, AlbumConfig } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AdvancedTemplate } from '@/lib/advanced-layout-types';
import { ShapeRegion } from '../layouts/shape-region';
import { ToolMode } from './layout-sidebar-left';
import { Segment, Point } from '@/lib/layout-geometry';

interface LayoutCanvasProps {
    page: AlbumPage;
    config?: AlbumConfig;
    onUpdatePage: (page: AlbumPage) => void;
    advancedTemplate?: AdvancedTemplate | null;
    toolMode?: ToolMode;
    strokes?: Segment[];
    onUpdateStrokes?: (strokes: Segment[]) => void;
}

type TransformMode = 'none' | 'move' | 'resize' | 'rotate';

interface ShapeData {
    indices: number[];
    polygon: Point[];
    bbox: { minX: number; minY: number; maxX: number; maxY: number; centerX: number; centerY: number; width: number; height: number };
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
    const wrapperRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const interactionRef = useRef<HTMLDivElement>(null);

    // --- STATE ---
    const [scale, setScale] = useState(1);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentStroke, setCurrentStroke] = useState<Segment | null>(null);
    const [currentPath, setCurrentPath] = useState<Point[]>([]);
    const [selectedShapeIndex, setSelectedShapeIndex] = useState<number | null>(null);
    const [transformMode, setTransformMode] = useState<TransformMode>('none');
    const [resizeHandle, setResizeHandle] = useState<number | null>(null);

    // Preview state for shapes being drawn
    const [previewShape, setPreviewShape] = useState<{ type: 'rect' | 'circle'; points: Point[] } | null>(null);

    // Refs
    const currentPathRef = useRef<Point[]>([]);
    const currentStrokeRef = useRef<Segment | null>(null);
    const isDrawingRef = useRef(false);
    const dragStartRef = useRef<{ point: Point; origPoints: Point[]; bbox: ShapeData['bbox'] } | null>(null);

    // --- UTILS ---
    const getBoundingBox = (polygon: Point[]) => {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        polygon.forEach(p => {
            minX = Math.min(minX, p[0]);
            minY = Math.min(minY, p[1]);
            maxX = Math.max(maxX, p[0]);
            maxY = Math.max(maxY, p[1]);
        });
        return { minX, minY, maxX, maxY, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2, width: maxX - minX, height: maxY - minY };
    };

    const rotatePoint = (p: Point, center: Point, angle: number): Point => {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const dx = p[0] - center[0];
        const dy = p[1] - center[1];
        return [center[0] + dx * cos - dy * sin, center[1] + dx * sin + dy * cos] as Point;
    };

    const distance = (p1: Point, p2: Point): number => Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));

    // --- SHAPE DETECTION ---
    const shapesRef = useRef<ShapeData[]>([]);

    const detectShapes = useCallback((strokes: Segment[]) => {
        const adj = new Map<number, number[]>();
        strokes.forEach((_, i) => adj.set(i, []));

        const EPSILON = 0.1;
        const isPointEqual = (a: Point, b: Point) => Math.abs(a[0] - b[0]) < EPSILON && Math.abs(a[1] - b[1]) < EPSILON;

        for (let i = 0; i < strokes.length; i++) {
            for (let j = i + 1; j < strokes.length; j++) {
                const s1 = strokes[i];
                const s2 = strokes[j];
                if (isPointEqual(s1.p1, s2.p1) || isPointEqual(s1.p1, s2.p2) ||
                    isPointEqual(s1.p2, s2.p1) || isPointEqual(s1.p2, s2.p2)) {
                    adj.get(i)!.push(j);
                    adj.get(j)!.push(i);
                }
            }
        }

        const visited = new Set<number>();
        const shapes: ShapeData[] = [];

        for (let i = 0; i < strokes.length; i++) {
            if (visited.has(i)) continue;

            const component: number[] = [];
            const queue = [i];
            visited.add(i);

            while (queue.length > 0) {
                const curr = queue.shift()!;
                component.push(curr);
                for (const neighbor of adj.get(curr)!) {
                    if (!visited.has(neighbor)) {
                        visited.add(neighbor);
                        queue.push(neighbor);
                    }
                }
            }

            const pointSet = new Map<string, Point>();
            component.forEach(idx => {
                const s = strokes[idx];
                const key1 = `${s.p1[0].toFixed(2)},${s.p1[1].toFixed(2)}`;
                const key2 = `${s.p2[0].toFixed(2)},${s.p2[1].toFixed(2)}`;
                pointSet.set(key1, s.p1);
                pointSet.set(key2, s.p2);
            });

            const polygon = Array.from(pointSet.values());
            shapes.push({ indices: component, polygon, bbox: getBoundingBox(polygon) });
        }

        shapesRef.current = shapes;
    }, []);

    useEffect(() => { detectShapes(strokes); }, [strokes, detectShapes]);

    // --- CONFIG ---
    const BASE_PAGE_PX = 450;
    let configW = 20, configH = 20;
    if (config?.size) {
        const parts = config.size.split('x').map(Number);
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            configW = parts[0];
            configH = parts[1];
        }
    }

    const pxPerUnit = BASE_PAGE_PX / configH;
    const pageW_px = configW * pxPerUnit;
    const pageH_px = BASE_PAGE_PX;
    const isFull = page.spreadMode === 'full';
    const logicalWidth = pageW_px * 2;
    const logicalHeight = pageH_px;
    const photoGap = page.photoGap ?? config?.photoGap ?? 0;
    const pageMargin = page.pageMargin ?? config?.pageMargin ?? 0;
    const backgroundColor = config?.backgroundColor || '#ffffff';

    // --- AUTO-SCALE ---
    useEffect(() => {
        if (!wrapperRef.current) return;
        const measure = () => {
            const wrapper = wrapperRef.current;
            if (!wrapper) return;
            const { width: availW, height: availH } = wrapper.getBoundingClientRect();
            if (availW === 0 || availH === 0) return;
            const scaleX = availW / logicalWidth;
            const scaleY = availH / logicalHeight;
            setScale(Math.min(scaleX, scaleY) * 0.85);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(wrapperRef.current);
        return () => observer.disconnect();
    }, [logicalWidth, logicalHeight]);

    // --- MOUSE HANDLERS ---
    const getPointFromEvent = (clientX: number, clientY: number, rect: DOMRect): Point | null => {
        if (!rect.width || !rect.height) return null;
        const relX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const relY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
        const aspectRatio = logicalWidth / logicalHeight;
        return [relX * 100 * aspectRatio, relY * 100] as Point;
    };

    const getResizeHandles = (bbox: ShapeData['bbox']): Point[] => [
        [bbox.minX, bbox.minY] as Point,      // 0: top-left
        [bbox.centerX, bbox.minY] as Point,    // 1: top
        [bbox.maxX, bbox.minY] as Point,       // 2: top-right
        [bbox.maxX, bbox.centerY] as Point,    // 3: right
        [bbox.maxX, bbox.maxY] as Point,       // 4: bottom-right
        [bbox.centerX, bbox.maxY] as Point,     // 5: bottom
        [bbox.minX, bbox.maxY] as Point,       // 6: bottom-left
        [bbox.minX, bbox.centerY] as Point,    // 7: left
    ];

    const handleMouseDown = (e: React.MouseEvent) => {
        if (toolMode === 'select' || !onUpdateStrokes) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const point = getPointFromEvent(e.clientX, e.clientY, rect);
        if (!point) return;

        setIsDrawing(true);
        isDrawingRef.current = true;

        if (toolMode === 'freehand') {
            currentPathRef.current = [point];
            setCurrentPath([point]);
            currentStrokeRef.current = null;
            setCurrentStroke(null);
        } else {
            const stroke = { p1: point, p2: point };
            currentStrokeRef.current = stroke;
            setCurrentStroke(stroke);
            setPreviewShape(null);
        }
    };

    const handleSelectMouseDown = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const point = getPointFromEvent(e.clientX, e.clientY, rect);
        if (!point) return;

        const shapes = shapesRef.current;

        // Check resize handles
        if (selectedShapeIndex !== null) {
            const shape = shapes[selectedShapeIndex];
            if (shape) {
                const handles = getResizeHandles(shape.bbox);
                for (let i = 0; i < 8; i++) {
                    if (distance(point, handles[i]) < 8) {
                        setResizeHandle(i);
                        setTransformMode('resize');
                        dragStartRef.current = { point, origPoints: shape.polygon, bbox: shape.bbox };
                        return;
                    }
                }
                // Check rotation handle
                const rotHandle: Point = [shape.bbox.centerX, shape.bbox.minY - 15];
                if (distance(point, rotHandle) < 10) {
                    setTransformMode('rotate');
                    dragStartRef.current = { point, origPoints: shape.polygon, bbox: shape.bbox };
                    return;
                }
            }
        }

        // Find shape by bbox
        let foundIdx = -1;
        for (let i = shapes.length - 1; i >= 0; i--) {
            const bbox = shapes[i].bbox;
            if (point[0] >= bbox.minX - 3 && point[0] <= bbox.maxX + 3 &&
                point[1] >= bbox.minY - 3 && point[1] <= bbox.maxY + 3) {
                foundIdx = i;
                break;
            }
        }

        if (foundIdx >= 0) {
            setSelectedShapeIndex(foundIdx);
            setTransformMode('move');
            dragStartRef.current = { point, origPoints: shapes[foundIdx].polygon, bbox: shapes[foundIdx].bbox };
        } else {
            setSelectedShapeIndex(null);
            setTransformMode('none');
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const point = getPointFromEvent(e.clientX, e.clientY, rect);
        if (!point || !onUpdateStrokes) return;

        // Drawing mode - show preview shape
        if (isDrawing && (toolMode === 'rect' || toolMode === 'circle')) {
            const stroke = currentStrokeRef.current;
            if (stroke) {
                const p1 = stroke.p1;
                const p2 = point;

                if (toolMode === 'rect') {
                    const x1 = Math.min(p1[0], p2[0]);
                    const y1 = Math.min(p1[1], p2[1]);
                    const x2 = Math.max(p1[0], p2[0]);
                    const y2 = Math.max(p1[1], p2[1]);
                    const poly: Point[] = [
                        [x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]
                    ];
                    setPreviewShape({ type: 'rect', points: poly });
                } else if (toolMode === 'circle') {
                    const cx = (p1[0] + p2[0]) / 2;
                    const cy = (p1[1] + p2[1]) / 2;
                    const rx = Math.abs(p2[0] - p1[0]) / 2;
                    const ry = Math.abs(p2[1] - p1[1]) / 2;
                    const steps = 48;
                    const poly: Point[] = [];
                    for (let i = 0; i <= steps; i++) {
                        const ang = (Math.PI * 2 * i) / steps;
                        poly.push([cx + rx * Math.cos(ang), cy + ry * Math.sin(ang)]);
                    }
                    setPreviewShape({ type: 'circle', points: poly });
                }
            }
            return;
        }

        if (isDrawing) {
            if (toolMode === 'freehand') {
                const prev = currentPathRef.current;
                if (prev.length > 0) {
                    const last = prev[prev.length - 1];
                    if (distance(point, last) > 0.2) {
                        currentPathRef.current = [...prev, point];
                        setCurrentPath(currentPathRef.current);
                    }
                } else {
                    currentPathRef.current = [point];
                    setCurrentPath([point]);
                }
            } else {
                currentStrokeRef.current = currentStrokeRef.current ? { ...currentStrokeRef.current, p2: point } : null;
                setCurrentStroke(currentStrokeRef.current);
            }
            return;
        }

        // Transform mode
        if (transformMode === 'none' || !dragStartRef.current) return;

        const start = dragStartRef.current;
        const origPoints = start.origPoints;
        const origBbox = start.bbox;

        if (transformMode === 'move') {
            const dx = point[0] - start.point[0];
            const dy = point[1] - start.point[1];
            if (distance(point, start.point) > 0.5) {
                const newStrokes = strokes.map((s, i) => {
                    const shape = shapesRef.current.find(sh => sh.indices.includes(i));
                    if (shape && shape.polygon.some(p => distance(p, s.p1) < 0.5)) {
                        return { p1: [s.p1[0] + dx, s.p1[1] + dy] as Point, p2: [s.p2[0] + dx, s.p2[1] + dy] as Point };
                    }
                    return s;
                });
                onUpdateStrokes(newStrokes);
                dragStartRef.current = { ...start, point };
            }
        } else if (transformMode === 'resize' && selectedShapeIndex !== null) {
            const shape = shapesRef.current[selectedShapeIndex];
            if (!shape) return;

            const handles = getResizeHandles(origBbox);
            const oppHandles = [4, 5, 6, 7, 0, 1, 2, 3];
            const oppIdx = oppHandles[resizeHandle!];
            const oppHandle = handles[oppIdx];
            const currHandle = handles[resizeHandle!];

            // Calculate scale factors - single axis for edge handles
            let scaleX: number, scaleY: number;

            // Handle types: corner (0,2,4,6) vs edge (1,3,5,7)
            const isCorner = [0, 2, 4, 6].includes(resizeHandle!);
            const isTopBottom = [1, 5].includes(resizeHandle!);  // top=1, bottom=5
            const isLeftRight = [3, 7].includes(resizeHandle!);  // right=3, left=7

            if (isCorner) {
                scaleX = (point[0] - oppHandle[0]) / (currHandle[0] - oppHandle[0] || 1);
                scaleY = (point[1] - oppHandle[1]) / (currHandle[1] - oppHandle[1] || 1);
            } else if (isTopBottom) {
                // Scale only Y, X stays same
                scaleX = 1;
                scaleY = (point[1] - oppHandle[1]) / (currHandle[1] - oppHandle[1] || 1);
            } else if (isLeftRight) {
                // Scale only X, Y stays same
                scaleX = (point[0] - oppHandle[0]) / (currHandle[0] - oppHandle[0] || 1);
                scaleY = 1;
            } else {
                scaleX = 1;
                scaleY = 1;
            }

            const newPoints = origPoints.map((p: Point) => [
                oppHandle[0] + (p[0] - oppHandle[0]) * scaleX,
                oppHandle[1] + (p[1] - oppHandle[1]) * scaleY
            ] as Point);

            const newStrokes = strokes.map((s, i) => {
                if (!shape.indices.includes(i)) return s;
                const idx1 = shape.polygon.findIndex((p: Point) => distance(p, s.p1) < 0.5);
                const idx2 = shape.polygon.findIndex((p: Point) => distance(p, s.p2) < 0.5);
                if (idx1 >= 0 && idx2 >= 0) {
                    return { p1: newPoints[idx1], p2: newPoints[idx2] };
                }
                return s;
            });
            onUpdateStrokes(newStrokes);
        } else if (transformMode === 'rotate') {
            const shape = selectedShapeIndex !== null ? shapesRef.current[selectedShapeIndex] : null;
            if (!shape) return;

            const angle = Math.atan2(point[1] - origBbox.centerY, point[0] - origBbox.centerX) -
                Math.atan2(start.point[1] - origBbox.centerY, start.point[0] - origBbox.centerX);

            if (Math.abs(angle) > 0.005) {
                const center: Point = [origBbox.centerX, origBbox.centerY];
                const newPoints = origPoints.map((p: Point) => rotatePoint(p, center, angle));

                const newStrokes = strokes.map((s, i) => {
                    if (!shape.indices.includes(i)) return s;
                    const idx1 = shape.polygon.findIndex((p: Point) => distance(p, s.p1) < 0.5);
                    const idx2 = shape.polygon.findIndex((p: Point) => distance(p, s.p2) < 0.5);
                    if (idx1 >= 0 && idx2 >= 0) {
                        return { p1: newPoints[idx1], p2: newPoints[idx2] };
                    }
                    return s;
                });
                onUpdateStrokes(newStrokes);
                dragStartRef.current = { ...start, point };
            }
        }
    };

    const handleMouseUp = () => {
        // Finalize drawing
        if (isDrawing && onUpdateStrokes) {
            let newSegments: Segment[] = [];
            const stroke = currentStrokeRef.current;
            const preview = previewShape;

            // For rect/circle, use preview shape if available
            if (preview && preview.points.length > 1) {
                for (let i = 0; i < preview.points.length - 1; i++) {
                    newSegments.push({ p1: preview.points[i], p2: preview.points[i + 1] });
                }
            } else if (stroke && (Math.abs(stroke.p1[0] - stroke.p2[0]) > 0.1 || Math.abs(stroke.p1[1] - stroke.p2[1]) > 0.1)) {
                newSegments = [stroke];
            }

            if (newSegments.length > 0) {
                onUpdateStrokes([...strokes, ...newSegments]);
            }
        }

        setIsDrawing(false);
        isDrawingRef.current = false;
        setCurrentStroke(null);
        currentStrokeRef.current = null;
        setCurrentPath([]);
        currentPathRef.current = [];
        setPreviewShape(null);
        setTransformMode('none');
        setResizeHandle(null);
        dragStartRef.current = null;
    };

    // Keyboard handler
    useEffect(() => {
        if (toolMode !== 'select' || selectedShapeIndex === null || !onUpdateStrokes) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                const shape = shapesRef.current[selectedShapeIndex];
                if (shape) {
                    const newStrokes = strokes.filter((_, i) => !shape.indices.includes(i));
                    onUpdateStrokes(newStrokes);
                    setSelectedShapeIndex(null);
                }
            } else if (e.key === 'Escape') {
                setSelectedShapeIndex(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toolMode, selectedShapeIndex, strokes, onUpdateStrokes]);

    const selectedShape = selectedShapeIndex !== null ? shapesRef.current[selectedShapeIndex] : null;

    return (
        <div ref={wrapperRef} className="w-full h-full bg-muted/20 overflow-hidden relative flex items-center justify-center select-none">
            <div
                ref={canvasRef}
                style={{ width: logicalWidth, height: logicalHeight, transform: `scale(${scale})`, backgroundColor, border: '1px solid #ccc' }}
                className="relative overflow-hidden"
            >
                <div
                    ref={interactionRef}
                    className={cn("absolute inset-0 z-10", toolMode === 'select' ? "cursor-default" : "cursor-crosshair")}
                    style={{ padding: 0, margin: `${pageMargin}px`, width: logicalWidth - pageMargin * 2, height: logicalHeight - pageMargin * 2 }}
                    onMouseDown={toolMode === 'select' ? handleSelectMouseDown : handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {/* Content Layer */}
                    <div className={cn("absolute inset-0 w-full h-full", toolMode !== 'select' && "pointer-events-none")}>
                        {advancedTemplate ? (
                            <div className="relative w-full h-full">
                                {advancedTemplate.regions.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)).map((region, index) => (
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

                    {/* Vector Overlay */}
                    {(strokes.length > 0 || currentStroke || currentPath.length > 0 || previewShape) && (
                        <svg className="absolute inset-0 z-50 overflow-visible" style={{ pointerEvents: 'none' }} viewBox={`0 0 ${100 * (logicalWidth / logicalHeight)} 100`} preserveAspectRatio="none">
                            {strokes.map((s, i) => {
                                const isSelected = selectedShape?.indices.includes(i);
                                return (
                                    <line key={i} x1={s.p1[0]} y1={s.p1[1]} x2={s.p2[0]} y2={s.p2[1]}
                                        stroke={isSelected ? "#3b82f6" : "black"} strokeWidth={isSelected ? "0.75" : "0.5"}
                                        vectorEffect="non-scaling-stroke" />
                                );
                            })}
                            {currentPath.length > 1 && (
                                <polyline points={currentPath.map(p => `${p[0]},${p[1]}`).join(' ')} fill="none" stroke="red" strokeWidth="0.75" strokeDasharray="1 1" vectorEffect="non-scaling-stroke" />
                            )}
                            {previewShape && (
                                <polygon points={previewShape.points.map(p => `${p[0]},${p[1]}`).join(' ')} fill="rgba(255,0,0,0.1)" stroke="red" strokeWidth="0.75" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
                            )}
                        </svg>
                    )}

                    {/* Selection Handles */}
                    {selectedShape && (
                        <svg className="absolute inset-0 z-50 overflow-visible" style={{ pointerEvents: 'none' }} viewBox={`0 0 ${100 * (logicalWidth / logicalHeight)} 100`} preserveAspectRatio="none">
                            <rect x={selectedShape.bbox.minX} y={selectedShape.bbox.minY}
                                width={selectedShape.bbox.width} height={selectedShape.bbox.height}
                                fill="none" stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
                            {getResizeHandles(selectedShape.bbox).map((h, i) => (
                                <rect key={i} x={h[0] - 3} y={h[1] - 3} width={6} height={6} fill="white" stroke="#3b82f6" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                            ))}
                            <line x1={selectedShape.bbox.centerX} y1={selectedShape.bbox.minY} x2={selectedShape.bbox.centerX} y2={selectedShape.bbox.minY - 15}
                                stroke="#3b82f6" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                            <circle cx={selectedShape.bbox.centerX} cy={selectedShape.bbox.minY - 15} r={5} fill="white" stroke="#3b82f6" strokeWidth="0.5" />
                        </svg>
                    )}
                </div>
            </div>
        </div>
    );
};
