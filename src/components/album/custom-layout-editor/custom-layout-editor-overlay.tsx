import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AlbumPage, AlbumConfig } from '@/lib/types';
import { LayoutSidebarLeft } from './layout-sidebar-left';
import { LayoutSidebarRight } from './layout-sidebar-right';
import { LayoutCanvas } from './layout-canvas';
import { FloatingToolbar } from './floating-toolbar';
import { LayersPanel } from './layers-panel';
import { LayoutSettingsPanel } from './layout-settings-panel';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
    RotateCw,
    SlidersHorizontal
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useTemplates, getPhotoCount } from '@/hooks/useTemplates';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { processLayoutGeometry } from '@/lib/layout-geometry';
import { markLikelyBackgroundRegions } from '@/lib/layout-background-region';
import { createClient } from '@/lib/supabase';
import { VectorObject, Point, Segment, LayoutRegion, AdvancedTemplate, TemplateImageRotationMode } from '@/lib/advanced-layout-types';
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

const normalizeSignedDeg = (deg: number): number => {
    let d = ((deg % 360) + 360) % 360;
    if (d > 180) d -= 360;
    return Math.abs(d) < 0.0001 ? 0 : d;
};

const isPointInPolygon = (point: Point, polygon: Point[]): boolean => {
    if (!polygon || polygon.length < 3) return false;
    const [px, py] = point;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];
        const intersects = ((yi > py) !== (yj > py))
            && (px < ((xj - xi) * (py - yi)) / ((yj - yi) || 1e-12) + xi);
        if (intersects) inside = !inside;
    }
    return inside;
};

const getVectorObjectGroundRotationDeg = (obj: VectorObject): number => {
    if (obj.type === 'circle') {
        return normalizeSignedDeg(obj.rotation || 0);
    }

    const points =
        obj.points && obj.points.length >= 2
            ? obj.points
            : ((obj.segments && obj.segments.length > 0)
                ? [obj.segments[0].p1, obj.segments[0].p2]
                : []);

    if (points.length >= 2) {
        const dx = points[1][0] - points[0][0];
        const dy = points[1][1] - points[0][1];
        if (Math.abs(dx) > 1e-6 || Math.abs(dy) > 1e-6) {
            return normalizeSignedDeg(Math.atan2(dy, dx) * (180 / Math.PI));
        }
    }

    return normalizeSignedDeg(obj.rotation || 0);
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

const buildRectPointsFromBounds = (minX: number, minY: number, maxX: number, maxY: number): Point[] => ([
    [minX, minY],
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY]
]);

const isAxisAlignedRectPoints = (points: Point[], epsilon: number = 1e-3): boolean => {
    if (points.length < 4) return false;

    const roundedPoints = Array.from(
        new Map(
            points.map((p) => [`${Math.round(p[0] * 1000)}:${Math.round(p[1] * 1000)}`, p])
        ).values()
    );
    if (roundedPoints.length !== 4) return false;

    const xs = roundedPoints.map((p) => p[0]);
    const ys = roundedPoints.map((p) => p[1]);
    const uniqueX = Array.from(new Set(xs.map((x) => Math.round(x * 1000) / 1000))).sort((a, b) => a - b);
    const uniqueY = Array.from(new Set(ys.map((y) => Math.round(y * 1000) / 1000))).sort((a, b) => a - b);

    if (uniqueX.length !== 2 || uniqueY.length !== 2) return false;

    return roundedPoints.every((p) =>
        (Math.abs(p[0] - uniqueX[0]) <= epsilon || Math.abs(p[0] - uniqueX[1]) <= epsilon) &&
        (Math.abs(p[1] - uniqueY[0]) <= epsilon || Math.abs(p[1] - uniqueY[1]) <= epsilon)
    );
};

const normalizePathObjectForEditor = (obj: VectorObject): VectorObject => {
    if (obj.type !== 'path') return obj;

    const sourcePoints: Point[] =
        obj.points && obj.points.length > 0
            ? obj.points.map((p) => [p[0], p[1]] as Point)
            : (obj.segments || []).flatMap((s) => [[s.p1[0], s.p1[1]] as Point, [s.p2[0], s.p2[1]] as Point]);

    if (sourcePoints.length < 2) return obj;

    if (isAxisAlignedRectPoints(sourcePoints)) {
        const bounds = getPointsBoundingBox(sourcePoints);
        return {
            ...obj,
            points: buildRectPointsFromBounds(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY),
            segments: []
        };
    }

    const rawBounds = getPointsBoundingBox(sourcePoints);
    const center: Point = [rawBounds.centerX, rawBounds.centerY];
    const angleRad = ((obj.rotation || 0) * Math.PI) / 180;
    const unrotatedPoints = Math.abs(angleRad) > 1e-6
        ? sourcePoints.map((p) => rotatePointAround(p, center, -angleRad))
        : sourcePoints;
    const normalizedBounds = getPointsBoundingBox(unrotatedPoints);

    return {
        ...obj,
        points: buildRectPointsFromBounds(
            normalizedBounds.minX,
            normalizedBounds.minY,
            normalizedBounds.maxX,
            normalizedBounds.maxY
        ),
        segments: []
    };
};

const normalizeEditorSnapshotObjects = (objects: VectorObject[]): VectorObject[] =>
    objects.map((obj) => normalizePathObjectForEditor(obj));

const getPathPointsFromRegionBounds = (region: LayoutRegion, scaleX: number): Point[] => {
    const { x, y, width, height } = region.bounds;
    return buildRectPointsFromBounds(
        x * scaleX,
        y,
        (x + width) * scaleX,
        y + height
    );
};

const reconcilePathObjectsWithRegions = (
    objects: VectorObject[],
    regions: LayoutRegion[] | undefined,
    scaleX: number
): VectorObject[] => {
    if (!regions || regions.length === 0) return objects;
    const regionById = new Map<string, LayoutRegion>(
        regions
            .filter((r) => r.shape === 'path' && !!r.id)
            .map((r) => [r.id, r] as const)
    );

    return objects.map((obj) => {
        if (obj.type !== 'path') return obj;
        const region = regionById.get(obj.id);
        if (!region) return obj;

        return {
            ...obj,
            points: getPathPointsFromRegionBounds(region, scaleX),
            segments: [],
            path: obj.path || region.path,
            viewBox: obj.viewBox || region.viewBox,
            rotation: Number.isFinite(obj.rotation) ? obj.rotation : (region.rotation || 0)
        };
    });
};

const parseTemplateConfigObject = (templateConfig?: string | null): Record<string, unknown> => {
    if (!templateConfig) return {};
    try {
        const parsed = JSON.parse(templateConfig);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
};

const normalizeTemplateImageRotationMode = (value: unknown): TemplateImageRotationMode =>
    value === 'keep-horizontal' ? 'keep-horizontal' : 'follow-frame';

type EditorGridSnapshot = {
    rows: number;
    cols: number;
    mode: GridDesignerMode;
    rotationDeg: number;
    segments: GridDesignerSegment[];
};

const GRID_PADDING_LAYERS_PER_SIDE = 3;

const doesRegionIntersectPageBounds = (region: LayoutRegion, epsilon: number = 0.35): boolean => {
    const { x, y, width, height } = region.bounds;
    const maxX = x + width;
    const maxY = y + height;

    return !(
        maxX < (0 - epsilon) ||
        x > (100 + epsilon) ||
        maxY < (0 - epsilon) ||
        y > (100 + epsilon)
    );
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
type CloneDraft = {
    template: AdvancedTemplate;
    preferredMode?: 'full' | 'split';
    name: string;
};

const LAYERS_PANEL_SAFE_MARGIN = 8;
const LAYERS_PANEL_DOCK_THRESHOLD = 26;
const LAYERS_PANEL_MIN_HEIGHT = 96;
const SETTINGS_PANEL_SAFE_MARGIN = LAYERS_PANEL_SAFE_MARGIN;
const SETTINGS_PANEL_DOCK_THRESHOLD = LAYERS_PANEL_DOCK_THRESHOLD;
const SETTINGS_PANEL_WIDTH = 230;
const SETTINGS_PANEL_MIN_HEIGHT = 240;
const SETTINGS_PANEL_ESTIMATED_HEIGHT = 470;

export const CustomLayoutEditorOverlay = ({ onClose, config, customTemplates, onAddTemplate }: CustomLayoutEditorOverlayProps) => {
    const { findGridTemplate, defaultGridTemplate, allTemplates, refresh } = useTemplates();
    const { resolvedTheme } = useTheme();
    const { isAdmin } = useAuth();
    const [adminOpen, setAdminOpen] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState<AdvancedTemplate | null>(null);
    const [cloneDraft, setCloneDraft] = useState<CloneDraft | null>(null);
    const [pendingCloneTemplate, setPendingCloneTemplate] = useState<AdvancedTemplate | null>(null);

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
    const activeTemplateName = templateName || selectedAdvancedTemplate?.name || 'Template';
    const activeTemplateFrameCount = getPhotoCount(
        selectedAdvancedTemplate ?? findGridTemplate(selectedLayout)
    );
    const activeTemplateFrameLabel = `(${activeTemplateFrameCount} ${activeTemplateFrameCount === 1 ? 'Photo' : 'Photos'})`;

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
    const [settingsPanelPosition, setSettingsPanelPosition] = useState({ x: 240, y: 160 });
    const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
    const [settingsPanelDockSide, setSettingsPanelDockSide] = useState<LayersDockSide>(null);
    const [isSettingsPanelDockLocked, setIsSettingsPanelDockLocked] = useState(false);
    const [settingsPanelMeasuredHeight, setSettingsPanelMeasuredHeight] = useState(SETTINGS_PANEL_ESTIMATED_HEIGHT);
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
    const [imageRotationMode, setImageRotationMode] = useState<TemplateImageRotationMode>('follow-frame');
    const canvasWorkspaceRef = useRef<HTMLDivElement>(null);
    const canvasFloatingHostRef = useRef<HTMLDivElement>(null);
    const floatingLayersRef = useRef<HTMLDivElement>(null);
    const floatingSettingsRef = useRef<HTMLDivElement>(null);
    const didInitSettingsPositionRef = useRef(false);

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

    const GRID_ROTATION_SNAP_STEP = 0.001;

    const quantizeGridValue = useCallback((value: number): number => {
        return Math.round(value / GRID_ROTATION_SNAP_STEP) * GRID_ROTATION_SNAP_STEP;
    }, []);

    const quantizeGridPoint = useCallback((p: Point): Point => {
        return [quantizeGridValue(p[0]), quantizeGridValue(p[1])];
    }, [quantizeGridValue]);

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

    const createGridSegments = useCallback((rows: number, cols: number): GridDesignerSegment[] => {
        const safeRows = Math.max(1, Math.floor(rows));
        const safeCols = Math.max(1, Math.floor(cols));
        const xStep = canvasLogicalWidthUnits / safeCols;
        const yStep = 100 / safeRows;
        const paddedRows = safeRows + (GRID_PADDING_LAYERS_PER_SIDE * 2);
        const paddedCols = safeCols + (GRID_PADDING_LAYERS_PER_SIDE * 2);
        const xStart = -GRID_PADDING_LAYERS_PER_SIDE * xStep;
        const yStart = -GRID_PADDING_LAYERS_PER_SIDE * yStep;
        const xEnd = xStart + (paddedCols * xStep);
        const yEnd = yStart + (paddedRows * yStep);

        const segments: GridDesignerSegment[] = [];

        // Horizontal separators for the full padded grid
        for (let r = 1; r < paddedRows; r++) {
            const y = yStart + (yStep * r);
            for (let c = 0; c < paddedCols; c++) {
                const x1 = xStart + (xStep * c);
                const x2 = xStart + (xStep * (c + 1));
                segments.push({
                    id: uuidv4(),
                    orientation: 'horizontal',
                    p1: [x1, y],
                    p2: [x2, y],
                    active: true
                });
            }
        }

        // Vertical separators for the full padded grid
        for (let c = 1; c < paddedCols; c++) {
            const x = xStart + (xStep * c);
            for (let r = 0; r < paddedRows; r++) {
                const y1 = yStart + (yStep * r);
                const y2 = yStart + (yStep * (r + 1));
                segments.push({
                    id: uuidv4(),
                    orientation: 'vertical',
                    p1: [x, y1],
                    p2: [x, y2],
                    active: true
                });
            }
        }

        // Closed outer border around the padded grid
        for (let c = 0; c < paddedCols; c++) {
            const x1 = xStart + (xStep * c);
            const x2 = xStart + (xStep * (c + 1));

            segments.push({
                id: uuidv4(),
                orientation: 'horizontal',
                p1: [x1, yStart],
                p2: [x2, yStart],
                active: true
            });

            segments.push({
                id: uuidv4(),
                orientation: 'horizontal',
                p1: [x1, yEnd],
                p2: [x2, yEnd],
                active: true
            });
        }

        for (let r = 0; r < paddedRows; r++) {
            const y1 = yStart + (yStep * r);
            const y2 = yStart + (yStep * (r + 1));

            segments.push({
                id: uuidv4(),
                orientation: 'vertical',
                p1: [xStart, y1],
                p2: [xStart, y2],
                active: true
            });

            segments.push({
                id: uuidv4(),
                orientation: 'vertical',
                p1: [xEnd, y1],
                p2: [xEnd, y2],
                active: true
            });
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

        const center: Point = [canvasLogicalWidthUnits / 2, 50];
        const angleRad = (deltaDeg * Math.PI) / 180;

        setGridDesignerSegments((prev) => prev.map((segment) => {
            const p1 = rotatePointAround([segment.p1[0], segment.p1[1]], center, angleRad);
            const p2 = rotatePointAround([segment.p2[0], segment.p2[1]], center, angleRad);

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
        rotatePointAround,
        quantizeGridPoint
    ]);

    const activeGridSegments = useMemo(
        () => gridDesignerSegments.filter((segment) => segment.active),
        [gridDesignerSegments]
    );
    const isGridRotationActive = Math.abs(gridRotationDeg) > 0.0001;

    useEffect(() => {
        const workspace = canvasFloatingHostRef.current ?? canvasWorkspaceRef.current;
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

    useEffect(() => {
        if (!isSettingsPanelOpen) return;
        if (didInitSettingsPositionRef.current) return;
        if (workspaceSize.width <= 0 || workspaceSize.height <= 0) return;

        const settingsPanelClampHeight = Math.max(SETTINGS_PANEL_MIN_HEIGHT, settingsPanelMeasuredHeight);
        const maxX = Math.max(SETTINGS_PANEL_SAFE_MARGIN, workspaceSize.width - SETTINGS_PANEL_WIDTH - SETTINGS_PANEL_SAFE_MARGIN);
        const maxY = Math.max(SETTINGS_PANEL_SAFE_MARGIN, workspaceSize.height - settingsPanelClampHeight - SETTINGS_PANEL_SAFE_MARGIN);
        const centeredX = Math.max(
            SETTINGS_PANEL_SAFE_MARGIN,
            Math.min(maxX, Math.round((workspaceSize.width - SETTINGS_PANEL_WIDTH) / 2))
        );
        const defaultY = Math.max(
            SETTINGS_PANEL_SAFE_MARGIN,
            Math.min(maxY, workspaceSize.height - settingsPanelClampHeight - SETTINGS_PANEL_SAFE_MARGIN)
        );

        setSettingsPanelPosition({ x: centeredX, y: defaultY });
        didInitSettingsPositionRef.current = true;
    }, [isSettingsPanelOpen, workspaceSize.width, workspaceSize.height, settingsPanelMeasuredHeight]);

    useEffect(() => {
        if (!isSettingsPanelOpen) return;
        if (settingsPanelDockSide && isSettingsPanelDockLocked) return;
        if (workspaceSize.width <= 0 || workspaceSize.height <= 0) return;

        const settingsPanelClampHeight = Math.max(SETTINGS_PANEL_MIN_HEIGHT, settingsPanelMeasuredHeight);
        const maxX = Math.max(SETTINGS_PANEL_SAFE_MARGIN, workspaceSize.width - SETTINGS_PANEL_WIDTH - SETTINGS_PANEL_SAFE_MARGIN);
        const maxY = Math.max(SETTINGS_PANEL_SAFE_MARGIN, workspaceSize.height - settingsPanelClampHeight - SETTINGS_PANEL_SAFE_MARGIN);

        setSettingsPanelPosition((prev) => ({
            x: Math.max(SETTINGS_PANEL_SAFE_MARGIN, Math.min(maxX, prev.x)),
            y: Math.max(SETTINGS_PANEL_SAFE_MARGIN, Math.min(maxY, prev.y))
        }));
    }, [isSettingsPanelOpen, settingsPanelDockSide, isSettingsPanelDockLocked, workspaceSize.width, workspaceSize.height, settingsPanelMeasuredHeight]);

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

    // Keep active template snapshot in sync when image mode changes
    useEffect(() => {
        if (!selectedAdvancedTemplate) return;
        const selectedId = selectedAdvancedTemplate.id;
        setSelectedAdvancedTemplate(prev => prev ? { ...prev, _imageRotationMode: imageRotationMode } : prev);
        setCreatedTemplates(prev =>
            prev.map(t => t.id === selectedId ? { ...t, _imageRotationMode: imageRotationMode } : t)
        );
    }, [imageRotationMode, selectedAdvancedTemplate?.id]);

    // Handle advanced template selection
    const handleSelectAdvancedTemplate = (template: AdvancedTemplate, preferredMode?: 'full' | 'split', isEdit: boolean = false) => {
        setSelectedAdvancedTemplate(template);

        if (isEdit) {
            // Edit always targets the selected template directly.
            setEditingTemplateId(template.id);
            setTemplateName(template.name);
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


        const templateConfigData = parseTemplateConfigObject(template.template_config);
        const gridSnapshot = parseEditorGridSnapshot(templateConfigData._editorGrid);
        const templateMode = normalizeTemplateImageRotationMode(
            template._imageRotationMode ?? templateConfigData._imageRotationMode
        );
        setImageRotationMode(templateMode);

        const editorSnapshot = normalizeEditorSnapshotObjects(cloneVectorObjects(template._editorObjects));

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
                            strokeWidth: region.strokeWidth ?? 0,
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

        // Build preview photos while preserving existing IDs/src whenever possible
        // to avoid remount flashes when switching between edit/final preview.
        setDummyPage(prev => {
            const photoCount = getPhotoCount(template);
            const photos = Array(photoCount).fill(null).map((_, index) => {
                const prevPhoto = prev.photos?.[index];

                if (useDummyPhotos) {
                    const seed = `adv-${template.id}-${index}`;
                    const src = `https://picsum.photos/seed/${seed}/800/600`;

                    if (prevPhoto && prevPhoto.src === src) {
                        return {
                            ...prevPhoto,
                            alt: `Sample photo ${index + 1}`,
                            width: prevPhoto.width ?? 800,
                            height: prevPhoto.height ?? 600,
                            panAndZoom: prevPhoto.panAndZoom ?? { scale: 1, x: 50, y: 50 }
                        };
                    }

                    return {
                        id: prevPhoto?.id || uuidv4(),
                        src,
                        alt: `Sample photo ${index + 1}`,
                        width: 800,
                        height: 600,
                        panAndZoom: prevPhoto?.panAndZoom ?? { scale: 1, x: 50, y: 50 }
                    };
                }

                return {
                    id: prevPhoto?.id || uuidv4(),
                    src: '',
                    alt: 'Drop photo here',
                    panAndZoom: prevPhoto?.panAndZoom ?? { scale: 1, x: 50, y: 50 }
                };
            });

            return {
                ...prev,
                photos,
                layout: template.id,
                photoGap: photoGap,
                pageMargin: pageMargin,
                spreadMode: targetSpreadMode
            };
        });
    };

    const handleCloneTemplate = (template: AdvancedTemplate, preferredMode?: 'full' | 'split') => {
        setCloneDraft({
            template,
            preferredMode,
            name: `${template.name} Copy`
        });
    };

    const handleUpdateLocalTemplateMetadata = useCallback((templateId: string | number, updates: Partial<AdvancedTemplate>) => {
        setCreatedTemplates(prev =>
            prev.map(template =>
                String(template.id) === String(templateId)
                    ? { ...template, ...updates }
                    : template
            )
        );

        setSelectedAdvancedTemplate(prev =>
            prev && String(prev.id) === String(templateId)
                ? { ...prev, ...updates }
                : prev
        );

        if (String(editingTemplateId) === String(templateId) && typeof updates.name === 'string') {
            setTemplateName(updates.name);
        }
    }, [editingTemplateId]);

    const handleConfirmClone = () => {
        if (!cloneDraft) return;
        const cloneName = cloneDraft.name.trim() || `${cloneDraft.template.name} Copy`;
        setPendingCloneTemplate(cloneDraft.template);
        handleSelectAdvancedTemplate(cloneDraft.template, cloneDraft.preferredMode, true);
        setEditingTemplateId(null);
        setTemplateName(cloneName);
        setCloneDraft(null);
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
            strokeWidth: 0,
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
        if (editingTemplateId && selectedAdvancedTemplate) {
            const proceed = window.confirm(
                "שימו לב: שינוי זה ישפיע על כל האלבומים הקיימים שמשתמשים בתבנית זו"
            );
            if (!proceed) return;
        }

        const templatesToPersist: AdvancedTemplate[] = [...createdTemplates];
        if (editingTemplateId && selectedAdvancedTemplate) {
            const alreadyQueued = templatesToPersist.some(t => String(t.id) === String(editingTemplateId));
            if (!alreadyQueued) {
                templatesToPersist.push({
                    ...selectedAdvancedTemplate,
                    _pageMargin: typeof selectedAdvancedTemplate._pageMargin === 'number'
                        ? selectedAdvancedTemplate._pageMargin
                        : pageMargin,
                    _photoGap: typeof selectedAdvancedTemplate._photoGap === 'number'
                        ? selectedAdvancedTemplate._photoGap
                        : photoGap,
                    _imageRotationMode: imageRotationMode,
                    _editorVersion: selectedAdvancedTemplate._editorVersion ?? 1,
                    _editorSpreadMode: selectedAdvancedTemplate._editorSpreadMode ?? spreadMode,
                    _editorObjects: cloneVectorObjects(selectedAdvancedTemplate._editorObjects)
                });
            }
        }

        // Save all created templates to Supabase
        if (templatesToPersist.length > 0) {
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
                const templatesToProcess = templatesToPersist.map(template => {
                    // Map type to type_id
                    let typeId = 3; // default BOTH
                    if (template.type === 'single') typeId = 1;
                    if (template.type === 'spread') typeId = 2;
                    const existingTemplateConfig = parseTemplateConfigObject(template.template_config);
                    const templateConfigPayload = {
                        ...existingTemplateConfig,
                        _pageMargin: typeof template._pageMargin === 'number' ? template._pageMargin : pageMargin,
                        _photoGap: typeof template._photoGap === 'number' ? template._photoGap : photoGap,
                        _imageRotationMode: normalizeTemplateImageRotationMode(template._imageRotationMode ?? imageRotationMode),
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
                        template_config: JSON.stringify(templateConfigPayload),
                        created_by: userId === 'anonymous' ? null : userId,
                        is_system: false,
                        is_active: true,
                        sort_order: 999,
                        type_id: typeId
                    };

                    // Use the template's own ID. It adheres to logic:
                    // - If it is a clone/new template, handleProcessLayout assigned a UUID.
                    // - If it is an edit, handleProcessLayout kept the original ID.
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
        if (onAddTemplate && templatesToPersist.length > 0) {
            templatesToPersist.forEach(template => onAddTemplate(template));
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
            const templateId = String(template.id);
            const isLocalDraft = createdTemplates.some((t) => String(t.id) === templateId);

            // Templates in "New" are local drafts for this session, even when their ID is numeric
            // (e.g. draft edits of an existing template before Save).
            if (isLocalDraft) {
                setCreatedTemplates((prev) => prev.filter((t) => String(t.id) !== templateId));
                if (String(selectedAdvancedTemplate?.id) === templateId) {
                    handleClearAll();
                }
                if (String(editingTemplateId) === templateId) {
                    setEditingTemplateId(null);
                    setTemplateName('');
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
                if (String(selectedAdvancedTemplate?.id) === templateId) {
                    handleClearAll();
                }
                if (String(editingTemplateId) === templateId) {
                    setEditingTemplateId(null);
                    setTemplateName('');
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
        setImageRotationMode('follow-frame');
        setCurrentStroke(null);
        setPendingCloneTemplate(null);
        // Clear the selected template so user can create a new one
        setSelectedAdvancedTemplate(null);
        setToolMode('select');
        setSelectedShapeIndices([]);
    }, []);

    useEffect(() => {
        if (!pendingCloneTemplate) return;
        if (vectorObjects.length > 0 || gridDesignerSegments.length > 0) {
            setPendingCloneTemplate(null);
        }
    }, [pendingCloneTemplate, vectorObjects.length, gridDesignerSegments.length]);

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
        const workspace = canvasFloatingHostRef.current ?? canvasWorkspaceRef.current;
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

    const handleToggleSettingsDockLock = useCallback(() => {
        if (!settingsPanelDockSide) return;
        if (isSettingsPanelDockLocked) {
            setIsSettingsPanelDockLocked(false);
            setSettingsPanelDockSide(null);
        } else {
            setIsSettingsPanelDockLocked(true);
        }
    }, [isSettingsPanelDockLocked, settingsPanelDockSide]);

    const handleStartDragSettingsPanel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (isSettingsPanelDockLocked) return;
        if (e.button !== 0) return;
        const workspace = canvasFloatingHostRef.current ?? canvasWorkspaceRef.current;
        const panel = floatingSettingsRef.current;
        if (!workspace || !panel) return;

        e.preventDefault();
        e.stopPropagation();

        const workspaceRect = workspace.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const offsetX = e.clientX - panelRect.left;
        const offsetY = e.clientY - panelRect.top;
        const maxX = Math.max(SETTINGS_PANEL_SAFE_MARGIN, workspaceRect.width - panelRect.width - SETTINGS_PANEL_SAFE_MARGIN);
        const panelHeight = Math.max(SETTINGS_PANEL_MIN_HEIGHT, panelRect.height);
        const maxY = Math.max(SETTINGS_PANEL_SAFE_MARGIN, workspaceRect.height - panelHeight - SETTINGS_PANEL_SAFE_MARGIN);
        let dockSideOnRelease: LayersDockSide = null;
        let lastPosition = { ...settingsPanelPosition };

        const onPointerMove = (ev: PointerEvent) => {
            const rawX = ev.clientX - workspaceRect.left - offsetX;
            const rawY = ev.clientY - workspaceRect.top - offsetY;

            const nearLeft = rawX <= SETTINGS_PANEL_DOCK_THRESHOLD;
            const nearRight = rawX >= (maxX - SETTINGS_PANEL_DOCK_THRESHOLD);
            dockSideOnRelease = nearLeft ? 'left' : (nearRight ? 'right' : null);

            const snappedX = dockSideOnRelease === 'left'
                ? SETTINGS_PANEL_SAFE_MARGIN
                : dockSideOnRelease === 'right'
                    ? maxX
                    : Math.max(SETTINGS_PANEL_SAFE_MARGIN, Math.min(maxX, rawX));

            const nextY = Math.max(SETTINGS_PANEL_SAFE_MARGIN, Math.min(maxY, rawY));
            setSettingsPanelDockSide(dockSideOnRelease);
            setIsSettingsPanelDockLocked(false);
            lastPosition = { x: snappedX, y: nextY };
            setSettingsPanelPosition(lastPosition);
        };

        const onPointerUp = () => {
            if (dockSideOnRelease) {
                setSettingsPanelDockSide(dockSideOnRelease);
                setIsSettingsPanelDockLocked(true);
            } else {
                setSettingsPanelDockSide(null);
                setIsSettingsPanelDockLocked(false);
            }
            setSettingsPanelPosition(lastPosition);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    }, [isSettingsPanelDockLocked, settingsPanelPosition]);

    const processObjectsToTemplate = useCallback((
        objectsToProcess: VectorObject[],
        gridSnapshot?: EditorGridSnapshot | null,
        editorObjectsForSnapshot?: VectorObject[]
    ): boolean => {
        if (objectsToProcess.length === 0) return false;

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

        const gridGroundRotation =
            gridSnapshot && gridSnapshot.segments.length > 0
                ? normalizeSignedDeg(gridSnapshot.rotationDeg || 0)
                : undefined;

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
                        rotation: obj.rotation,
                        imageGroundRotation: normalizeSignedDeg(obj.rotation || 0)
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
                const isGridBaseLayer = isBaseLayer && !!(gridSnapshot && gridSnapshot.segments.length > 0);
                const defaultLayerGroundRotation = isBaseLayer ? gridGroundRotation : undefined;

                // Default behavior:
                // - Base non-grid layer: include page bounds
                // - Grid base layer: avoid page-bound splitting (prevents edge sliver over-segmentation)
                const includePageBoundsPrimary = isBaseLayer && !isGridBaseLayer;
                const generatedRegionsRawPrimary = processLayoutGeometry(
                    layerSegments,
                    0, // gap handled later? no, gap param of processLayoutGeometry
                    logicalWidthUnits,
                    includePageBoundsPrimary
                );
                let generatedRegions = isGridBaseLayer
                    ? generatedRegionsRawPrimary.filter((region) => doesRegionIntersectPageBounds(region))
                    : generatedRegionsRawPrimary;

                // Fallback for rotated/open grid cases that produce no faces without page bounds.
                if (isGridBaseLayer && generatedRegions.length === 0) {
                    const generatedRegionsRawFallback = processLayoutGeometry(
                        layerSegments,
                        0,
                        logicalWidthUnits,
                        true
                    );
                    generatedRegions = generatedRegionsRawFallback.filter((region) => doesRegionIntersectPageBounds(region));
                }

                const mappedRegions = generatedRegions.map(r => ({
                    ...r,
                    zIndex: z,
                    stroke: strokeColor !== 'transparent' ? strokeColor : undefined,
                    strokeWidth: strokeWidth > 0 ? strokeWidth : undefined,
                    fill: fillColor !== 'transparent' ? fillColor : undefined
                })).map((region) => {
                    // Preserve per-object "ground" orientation for follow-frame mode,
                    // even when geometry processing bakes polygons with rotation=0
                    // (e.g. squares/ellipses where orientation is visually ambiguous).
                    let imageGroundRotation = defaultLayerGroundRotation;

                    const center: Point = [
                        ((region.bounds.x + (region.bounds.width / 2)) / 100) * logicalWidthUnits,
                        region.bounds.y + (region.bounds.height / 2)
                    ];

                    const candidateObjects = layerObjects.filter((obj) => {
                        if (obj.type === 'line' || obj.type === 'path') return false;
                        if (!obj.points || obj.points.length < 3) return false;
                        return isPointInPolygon(center, obj.points);
                    });

                    if (candidateObjects.length === 1) {
                        imageGroundRotation = getVectorObjectGroundRotationDeg(candidateObjects[0]);
                    }

                    if (imageGroundRotation === undefined) return region;
                    return {
                        ...region,
                        imageGroundRotation
                    };
                });

                allNewRegions.push(...mappedRegions);
            }

            allNewRegions.push(...layerPathRegions);
        });

        const finalRegions = markLikelyBackgroundRegions(allNewRegions);
        if (finalRegions.length === 0) {
            console.warn('[CustomLayoutEditor] PROCESS aborted: no regions generated, preserving current editor state.');
            return false;
        }

        // Generate a unique name for the new template
        const templateCount = createdTemplates.length + 1;

        // Update or Create Template
        // If we are editing an existing template, use its ID.
        // If we are cloning or creating a new template (editingTemplateId is null), generate a new UUID.
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
            _photoGap: photoGap,
            _imageRotationMode: imageRotationMode
        };

        const nextType = spreadMode === 'full' ? 'spread' : 'single';
        const existingTemplateConfig = parseTemplateConfigObject(targetTemplate.template_config);
        const editorObjectsSnapshot = editorObjectsForSnapshot ?? objectsToProcess;

        const templateConfigPayload: Record<string, unknown> = {
            ...existingTemplateConfig,
            _pageMargin: pageMargin,
            _photoGap: photoGap,
            _imageRotationMode: imageRotationMode,
            type: nextType,
            _editorVersion: 1,
            _editorSpreadMode: spreadMode,
            _editorObjects: cloneVectorObjects(editorObjectsSnapshot)
        };

        if (gridSnapshot && gridSnapshot.segments.length > 0) {
            templateConfigPayload._editorGrid = {
                rows: gridSnapshot.rows,
                cols: gridSnapshot.cols,
                mode: gridSnapshot.mode,
                rotationDeg: gridSnapshot.rotationDeg ?? 0,
                segments: cloneGridDesignerSegments(gridSnapshot.segments)
            };
        } else {
            delete templateConfigPayload._editorGrid;
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
            _imageRotationMode: imageRotationMode,
            _editorVersion: 1,
            _editorSpreadMode: spreadMode,
            _editorObjects: cloneVectorObjects(editorObjectsSnapshot),
            template_config: JSON.stringify(templateConfigPayload)
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
        return true;
    }, [config?.size, selectedAdvancedTemplate, handleSelectAdvancedTemplate, createdTemplates.length, pageMargin, photoGap, imageRotationMode, strokeColor, strokeWidth, fillColor, spreadMode, templateName]);

    // Process the drawn strokes into regions
    const handleProcessLayout = useCallback(() => {
        let fallbackEditorObjects: VectorObject[] = [];
        let fallbackGridSnapshot: EditorGridSnapshot | null = null;

        if (pendingCloneTemplate && vectorObjects.length === 0 && activeGridSegments.length === 0) {
            const fallbackTemplateConfig = parseTemplateConfigObject(pendingCloneTemplate.template_config);
            fallbackGridSnapshot = parseEditorGridSnapshot(fallbackTemplateConfig._editorGrid);
            fallbackEditorObjects = normalizeEditorSnapshotObjects(cloneVectorObjects(pendingCloneTemplate._editorObjects));
        }

        const effectiveVectorObjects = vectorObjects.length > 0 ? vectorObjects : fallbackEditorObjects;
        const effectiveGridSegments = activeGridSegments.length > 0
            ? activeGridSegments
            : (fallbackGridSnapshot?.segments.filter((segment) => segment.active) ?? []);

        const shouldProcessGrid = effectiveGridSegments.length > 0 &&
            (isGridDesignerEnabled || vectorObjects.length === 0 || !!fallbackGridSnapshot);

        if (shouldProcessGrid) {
            const gridObjects: VectorObject[] = effectiveGridSegments.map((segment) => ({
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

            const gridSnapshot: EditorGridSnapshot = activeGridSegments.length > 0
                ? {
                    rows: gridRows,
                    cols: gridCols,
                    mode: gridDesignerMode,
                    rotationDeg: gridRotationDeg,
                    segments: cloneGridDesignerSegments(gridDesignerSegments)
                }
                : {
                    rows: fallbackGridSnapshot?.rows ?? gridRows,
                    cols: fallbackGridSnapshot?.cols ?? gridCols,
                    mode: fallbackGridSnapshot?.mode ?? gridDesignerMode,
                    rotationDeg: fallbackGridSnapshot?.rotationDeg ?? gridRotationDeg,
                    segments: cloneGridDesignerSegments(fallbackGridSnapshot?.segments ?? [])
                };
            const combinedObjects = [...effectiveVectorObjects, ...gridObjects];
            const processOk = processObjectsToTemplate(combinedObjects, gridSnapshot, effectiveVectorObjects);
            if (!processOk) return;
            setVectorObjects([]);
            setGridDesignerSegments([]);
            setIsGridDesignerEnabled(false);
            setGridRotationDeg(0);
            setGridDesignerMode('none');
            setToolMode('select');
            setSelectedShapeIndices([]);
            setPendingCloneTemplate(null);
            return;
        }

        const processOk = processObjectsToTemplate(effectiveVectorObjects, null, effectiveVectorObjects);
        if (!processOk) return;
        setToolMode('select');
        setVectorObjects([]);
        setSelectedShapeIndices([]);
        setPendingCloneTemplate(null);
    }, [
        activeGridSegments,
        isGridDesignerEnabled,
        pendingCloneTemplate,
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
    const isSettingsDocked = settingsPanelDockSide !== null && isSettingsPanelDockLocked;
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
    const floatingSettingsTop = Math.max(SETTINGS_PANEL_SAFE_MARGIN, settingsPanelPosition.y);
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
    const settingsPanelNode = (
        <LayoutSettingsPanel
            photoGap={photoGap}
            onPhotoGapChange={handlePhotoGapChange}
            pageMargin={pageMargin}
            onPageMarginChange={handlePageMarginChange}
            cornerRadius={cornerRadius}
            onCornerRadiusChange={handleCornerRadiusChange}
            backgroundColor={backgroundColor}
            onBackgroundColorChange={handleBackgroundColorChange}
            useDummyPhotos={useDummyPhotos}
            onUseDummyPhotosChange={handleUseDummyPhotosChange}
            onDragStart={isSettingsPanelDockLocked ? undefined : handleStartDragSettingsPanel}
            isDocked={settingsPanelDockSide !== null}
            isDockLocked={isSettingsPanelDockLocked}
            onToggleDockLock={handleToggleSettingsDockLock}
            onClose={() => setIsSettingsPanelOpen(false)}
            onHeightChange={setSettingsPanelMeasuredHeight}
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
                        Template Name
                    </Label>
                    <div
                        id="template-name"
                        className="h-8 min-w-0 text-sm bg-muted/30 border border-muted-foreground/20 rounded-md px-3 flex items-center gap-2 text-foreground/90"
                        title={`${activeTemplateName} ${activeTemplateFrameLabel}`}
                    >
                        <span className="truncate">{activeTemplateName}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{activeTemplateFrameLabel}</span>
                    </div>
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

                    <Button
                        variant={isSettingsPanelOpen ? "secondary" : "ghost"}
                        size="icon"
                        className={cn("h-8 w-8", isSettingsPanelOpen && "text-primary")}
                        onClick={() => setIsSettingsPanelOpen((prev) => !prev)}
                        title={isSettingsPanelOpen ? "Hide Layout Settings" : "Show Layout Settings"}
                    >
                        <SlidersHorizontal className="h-4 w-4" />
                    </Button>

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
                    {isSettingsPanelOpen && isSettingsDocked && settingsPanelDockSide === 'left' && (
                        <div
                            className="relative z-[55] h-full flex-shrink-0 border-r bg-background"
                            style={{ width: SETTINGS_PANEL_WIDTH }}
                        >
                            <div className="w-full">
                                {settingsPanelNode}
                            </div>
                        </div>
                    )}

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
                    <div ref={canvasFloatingHostRef} className="flex-1 relative overflow-hidden flex flex-col">
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
                            imageRotationMode={imageRotationMode}
                            onImageRotationModeChange={setImageRotationMode}
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
                            onToolModeChange={setToolMode}
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
                            templateImageRotationMode={imageRotationMode}
                            allowTemplateFallbackWhenEmpty={editingTemplateId === null && templateName.trim().length === 0}
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

                        {isSettingsPanelOpen && !isSettingsDocked && (
                            <div
                                ref={floatingSettingsRef}
                                className="absolute z-[55]"
                                style={{
                                    left: settingsPanelPosition.x,
                                    top: floatingSettingsTop,
                                    width: SETTINGS_PANEL_WIDTH,
                                    maxWidth: `calc(100% - ${SETTINGS_PANEL_SAFE_MARGIN * 2}px)`,
                                    height: settingsPanelMeasuredHeight
                                }}
                            >
                                {settingsPanelNode}
                            </div>
                        )}

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

                    {isSettingsPanelOpen && isSettingsDocked && settingsPanelDockSide === 'right' && (
                        <div
                            className="relative z-[55] h-full flex-shrink-0 border-l bg-background"
                            style={{ width: SETTINGS_PANEL_WIDTH }}
                        >
                            <div className="w-full">
                                {settingsPanelNode}
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
                        onCloneAdvancedTemplate={handleCloneTemplate}
                        onDeleteTemplate={handleDeleteTemplate}
                        editingTemplateId={editingTemplateId}
                        onRefresh={refresh}
                        onUpdateLocalTemplateMetadata={handleUpdateLocalTemplateMetadata}
                    />
                </div>
            </div>

            {/* 3. Bottom Actions */}
            <div className="h-16 border-t bg-background flex items-center justify-end px-6 shrink-0 z-20">
                <div className="flex items-center gap-3">
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
            <AlertDialog open={!!cloneDraft} onOpenChange={(open) => !open && setCloneDraft(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Clone Template</AlertDialogTitle>
                        <AlertDialogDescription>
                            Enter a name for the cloned template.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2 py-1">
                        <Label htmlFor="clone-template-name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Template Name
                        </Label>
                        <Input
                            id="clone-template-name"
                            value={cloneDraft?.name ?? ''}
                            onChange={(e) =>
                                setCloneDraft((prev) => prev ? { ...prev, name: e.target.value } : prev)
                            }
                            placeholder="Template copy name"
                            className="h-9"
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmClone}>Clone</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
