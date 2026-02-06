'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { processLayoutGeometry } from '@/lib/layout-geometry';
import { createClient } from '@/lib/supabase';
import { invalidateCache } from '@/lib/templates-cache';
import { AlbumPage, AlbumConfig } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AdvancedTemplate, VectorObject, Point, Segment, LayoutRegion } from '@/lib/advanced-layout-types';
import { v4 as uuidv4 } from 'uuid';
import { ShapeRegion } from '../layouts/shape-region';
import { ToolMode } from './layout-sidebar-left';

const updateObjectPoints = (obj: VectorObject, newPoints: Point[]): VectorObject => {
    const newSegments: Segment[] = [];
    // Create segments between consecutive points
    for (let i = 0; i < newPoints.length - 1; i++) {
        newSegments.push({ p1: newPoints[i], p2: newPoints[i + 1] });
    }
    // Add closing segment from last point back to first point (for closed shapes)
    if (newPoints.length >= 3) {
        newSegments.push({ p1: newPoints[newPoints.length - 1], p2: newPoints[0] });
    }
    return { ...obj, points: newPoints, segments: newSegments };
};

interface LayoutCanvasProps {
    page: AlbumPage;
    config?: AlbumConfig;
    onUpdatePage: (page: AlbumPage) => void;
    advancedTemplate: AdvancedTemplate | null;
    toolMode: ToolMode;
    vectorObjects: VectorObject[];
    onUpdateVectorObjects?: (objects: VectorObject[]) => void;
    isMirrorMode: boolean;
    activeStrokeColor: string;
    activeStrokeWidth: number;
    activeFillColor: string;
    selectedShapeIndices: number[];
    onSelectionChange: (indices: number[]) => void;
}

type TransformMode = 'none' | 'move' | 'resize' | 'rotate';

type Obb = {
    center: Point;
    width: number;
    height: number;
    angle: number;
    minX: number; maxX: number; minY: number; maxY: number;
};

interface ShapeData {
    id: string; // From VectorObject
    polygon: Point[];
    bbox: { minX: number; minY: number; maxX: number; maxY: number; centerX: number; centerY: number; width: number; height: number };
    obb: Obb;
    object: VectorObject;
}

export const LayoutCanvas = ({
    page,
    config,
    onUpdatePage,
    advancedTemplate,
    toolMode,
    vectorObjects,
    onUpdateVectorObjects,
    isMirrorMode,
    activeStrokeColor,
    activeStrokeWidth,
    activeFillColor,
    selectedShapeIndices,
    onSelectionChange
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
    // Always use spread width (Double Page) to maintain square perception as requested by user
    const logicalWidth = pageW_px * 2;
    const isSingleMode = !isFull;
    const logicalHeight = pageH_px;
    const photoGap = page.photoGap ?? config?.photoGap ?? 0;
    const pageMargin = page.pageMargin ?? config?.pageMargin ?? 0;
    const backgroundColor = config?.backgroundColor || '#ffffff';

    // FIX: Aspect Ratio for corrections
    // In Single mode, we still show the spread, but logical usage is on the right half
    const halfWidth = logicalWidth / 2;
    const innerLogicalWidth = isFull ? (logicalWidth - pageMargin * 2) : (halfWidth - pageMargin * 2);
    const innerLogicalHeight = logicalHeight - pageMargin * 2;
    const coordinateAspect = innerLogicalWidth / innerLogicalHeight;

    // --- STATE ---
    const [scale, setScale] = useState(1);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentStroke, setCurrentStroke] = useState<Segment | null>(null);
    const [currentPath, setCurrentPath] = useState<Point[]>([]);
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
        affectedObjectIds?: Set<string>;
        isDuplicating?: boolean;
        initialAltKey?: boolean;
        mirrorPartnerIndex?: number;
        mirrorPartnerIds?: Set<string>;
    } | null>(null);

    // --- UTILS ---
    const getBoundingBox = (polygon: Point[]) => {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        polygon.forEach(p => {
            minX = Math.min(minX, p[0]);
            minY = Math.min(minY, p[1]);
            maxX = Math.max(maxX, p[0]);
            minY = Math.min(minY, p[1]);
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

    const detectShapes = useCallback((objects: VectorObject[]) => {
        const shapes: ShapeData[] = [];

        objects.forEach(obj => {
            // Collect points from segments
            const pointSet = new Map<string, Point>();
            obj.segments?.forEach(s => {
                const key1 = `${s.p1[0].toFixed(2)},${s.p1[1].toFixed(2)}`;
                const key2 = `${s.p2[0].toFixed(2)},${s.p2[1].toFixed(2)}`;
                pointSet.set(key1, s.p1);
                pointSet.set(key2, s.p2);
            });

            const polygon = Array.from(pointSet.values());
            if (polygon.length === 0 && obj.type !== 'path') return;

            if (obj.type === 'path') {
                // For paths, we use the bounding box to define the shape data
                // We'll calculate a bounding box based on points if available, or use 0-100 defaults
                const minX = obj.points && obj.points.length ? Math.min(...obj.points.map(p => p[0])) : 0;
                const minY = obj.points && obj.points.length ? Math.min(...obj.points.map(p => p[1])) : 0;
                const maxX = obj.points && obj.points.length ? Math.max(...obj.points.map(p => p[0])) : 100 * coordinateAspect;
                const maxY = obj.points && obj.points.length ? Math.max(...obj.points.map(p => p[1])) : 100;

                const width = maxX - minX;
                const height = maxY - minY;
                const centerX = minX + width / 2;
                const centerY = minY + height / 2;

                // Convert rotation from degrees to radians for OBB angle
                const angleRad = (obj.rotation || 0) * Math.PI / 180;

                const box: ShapeData['bbox'] = { minX, minY, maxX, maxY, centerX, centerY, width, height };
                const obb: ShapeData['obb'] = {
                    center: [centerX, centerY],
                    width: width,
                    height: height,
                    angle: angleRad,
                    minX, maxX, minY, maxY
                };

                // Create polygon from the 4 corners of the bounding box, rotated by the current angle
                const halfW = width / 2;
                const halfH = height / 2;
                const cos = Math.cos(angleRad);
                const sin = Math.sin(angleRad);
                const dx1 = halfW * cos, dy1 = halfW * sin;
                const dx2 = halfH * -sin, dy2 = halfH * cos;
                const pathPolygon: Point[] = [
                    [centerX - dx1 - dx2, centerY - dy1 - dy2],
                    [centerX + dx1 - dx2, centerY + dy1 - dy2],
                    [centerX + dx1 + dx2, centerY + dy1 + dy2],
                    [centerX - dx1 + dx2, centerY - dy1 + dy2]
                ];

                shapes.push({
                    id: obj.id,
                    polygon: pathPolygon,
                    bbox: box,
                    obb: obb,
                    object: obj
                });
                return;
            }

            // Try to find matching previous shape to preserve angle
            let preferredAngle: number | undefined;
            if (shapesRef.current) {
                const prev = shapesRef.current.find(s => s.id === obj.id);
                if (prev && !isRotatingRef.current) preferredAngle = prev.obb.angle;
            }

            shapes.push({
                id: obj.id,
                polygon,
                bbox: getBoundingBox(polygon),
                obb: getSmartBBox(polygon, preferredAngle),
                object: obj
            });
        });

        shapesRef.current = shapes;
    }, [coordinateAspect]);

    useEffect(() => { detectShapes(vectorObjects); }, [vectorObjects, detectShapes]);

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
        const { minX, maxX, minY, maxY, angle, center } = obb;
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
            // Rotate the point around the center
            return rotatePoint(p as Point, center, angle);
        });
    };

    const getRotationHandles = (obb: ShapeData['obb']): Point[] => {
        const { minX, maxX, minY, maxY, angle, center } = obb;
        const offset = 12.5;

        // Corners in local space (unrotated world coords relative to which we apply offset)
        // We calculate offsets relative to the unrotated box, then rotate the result

        // This function was calculating incorrectly. Let's simplify:
        // 1. Take corner point on unrotated box
        // 2. Add offset in the direction of the corner relative to center?
        // Actually, the original logic tried to do local offset. 
        // Let's stick to the previous logic but fix the rotation center.

        const cornersLocal: { u: number, v: number, ox: number, oy: number }[] = [
            { u: minX, v: minY, ox: -offset, oy: -offset }, // TL
            { u: maxX, v: minY, ox: offset, oy: -offset },   // TR
            { u: maxX, v: maxY, ox: offset, oy: offset },   // BR
            { u: minX, v: maxY, ox: -offset, oy: offset }   // BL
        ];

        return cornersLocal.map(p => {
            // Apply offset in unrotated space
            const unrotatedX = p.u + p.ox;
            const unrotatedY = p.v + p.oy;

            // Rotate around center
            return rotatePoint([unrotatedX, unrotatedY], center, angle);
        });
    };


    // Updated to use coordinateAspect based on inner drawing area to prevent skew
    const getPointFromEvent = (clientX: number, clientY: number, rect: DOMRect) => {
        if (!rect.width || !rect.height) return null;

        const isFull = page.spreadMode === 'full';
        const activeAreaLeftPx = isFull ? 0 : rect.width / 2;
        const activeAreaWidthPx = isFull ? rect.width : rect.width / 2;

        const domRatio = activeAreaWidthPx / rect.height;
        let drawWidth = activeAreaWidthPx;
        let drawHeight = rect.height;
        let offsetX = activeAreaLeftPx;
        let offsetY = 0;

        if (domRatio > coordinateAspect) {
            drawWidth = drawHeight * coordinateAspect;
            offsetX += (activeAreaWidthPx - drawWidth) / 2;
        } else if (domRatio < coordinateAspect) {
            drawHeight = drawWidth / coordinateAspect;
            offsetY = (rect.height - drawHeight) / 2;
        }

        const x = (clientX - rect.left - offsetX) / drawWidth * (100 * coordinateAspect);
        const y = (clientY - rect.top - offsetY) / drawHeight * 100;

        // Restriction: For single mode, don't allow points outside the active (right) half
        if (!isFull) {
            // We allow a small margin of error or handle it in the drawing logic
        }

        return [x, y] as Point;
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        // This function handles drawing new shapes (not selection/manipulation)
        if (toolMode === 'select' || !onUpdateVectorObjects) return;
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
        if (!point || !onUpdateVectorObjects) return;

        const shapes = shapesRef.current;
        const primaryIdx = selectedShapeIndices.length === 1 ? selectedShapeIndices[0] : null;

        // 1. Check Resize/Rotate Handles (Only if exactly one shape is selected)
        if (primaryIdx !== null) {
            const shape = shapes[primaryIdx];
            if (shape) {
                // Determine Mirror Logic
                let mirrorPartnerIdx: number | undefined;

                if (isMirrorMode && coordinateAspect) {
                    const totalWidth = 100 * coordinateAspect;
                    const mirrorX = totalWidth - shape.obb.center[0];
                    const mirrorY = shape.obb.center[1];

                    mirrorPartnerIdx = shapes.findIndex((s, idx) => {
                        if (idx === primaryIdx) return false;
                        const d = Math.sqrt(Math.pow(s.obb.center[0] - mirrorX, 2) + Math.pow(s.obb.center[1] - mirrorY, 2));
                        return d < 5.0 && Math.abs(s.obb.width - shape.obb.width) < 1 && Math.abs(s.obb.height - shape.obb.height) < 1;
                    });

                    if (mirrorPartnerIdx === -1) mirrorPartnerIdx = undefined;
                }

                // Rotation Handles
                const rotHandles = getRotationHandles(shape.obb);
                for (let i = 0; i < 4; i++) {
                    if (distance(point, rotHandles[i]) < 2.0) {
                        setTransformMode('rotate');
                        isRotatingRef.current = true;
                        // Use shape.polygon for all objects (path objects now have rotated OBB corners as polygon)
                        dragStartRef.current = {
                            point, origPoints: shape.polygon, bbox: shape.bbox, startObb: shape.obb,
                            mirrorPartnerIndex: mirrorPartnerIdx
                        };
                        return;
                    }
                }

                // Resize Handles
                const handles = getResizeHandles(shape.obb);
                const hitRadius = 1.5;

                for (let i = 0; i < 8; i++) {
                    if (distance(point, handles[i]) < hitRadius) {
                        setResizeHandle(i);
                        setTransformMode('resize');
                        isRotatingRef.current = false;
                        // Use shape.polygon for all objects (path objects now have rotated OBB corners as polygon)
                        dragStartRef.current = {
                            point, origPoints: shape.polygon, bbox: shape.bbox, startObb: shape.obb,
                            mirrorPartnerIndex: mirrorPartnerIdx
                        };
                        return;
                    }
                }
            }
        }

        // 2. Check Shape Hit
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
            let newSelection = [...selectedShapeIndices];
            if (!newSelection.includes(foundIdx)) {
                newSelection = [foundIdx];
                onSelectionChange(newSelection);
            }

            setTransformMode('move');
            isRotatingRef.current = false;
            setCursorMode('grabbing');

            // Detect Mirror Partner (only if single selection)
            let mirrorPartnerIdx: number | undefined;
            if (isMirrorMode && newSelection.length === 1 && coordinateAspect) {
                const totalWidth = 100 * coordinateAspect;
                const currentShape = shapes[foundIdx];
                const mirrorX = totalWidth - currentShape.obb.center[0];
                const mirrorY = currentShape.obb.center[1];

                mirrorPartnerIdx = shapes.findIndex((s, idx) => {
                    if (idx === foundIdx) return false;
                    const d = Math.sqrt(Math.pow(s.obb.center[0] - mirrorX, 2) + Math.pow(s.obb.center[1] - mirrorY, 2));
                    return d < 5.0 && Math.abs(s.obb.width - currentShape.obb.width) < 1 && Math.abs(s.obb.height - currentShape.obb.height) < 1;
                });

                if (mirrorPartnerIdx === -1) mirrorPartnerIdx = undefined;
            }

            dragStartRef.current = {
                point,
                origPoints: shapes[foundIdx].polygon,
                bbox: shapes[foundIdx].bbox,
                startObb: shapes[foundIdx].obb,
                initialAltKey: e.altKey,
                isDuplicating: false,
                mirrorPartnerIndex: mirrorPartnerIdx
            };

        } else {
            onSelectionChange([]);
            setSelectionBox({ start: point, end: point });
            setTransformMode('none');
            isRotatingRef.current = false;
        }
    };

    const handleMouseUpCleanup = () => {
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

    const handleMouseUp = (e: React.MouseEvent) => {
        if (toolMode === 'select') {
            if (selectionBox) {
                const { start, end } = selectionBox;
                const minX = Math.min(start[0], end[0]);
                const maxX = Math.max(start[0], end[0]);
                const minY = Math.min(start[1], end[1]);
                const maxY = Math.max(start[1], end[1]);

                const newSelection: number[] = [];
                shapesRef.current.forEach((shape, idx) => {
                    if (shape.obb.center[0] >= minX && shape.obb.center[0] <= maxX &&
                        shape.obb.center[1] >= minY && shape.obb.center[1] <= maxY) {
                        newSelection.push(idx);
                    }
                });
                onSelectionChange(newSelection);
            }
            setSelectionBox(null);
            setTransformMode('none');
            setCursorMode('default');
            dragStartRef.current = null;
            handleMouseUpCleanup();
            return;
        }

        if (!isDrawing) {
            handleMouseUpCleanup();
            return;
        }

        setIsDrawing(false);
        isDrawingRef.current = false;

        const rect = e.currentTarget.getBoundingClientRect();
        const point = getPointFromEvent(e.clientX, e.clientY, rect);
        if (!point) {
            handleMouseUpCleanup();
            return;
        }

        let newObjects = [...vectorObjects];

        const createObject = (type: VectorObject['type'], points: Point[]): VectorObject => {
            const segments: Segment[] = [];
            for (let i = 0; i < points.length - 1; i++) {
                segments.push({ p1: points[i], p2: points[i + 1] });
            }
            return {
                id: uuidv4(),
                type,
                segments,
                points,
                stroke: activeStrokeColor,
                strokeWidth: activeStrokeWidth,
                fill: activeFillColor,
                zIndex: (vectorObjects?.length || 0),
                rotation: 0
            };
        };

        if (toolMode === 'freehand') {
            if (currentPath.length > 1) {
                const obj = createObject('freehand', currentPath);
                newObjects.push(obj);

                if (isMirrorMode && coordinateAspect) {
                    const totalWidth = 100 * coordinateAspect;
                    const mirroredPoints = currentPath.map(p => [totalWidth - p[0], p[1]] as Point);
                    const mirroredObj = createObject('freehand', mirroredPoints);
                    mirroredObj.id = uuidv4();
                    mirroredObj.mirrorPartnerId = obj.id;
                    obj.mirrorPartnerId = mirroredObj.id;
                    newObjects.push(mirroredObj);
                }
            }
        } else if (toolMode === 'rect' || toolMode === 'circle') {
            if (previewShape && previewShape.points.length > 2) {
                const obj = createObject(toolMode, previewShape.points);
                newObjects.push(obj);

                if (isMirrorMode && coordinateAspect) {
                    const totalWidth = 100 * coordinateAspect;
                    const mirroredPoints = previewShape.points.map(p => [totalWidth - p[0], p[1]] as Point);
                    const mirroredObj = createObject(toolMode, mirroredPoints);
                    mirroredObj.id = uuidv4();
                    mirroredObj.mirrorPartnerId = obj.id;
                    obj.mirrorPartnerId = mirroredObj.id;
                    newObjects.push(mirroredObj);
                }
            }
        } else if (toolMode === 'pencil') {
            const start = currentStrokeRef.current?.p1;
            if (start && distance(start, point) > 0.5) {
                const obj = createObject('line', [start, point]);
                newObjects.push(obj);

                if (isMirrorMode && coordinateAspect) {
                    const totalWidth = 100 * coordinateAspect;
                    const mirroredStart: Point = [totalWidth - start[0], start[1]];
                    const mirroredEnd: Point = [totalWidth - point[0], point[1]];
                    const mirroredObj = createObject('line', [mirroredStart, mirroredEnd]);
                    mirroredObj.id = uuidv4();
                    mirroredObj.mirrorPartnerId = obj.id;
                    obj.mirrorPartnerId = mirroredObj.id;
                    newObjects.push(mirroredObj);
                }
            }
        }

        onUpdateVectorObjects?.(newObjects);
        handleMouseUpCleanup();
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const point = getPointFromEvent(e.clientX, e.clientY, rect);
        if (!point || !onUpdateVectorObjects) return;

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
                let currentObjects = vectorObjects;
                let objectIdsToMove = start.affectedObjectIds || new Set<string>();

                // Lazy determine affected objects if not in ref
                if (objectIdsToMove.size === 0) {
                    objectIdsToMove = new Set();
                    selectedShapeIndices.forEach(idx => {
                        const shape = shapesRef.current[idx];
                        if (shape) objectIdsToMove.add(shape.id);
                    });
                    start.affectedObjectIds = objectIdsToMove;
                }

                // Determine Mirror Indices
                let mirrorIds = start.mirrorPartnerIds || new Set<string>();
                if (mirrorIds.size === 0 && start.mirrorPartnerIndex !== undefined) {
                    const mirrorShape = shapesRef.current[start.mirrorPartnerIndex];
                    if (mirrorShape) mirrorIds.add(mirrorShape.id);
                    start.mirrorPartnerIds = mirrorIds;
                }

                // Duplication Logic (Alt + Drag)
                if (start.initialAltKey && !start.isDuplicating) {
                    start.isDuplicating = true;
                    const clones: VectorObject[] = [];
                    const newIds = new Set<string>();
                    const newMirrorIds = new Set<string>();

                    objectIdsToMove.forEach(id => {
                        const original = vectorObjects.find(o => o.id === id);
                        if (original) {
                            const clone = { ...original, id: uuidv4() };
                            clones.push(clone);
                            newIds.add(clone.id);
                        }
                    });

                    mirrorIds.forEach(id => {
                        const original = vectorObjects.find(o => o.id === id);
                        if (original) {
                            const clone = { ...original, id: uuidv4() };
                            clones.push(clone);
                            newMirrorIds.add(clone.id);
                        }
                    });

                    if (clones.length > 0) {
                        currentObjects = [...vectorObjects, ...clones];
                        objectIdsToMove = newIds;
                        mirrorIds = newMirrorIds;
                        start.affectedObjectIds = newIds;
                        start.mirrorPartnerIds = newMirrorIds;
                        onSelectionChange([]);
                    }
                }

                if (objectIdsToMove.size > 0 || mirrorIds.size > 0) {
                    const newObjects = currentObjects.map((obj: VectorObject) => {
                        if (objectIdsToMove.has(obj.id)) {
                            if (obj.points) {
                                const newPoints = obj.points.map((p: Point) => [p[0] + dx, p[1] + dy] as Point);
                                return updateObjectPoints(obj, newPoints);
                            }
                        }
                        if (mirrorIds.has(obj.id)) {
                            if (obj.points) {
                                const newPoints = obj.points.map((p: Point) => [p[0] - dx, p[1] + dy] as Point);
                                return updateObjectPoints(obj, newPoints);
                            }
                        }
                        return obj;
                    });
                    onUpdateVectorObjects?.(newObjects);
                    dragStartRef.current = { ...start, point };
                }
            }
        } else if (transformMode === 'resize' && selectedShapeIndices.length === 1) {
            const shape = shapesRef.current[selectedShapeIndices[0]];
            if (!shape) return;

            const startObb = start.startObb;
            if (!startObb) return;

            const localMouse = transformPointToLocal(point, startObb.center, startObb.angle);
            const handles = getResizeHandles(startObb).map(h => transformPointToLocal(h, startObb.center, startObb.angle));

            const oppHandles = [4, 5, 6, 7, 0, 1, 2, 3];
            const oppIdx = oppHandles[resizeHandle!];
            const oppHandleLocal = handles[oppIdx];
            const currHandleLocal = handles[resizeHandle!];

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

            const baseW = startObb.width;
            const baseH = startObb.height;
            let symmetric = false;

            if (isCorner) {
                const currW = baseW * Math.abs(scaleU);
                const currH = baseH * Math.abs(scaleV);
                const snapThreshold = 10;
                if (Math.abs(currW - currH) < snapThreshold) {
                    symmetric = true;
                    const targetSize = (currW + currH) / 2;
                    scaleU = (targetSize / baseW) * (scaleU < 0 ? -1 : 1);
                    scaleV = (targetSize / baseH) * (scaleV < 0 ? -1 : 1);
                }
            }
            if (symmetric !== isSymmetric) setIsSymmetric(symmetric);

            const minSize = 2;
            if (Math.abs(baseW * scaleU) < minSize) scaleU = (minSize / baseW) * (scaleU < 0 ? -1 : 1);
            if (Math.abs(baseH * scaleV) < minSize) scaleV = (minSize / baseH) * (scaleV < 0 ? -1 : 1);

            const newObjects = vectorObjects.map(obj => {
                if (obj.id === shape.id && obj.points) {
                    if (obj.type === 'path') {
                        const localPoints = start.origPoints.map(p => {
                            const pl = transformPointToLocal(p, startObb.center, startObb.angle);
                            return [
                                oppHandleLocal[0] + (pl[0] - oppHandleLocal[0]) * scaleU,
                                oppHandleLocal[1] + (pl[1] - oppHandleLocal[1]) * scaleV
                            ] as Point;
                        });

                        // Calculate Shift (new center in unrotated space)
                        const minU = Math.min(...localPoints.map(p => p[0]));
                        const maxU = Math.max(...localPoints.map(p => p[0]));
                        const minV = Math.min(...localPoints.map(p => p[1]));
                        const maxV = Math.max(...localPoints.map(p => p[1]));
                        const shiftU = (minU + maxU) / 2;
                        const shiftV = (minV + maxV) / 2;

                        // Calculate Correction: Rotate(Shift) - Shift
                        const cos = Math.cos(startObb.angle);
                        const sin = Math.sin(startObb.angle);
                        const rotShiftU = shiftU * cos - shiftV * sin;
                        const rotShiftV = shiftU * sin + shiftV * cos;
                        const correctionU = rotShiftU - shiftU;
                        const correctionV = rotShiftV - shiftV;

                        const correctedPoints = localPoints.map(p => [
                            startObb.center[0] + p[0] + correctionU,
                            startObb.center[1] + p[1] + correctionV
                        ] as Point);

                        return updateObjectPoints(obj, correctedPoints);
                    } else {
                        const newPolyWorld = start.origPoints.map(p => {
                            const pl = transformPointToLocal(p, startObb.center, startObb.angle);
                            const plNew: Point = [
                                oppHandleLocal[0] + (pl[0] - oppHandleLocal[0]) * scaleU,
                                oppHandleLocal[1] + (pl[1] - oppHandleLocal[1]) * scaleV
                            ];
                            return transformPointToWorld(plNew, startObb.center, startObb.angle);
                        });
                        return updateObjectPoints(obj, newPolyWorld);
                    }
                }
                if (start.mirrorPartnerIndex !== undefined && coordinateAspect) {
                    const mShape = shapesRef.current[start.mirrorPartnerIndex];
                    if (mShape && obj.id === mShape.id && obj.points) {
                        const totalWidth = 100 * coordinateAspect;
                        const newPolyWorld = start.origPoints.map(p => {
                            const pl = transformPointToLocal(p, startObb.center, startObb.angle);
                            const plNew: Point = [
                                oppHandleLocal[0] + (pl[0] - oppHandleLocal[0]) * scaleU,
                                oppHandleLocal[1] + (pl[1] - oppHandleLocal[1]) * scaleV
                            ];
                            return transformPointToWorld(plNew, startObb.center, startObb.angle);
                        });
                        const mirroredPoints = newPolyWorld.map(p => [totalWidth - p[0], p[1]] as Point);
                        return updateObjectPoints(obj, mirroredPoints);
                    }
                }
                return obj;
            });
            onUpdateVectorObjects?.(newObjects);

        } else if (transformMode === 'rotate' && selectedShapeIndices.length === 1) {
            const shape = shapesRef.current[selectedShapeIndices[0]];
            if (!shape) return;

            const center = start.startObb?.center || [shape.bbox.centerX, shape.bbox.centerY] as Point;
            const startAngle = Math.atan2(start.point[1] - center[1], start.point[0] - center[0]);
            const currentAngle = Math.atan2(point[1] - center[1], point[0] - center[0]);
            const dTheta = currentAngle - startAngle;

            const newObjects = vectorObjects.map(obj => {
                if (obj.id === shape.id && obj.points) {
                    // For path objects, only update the rotation property - don't rotate points
                    // Points represent the axis-aligned bounding box, rotation is applied via CSS
                    if (obj.type === 'path') {
                        // Calculate new absolute rotation from start OBB angle + delta
                        const startAngleRad = start.startObb?.angle || 0;
                        const newRotationRad = startAngleRad + dTheta;
                        return {
                            ...obj,
                            rotation: newRotationRad * 180 / Math.PI
                        };
                    }
                    // For regular shapes, rotate the points
                    const newPolyWorld = start.origPoints.map(p => rotatePoint(p, center, dTheta));
                    return updateObjectPoints(obj, newPolyWorld);
                }
                if (start.mirrorPartnerIndex !== undefined && coordinateAspect) {
                    const mShape = shapesRef.current[start.mirrorPartnerIndex];
                    if (mShape && obj.id === mShape.id && obj.points) {
                        // For path objects in mirror mode
                        if (obj.type === 'path') {
                            const startAngleRad = start.startObb?.angle || 0;
                            const newRotationRad = -(startAngleRad + dTheta);
                            return {
                                ...obj,
                                rotation: newRotationRad * 180 / Math.PI
                            };
                        }
                        const totalWidth = 100 * coordinateAspect;
                        const newPolyWorld = start.origPoints.map(p => rotatePoint(p, center, dTheta));
                        const mirroredPoints = newPolyWorld.map(p => [totalWidth - p[0], p[1]] as Point);
                        return updateObjectPoints(obj, mirroredPoints);
                    }
                }
                return obj;
            });
            onUpdateVectorObjects?.(newObjects);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (toolMode !== 'select' || !onUpdateVectorObjects) return;

            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                const idsToRemove = new Set<string>();
                selectedShapeIndices.forEach((idx: number) => {
                    const shape = shapesRef.current[idx];
                    if (shape) idsToRemove.add(shape.id);
                });

                if (idsToRemove.size > 0) {
                    const newObjects = vectorObjects.filter(obj => !idsToRemove.has(obj.id));
                    onUpdateVectorObjects(newObjects);
                    onSelectionChange([]);
                }
            } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                const nudge = 0.5;
                const dx = e.key === 'ArrowLeft' ? -nudge : e.key === 'ArrowRight' ? nudge : 0;
                const dy = e.key === 'ArrowUp' ? -nudge : e.key === 'ArrowDown' ? nudge : 0;

                const idsToMove = new Set<string>();
                selectedShapeIndices.forEach((idx: number) => {
                    const shape = shapesRef.current[idx];
                    if (shape) idsToMove.add(shape.id);
                });

                if (idsToMove.size > 0) {
                    const newObjects = vectorObjects.map((obj: VectorObject) => {
                        if (idsToMove.has(obj.id) && obj.points) {
                            const newPoints = obj.points.map((p: Point) => [p[0] + dx, p[1] + dy] as Point);
                            return updateObjectPoints(obj, newPoints);
                        }
                        return obj;
                    });
                    onUpdateVectorObjects(newObjects);
                }
            } else if (e.key === 'Escape') {
                onSelectionChange([]);
                setSelectionBox(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toolMode, selectedShapeIndices, vectorObjects, onUpdateVectorObjects, onSelectionChange]);

    // Derived state for rendering
    const primaryShapeIndex = selectedShapeIndices.length === 1 ? selectedShapeIndices[0] : null;
    const primaryShape = primaryShapeIndex !== null ? shapesRef.current[primaryShapeIndex] : null;

    return (
        <div ref={wrapperRef} className="w-full h-full bg-muted/20 overflow-hidden relative flex items-center justify-center select-none">
            <div
                ref={canvasRef}
                style={{ width: logicalWidth, height: logicalHeight, transform: `scale(${scale})`, backgroundColor, aspectRatio: `${logicalWidth}/${logicalHeight}` }}
                className="relative overflow-hidden ring-1 ring-gray-300 flex-none shadow-sm box-border"
            >
                <div
                    ref={interactionRef}
                    className={cn("absolute z-10", toolMode === 'select' ? "" : "cursor-crosshair")}
                    style={{
                        padding: 0,
                        top: pageMargin,
                        left: pageMargin,
                        right: pageMargin,
                        bottom: pageMargin,
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
                            <div
                                className="absolute bg-white overflow-hidden shadow-sm"
                                style={{
                                    top: 0,
                                    left: isFull ? 0 : (logicalWidth / 2) - pageMargin,
                                    width: innerLogicalWidth,
                                    height: innerLogicalHeight,
                                }}
                            >
                                {advancedTemplate.regions.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)).map((region, index) => (
                                    <ShapeRegion
                                        key={region.id || index}
                                        region={region}
                                        photo={page.photos[index]}
                                        photoGap={photoGap}
                                        backgroundColor={backgroundColor}
                                        containerWidth={innerLogicalWidth}
                                        containerHeight={innerLogicalHeight}
                                        onUpdatePanAndZoom={() => { }}
                                        onInteractionChange={() => { }}
                                        pageId={page.id}
                                    />
                                ))}
                            </div>
                        ) : isFull ? (
                            <div className="flex h-full w-full">
                                <div className="flex-1 border-r border-dashed border-gray-200 flex items-center justify-center text-gray-300 text-sm">Left Page</div>
                                <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">Right Page</div>
                            </div>
                        ) : (
                            <div className="flex h-full w-full">
                                {/* LOCKED LEFT SIDE */}
                                <div className="flex-1 bg-gray-100/50 flex flex-col items-center justify-center border-r border-dashed border-gray-300">
                                    <div className="text-gray-400 text-xs font-medium uppercase tracking-widest bg-white/80 px-2 py-1 rounded shadow-sm">Locked Section</div>
                                    <div className="text-[10px] text-gray-400/70 mt-1">Single Page designs the right side</div>
                                </div>
                                {/* ACTIVE RIGHT SIDE */}
                                <div className="flex-1 bg-white relative overflow-hidden flex items-center justify-center">
                                    <div className="text-gray-200 text-sm">Design Area</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Vector Overlay */}
                    {(vectorObjects.length > 0 || currentStroke || currentPath.length > 0 || previewShape) && (
                        <svg
                            className="absolute z-50 overflow-visible"
                            style={{
                                pointerEvents: 'none',
                                top: 0,
                                left: isFull ? 0 : (logicalWidth / 2) - pageMargin,
                                width: innerLogicalWidth,
                                height: innerLogicalHeight
                            }}
                            viewBox={`0 0 ${100 * coordinateAspect} 100`}
                            preserveAspectRatio="none"
                        >
                            {vectorObjects.map((obj, i) => {
                                const isSelected = selectedShapeIndices.includes(i);
                                const pointsStr = (obj.points || []).map(p => `${p[0]},${p[1]}`).join(' ');

                                if (obj.type === 'path') {
                                    // Calculate current bounding box from points
                                    const minX = obj.points && obj.points.length ? Math.min(...obj.points.map(p => p[0])) : 0;
                                    const minY = obj.points && obj.points.length ? Math.min(...obj.points.map(p => p[1])) : 0;
                                    const maxX = obj.points && obj.points.length ? Math.max(...obj.points.map(p => p[0])) : 100 * coordinateAspect;
                                    const maxY = obj.points && obj.points.length ? Math.max(...obj.points.map(p => p[1])) : 100;

                                    const width = maxX - minX;
                                    const height = maxY - minY;
                                    const cx = minX + width / 2;
                                    const cy = minY + height / 2;

                                    // Use the path's viewBox to scale it correctly
                                    // viewBox format: "minX minY width height"
                                    const pathViewBox = obj.viewBox || '0 0 100 100';
                                    const clipId = `clip-${obj.id}`;

                                    return (
                                        <g key={obj.id} transform={`rotate(${obj.rotation || 0}, ${cx}, ${cy})`}>
                                            {/* Nested SVG to properly scale the path using its viewBox */}
                                            <svg
                                                x={minX}
                                                y={minY}
                                                width={width}
                                                height={height}
                                                viewBox={pathViewBox}
                                                preserveAspectRatio="none"
                                                overflow="visible"
                                            >
                                                {/* Definitions for gradients and clip path */}
                                                <defs>
                                                    {/* Clip path using the frame shape */}
                                                    <clipPath id={clipId}>
                                                        <path d={obj.path} />
                                                    </clipPath>
                                                    {/* Sky gradient */}
                                                    <linearGradient id={`skyGrad-${obj.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                                        <stop offset="0%" stopColor="#d4eaf7" />
                                                        <stop offset="100%" stopColor="#eef8ff" />
                                                    </linearGradient>
                                                    {/* Hill gradients */}
                                                    <linearGradient id={`hill1-${obj.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                                        <stop offset="0%" stopColor="#90d5ac" />
                                                        <stop offset="100%" stopColor="#76c893" />
                                                    </linearGradient>
                                                    <linearGradient id={`hill2-${obj.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                                        <stop offset="0%" stopColor="#76c893" />
                                                        <stop offset="100%" stopColor="#52b788" />
                                                    </linearGradient>
                                                </defs>

                                                {/* Placeholder content clipped to frame shape */}
                                                <g clipPath={`url(#${clipId})`}>
                                                    {/* Parse viewBox to get bounds */}
                                                    {(() => {
                                                        const vb = pathViewBox.split(' ').map(Number);
                                                        const vbX = vb[0] || 0;
                                                        const vbY = vb[1] || 0;
                                                        const vbW = vb[2] || 100;
                                                        const vbH = vb[3] || 100;
                                                        return (
                                                            <>
                                                                {/* Sky background */}
                                                                <rect x={vbX} y={vbY} width={vbW} height={vbH} fill={`url(#skyGrad-${obj.id})`} />
                                                                {/* Sun */}
                                                                <circle cx={vbX + vbW * 0.85} cy={vbY + vbH * 0.15} r={vbW * 0.08} fill="#fdf2a4" />
                                                                {/* Clouds */}
                                                                <g fill="white" opacity="0.6">
                                                                    <circle cx={vbX + vbW * 0.2} cy={vbY + vbH * 0.2} r={vbW * 0.05} />
                                                                    <circle cx={vbX + vbW * 0.25} cy={vbY + vbH * 0.22} r={vbW * 0.06} />
                                                                    <circle cx={vbX + vbW * 0.3} cy={vbY + vbH * 0.2} r={vbW * 0.05} />
                                                                </g>
                                                                {/* Far hill */}
                                                                <path
                                                                    d={`M ${vbX - vbW * 0.1} ${vbY + vbH} Q ${vbX + vbW * 0.5} ${vbY + vbH * 0.4} ${vbX + vbW * 1.1} ${vbY + vbH} Z`}
                                                                    fill={`url(#hill1-${obj.id})`}
                                                                    opacity="0.9"
                                                                />
                                                                {/* Near hills */}
                                                                <path
                                                                    d={`M ${vbX - vbW * 0.2} ${vbY + vbH} Q ${vbX + vbW * 0.3} ${vbY + vbH * 0.6} ${vbX + vbW * 0.8} ${vbY + vbH * 1.1} Z`}
                                                                    fill={`url(#hill2-${obj.id})`}
                                                                />
                                                                <path
                                                                    d={`M ${vbX + vbW * 0.4} ${vbY + vbH * 1.1} Q ${vbX + vbW * 0.8} ${vbY + vbH * 0.7} ${vbX + vbW * 1.2} ${vbY + vbH} Z`}
                                                                    fill={`url(#hill2-${obj.id})`}
                                                                    opacity="0.8"
                                                                />
                                                            </>
                                                        );
                                                    })()}
                                                </g>

                                                {/* Photo gap - uses background color from album settings */}
                                                <path
                                                    d={obj.path}
                                                    fill="none"
                                                    stroke={backgroundColor}
                                                    strokeWidth={12}
                                                    vectorEffect="non-scaling-stroke"
                                                    pointerEvents="none"
                                                />

                                                {/* Frame border stroke */}
                                                <path
                                                    d={obj.path}
                                                    fill="none"
                                                    stroke={isSelected ? "#3b82f6" : (obj.stroke || "#333333")}
                                                    strokeWidth={isSelected ? 3 : 2}
                                                    strokeOpacity={obj.opacity ?? 1}
                                                    vectorEffect="non-scaling-stroke"
                                                />
                                            </svg>
                                        </g>
                                    );
                                }

                                return (
                                    <polygon
                                        key={obj.id}
                                        points={pointsStr}
                                        fill={obj.fill || 'none'}
                                        stroke={isSelected ? "#3b82f6" : (obj.stroke || "black")}
                                        strokeWidth={isSelected ? Math.max(0.75, (obj.strokeWidth || 0.5) * 1.5) : (obj.strokeWidth || 0.5)}
                                        strokeOpacity={obj.opacity ?? 1}
                                        fillOpacity={obj.opacity ?? 1}
                                        vectorEffect="non-scaling-stroke"
                                    />
                                );
                            })}

                            {currentStroke && (
                                <line
                                    x1={currentStroke.p1[0]} y1={currentStroke.p1[1]}
                                    x2={currentStroke.p2[0]} y2={currentStroke.p2[1]}
                                    stroke="#ef4444" strokeWidth="0.5" strokeDasharray="1 1" vectorEffect="non-scaling-stroke"
                                />
                            )}
                            {currentPath.length > 1 && (
                                <polyline points={currentPath.map(p => `${p[0]},${p[1]}`).join(' ')} fill="none" stroke="red" strokeWidth="0.75" strokeDasharray="1 1" vectorEffect="non-scaling-stroke" />
                            )}
                            {previewShape && (
                                <>
                                    <polygon points={previewShape.points.map(p => `${p[0]},${p[1]}`).join(' ')} fill="rgba(255,0,0,0.1)" stroke="red" strokeWidth="0.75" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
                                    {isMirrorMode && (
                                        <polygon
                                            points={previewShape.points.map(p => `${(100 * coordinateAspect) - p[0]},${p[1]}`).join(' ')}
                                            fill="rgba(255,0,0,0.1)" stroke="red" strokeWidth="0.75" strokeDasharray="2 2" vectorEffect="non-scaling-stroke"
                                        />
                                    )}
                                </>
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

                    {/* Selection Handles (Only show if ONE shape is selected) */}
                    {primaryShape && (
                        <svg
                            className="absolute z-50 overflow-visible"
                            style={{
                                pointerEvents: 'none',
                                top: 0,
                                left: isFull ? 0 : (logicalWidth / 2) - pageMargin,
                                width: innerLogicalWidth,
                                height: innerLogicalHeight
                            }}
                            viewBox={`0 0 ${100 * coordinateAspect} 100`}
                            preserveAspectRatio="none"
                        >
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
