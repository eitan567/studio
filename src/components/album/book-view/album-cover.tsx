import React, { useRef, useState, useEffect } from 'react';
import { AlbumPage, CoverText, CoverImage, AlbumConfig, Photo, PhotoPanAndZoom } from '@/lib/types';
import { AdvancedTemplate } from '@/lib/advanced-layout-types';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { PageLayout } from '../layouts/page-layout';
import { useTemplates, getPhotoCount } from '@/hooks/useTemplates';
import { useSettings } from '@/hooks/use-settings';
import { parseLayoutId } from '@/lib/layout-id-utils';
import { RotationAngle } from '@/lib/template-rotation';


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
    fontSizeOverride
}: {
    item: CoverText;
    isSelected: boolean;
    onSelect: (e: React.MouseEvent) => void;
    onUpdatePosition: (x: number, y: number) => void;
    onDragEnd?: () => void;
    containerRef: React.RefObject<HTMLDivElement | null>;
    fontSizeOverride?: string;
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
                isSelected ? "border-primary border-dashed bg-primary/5 z-50" : "border-transparent hover:border-primary/20 z-40"
            )}
            style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                transform: 'translate(-50%, -50%)',
                fontFamily: item.style.fontFamily,
                fontSize: fontSizeOverride || `${item.style.fontSize}px`,
                color: item.style.color,
                fontWeight: item.style.fontWeight === 'bold' ? 'bold' : 'normal',
                fontStyle: item.style.fontStyle === 'italic' ? 'italic' : 'normal',
                textAlign: item.style.textAlign || 'left',
                textShadow: item.style.textShadow,
                pointerEvents: 'auto'
            }}
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
    fontSizeOverride
}: {
    item: CoverText;
    fontSizeOverride?: string;
}) => {
    return (
        <div
            className="absolute select-none whitespace-nowrap p-1 border-2 border-transparent"
            style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                transform: 'translate(-50%, -50%)',
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
        >
            {item.text}
        </div>
    );
};

import { PhotoRenderer } from '../layouts/photo-renderer';

type ResizeDirection = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

// Draggable Image for Editor
const DraggableCoverImage = ({
    item,
    isSelected,
    onSelect,
    onUpdatePosition,
    onUpdateSize,
    onUpdateRotation,
    onDragEnd,
    containerRef,
    onUpdatePanAndZoom,
    lockAspectRatio = false,
    frameGap = 0,
    frameGapColor = '#ffffff',
    containerAspectRatio = 1
}: {
    item: CoverImage;
    isSelected: boolean;
    onSelect: (e: React.MouseEvent) => void;
    onUpdatePosition: (x: number, y: number) => void;
    onUpdateSize: (width: number, height: number | undefined) => void;
    onUpdateRotation?: (rotation: number) => void;
    onDragEnd?: () => void;
    containerRef: React.RefObject<HTMLDivElement | null>;
    onUpdatePanAndZoom?: (panAndZoom: PhotoPanAndZoom) => void;
    lockAspectRatio?: boolean;
    frameGap?: number;
    frameGapColor?: string;
    containerAspectRatio?: number;
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [isRotating, setIsRotating] = useState(false);
    const [isCropMode, setIsCropMode] = useState(false); // New Crop Mode state

    const hasMovedRef = useRef(false);
    const dragOffsetRef = useRef({ x: 0, y: 0 });
    const containerRectRef = useRef<DOMRect | null>(null);
    const startResizeRef = useRef<{
        startWidth: number,
        startHeight: number,
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

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
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

        if (!isSelected || e.ctrlKey || e.metaKey) {
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
        if (isSelected && !hasMovedRef.current && !e.ctrlKey && !e.metaKey) {
            // onSelect(e); 
            // Already selected. 
        }
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isSelected) {
            setIsCropMode(!isCropMode);
        }
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
                const { startX, startY, startWidth, startHeight, direction, freeResize } = startResizeRef.current;

                // Delta in pixels
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;

                // Convert pixel delta to percentage
                const dWidth = (dx / rect.width) * 100;
                const dHeight = (dy / rect.height) * 100;

                let newWidth = startWidth;
                let newHeight = startHeight;
                const affectsWidth = direction.includes('e') || direction.includes('w');
                const affectsHeight = direction.includes('n') || direction.includes('s');
                const signedWidthDelta = direction.includes('w') ? -(dWidth * 2) : (dWidth * 2);
                const signedHeightDelta = direction.includes('n') ? -(dHeight * 2) : (dHeight * 2);
                const isEdgeHandle = direction === 'n' || direction === 's' || direction === 'e' || direction === 'w';
                const shouldLockAspect = lockAspectRatio && !freeResize && !isEdgeHandle;

                if (shouldLockAspect) {
                    const aspectRatio = item.aspectRatio > 0 ? item.aspectRatio : 1;
                    const containerAspectRatio = rect.width > 0 && rect.height > 0
                        ? (rect.width / rect.height)
                        : 1;
                    const widthFromX = startWidth + signedWidthDelta;
                    const heightFromY = startHeight + signedHeightDelta;
                    const widthFromY = heightFromY * (aspectRatio / containerAspectRatio);

                    let nextWidth = startWidth;
                    if (affectsWidth && affectsHeight) {
                        nextWidth = Math.abs(widthFromX - startWidth) > Math.abs(widthFromY - startWidth)
                            ? widthFromX
                            : widthFromY;
                    } else if (affectsWidth) {
                        nextWidth = widthFromX;
                    } else if (affectsHeight) {
                        nextWidth = widthFromY;
                    }

                    const minWidthFromHeightFloor = 2 * (aspectRatio / containerAspectRatio);
                    newWidth = Math.max(2, minWidthFromHeightFloor, nextWidth);
                    newHeight = Math.max(2, newWidth * (containerAspectRatio / aspectRatio));
                } else {
                    if (affectsWidth) {
                        newWidth = Math.max(2, startWidth + signedWidthDelta);
                    }
                    if (affectsHeight) {
                        newHeight = Math.max(2, startHeight + signedHeightDelta);
                    }
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
    }, [isDragging, isResizing, isRotating, onUpdatePosition, onUpdateRotation, onUpdateSize, onDragEnd]);

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
                isSelected && !isCropMode && "ring-2 ring-primary ring-dashed"
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
            onMouseDown={handleMouseDown}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
        >
            <div
                className="w-full h-full relative overflow-hidden pointer-events-none"
                style={frameGap > 0 ? {
                    backgroundColor: frameGapColor
                } : undefined}
            >
                {/* 
                    Wrapper div for Renderer. 
                    If Crop Mode -> enable pointer events on Renderer.
                    Else -> disable so we can drag the container.
                 */}
                <div
                    className={cn("absolute overflow-hidden", isCropMode ? "pointer-events-auto" : "pointer-events-none")}
                    style={{
                        left: frameGap > 0 ? `${frameGap}px` : 0,
                        top: frameGap > 0 ? `${frameGap}px` : 0,
                        right: frameGap > 0 ? `${frameGap}px` : 0,
                        bottom: frameGap > 0 ? `${frameGap}px` : 0
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
                        className="absolute -top-1 -left-1 h-3 w-3 rounded-full border border-primary bg-white cursor-nwse-resize z-50 hover:bg-primary hover:scale-125 transition-transform"
                        onMouseDown={(e) => handleResizeStart(e, 'nw')}
                    />
                    <div
                        className="absolute -top-1 -right-1 h-3 w-3 rounded-full border border-primary bg-white cursor-nesw-resize z-50 hover:bg-primary hover:scale-125 transition-transform"
                        onMouseDown={(e) => handleResizeStart(e, 'ne')}
                    />
                    <div
                        className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border border-primary bg-white cursor-nwse-resize z-50 hover:bg-primary hover:scale-125 transition-transform"
                        onMouseDown={(e) => handleResizeStart(e, 'se')}
                    />
                    <div
                        className="absolute -bottom-1 -left-1 h-3 w-3 rounded-full border border-primary bg-white cursor-nesw-resize z-50 hover:bg-primary hover:scale-125 transition-transform"
                        onMouseDown={(e) => handleResizeStart(e, 'sw')}
                    />

                    <div
                        className="absolute -top-1 left-1/2 -ml-2 h-1.5 w-4 rounded-full border border-primary bg-white cursor-n-resize z-50 hover:bg-primary transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 'n')}
                    />
                    <div
                        className="absolute -bottom-1 left-1/2 -ml-2 h-1.5 w-4 rounded-full border border-primary bg-white cursor-s-resize z-50 hover:bg-primary transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 's')}
                    />
                    <div
                        className="absolute top-1/2 -left-1 -mt-2 h-4 w-1.5 rounded-full border border-primary bg-white cursor-w-resize z-50 hover:bg-primary transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 'w')}
                    />
                    <div
                        className="absolute top-1/2 -right-1 -mt-2 h-4 w-1.5 rounded-full border border-primary bg-white cursor-e-resize z-50 hover:bg-primary transition-colors"
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
                                    className="absolute left-0 top-0 h-[1.5px] bg-pink-500/90"
                                    style={{
                                        width: `${lineLength}px`,
                                        transformOrigin: '0 50%',
                                        transform: `rotate(${lineAngle}deg)`
                                    }}
                                />
                                <button
                                    type="button"
                                    className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-pink-500 shadow-sm cursor-crosshair pointer-events-auto"
                                    style={{ left: `${handle.offsetX}px`, top: `${handle.offsetY}px` }}
                                    onMouseDown={handleRotateStart}
                                    aria-label="Rotate frame"
                                />
                            </div>
                        );
                    })}

                    <div className="absolute -top-16 left-1/2 -translate-x-1/2 text-[9px] text-white/70 opacity-0 group-hover/item:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        Hold Shift + corner to free-resize
                    </div>

                    {/* Double Click Hint */}
                    <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-black/75 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover/item:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        Double-click to Crop
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
    containerAspectRatio = 1
}: {
    item: CoverImage;
    frameGap?: number;
    frameGapColor?: string;
    interactive?: boolean;
    onUpdatePanAndZoom?: (panAndZoom: PhotoPanAndZoom) => void;
    containerAspectRatio?: number;
}) => {
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

    const photoObject: Photo = {
        id: item.id,
        src: item.url,
        alt: 'cover image',
        width: 1000,
        height: 1000 / item.aspectRatio,
        panAndZoom: item.panAndZoom
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
                zIndex: item.zIndex || 40,
                boxSizing: 'border-box'
            }}
        >
            <div
                className="w-full h-full relative overflow-hidden"
                style={frameGap > 0 ? {
                    backgroundColor: frameGapColor
                } : undefined}
            >
                <div
                    className="absolute overflow-hidden"
                    style={{
                        left: frameGap > 0 ? `${frameGap}px` : 0,
                        top: frameGap > 0 ? `${frameGap}px` : 0,
                        right: frameGap > 0 ? `${frameGap}px` : 0,
                        bottom: frameGap > 0 ? `${frameGap}px` : 0
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
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    // Optimization: Local state for drag positions to avoid global re-renders
    const [dragPositions, setDragPositions] = useState<Record<string, { x: number, y: number }>>({});

    // Canvas click handler (for deselecting)
    const handleCanvasClick = (e: React.MouseEvent) => {
        if (mode === 'editor') {
            onSelectText?.(null);
            onSelectImage?.(null);
        }
    };

    useEffect(() => {
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
        // Direct update via onUpdatePage because resize is usually "per frame" not continuous drag like moves
        // For smoothness we probably want local state too.
        // For MVP: Direct update.

        const newImages = page.coverImages?.map(img =>
            img.id === triggerId ? { ...img, width: newWidth, height: newHeight } : img
        ) || [];

        onUpdatePage?.({ ...page, coverImages: newImages });
    };

    const handleUpdateImagePanAndZoom = (panAndZoom: PhotoPanAndZoom) => {
        // This is tricky. Which image?
        // PhotoRenderer calls back with panAndZoom.
        // We need to know the ID.
        // We can wrap this in an arrow function in the map loop.
    };

    const handleDragEnd = () => {
        if (!onUpdatePage) return;

        // Commit changes to actual page state
        if (Object.keys(dragPositions).length === 0) return;

        const newTexts = page.coverTexts?.map(t => {
            if (dragPositions[t.id]) {
                return { ...t, ...dragPositions[t.id] };
            }
            return t;
        }) || [];

        const newImages = page.coverImages?.map(img => {
            if (dragPositions[img.id]) {
                return { ...img, ...dragPositions[img.id] };
            }
            return img;
        }) || [];

        onUpdatePage({ ...page, coverTexts: newTexts, coverImages: newImages });
        setDragPositions({});
    };

    // View State
    const isFull = activeView === 'full';
    const isFront = activeView === 'front';
    const isBack = activeView === 'back';
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


    // Helper to update specific image pan/zoom
    const updateCoverImagePanAndZoom = (imgId: string, panAndZoom: PhotoPanAndZoom) => {
        const newImages = page.coverImages?.map(img =>
            img.id === imgId ? { ...img, panAndZoom } : img
        ) || [];
        onUpdatePage?.({ ...page, coverImages: newImages });
    };

    const updateCoverImageRotation = (imgId: string, rotation: number) => {
        const newImages = page.coverImages?.map((img) => (
            img.id === imgId ? { ...img, rotation } : img
        )) || [];
        onUpdatePage?.({ ...page, coverImages: newImages });
    };

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
                        transform: isFront ? 'translateX(-50%)' : 'none',
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
            {renderTextOverlay()}
            {/* Image Overlay */}
            {renderImageOverlay()}
        </>
    );

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
                // Transform from global (frontStartPercent-100%) to local (0-100%)
                // localX = (globalX - frontStartPercent) / (100 - frontStartPercent) * 100
                const frontRange = 100 - frontStartPercent;
                localX = ((currentX - frontStartPercent) / frontRange) * 100;
                if (currentX < frontStartPercent) isVisible = false;
            } else if (isBack) { // Viewing only Back
                // Transform from global (0-backEndPercent%) to local (0-100%)
                localX = (currentX / backEndPercent) * 100;
                if (currentX > backEndPercent) isVisible = false;
            }

            if (!isVisible) return null;

            // Font Scaling (Responsive cqw)
            // 'cqw' requires the container to have 'container-type: inline-size'.
            const referenceWidth = isFull ? 3200 : 1600;
            const normalizedFontSize = Number(textItem.style.fontSize) || 24;
            // CSS unit values cannot contain whitespace between number and unit (e.g. "2cqw", not "2 cqw").
            const fontSizeCss = `${(normalizedFontSize / referenceWidth) * 100}cqw`;

            const isSelected = activeTextIds.includes(textItem.id);

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
                                // Local 0-100% maps to global frontStartPercent-100%
                                const frontRange = 100 - frontStartPercent;
                                globalX = frontStartPercent + (x / 100) * frontRange;
                            } else if (isBack) {
                                // Local 0-100% maps to global 0-backEndPercent%
                                globalX = (x / 100) * backEndPercent;
                            }

                            handleUpdateTextPosition(textItem.id, globalX, globalY);
                        }}
                        onDragEnd={handleDragEnd}
                        containerRef={containerRef}
                        fontSizeOverride={fontSizeCss}
                    />
                );
            } else {
                return (
                    <StaticCoverText
                        key={textItem.id}
                        item={{ ...textItem, x: localX, y: localY }}
                        fontSizeOverride={fontSizeCss}
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
                // Global to Local (Front)
                // Transform from global (frontStartPercent-100%) to local (0-100%)
                const frontRange = 100 - frontStartPercent;
                localX = ((currentX - frontStartPercent) / frontRange) * 100;
                // Width: % of Full -> % of Front (Front is narrower proportionally)
                localWidth = (imgItem.width / frontRange) * 100;

                if (currentX < frontStartPercent) isVisible = false;
            } else if (isBack) {
                // Global to Local (Back)
                // Transform from global (0-backEndPercent%) to local (0-100%)
                localX = (currentX / backEndPercent) * 100;
                localWidth = (imgItem.width / backEndPercent) * 100;

                if (currentX > backEndPercent) isVisible = false;
            }

            if (!isVisible) return null;

            const isSelected = activeImageIds?.includes(imgItem.id) ?? false;

            if (mode === 'editor' && onSelectImage) {
                return (
                    <DraggableCoverImage
                        key={imgItem.id}
                        item={{ ...imgItem, x: localX, y: localY, width: localWidth }}
                        isSelected={isSelected}
                        onSelect={(e) => {
                            onSelectImage([imgItem.id], e.ctrlKey || e.metaKey);
                        }}
                        onUpdatePosition={(x, y) => {
                            let globalX = x;
                            let globalY = y;
                            if (isFront) {
                                // Local 0-100% maps to global frontStartPercent-100%
                                const frontRange = 100 - frontStartPercent;
                                globalX = frontStartPercent + (x / 100) * frontRange;
                            } else if (isBack) {
                                // Local 0-100% maps to global 0-backEndPercent%
                                globalX = (x / 100) * backEndPercent;
                            }
                            handleUpdateImagePosition(imgItem.id, globalX, globalY);
                        }}
                        onUpdateSize={(w, h) => {
                            // w, h are Local Percentages. Convert to Global.
                            let globalWidth = w;
                            let globalHeight = h;

                            if (isFront) {
                                const frontRange = 100 - frontStartPercent;
                                globalWidth = (w / 100) * frontRange;
                                // Height is vertical, range is 100% usually?
                                // Local relative to page, Global relative to... full spread?
                                // Height is consistently 100% of container HEIGHT.
                                // So Local Height % == Global Height %.
                                // Wait, the coordinate system:
                                // Y is 0-100% of Canvas Height.
                                // So Global Y == Local Y.
                                // So Global Height == Local Height.
                                globalHeight = h;
                            } else if (isBack) {
                                globalWidth = (w / 100) * backEndPercent;
                                globalHeight = h;
                            }

                            handleUpdateImageSize(imgItem.id, globalWidth, globalHeight);
                        }}
                        onUpdateRotation={(rotation) => updateCoverImageRotation(imgItem.id, rotation)}
                        onUpdatePanAndZoom={(mz) => updateCoverImagePanAndZoom(imgItem.id, mz)}
                        onDragEnd={handleDragEnd}
                        containerRef={containerRef}
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
                        containerAspectRatio={overlayContainerAspectRatio}
                    />
                );
            }
        });
    };

    const handleDynamicCanvasDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        if (!dynamicMode) return;
        if (!onDynamicDropPhoto) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDynamicCanvasDrop = (e: React.DragEvent<HTMLDivElement>) => {
        if (!dynamicMode) return;
        if (!onDynamicDropPhoto) return;
        if (!containerRef.current) return;

        const droppedPhotoId = e.dataTransfer.getData('photoId');
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
            const frontRange = 100 - frontStartPercent;
            x = frontStartPercent + ((x / 100) * frontRange);
        } else if (isBack) {
            x = (x / 100) * backEndPercent;
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
        </div>
    );
};
