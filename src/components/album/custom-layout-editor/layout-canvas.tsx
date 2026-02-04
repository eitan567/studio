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
    obb: {
        center: Point;
        width: number;
        height: number;
        angle: number;
        minX: number; maxX: number; minY: number; maxY: number;
    };
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

    // --- CONFIG & DIMENSIONS ---
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

    // FIX: Aspect Ratio for corrections
    const innerLogicalWidth = logicalWidth - pageMargin * 2;
    const innerLogicalHeight = logicalHeight - pageMargin * 2;
    const coordinateAspect = innerLogicalWidth / innerLogicalHeight;

    // --- STATE ---
    const [scale, setScale] = useState(1);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentStroke, setCurrentStroke] = useState<Segment | null>(null);
    const [currentPath, setCurrentPath] = useState<Point[]>([]);
    const [selectedShapeIndices, setSelectedShapeIndices] = useState<number[]>([]);
    const [transformMode, setTransformMode] = useState<TransformMode>('none');
    const [resizeHandle, setResizeHandle] = useState<number | null>(null);
    const [selectionBox, setSelectionBox] = useState<{ start: Point; end: Point } | null>(null);
    const [cursorMode, setCursorMode] = useState<string>('default');

    // Preview state for shapes being drawn
    const [previewShape, setPreviewShape] = useState<{ type: 'rect' | 'circle'; points: Point[] } | null>(null);
    const [isSymmetric, setIsSymmetric] = useState(false);

    // Refs
    // Refs
    const currentPathRef = useRef<Point[]>([]);
    const currentStrokeRef = useRef<Segment | null>(null);
    const isDrawingRef = useRef(false);
    const isRotatingRef = useRef(false);
    // Modified to support multi-selection move
    const dragStartRef = useRef<{
        point: Point;
        origPoints: Point[];
        bbox: ShapeData['bbox'];
        startObb?: ShapeData['obb'];
        affectedStrokeIndices?: Set<number>;
        isDuplicating?: boolean;
        initialAltKey?: boolean;
        strokeMapping?: Map<number, { p1: number; p2: number }>;
    } | null>(null);

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

    const getSmartBBox = (points: Point[], preferredAngle?: number): ShapeData['obb'] => {
        if (points.length < 3) {
            const bbox = getBoundingBox(points);
            return {
                center: [bbox.centerX, bbox.centerY],
                width: bbox.width,
                height: bbox.height,
                angle: 0,
                minX: bbox.minX, maxX: bbox.maxX, minY: bbox.minY, maxY: bbox.maxY
            };
        }

        const computeOBBAtAngle = (rad: number) => {
            const cos = Math.cos(-rad);
            const sin = Math.sin(-rad);
            let minU = Infinity, maxU = -Infinity;
            let minV = Infinity, maxV = -Infinity;

            for (const p of points) {
                const u = p[0] * cos - p[1] * sin;
                const v = p[0] * sin + p[1] * cos;
                minU = Math.min(minU, u);
                maxU = Math.max(maxU, u);
                minV = Math.min(minV, v);
                maxV = Math.max(maxV, v);
            }

            const width = maxU - minU;
            const height = maxV - minV;
            const area = width * height;
            const centerU = (minU + maxU) / 2;
            const centerV = (minV + maxV) / 2;

            // Rotate center back
            const cx = centerU * Math.cos(rad) - centerV * Math.sin(rad);
            const cy = centerU * Math.sin(rad) + centerV * Math.cos(rad);

            return {
                center: [cx, cy] as Point,
                width,
                height,
                angle: rad,
                minX: minU, maxX: maxU, minY: minV, maxY: maxV,
                area
            };
        };

        let minArea = Infinity;
        let bestObb: (ShapeData['obb'] & { area: number }) | null = null;

        // 1. Check angles from edges
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            const dx = p2[0] - p1[0];
            const dy = p2[1] - p1[1];
            const angle = Math.atan2(dy, dx);

            const obb = computeOBBAtAngle(angle);
            if (obb.area < minArea - 0.001) { // small tolerance for float noise
                minArea = obb.area;
                bestObb = obb;
            }
        }

        // 2. Check preferred angle (Stability check)
        if (preferredAngle !== undefined && bestObb) {
            const prefObb = computeOBBAtAngle(preferredAngle);
            if (prefObb.area <= minArea * 1.01) {
                return prefObb;
            }
        }

        return bestObb!;
    };

    const rotatePoint = (p: Point, center: Point, angle: number): Point => {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const dx = p[0] - center[0];
        const dy = p[1] - center[1];
        return [center[0] + dx * cos - dy * sin, center[1] + dx * sin + dy * cos] as Point;
    };

    const transformPointToLocal = (p: Point, center: Point, angle: number): Point => {
        const dx = p[0] - center[0];
        const dy = p[1] - center[1];
        const cos = Math.cos(-angle);
        const sin = Math.sin(-angle);
        return [dx * cos - dy * sin, dx * sin + dy * cos];
    };

    const transformPointToWorld = (localP: Point, center: Point, angle: number): Point => {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return [
            center[0] + localP[0] * cos - localP[1] * sin,
            center[1] + localP[0] * sin + localP[1] * cos
        ];
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

            // Try to find matching previous shape to preserve angle
            let preferredAngle: number | undefined;
            if (shapesRef.current) {
                const prev = shapesRef.current.find(s =>
                    s.indices.length === component.length &&
                    s.indices.every((val, idx) => val === component[idx])
                );
                // Only preserve angle if NOT currently rotating
                if (prev && !isRotatingRef.current) preferredAngle = prev.obb.angle;
            }

            shapes.push({ indices: component, polygon, bbox: getBoundingBox(polygon), obb: getSmartBBox(polygon, preferredAngle) });
        }

        shapesRef.current = shapes;
    }, []);

    useEffect(() => { detectShapes(strokes); }, [strokes, detectShapes]);

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

    const getResizeHandles = (obb: ShapeData['obb']): Point[] => {
        const { minX, maxX, minY, maxY, angle } = obb;
        const handlesLocal = [
            [minX, minY], // 0: TL
            [(minX + maxX) / 2, minY], // 1: T
            [maxX, minY], // 2: TR
            [maxX, (minY + maxY) / 2], // 3: R
            [maxX, maxY], // 4: BR
            [(minX + maxX) / 2, maxY], // 5: B
            [minX, maxY], // 6: BL
            [minX, (minY + maxY) / 2]  // 7: L
        ];

        return handlesLocal.map(p => {
            const u = p[0];
            const v = p[1];
            // Rotate back by +angle
            const x = u * Math.cos(angle) - v * Math.sin(angle);
            const y = u * Math.sin(angle) + v * Math.cos(angle);
            return [x, y] as Point;
        });
    };

    const getRotationHandles = (obb: ShapeData['obb']): Point[] => {
        const { minX, maxX, minY, maxY, angle } = obb;
        const offset = 12.5;

        // Corners in local space
        // TL, TR, BR, BL
        const cornersLocal: { u: number, v: number, ox: number, oy: number }[] = [
            { u: minX, v: minY, ox: -offset, oy: -offset }, // TL
            { u: maxX, v: minY, ox: offset, oy: -offset },  // TR
            { u: maxX, v: maxY, ox: offset, oy: offset },   // BR
            { u: minX, v: maxY, ox: -offset, oy: offset }   // BL
        ];

        return cornersLocal.map(p => {
            // Apply offset in world space
            const u = p.u;
            const v = p.v;

            // Rotate the corner point to world
            const wx = u * Math.cos(angle) - v * Math.sin(angle);
            const wy = u * Math.sin(angle) + v * Math.cos(angle);

            // Rotate the offset vector
            const dox = p.ox * Math.cos(angle) - p.oy * Math.sin(angle);
            const doy = p.ox * Math.sin(angle) + p.oy * Math.cos(angle);

            return [wx + dox, wy + doy] as Point;
        });
    };

    // Updated to use coordinateAspect based on inner drawing area to prevent skew
    const getPointFromEvent = (clientX: number, clientY: number, rect: DOMRect) => {
        if (!rect.width || !rect.height) return null;

        const domRatio = rect.width / rect.height;
        let drawWidth = rect.width;
        let drawHeight = rect.height;
        let offsetX = 0;
        let offsetY = 0;

        // "meet" logic:
        // If DOM is wider than Content (domRatio > coordinateAspect) -> Pillarbox (Left/Right bars)
        // If DOM is taller than Content (domRatio < coordinateAspect) -> Letterbox (Top/Bottom bars)

        if (domRatio > coordinateAspect) {
            drawWidth = drawHeight * coordinateAspect;
            offsetX = (rect.width - drawWidth) / 2;
        } else if (domRatio < coordinateAspect) {
            drawHeight = drawWidth / coordinateAspect;
            offsetY = (rect.height - drawHeight) / 2;
        }

        const x = (clientX - rect.left - offsetX) / drawWidth * (100 * coordinateAspect);
        const y = (clientY - rect.top - offsetY) / drawHeight * 100;

        return [x, y] as Point;
    };

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
        const primaryIdx = selectedShapeIndices.length === 1 ? selectedShapeIndices[0] : null;

        // 1. Check Resize/Rotate Handles (Only if exactly one shape is selected)
        if (primaryIdx !== null) {
            const shape = shapes[primaryIdx];
            if (shape) {
                // Compute Stroke Mapping for Rigid Transformation
                const strokeMapping = new Map<number, { p1: number; p2: number }>();
                shape.indices.forEach(idx => {
                    const s = strokes[idx];
                    // Using very small epsilon to match exact vertices
                    const idx1 = shape.polygon.findIndex(p => distance(p, s.p1) < 0.1);
                    const idx2 = shape.polygon.findIndex(p => distance(p, s.p2) < 0.1);
                    if (idx1 >= 0 && idx2 >= 0) {
                        strokeMapping.set(idx, { p1: idx1, p2: idx2 });
                    }
                });

                // Rotation Handles
                const rotHandles = getRotationHandles(shape.obb);
                for (let i = 0; i < 4; i++) {
                    // Strict hit radius matching visual size (1.6) + small margin
                    if (distance(point, rotHandles[i]) < 2.0) {
                        setTransformMode('rotate');
                        isRotatingRef.current = true;
                        dragStartRef.current = { point, origPoints: shape.polygon, bbox: shape.bbox, startObb: shape.obb, strokeMapping };
                        return;
                    }
                }

                // Resize Handles
                const handles = getResizeHandles(shape.obb);
                // Strict hit radius matching visual size (1.2) + small margin
                const hitRadius = 1.5;

                for (let i = 0; i < 8; i++) {
                    if (distance(point, handles[i]) < hitRadius) {
                        setResizeHandle(i);
                        setTransformMode('resize');
                        isRotatingRef.current = false;
                        dragStartRef.current = { point, origPoints: shape.polygon, bbox: shape.bbox, startObb: shape.obb, strokeMapping };
                        return;
                    }
                }
            }
        }

        // 2. Check Shape Hit
        let foundIdx = -1;
        // Check in reverse order (topmost first)
        for (let i = shapes.length - 1; i >= 0; i--) {
            const bbox = shapes[i].bbox;
            if (point[0] >= bbox.minX - 3 && point[0] <= bbox.maxX + 3 &&
                point[1] >= bbox.minY - 3 && point[1] <= bbox.maxY + 3) {
                // Polygon check could be more precise, but bbox is okay for selection
                foundIdx = i;
                break;
            }
        }

        if (foundIdx >= 0) {
            // Clicked on a shape
            let newSelection = [...selectedShapeIndices];

            // If strictly new selection (clicked shape not currently selected), select ONLY it
            // (Unless we add Shift key support later)
            if (!newSelection.includes(foundIdx)) {
                newSelection = [foundIdx];
                setSelectedShapeIndices(newSelection);
            }
            // If clicked shape IS selected, we keep the group selection to allow moving the group.

            setTransformMode('move');
            isRotatingRef.current = false;
            setCursorMode('grabbing');

            // Prepare for move/duplicate: Identify all strokes involved
            const affectedIndices = new Set<number>();
            newSelection.forEach(idx => {
                const s = shapes[idx];
                if (s) {
                    s.indices.forEach(si => affectedIndices.add(si));
                }
            });

            dragStartRef.current = {
                point,
                origPoints: shapes[foundIdx].polygon,
                bbox: shapes[foundIdx].bbox,
                startObb: shapes[foundIdx].obb,
                affectedStrokeIndices: affectedIndices,
                initialAltKey: e.altKey,
                isDuplicating: false
            };

        } else {
            // Clicked on empty space -> Start Selection Box
            setSelectedShapeIndices([]); // Clear selection
            setSelectionBox({ start: point, end: point });
            setTransformMode('none'); // We'll handle box update in mouseMove, maybe distinct mode?
            // Actually, let's use a flag or check selectionBox !== null
            isRotatingRef.current = false;
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

        // Selection Box Update
        if (selectionBox && transformMode === 'none') {
            setSelectionBox({ ...selectionBox, end: point });
            return;
        }

        // Transform mode logic & Cursor Feedback
        if (transformMode === 'none') {
            // Hover Logic for Cursor Feedback
            if (toolMode === 'select') {
                let newCursor = 'default';
                const shapes = shapesRef.current;
                const primaryIdx = selectedShapeIndices.length === 1 ? selectedShapeIndices[0] : null;

                if (primaryIdx !== null) {
                    const shape = shapes[primaryIdx];
                    if (shape) {
                        // Check Rotation Handles
                        const rotHandles = getRotationHandles(shape.obb);
                        let overRot = false;
                        for (let i = 0; i < 4; i++) {
                            if (distance(point, rotHandles[i]) < 2.0) {
                                overRot = true;
                                break;
                            }
                        }
                        if (overRot) {
                            newCursor = 'alias';
                        } else {
                            // Check Resize Handles
                            const handles = getResizeHandles(shape.obb);
                            let overResize = false;
                            for (let i = 0; i < 8; i++) {
                                if (distance(point, handles[i]) < 1.5) {
                                    overResize = true;
                                    break;
                                }
                            }
                            if (overResize) {
                                newCursor = 'pointer';
                            } else {
                                // Check Shape Body (for move)
                                let overShape = false;
                                for (let i = shapes.length - 1; i >= 0; i--) {
                                    const bbox = shapes[i].bbox;
                                    if (point[0] >= bbox.minX && point[0] <= bbox.maxX &&
                                        point[1] >= bbox.minY && point[1] <= bbox.maxY) {
                                        overShape = true;
                                        break;
                                    }
                                }
                                if (overShape) newCursor = 'grab';
                            }
                        }
                    }
                } else {
                    // Check Shape Body (No selection or multi-selection)
                    let overShape = false;
                    for (let i = shapes.length - 1; i >= 0; i--) {
                        const bbox = shapes[i].bbox;
                        if (point[0] >= bbox.minX && point[0] <= bbox.maxX &&
                            point[1] >= bbox.minY && point[1] <= bbox.maxY) {
                            overShape = true;
                            break;
                        }
                    }
                    if (overShape) newCursor = 'grab';
                }
                if (cursorMode !== newCursor) setCursorMode(newCursor);
            }
            if (!dragStartRef.current) return;
        }

        if (!dragStartRef.current) return;
        const start = dragStartRef.current;

        // Multi-Move Logic
        if (transformMode === 'move') {
            const dx = point[0] - start.point[0];
            const dy = point[1] - start.point[1];

            if (distance(point, start.point) > 0.5) {
                let currentStrokes = strokes;
                let indicesToMove = start.affectedStrokeIndices || new Set<number>();

                // Duplication Logic (Alt + Drag)
                if (start.initialAltKey && !start.isDuplicating) {
                    start.isDuplicating = true;
                    const clones: Segment[] = [];
                    const newIndices = new Set<number>();
                    let nextIdx = strokes.length;

                    start.affectedStrokeIndices?.forEach(idx => {
                        if (strokes[idx]) {
                            clones.push({ ...strokes[idx] });
                            newIndices.add(nextIdx++);
                        }
                    });

                    if (clones.length > 0) {
                        currentStrokes = [...strokes, ...clones];
                        indicesToMove = newIndices;
                        start.affectedStrokeIndices = newIndices; // Point to new clones for future moves
                        setSelectedShapeIndices([]); // Clear selection of original
                    }
                }

                if (indicesToMove.size > 0) {
                    const newStrokes = currentStrokes.map((s, i) => {
                        if (indicesToMove.has(i)) {
                            return { p1: [s.p1[0] + dx, s.p1[1] + dy] as Point, p2: [s.p2[0] + dx, s.p2[1] + dy] as Point };
                        }
                        return s;
                    });
                    onUpdateStrokes(newStrokes);
                    dragStartRef.current = { ...start, point };
                }
            }
        } else if (transformMode === 'resize' && selectedShapeIndices.length === 1) {
            // Single Shape Resize
            const shape = shapesRef.current[selectedShapeIndices[0]];
            if (!shape) return;

            const startObb = start.startObb;
            const origPoints = start.origPoints; // This should be correct for single shape
            if (!startObb) return;

            // Local Mouse Point (u, v)
            const localMouse = transformPointToLocal(point, startObb.center, startObb.angle);
            // Local Handle Orig (u, v)
            const handles = getResizeHandles(startObb).map(h => transformPointToLocal(h, startObb.center, startObb.angle));

            const oppHandles = [4, 5, 6, 7, 0, 1, 2, 3];
            const oppIdx = oppHandles[resizeHandle!];
            const oppHandleLocal = handles[oppIdx];
            const currHandleLocal = handles[resizeHandle!];

            // Calculate scale in local space
            let scaleU = 1, scaleV = 1;

            const isCorner = [0, 2, 4, 6].includes(resizeHandle!);
            const isTopBottom = [1, 5].includes(resizeHandle!);
            const isLeftRight = [3, 7].includes(resizeHandle!);

            const dimU = currHandleLocal[0] - oppHandleLocal[0];
            const dimV = currHandleLocal[1] - oppHandleLocal[1];

            if (isCorner) {
                scaleU = Math.abs(dimU) > 0.001 ? (localMouse[0] - oppHandleLocal[0]) / dimU : 1;
                scaleV = Math.abs(dimV) > 0.001 ? (localMouse[1] - oppHandleLocal[1]) / dimV : 1;
            } else if (isTopBottom) {
                scaleV = Math.abs(dimV) > 0.001 ? (localMouse[1] - oppHandleLocal[1]) / dimV : 1;
            } else if (isLeftRight) {
                scaleU = Math.abs(dimU) > 0.001 ? (localMouse[0] - oppHandleLocal[0]) / dimU : 1;
            }

            // Symmetry Check & Snap (Only for Corners)
            const baseW = startObb.maxX - startObb.minX;
            const baseH = startObb.maxY - startObb.minY;

            // Calculate temp dimensions for check
            let symmetric = false;

            if (isCorner) {
                const currW = baseW * Math.abs(scaleU);
                const currH = baseH * Math.abs(scaleV);
                const snapThreshold = 10;

                if (Math.abs(currW - currH) < snapThreshold) {
                    symmetric = true;
                    // ... (existing symmetry logic) ...
                    const targetSize = (currW + currH) / 2;
                    const epsilon = 1.001;
                    scaleU = (targetSize / baseW) * (scaleU < 0 ? -1 : 1);
                    scaleV = (targetSize * epsilon / baseH) * (scaleV < 0 ? -1 : 1);
                }
            }

            if (symmetric !== isSymmetric) {
                setIsSymmetric(symmetric);
            }

            // Min Size Constraint (20px)
            const minSize = 20;
            const currentW = Math.abs(baseW * scaleU);
            const currentH = Math.abs(baseH * scaleV);

            if (currentW < minSize) {
                scaleU = (minSize / baseW) * (scaleU < 0 ? -1 : 1);
            }
            if (currentH < minSize) {
                scaleV = (minSize / baseH) * (scaleV < 0 ? -1 : 1);
            }

            const newPoints = origPoints.map((p) => {
                const localP = transformPointToLocal(p, startObb.center, startObb.angle);
                const scaledLocalP: Point = [
                    oppHandleLocal[0] + (localP[0] - oppHandleLocal[0]) * scaleU,
                    oppHandleLocal[1] + (localP[1] - oppHandleLocal[1]) * scaleV
                ];
                return transformPointToWorld(scaledLocalP, startObb.center, startObb.angle);
            });

            const newStrokes = strokes.map((s, i) => {
                // Robust mapping from drag start
                const mapping = start.strokeMapping?.get(i);
                if (mapping) {
                    return { p1: newPoints[mapping.p1] as Point, p2: newPoints[mapping.p2] as Point };
                }
                return s;
            });
            onUpdateStrokes(newStrokes);

        } else if (transformMode === 'rotate' && selectedShapeIndices.length === 1) {
            const shape = shapesRef.current[selectedShapeIndices[0]];
            if (!shape) return;

            const startObb = start.startObb;
            const origPoints = start.origPoints;
            // Use OBB center for rotation
            const origBbox = start.bbox;
            const center = startObb ? startObb.center : [origBbox.centerX, origBbox.centerY];

            const angle = Math.atan2(point[1] - center[1], point[0] - center[0]) -
                Math.atan2(start.point[1] - center[1], start.point[0] - center[0]);

            if (Math.abs(angle) > 0.005) {
                const newPoints = origPoints.map((p) => rotatePoint(p, center as Point, angle));

                const newStrokes = strokes.map((s, i) => {
                    // Robust mapping from drag start
                    const mapping = start.strokeMapping?.get(i);
                    if (mapping) {
                        return { p1: newPoints[mapping.p1] as Point, p2: newPoints[mapping.p2] as Point };
                    }
                    return s;
                });
                onUpdateStrokes(newStrokes);
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

        // Finalize Selection Box
        if (selectionBox) {
            const shapes = shapesRef.current;
            const boxMinX = Math.min(selectionBox.start[0], selectionBox.end[0]);
            const boxMaxX = Math.max(selectionBox.start[0], selectionBox.end[0]);
            const boxMinY = Math.min(selectionBox.start[1], selectionBox.end[1]);
            const boxMaxY = Math.max(selectionBox.start[1], selectionBox.end[1]);

            // Find shapes intersecting the selection box
            const indices: number[] = [];
            shapes.forEach((shape, i) => {
                const s = shape.bbox;
                // AABB Intersection Test
                const overlaps = !(boxMaxX < s.minX || boxMinX > s.maxX || boxMaxY < s.minY || boxMinY > s.maxY);
                if (overlaps) {
                    indices.push(i);
                }
            });
            setSelectedShapeIndices(indices);
            setSelectionBox(null);
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
        setIsSymmetric(false);
        dragStartRef.current = null;
    };

    // Keyboard handler
    useEffect(() => {
        if (toolMode !== 'select' || selectedShapeIndices.length === 0 || !onUpdateStrokes) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();

                // Identify all strokes to remove
                const shapes = shapesRef.current;
                const strokesToRemove = new Set<number>();

                selectedShapeIndices.forEach(idx => {
                    const shape = shapes[idx];
                    if (shape) {
                        shape.indices.forEach(sIdx => strokesToRemove.add(sIdx));
                    }
                });

                if (strokesToRemove.size > 0) {
                    const newStrokes = strokes.filter((_, i) => !strokesToRemove.has(i));
                    onUpdateStrokes(newStrokes);
                    setSelectedShapeIndices([]);
                }
            } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                if (selectedShapeIndices.length > 0 && onUpdateStrokes) {
                    e.preventDefault();
                    // Nudge amount: 0.2 units (approx 1-2 pixels)
                    const delta = e.shiftKey ? 2.0 : 0.2;
                    let dx = 0;
                    let dy = 0;

                    if (e.key === 'ArrowUp') dy = -delta;
                    if (e.key === 'ArrowDown') dy = delta;
                    if (e.key === 'ArrowLeft') dx = -delta;
                    if (e.key === 'ArrowRight') dx = delta;

                    const shapes = shapesRef.current;
                    const indicesToMove = new Set<number>();

                    selectedShapeIndices.forEach(idx => {
                        const shape = shapes[idx];
                        if (shape) {
                            shape.indices.forEach(sIdx => indicesToMove.add(sIdx));
                        }
                    });

                    if (indicesToMove.size > 0) {
                        const newStrokes = strokes.map((s, i) => {
                            if (indicesToMove.has(i)) {
                                return { p1: [s.p1[0] + dx, s.p1[1] + dy] as Point, p2: [s.p2[0] + dx, s.p2[1] + dy] as Point };
                            }
                            return s;
                        });
                        onUpdateStrokes(newStrokes);
                    }
                }
            } else if (e.key === 'Escape') {
                setSelectedShapeIndices([]);
                setSelectionBox(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toolMode, selectedShapeIndices, strokes, onUpdateStrokes]);

    // Derived state for rendering
    const primaryShapeIndex = selectedShapeIndices.length === 1 ? selectedShapeIndices[0] : null;
    const primaryShape = primaryShapeIndex !== null ? shapesRef.current[primaryShapeIndex] : null;

    return (
        <div ref={wrapperRef} className="w-full h-full bg-muted/20 overflow-hidden relative flex items-center justify-center select-none">
            <div
                ref={canvasRef}
                style={{ width: logicalWidth, height: logicalHeight, transform: `scale(${scale})`, backgroundColor }}
                className="relative overflow-hidden ring-1 ring-gray-300"
            >
                <div
                    ref={interactionRef}
                    className={cn("absolute inset-0 z-10", toolMode === 'select' ? "" : "cursor-crosshair")}
                    style={{
                        padding: 0,
                        margin: `${pageMargin}px`,
                        width: logicalWidth - pageMargin * 2,
                        height: logicalHeight - pageMargin * 2,
                        cursor: toolMode === 'select' ? cursorMode : undefined
                    }}
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
                        <svg className="absolute inset-0 z-50 overflow-visible" style={{ pointerEvents: 'none' }} viewBox={`0 0 ${100 * coordinateAspect} 100`} preserveAspectRatio="xMidYMid meet">
                            {strokes.map((s, i) => {
                                // Check if this stroke belongs to ANY selected shape
                                const isSelected = selectedShapeIndices.some(idx => {
                                    const shape = shapesRef.current[idx];
                                    return shape && shape.indices.includes(i);
                                });
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
                            {/* Selection Box */}
                            {selectionBox && (
                                <rect
                                    x={Math.min(selectionBox.start[0], selectionBox.end[0])}
                                    y={Math.min(selectionBox.start[1], selectionBox.end[1])}
                                    width={Math.abs(selectionBox.end[0] - selectionBox.start[0])}
                                    height={Math.abs(selectionBox.end[1] - selectionBox.start[1])}
                                    fill="rgba(59, 130, 246, 0.1)"
                                    stroke="#3b82f6"
                                    strokeWidth="0.5"
                                    strokeDasharray="2 2"
                                    vectorEffect="non-scaling-stroke"
                                />
                            )}
                        </svg>
                    )}

                    {/* Shape Info Overlay for Verification */}


                    {/* Selection Handles (Only show if ONE shape is selected) */}
                    {primaryShape && (
                        <svg className="absolute inset-0 z-50 overflow-visible" style={{ pointerEvents: 'none' }} viewBox={`0 0 ${100 * coordinateAspect} 100`} preserveAspectRatio="xMidYMid meet">
                            {/* Rotated Rect Outline */}
                            <polygon
                                points={getResizeHandles(primaryShape.obb)
                                    .filter((_, i) => [0, 2, 4, 6].includes(i)) // corners only for the rect polygon
                                    .map(p => `${p[0]},${p[1]}`)
                                    .join(' ')}
                                fill="none"
                                stroke={isSymmetric ? "#10b981" : "#3b82f6"}
                                strokeWidth={isSymmetric ? "2" : "0.5"}
                                strokeDasharray={isSymmetric ? "none" : "3 3"}
                                vectorEffect="non-scaling-stroke"
                            />

                            {/* Rotation Handles (Pink Circles at Corners, Offset) */}
                            {getRotationHandles(primaryShape.obb).map((h, i) => (
                                <g key={`rot-${i}`} transform={`translate(${h[0]}, ${h[1]})`}>
                                    {/* Connector Line from Corner to Rot Handle */}
                                    {(() => {
                                        // Find corresponding corner
                                        const cornerIdx = [0, 2, 4, 6][i]; // TL, TR, BR, BL
                                        const corner = getResizeHandles(primaryShape.obb)[cornerIdx];
                                        return (
                                            <line x1={corner[0] - h[0]} y1={corner[1] - h[1]} x2={0} y2={0} stroke="#ec4899" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                                        )
                                    })()}
                                    <circle r={1.6} fill="#ec4899" stroke="white" strokeWidth="1" vectorEffect="non-scaling-stroke" cursor="crosshair" />
                                </g>
                            ))}

                            {/* Resize Handles (Circles) */}
                            {getResizeHandles(primaryShape.obb).map((h, i) => {
                                // Style: Corners are Blue, Sides are White (or keep all valid?)
                                // Remote used different colors for different things. 
                                // Let's stick to standard blue for resize, but make them circles.
                                return (
                                    <circle key={i}
                                        cx={h[0]} cy={h[1]}
                                        r={1.2}
                                        fill="white" stroke="#3b82f6" strokeWidth="0.5"
                                        vectorEffect="non-scaling-stroke"
                                        transform={`rotate(${primaryShape.obb.angle * 180 / Math.PI}, ${h[0]}, ${h[1]})`}
                                    />
                                );
                            })}
                        </svg>
                    )}
                </div>
            </div>
        </div>
    );
};
