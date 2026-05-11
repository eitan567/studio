import React, { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FlipHorizontal, Hash, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { AlbumPage, CoverText, CoverImage, AlbumConfig, Photo, PhotoPanAndZoom } from '@/lib/types';
import { AdvancedTemplate } from '@/lib/advanced-layout-types';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { PageLayout } from '../layouts/page-layout';
import { useTemplates, getPhotoCount } from '@/hooks/useTemplates';
import { useSettings } from '@/hooks/use-settings';
import { parseLayoutId } from '@/lib/layout-id-utils';
import { RotationAngle } from '@/lib/template-rotation';
import { useOptionalAlbumEditor } from '../album-editor/context';
import { SuggestionFan } from '../album-editor/suggestion-fan';
import { createGalleryPhotoReferenceResolver } from '@/lib/photo-reference';
import { extractSupabaseStoragePath } from '@/lib/supabase-media-normalizer';
import { buildFrameEdgeFadeMaskStyle, normalizeFrameEdgeFade } from '@/lib/frame-edge-fade';


// --- Types ---

export interface AlbumCoverProps {
    page: AlbumPage;
    config?: AlbumConfig;
    mode?: 'preview' | 'editor';
    activeView?: 'front' | 'back' | 'full' | 'split';
    preferPageCornerRadius?: boolean;

    // Interaction Handlers (Optional - mainly for Editor)
    activeTextIds?: string[];
    onSelectText?: (id: string | string[] | null, isMulti?: boolean) => void;
    onUpdatePage?: (page: AlbumPage) => void;
    onDropPhoto?: (pageId: string, targetPhotoId: string, droppedPhotoId: string, sourceInfo?: { pageId: string; photoId: string }) => void;
    onUpdatePhotoPanAndZoom?: (pageId: string, photoId: string, panAndZoom: PhotoPanAndZoom) => void;
    onInteractionChange?: (isInteracting: boolean) => void;
    onRemovePhoto?: (pageId: string, photoId: string) => void;
    onEnhancePhotoWithAi?: (pageId: string, photoId: string, photo: Photo) => void;
    onDynamicDropPhoto?: (
        pageId: string,
        droppedPhotoId: string,
        payload: { x: number; y: number; containerAspectRatio: number }
    ) => void;

    // Image Object Handlers
    activeImageIds?: string[];
    onSelectImage?: (id: string | string[] | null, isMulti?: boolean) => void;

    // For Preview-specific legacy support or extra overlays
    onUpdateTitleSettings?: (pageId: string, settings: any) => void;
    useSimpleImage?: boolean;

    // For suggestion fan feature
    allPhotos?: Photo[];
    previousPagePhotos?: Photo[];
    priority?: boolean;
    chronologicalIndex?: Record<string, number>;
    extraTemplates?: AdvancedTemplate[];
    disableFrameDrop?: boolean;
    dynamicMode?: boolean;
    lockOverlayImageAspectRatio?: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getFiniteNumber = (value: number | undefined, fallback: number) => {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const colorWithOpacity = (color: string, opacity: number) => {
    const normalizedOpacity = clamp(opacity, 0, 1);
    if (normalizedOpacity <= 0) return 'rgba(0, 0, 0, 0)';
    if (color === 'transparent') return 'transparent';

    const hexMatch = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (!hexMatch) return color;

    let hex = hexMatch[1];
    if (hex.length === 3) {
        hex = hex.split('').map((char) => char + char).join('');
    }

    const red = parseInt(hex.slice(0, 2), 16);
    const green = parseInt(hex.slice(2, 4), 16);
    const blue = parseInt(hex.slice(4, 6), 16);
    const alpha = hex.length === 8
        ? (parseInt(hex.slice(6, 8), 16) / 255) * normalizedOpacity
        : normalizedOpacity;

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const hasCoverTextBackground = (item: CoverText) => {
    const backgroundColor = item.style.backgroundColor;
    return !!backgroundColor
        && backgroundColor !== 'transparent'
        && getFiniteNumber(item.style.backgroundOpacity, 0.75) > 0;
};

const getCoverTextBackgroundVisualStyle = (style: CoverText['style']): React.CSSProperties => {
    const backgroundColor = style.backgroundColor || '#ffffff';
    const opacity = getFiniteNumber(style.backgroundOpacity, 0.75);
    const shape = style.backgroundShape || 'rounded';
    const fontSize = Math.max(1, getFiniteNumber(style.fontSize, 24));
    const centerColor = colorWithOpacity(backgroundColor, opacity);
    const midColor = colorWithOpacity(backgroundColor, opacity * 0.45);
    const transparentColor = colorWithOpacity(backgroundColor, 0);
    const commonStyle: React.CSSProperties = {
        backgroundRepeat: 'no-repeat',
        backgroundClip: 'padding-box',
        borderRadius: shape === 'pill' ? '9999px' : shape === 'rounded' ? `${fontSize * 0.35}px` : '0',
    };

    if (style.backgroundUniformOpacity) {
        return {
            ...commonStyle,
            backgroundColor: centerColor,
        };
    }

    return {
        ...commonStyle,
        backgroundImage: `radial-gradient(ellipse at center, ${centerColor} 0%, ${centerColor} 38%, ${midColor} 72%, ${transparentColor} 100%)`,
    };
};

const getCoverTextBackgroundPadding = (style: CoverText['style']) => {
    const legacyPaddingX = clamp(getFiniteNumber(style.backgroundPaddingX, 12), 0, 400);
    const legacyPaddingY = clamp(getFiniteNumber(style.backgroundPaddingY, 6), 0, 400);

    return {
        left: clamp(getFiniteNumber(style.backgroundPaddingLeft, legacyPaddingX), 0, 400),
        right: clamp(getFiniteNumber(style.backgroundPaddingRight, legacyPaddingX), 0, 400),
        top: clamp(getFiniteNumber(style.backgroundPaddingTop, legacyPaddingY), 0, 400),
        bottom: clamp(getFiniteNumber(style.backgroundPaddingBottom, legacyPaddingY), 0, 400),
    };
};

const getCoverTextBoxStyle = (item: CoverText, includeBackground = true): React.CSSProperties => {
    const fontSize = Math.max(1, getFiniteNumber(item.style.fontSize, 24));
    const padding = getCoverTextBackgroundPadding(item.style);

    if (!includeBackground || !hasCoverTextBackground(item)) {
        return { padding: '0.25rem' };
    }

    return {
        ...getCoverTextBackgroundVisualStyle(item.style),
        padding: `${padding.top / fontSize}em ${padding.right / fontSize}em ${padding.bottom / fontSize}em ${padding.left / fontSize}em`,
        boxDecorationBreak: 'clone',
        WebkitBoxDecorationBreak: 'clone',
    };
};

type TextGroupBackground = {
    groupId: string;
    left: number;
    top: number;
    width: number;
    height: number;
    style: CoverText['style'];
};

// --- Internal Helper Components ---

export const Spine = ({
    text,
    width,
    color,
    textColor,
    fontSize,
    fontFamily,
    fontWeight,
    fontStyle,
    opacity,
    textAlign,
    rotated = false,
    styleOverride
}: {
    text?: string;
    width?: number;
    color?: string;
    opacity?: number;
    textColor?: string;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string;
    fontStyle?: string;
    textAlign?: 'left' | 'center' | 'right';
    rotated?: boolean;
    styleOverride?: React.CSSProperties
}) => {
    const { settings } = useSettings();

    // Resolve values or fall back to settings
    const resolvedWidth = width !== undefined ? width : settings.defaultSpineWidth;
    const resolvedOpacity = opacity !== undefined ? opacity : settings.defaultSpineOpacity;
    const resolvedFontSize = fontSize !== undefined ? fontSize : settings.defaultSpineFontSize;
    const resolvedFontFamily = fontFamily || settings.defaultSpineFontFamily;
    const resolvedTextColor = textColor || settings.defaultSpineTextColor;
    const resolvedFontWeight = fontWeight || settings.defaultSpineFontWeight;
    const resolvedFontStyle = fontStyle || settings.defaultSpineFontStyle;
    const resolvedTextAlign = textAlign || settings.defaultSpineTextAlign;

    // Alignment logic
    const getContainerAlignment = (): string => {
        switch (resolvedTextAlign) {
            case 'left': return 'justify-start';
            case 'right': return 'justify-end';
            default: return 'justify-center';
        }
    };

    return (
        <div
            className={cn(
                "relative h-full flex flex-col items-center overflow-hidden z-20",
                getContainerAlignment(),
                (!resolvedWidth && resolvedWidth !== 0) || resolvedWidth > 0 ? "border-x border-dashed border-border/50" : "border-none"
            )}
            style={{
                width: `${resolvedWidth}px`,
                backgroundColor: color || settings.defaultSpineColor,
                opacity: resolvedOpacity,
                padding: resolvedTextAlign === 'left' || resolvedTextAlign === 'right' ? '10px 0' : '0',
                ...styleOverride
            }}
        >
            <span
                className="whitespace-nowrap text-muted-foreground/70 tracking-widest select-none"
                style={{
                    writingMode: 'vertical-rl',
                    textOrientation: 'mixed',
                    transform: rotated ? 'rotate(180deg)' : 'none',
                    fontSize: `${resolvedFontSize}px`,
                    fontFamily: resolvedFontFamily,
                    color: resolvedTextColor,
                    fontWeight: resolvedFontWeight === 'bold' ? 'bold' : 'normal',
                    fontStyle: resolvedFontStyle === 'italic' ? 'italic' : 'normal'
                }}
            >
                {text || (resolvedWidth === 0 ? '' : 'SPINE')}
            </span>
        </div>
    );
};

// Draggable Text for Editor
const DraggableCoverText = ({
    item,
    isSelected,
    onSelect,
    onUpdatePosition,
    onDragEnd,
    containerRef,
    fontSizeOverride,
    includeBackground = true,
    showSelectionFrame = true
}: {
    item: CoverText;
    isSelected: boolean;
    onSelect: (e: React.MouseEvent) => void;
    onUpdatePosition: (x: number, y: number) => void;
    onDragEnd?: () => void;
    containerRef: React.RefObject<HTMLDivElement | null>;
    fontSizeOverride?: string;
    includeBackground?: boolean;
    showSelectionFrame?: boolean;
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const hasMovedRef = useRef(false);
    const dragOffsetRef = useRef({ x: 0, y: 0 }); // To keep mouse relative position if needed (currently centering)
    const containerRectRef = useRef<DOMRect | null>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        e.stopPropagation();

        // Cache container rect to avoid layout thrashing during drag
        if (containerRef.current) {
            containerRectRef.current = containerRef.current.getBoundingClientRect();
        }

        // If not selected, or if modifier key is pressed, handle selection immediately
        // (Standard behavior: dragging an unselected item selects it first)
        if (!isSelected || e.ctrlKey || e.metaKey) {
            onSelect(e);
        }

        hasMovedRef.current = false;
        setIsDragging(true);
    };

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        // If we clicked an already selected item without moving, and no modifier was used,
        // this is the time to Deselect Others (reduce selection to just this one).
        if (isSelected && !hasMovedRef.current && !e.ctrlKey && !e.metaKey) {
            onSelect(e);
        }
    };

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRectRef.current) return;
            hasMovedRef.current = true; // Mark as moved
            const rect = containerRectRef.current;
            // Calculate percentage position
            let x = ((e.clientX - rect.left) / rect.width) * 100;
            let y = ((e.clientY - rect.top) / rect.height) * 100;
            onUpdatePosition(x, y);
        };

        const handleMouseUp = () => {
            if (isDragging && onDragEnd && hasMovedRef.current) {
                onDragEnd();
            }
            setIsDragging(false);
            containerRectRef.current = null; // Clear cache
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, onUpdatePosition, onDragEnd]);

    return (
        <div
            className={cn(
                "absolute cursor-move select-none whitespace-nowrap p-1 border-2",
                isSelected && showSelectionFrame && "border-primary border-dashed bg-primary/5 z-50",
                isSelected && !showSelectionFrame && "border-transparent z-50",
                !isSelected && "border-transparent hover:border-primary/20 z-40"
            )}
            style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                transform: 'translate(-50%, -50%)',
                ...getCoverTextBoxStyle(item, includeBackground),
                fontFamily: item.style.fontFamily,
                fontSize: fontSizeOverride || `${item.style.fontSize}px`,
                color: item.style.color,
                fontWeight: item.style.fontWeight === 'bold' ? 'bold' : 'normal',
                fontStyle: item.style.fontStyle === 'italic' ? 'italic' : 'normal',
                textAlign: item.style.textAlign || 'left',
                textShadow: item.style.textShadow,
                pointerEvents: 'auto'
            }}
            data-cover-text-id={item.id}
            data-cover-text-group-id={item.groupId}
            onMouseDown={handleMouseDown}
            onClick={handleClick}
        >
            {item.text}
        </div>
    );
};

// Static Text for Preview
export const StaticCoverText = ({
    item,
    fontSizeOverride,
    includeBackground = true
}: {
    item: CoverText;
    fontSizeOverride?: string;
    includeBackground?: boolean;
}) => {
    return (
        <div
            className="absolute select-none whitespace-nowrap p-1 border-2 border-transparent"
            style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                transform: 'translate(-50%, -50%)',
                ...getCoverTextBoxStyle(item, includeBackground),
                fontFamily: item.style.fontFamily,
                fontSize: fontSizeOverride || `${item.style.fontSize}px`,
                color: item.style.color,
                fontWeight: item.style.fontWeight === 'bold' ? 'bold' : 'normal',
                fontStyle: item.style.fontStyle === 'italic' ? 'italic' : 'normal',
                textAlign: item.style.textAlign || 'left',
                textShadow: item.style.textShadow,
                pointerEvents: 'none', // Static text shouldn't block clicks
                zIndex: 40
            }}
            data-cover-text-id={item.id}
            data-cover-text-group-id={item.groupId}
        >
            {item.text}
        </div>
    );
};

import { PhotoRenderer } from '../layouts/photo-renderer';

type ResizeDirection = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

const buildPathClipTransform = (viewBox?: string): string => {
    const parts = (viewBox || '0 0 100 100').split(' ').map(Number);
    const vx = Number.isFinite(parts[0]) ? parts[0] : 0;
    const vy = Number.isFinite(parts[1]) ? parts[1] : 0;
    const vw = Number.isFinite(parts[2]) && parts[2] > 0 ? parts[2] : 100;
    const vh = Number.isFinite(parts[3]) && parts[3] > 0 ? parts[3] : 100;
    return `scale(${1 / vw}, ${1 / vh}) translate(${-vx}, ${-vy})`;
};

const sanitizeClipId = (id: string): string => {
    return id.replace(/[^a-zA-Z0-9_-]/g, '-');
};

const resolveCoverImageFrameGap = (item: CoverImage, frameGap: number): number => {
    if (item.showPhotoGap === false) return 0;
    return Number.isFinite(frameGap) ? Math.max(0, frameGap) : 0;
};

const resolveCoverImageFrameEdgeFade = (item: CoverImage): number => {
    if (item.showPhotoGap !== false) return 0;
    return normalizeFrameEdgeFade(item.frameEdgeFade);
};

type AlbumDragSource = { pageId: string; photoId: string };
type GalleryDragSource = { photoId: string; selectedPhotoIds?: string[] };

const getDragDataTypes = (dataTransfer: DataTransfer): string[] => {
    try {
        return Array.from(dataTransfer.types || []);
    } catch {
        return [];
    }
};

const resolveGalleryDragSource = (
    e: React.DragEvent<HTMLElement>,
    activeGalleryDrag: GalleryDragSource | null
): GalleryDragSource | null => {
    const directId = e.dataTransfer.getData('photoId');
    const selectedIds = e.dataTransfer.getData('selectedPhotoIds');

    if (selectedIds) {
        try {
            const parsed = JSON.parse(selectedIds);
            if (Array.isArray(parsed) && typeof parsed[0] === 'string' && parsed[0]) {
                return {
                    photoId: directId || parsed[0],
                    selectedPhotoIds: parsed,
                };
            }
        } catch {
            // Ignore malformed multi-select payload.
        }
    }

    if (directId) {
        return { photoId: directId };
    }

    const albumPhotoId = e.dataTransfer.getData('albumPhotoId');
    const sourcePageId = e.dataTransfer.getData('sourcePageId');
    if (albumPhotoId || sourcePageId) {
        return null;
    }

    const dragTypes = getDragDataTypes(e.dataTransfer);
    if (dragTypes.includes('Files')) {
        return null;
    }

    return activeGalleryDrag;
};

const resolveDroppedPhotoIdFromEvent = (
    e: React.DragEvent<HTMLElement>,
    activeGalleryDrag: GalleryDragSource | null
): string => {
    return resolveGalleryDragSource(e, activeGalleryDrag)?.photoId || '';
};

const hasGalleryDragPayload = (
    e: React.DragEvent<HTMLElement>,
    activeGalleryDrag: GalleryDragSource | null
): boolean => {
    return !!resolveGalleryDragSource(e, activeGalleryDrag);
};

const resolveAlbumDragSource = (
    e: React.DragEvent<HTMLElement>,
    activeAlbumDrag: AlbumDragSource | null,
    activeGalleryDrag: GalleryDragSource | null
): AlbumDragSource | null => {
    const albumPhotoId = e.dataTransfer.getData('albumPhotoId');
    const sourcePageId = e.dataTransfer.getData('sourcePageId');

    if (albumPhotoId && sourcePageId) {
        return { pageId: sourcePageId, photoId: albumPhotoId };
    }

    const dragTypes = getDragDataTypes(e.dataTransfer);
    if (dragTypes.includes('Files') || hasGalleryDragPayload(e, activeGalleryDrag)) {
        return null;
    }

    return activeAlbumDrag;
};

// Draggable Image for Editor
const DraggableCoverImage = ({
    item,
    isSelected,
    isLead,
    onSelect,
    onUpdatePosition,
    onUpdateSize,
    onUpdateRotation,
    onDragEnd,
    containerRef,
    onUpdatePanAndZoom,
    onOpenContextMenu,
    pageId,
    photoId,
    onSwapDrop,
    onReplaceByPhotoId,
    lockAspectRatio = false,
    frameGap = 0,
    frameGapColor = '#ffffff',
    containerAspectRatio = 1
}: {
    item: CoverImage;
    isSelected: boolean;
    isLead?: boolean;
    onSelect: (e: React.MouseEvent) => void;
    onUpdatePosition: (x: number, y: number) => void;
    onUpdateSize: (width: number, height: number | undefined) => void;
    onUpdateRotation?: (rotation: number) => void;
    onDragEnd?: () => void;
    containerRef: React.RefObject<HTMLDivElement | null>;
    onUpdatePanAndZoom?: (panAndZoom: PhotoPanAndZoom) => void;
    onOpenContextMenu?: (e: React.MouseEvent<HTMLDivElement>, item: CoverImage) => void;
    pageId?: string;
    photoId?: string;
    onSwapDrop?: (targetPhotoId: string, sourceInfo: { pageId: string; photoId: string }) => void;
    onReplaceByPhotoId?: (photoId: string) => void;
    lockAspectRatio?: boolean;
    frameGap?: number;
    frameGapColor?: string;
    containerAspectRatio?: number;
}) => {
    const albumEditor = useOptionalAlbumEditor();
    const setActiveAlbumDrag = albumEditor?.setActiveAlbumDrag;
    const setActiveGalleryDrag = albumEditor?.setActiveGalleryDrag;
    const activeAlbumDrag = albumEditor?.activeAlbumDrag ?? null;
    const activeGalleryDrag = albumEditor?.activeGalleryDrag ?? null;
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [isRotating, setIsRotating] = useState(false);
    const [isCropMode, setIsCropMode] = useState(false); // New Crop Mode state
    const [isCtrlPressed, setIsCtrlPressed] = useState(false);

    const hasMovedRef = useRef(false);
    const dragOffsetRef = useRef({ x: 0, y: 0 });
    const containerRectRef = useRef<DOMRect | null>(null);
    const startResizeRef = useRef<{
        startWidth: number,
        startHeight: number,
        startCenterX: number,
        startCenterY: number,
        startX: number,
        startY: number,
        direction: ResizeDirection,
        freeResize: boolean
    } | null>(null);
    const rotateRef = useRef<{
        centerX: number;
        centerY: number;
        startPointerAngle: number;
        startRotation: number;
    } | null>(null);

    // Initial HEIGHT is derived if missing
    const currentHeight = item.height ?? (item.width / item.aspectRatio);
    const normalizedRotation = ((item.rotation ?? 0) % 360 + 360) % 360;
    const imageRotationMode = item.imageRotationMode === 'keep-horizontal' ? 'keep-horizontal' : 'follow-frame';
    const frameRotationDeg = normalizedRotation;
    const targetPhotoWorldRotationDeg = imageRotationMode === 'keep-horizontal' ? 0 : frameRotationDeg;
    const photoExtraRotationDeg = targetPhotoWorldRotationDeg - frameRotationDeg;
    const shouldAdjustPhotoRotation = Math.abs(photoExtraRotationDeg) > 0.0001;
    const frameAspectRatio = Math.max(
        0.01,
        ((item.width * Math.max(0.01, containerAspectRatio)) / Math.max(0.01, currentHeight))
    );
    const rotationRad = Math.abs(photoExtraRotationDeg) * (Math.PI / 180);
    const sinAbs = Math.abs(Math.sin(rotationRad));
    const cosAbs = Math.abs(Math.cos(rotationRad));
    const photoRotationCoverScale = Math.max(
        1,
        cosAbs + (sinAbs / frameAspectRatio),
        cosAbs + (sinAbs * frameAspectRatio)
    );
    const hasPathFrame = item.frameShape === 'path' && typeof item.framePath === 'string' && item.framePath.trim().length > 0;
    const pathClipId = hasPathFrame ? `dynamic-path-${sanitizeClipId(item.id)}` : null;
    const pathClipValue = hasPathFrame && pathClipId ? `url(#${pathClipId})` : undefined;
    const pathClipTransform = hasPathFrame ? buildPathClipTransform(item.frameViewBox) : '';
    const effectiveFrameGap = resolveCoverImageFrameGap(item, frameGap);
    const frameEdgeFadeMaskStyle = buildFrameEdgeFadeMaskStyle(resolveCoverImageFrameEdgeFade(item));
    const isLeadSelection = !!isLead && isSelected;
    const cornerHandleClass = isLeadSelection
        ? "border-emerald-500 hover:bg-emerald-500"
        : "border-primary hover:bg-primary";
    const edgeHandleClass = isLeadSelection
        ? "border-emerald-500 hover:bg-emerald-500"
        : "border-primary hover:bg-primary";
    const rotateAccentClass = isLeadSelection ? "bg-emerald-500/90" : "bg-pink-500/90";
    const rotateButtonClass = isLeadSelection ? "bg-emerald-500" : "bg-pink-500";

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey) setIsCtrlPressed(true);
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (!e.ctrlKey) setIsCtrlPressed(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        if (isCtrlPressed) return;
        if (isCropMode) return; // Let PhotoRenderer handle interaction in Crop Mode

        e.stopPropagation();

        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            containerRectRef.current = rect;
            const centerX = rect.left + ((item.x / 100) * rect.width);
            const centerY = rect.top + ((item.y / 100) * rect.height);
            dragOffsetRef.current = {
                x: e.clientX - centerX,
                y: e.clientY - centerY
            };
        } else {
            dragOffsetRef.current = { x: 0, y: 0 };
        }

        if (!isSelected || e.ctrlKey || e.metaKey || e.shiftKey) {
            onSelect(e);
        }

        hasMovedRef.current = false;
        setIsDragging(true);
    };

    const handleResizeStart = (e: React.MouseEvent, direction: ResizeDirection) => {
        e.stopPropagation();
        e.preventDefault();

        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        containerRectRef.current = rect;

        setIsResizing(true);
        startResizeRef.current = {
            startWidth: item.width,
            startHeight: currentHeight,
            startCenterX: item.x,
            startCenterY: item.y,
            startX: e.clientX,
            startY: e.clientY,
            direction,
            freeResize: e.shiftKey
        };
    };

    const handleRotateStart = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + ((item.x / 100) * rect.width);
        const centerY = rect.top + ((item.y / 100) * rect.height);
        const startPointerAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
        rotateRef.current = {
            centerX,
            centerY,
            startPointerAngle,
            startRotation: normalizedRotation
        };
        hasMovedRef.current = false;
        setIsRotating(true);
    };

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!hasMovedRef.current && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
            onSelect(e);
        }
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isSelected) {
            setIsCropMode(!isCropMode);
        }
    };

    const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!onOpenContextMenu) return;
        e.stopPropagation();
        if (!isSelected || e.ctrlKey || e.metaKey || e.shiftKey) {
            onSelect(e);
        }
        onOpenContextMenu(e, item);
    };

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        if (!isCtrlPressed || !pageId || !photoId) {
            e.preventDefault();
            return;
        }

        e.dataTransfer.setData('albumPhotoId', photoId);
        e.dataTransfer.setData('sourcePageId', pageId);
        e.dataTransfer.effectAllowed = 'move';
        setActiveGalleryDrag?.(null);
        setActiveAlbumDrag?.({ pageId, photoId });
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        const isGalleryDrag = hasGalleryDragPayload(e, activeGalleryDrag);
        const swapSource = isGalleryDrag ? null : resolveAlbumDragSource(e, activeAlbumDrag, activeGalleryDrag);
        const canSwap = !!(swapSource && onSwapDrop && photoId);
        const canReplace = !!(isGalleryDrag && onReplaceByPhotoId);

        if (!canSwap && !canReplace) return;

        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = canSwap ? 'move' : 'copy';
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        const isGalleryDrag = hasGalleryDragPayload(e, activeGalleryDrag);
        const swapSource = isGalleryDrag ? null : resolveAlbumDragSource(e, activeAlbumDrag, activeGalleryDrag);

        if (swapSource && onSwapDrop && photoId) {
            e.preventDefault();
            e.stopPropagation();
            onSwapDrop(photoId, swapSource);
            return;
        }

        const droppedPhotoId = resolveDroppedPhotoIdFromEvent(e, activeGalleryDrag);
        if (!droppedPhotoId || !onReplaceByPhotoId) return;

        e.preventDefault();
        e.stopPropagation();
        onReplaceByPhotoId(droppedPhotoId);
    };

    // Close crop mode when deselected
    useEffect(() => {
        if (!isSelected) {
            setIsCropMode(false);
        }
    }, [isSelected]);

    useEffect(() => {
        if (!isDragging && !isResizing && !isRotating) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (isRotating && rotateRef.current) {
                const currentPointerAngle = Math.atan2(
                    e.clientY - rotateRef.current.centerY,
                    e.clientX - rotateRef.current.centerX
                ) * 180 / Math.PI;
                const rawDelta = currentPointerAngle - rotateRef.current.startPointerAngle;
                const delta = ((rawDelta + 540) % 360) - 180;
                const nextRotation = ((rotateRef.current.startRotation + delta) % 360 + 360) % 360;
                onUpdateRotation?.(nextRotation);
                hasMovedRef.current = true;
                return;
            }

            if (!containerRectRef.current) return;
            const rect = containerRectRef.current;
            hasMovedRef.current = true;

            if (isDragging) {
                // Preserve the pickup point inside the frame (no center snapping on drag).
                let x = ((e.clientX - rect.left - dragOffsetRef.current.x) / rect.width) * 100;
                let y = ((e.clientY - rect.top - dragOffsetRef.current.y) / rect.height) * 100;
                onUpdatePosition(x, y);
            } else if (isResizing && startResizeRef.current) {
                const {
                    startX,
                    startY,
                    startWidth,
                    startHeight,
                    startCenterX,
                    startCenterY,
                    direction,
                    freeResize
                } = startResizeRef.current;

                // Delta in pixels
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;

                // Convert pixel delta to percentage
                const dWidth = (dx / rect.width) * 100;
                const dHeight = (dy / rect.height) * 100;

                const minSize = 2;
                const affectsWidth = direction.includes('e') || direction.includes('w');
                const affectsHeight = direction.includes('n') || direction.includes('s');
                const movingLeft = direction.includes('w');
                const movingRight = direction.includes('e');
                const movingTop = direction.includes('n');
                const movingBottom = direction.includes('s');
                const isEdgeHandle = direction === 'n' || direction === 's' || direction === 'e' || direction === 'w';
                const shouldLockAspect = lockAspectRatio && !freeResize && !isEdgeHandle;

                const startLeft = startCenterX - (startWidth / 2);
                const startRight = startCenterX + (startWidth / 2);
                const startTop = startCenterY - (startHeight / 2);
                const startBottom = startCenterY + (startHeight / 2);

                let left = startLeft;
                let right = startRight;
                let top = startTop;
                let bottom = startBottom;

                if (shouldLockAspect) {
                    const aspectRatio = item.aspectRatio > 0 ? item.aspectRatio : 1;
                    const localContainerAspectRatio = rect.width > 0 && rect.height > 0
                        ? (rect.width / rect.height)
                        : 1;
                    const widthFromHeightFactor = aspectRatio / localContainerAspectRatio;
                    const heightFromWidthFactor = localContainerAspectRatio / aspectRatio;

                    const movedEdgeX = movingLeft ? (startLeft + dWidth) : (startRight + dWidth);
                    const movedEdgeY = movingTop ? (startTop + dHeight) : (startBottom + dHeight);
                    const anchorX = movingLeft ? startRight : startLeft;
                    const anchorY = movingTop ? startBottom : startTop;

                    const rawWidthFromX = movingLeft
                        ? Math.max(minSize, anchorX - movedEdgeX)
                        : Math.max(minSize, movedEdgeX - anchorX);
                    const rawHeightFromY = movingTop
                        ? Math.max(minSize, anchorY - movedEdgeY)
                        : Math.max(minSize, movedEdgeY - anchorY);
                    const rawWidthFromY = rawHeightFromY * widthFromHeightFactor;

                    const targetWidthUnclamped = Math.abs(rawWidthFromX - startWidth) >= Math.abs(rawWidthFromY - startWidth)
                        ? rawWidthFromX
                        : rawWidthFromY;
                    const minWidthFromHeightFloor = minSize * widthFromHeightFactor;
                    const maxWidthByX = movingLeft ? anchorX : (100 - anchorX);
                    const maxHeightByY = movingTop ? anchorY : (100 - anchorY);
                    const maxWidthByY = maxHeightByY * widthFromHeightFactor;
                    const maxAllowedWidth = Math.max(minSize, Math.min(maxWidthByX, maxWidthByY));
                    const targetWidth = Math.max(minSize, minWidthFromHeightFloor, Math.min(maxAllowedWidth, targetWidthUnclamped));
                    const targetHeight = Math.max(minSize, targetWidth * heightFromWidthFactor);

                    if (movingLeft) {
                        left = anchorX - targetWidth;
                        right = anchorX;
                    } else if (movingRight) {
                        left = anchorX;
                        right = anchorX + targetWidth;
                    }
                    if (movingTop) {
                        top = anchorY - targetHeight;
                        bottom = anchorY;
                    } else if (movingBottom) {
                        top = anchorY;
                        bottom = anchorY + targetHeight;
                    }
                } else {
                    if (movingLeft) {
                        left = Math.max(0, Math.min(startLeft + dWidth, startRight - minSize));
                    } else if (movingRight) {
                        right = Math.min(100, Math.max(startRight + dWidth, startLeft + minSize));
                    }
                    if (movingTop) {
                        top = Math.max(0, Math.min(startTop + dHeight, startBottom - minSize));
                    } else if (movingBottom) {
                        bottom = Math.min(100, Math.max(startBottom + dHeight, startTop + minSize));
                    }
                }

                const newWidth = Math.max(minSize, right - left);
                const newHeight = Math.max(minSize, bottom - top);
                const newX = left + (newWidth / 2);
                const newY = top + (newHeight / 2);

                if (affectsWidth || affectsHeight) {
                    onUpdatePosition(newX, newY);
                }
                onUpdateSize(newWidth, newHeight);
            }
        };

        const handleMouseUp = () => {
            if ((isDragging || isResizing || isRotating) && onDragEnd && hasMovedRef.current) {
                onDragEnd();
            }
            setIsDragging(false);
            setIsResizing(false);
            setIsRotating(false);
            containerRectRef.current = null;
            dragOffsetRef.current = { x: 0, y: 0 };
            startResizeRef.current = null;
            rotateRef.current = null;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isResizing, isRotating, lockAspectRatio, item.aspectRatio, onUpdatePosition, onUpdateRotation, onUpdateSize, onDragEnd]);

    // Construct "Photo" object for PhotoRenderer
    const photoObject: Photo = {
        id: item.id,
        src: item.url,
        alt: 'cover image',
        width: 1000, // Dummy dimensions for aspect ratio calc inside renderer? 
        // No, PhotoRenderer needs intrinsic dimensions to calc cover.
        // We know aspect ratio. Let's assume W=1000.
        height: 1000 / item.aspectRatio,
        panAndZoom: item.panAndZoom
    };

    return (
        <div
            className={cn(
                "absolute select-none group/item",
                isSelected ? "z-50" : "z-40",
                !isSelected && "hover:ring-2 hover:ring-primary/20",
                isCropMode ? "cursor-default ring-2 ring-primary ring-offset-2" : "cursor-move",
                isSelected && !isCropMode && (isLeadSelection
                    ? "ring-2 ring-emerald-500 ring-dashed"
                    : "ring-2 ring-primary ring-dashed")
            )}
            style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                width: `${item.width}%`,
                height: `${currentHeight}%`,
                transform: `translate(-50%, -50%) rotate(${normalizedRotation}deg)`,
                opacity: item.opacity,
                zIndex: item.zIndex,
                boxSizing: 'border-box'
            }}
            data-dynamic-image-id={item.id}
            draggable={isCtrlPressed && !!pageId && !!photoId}
            onDragStart={handleDragStart}
            onDragEnd={() => {
                setActiveAlbumDrag?.(null);
                setActiveGalleryDrag?.(null);
            }}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onMouseDown={isCtrlPressed ? undefined : handleMouseDown}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
        >
            {isLeadSelection && (
                <div className="absolute -top-5 left-0 rounded-sm border border-emerald-500/50 bg-emerald-500/15 px-1 py-[1px] text-[9px] font-semibold leading-none text-emerald-300 pointer-events-none">
                    Lead
                </div>
            )}
            {hasPathFrame && pathClipId && item.framePath && (
                <svg
                    width="0"
                    height="0"
                    className="absolute"
                    style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
                    aria-hidden="true"
                >
                    <defs>
                        <clipPath id={pathClipId} clipPathUnits="objectBoundingBox">
                            <path d={item.framePath} transform={pathClipTransform} />
                        </clipPath>
                    </defs>
                </svg>
            )}
            <div
                className="w-full h-full relative overflow-hidden pointer-events-none"
                style={{
                    ...(effectiveFrameGap > 0 ? { backgroundColor: frameGapColor } : {}),
                    clipPath: pathClipValue,
                    WebkitClipPath: pathClipValue
                }}
            >
                {/* 
                    Wrapper div for Renderer. 
                    If Crop Mode -> enable pointer events on Renderer.
                    Else -> disable so we can drag the container.
                 */}
                <div
                    className={cn("absolute overflow-hidden", isCropMode ? "pointer-events-auto" : "pointer-events-none")}
                    style={{
                        left: effectiveFrameGap > 0 ? `${effectiveFrameGap}px` : 0,
                        top: effectiveFrameGap > 0 ? `${effectiveFrameGap}px` : 0,
                        right: effectiveFrameGap > 0 ? `${effectiveFrameGap}px` : 0,
                        bottom: effectiveFrameGap > 0 ? `${effectiveFrameGap}px` : 0,
                        ...frameEdgeFadeMaskStyle,
                        clipPath: pathClipValue,
                        WebkitClipPath: pathClipValue
                    }}
                >
                    {shouldAdjustPhotoRotation ? (
                        <div
                            className="absolute inset-0"
                            style={{
                                transform: `rotate(${photoExtraRotationDeg}deg) scale(${photoRotationCoverScale})`,
                                transformOrigin: '50% 50%'
                            }}
                        >
                            <PhotoRenderer
                                photo={photoObject}
                                onUpdate={(panAndZoom) => onUpdatePanAndZoom?.(panAndZoom)}
                                useSimpleImage={!isCropMode && !isSelected} // Optimization?
                                fitRotationDeg={photoExtraRotationDeg}
                                onInteractionChange={() => { }}
                            />
                        </div>
                    ) : (
                        <PhotoRenderer
                            photo={photoObject}
                            onUpdate={(panAndZoom) => onUpdatePanAndZoom?.(panAndZoom)}
                            useSimpleImage={!isCropMode && !isSelected} // Optimization?
                            onInteractionChange={() => { }}
                        />
                    )}
                </div>
            </div>

            {/* Resize Handles - Only visible when selected AND NOT in Crop Mode (to avoid confusion?) 
                Actually, maybe allow resizing in crop mode too? Let's hide to be clear.
            */}
            {isSelected && !isCropMode && (
                <>
                    {/* Resize handles (Canva-like: corners + edges) */}
                    <div
                        className={cn("absolute -top-1 -left-1 h-3 w-3 rounded-full border bg-white cursor-nwse-resize z-50 hover:scale-125 transition-transform", cornerHandleClass)}
                        onMouseDown={(e) => handleResizeStart(e, 'nw')}
                    />
                    <div
                        className={cn("absolute -top-1 -right-1 h-3 w-3 rounded-full border bg-white cursor-nesw-resize z-50 hover:scale-125 transition-transform", cornerHandleClass)}
                        onMouseDown={(e) => handleResizeStart(e, 'ne')}
                    />
                    <div
                        className={cn("absolute -bottom-1 -right-1 h-3 w-3 rounded-full border bg-white cursor-nwse-resize z-50 hover:scale-125 transition-transform", cornerHandleClass)}
                        onMouseDown={(e) => handleResizeStart(e, 'se')}
                    />
                    <div
                        className={cn("absolute -bottom-1 -left-1 h-3 w-3 rounded-full border bg-white cursor-nesw-resize z-50 hover:scale-125 transition-transform", cornerHandleClass)}
                        onMouseDown={(e) => handleResizeStart(e, 'sw')}
                    />

                    <div
                        className={cn("absolute -top-1 left-1/2 -ml-2 h-1.5 w-4 rounded-full border bg-white cursor-n-resize z-50 transition-colors", edgeHandleClass)}
                        onMouseDown={(e) => handleResizeStart(e, 'n')}
                    />
                    <div
                        className={cn("absolute -bottom-1 left-1/2 -ml-2 h-1.5 w-4 rounded-full border bg-white cursor-s-resize z-50 transition-colors", edgeHandleClass)}
                        onMouseDown={(e) => handleResizeStart(e, 's')}
                    />
                    <div
                        className={cn("absolute top-1/2 -left-1 -mt-2 h-4 w-1.5 rounded-full border bg-white cursor-w-resize z-50 transition-colors", edgeHandleClass)}
                        onMouseDown={(e) => handleResizeStart(e, 'w')}
                    />
                    <div
                        className={cn("absolute top-1/2 -right-1 -mt-2 h-4 w-1.5 rounded-full border bg-white cursor-e-resize z-50 transition-colors", edgeHandleClass)}
                        onMouseDown={(e) => handleResizeStart(e, 'e')}
                    />

                    {/* 4 corner rotate handles with connector lines */}
                    {[
                        { key: 'tl', anchorX: '0%', anchorY: '0%', offsetX: -20, offsetY: -20 },
                        { key: 'tr', anchorX: '100%', anchorY: '0%', offsetX: 20, offsetY: -20 },
                        { key: 'br', anchorX: '100%', anchorY: '100%', offsetX: 20, offsetY: 20 },
                        { key: 'bl', anchorX: '0%', anchorY: '100%', offsetX: -20, offsetY: 20 }
                    ].map((handle) => {
                        const lineLength = Math.max(10, Math.hypot(handle.offsetX, handle.offsetY));
                        const lineAngle = Math.atan2(handle.offsetY, handle.offsetX) * (180 / Math.PI);
                        return (
                            <div
                                key={handle.key}
                                className="absolute pointer-events-none"
                                style={{ left: handle.anchorX, top: handle.anchorY }}
                            >
                                <div
                                    className={cn("absolute left-0 top-0 h-[1.5px]", rotateAccentClass)}
                                    style={{
                                        width: `${lineLength}px`,
                                        transformOrigin: '0 50%',
                                        transform: `rotate(${lineAngle}deg)`
                                    }}
                                />
                                <button
                                    type="button"
                                    className={cn("absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow-sm cursor-crosshair pointer-events-auto", rotateButtonClass)}
                                    style={{ left: `${handle.offsetX}px`, top: `${handle.offsetY}px` }}
                                    onMouseDown={handleRotateStart}
                                    aria-label="Rotate frame"
                                />
                            </div>
                        );
                    })}

                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 rounded bg-black/75 px-2 py-0.5 text-[8px] font-medium text-white/90 opacity-0 transition-opacity whitespace-nowrap pointer-events-none group-hover/item:opacity-100">
                        Double-click to crop
                    </div>
                </>
            )}

            {isCropMode && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] px-2 py-1 rounded shadow-md pointer-events-none font-bold">
                    CROP MODE
                </div>
            )}
        </div>
    );
};

// Static Image for Preview
export const StaticCoverImage = ({
    item,
    frameGap = 0,
    frameGapColor = '#ffffff',
    interactive = false,
    onUpdatePanAndZoom,
    onReplaceByPhotoId,
    onOpenContextMenu,
    pageId,
    photoId,
    onSwapDrop,
    containerAspectRatio = 1
}: {
    item: CoverImage;
    frameGap?: number;
    frameGapColor?: string;
    interactive?: boolean;
    onUpdatePanAndZoom?: (panAndZoom: PhotoPanAndZoom) => void;
    onReplaceByPhotoId?: (photoId: string) => void;
    onOpenContextMenu?: (e: React.MouseEvent<HTMLDivElement>, item: CoverImage) => void;
    pageId?: string;
    photoId?: string;
    onSwapDrop?: (targetPhotoId: string, sourceInfo: { pageId: string; photoId: string }) => void;
    containerAspectRatio?: number;
}) => {
    const albumEditor = useOptionalAlbumEditor();
    const setActiveAlbumDrag = albumEditor?.setActiveAlbumDrag;
    const setActiveGalleryDrag = albumEditor?.setActiveGalleryDrag;
    const activeAlbumDrag = albumEditor?.activeAlbumDrag ?? null;
    const activeGalleryDrag = albumEditor?.activeGalleryDrag ?? null;
    const [isCtrlPressed, setIsCtrlPressed] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey) setIsCtrlPressed(true);
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (!e.ctrlKey) setIsCtrlPressed(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // If height is missing, use aspect ratio
    const heightPercent = item.height ?? (item.width / item.aspectRatio);
    const normalizedRotation = ((item.rotation ?? 0) % 360 + 360) % 360;
    const imageRotationMode = item.imageRotationMode === 'keep-horizontal' ? 'keep-horizontal' : 'follow-frame';
    const frameRotationDeg = normalizedRotation;
    const targetPhotoWorldRotationDeg = imageRotationMode === 'keep-horizontal' ? 0 : frameRotationDeg;
    const photoExtraRotationDeg = targetPhotoWorldRotationDeg - frameRotationDeg;
    const shouldAdjustPhotoRotation = Math.abs(photoExtraRotationDeg) > 0.0001;
    const frameAspectRatio = Math.max(
        0.01,
        ((item.width * Math.max(0.01, containerAspectRatio)) / Math.max(0.01, heightPercent))
    );
    const rotationRad = Math.abs(photoExtraRotationDeg) * (Math.PI / 180);
    const sinAbs = Math.abs(Math.sin(rotationRad));
    const cosAbs = Math.abs(Math.cos(rotationRad));
    const photoRotationCoverScale = Math.max(
        1,
        cosAbs + (sinAbs / frameAspectRatio),
        cosAbs + (sinAbs * frameAspectRatio)
    );
    const hasPathFrame = item.frameShape === 'path' && typeof item.framePath === 'string' && item.framePath.trim().length > 0;
    const pathClipId = hasPathFrame ? `dynamic-path-${sanitizeClipId(item.id)}` : null;
    const pathClipValue = hasPathFrame && pathClipId ? `url(#${pathClipId})` : undefined;
    const pathClipTransform = hasPathFrame ? buildPathClipTransform(item.frameViewBox) : '';
    const effectiveFrameGap = resolveCoverImageFrameGap(item, frameGap);
    const frameEdgeFadeMaskStyle = buildFrameEdgeFadeMaskStyle(resolveCoverImageFrameEdgeFade(item));

    const photoObject: Photo = {
        id: item.id,
        src: item.url,
        alt: 'cover image',
        width: 1000,
        height: 1000 / item.aspectRatio,
        panAndZoom: item.panAndZoom
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        const isGalleryDrag = hasGalleryDragPayload(e, activeGalleryDrag);
        const swapSource = isGalleryDrag ? null : resolveAlbumDragSource(e, activeAlbumDrag, activeGalleryDrag);
        const canSwap = !!(swapSource && onSwapDrop && photoId);
        const canReplace = !!(interactive && isGalleryDrag && onReplaceByPhotoId);
        if (!canSwap && !canReplace) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = canSwap ? 'move' : 'copy';
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        const isGalleryDrag = hasGalleryDragPayload(e, activeGalleryDrag);
        const swapSource = isGalleryDrag ? null : resolveAlbumDragSource(e, activeAlbumDrag, activeGalleryDrag);
        if (swapSource && onSwapDrop && photoId) {
            e.preventDefault();
            e.stopPropagation();
            onSwapDrop(photoId, swapSource);
            return;
        }

        if (!interactive || !onReplaceByPhotoId) return;
        const droppedPhotoId = resolveDroppedPhotoIdFromEvent(e, activeGalleryDrag);
        if (!droppedPhotoId) return;
        e.preventDefault();
        e.stopPropagation();
        onReplaceByPhotoId(droppedPhotoId);
    };

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        if (!isCtrlPressed || !pageId || !photoId) {
            e.preventDefault();
            return;
        }

        e.dataTransfer.setData('albumPhotoId', photoId);
        e.dataTransfer.setData('sourcePageId', pageId);
        e.dataTransfer.effectAllowed = 'move';
        setActiveGalleryDrag?.(null);
        setActiveAlbumDrag?.({ pageId, photoId });
    };

    return (
        <div
            className={cn(
                "absolute select-none overflow-hidden",
                interactive ? "pointer-events-auto" : "pointer-events-none"
            )}
            style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                width: `${item.width}%`,
                height: `${heightPercent}%`,
                transform: `translate(-50%, -50%) rotate(${normalizedRotation}deg)`,
                opacity: item.opacity,
                // Preserve explicit zIndex=0 (do not coerce to default 40).
                zIndex: item.zIndex ?? 40,
                boxSizing: 'border-box'
            }}
            data-dynamic-image-id={item.id}
            draggable={isCtrlPressed && !!pageId && !!photoId}
            onDragStart={handleDragStart}
            onDragEnd={() => {
                setActiveAlbumDrag?.(null);
                setActiveGalleryDrag?.(null);
            }}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onContextMenu={(e) => onOpenContextMenu?.(e, item)}
        >
            {hasPathFrame && pathClipId && item.framePath && (
                <svg
                    width="0"
                    height="0"
                    className="absolute"
                    style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
                    aria-hidden="true"
                >
                    <defs>
                        <clipPath id={pathClipId} clipPathUnits="objectBoundingBox">
                            <path d={item.framePath} transform={pathClipTransform} />
                        </clipPath>
                    </defs>
                </svg>
            )}
            <div
                className="w-full h-full relative overflow-hidden"
                style={{
                    ...(effectiveFrameGap > 0 ? { backgroundColor: frameGapColor } : {}),
                    clipPath: pathClipValue,
                    WebkitClipPath: pathClipValue
                }}
            >
                <div
                    className="absolute overflow-hidden"
                    style={{
                        left: effectiveFrameGap > 0 ? `${effectiveFrameGap}px` : 0,
                        top: effectiveFrameGap > 0 ? `${effectiveFrameGap}px` : 0,
                        right: effectiveFrameGap > 0 ? `${effectiveFrameGap}px` : 0,
                        bottom: effectiveFrameGap > 0 ? `${effectiveFrameGap}px` : 0,
                        ...frameEdgeFadeMaskStyle,
                        clipPath: pathClipValue,
                        WebkitClipPath: pathClipValue
                    }}
                >
                    {shouldAdjustPhotoRotation ? (
                        <div
                            className="absolute inset-0"
                            style={{
                                transform: `rotate(${photoExtraRotationDeg}deg) scale(${photoRotationCoverScale})`,
                                transformOrigin: '50% 50%'
                            }}
                        >
                            <PhotoRenderer
                                photo={photoObject}
                                onUpdate={(panAndZoom) => onUpdatePanAndZoom?.(panAndZoom)}
                                useSimpleImage={!interactive}
                                fitRotationDeg={photoExtraRotationDeg}
                            />
                        </div>
                    ) : (
                        <PhotoRenderer
                            photo={photoObject}
                            onUpdate={(panAndZoom) => onUpdatePanAndZoom?.(panAndZoom)}
                            useSimpleImage={!interactive}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Main Component ---

export const AlbumCover = ({
    page,
    config,
    mode = 'preview',
    activeView = 'full',
    preferPageCornerRadius = false,
    activeTextIds = [],
    onSelectText,
    activeImageIds = [],
    onSelectImage,
    onUpdatePage,
    onDropPhoto,
    onUpdatePhotoPanAndZoom, // This is for PageLayout Photos
    onInteractionChange,
    onRemovePhoto,
    onEnhancePhotoWithAi,
    onDynamicDropPhoto,
    // onUpdateTitleSettings
    useSimpleImage,
    allPhotos = [],
    previousPagePhotos = [],
    priority = false, // Default to false
    chronologicalIndex,
    extraTemplates = [],
    disableFrameDrop = false,
    dynamicMode = false,
    lockOverlayImageAspectRatio = false,
}: AlbumCoverProps) => {
    const {
        gridTemplates,
        coverTemplates,
        advancedTemplates,
        defaultGridTemplate,
        defaultCoverTemplate
    } = useTemplates();
    const containerRef = useRef<HTMLDivElement>(null);
    const latestPageRef = useRef(page);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    // Optimization: Local state for drag positions to avoid global re-renders
    const [dragPositions, setDragPositions] = useState<Record<string, { x: number, y: number }>>({});
    const [textGroupBackgrounds, setTextGroupBackgrounds] = useState<TextGroupBackground[]>([]);
    const [dynamicContextMenu, setDynamicContextMenu] = useState<{
        x: number;
        y: number;
        imageId: string;
        anchorRect: DOMRect | null;
    } | null>(null);
    const [dynamicSuggestionAnchor, setDynamicSuggestionAnchor] = useState<{
        rect: DOMRect;
        imageId: string;
    } | null>(null);
    const albumEditor = useOptionalAlbumEditor();
    const scrollToGallery = albumEditor?.scrollToGallery;
    const activeAlbumDrag = albumEditor?.activeAlbumDrag ?? null;
    const activeGalleryDrag = albumEditor?.activeGalleryDrag ?? null;
    const textGroupBackgroundStyles = useMemo(() => {
        const styles = new Map<string, CoverText['style']>();
        (page.coverTexts || []).forEach((textItem) => {
            if (!textItem.groupId || !hasCoverTextBackground(textItem) || styles.has(textItem.groupId)) return;
            styles.set(textItem.groupId, textItem.style);
        });
        return styles;
    }, [page.coverTexts]);

    // Canvas click handler (for deselecting)
    const handleCanvasClick = (e: React.MouseEvent) => {
        if (mode === 'editor') {
            onSelectText?.(null);
            onSelectImage?.(null);
        }
    };

    useEffect(() => {
        latestPageRef.current = page;
    }, [page]);

    const commitPageUpdate = useCallback((updater: (currentPage: AlbumPage) => AlbumPage) => {
        if (!onUpdatePage) return;
        const nextPage = updater(latestPageRef.current);
        latestPageRef.current = nextPage;
        onUpdatePage(nextPage);
    }, [onUpdatePage]);

    const closeDynamicContextMenu = useCallback(() => {
        setDynamicContextMenu(null);
    }, []);

    useEffect(() => {
        if (!dynamicContextMenu) return;

        const handlePointerDown = () => closeDynamicContextMenu();
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeDynamicContextMenu();
        };
        const handleScroll = () => closeDynamicContextMenu();

        window.addEventListener('mousedown', handlePointerDown);
        window.addEventListener('keydown', handleEscape);
        window.addEventListener('scroll', handleScroll, true);

        return () => {
            window.removeEventListener('mousedown', handlePointerDown);
            window.removeEventListener('keydown', handleEscape);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [dynamicContextMenu, closeDynamicContextMenu]);

    useEffect(() => {
        const validIds = new Set((page.coverImages || []).map((image) => image.id));

        if (dynamicContextMenu && !validIds.has(dynamicContextMenu.imageId)) {
            setDynamicContextMenu(null);
        }

        if (dynamicSuggestionAnchor && !validIds.has(dynamicSuggestionAnchor.imageId)) {
            setDynamicSuggestionAnchor(null);
        }
    }, [dynamicContextMenu, dynamicSuggestionAnchor, page.coverImages]);

    useLayoutEffect(() => {
        if (!containerRef.current) return;

        const measure = () => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            setContainerSize({
                width: rect.width,
                height: rect.height
            });
        };

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(containerRef.current);

        return () => observer.disconnect();
    }, []);

    useLayoutEffect(() => {
        const container = containerRef.current;

        if (!container || textGroupBackgroundStyles.size === 0) {
            setTextGroupBackgrounds(prev => prev.length === 0 ? prev : []);
            return;
        }

        const containerRect = container.getBoundingClientRect();
        const layoutWidth = container.offsetWidth || containerRect.width || 1;
        const layoutHeight = container.offsetHeight || containerRect.height || 1;
        const scaleX = containerRect.width > 0 ? containerRect.width / layoutWidth : 1;
        const scaleY = containerRect.height > 0 ? containerRect.height / layoutHeight : 1;
        const safeScaleX = Number.isFinite(scaleX) && scaleX > 0 ? scaleX : 1;
        const safeScaleY = Number.isFinite(scaleY) && scaleY > 0 ? scaleY : 1;
        const groups = new Map<string, HTMLElement[]>();

        container.querySelectorAll<HTMLElement>('[data-cover-text-id]').forEach((node) => {
            const groupId = node.dataset.coverTextGroupId;
            if (!groupId || !textGroupBackgroundStyles.has(groupId)) return;
            const groupNodes = groups.get(groupId) || [];
            groupNodes.push(node);
            groups.set(groupId, groupNodes);
        });

        const nextBackgrounds: TextGroupBackground[] = [];

        Array.from(groups.entries()).forEach(([groupId, nodes]) => {
            const style = textGroupBackgroundStyles.get(groupId);
            if (!style || nodes.length === 0) return;

            let minLeft = Number.POSITIVE_INFINITY;
            let minTop = Number.POSITIVE_INFINITY;
            let maxRight = Number.NEGATIVE_INFINITY;
            let maxBottom = Number.NEGATIVE_INFINITY;

            nodes.forEach((node) => {
                const rect = node.getBoundingClientRect();
                if (rect.width <= 0 && rect.height <= 0) return;

                const left = (rect.left - containerRect.left) / safeScaleX;
                const top = (rect.top - containerRect.top) / safeScaleY;
                const right = left + (rect.width / safeScaleX);
                const bottom = top + (rect.height / safeScaleY);

                minLeft = Math.min(minLeft, left);
                minTop = Math.min(minTop, top);
                maxRight = Math.max(maxRight, right);
                maxBottom = Math.max(maxBottom, bottom);
            });

            if (!Number.isFinite(minLeft) || !Number.isFinite(minTop) || !Number.isFinite(maxRight) || !Number.isFinite(maxBottom)) {
                return;
            }

            const padding = getCoverTextBackgroundPadding(style);
            const left = minLeft - padding.left;
            const top = minTop - padding.top;
            const width = Math.max(1, (maxRight - minLeft) + padding.left + padding.right);
            const height = Math.max(1, (maxBottom - minTop) + padding.top + padding.bottom);

            nextBackgrounds.push({ groupId, left, top, width, height, style });
        });

        nextBackgrounds.sort((a, b) => a.groupId.localeCompare(b.groupId));

        const serialize = (items: TextGroupBackground[]) => JSON.stringify(items.map(item => ({
            groupId: item.groupId,
            left: Math.round(item.left * 100) / 100,
            top: Math.round(item.top * 100) / 100,
            width: Math.round(item.width * 100) / 100,
            height: Math.round(item.height * 100) / 100,
            style: item.style,
        })));

        setTextGroupBackgrounds(prev => serialize(prev) === serialize(nextBackgrounds) ? prev : nextBackgrounds);
    }, [activeView, containerSize.height, containerSize.width, dragPositions, page.coverTexts, textGroupBackgroundStyles]);

    const handleUpdateTextPosition = (triggerId: string, newX: number, newY: number) => {
        // Here we update LOCAL state instead of calling onUpdatePage
        if (!page.coverTexts) return;

        // 1. Calculate Delta based on the Trigger Object
        // Important: Use the latest visual position from dragPositions if available, OR the original page position.
        // Wait, 'newX/newY' is the absolute position from the mouse event.
        // We need to compare it to the 'original' or 'last known' position to find delta.
        // Actually, we must compare against the STARTER position or current.
        // But 'page.coverTexts' is NOT updating during drag now. So we can compare against page.cover.

        const triggerText = page.coverTexts.find(t => t.id === triggerId);
        if (!triggerText) return;

        // Note: newX is where the mouse IS.
        // If we are dragging a GROUP, we need to move others by the same DELTA.
        // Delta = newX - triggerText.x

        const dx = newX - triggerText.x;
        const dy = newY - triggerText.y;

        const idsToMove = new Set<string>();
        if (activeTextIds.includes(triggerId)) {
            activeTextIds.forEach(id => idsToMove.add(id));
        } else {
            idsToMove.add(triggerId);
        }

        const newPositions: Record<string, { x: number, y: number }> = {};

        page.coverTexts.forEach(t => {
            if (idsToMove.has(t.id)) {
                newPositions[t.id] = {
                    x: t.x + dx,
                    y: t.y + dy
                };
            }
        });

        setDragPositions(newPositions);
    };

    const handleUpdateImagePosition = (triggerId: string, newX: number, newY: number) => {
        // Similar to text position logic but for images (simplified for now as no grouping for images yet)
        if (!page.coverImages) return;

        const triggerImage = page.coverImages.find(img => img.id === triggerId);
        if (!triggerImage) return;

        const dx = newX - triggerImage.x;
        const dy = newY - triggerImage.y;

        const idsToMove = new Set<string>();
        // If we support multi-select for images later:
        if (activeImageIds.includes(triggerId)) {
            activeImageIds.forEach(id => idsToMove.add(id));
        } else {
            idsToMove.add(triggerId);
        }

        const newPositions: Record<string, { x: number, y: number }> = {};

        // We can reuse dragPositions for images too if keys are unique (UUIDs usually are)
        // Or create separate state if needed. Reusing for simplicity.

        page.coverImages.forEach(img => {
            if (idsToMove.has(img.id)) {
                newPositions[img.id] = {
                    x: img.x + dx,
                    y: img.y + dy
                };
            }
        });

        // Merge with existing drag positions to not lose text drags if happening concurrently (unlikely)
        setDragPositions(prev => ({ ...prev, ...newPositions }));
    };

    const handleUpdateImageSize = (triggerId: string, newWidth: number, newHeight: number | undefined) => {
        commitPageUpdate((currentPage) => {
            const newImages = (currentPage.coverImages || []).map(img =>
                img.id === triggerId ? { ...img, width: newWidth, height: newHeight } : img
            );

            return { ...currentPage, coverImages: newImages };
        });
    };

    const handleUpdateImagePanAndZoom = (panAndZoom: PhotoPanAndZoom) => {
        // This is tricky. Which image?
        // PhotoRenderer calls back with panAndZoom.
        // We need to know the ID.
        // We can wrap this in an arrow function in the map loop.
    };

    const handleDragEnd = () => {
        // Commit changes to actual page state
        if (Object.keys(dragPositions).length === 0) return;
        commitPageUpdate((currentPage) => {
            const newTexts = (currentPage.coverTexts || []).map(t => {
                if (dragPositions[t.id]) {
                    return { ...t, ...dragPositions[t.id] };
                }
                return t;
            });

            const newImages = (currentPage.coverImages || []).map(img => {
                if (dragPositions[img.id]) {
                    return { ...img, ...dragPositions[img.id] };
                }
                return img;
            });

            return { ...currentPage, coverTexts: newTexts, coverImages: newImages };
        });
        setDragPositions({});
    };

    // View State
    const isFull = activeView === 'full';
    const isFront = activeView === 'front';
    const isBack = activeView === 'back';
    const isRtlPreviewCover = mode === 'preview'
        && page.isCover
        && (config?.bookOpeningDirection ?? 'ltr') === 'rtl';
    const backLayoutId = page.isCover
        ? (page.coverLayouts?.back || defaultCoverTemplate?.id || '')
        : (page.spreadLayouts?.left || defaultGridTemplate?.id || '');

    const frontLayoutId = page.isCover
        ? (page.coverLayouts?.front || defaultCoverTemplate?.id || '')
        : (page.spreadLayouts?.right || defaultGridTemplate?.id || '');

    // Parse layout IDs
    const { baseId: backBaseId } = parseLayoutId(backLayoutId);
    const { baseId: frontBaseId } = parseLayoutId(frontLayoutId);

    const mergeTemplateLists = (primary: AdvancedTemplate[], extras: AdvancedTemplate[]) => {
        const map = new Map<string, AdvancedTemplate>();
        [...primary, ...extras].forEach((template) => {
            map.set(String(template.id), template);
        });
        return Array.from(map.values());
    };

    const coverTemplateSource = mergeTemplateLists([...coverTemplates, ...advancedTemplates], extraTemplates);
    const pageTemplateSource = mergeTemplateLists([...gridTemplates, ...advancedTemplates], extraTemplates);
    const templateSource = page.isCover ? coverTemplateSource : pageTemplateSource;

    // Dynamic layouts on cover MUST always be full spread
    // This allows robust handling even if coverType update lags slightly
    const isDynamicLayout = String(backBaseId).startsWith('dynamic-justified') || String(frontBaseId).startsWith('dynamic-justified');
    const isFullSpread = page.isCover
        ? (page.coverType === 'full' || isDynamicLayout)
        : (page.spreadMode !== 'split' || isDynamicLayout);

    const backTemplate = templateSource.find(t => String(t.id) === String(backBaseId)) || templateSource[0] || defaultCoverTemplate || defaultGridTemplate;
    const frontTemplate = templateSource.find(t => String(t.id) === String(frontBaseId)) || templateSource[0] || defaultCoverTemplate || defaultGridTemplate;

    // Check if backTemplate is undefined properly? No, default to [0] fixes it.

    // FIX: For dynamic layouts, we want ALL photos, not just the template count
    const isDynamicBack = String(backBaseId).startsWith('dynamic-justified');
    logger.debug('[AlbumCover] DEBUG:', {
        backLayoutId,
        backBaseId,
        isDynamicBack,
        'page.photos.length': page.photos?.length,
        'page.spreadLayouts': page.spreadLayouts
    });
    const backPhotoCount = isDynamicBack
        ? (page.photos?.length || 0)
        : (backTemplate ? getPhotoCount(backTemplate) : 0);

    // Front photo count logic usually for split pages.
    // If full spread dynamic, frontPhotoCount doesn't matter much if we use backLayout for full.
    const isDynamicFront = String(frontBaseId).startsWith('dynamic-justified');
    const frontPhotoCount = isDynamicFront
        ? (page.photos?.length || 0)
        : (frontTemplate ? getPhotoCount(frontTemplate) : 0);

    // Photos - Validation: Ensure photos exist
    const safePhotos = page.photos || [];
    // If full spread dynamic, we pass ALL photos to the single layout instance.
    const backPhotos = isDynamicBack ? safePhotos : safePhotos.slice(0, backPhotoCount);
    const frontPhotos = isDynamicFront ? safePhotos : safePhotos.slice(backPhotoCount);
    const resolveGalleryPhotoId = useMemo(() => createGalleryPhotoReferenceResolver(allPhotos), [allPhotos]);


    // Helper to update specific image pan/zoom
    const updateCoverImagePanAndZoom = (imgId: string, panAndZoom: PhotoPanAndZoom) => {
        commitPageUpdate((currentPage) => {
            const newImages = (currentPage.coverImages || []).map(img =>
                img.id === imgId ? { ...img, panAndZoom } : img
            );
            return { ...currentPage, coverImages: newImages };
        });
    };

    const updateCoverImageRotation = (imgId: string, rotation: number) => {
        commitPageUpdate((currentPage) => {
            const newImages = (currentPage.coverImages || []).map((img) => (
                img.id === imgId ? { ...img, rotation } : img
            ));
            return { ...currentPage, coverImages: newImages };
        });
    };

    const replaceCoverImageByGalleryPhoto = (imgId: string, droppedPhotoId: string) => {
        const droppedPhoto = allPhotos.find((photo) => photo.id === droppedPhotoId);
        if (!droppedPhoto) return;

        const sourceUrl = droppedPhoto.remoteUrl || droppedPhoto.src;
        if (!sourceUrl) return;

        const resolvedAspectRatio = (droppedPhoto.width && droppedPhoto.height && droppedPhoto.width > 0 && droppedPhoto.height > 0)
            ? (droppedPhoto.width / droppedPhoto.height)
            : undefined;

        commitPageUpdate((currentPage) => {
            const newImages = (currentPage.coverImages || []).map((img) => {
                if (img.id !== imgId) return img;

                return {
                    ...img,
                    url: sourceUrl,
                    originalId: droppedPhoto.id,
                    storagePath: droppedPhoto.storagePath || extractSupabaseStoragePath(sourceUrl) || img.storagePath,
                    aspectRatio: resolvedAspectRatio && resolvedAspectRatio > 0 ? resolvedAspectRatio : img.aspectRatio,
                    panAndZoom: { scale: 1, x: 50, y: 50 }
                };
            });

            return { ...currentPage, coverImages: newImages };
        });
    };

    const removeCoverImage = useCallback((imgId: string) => {
        commitPageUpdate((currentPage) => ({
            ...currentPage,
            coverImages: (currentPage.coverImages || []).filter((img) => img.id !== imgId)
        }));
    }, [commitPageUpdate]);

    const getDynamicImageSuggestions = useCallback((imageId: string): Photo[] => {
        if (allPhotos.length === 0) return [];

        const activeTarget = (page.coverImages || []).find((img) => img.id === imageId);
        const targetGalleryPhotoId = activeTarget ? resolveGalleryPhotoId(activeTarget) : null;
        const usedGalleryPhotoIds = new Set<string>();

        safePhotos.forEach((photo) => {
            const galleryPhotoId = resolveGalleryPhotoId(photo);
            if (galleryPhotoId) usedGalleryPhotoIds.add(galleryPhotoId);
        });

        (page.coverImages || []).forEach((image) => {
            const galleryPhotoId = resolveGalleryPhotoId(image);
            if (galleryPhotoId) usedGalleryPhotoIds.add(galleryPhotoId);
        });

        if (targetGalleryPhotoId) {
            usedGalleryPhotoIds.delete(targetGalleryPhotoId);
        }

        const currentPageReferences = [
            ...safePhotos.filter((photo) => (photo.remoteUrl || photo.src || '').trim().length > 0),
            ...(page.coverImages || []).filter((image) => (image.url || '').trim().length > 0)
        ];
        const referenceItems = currentPageReferences.length > 0
            ? currentPageReferences
            : previousPagePhotos.filter((photo) => (photo.remoteUrl || photo.src || '').trim().length > 0);

        if (referenceItems.length === 0) {
            return allPhotos.filter((photo) => !usedGalleryPhotoIds.has(photo.id)).slice(0, 8);
        }

        let highestIndex = -1;
        referenceItems.forEach((reference) => {
            const galleryPhotoId = resolveGalleryPhotoId(reference);
            if (!galleryPhotoId) return;

            const index = allPhotos.findIndex((photo) => photo.id === galleryPhotoId);
            if (index > highestIndex) {
                highestIndex = index;
            }
        });

        if (highestIndex < 0) {
            return allPhotos.filter((photo) => !usedGalleryPhotoIds.has(photo.id)).slice(0, 8);
        }

        const afterPhotos: Photo[] = [];
        const beforePhotos: Photo[] = [];

        for (let i = 1; i <= 4 && highestIndex + i < allPhotos.length; i++) {
            const candidate = allPhotos[highestIndex + i];
            if (!usedGalleryPhotoIds.has(candidate.id)) {
                afterPhotos.push(candidate);
            }
        }

        for (let i = 1; i <= 4 && highestIndex - i >= 0; i++) {
            const candidate = allPhotos[highestIndex - i];
            if (!usedGalleryPhotoIds.has(candidate.id)) {
                beforePhotos.unshift(candidate);
            }
        }

        return [...afterPhotos, ...beforePhotos].slice(0, 8);
    }, [allPhotos, page.coverImages, previousPagePhotos, resolveGalleryPhotoId, safePhotos]);

    const dynamicContextImage = dynamicContextMenu
        ? (page.coverImages || []).find((image) => image.id === dynamicContextMenu.imageId) || null
        : null;
    const dynamicContextGalleryPhotoId = dynamicContextImage ? resolveGalleryPhotoId(dynamicContextImage) : null;
    const dynamicContextPhotoNumber = dynamicContextGalleryPhotoId
        ? chronologicalIndex?.[dynamicContextGalleryPhotoId]
        : undefined;
    const dynamicImageSuggestions = useMemo(() => {
        if (!dynamicContextMenu) return [];
        return getDynamicImageSuggestions(dynamicContextMenu.imageId);
    }, [dynamicContextMenu, getDynamicImageSuggestions]);

    const openDynamicContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>, image: CoverImage) => {
        if (mode !== 'editor') return;

        e.preventDefault();
        e.stopPropagation();

        onSelectImage?.([image.id], false);

        const target = e.currentTarget as HTMLElement;
        const domRect = target.getBoundingClientRect();
        const anchorRect = {
            top: domRect.top,
            left: domRect.left,
            width: domRect.width,
            height: domRect.height,
            bottom: domRect.bottom,
            right: domRect.right,
            x: domRect.x,
            y: domRect.y
        } as DOMRect;

        setDynamicSuggestionAnchor(null);
        setDynamicContextMenu({
            x: e.clientX,
            y: e.clientY,
            imageId: image.id,
            anchorRect
        });
    }, [mode, onSelectImage]);

    const hasDynamicReplaceAction = dynamicImageSuggestions.length > 0;
    const hasDynamicFlipAction = !!dynamicContextImage?.url;
    const hasDynamicEnhanceAction = !!(dynamicContextImage?.url && onEnhancePhotoWithAi);
    const hasDynamicRemoveAction = !!dynamicContextImage?.url;
    const hasDynamicGalleryJump = dynamicContextPhotoNumber !== undefined && !!scrollToGallery;
    const hasDynamicContextActions = hasDynamicReplaceAction
        || hasDynamicFlipAction
        || hasDynamicEnhanceAction
        || hasDynamicRemoveAction
        || hasDynamicGalleryJump;

    // Derived Styles
    const pageMargin = page.pageMargin ?? config?.pageMargin ?? 0;
    const normalizedPageMargin = Number(pageMargin);
    const safePageMargin = Number.isFinite(normalizedPageMargin) ? Math.max(0, normalizedPageMargin) : 0;
    const pageMarginStyle = safePageMargin > 0 ? { padding: `${safePageMargin}px` } : undefined;
    // Assuming config.photoGap is number. If string, parse it.
    const photoGap = page.photoGap ?? config?.photoGap ?? 0;
    // Dynamic image overlays follow the system-level PHOTO GAP first.
    const dynamicPhotoGapSource = config?.photoGap ?? page.photoGap ?? photoGap ?? 0;
    const normalizedPhotoGap = Number(dynamicPhotoGapSource);
    const dynamicFrameGap = Number.isFinite(normalizedPhotoGap) ? Math.max(0, normalizedPhotoGap) : 0;
    const dynamicFrameGapColor = '#ffffff';
    const configCornerRadiusRaw = Number(config?.cornerRadius);
    const configCornerRadius = Number.isFinite(configCornerRadiusRaw) ? Math.max(0, configCornerRadiusRaw) : 0;
    const pageCornerRadiusRaw = Number(page.cornerRadius);
    const hasPageCornerRadius = Number.isFinite(pageCornerRadiusRaw);
    const cornerRadius = (preferPageCornerRadius && hasPageCornerRadius)
        ? Math.max(0, pageCornerRadiusRaw)
        : configCornerRadius;
    const spineWidth = page.spineWidth !== undefined ? page.spineWidth : 40;

    // --- Spine-aware Coordinate Calculations ---
    // For full view with spine, calculate the actual percentage boundaries
    // Full width = (singlePage * 2) + spine
    // Back ends at: singlePage / fullWidth
    // Front starts at: (singlePage + spine) / fullWidth
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
    const singlePageW = configW * pxPerUnit;
    const fullWidth = (singlePageW * 2) + spineWidth;
    const backEndPercent = (singlePageW / fullWidth) * 100; // Where back cover ends
    const frontStartPercent = ((singlePageW + spineWidth) / fullWidth) * 100; // Where front cover starts
    const frontPageStartPercent = isRtlPreviewCover ? 0 : frontStartPercent;
    const frontPageEndPercent = isRtlPreviewCover ? backEndPercent : 100;
    const backPageStartPercent = isRtlPreviewCover ? frontStartPercent : 0;
    const backPageEndPercent = isRtlPreviewCover ? 100 : backEndPercent;
    const frontPageRange = Math.max(0.0001, frontPageEndPercent - frontPageStartPercent);
    const backPageRange = Math.max(0.0001, backPageEndPercent - backPageStartPercent);
    const showSecondHalfInSinglePagePreview = isFront ? !isRtlPreviewCover : (isBack ? isRtlPreviewCover : false);

    const mapGlobalXToLocalPage = (globalX: number, pageSide: 'front' | 'back') => {
        if (pageSide === 'front') {
            return {
                localX: ((globalX - frontPageStartPercent) / frontPageRange) * 100,
                isVisible: globalX >= frontPageStartPercent && globalX <= frontPageEndPercent,
            };
        }

        return {
            localX: ((globalX - backPageStartPercent) / backPageRange) * 100,
            isVisible: globalX >= backPageStartPercent && globalX <= backPageEndPercent,
        };
    };

    const mapLocalXToGlobalPage = (localX: number, pageSide: 'front' | 'back') => {
        if (pageSide === 'front') {
            return frontPageStartPercent + ((localX / 100) * frontPageRange);
        }

        return backPageStartPercent + ((localX / 100) * backPageRange);
    };

    const mapGlobalWidthToLocalPage = (globalWidth: number, pageSide: 'front' | 'back') => {
        if (pageSide === 'front') {
            return (globalWidth / frontPageRange) * 100;
        }

        return (globalWidth / backPageRange) * 100;
    };

    const mapLocalWidthToGlobalPage = (localWidth: number, pageSide: 'front' | 'back') => {
        if (pageSide === 'front') {
            return (localWidth / 100) * frontPageRange;
        }

        return (localWidth / 100) * backPageRange;
    };

    // Calculate aspect ratio for smart layout
    const singlePageRatio = configW / configH;
    const spreadRatioWithSpine = ((singlePageW * 2) + spineWidth) / BASE_PAGE_PX;
    const spreadRatioWithoutSpine = (singlePageW * 2) / BASE_PAGE_PX;
    const fullLayoutRatio = page.isCover ? spreadRatioWithSpine : spreadRatioWithoutSpine;

    const measuredRootRatio = (containerSize.width > 0 && containerSize.height > 0)
        ? (containerSize.width / containerSize.height)
        : null;
    const overlayContainerAspectRatio = measuredRootRatio ?? fullLayoutRatio;

    const measuredFullSpreadRatio = measuredRootRatio
        ? (isFull ? measuredRootRatio : measuredRootRatio * 2)
        : fullLayoutRatio;

    const measuredSinglePageRatio = (() => {
        if (!measuredRootRatio || containerSize.height <= 0) {
            return singlePageRatio;
        }

        if (!isFullSpread && isFull) {
            const totalWidth = containerSize.width;
            const pageWidth = page.isCover
                ? Math.max(1, (totalWidth - spineWidth) / 2)
                : (totalWidth / 2);
            return pageWidth / containerSize.height;
        }

        return measuredRootRatio;
    })();

    const getBalancedAspectRatio = (targetRatio: number): number => {
        if (safePageMargin <= 0) return targetRatio;

        const logicalHeight = BASE_PAGE_PX;
        const logicalWidth = targetRatio * logicalHeight;
        const innerWidth = Math.max(1, logicalWidth - (safePageMargin * 2));
        const innerHeight = Math.max(1, logicalHeight - (safePageMargin * 2));
        const innerRatio = innerWidth / innerHeight;

        if (!Number.isFinite(innerRatio) || innerRatio <= 0) {
            return targetRatio;
        }

        const marginProgress = Math.min(1, safePageMargin / 80);
        const maxExtraFactor = 0.15 + (0.45 * marginProgress);
        const maxExtra = safePageMargin * maxExtraFactor;

        if (innerRatio > targetRatio) {
            const idealExtraX = (innerWidth - (targetRatio * innerHeight)) / 2;
            const allowedExtraX = Math.max(0, Math.min(idealExtraX, maxExtra));
            const adjustedWidth = innerWidth - (allowedExtraX * 2);
            return Math.max(0.01, adjustedWidth / innerHeight);
        }

        if (innerRatio < targetRatio) {
            const idealExtraY = (innerHeight - (innerWidth / targetRatio)) / 2;
            const allowedExtraY = Math.max(0, Math.min(idealExtraY, maxExtra));
            const adjustedHeight = innerHeight - (allowedExtraY * 2);
            return Math.max(0.01, innerWidth / Math.max(1, adjustedHeight));
        }

        return targetRatio;
    };

    const renderLayoutInPage = (
        layoutNode: React.ReactNode,
        ratio: number,
        containerClassName = 'absolute inset-0'
    ) => {
        if (safePageMargin <= 0) {
            return (
                <div className={containerClassName}>
                    {layoutNode}
                </div>
            );
        }

        const balancedRatio = getBalancedAspectRatio(ratio);

        return (
            <div className={containerClassName} style={pageMarginStyle}>
                <div className="h-full w-full flex items-center justify-center">
                    <div
                        className="relative"
                        style={{
                            aspectRatio: balancedRatio,
                            height: '100%',
                            width: 'auto',
                            maxWidth: '100%',
                            maxHeight: '100%'
                        }}
                    >
                        {layoutNode}
                    </div>
                </div>
            </div>
        );
    };


    // --- Render Content Helper ---
    const renderContent = () => (
        <>
            {isFullSpread ? (
                /* FULL COVER MODE (Spread) */
                <div
                    className="relative h-full bg-background overflow-hidden flex"
                    style={{
                        width: isFull ? '100%' : '200%',
                        transform: showSecondHalfInSinglePagePreview ? 'translateX(-50%)' : 'none',
                        backgroundColor: page.backgroundColor || config?.backgroundColor || (safePageMargin > 0 ? '#fff' : 'transparent'),
                        backgroundImage: (page.backgroundImage || config?.backgroundImage) ? `url(${page.backgroundImage || config?.backgroundImage})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                    }}
                >
                    {/* Spine Visual Guide (Overlay) */}
                    {page.isCover && (
                        <div
                            className={cn(
                                "absolute top-0 bottom-0 left-1/2 z-10 pointer-events-none flex flex-col items-center overflow-hidden",
                                spineWidth > 0 ? "" : "hidden"
                            )}
                            style={{
                                marginLeft: `-${spineWidth / 2}px`,
                                width: `${spineWidth}px`,
                            }}
                        >
                            <Spine
                                text={page.spineText}
                                width={spineWidth}
                                color={page.spineColor}
                                opacity={page.spineOpacity}
                                textColor={page.spineTextColor}
                                fontSize={page.spineFontSize}
                                fontFamily={page.spineFontFamily}
                                fontWeight={page.spineFontWeight}
                                fontStyle={page.spineFontStyle}
                                textAlign={page.spineTextAlign}
                                rotated={page.spineTextRotated}
                                styleOverride={{ height: '100%', width: '100%', border: 'none' }}
                            />
                        </div>
                    )}

                    {/* Spread Content */}
                    {renderLayoutInPage(
                        <PageLayout
                            page={page}
                            photoGap={photoGap}
                            overridePhotos={page.photos}
                            overrideLayout={String(page.layout || (page.isCover ? defaultCoverTemplate.id : defaultGridTemplate.id))}
                            templateSource={templateSource as any}
                            onUpdatePhotoPanAndZoom={onUpdatePhotoPanAndZoom || (() => { })}
                            onInteractionChange={onInteractionChange || (() => { })}
                            onDropPhoto={onDropPhoto || (() => { })}
                            useSimpleImage={useSimpleImage}
                            photoIndexOffset={0}
                            onRemovePhoto={onRemovePhoto}
                            onEnhancePhotoWithAi={onEnhancePhotoWithAi}
                            cornerRadius={cornerRadius}
                            backgroundColor={config?.backgroundColor}
                            backgroundImage={page.backgroundImage || config?.backgroundImage}
                            allPhotos={allPhotos}
                            previousPagePhotos={previousPagePhotos}
                            priority={priority}
                            chronologicalIndex={chronologicalIndex}
                            aspectRatio={measuredFullSpreadRatio}
                            disableFrameDrop={disableFrameDrop}
                        />,
                        measuredFullSpreadRatio,
                        'absolute inset-0 z-0'
                    )}
                </div>
            ) : (
                /* SPLIT COVER MODE */
                <div className="relative w-full h-full flex">
                    {/* Left / Back Page */}
                    <div
                        className={cn(
                            "relative h-full bg-background overflow-hidden",
                            isFull ? "flex-1" : isBack ? "w-full" : "hidden"
                        )}
                        style={{
                            backgroundColor: page.backgroundColor || config?.backgroundColor || (safePageMargin > 0 ? '#fff' : 'transparent'),
                            backgroundImage: (page.backgroundImage || config?.backgroundImage) ? `url(${page.backgroundImage || config?.backgroundImage})` : undefined,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                        }}
                    >
                        {renderLayoutInPage(
                            <PageLayout
                                page={page}
                                photoGap={photoGap}
                                // Use backPhotos (first chunk) for Back Cover OR Left Page
                                overridePhotos={backPhotos}
                                // Use Left Layout for regular pages, Back Layout for covers
                                overrideLayout={String(page.isCover ? backLayoutId : (page.spreadLayouts?.left || defaultGridTemplate.id))}
                                templateSource={templateSource as any}
                                onUpdatePhotoPanAndZoom={onUpdatePhotoPanAndZoom || (() => { })}
                                onInteractionChange={onInteractionChange || (() => { })}
                                onDropPhoto={onDropPhoto || (() => { })}
                                useSimpleImage={useSimpleImage}
                                photoIndexOffset={0}
                                onRemovePhoto={onRemovePhoto}
                                onEnhancePhotoWithAi={onEnhancePhotoWithAi}
                                cornerRadius={cornerRadius}
                                backgroundColor={config?.backgroundColor}
                                backgroundImage={page.backgroundImage || config?.backgroundImage}
                                allPhotos={allPhotos}
                                previousPagePhotos={previousPagePhotos}
                                priority={priority}
                                chronologicalIndex={chronologicalIndex}
                                aspectRatio={measuredSinglePageRatio}
                                disableFrameDrop={disableFrameDrop}
                            />,
                            measuredSinglePageRatio
                        )}
                    </div>

                    {/* Spine (Only for Covers) */}
                    {page.isCover && (
                        <div
                            className={cn(
                                "relative h-full flex z-10 shrink-0",
                                isFull ? "flex" : "hidden"
                            )}
                            style={{ width: `${spineWidth}px` }}
                        >
                            <Spine
                                text={page.spineText}
                                width={spineWidth}
                                color={page.spineColor}
                                opacity={page.spineOpacity}
                                textColor={page.spineTextColor}
                                fontSize={page.spineFontSize}
                                fontFamily={page.spineFontFamily}
                                fontWeight={page.spineFontWeight}
                                fontStyle={page.spineFontStyle}
                                textAlign={page.spineTextAlign}
                                rotated={page.spineTextRotated}
                                styleOverride={{ width: '100%' }}
                            />
                        </div>
                    )}

                    {/* Right / Front Page */}
                    <div
                        className={cn(
                            "relative h-full bg-background overflow-hidden",
                            isFull ? "flex-1" : isFront ? "w-full" : "hidden"
                        )}
                        style={{
                            backgroundColor: page.backgroundColor || config?.backgroundColor || (safePageMargin > 0 ? '#fff' : 'transparent'),
                            backgroundImage: (page.backgroundImage || config?.backgroundImage) ? `url(${page.backgroundImage || config?.backgroundImage})` : undefined,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                        }}
                    >
                        {renderLayoutInPage(
                            <PageLayout
                                page={page}
                                photoGap={photoGap}
                                // Use frontPhotos (second chunk) for Front Cover OR Right Page
                                overridePhotos={frontPhotos}
                                // Use Right Layout for regular pages, Front Layout for covers
                                overrideLayout={String(page.isCover ? frontLayoutId : (page.spreadLayouts?.right || defaultGridTemplate.id))}
                                templateSource={templateSource as any}
                                onUpdatePhotoPanAndZoom={onUpdatePhotoPanAndZoom || (() => { })}
                                onInteractionChange={onInteractionChange || (() => { })}
                                onDropPhoto={onDropPhoto || (() => { })}
                                useSimpleImage={useSimpleImage}
                                photoIndexOffset={backPhotoCount}
                                onRemovePhoto={onRemovePhoto}
                                onEnhancePhotoWithAi={onEnhancePhotoWithAi}
                                cornerRadius={cornerRadius}
                                backgroundColor={config?.backgroundColor}
                                backgroundImage={page.backgroundImage || config?.backgroundImage}
                                allPhotos={allPhotos}
                                previousPagePhotos={previousPagePhotos}
                                priority={priority}
                                chronologicalIndex={chronologicalIndex}
                                aspectRatio={measuredSinglePageRatio}
                                disableFrameDrop={disableFrameDrop}
                            />,
                            measuredSinglePageRatio
                        )}
                    </div>
                </div>
            )}
            {/* Text Overlay */}
            {renderTextGroupBackgroundOverlay()}
            {renderTextOverlay()}
            {/* Image Overlay */}
            {renderImageOverlay()}
        </>
    );

    const renderTextGroupBackgroundOverlay = () => {
        if (textGroupBackgrounds.length === 0) return null;

        return textGroupBackgrounds.map((background) => {
            const isSelected = mode === 'editor'
                && (page.coverTexts || []).some((textItem) =>
                    textItem.groupId === background.groupId && activeTextIds.includes(textItem.id)
                );

            return (
                <div
                    key={`text-group-background-${background.groupId}`}
                    className={cn(
                        "absolute pointer-events-none select-none box-border",
                        isSelected ? "border-2 border-dashed border-primary" : "border-2 border-transparent"
                    )}
                    style={{
                        left: `${background.left}px`,
                        top: `${background.top}px`,
                        width: `${background.width}px`,
                        height: `${background.height}px`,
                        zIndex: isSelected ? 49 : 39,
                        ...getCoverTextBackgroundVisualStyle(background.style),
                    }}
                    data-cover-text-group-background-id={background.groupId}
                />
            );
        });
    };

    // 1. Text Overlay Renderer
    const renderTextOverlay = () => {
        if (!page.coverTexts) return null;

        return page.coverTexts.map(textItem => {
            // Apply Drag Override if exists
            const currentX = dragPositions[textItem.id]?.x ?? textItem.x;
            const currentY = dragPositions[textItem.id]?.y ?? textItem.y;

            // Coordinate Transformation logic
            let localX = currentX;
            let localY = currentY;
            let isVisible = true;

            if (isFront) { // Viewing only Front
                const mappedFront = mapGlobalXToLocalPage(currentX, 'front');
                localX = mappedFront.localX;
                isVisible = mappedFront.isVisible;
            } else if (isBack) { // Viewing only Back
                const mappedBack = mapGlobalXToLocalPage(currentX, 'back');
                localX = mappedBack.localX;
                isVisible = mappedBack.isVisible;
            }

            if (!isVisible) return null;

            // Font Scaling (Responsive cqw)
            // 'cqw' requires the container to have 'container-type: inline-size'.
            const referenceWidth = isFull ? 3200 : 1600;
            const normalizedFontSize = Number(textItem.style.fontSize) || 24;
            // CSS unit values cannot contain whitespace between number and unit (e.g. "2cqw", not "2 cqw").
            const fontSizeCss = `${(normalizedFontSize / referenceWidth) * 100}cqw`;

            const isSelected = activeTextIds.includes(textItem.id);
            const useSharedGroupBackground = !!textItem.groupId && textGroupBackgroundStyles.has(textItem.groupId);

            if (mode === 'editor' && onSelectText) {
                return (
                    <DraggableCoverText
                        key={textItem.id}
                        item={{ ...textItem, x: localX, y: localY }}
                        isSelected={isSelected}
                        onSelect={(e) => {
                            // Group Selection Logic
                            let targets = [textItem.id];
                            if (textItem.groupId) {
                                const groupIds = page.coverTexts?.filter(t => t.groupId === textItem.groupId).map(t => t.id) || [];
                                if (groupIds.length > 0) targets = groupIds;
                            }

                            onSelectText(targets, e.ctrlKey || e.metaKey);
                        }}
                        onUpdatePosition={(x, y) => {
                            // Transform back to Global
                            let globalX = x;
                            let globalY = y;
                            if (isFront) {
                                globalX = mapLocalXToGlobalPage(x, 'front');
                            } else if (isBack) {
                                globalX = mapLocalXToGlobalPage(x, 'back');
                            }

                            handleUpdateTextPosition(textItem.id, globalX, globalY);
                        }}
                        onDragEnd={handleDragEnd}
                        containerRef={containerRef}
                        fontSizeOverride={fontSizeCss}
                        includeBackground={!useSharedGroupBackground}
                        showSelectionFrame={!useSharedGroupBackground}
                    />
                );
            } else {
                return (
                    <StaticCoverText
                        key={textItem.id}
                        item={{ ...textItem, x: localX, y: localY }}
                        fontSizeOverride={fontSizeCss}
                        includeBackground={!useSharedGroupBackground}
                    />
                );
            }
        });
    };


    // 2. Image Overlay Renderer
    const renderImageOverlay = () => {
        if (!page.coverImages) return null;

        return page.coverImages.map(imgItem => {
            const currentX = dragPositions[imgItem.id]?.x ?? imgItem.x;
            const currentY = dragPositions[imgItem.id]?.y ?? imgItem.y;

            let localX = currentX;
            let localY = currentY;
            let localWidth = imgItem.width;
            let isVisible = true;

            if (isFront) {
                const mappedFront = mapGlobalXToLocalPage(currentX, 'front');
                localX = mappedFront.localX;
                localWidth = mapGlobalWidthToLocalPage(imgItem.width, 'front');
                isVisible = mappedFront.isVisible;
            } else if (isBack) {
                const mappedBack = mapGlobalXToLocalPage(currentX, 'back');
                localX = mappedBack.localX;
                localWidth = mapGlobalWidthToLocalPage(imgItem.width, 'back');
                isVisible = mappedBack.isVisible;
            }

            if (!isVisible) return null;

            const isSelected = activeImageIds?.includes(imgItem.id) ?? false;
            const isLead = (activeImageIds?.length ?? 0) > 1 && activeImageIds?.[0] === imgItem.id;

            if (mode === 'editor' && onSelectImage) {
                return (
                    <DraggableCoverImage
                        key={imgItem.id}
                        item={{ ...imgItem, x: localX, y: localY, width: localWidth }}
                        isSelected={isSelected}
                        isLead={isLead}
                        onSelect={(e) => {
                            onSelectImage([imgItem.id], e.ctrlKey || e.metaKey || e.shiftKey);
                        }}
                        onUpdatePosition={(x, y) => {
                            let globalX = x;
                            let globalY = y;
                            if (isFront) {
                                globalX = mapLocalXToGlobalPage(x, 'front');
                            } else if (isBack) {
                                globalX = mapLocalXToGlobalPage(x, 'back');
                            }
                            handleUpdateImagePosition(imgItem.id, globalX, globalY);
                        }}
                        onUpdateSize={(w, h) => {
                            // w, h are Local Percentages. Convert to Global.
                            let globalWidth = w;
                            let globalHeight = h;

                            if (isFront) {
                                globalWidth = mapLocalWidthToGlobalPage(w, 'front');
                                globalHeight = h;
                            } else if (isBack) {
                                globalWidth = mapLocalWidthToGlobalPage(w, 'back');
                                globalHeight = h;
                            }

                            handleUpdateImageSize(imgItem.id, globalWidth, globalHeight);
                        }}
                        onUpdateRotation={(rotation) => updateCoverImageRotation(imgItem.id, rotation)}
                        onUpdatePanAndZoom={(mz) => updateCoverImagePanAndZoom(imgItem.id, mz)}
                        onDragEnd={handleDragEnd}
                        containerRef={containerRef}
                        onOpenContextMenu={openDynamicContextMenu}
                        pageId={page.id}
                        photoId={imgItem.id}
                        onSwapDrop={handleDynamicSwapDrop}
                        onReplaceByPhotoId={(droppedPhotoId) => replaceCoverImageByGalleryPhoto(imgItem.id, droppedPhotoId)}
                        lockAspectRatio={lockOverlayImageAspectRatio}
                        frameGap={dynamicFrameGap}
                        frameGapColor={dynamicFrameGapColor}
                        containerAspectRatio={overlayContainerAspectRatio}
                    />
                );
            } else {
                const allowPanAsTemplateFrame = mode === 'editor' && !dynamicMode;
                return (
                    <StaticCoverImage
                        key={imgItem.id}
                        item={{ ...imgItem, x: localX, y: localY, width: localWidth }}
                        frameGap={dynamicFrameGap}
                        frameGapColor={dynamicFrameGapColor}
                        interactive={allowPanAsTemplateFrame}
                        onUpdatePanAndZoom={allowPanAsTemplateFrame ? (mz) => updateCoverImagePanAndZoom(imgItem.id, mz) : undefined}
                        onReplaceByPhotoId={allowPanAsTemplateFrame ? (droppedPhotoId) => replaceCoverImageByGalleryPhoto(imgItem.id, droppedPhotoId) : undefined}
                        onOpenContextMenu={mode === 'editor' ? openDynamicContextMenu : undefined}
                        pageId={page.id}
                        photoId={imgItem.id}
                        onSwapDrop={handleDynamicSwapDrop}
                        containerAspectRatio={overlayContainerAspectRatio}
                    />
                );
            }
        });
    };

    const handleSelectDynamicSuggestion = useCallback((photo: Photo) => {
        if (!dynamicSuggestionAnchor) return;
        replaceCoverImageByGalleryPhoto(dynamicSuggestionAnchor.imageId, photo.id);
        setDynamicSuggestionAnchor(null);
    }, [dynamicSuggestionAnchor, replaceCoverImageByGalleryPhoto]);

    const dynamicContextActionCount = (hasDynamicReplaceAction ? 1 : 0)
        + (hasDynamicFlipAction ? 1 : 0)
        + (hasDynamicEnhanceAction ? 1 : 0)
        + (hasDynamicRemoveAction ? 1 : 0)
        + (hasDynamicGalleryJump ? 1 : 0);
    const dynamicMenuWidth = 200;
    const dynamicMenuHeight = 12 + (dynamicContextActionCount * 34);
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;
    const dynamicMenuLeft = dynamicContextMenu
        ? Math.max(8, Math.min(dynamicContextMenu.x, viewportWidth - dynamicMenuWidth - 8))
        : 8;
    const dynamicMenuTop = dynamicContextMenu
        ? Math.max(8, Math.min(dynamicContextMenu.y, viewportHeight - dynamicMenuHeight - 8))
        : 8;

    const dynamicContextMenuOverlay = dynamicContextMenu
        && dynamicContextImage
        && hasDynamicContextActions
        && typeof document !== 'undefined'
        ? createPortal(
            <div
                className="fixed inset-0 z-[500]"
                onMouseDown={closeDynamicContextMenu}
                onContextMenu={(e) => {
                    e.preventDefault();
                    closeDynamicContextMenu();
                }}
            >
                <div
                    className="absolute w-[200px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                    style={{ left: `${dynamicMenuLeft}px`, top: `${dynamicMenuTop}px` }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onContextMenu={(e) => e.preventDefault()}
                >
                    {hasDynamicReplaceAction && (
                        <button
                            type="button"
                            className="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-sm leading-5 hover:bg-accent hover:text-accent-foreground"
                            onClick={() => {
                                if (dynamicContextMenu.anchorRect) {
                                    setDynamicSuggestionAnchor({
                                        rect: dynamicContextMenu.anchorRect,
                                        imageId: dynamicContextImage.id
                                    });
                                }
                                closeDynamicContextMenu();
                            }}
                        >
                            <RefreshCw className="h-4 w-4 shrink-0 opacity-80" />
                            <span>Replace photo</span>
                        </button>
                    )}
                    {hasDynamicFlipAction && (
                        <button
                            type="button"
                            className="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-sm leading-5 hover:bg-accent hover:text-accent-foreground"
                            onClick={() => {
                                updateCoverImagePanAndZoom(dynamicContextImage.id, {
                                    scale: dynamicContextImage.panAndZoom?.scale ?? 1,
                                    x: dynamicContextImage.panAndZoom?.x ?? 50,
                                    y: dynamicContextImage.panAndZoom?.y ?? 50,
                                    flipHorizontal: !(dynamicContextImage.panAndZoom?.flipHorizontal ?? false),
                                });
                                closeDynamicContextMenu();
                            }}
                        >
                            <FlipHorizontal className="h-4 w-4 shrink-0 opacity-80" />
                            <span>{dynamicContextImage.panAndZoom?.flipHorizontal ? 'Reset horizontal flip' : 'Flip horizontal'}</span>
                        </button>
                    )}
                    {hasDynamicEnhanceAction && (
                        <button
                            type="button"
                            className="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-sm leading-5 hover:bg-accent hover:text-accent-foreground"
                            onClick={() => {
                                const matchedGalleryPhoto = dynamicContextGalleryPhotoId
                                    ? allPhotos.find((photo) => photo.id === dynamicContextGalleryPhotoId)
                                    : undefined;
                                const photoForEnhancement: Photo = matchedGalleryPhoto
                                    ? {
                                        ...matchedGalleryPhoto,
                                        id: dynamicContextImage.id,
                                        src: dynamicContextImage.url,
                                        remoteUrl: dynamicContextImage.url,
                                        originalId: dynamicContextGalleryPhotoId || matchedGalleryPhoto.id,
                                        storagePath: dynamicContextImage.storagePath || matchedGalleryPhoto.storagePath,
                                        panAndZoom: dynamicContextImage.panAndZoom,
                                    }
                                    : {
                                        id: dynamicContextImage.id,
                                        src: dynamicContextImage.url,
                                        remoteUrl: dynamicContextImage.url,
                                        originalId: dynamicContextGalleryPhotoId || dynamicContextImage.originalId,
                                        storagePath: dynamicContextImage.storagePath,
                                        alt: dynamicContextImage.frameName || 'Dynamic photo',
                                        panAndZoom: dynamicContextImage.panAndZoom,
                                        width: dynamicContextImage.aspectRatio > 0 ? 1000 : undefined,
                                        height: dynamicContextImage.aspectRatio > 0 ? (1000 / dynamicContextImage.aspectRatio) : undefined,
                                    };

                                onEnhancePhotoWithAi?.(page.id, dynamicContextImage.id, photoForEnhancement);
                                closeDynamicContextMenu();
                            }}
                        >
                            <Sparkles className="h-4 w-4 shrink-0 opacity-80" />
                            <span>Enhance with AI</span>
                        </button>
                    )}
                    {hasDynamicRemoveAction && (
                        <button
                            type="button"
                            className="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-sm leading-5 hover:bg-accent hover:text-accent-foreground"
                            onClick={() => {
                                removeCoverImage(dynamicContextImage.id);
                                closeDynamicContextMenu();
                            }}
                        >
                            <Trash2 className="h-4 w-4 shrink-0 opacity-80" />
                            <span>Remove photo</span>
                        </button>
                    )}
                    {hasDynamicGalleryJump && (
                        <button
                            type="button"
                            className="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-sm leading-5 hover:bg-accent hover:text-accent-foreground"
                            onClick={() => {
                                scrollToGallery?.(dynamicContextGalleryPhotoId!);
                                closeDynamicContextMenu();
                            }}
                        >
                            <Hash className="h-4 w-4 shrink-0 opacity-80" />
                            <span>Go to photo #{dynamicContextPhotoNumber}</span>
                        </button>
                    )}
                </div>
            </div>,
            document.body
        )
        : null;

    const handleDynamicSwapDrop = useCallback((targetPhotoId: string, sourceInfo: { pageId: string; photoId: string }) => {
        onDropPhoto?.(page.id, targetPhotoId, sourceInfo.photoId, sourceInfo);
    }, [onDropPhoto, page.id]);

    const resolveDynamicImageTargetFromPointer = useCallback((clientX: number, clientY: number): string | null => {
        if (!containerRef.current) return null;

        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;
        if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;

        const localPointerX = ((clientX - rect.left) / rect.width) * 100;
        const localPointerY = ((clientY - rect.top) / rect.height) * 100;

        const candidates = (page.coverImages || [])
            .map((imgItem) => {
                const currentX = dragPositions[imgItem.id]?.x ?? imgItem.x;
                const currentY = dragPositions[imgItem.id]?.y ?? imgItem.y;

                let localX = currentX;
                let localWidth = imgItem.width;
                let isVisible = true;

                if (isFront) {
                    const mappedFront = mapGlobalXToLocalPage(currentX, 'front');
                    localX = mappedFront.localX;
                    localWidth = mapGlobalWidthToLocalPage(imgItem.width, 'front');
                    isVisible = mappedFront.isVisible;
                } else if (isBack) {
                    const mappedBack = mapGlobalXToLocalPage(currentX, 'back');
                    localX = mappedBack.localX;
                    localWidth = mapGlobalWidthToLocalPage(imgItem.width, 'back');
                    isVisible = mappedBack.isVisible;
                }

                if (!isVisible) return null;

                const localHeight = imgItem.height ?? (localWidth / Math.max(imgItem.aspectRatio || 1, 0.01));
                const halfWidth = localWidth / 2;
                const halfHeight = localHeight / 2;
                const isInside = localPointerX >= (localX - halfWidth)
                    && localPointerX <= (localX + halfWidth)
                    && localPointerY >= (currentY - halfHeight)
                    && localPointerY <= (currentY + halfHeight);

                if (!isInside) return null;

                return {
                    id: imgItem.id,
                    zIndex: imgItem.zIndex ?? 40
                };
            })
            .filter((candidate): candidate is { id: string; zIndex: number } => !!candidate)
            .sort((left, right) => right.zIndex - left.zIndex);

        return candidates[0]?.id || null;
    }, [dragPositions, isBack, isFront, mapGlobalWidthToLocalPage, mapGlobalXToLocalPage, page.coverImages]);

    const handleDynamicCanvasDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        if (!dynamicMode) return;
        const isGalleryDrag = hasGalleryDragPayload(e, activeGalleryDrag);
        const activeDragSource = isGalleryDrag ? null : resolveAlbumDragSource(e, activeAlbumDrag, activeGalleryDrag);

        if (activeDragSource) {
            const targetImageId = resolveDynamicImageTargetFromPointer(e.clientX, e.clientY);
            if (!targetImageId) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            return;
        }

        if (!isGalleryDrag || !onDynamicDropPhoto) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDynamicCanvasDrop = (e: React.DragEvent<HTMLDivElement>) => {
        if (!dynamicMode) return;

        const isGalleryDrag = hasGalleryDragPayload(e, activeGalleryDrag);
        const activeDragSource = isGalleryDrag ? null : resolveAlbumDragSource(e, activeAlbumDrag, activeGalleryDrag);

        if (activeDragSource) {
            const targetImageId = resolveDynamicImageTargetFromPointer(e.clientX, e.clientY);
            if (!targetImageId) return;

            e.preventDefault();
            e.stopPropagation();
            onDropPhoto?.(page.id, targetImageId, activeDragSource.photoId, activeDragSource);
            return;
        }

        if (!isGalleryDrag || !onDynamicDropPhoto) return;
        if (!containerRef.current) return;

        const droppedPhotoId = resolveDroppedPhotoIdFromEvent(e, activeGalleryDrag);
        if (!droppedPhotoId) return;

        e.preventDefault();
        e.stopPropagation();

        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        let x = ((e.clientX - rect.left) / rect.width) * 100;
        let y = ((e.clientY - rect.top) / rect.height) * 100;
        x = Math.max(0, Math.min(100, x));
        y = Math.max(0, Math.min(100, y));

        if (isFront) {
            x = mapLocalXToGlobalPage(x, 'front');
        } else if (isBack) {
            x = mapLocalXToGlobalPage(x, 'back');
        }

        onDynamicDropPhoto(page.id, droppedPhotoId, {
            x,
            y,
            containerAspectRatio: rect.width > 0 && rect.height > 0 ? (rect.width / rect.height) : 1
        });
    };

    return (
        <div
            className="w-full h-full flex items-center justify-center overflow-hidden bg-transparent"
            onClick={handleCanvasClick}
            onDragOver={handleDynamicCanvasDragOver}
            onDrop={handleDynamicCanvasDrop}
        >
            <div
                ref={containerRef}
                className="w-full h-full relative overflow-hidden"
                style={{
                    backgroundColor: '#eee',
                    containerType: 'inline-size'
                }}
            >
                {renderContent()}
            </div>
            {dynamicSuggestionAnchor && (
                <SuggestionFan
                    suggestions={getDynamicImageSuggestions(dynamicSuggestionAnchor.imageId)}
                    onSelect={handleSelectDynamicSuggestion}
                    onClose={() => setDynamicSuggestionAnchor(null)}
                    anchorRect={dynamicSuggestionAnchor.rect}
                />
            )}
            {dynamicContextMenuOverlay}
        </div>
    );
};
