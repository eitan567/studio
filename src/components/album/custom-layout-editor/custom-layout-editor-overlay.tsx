import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AlbumPage, AlbumConfig } from '@/lib/types';
import { LayoutSidebarLeft } from './layout-sidebar-left';
import { LayoutSidebarRight } from './layout-sidebar-right';
import { LayoutCanvas } from './layout-canvas';
import { FloatingToolbar } from './floating-toolbar';
import { LayersPanel } from './layers-panel';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import {
    Check,
    X,
    BookOpen,
    Book,
    Maximize,
    FolderOpen,
    Shield,
    AlignStartVertical,
    AlignCenterVertical,
    AlignEndVertical,
    AlignStartHorizontal,
    AlignCenterHorizontal,
    AlignEndHorizontal,
    AlignHorizontalDistributeCenter,
    AlignVerticalDistributeCenter,
    AlignHorizontalJustifyCenter,
    AlignVerticalJustifyCenter,
    RotateCw
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useTemplates, getPhotoCount } from '@/hooks/useTemplates';
import { Sheet } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { processLayoutGeometry } from '@/lib/layout-geometry';
import { createClient } from '@/lib/supabase';
import { VectorObject, Point, Segment, LayoutRegion, AdvancedTemplate } from '@/lib/advanced-layout-types';
import { GridDesignerMode, GridDesignerSegment } from './grid-designer-types';
import { useAuth } from "@/hooks/useAuth";
import { ModeToggle } from "@/components/mode-toggle";
import { UserNav } from "@/components/user-nav";
import { AdminSettingsDialog } from "@/components/admin/admin-settings-dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ToolMode = 'select' | 'pencil' | 'rect' | 'circle';

interface CustomLayoutEditorOverlayProps {
    onClose: () => void;
    config?: AlbumConfig;
    customTemplates?: AdvancedTemplate[];
    onAddTemplate?: (template: AdvancedTemplate) => void;
}

import { useTheme } from 'next-themes';

const normalizeHexColor = (value?: string): string => {
    if (!value) return '#ffffff';
    return /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#ffffff';
};

const updateVectorObjectPoints = (obj: VectorObject, newPoints: Point[]): VectorObject => {
    const newSegments: Segment[] = [];
    for (let i = 0; i < newPoints.length - 1; i++) {
        newSegments.push({ p1: newPoints[i], p2: newPoints[i + 1] });
    }
    if (newPoints.length >= 3) {
        newSegments.push({ p1: newPoints[newPoints.length - 1], p2: newPoints[0] });
    }
    return { ...obj, points: newPoints, segments: newSegments };
};

const normalizeAngleRad = (angle: number): number => {
    const twoPi = Math.PI * 2;
    let a = angle % twoPi;
    if (a <= -Math.PI) a += twoPi;
    if (a > Math.PI) a -= twoPi;
    return a;
};

const rotatePointAround = (p: Point, center: Point, angleRad: number): Point => {
    const dx = p[0] - center[0];
    const dy = p[1] - center[1];
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    return [
        center[0] + dx * cos - dy * sin,
        center[1] + dx * sin + dy * cos
    ];
};

const getPointsBoundingBox = (points: Point[]) => {
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return {
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX,
        height: maxY - minY,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2
    };
};

const getSmartAngleRad = (points: Point[]): number => {
    if (points.length < 2) return 0;

    if (points.length === 2) {
        return normalizeAngleRad(Math.atan2(points[1][1] - points[0][1], points[1][0] - points[0][0]));
    }

    const computeAreaAtAngle = (rad: number): number => {
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

        return (maxU - minU) * (maxV - minV);
    };

    let bestAngle = 0;
    let minArea = Infinity;

    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        if (Math.abs(dx) < 0.000001 && Math.abs(dy) < 0.000001) continue;

        const angle = Math.atan2(dy, dx);
        const area = computeAreaAtAngle(angle);

        if (area < minArea - 0.001) {
            minArea = area;
            bestAngle = angle;
        }
    }

    return normalizeAngleRad(bestAngle);
};

type SelectionBounds = {
    index: number;
    id: string;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    centerX: number;
    centerY: number;
    width: number;
    height: number;
};

const getObjectBounds = (obj: VectorObject): Omit<SelectionBounds, 'index' | 'id'> | null => {
    const sourcePoints: Point[] =
        obj.points && obj.points.length > 0
            ? obj.points
            : (obj.segments || []).flatMap(s => [s.p1, s.p2]);

    if (sourcePoints.length === 0) return null;
    return getPointsBoundingBox(sourcePoints);
};

const translateObjectBy = (obj: VectorObject, dx: number, dy: number): VectorObject => {
    const shift = (p: Point): Point => [p[0] + dx, p[1] + dy];
    return {
        ...obj,
        points: obj.points?.map(shift),
        segments: obj.segments?.map(s => ({ p1: shift(s.p1), p2: shift(s.p2) }))
    };
};

const scaleObjectAroundCenter = (obj: VectorObject, scaleX: number, scaleY: number): VectorObject => {
    const sourcePoints: Point[] =
        obj.points && obj.points.length > 0
            ? obj.points
            : (obj.segments || []).flatMap(s => [s.p1, s.p2]);

    if (sourcePoints.length === 0) return obj;

    const bounds = getPointsBoundingBox(sourcePoints);
    const center: Point = [bounds.centerX, bounds.centerY];
    const scale = (p: Point): Point => [
        center[0] + ((p[0] - center[0]) * scaleX),
        center[1] + ((p[1] - center[1]) * scaleY)
    ];

    return {
        ...obj,
        points: obj.points?.map(scale),
        segments: obj.segments?.map(s => ({ p1: scale(s.p1), p2: scale(s.p2) }))
    };
};

const cloneVectorObjects = (objects?: VectorObject[]): VectorObject[] => {
    if (!Array.isArray(objects)) return [];
    return objects.map(obj => ({
        ...obj,
        points: obj.points?.map(p => [p[0], p[1]] as Point),
        segments: (obj.segments || []).map(s => ({
            p1: [s.p1[0], s.p1[1]] as Point,
            p2: [s.p2[0], s.p2[1]] as Point
        }))
    }));
};

const parseTemplateDescriptionObject = (description?: string | null): Record<string, unknown> => {
    if (!description) return {};
    try {
        const parsed = JSON.parse(description);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
};

type EditorGridSnapshot = {
    rows: number;
    cols: number;
    mode: GridDesignerMode;
    rotationDeg: number;
    segments: GridDesignerSegment[];
};

const cloneGridDesignerSegments = (segments: GridDesignerSegment[]): GridDesignerSegment[] =>
    segments.map((segment) => ({
        id: segment.id,
        orientation: segment.orientation,
        p1: [segment.p1[0], segment.p1[1]] as Point,
        p2: [segment.p2[0], segment.p2[1]] as Point,
        active: !!segment.active
    }));

const parseEditorGridSnapshot = (value: unknown): EditorGridSnapshot | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const raw = value as Record<string, unknown>;
    const rows = typeof raw.rows === 'number' ? Math.max(1, Math.min(12, Math.floor(raw.rows))) : 3;
    const cols = typeof raw.cols === 'number' ? Math.max(1, Math.min(12, Math.floor(raw.cols))) : 4;
    const modeRaw = raw.mode;
    const mode: GridDesignerMode =
        modeRaw === 'none' || modeRaw === 'move' || modeRaw === 'delete' || modeRaw === 'add-horizontal' || modeRaw === 'add-vertical'
            ? modeRaw
            : 'none';
    const rawRotation = typeof raw.rotationDeg === 'number' ? raw.rotationDeg : 0;
    const rotationDeg = Number.isFinite(rawRotation)
        ? (((rawRotation % 360) + 360) % 360)
        : 0;

    if (!Array.isArray(raw.segments)) return null;

    const segments: GridDesignerSegment[] = raw.segments
        .map((seg) => {
            if (!seg || typeof seg !== 'object' || Array.isArray(seg)) return null;
            const s = seg as Record<string, unknown>;
            const p1 = s.p1;
            const p2 = s.p2;
            const orientation = s.orientation;
            if (
                !Array.isArray(p1) || p1.length !== 2 ||
                !Array.isArray(p2) || p2.length !== 2 ||
                typeof p1[0] !== 'number' || typeof p1[1] !== 'number' ||
                typeof p2[0] !== 'number' || typeof p2[1] !== 'number' ||
                (orientation !== 'horizontal' && orientation !== 'vertical')
            ) {
                return null;
            }
            return {
                id: typeof s.id === 'string' ? s.id : uuidv4(),
                orientation,
                p1: [p1[0], p1[1]] as Point,
                p2: [p2[0], p2[1]] as Point,
                active: typeof s.active === 'boolean' ? s.active : true
            } as GridDesignerSegment;
        })
        .filter((seg): seg is GridDesignerSegment => !!seg);

    if (segments.length === 0) return null;
    return { rows, cols, mode, rotationDeg, segments };
};

const GRID_EDITOR_SEGMENT_EPSILON = 1e-4;

const isSamePoint = (a: Point, b: Point, epsilon: number = GRID_EDITOR_SEGMENT_EPSILON): boolean =>
    Math.abs(a[0] - b[0]) <= epsilon && Math.abs(a[1] - b[1]) <= epsilon;

const isSegmentEquivalent = (a: Segment, b: Segment): boolean =>
    (isSamePoint(a.p1, b.p1) && isSamePoint(a.p2, b.p2)) ||
    (isSamePoint(a.p1, b.p2) && isSamePoint(a.p2, b.p1));

const isGridGeneratedLineObject = (obj: VectorObject, gridSegments: GridDesignerSegment[]): boolean => {
    if (obj.type !== 'line') return false;
    if (!obj.segments || obj.segments.length !== 1) return false;
    const objSegment = obj.segments[0];
    return gridSegments.some((gridSegment) =>
        isSegmentEquivalent(objSegment, { p1: gridSegment.p1, p2: gridSegment.p2 })
    );
};

const getLayerObjectDisplayName = (obj: VectorObject, index: number) => {
    if (obj.type === 'path') return `Frame ${index + 1}`;
    if (obj.type === 'rect') return `Rectangle ${index + 1}`;
    if (obj.type === 'circle') return `Circle ${index + 1}`;
    return `Object ${index + 1}`;
};

type AlignMode = 'left' | 'h-center' | 'right' | 'top' | 'v-center' | 'bottom';
type DistributeMode = 'horizontal' | 'vertical';
type SizeMatchMode = 'size' | 'width' | 'height';
type LayersDockSide = 'left' | 'right' | null;

const LAYERS_PANEL_SAFE_MARGIN = 8;
const LAYERS_PANEL_DOCK_THRESHOLD = 26;
const LAYERS_PANEL_MIN_HEIGHT = 96;

export const CustomLayoutEditorOverlay = ({ onClose, config, customTemplates, onAddTemplate }: CustomLayoutEditorOverlayProps) => {
    const { findGridTemplate, defaultGridTemplate, allTemplates, refresh } = useTemplates();
    const { resolvedTheme } = useTheme();
    const { isAdmin } = useAuth();
    const [adminOpen, setAdminOpen] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState<AdvancedTemplate | null>(null);

    // Use only templates passed via props (if any) or start empty for session
    // Do NOT auto-load all custom templates from the global cache to avoid cluttering "New Templates"
    const existingCustomTemplates = useMemo(() => {
        return customTemplates || [];
    }, [customTemplates]);

    // Local state for created templates (starts empty)
    const [createdTemplates, setCreatedTemplates] = useState<AdvancedTemplate[]>([]);

    // Create a dummy page with empty or sample photo slots
    const createDummyPage = (layoutId: string, useDummy: boolean = false): AlbumPage => {
        const template = findGridTemplate(layoutId) || defaultGridTemplate;
        const totalPhotos = getPhotoCount(template) * 2; // For both pages of spread

        const photos = Array(totalPhotos).fill(null).map((_, index) => {
            if (useDummy) {
                // Generate sample images using picsum.photos with different seeds
                const seed = `layout-${layoutId}-${index}`;
                return {
                    id: uuidv4(),
                    src: `https://picsum.photos/seed/${seed}/800/600`,
                    alt: `Sample photo ${index + 1}`,
                    width: 800,
                    height: 600,
                    panAndZoom: { scale: 1, x: 50, y: 50 }
                };
            } else {
                return {
                    id: uuidv4(),
                    src: '',
                    alt: 'Drop photo here',
                    panAndZoom: { scale: 1, x: 50, y: 50 }
                };
            }
        });

        return {
            id: 'custom-layout-preview',
            type: 'spread',
            photos,
            layout: layoutId,
            spreadMode: 'full',
            spreadLayouts: {
                left: layoutId,
                right: layoutId
            },
            photoGap: photoGap,
            pageMargin: pageMargin
        };
    };


    const [selectedLayout, setSelectedLayout] = useState('4-grid');
    const [spreadMode, setSpreadMode] = useState<'full' | 'split'>('full');
    const [photoGap, setPhotoGap] = useState(() => config?.photoGap ?? 2);
    const [pageMargin, setPageMargin] = useState(() => config?.pageMargin ?? 0);
    const [cornerRadius, setCornerRadius] = useState(() => config?.cornerRadius ?? 0);
    const [backgroundColor, setBackgroundColor] = useState(() => normalizeHexColor(config?.backgroundColor));
    const [useDummyPhotos, setUseDummyPhotos] = useState(true);
    const [dummyPage, setDummyPage] = useState<AlbumPage>(() => createDummyPage('4-grid', true));
    const [selectedAdvancedTemplate, setSelectedAdvancedTemplate] = useState<AdvancedTemplate | null>(null);
    const [editingTemplateId, setEditingTemplateId] = useState<string | number | null>(null);
    const [templateName, setTemplateName] = useState('');

    // VECTOR TOOLS STATE
    const [toolMode, setToolMode] = useState<ToolMode>('select');
    const [vectorObjects, setVectorObjects] = useState<VectorObject[]>([]);
    // Vector Properties State
    const [strokeColor, setStrokeColor] = useState('#000000');
    const [strokeWidth, setStrokeWidth] = useState(0.5);
    const [fillColor, setFillColor] = useState('transparent');

    const [currentStroke, setCurrentStroke] = useState<Segment | null>(null);
    const [isMirrorMode, setIsMirrorMode] = useState(false);
    const [selectedShapeIndices, setSelectedShapeIndices] = useState<number[]>([]);
    const [showGuides, setShowGuides] = useState(true);
    const [isLayersPanelOpen, setIsLayersPanelOpen] = useState(false);
    const [layersPanelPosition, setLayersPanelPosition] = useState({ x: 24, y: 24 });
    const [layersPanelDockSide, setLayersPanelDockSide] = useState<LayersDockSide>(null);
    const [isLayersPanelDockLocked, setIsLayersPanelDockLocked] = useState(false);
    const [layersPanelCollapsedState, setLayersPanelCollapsedState] = useState<Record<number, boolean>>({});
    const [workspaceSize, setWorkspaceSize] = useState({ width: 0, height: 0 });
    const [isLeaderGroupRotateEnabled, setIsLeaderGroupRotateEnabled] = useState(false);
    const [isLeaderGroupResizeEnabled, setIsLeaderGroupResizeEnabled] = useState(false);
    const [isGridDesignerEnabled, setIsGridDesignerEnabled] = useState(false);
    const [gridRows, setGridRows] = useState(3);
    const [gridCols, setGridCols] = useState(4);
    const [gridDesignerMode, setGridDesignerMode] = useState<GridDesignerMode>('none');
    const [gridRotationDeg, setGridRotationDeg] = useState(0);
    const [gridDesignerSegments, setGridDesignerSegments] = useState<GridDesignerSegment[]>([]);
    const canvasWorkspaceRef = useRef<HTMLDivElement>(null);
    const floatingLayersRef = useRef<HTMLDivElement>(null);

    const canvasLogicalWidthUnits = useMemo(() => {
        let configW = 20;
        let configH = 20;

        if (config?.size) {
            const parts = config.size.split('x').map(Number);
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                configW = parts[0];
                configH = parts[1];
            }
        }

        const BASE_PAGE_PX = 450;
        const pxPerUnit = BASE_PAGE_PX / configH;
        const pageW_px = configW * pxPerUnit;
        const pageH_px = BASE_PAGE_PX;
        const logicalWidthPx = spreadMode === 'full' ? pageW_px * 2 : pageW_px;

        return (logicalWidthPx / pageH_px) * 100;
    }, [config?.size, spreadMode]);

    const showGridLayerProxy = gridDesignerSegments.some((segment) => segment.active);

    const layersPanelSizing = useMemo(() => {
        const layerItemCounts = new Map<number, number>();
        let maxNameChars = 0;
        let maxLayerChars = 0;

        vectorObjects.forEach((obj, index) => {
            const z = obj.zIndex ?? 0;
            layerItemCounts.set(z, (layerItemCounts.get(z) ?? 0) + 1);
            maxNameChars = Math.max(maxNameChars, getLayerObjectDisplayName(obj, index).length);
            maxLayerChars = Math.max(maxLayerChars, `Layer ${z}`.length);
        });

        if (showGridLayerProxy) {
            layerItemCounts.set(0, (layerItemCounts.get(0) ?? 0) + 1);
            maxNameChars = Math.max(maxNameChars, 'Grid Designer'.length);
            maxLayerChars = Math.max(maxLayerChars, 'Layer 0'.length);
        }

        const layerEntries = Array.from(layerItemCounts.entries());
        const layerCount = layerEntries.length;
        const layerHeaderHeight = 24;
        const itemRowHeight = 34;
        const itemRowGap = 2;
        const layerHeaderItemsGap = 4;
        const groupGap = 16;
        const contentPadding = 24;
        // Header is a single row (title + controls + count)
        const headerHeight = 56;
        const footerHeight = 34;
        // Empty-state block includes container padding + message line
        const emptyStateHeight = 96;

        const expandedContentHeight = layerEntries.reduce((sum, [z, count]) => {
            if (layersPanelCollapsedState[z]) return sum;
            if (count <= 0) return sum;
            const itemGaps = Math.max(0, count - 1) * itemRowGap;
            return sum + layerHeaderItemsGap + (count * itemRowHeight) + itemGaps;
        }, 0);
        const allLayersCollapsed = layerCount > 0 && layerEntries.every(([z]) => layersPanelCollapsedState[z]);
        const collapsedBottomPadding = allLayersCollapsed ? 8 : 0;

        const listHeight = layerCount === 0
            ? emptyStateHeight
            : (layerCount * layerHeaderHeight)
                + expandedContentHeight
                + (Math.max(0, layerCount - 1) * groupGap)
                + contentPadding
                + collapsedBottomPadding;

        const naturalHeight = Math.max(LAYERS_PANEL_MIN_HEIGHT, headerHeight + listHeight + footerHeight);

        const objectsCountLabelChars = `${vectorObjects.length + (showGridLayerProxy ? 1 : 0)} objects`.length;
        const headerWidth = 160 + (objectsCountLabelChars * 6);
        const layerHeaderWidth = 112 + (maxLayerChars * 7);
        const itemRowWidth = 150 + (maxNameChars * 7);
        const widthByText = Math.max(headerWidth, layerHeaderWidth, itemRowWidth);
        const width = Math.max(230, Math.min(380, Math.ceil(widthByText)));

        return {
            width,
            naturalHeight
        };
    }, [vectorObjects, layersPanelCollapsedState, showGridLayerProxy]);

    const handleLayersCollapsedChange = useCallback((next: Record<number, boolean>) => {
        setLayersPanelCollapsedState((prev) => {
            const prevKeys = Object.keys(prev);
            const nextKeys = Object.keys(next);
            if (prevKeys.length === nextKeys.length && nextKeys.every((k) => prev[Number(k)] === next[Number(k)])) {
                return prev;
            }
            return next;
        });
    }, []);

    const GRID_ROTATION_BOUNDARY_EPSILON = 0.001;
    const GRID_ROTATION_SNAP_STEP = 0.001;

    const quantizeGridValue = useCallback((value: number): number => {
        return Math.round(value / GRID_ROTATION_SNAP_STEP) * GRID_ROTATION_SNAP_STEP;
    }, []);

    const quantizeGridPoint = useCallback((p: Point): Point => {
        return [quantizeGridValue(p[0]), quantizeGridValue(p[1])];
    }, [quantizeGridValue]);

    const isPointOnGridBoundary = useCallback((p: Point, width: number): boolean => {
        return (
            Math.abs(p[0]) <= GRID_ROTATION_BOUNDARY_EPSILON ||
            Math.abs(p[0] - width) <= GRID_ROTATION_BOUNDARY_EPSILON ||
            Math.abs(p[1]) <= GRID_ROTATION_BOUNDARY_EPSILON ||
            Math.abs(p[1] - 100) <= GRID_ROTATION_BOUNDARY_EPSILON
        );
    }, []);

    const rotatePointAround = useCallback((point: Point, center: Point, angleRad: number): Point => {
        const dx = point[0] - center[0];
        const dy = point[1] - center[1];
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);
        return [
            center[0] + (dx * cos) - (dy * sin),
            center[1] + (dx * sin) + (dy * cos)
        ];
    }, []);

    const getLineRectangleIntersections = useCallback((anchor: Point, direction: Point, width: number): Point[] => {
        const dx = direction[0];
        const dy = direction[1];
        const eps = 1e-8;
        const candidates: Point[] = [];

        const pushIfValid = (x: number, y: number) => {
            if (x < -eps || x > width + eps || y < -eps || y > 100 + eps) return;
            const clamped: Point = [Math.min(width, Math.max(0, x)), Math.min(100, Math.max(0, y))];
            if (!candidates.some((p) => Math.abs(p[0] - clamped[0]) < 1e-6 && Math.abs(p[1] - clamped[1]) < 1e-6)) {
                candidates.push(clamped);
            }
        };

        if (Math.abs(dx) > eps) {
            const tLeft = (0 - anchor[0]) / dx;
            pushIfValid(0, anchor[1] + (dy * tLeft));
            const tRight = (width - anchor[0]) / dx;
            pushIfValid(width, anchor[1] + (dy * tRight));
        }
        if (Math.abs(dy) > eps) {
            const tTop = (0 - anchor[1]) / dy;
            pushIfValid(anchor[0] + (dx * tTop), 0);
            const tBottom = (100 - anchor[1]) / dy;
            pushIfValid(anchor[0] + (dx * tBottom), 100);
        }

        return candidates;
    }, []);

    const createGridSegments = useCallback((rows: number, cols: number): GridDesignerSegment[] => {
        const safeRows = Math.max(1, Math.floor(rows));
        const safeCols = Math.max(1, Math.floor(cols));
        const xStep = canvasLogicalWidthUnits / safeCols;
        const yStep = 100 / safeRows;

        const segments: GridDesignerSegment[] = [];

        for (let r = 1; r < safeRows; r++) {
            const y = yStep * r;
            for (let c = 0; c < safeCols; c++) {
                const x1 = xStep * c;
                const x2 = xStep * (c + 1);
                segments.push({
                    id: uuidv4(),
                    orientation: 'horizontal',
                    p1: [x1, y],
                    p2: [x2, y],
                    active: true
                });
            }
        }

        for (let c = 1; c < safeCols; c++) {
            const x = xStep * c;
            for (let r = 0; r < safeRows; r++) {
                const y1 = yStep * r;
                const y2 = yStep * (r + 1);
                segments.push({
                    id: uuidv4(),
                    orientation: 'vertical',
                    p1: [x, y1],
                    p2: [x, y2],
                    active: true
                });
            }
        }

        return segments;
    }, [canvasLogicalWidthUnits]);

    const handleCreateGrid = useCallback(() => {
        const rows = Math.max(1, Math.min(12, Math.floor(gridRows)));
        const cols = Math.max(1, Math.min(12, Math.floor(gridCols)));
        setGridRows(rows);
        setGridCols(cols);
        setGridDesignerSegments(createGridSegments(rows, cols));
        setGridRotationDeg(0);
        setIsGridDesignerEnabled(true);
        setGridDesignerMode('none');
        setToolMode('select');
        setSelectedShapeIndices([]);
    }, [createGridSegments, gridRows, gridCols]);

    const handleRotateGrid = useCallback((deltaDeg: number) => {
        if (!Number.isFinite(deltaDeg) || Math.abs(deltaDeg) < 0.0001) return;
        if (gridDesignerSegments.length === 0) return;

        const width = canvasLogicalWidthUnits;
        const center: Point = [width / 2, 50];
        const angleRad = (deltaDeg * Math.PI) / 180;

        setGridDesignerSegments((prev) => prev.map((segment) => {
            const oldP1: Point = [segment.p1[0], segment.p1[1]];
            const oldP2: Point = [segment.p2[0], segment.p2[1]];
            const touchesBoundaryP1 = isPointOnGridBoundary(oldP1, width);
            const touchesBoundaryP2 = isPointOnGridBoundary(oldP2, width);

            let p1 = rotatePointAround(oldP1, center, angleRad);
            let p2 = rotatePointAround(oldP2, center, angleRad);

            // Infinite-grid clipping behavior for segments that touched the page border.
            if (touchesBoundaryP1 || touchesBoundaryP2) {
                const dir: Point = [p2[0] - p1[0], p2[1] - p1[1]];
                const intersections = getLineRectangleIntersections(p1, dir, width);

                if (intersections.length >= 2) {
                    if (touchesBoundaryP1 && touchesBoundaryP2) {
                        const first = intersections[0];
                        const second = intersections[1];
                        const keepOrder =
                            (Math.hypot(first[0] - p1[0], first[1] - p1[1]) + Math.hypot(second[0] - p2[0], second[1] - p2[1])) <=
                            (Math.hypot(second[0] - p1[0], second[1] - p1[1]) + Math.hypot(first[0] - p2[0], first[1] - p2[1]));
                        p1 = keepOrder ? first : second;
                        p2 = keepOrder ? second : first;
                    } else if (touchesBoundaryP1) {
                        p1 = intersections.reduce((best, candidate) =>
                            Math.hypot(candidate[0] - p1[0], candidate[1] - p1[1]) < Math.hypot(best[0] - p1[0], best[1] - p1[1])
                                ? candidate
                                : best
                        );
                    } else if (touchesBoundaryP2) {
                        p2 = intersections.reduce((best, candidate) =>
                            Math.hypot(candidate[0] - p2[0], candidate[1] - p2[1]) < Math.hypot(best[0] - p2[0], best[1] - p2[1])
                                ? candidate
                                : best
                        );
                    }
                }
            }

            const nextP1 = quantizeGridPoint(p1);
            const nextP2 = quantizeGridPoint(p2);

            return {
                ...segment,
                p1: nextP1,
                p2: nextP2
            };
        }));

        setGridRotationDeg((prev) => {
            const next = ((prev + deltaDeg) % 360 + 360) % 360;
            return Math.abs(next) < 0.0001 ? 0 : next;
        });
        setIsGridDesignerEnabled(true);
        setGridDesignerMode('none');
        setToolMode('select');
        setSelectedShapeIndices([]);
    }, [
        gridDesignerSegments.length,
        canvasLogicalWidthUnits,
        isPointOnGridBoundary,
        rotatePointAround,
        getLineRectangleIntersections,
        quantizeGridPoint
    ]);

    const activeGridSegments = useMemo(
        () => gridDesignerSegments.filter((segment) => segment.active),
        [gridDesignerSegments]
    );
    const isGridRotationActive = Math.abs(gridRotationDeg) > 0.0001;

    useEffect(() => {
        const workspace = canvasWorkspaceRef.current;
        if (!workspace) return;

        const measure = () => {
            const rect = workspace.getBoundingClientRect();
            setWorkspaceSize({ width: rect.width, height: rect.height });
        };

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(workspace);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isLayersPanelOpen || (layersPanelDockSide && isLayersPanelDockLocked)) return;
        if (workspaceSize.width <= 0 || workspaceSize.height <= 0) return;

        const maxX = Math.max(LAYERS_PANEL_SAFE_MARGIN, workspaceSize.width - layersPanelSizing.width - LAYERS_PANEL_SAFE_MARGIN);
        const maxY = Math.max(LAYERS_PANEL_SAFE_MARGIN, workspaceSize.height - LAYERS_PANEL_MIN_HEIGHT - LAYERS_PANEL_SAFE_MARGIN);

        setLayersPanelPosition((prev) => ({
            x: Math.max(LAYERS_PANEL_SAFE_MARGIN, Math.min(maxX, prev.x)),
            y: Math.max(LAYERS_PANEL_SAFE_MARGIN, Math.min(maxY, prev.y))
        }));
    }, [isLayersPanelOpen, layersPanelDockSide, isLayersPanelDockLocked, layersPanelSizing.width, workspaceSize.width, workspaceSize.height]);

    // Dynamic Theme Update: When theme changes, update state AND existing objects
    useEffect(() => {
        const isDark = resolvedTheme === 'dark';
        const newStroke = isDark ? '#ffffff' : '#000000';
        const newFill = isDark ? '#292929' : '#ededed';

        setStrokeColor(newStroke);
        setFillColor(newFill);

        // Update all existing shapes to match the new theme defaults
        setVectorObjects(prev => prev.map((obj, index) => {
            // Background frame (index 0) gets a distinct color
            const isBackground = index === 0;
            const bgFill = isDark ? '#1f1f1f' : '#f5f5f5';

            return {
                ...obj,
                stroke: newStroke,
                fill: isBackground ? bgFill : newFill // Force update fill to match theme with distinction
            };
        }));
    }, [resolvedTheme]);

    // 1. When selection changes, update sidebar to match the first selected object's properties
    useEffect(() => {
        if (selectedShapeIndices.length > 0) {
            const firstIdx = selectedShapeIndices[0];
            const obj = vectorObjects[firstIdx];
            if (obj) {
                if (obj.stroke) setStrokeColor(obj.stroke);
                if (obj.strokeWidth !== undefined) setStrokeWidth(obj.strokeWidth);
                if (obj.fill) setFillColor(obj.fill);
            }
        }
    }, [selectedShapeIndices]); // Note: we don't depend on vectorObjects here to avoid loops during property updates

    // 2. When properties change in sidebar, apply them to all selected objects
    useEffect(() => {
        if (selectedShapeIndices.length > 0 && vectorObjects.length > 0) {
            let changed = false;
            const newObjects = vectorObjects.map((obj, idx) => {
                if (selectedShapeIndices.includes(idx)) {
                    if (obj.stroke !== strokeColor || obj.strokeWidth !== strokeWidth || obj.fill !== fillColor) {
                        changed = true;
                        return {
                            ...obj,
                            stroke: strokeColor,
                            strokeWidth: strokeWidth,
                            fill: fillColor
                        };
                    }
                }
                return obj;
            });

            if (changed) {
                setVectorObjects(newObjects);
            }
        }
    }, [strokeColor, strokeWidth, fillColor]);

    // Handle advanced template selection
    const handleSelectAdvancedTemplate = (template: AdvancedTemplate, preferredMode?: 'full' | 'split', isEdit: boolean = false) => {
        setSelectedAdvancedTemplate(template);

        const isSystemTemplate = template.createdBy === 'system';

        if (isEdit) {
            if (isSystemTemplate) {
                // For system templates, force save-as-new by keeping editingTemplateId null
                setEditingTemplateId(null);
                setTemplateName(`${template.name} Copy`);
            } else {
                // For custom templates, allow updating
                setEditingTemplateId(template.id);
                setTemplateName(template.name);
            }
        } else {
            setEditingTemplateId(null);
            setTemplateName('');
        }
        // Determine target spread mode and coordinate scaling
        let targetSpreadMode = preferredMode || template._editorSpreadMode || spreadMode;
        if (template.type === 'spread') {
            targetSpreadMode = 'full';
        } else if (template.type === 'single') {
            targetSpreadMode = 'split';
        }

        const isFullSpread = targetSpreadMode === 'full';
        const scaleX = isFullSpread ? 2 : 1;


        const descriptionData = parseTemplateDescriptionObject(template.description);
        const gridSnapshot = parseEditorGridSnapshot(descriptionData._editorGrid);

        const editorSnapshot = cloneVectorObjects(template._editorObjects);

        // Only load editable data for editing mode
        if (isEdit) {
            if (gridSnapshot) {
                // Restore full Grid Designer editing state exactly as it was before processing.
                setGridRows(gridSnapshot.rows);
                setGridCols(gridSnapshot.cols);
                setGridRotationDeg(gridSnapshot.rotationDeg || 0);
                setGridDesignerMode((gridSnapshot.rotationDeg || 0) > 0.0001 ? 'none' : gridSnapshot.mode);
                setGridDesignerSegments(cloneGridDesignerSegments(gridSnapshot.segments));
                setIsGridDesignerEnabled(true);
                setToolMode('select');
                setSelectedShapeIndices([]);
                const cleanedEditorSnapshot = editorSnapshot.filter(
                    (obj) => !isGridGeneratedLineObject(obj, gridSnapshot.segments)
                );
                setVectorObjects(cleanedEditorSnapshot);
            } else {
                setGridRotationDeg(0);
                setGridDesignerSegments([]);
                setIsGridDesignerEnabled(false);

                if (editorSnapshot.length > 0) {
                    setVectorObjects(editorSnapshot);
                } else {
                    // Backward compatibility: Convert template regions to VectorObjects
                    const newVectorObjects: VectorObject[] = template.regions.map((region, index) => {
                        const isPath = region.shape === 'path';
                        let points: Point[] = region.points || [];

                        // For path objects, generate a bounding box to allow manipulation (points will be used for translation)
                        let pathPoints: Point[] | undefined = undefined;
                        if (isPath) {
                            const { x, y, width, height } = region.bounds;
                            pathPoints = [
                                [x * scaleX, y],
                                [(x + width) * scaleX, y],
                                [(x + width) * scaleX, y + height],
                                [x * scaleX, y + height]
                            ];
                        }

                        // For polygons, generate segments
                        const segments: Segment[] = [];
                        if (!isPath && points.length > 1) {
                            for (let i = 0; i < points.length - 1; i++) {
                                segments.push({ p1: [points[i][0] * scaleX, points[i][1]] as Point, p2: [points[i + 1][0] * scaleX, points[i + 1][1]] as Point });
                            }
                            // Close polygon if needed
                            if (points.length > 2 && (points[0][0] !== points[points.length - 1][0] || points[0][1] !== points[points.length - 1][1])) {
                                segments.push({ p1: [points[points.length - 1][0] * scaleX, points[points.length - 1][1]] as Point, p2: [points[0][0] * scaleX, points[0][1]] as Point });
                            }
                        } else if (!isPath && region.shape === 'rect') {
                            const { x, y, width, height } = region.bounds;
                            const rectPoints: Point[] = [
                                [x * scaleX, y],
                                [(x + width) * scaleX, y],
                                [(x + width) * scaleX, y + height],
                                [x * scaleX, y + height]
                            ];
                            for (let i = 0; i < 4; i++) {
                                segments.push({ p1: rectPoints[i], p2: rectPoints[(i + 1) % 4] });
                            }
                            // For rect shapes, we MUST ensure points are populated so LayoutCanvas can render the polygon
                            points = rectPoints;
                        }

                        // For other polygons/points, scale them if needed
                        const finalPoints = (region.shape === 'rect') ? points : points.map(p => [p[0] * scaleX, p[1]] as Point);

                        // Background frame (index 0) gets a distinct color
                        const isBackground = index === 0;
                        const isDark = resolvedTheme === 'dark';
                        const bgFill = isDark ? '#1f1f1f' : '#f5f5f5';

                        return {
                            id: region.id || uuidv4(),
                            type: isPath ? 'path' : (region.shape === 'rect' ? 'rect' : (region.shape === 'circle' ? 'circle' : 'polygon')),
                            segments,
                            points: isPath ? pathPoints : finalPoints,
                            path: region.path,
                            viewBox: region.viewBox,
                            stroke: strokeColor,
                            strokeWidth: region.strokeWidth || 0.5,
                            fill: isBackground ? bgFill : fillColor,
                            zIndex: region.zIndex ?? 0,
                            rotation: region.rotation || 0
                        };
                    });
                    setVectorObjects(newVectorObjects);
                }
            }
        } else {
            // Preview mode: clear editing overlays/objects so we see the final rendered result
            setVectorObjects([]);
            setGridRotationDeg(0);
            setGridDesignerSegments([]);
            setIsGridDesignerEnabled(false);
        }

        if (targetSpreadMode !== spreadMode) {
            setSpreadMode(targetSpreadMode);
        }

        // Create a dummy page with the right number of photos for this template
        const photos = Array(getPhotoCount(template)).fill(null).map((_, index) => {
            if (useDummyPhotos) {
                const seed = `adv-${template.id}-${index}`;
                return {
                    id: uuidv4(),
                    src: `https://picsum.photos/seed/${seed}/800/600`,
                    alt: `Sample photo ${index + 1}`,
                    width: 800,
                    height: 600,
                    panAndZoom: { scale: 1, x: 50, y: 50 }
                };
            }
            return {
                id: uuidv4(),
                src: '',
                alt: 'Drop photo here',
                panAndZoom: { scale: 1, x: 50, y: 50 }
            };
        });

        setDummyPage(prev => ({
            ...prev,
            photos,
            layout: template.id,
            photoGap: photoGap,
            pageMargin: pageMargin,
            spreadMode: targetSpreadMode
        }));
    };

    // Update dummy page when layout changes
    const handleLayoutChange = (layoutId: string, preferredMode?: 'full' | 'split') => {
        setSelectedLayout(layoutId);

        // Find the full template object to set selectedAdvancedTemplate
        const template = allTemplates.find(t => String(t.id) === String(layoutId));
        if (template) {
            handleSelectAdvancedTemplate(template, preferredMode);
        } else {
            setDummyPage(prev => ({
                ...createDummyPage(layoutId, useDummyPhotos),
                photoGap,
                pageMargin,
                spreadMode: preferredMode || spreadMode
            }));
        }
    };

    // Handle adding a Canva frame shape to the canvas as a VectorObject
    const handleAddCanvaFrame = (template: AdvancedTemplate) => {
        // Add only the first region as a draggable frame shape
        // We scale it to be placed at a reasonable size on the canvas while maintaining aspect ratio
        const firstRegion = template.regions[0];
        if (!firstRegion || !firstRegion.path) return;
        const snapToGrid = (value: number) => Math.round(value / 2) * 2;

        // Parse viewBox to get natural aspect ratio
        const viewBox = firstRegion.viewBox || '0 0 100 100';
        const vbParts = viewBox.split(' ').map(Number);
        const vbWidth = vbParts[2] || 100;
        const vbHeight = vbParts[3] || 100;
        const aspectRatio = vbWidth / vbHeight;

        // Base size for the frame (the larger dimension will be 30 canvas units)
        const baseSize = 30;
        let frameWidth: number;
        let frameHeight: number;

        if (aspectRatio >= 1) {
            // Wider than tall
            frameWidth = baseSize;
            frameHeight = baseSize / aspectRatio;
        } else {
            // Taller than wide
            frameHeight = baseSize;
            frameWidth = baseSize * aspectRatio;
        }

        // Center position on canvas
        const centerX = 35;
        const centerY = 35;
        const snappedX = snapToGrid(centerX);
        const snappedY = snapToGrid(centerY);

        // Calculate bounding box points for the frame
        const x = snappedX;
        const y = snappedY;
        const pathPoints: Point[] = [
            [x, y],
            [x + frameWidth, y],
            [x + frameWidth, y + frameHeight],
            [x, y + frameHeight]
        ];

        const selectedZ = selectedShapeIndices.length > 0
            ? (vectorObjects[selectedShapeIndices[0]]?.zIndex ?? 0)
            : 1;

        const newVectorObject: VectorObject = {
            id: uuidv4(),
            type: 'path' as const,
            segments: [],
            points: pathPoints,
            path: firstRegion.path,
            viewBox: firstRegion.viewBox,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            // Use a visible default fill - a soft gray/blue that looks like a frame placeholder
            fill: fillColor !== 'transparent' ? fillColor : 'rgba(100, 130, 180, 0.3)',
            zIndex: selectedZ,
            rotation: 0
        };

        // Add to existing vector objects
        setVectorObjects(prev => [...prev, newVectorObject]);
    };

    // Update dummy page when useDummyPhotos changes
    const handleUseDummyPhotosChange = (use: boolean) => {
        setUseDummyPhotos(use);
        setDummyPage(prev => ({
            ...createDummyPage(selectedLayout, use),
            photoGap,
            pageMargin,
            spreadMode
        }));
    };

    // Update dummy page when spread mode changes
    const handleSpreadModeChange = (mode: 'full' | 'split') => {
        setSpreadMode(mode);
        setDummyPage(prev => ({
            ...prev,
            spreadMode: mode
        }));
    };

    // Update dummy page when gap/margin changes
    const handlePhotoGapChange = (gap: number) => {
        setPhotoGap(gap);
        setDummyPage(prev => ({ ...prev, photoGap: gap }));
    };

    const handlePageMarginChange = (margin: number) => {
        setPageMargin(margin);
        setDummyPage(prev => ({ ...prev, pageMargin: margin }));
    };

    const handleCornerRadiusChange = (radius: number) => {
        setCornerRadius(radius);
        setDummyPage(prev => ({ ...prev, cornerRadius: radius }));
    };

    const handleBackgroundColorChange = (color: string) => {
        const normalized = normalizeHexColor(color);
        setBackgroundColor(normalized);
        setDummyPage(prev => ({ ...prev, backgroundColor: normalized }));
    };

    const handleSave = async () => {
        // Save all created templates to Supabase
        if (createdTemplates.length > 0) {
            try {
                const supabase = createClient();

                // Get current user
                const { data: { user } } = await supabase.auth.getUser();
                const userId = user?.id || 'anonymous';

                // Get the max ID from existing templates to generate new IDs
                const { data: maxIdResult } = await supabase
                    .from('templates')
                    .select('id')
                    .order('id', { ascending: false })
                    .limit(1);

                let nextId = (maxIdResult && maxIdResult.length > 0) ? (maxIdResult[0].id + 1) : 1000;

                // Prepare templates for insertion/update
                const templatesToProcess = createdTemplates.map(template => {
                    // Map type to type_id
                    let typeId = 3; // default BOTH
                    if (template.type === 'single') typeId = 1;
                    if (template.type === 'spread') typeId = 2;
                    const existingDescription = parseTemplateDescriptionObject(template.description);
                    const descriptionPayload = {
                        ...existingDescription,
                        _pageMargin: typeof template._pageMargin === 'number' ? template._pageMargin : pageMargin,
                        _photoGap: typeof template._photoGap === 'number' ? template._photoGap : photoGap,
                        type: template.type,
                        _editorVersion: template._editorVersion ?? 1,
                        _editorSpreadMode: template._editorSpreadMode ?? spreadMode,
                        _editorObjects: cloneVectorObjects(template._editorObjects)
                    };

                    const baseTemplate = {
                        name: templateName || template.name,
                        category_id: 5, // CUSTOM category
                        photo_count: template.photoCount,
                        regions: template.regions,
                        description: JSON.stringify(descriptionPayload),
                        created_by: userId === 'anonymous' ? null : userId,
                        is_system: false,
                        is_active: true,
                        sort_order: 999,
                        type_id: typeId
                    };

                    // Use the template's own ID. It adheres to logic:
                    // - If it was a system clone, handleProcessLayout assigned a UUID.
                    // - If it was a custom edit, handleProcessLayout kept the original ID.
                    const targetId = template.id;
                    const isNew = typeof targetId === 'string' && targetId.includes('-');

                    if (isNew) {
                        const newIntegerId = nextId++;
                        return { ...baseTemplate, id: newIntegerId };
                    } else {
                        return { ...baseTemplate, id: targetId };
                    }
                });

                if (templatesToProcess.length > 0) {
                    const { error: upsertError } = await supabase
                        .from('templates')
                        .upsert(templatesToProcess, { onConflict: 'id' });

                    if (upsertError) throw upsertError;
                }
                console.log('Templates saved successfully to Supabase');

                // Reload template cache + notify all open hooks in the app
                await refresh();
            } catch (error: any) {
                console.error('Failed to save templates to Supabase:', error);
                console.error('Error details:', {
                    message: error?.message,
                    code: error?.code,
                    details: error?.details,
                    hint: error?.hint,
                    name: error?.name
                });
                // Continue closing even if save fails - user can retry
            }
        }

        // Call parent callback if provided
        if (onAddTemplate && createdTemplates.length > 0) {
            createdTemplates.forEach(template => onAddTemplate(template));
        }

        onClose();
    };

    const handleDeleteTemplate = (template: AdvancedTemplate) => {
        setDeleteConfirmation(template);
    };

    const confirmDelete = async () => {
        if (!deleteConfirmation) return;

        const template = deleteConfirmation;
        setDeleteConfirmation(null); // Close dialog immediately

        try {
            const isNew = typeof template.id === 'string' && template.id.includes('-');

            if (isNew) {
                // Delete from local state only
                setCreatedTemplates(prev => prev.filter(t => t.id !== template.id));
                // If the deleted template was selected, clear selection
                if (selectedAdvancedTemplate?.id === template.id) {
                    handleClearAll();
                }
            } else {
                // Delete from Database
                const supabase = createClient();
                const { error } = await supabase
                    .from('templates')
                    .delete()
                    .eq('id', template.id);

                if (error) throw error;

                // Refresh cache to update UI
                await refresh();

                // If the deleted template was selected, clear selection
                if (selectedAdvancedTemplate?.id === template.id) {
                    handleClearAll();
                }
            }
        } catch (error) {
            console.error('Failed to delete template:', error);
            alert('Failed to delete template. Please try again.');
        }
    };

    // Handle changing layer (z-index)
    const handleReorderObjects = useCallback((objectId: string, direction: 'up' | 'down') => {
        setVectorObjects((prev) => {
            const currentIndex = prev.findIndex((obj) => obj.id === objectId);
            if (currentIndex < 0) return prev;

            const currentObj = prev[currentIndex];
            const currentZ = currentObj.zIndex ?? 0;
            const nextZ = Math.max(0, direction === 'up' ? currentZ + 1 : currentZ - 1);
            if (nextZ === currentZ) return prev;

            const updatedObjects = prev.map((obj) =>
                obj.id === objectId ? { ...obj, zIndex: nextZ } : obj
            );

            // Keep stable order inside identical z-indices.
            const sortedObjects = updatedObjects
                .map((obj, idx) => ({ obj, idx }))
                .sort((a, b) => {
                    const zA = a.obj.zIndex ?? 0;
                    const zB = b.obj.zIndex ?? 0;
                    if (zA !== zB) return zA - zB;
                    return a.idx - b.idx;
                })
                .map(({ obj }) => obj);

            const newSelectedIndex = sortedObjects.findIndex((obj) => obj.id === objectId);
            if (newSelectedIndex >= 0) {
                setSelectedShapeIndices([newSelectedIndex]);
            }

            return sortedObjects;
        });
    }, []);

    const handleDeleteObject = (index: number) => {
        setVectorObjects(prev => prev.filter((_, i) => i !== index));
        setSelectedShapeIndices([]); // Clear selection
    };

    const handleResetObjectRotation = useCallback((index: number) => {
        setVectorObjects(prev => {
            const target = prev[index];
            if (!target) return prev;

            const explicitAngleRad = ((target.rotation || 0) * Math.PI) / 180;

            if (target.type === 'path') {
                if (Math.abs(explicitAngleRad) < 0.0001) return prev;
                const next = [...prev];
                next[index] = { ...target, rotation: 0 };
                return next;
            }

            if (!target.points || target.points.length < 2) {
                if (Math.abs(explicitAngleRad) < 0.0001) return prev;
                const next = [...prev];
                next[index] = { ...target, rotation: 0 };
                return next;
            }

            const box = getPointsBoundingBox(target.points);
            let angleRad = getSmartAngleRad(target.points);

            if (target.type === 'circle') {
                const axisDelta = Math.abs(box.width - box.height);
                if (axisDelta <= 0.35 && Math.abs(explicitAngleRad) > 0.0001) {
                    angleRad = explicitAngleRad;
                }
            } else if (Math.abs(angleRad) < (0.5 * Math.PI / 180) && Math.abs(explicitAngleRad) > (0.5 * Math.PI / 180)) {
                angleRad = explicitAngleRad;
            }

            if (Math.abs(angleRad) < (0.5 * Math.PI / 180) && Math.abs(explicitAngleRad) < (0.5 * Math.PI / 180)) {
                return prev;
            }

            const center: Point = [box.centerX, box.centerY];
            const normalizedPoints = target.points.map((p) => rotatePointAround(p, center, -angleRad));

            const next = [...prev];
            next[index] = {
                ...updateVectorObjectPoints(target, normalizedPoints),
                rotation: 0
            };
            return next;
        });
    }, []);

    const getSelectedBounds = useCallback((): SelectionBounds[] => {
        return selectedShapeIndices
            .map((index) => {
                const obj = vectorObjects[index];
                if (!obj) return null;
                const bounds = getObjectBounds(obj);
                if (!bounds) return null;
                return { index, id: obj.id, ...bounds };
            })
            .filter((item): item is SelectionBounds => !!item);
    }, [selectedShapeIndices, vectorObjects]);

    const applySelectionOffsets = useCallback((offsetsById: Map<string, { dx: number; dy: number }>) => {
        if (offsetsById.size === 0) return;

        setVectorObjects((prev) =>
            prev.map((obj) => {
                const offset = offsetsById.get(obj.id);
                if (!offset) return obj;
                if (Math.abs(offset.dx) < 0.0001 && Math.abs(offset.dy) < 0.0001) return obj;
                return translateObjectBy(obj, offset.dx, offset.dy);
            })
        );
    }, []);

    const handleAlignSelection = useCallback((mode: AlignMode) => {
        const selected = getSelectedBounds();
        if (selected.length < 2) return;

        const groupMinX = Math.min(...selected.map(s => s.minX));
        const groupMaxX = Math.max(...selected.map(s => s.maxX));
        const groupMinY = Math.min(...selected.map(s => s.minY));
        const groupMaxY = Math.max(...selected.map(s => s.maxY));
        const groupCenterX = (groupMinX + groupMaxX) / 2;
        const groupCenterY = (groupMinY + groupMaxY) / 2;

        const offsets = new Map<string, { dx: number; dy: number }>();

        selected.forEach((item) => {
            let dx = 0;
            let dy = 0;

            if (mode === 'left') dx = groupMinX - item.minX;
            if (mode === 'h-center') dx = groupCenterX - item.centerX;
            if (mode === 'right') dx = groupMaxX - item.maxX;
            if (mode === 'top') dy = groupMinY - item.minY;
            if (mode === 'v-center') dy = groupCenterY - item.centerY;
            if (mode === 'bottom') dy = groupMaxY - item.maxY;

            offsets.set(item.id, { dx, dy });
        });

        applySelectionOffsets(offsets);
    }, [applySelectionOffsets, getSelectedBounds]);

    const handleDistributeSelection = useCallback((mode: DistributeMode) => {
        const selected = getSelectedBounds();
        if (selected.length < 3) return;

        const sorted = [...selected].sort((a, b) =>
            mode === 'horizontal' ? a.centerX - b.centerX : a.centerY - b.centerY
        );

        const firstCenter = mode === 'horizontal' ? sorted[0].centerX : sorted[0].centerY;
        const lastCenter = mode === 'horizontal'
            ? sorted[sorted.length - 1].centerX
            : sorted[sorted.length - 1].centerY;
        const step = (lastCenter - firstCenter) / (sorted.length - 1);

        const offsets = new Map<string, { dx: number; dy: number }>();

        sorted.forEach((item, idx) => {
            const target = firstCenter + (step * idx);
            if (mode === 'horizontal') {
                offsets.set(item.id, { dx: target - item.centerX, dy: 0 });
            } else {
                offsets.set(item.id, { dx: 0, dy: target - item.centerY });
            }
        });

        applySelectionOffsets(offsets);
    }, [applySelectionOffsets, getSelectedBounds]);

    const handleCenterSelectionOnCanvas = useCallback((axis: 'horizontal' | 'vertical') => {
        const selected = getSelectedBounds();
        if (selected.length === 0) return;

        const groupMinX = Math.min(...selected.map(s => s.minX));
        const groupMaxX = Math.max(...selected.map(s => s.maxX));
        const groupMinY = Math.min(...selected.map(s => s.minY));
        const groupMaxY = Math.max(...selected.map(s => s.maxY));
        const groupCenterX = (groupMinX + groupMaxX) / 2;
        const groupCenterY = (groupMinY + groupMaxY) / 2;

        const targetCenterX = canvasLogicalWidthUnits / 2;
        const targetCenterY = 50;

        const dx = axis === 'horizontal' ? (targetCenterX - groupCenterX) : 0;
        const dy = axis === 'vertical' ? (targetCenterY - groupCenterY) : 0;

        const offsets = new Map<string, { dx: number; dy: number }>();
        selected.forEach((item) => offsets.set(item.id, { dx, dy }));
        applySelectionOffsets(offsets);
    }, [applySelectionOffsets, canvasLogicalWidthUnits, getSelectedBounds]);

    const handleMatchSelectionSize = useCallback((mode: SizeMatchMode) => {
        if (selectedShapeIndices.length < 2) return;

        const masterIndex = selectedShapeIndices[0];
        const masterObject = vectorObjects[masterIndex];
        const masterBounds = masterObject ? getObjectBounds(masterObject) : null;
        if (!masterBounds) return;

        const targetWidth = masterBounds.width;
        const targetHeight = masterBounds.height;
        const EPS = 0.0001;
        const selectedSet = new Set(selectedShapeIndices);

        setVectorObjects((prev) =>
            prev.map((obj, idx) => {
                if (!selectedSet.has(idx) || idx === masterIndex) return obj;

                const bounds = getObjectBounds(obj);
                if (!bounds) return obj;

                let scaleX = 1;
                let scaleY = 1;

                if (mode === 'size' || mode === 'width') {
                    if (Math.abs(bounds.width) > EPS) scaleX = targetWidth / bounds.width;
                }

                if (mode === 'size' || mode === 'height') {
                    if (Math.abs(bounds.height) > EPS) scaleY = targetHeight / bounds.height;
                }

                return scaleObjectAroundCenter(obj, scaleX, scaleY);
            })
        );
    }, [selectedShapeIndices, vectorObjects]);


    const handleCancel = () => {
        onClose();
    };

    const handleUpdatePage = (page: AlbumPage) => {
        setDummyPage(page);
    };

    // Clear all vector objects and reset canvas for new template creation
    const handleClearAll = useCallback(() => {
        setVectorObjects([]);
        setGridDesignerSegments([]);
        setIsGridDesignerEnabled(false);
        setGridRotationDeg(0);
        setGridDesignerMode('none');
        setCurrentStroke(null);
        // Clear the selected template so user can create a new one
        setSelectedAdvancedTemplate(null);
        setToolMode('select');
        setSelectedShapeIndices([]);
    }, []);

    const handleToggleLayersDockLock = useCallback(() => {
        if (!layersPanelDockSide) return;
        if (isLayersPanelDockLocked) {
            setIsLayersPanelDockLocked(false);
            setLayersPanelDockSide(null);
        } else {
            setIsLayersPanelDockLocked(true);
        }
    }, [isLayersPanelDockLocked, layersPanelDockSide]);

    const handleStartDragLayersPanel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (isLayersPanelDockLocked) return;
        if (e.button !== 0) return;
        const workspace = canvasWorkspaceRef.current;
        const panel = floatingLayersRef.current;
        if (!workspace || !panel) return;

        e.preventDefault();
        e.stopPropagation();

        const workspaceRect = workspace.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const offsetX = e.clientX - panelRect.left;
        const offsetY = e.clientY - panelRect.top;
        const maxX = Math.max(LAYERS_PANEL_SAFE_MARGIN, workspaceRect.width - panelRect.width - LAYERS_PANEL_SAFE_MARGIN);
        const maxY = Math.max(LAYERS_PANEL_SAFE_MARGIN, workspaceRect.height - LAYERS_PANEL_MIN_HEIGHT - LAYERS_PANEL_SAFE_MARGIN);
        let dockSideOnRelease: LayersDockSide = null;
        let lastPosition = { ...layersPanelPosition };

        const onPointerMove = (ev: PointerEvent) => {
            const rawX = ev.clientX - workspaceRect.left - offsetX;
            const rawY = ev.clientY - workspaceRect.top - offsetY;

            const nearLeft = rawX <= LAYERS_PANEL_DOCK_THRESHOLD;
            const nearRight = rawX >= (maxX - LAYERS_PANEL_DOCK_THRESHOLD);
            dockSideOnRelease = nearLeft ? 'left' : (nearRight ? 'right' : null);

            const snappedX = dockSideOnRelease === 'left'
                ? LAYERS_PANEL_SAFE_MARGIN
                : dockSideOnRelease === 'right'
                    ? maxX
                    : Math.max(LAYERS_PANEL_SAFE_MARGIN, Math.min(maxX, rawX));

            const nextY = Math.max(LAYERS_PANEL_SAFE_MARGIN, Math.min(maxY, rawY));
            setLayersPanelDockSide(dockSideOnRelease);
            setIsLayersPanelDockLocked(false);
            lastPosition = { x: snappedX, y: nextY };
            setLayersPanelPosition(lastPosition);
        };

        const onPointerUp = () => {
            if (dockSideOnRelease) {
                setLayersPanelDockSide(dockSideOnRelease);
                setIsLayersPanelDockLocked(true);
            } else {
                setLayersPanelDockSide(null);
                setIsLayersPanelDockLocked(false);
            }
            setLayersPanelPosition(lastPosition);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    }, [isLayersPanelDockLocked, layersPanelPosition]);

    const processObjectsToTemplate = useCallback((
        objectsToProcess: VectorObject[],
        gridSnapshot?: EditorGridSnapshot | null,
        editorObjectsForSnapshot?: VectorObject[]
    ) => {
        if (objectsToProcess.length === 0) return;

        // Calculate aspect ratio to pass to geometry engine
        let configW = 20;
        let configH = 20;
        if (config?.size) {
            const parts = config.size.split('x').map(Number);
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                configW = parts[0];
                configH = parts[1];
            }
        }

        // Match LayoutCanvas calculation to ensure strokes (0..100*aspect) map correctly to 0..100%
        const BASE_PAGE_PX = 450;
        const pxPerUnit = BASE_PAGE_PX / configH;
        const pageW_px = configW * pxPerUnit;
        const pageH_px = BASE_PAGE_PX;

        const isFull = spreadMode === 'full';
        const logicalWidthPx = isFull ? pageW_px * 2 : pageW_px;
        const logicalHeightPx = pageH_px;

        // Determine the coordinate system aspect ratio used during drawing.
        // Page margin is a layout property, but editor coordinates stay on full page area.
        const aspect = logicalWidthPx / logicalHeightPx;

        const logicalWidthUnits = aspect * 100;

        // Group objects by zIndex to separate layers
        const zIndices = Array.from(new Set(objectsToProcess.map(o => o.zIndex ?? 0))).sort((a, b) => a - b);
        const baseZ = zIndices[0] ?? 0; // The lowest layer is the "Grid" (Base Layer)

        let allNewRegions: LayoutRegion[] = [];

        // Process "Path" objects separately (they are explicit regions)
        // Actually, we can process them per-layer too to keep Z-index correct relative to generated regions
        // But for simplicity, let's process non-path objects per layer, and add path objects with their specific Z.

        // Actually, the user wants interaction within layers.
        // So we should iterate layers.

        zIndices.forEach(z => {
            const layerObjects = objectsToProcess.filter(o => (o.zIndex ?? 0) === z);

            // 1. Path Objects in this layer (Frames/Shapes that are already fully defined)
            const layerPathRegions: LayoutRegion[] = layerObjects
                .filter(obj => obj.type === 'path')
                .map(obj => {
                    const pts = obj.points || [];
                    const minX = pts.length ? Math.min(...pts.map(p => p[0])) : 0;
                    const minY = pts.length ? Math.min(...pts.map(p => p[1])) : 0;
                    const maxX = pts.length ? Math.max(...pts.map(p => p[0])) : logicalWidthUnits;
                    const maxY = pts.length ? Math.max(...pts.map(p => p[1])) : 100;

                    const boundsX = (minX / logicalWidthUnits) * 100;
                    const boundsY = minY;
                    const boundsW = ((maxX - minX) / logicalWidthUnits) * 100;
                    const boundsH = maxY - minY;

                    return {
                        id: obj.id,
                        shape: 'path',
                        path: obj.path,
                        viewBox: obj.viewBox,
                        bounds: { x: boundsX, y: boundsY, width: boundsW, height: boundsH },
                        stroke: obj.stroke !== 'transparent' ? obj.stroke : undefined,
                        strokeWidth: obj.strokeWidth > 0 ? obj.strokeWidth : undefined,
                        fill: obj.fill !== 'transparent' ? obj.fill : undefined,
                        zIndex: z,
                        rotation: obj.rotation
                    };
                });

            // 2. Geometric Objects (Lines, Rects, Polygons) in this layer
            // Treat them as segments to be processed by geometry engine
            // If this is the Base Layer, include page bounds (create grid).
            // If Floating Layer, exclude page bounds (create floating shapes/cuts).

            const layerSegments = layerObjects
                .filter(obj => obj.type !== 'path') // rect, circle, polygon
                .flatMap(obj => obj.segments || []);

            if (layerSegments.length > 0 || (z === baseZ)) {

                const isBaseLayer = (z === baseZ);

                // Generate regions from segments
                const generatedRegions = processLayoutGeometry(
                    layerSegments,
                    0, // gap handled later? no, gap param of processLayoutGeometry
                    logicalWidthUnits,
                    isBaseLayer // includePageBounds
                );

                const mappedRegions = generatedRegions.map(r => ({
                    ...r,
                    zIndex: z,
                    stroke: strokeColor !== 'transparent' ? strokeColor : undefined,
                    strokeWidth: strokeWidth > 0 ? strokeWidth : undefined,
                    fill: fillColor !== 'transparent' ? fillColor : undefined
                }));

                allNewRegions.push(...mappedRegions);
            }

            allNewRegions.push(...layerPathRegions);
        });

        const finalRegions = allNewRegions;

        // Generate a unique name for the new template
        const templateCount = createdTemplates.length + 1;

        // Update or Create Template
        // If we are editing an existing custom template, use its ID.
        // If we are cloning a system template (editingTemplateId is null), generate a new UUID.
        // If we are creating a brand new template (selectedAdvancedTemplate is null), generate a new UUID.
        const baseId = (editingTemplateId) ? editingTemplateId : uuidv4();

        const targetTemplate: AdvancedTemplate = selectedAdvancedTemplate || {
            id: baseId,
            name: `Custom Template ${templateCount}`,
            category: 'custom',
            regions: [],
            photoCount: 0,
            isCustom: true,
            createdBy: null,
            type: spreadMode === 'full' ? 'spread' : 'single',
            _pageMargin: pageMargin,
            _photoGap: photoGap
        };

        const nextType = spreadMode === 'full' ? 'spread' : 'single';
        const existingDescription = parseTemplateDescriptionObject(targetTemplate.description);
        const editorObjectsSnapshot = editorObjectsForSnapshot ?? objectsToProcess;

        const descriptionPayload: Record<string, unknown> = {
            ...existingDescription,
            _pageMargin: pageMargin,
            _photoGap: photoGap,
            type: nextType,
            _editorVersion: 1,
            _editorSpreadMode: spreadMode,
            _editorObjects: cloneVectorObjects(editorObjectsSnapshot)
        };

        if (gridSnapshot && gridSnapshot.segments.length > 0) {
            descriptionPayload._editorGrid = {
                rows: gridSnapshot.rows,
                cols: gridSnapshot.cols,
                mode: gridSnapshot.mode,
                rotationDeg: gridSnapshot.rotationDeg ?? 0,
                segments: cloneGridDesignerSegments(gridSnapshot.segments)
            };
        } else {
            delete descriptionPayload._editorGrid;
        }

        const updated: AdvancedTemplate = {
            ...targetTemplate,
            id: baseId, // Ensure we use the determined ID (either existing custom ID or new UUID)
            name: templateName || targetTemplate.name, // Use the input name if available
            regions: finalRegions,
            photoCount: finalRegions.length,
            type: nextType,
            isCustom: true, // Always mark as custom
            createdBy: null, // Custom templates owned by user (handled by RLS/context)
            _pageMargin: pageMargin,
            _photoGap: photoGap,
            _editorVersion: 1,
            _editorSpreadMode: spreadMode,
            _editorObjects: cloneVectorObjects(editorObjectsSnapshot),
            description: JSON.stringify(descriptionPayload)
        };

        // Add to local created templates (avoid duplicates)
        setCreatedTemplates(prev => {
            const existingIndex = prev.findIndex(t => t.id === updated.id);
            if (existingIndex >= 0) {
                const newTemplates = [...prev];
                newTemplates[existingIndex] = updated;
                return newTemplates;
            }
            return [...prev, updated];
        });

        // Select the updated template
        handleSelectAdvancedTemplate(updated);
    }, [config?.size, selectedAdvancedTemplate, handleSelectAdvancedTemplate, createdTemplates.length, pageMargin, photoGap, strokeColor, strokeWidth, fillColor, spreadMode, templateName]);

    // Process the drawn strokes into regions
    const handleProcessLayout = useCallback(() => {
        const shouldProcessGrid = activeGridSegments.length > 0 && (isGridDesignerEnabled || vectorObjects.length === 0);

        if (shouldProcessGrid) {
            const gridObjects: VectorObject[] = activeGridSegments.map((segment) => ({
                id: uuidv4(),
                type: 'line',
                segments: [{ p1: [segment.p1[0], segment.p1[1]], p2: [segment.p2[0], segment.p2[1]] }],
                points: [[segment.p1[0], segment.p1[1]], [segment.p2[0], segment.p2[1]]],
                stroke: strokeColor,
                strokeWidth: Math.max(0.25, strokeWidth),
                fill: 'transparent',
                zIndex: 0,
                rotation: 0
            }));

            const gridSnapshot: EditorGridSnapshot = {
                rows: gridRows,
                cols: gridCols,
                mode: gridDesignerMode,
                rotationDeg: gridRotationDeg,
                segments: cloneGridDesignerSegments(gridDesignerSegments)
            };
            const combinedObjects = [...vectorObjects, ...gridObjects];
            processObjectsToTemplate(combinedObjects, gridSnapshot, vectorObjects);
            setVectorObjects([]);
            setGridDesignerSegments([]);
            setIsGridDesignerEnabled(false);
            setGridRotationDeg(0);
            setGridDesignerMode('none');
            setToolMode('select');
            setSelectedShapeIndices([]);
            return;
        }

        processObjectsToTemplate(vectorObjects, null);
        setToolMode('select');
        setVectorObjects([]);
        setSelectedShapeIndices([]);
    }, [
        activeGridSegments,
        isGridDesignerEnabled,
        processObjectsToTemplate,
        vectorObjects,
        strokeColor,
        strokeWidth,
        gridRows,
        gridCols,
        gridDesignerMode,
        gridRotationDeg,
        gridDesignerSegments
    ]);

    const hasSelection = selectedShapeIndices.length > 0;
    const canAlignSelection = selectedShapeIndices.length >= 2;
    const canDistributeSelection = selectedShapeIndices.length >= 3;
    const canMatchSizeSelection = selectedShapeIndices.length >= 2;
    const isLayersDocked = layersPanelDockSide !== null && isLayersPanelDockLocked;
    const floatingPanelTop = Math.max(LAYERS_PANEL_SAFE_MARGIN, layersPanelPosition.y);
    const layersPanelTop = isLayersDocked ? LAYERS_PANEL_SAFE_MARGIN : floatingPanelTop;
    const floatingAvailableHeight = Math.max(
        LAYERS_PANEL_MIN_HEIGHT,
        workspaceSize.height > 0
            ? (workspaceSize.height - layersPanelTop - LAYERS_PANEL_SAFE_MARGIN)
            : layersPanelSizing.naturalHeight
    );
    const floatingPanelHeight = Math.max(
        LAYERS_PANEL_MIN_HEIGHT,
        Math.min(layersPanelSizing.naturalHeight, floatingAvailableHeight)
    );
    const layersPanelHeight = isLayersDocked
        ? '100%'
        : `${floatingPanelHeight}px`;
    const dockedAvailableHeight = Math.max(
        LAYERS_PANEL_MIN_HEIGHT,
        workspaceSize.height > 0
            ? (workspaceSize.height - (LAYERS_PANEL_SAFE_MARGIN * 2))
            : layersPanelSizing.naturalHeight
    );
    const effectivePanelHeight = isLayersDocked ? dockedAvailableHeight : floatingPanelHeight;
    const layersPanelContentScrollable = layersPanelSizing.naturalHeight > (effectivePanelHeight + 1);
    const layersPanelNode = (
        <LayersPanel
            vectorObjects={vectorObjects}
            showGridProxy={showGridLayerProxy}
            selectedIndices={selectedShapeIndices}
            leaderIndex={selectedShapeIndices.length > 0 ? selectedShapeIndices[0] : null}
            onSelect={setSelectedShapeIndices}
            onDelete={handleDeleteObject}
            onReorder={handleReorderObjects}
            onResetRotation={handleResetObjectRotation}
            onClose={() => setIsLayersPanelOpen(false)}
            onDragStart={isLayersPanelDockLocked ? undefined : handleStartDragLayersPanel}
            isDocked={layersPanelDockSide !== null}
            isDockLocked={isLayersPanelDockLocked}
            onToggleDockLock={handleToggleLayersDockLock}
            onCollapsedLayersChange={handleLayersCollapsedChange}
            contentScrollable={layersPanelContentScrollable}
        />
    );

    return (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col">
            {/* 1. Global Header */}
            <div className="h-14 border-b bg-background flex items-center px-6 shrink-0 z-20 gap-4">
                <span className="heading-sm whitespace-nowrap">Custom Layout Editor</span>

                <div className="w-px h-6 bg-border mx-2" />

                {/* Template Name Input */}
                <div className="flex items-center gap-2 max-w-sm flex-1">
                    <Label htmlFor="template-name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                        {editingTemplateId ? "Editing:" : "New Template:"}
                    </Label>
                    <Input
                        id="template-name"
                        placeholder="Enter template name..."
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        className="h-8 text-sm bg-muted/30 border-muted-foreground/20 focus:bg-background"
                    />
                </div>

                <div className="flex-1" />

                <div className="flex items-center gap-2">
                    {/* Admin Button */}
                    {isAdmin && (
                        <>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                title="Admin Panel"
                                onClick={() => setAdminOpen(true)}
                            >
                                <Shield className="h-5 w-5" />
                            </Button>
                            <AdminSettingsDialog open={adminOpen} onOpenChange={setAdminOpen} />
                        </>
                    )}

                    <ModeToggle />
                    <div className="h-4 w-px bg-border mx-1" />
                    <UserNav showSettingsLink={false} />
                </div>
            </div>

            {/* 2. Main Workspace */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar */}
                <div className="w-[300px] border-r bg-background flex-shrink-0 z-10">
                    <LayoutSidebarLeft
                        onAddCanvaFrame={handleAddCanvaFrame}
                    />
                </div>

                {/* Main Canvas Area */}
                <div ref={canvasWorkspaceRef} className="flex-1 flex relative bg-muted/10 h-full overflow-hidden">
                    {isLayersPanelOpen && isLayersDocked && layersPanelDockSide === 'left' && (
                        <div
                            className="relative z-[60] h-full flex-shrink-0 border-r bg-background"
                            style={{ width: layersPanelSizing.width }}
                        >
                            <div className="h-full w-full" style={{ height: layersPanelHeight }}>
                                {layersPanelNode}
                            </div>
                        </div>
                    )}


                    {/* Canvas */}
                    <div className="flex-1 relative overflow-hidden flex flex-col">
                        <FloatingToolbar
                            toolMode={toolMode}
                            onToolChange={setToolMode}
                            isMirrorMode={isMirrorMode}
                            onToggleMirrorMode={() => setIsMirrorMode(!isMirrorMode)}
                            strokeColor={strokeColor}
                            onStrokeColorChange={setStrokeColor}
                            strokeWidth={strokeWidth}
                            onStrokeWidthChange={setStrokeWidth}
                            fillColor={fillColor}
                            onFillColorChange={setFillColor}
                            spreadMode={spreadMode}
                            onToggleSpreadMode={() => handleSpreadModeChange(spreadMode === 'full' ? 'split' : 'full')}
                            showGuides={showGuides}
                            onToggleGuides={() => setShowGuides(!showGuides)}
                            isLayersPanelOpen={isLayersPanelOpen}
                            onToggleLayersPanel={() => setIsLayersPanelOpen(prev => !prev)}
                            gridRows={gridRows}
                            onGridRowsChange={setGridRows}
                            gridCols={gridCols}
                            onGridColsChange={setGridCols}
                            onCreateGrid={handleCreateGrid}
                            gridDesignerEnabled={isGridDesignerEnabled}
                            gridDesignerMode={gridDesignerMode}
                            onGridModeChange={(mode) => {
                                setIsGridDesignerEnabled(true);
                                setGridDesignerMode((prev) => (prev === mode ? 'none' : mode));
                                setToolMode('select');
                            }}
                            hasGridSegments={activeGridSegments.length > 0}
                            gridRotationDeg={gridRotationDeg}
                            onRotateGrid={handleRotateGrid}
                            isGridRotationActive={isGridRotationActive}
                            onClearStrokes={handleClearAll}
                            onProcessLayout={handleProcessLayout}
                        />

                        <LayoutCanvas
                            page={dummyPage}
                            config={{
                                size: config?.size ?? '20x20',
                                backgroundColor,
                                backgroundImage: config?.backgroundImage,
                                photoGap,
                                pageMargin,
                                cornerRadius
                            }}
                            onUpdatePage={handleUpdatePage}
                            advancedTemplate={selectedAdvancedTemplate}
                            // Vector Props
                            toolMode={toolMode}
                            vectorObjects={vectorObjects}
                            onUpdateVectorObjects={setVectorObjects}
                            selectedShapeIndices={selectedShapeIndices}
                            onSelectionChange={setSelectedShapeIndices}
                            isMirrorMode={isMirrorMode}
                            isLeaderGroupRotateEnabled={isLeaderGroupRotateEnabled}
                            isLeaderGroupResizeEnabled={isLeaderGroupResizeEnabled}
                            // Active Styles
                            activeStrokeColor={strokeColor}
                            activeStrokeWidth={strokeWidth}
                            activeFillColor={fillColor}
                            showGuides={showGuides}
                            gridDesignerEnabled={isGridDesignerEnabled}
                            gridDesignerMode={gridDesignerMode}
                            gridDesignerSegments={gridDesignerSegments}
                            onGridDesignerSegmentsChange={setGridDesignerSegments}
                        />

                        {/* Right Vertical Toolbar (Selection Alignment/Distribution) */}
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30 bg-background/95 backdrop-blur-sm border shadow-md rounded-full p-2 flex flex-col items-center gap-1 pointer-events-auto">
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn("h-8 w-8", isLeaderGroupRotateEnabled && "bg-primary/15 text-primary")}
                                onClick={() => setIsLeaderGroupRotateEnabled(prev => !prev)}
                                title="Rotate selected objects with leader"
                            >
                                <RotateCw className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn("h-8 w-8", isLeaderGroupResizeEnabled && "bg-primary/15 text-primary")}
                                onClick={() => setIsLeaderGroupResizeEnabled(prev => !prev)}
                                title="Resize selected objects with leader"
                            >
                                <Maximize className="h-4 w-4" />
                            </Button>

                            <div className="w-6 h-px bg-border/60 my-1" />

                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleAlignSelection('left')}
                                disabled={!canAlignSelection}
                                title="Align Left"
                            >
                                <AlignStartVertical className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleAlignSelection('h-center')}
                                disabled={!canAlignSelection}
                                title="Align Horizontal Center"
                            >
                                <AlignCenterVertical className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleAlignSelection('right')}
                                disabled={!canAlignSelection}
                                title="Align Right"
                            >
                                <AlignEndVertical className="h-4 w-4" />
                            </Button>

                            <div className="w-6 h-px bg-border/60 my-1" />

                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleAlignSelection('top')}
                                disabled={!canAlignSelection}
                                title="Align Top"
                            >
                                <AlignStartHorizontal className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleAlignSelection('v-center')}
                                disabled={!canAlignSelection}
                                title="Align Vertical Center"
                            >
                                <AlignCenterHorizontal className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleAlignSelection('bottom')}
                                disabled={!canAlignSelection}
                                title="Align Bottom"
                            >
                                <AlignEndHorizontal className="h-4 w-4" />
                            </Button>

                            <div className="w-6 h-px bg-border/60 my-1" />

                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleDistributeSelection('horizontal')}
                                disabled={!canDistributeSelection}
                                title="Distribute Horizontally"
                            >
                                <AlignHorizontalDistributeCenter className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleDistributeSelection('vertical')}
                                disabled={!canDistributeSelection}
                                title="Distribute Vertically"
                            >
                                <AlignVerticalDistributeCenter className="h-4 w-4" />
                            </Button>

                            <div className="w-6 h-px bg-border/60 my-1" />

                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleMatchSelectionSize('size')}
                                disabled={!canMatchSizeSelection}
                                title="Match Size (from first selected)"
                            >
                                <Maximize className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleMatchSelectionSize('width')}
                                disabled={!canMatchSizeSelection}
                                title="Match Width (from first selected)"
                            >
                                <AlignHorizontalJustifyCenter className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleMatchSelectionSize('height')}
                                disabled={!canMatchSizeSelection}
                                title="Match Height (from first selected)"
                            >
                                <AlignVerticalJustifyCenter className="h-4 w-4" />
                            </Button>

                            <div className="w-6 h-px bg-border/60 my-1" />

                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleCenterSelectionOnCanvas('horizontal')}
                                disabled={!hasSelection}
                                title="Center Selection on Canvas (Horizontal)"
                            >
                                <AlignCenterVertical className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleCenterSelectionOnCanvas('vertical')}
                                disabled={!hasSelection}
                                title="Center Selection on Canvas (Vertical)"
                            >
                                <AlignCenterHorizontal className="h-4 w-4" />
                            </Button>
                        </div>

                        {isLayersPanelOpen && !isLayersDocked && (
                            <div
                                ref={floatingLayersRef}
                                className="absolute z-[60]"
                                style={{
                                    left: layersPanelPosition.x,
                                    top: layersPanelTop,
                                    width: layersPanelSizing.width,
                                    maxWidth: `calc(100% - ${LAYERS_PANEL_SAFE_MARGIN * 2}px)`,
                                    height: layersPanelHeight
                                }}
                            >
                                {layersPanelNode}
                            </div>
                        )}
                    </div>

                    {isLayersPanelOpen && isLayersDocked && layersPanelDockSide === 'right' && (
                        <div
                            className="relative z-[60] h-full flex-shrink-0 border-l bg-background"
                            style={{ width: layersPanelSizing.width }}
                        >
                            <div className="h-full w-full" style={{ height: layersPanelHeight }}>
                                {layersPanelNode}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Sidebar */}
                <div className="w-[300px] border-l bg-background flex-shrink-0 z-10">
                    <LayoutSidebarRight
                        selectedLayout={selectedLayout}
                        onSelectLayout={handleLayoutChange}
                        onSelectAdvancedTemplate={handleSelectAdvancedTemplate}
                        selectedAdvancedTemplate={selectedAdvancedTemplate}
                        customTemplates={createdTemplates}
                        systemTemplates={allTemplates}
                        spreadMode={spreadMode}
                        onSpreadModeChange={handleSpreadModeChange}
                        config={config}
                        photoGap={photoGap}
                        onPhotoGapChange={handlePhotoGapChange}
                        pageMargin={pageMargin}
                        onPageMarginChange={handlePageMarginChange}
                        cornerRadius={cornerRadius}
                        onCornerRadiusChange={handleCornerRadiusChange}
                        useDummyPhotos={useDummyPhotos}
                        onUseDummyPhotosChange={handleUseDummyPhotosChange}
                        onEditAdvancedTemplate={(t, m) => handleSelectAdvancedTemplate(t, m, true)}
                        onDeleteTemplate={handleDeleteTemplate}
                        editingTemplateId={editingTemplateId}
                        onRefresh={refresh}
                    />
                </div>
            </div>

            {/* 3. Full-Width Bottom Toolbar & Actions */}
            <div className="h-16 border-t bg-background grid grid-cols-[300px_1fr_300px] items-center px-6 shrink-0 z-20">
                {/* Left side empty placeholder to balance the grid for centering */}
                <div />

                {/* Spacing Controls (Center) */}
                <div className="flex items-center gap-10 justify-center">
                    {/* Photo Gap */}
                    <div className="flex items-center gap-4 min-w-[180px]">
                        <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Photo Gap</Label>
                        <div className="flex items-center gap-3 flex-1">
                            <Slider
                                min={0}
                                max={50}
                                step={1}
                                value={[photoGap]}
                                onValueChange={(vals) => handlePhotoGapChange(vals[0])}
                                className="w-24"
                            />
                            <Input
                                type="number"
                                className="w-10 h-7 text-[10px] text-center px-1 bg-muted/30"
                                value={photoGap}
                                min={0}
                                max={50}
                                onChange={(e) => handlePhotoGapChange(Math.max(0, Math.min(50, Number(e.target.value))))}
                            />
                        </div>
                    </div>

                    {/* Page Margin */}
                    <div className="flex items-center gap-4 min-w-[180px]">
                        <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Page Margin</Label>
                        <div className="flex items-center gap-3 flex-1">
                            <Slider
                                min={0}
                                max={50}
                                step={1}
                                value={[pageMargin]}
                                onValueChange={(vals) => handlePageMarginChange(vals[0])}
                                className="w-24"
                            />
                            <Input
                                type="number"
                                className="w-10 h-7 text-[10px] text-center px-1 bg-muted/30"
                                value={pageMargin}
                                min={0}
                                max={50}
                                onChange={(e) => handlePageMarginChange(Math.max(0, Math.min(50, Number(e.target.value))))}
                            />
                        </div>
                    </div>

                    {/* Corner Radius */}
                    <div className="flex items-center gap-4 min-w-[180px] hidden xl:flex">
                        <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Corner Radius</Label>
                        <div className="flex items-center gap-3 flex-1">
                            <Slider
                                min={0}
                                max={20}
                                step={1}
                                value={[cornerRadius]}
                                onValueChange={(vals) => handleCornerRadiusChange(vals[0])}
                                className="w-24"
                            />
                            <Input
                                type="number"
                                className="w-10 h-7 text-[10px] text-center px-1 bg-muted/30"
                                value={cornerRadius}
                                min={0}
                                max={20}
                                onChange={(e) => handleCornerRadiusChange(Math.max(0, Math.min(20, Number(e.target.value))))}
                            />
                        </div>
                    </div>

                    {/* Background Color */}
                    <div className="flex items-center gap-4 min-w-[170px]">
                        <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Background</Label>
                        <div className="flex items-center gap-2">
                            <div
                                className="relative h-7 w-8 overflow-hidden rounded border border-border"
                                style={{ backgroundColor }}
                                title={backgroundColor}
                            >
                                <input
                                    type="color"
                                    value={backgroundColor}
                                    onChange={(e) => handleBackgroundColorChange(e.target.value)}
                                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                />
                            </div>
                            <Input
                                type="text"
                                className="w-20 h-7 text-[10px] font-mono text-center px-1 bg-muted/30"
                                value={backgroundColor}
                                onChange={(e) => {
                                    const val = e.target.value.trim();
                                    if (/^#[0-9A-Fa-f]{6}$/.test(val)) handleBackgroundColorChange(val);
                                    if (val === '') handleBackgroundColorChange('#ffffff');
                                }}
                            />
                        </div>
                    </div>

                    {/* Dummy Photos Toggle */}
                    <div className="flex items-center gap-3 pl-4 border-l hidden 2xl:flex">
                        <Switch
                            id="dummy-photos-bottom"
                            checked={useDummyPhotos}
                            onCheckedChange={handleUseDummyPhotosChange}
                        />
                        <Label htmlFor="dummy-photos-bottom" className="text-xs font-semibold whitespace-nowrap cursor-pointer">
                            Sample Photos
                        </Label>
                    </div>
                </div>

                {/* Action Buttons (Right) */}
                <div className="flex items-center gap-3 justify-end">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancel}
                        className="gap-2 text-muted-foreground hover:text-foreground h-9 px-4"
                    >
                        <X className="h-4 w-4" /> Cancel
                    </Button>
                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleSave}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 min-w-[130px] h-9"
                    >
                        <Check className="h-4 w-4" /> Save Template
                    </Button>
                </div>
            </div>
            <AlertDialog open={!!deleteConfirmation} onOpenChange={(open) => !open && setDeleteConfirmation(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the template "{deleteConfirmation?.name}". This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
