import React, { useRef, useState, useEffect } from 'react';
import { AlbumPage, CoverText, CoverImage, AlbumConfig, Photo, PhotoPanAndZoom } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PageLayout } from './page-layout';
import { COVER_TEMPLATES, LAYOUT_TEMPLATES } from './layout-templates';
import { ADVANCED_TEMPLATES } from '@/lib/advanced-layout-types';

// --- Types ---

export interface AlbumCoverProps {
    page: AlbumPage;
    config?: AlbumConfig;
    mode?: 'preview' | 'editor';
    activeView?: 'front' | 'back' | 'full';

    // Interaction Handlers (Optional - mainly for Editor)
    activeTextIds?: string[];
    onSelectText?: (id: string | string[] | null, isMulti?: boolean) => void;
    onUpdatePage?: (page: AlbumPage) => void;
    onDropPhoto?: (pageId: string, targetPhotoId: string, droppedPhotoId: string) => void;
    onUpdatePhotoPanAndZoom?: (pageId: string, photoId: string, panAndZoom: PhotoPanAndZoom) => void;
    onInteractionChange?: (isInteracting: boolean) => void;
    onRemovePhoto?: (pageId: string, photoId: string) => void;

    // Image Object Handlers
    activeImageIds?: string[];
    onSelectImage?: (id: string | string[] | null, isMulti?: boolean) => void;

    // For Preview-specific legacy support or extra overlays
    onUpdateTitleSettings?: (pageId: string, settings: any) => void;
    useSimpleImage?: boolean;
}

// --- Internal Helper Components ---

export const Spine = ({
    text,
    width,
    color,
    textColor,
    fontSize = 12,
    fontFamily,
    fontWeight,
    fontStyle,
    textAlign = 'center',
    rotated = false,
    styleOverride
}: {
    text?: string;
    width?: number;
    color?: string;
    textColor?: string;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string;
    fontStyle?: string;
    textAlign?: 'left' | 'center' | 'right';
    rotated?: boolean;
    styleOverride?: React.CSSProperties
}) => {
    // Alignment logic
    const getContainerAlignment = (): string => {
        switch (textAlign) {
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
                (!width && width !== 0) || width > 0 ? "border-x border-dashed border-border/50" : "border-none"
            )}
            style={{
                width: width ? `${width}px` : undefined,
                backgroundColor: color,
                padding: textAlign === 'left' || textAlign === 'right' ? '10px 0' : '0',
                ...styleOverride
            }}
        >
            <span
                className="whitespace-nowrap text-muted-foreground/70 tracking-widest select-none"
                style={{
                    writingMode: 'vertical-rl',
                    textOrientation: 'mixed',
                    transform: rotated ? 'rotate(180deg)' : 'none',
                    fontSize: `${fontSize}px`,
                    fontFamily: fontFamily || 'Tahoma',
                    color: textColor,
                    fontWeight: fontWeight === 'bold' ? 'bold' : 'normal',
                    fontStyle: fontStyle === 'italic' ? 'italic' : 'normal'
                }}
            >
                {text || (width === 0 ? '' : 'SPINE')}
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

// Draggable Image for Editor
const DraggableCoverImage = ({
    item,
    isSelected,
    onSelect,
    onUpdatePosition,
    onUpdateSize,
    onDragEnd,
    containerRef
}: {
    item: CoverImage;
    isSelected: boolean;
    onSelect: (e: React.MouseEvent) => void;
    onUpdatePosition: (x: number, y: number) => void;
    onUpdateSize: (width: number) => void;
    onDragEnd?: () => void;
    containerRef: React.RefObject<HTMLDivElement | null>;
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const hasMovedRef = useRef(false);
    const containerRectRef = useRef<DOMRect | null>(null);
    const startResizeRef = useRef<{
        startWidth: number,
        centerX: number,
        centerY: number,
        startDist: number
    } | null>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        e.stopPropagation();

        if (containerRef.current) {
            containerRectRef.current = containerRef.current.getBoundingClientRect();
        }

        if (!isSelected || e.ctrlKey || e.metaKey) {
            onSelect(e);
        }

        hasMovedRef.current = false;
        setIsDragging(true);
    };

    const handleResizeStart = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        containerRectRef.current = rect;

        // Calculate center of image in screen coordinates
        const centerX = rect.left + (item.x / 100) * rect.width;
        const centerY = rect.top + (item.y / 100) * rect.height;
        const startDist = Math.hypot(e.clientX - centerX, e.clientY - centerY);

        setIsResizing(true);
        startResizeRef.current = {
            startWidth: item.width,
            centerX,
            centerY,
            startDist
        };
    };

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isSelected && !hasMovedRef.current && !e.ctrlKey && !e.metaKey) {
            onSelect(e);
        }
    };

    useEffect(() => {
        if (!isDragging && !isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRectRef.current) return;
            const rect = containerRectRef.current;
            hasMovedRef.current = true;

            if (isDragging) {
                // Calculate percentage position
                let x = ((e.clientX - rect.left) / rect.width) * 100;
                let y = ((e.clientY - rect.top) / rect.height) * 100;
                onUpdatePosition(x, y);
            } else if (isResizing && startResizeRef.current) {
                const { centerX, centerY, startDist, startWidth } = startResizeRef.current;
                const currentDist = Math.hypot(e.clientX - centerX, e.clientY - centerY);

                // Scale based on distance ratio
                // Prevent division by zero
                if (startDist <= 0) return;

                const scale = currentDist / startDist;
                const newWidth = Math.max(2, startWidth * scale); // Min 2% width

                onUpdateSize(newWidth);
            }
        };

        const handleMouseUp = () => {
            if ((isDragging || isResizing) && onDragEnd && hasMovedRef.current) {
                onDragEnd();
            }
            setIsDragging(false);
            setIsResizing(false);
            containerRectRef.current = null;
            startResizeRef.current = null;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isResizing, onUpdatePosition, onUpdateSize, onDragEnd]);

    return (
        <div
            className={cn(
                "absolute cursor-move select-none",
                isSelected ? "ring-2 ring-primary ring-dashed z-50" : "hover:ring-2 hover:ring-primary/20 z-40"
            )}
            style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                width: `${item.width}%`,
                aspectRatio: `${item.aspectRatio}`,
                transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
                opacity: item.opacity,
                zIndex: item.zIndex
            }}
            onMouseDown={handleMouseDown}
            onClick={handleClick}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={item.url}
                alt="overlay"
                className="w-full h-full object-contain pointer-events-none"
                draggable={false}
            />

            {/* Resize Handles - Only visible when selected */}
            {isSelected && (
                <>
                    <div
                        className="absolute -bottom-1 -right-1 w-3 h-3 bg-white border border-primary rounded-full cursor-se-resize z-50"
                        onMouseDown={handleResizeStart}
                    />
                </>
            )}
        </div>
    );
};

// Static Image for Preview
export const StaticCoverImage = ({ item }: { item: CoverImage }) => {
    return (
        <div
            className="absolute select-none pointer-events-none"
            style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                width: `${item.width}%`,
                aspectRatio: `${item.aspectRatio}`,
                transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
                opacity: item.opacity,
                zIndex: item.zIndex || 40
            }}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.url} alt="overlay" className="w-full h-full object-contain" />
        </div>
    );
};


// --- Main Component ---

export const AlbumCover = ({
    page,
    config,
    mode = 'preview',
    activeView = 'full',
    activeTextIds = [],
    onSelectText,
    activeImageIds = [],
    onSelectImage,
    onUpdatePage,
    onDropPhoto,
    onUpdatePhotoPanAndZoom,
    onInteractionChange,
    onRemovePhoto,
    // onUpdateTitleSettings
    useSimpleImage
}: AlbumCoverProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    // Optimization: Local state for drag positions to avoid global re-renders
    const [dragPositions, setDragPositions] = useState<Record<string, { x: number, y: number }>>({});

    // Canvas click handler (for deselecting)
    const handleCanvasClick = (e: React.MouseEvent) => {
        if (mode === 'editor') {
            onSelectText?.(null);
            onSelectImage?.(null);
        }
    };

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

    const handleUpdateImageSize = (triggerId: string, newWidth: number) => {
        // Direct update via onUpdatePage because resize is usually "per frame" not continuous drag like moves
        // But for smoothness we probably want local state too.
        // For now let's just update the page directly for simplicity, or we need a resize state.
        // Let's modify handleDragEnd to also commit size changes if we stored them?
        // Actually, DraggableCoverImage calls onUpdateSize during drag.
        // Let's just update the page directly but maybe throttle it?
        // Better: Use a separate local state for "Temp Size" just like positions?
        // For MVP: Let's direct update (React is fast enough for 60fps usually).
        // IF choppy, implemented "temp" state.

        const newImages = page.coverImages?.map(img =>
            img.id === triggerId ? { ...img, width: newWidth } : img
        ) || [];

        onUpdatePage?.({ ...page, coverImages: newImages });
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
    const isFullSpread = page.isCover ? (page.coverType === 'full') : (page.spreadMode !== 'split');

    // Layout Data
    const backLayoutId = page.isCover
        ? (page.coverLayouts?.back || COVER_TEMPLATES[0].id)
        : (page.spreadLayouts?.left || LAYOUT_TEMPLATES[0].id);

    const frontLayoutId = page.isCover
        ? (page.coverLayouts?.front || COVER_TEMPLATES[0].id)
        : (page.spreadLayouts?.right || LAYOUT_TEMPLATES[0].id);

    const templateSource = page.isCover ? [...COVER_TEMPLATES, ...ADVANCED_TEMPLATES] : [...LAYOUT_TEMPLATES, ...ADVANCED_TEMPLATES];
    const backTemplate = templateSource.find(t => t.id === backLayoutId) || templateSource[0];
    const backPhotoCount = backTemplate.photoCount;

    // Photos
    const backPhotos = page.photos.slice(0, backPhotoCount);
    const frontPhotos = page.photos.slice(backPhotoCount);

    // Derived Styles
    const pageMargin = page.pageMargin ?? config?.pageMargin ?? 0;
    // Assuming config.photoGap is number. If string, parse it.
    const photoGap = page.photoGap ?? config?.photoGap ?? 0;
    const spineWidth = page.isCover ? (page.spineWidth ?? 40) : 0;

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

    // --- Render Content Helper ---
    const renderContent = () => (
        <>
            {isFullSpread ? (
                /* FULL COVER MODE (Spread) */
                <div
                    className="relative h-full bg-white transition-all overflow-hidden flex"
                    style={{
                        width: isFull ? '100%' : '200%',
                        transform: isFront ? 'translateX(-50%)' : 'none',
                        backgroundColor: page.backgroundColor || config?.backgroundColor || '#fff',
                        backgroundImage: page.backgroundImage ? `url(${page.backgroundImage})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        padding: `${pageMargin}px`
                    }}
                >
                    {/* Spine Visual Guide (Overlay) */}
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

                    {/* Spread Content */}
                    <div className="h-full w-full relative z-0">
                        <PageLayout
                            page={page}
                            photoGap={photoGap}
                            overridePhotos={page.photos}
                            overrideLayout={page.layout || (page.isCover ? COVER_TEMPLATES[0].id : LAYOUT_TEMPLATES[0].id)}
                            templateSource={page.isCover ? [...COVER_TEMPLATES, ...ADVANCED_TEMPLATES] as any : [...LAYOUT_TEMPLATES, ...ADVANCED_TEMPLATES] as any}
                            onUpdatePhotoPanAndZoom={onUpdatePhotoPanAndZoom || (() => { })}
                            onInteractionChange={onInteractionChange || (() => { })}
                            onDropPhoto={onDropPhoto || (() => { })}
                            useSimpleImage={useSimpleImage}
                            photoIndexOffset={0}
                            onRemovePhoto={onRemovePhoto}
                        />
                    </div>
                </div>
            ) : (
                /* SPLIT COVER MODE */
                <div className="relative w-full h-full flex">
                    {/* Left / Back Page */}
                    <div
                        className={cn(
                            "relative h-full bg-white transition-all overflow-hidden",
                            isFull ? "flex-1" : isBack ? "w-full" : "hidden"
                        )}
                        style={{
                            backgroundColor: page.backgroundColor || config?.backgroundColor || '#fff',
                            backgroundImage: page.backgroundImage ? `url(${page.backgroundImage})` : undefined,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            padding: `${pageMargin}px`
                        }}
                    >
                        <div className="h-full w-full">
                            <PageLayout
                                page={page}
                                photoGap={photoGap}
                                // Use backPhotos (first chunk) for Back Cover OR Left Page
                                overridePhotos={backPhotos}
                                // Use Left Layout for regular pages, Back Layout for covers
                                overrideLayout={page.isCover ? backLayoutId : (page.spreadLayouts?.left || LAYOUT_TEMPLATES[0].id)}
                                templateSource={page.isCover ? [...COVER_TEMPLATES, ...ADVANCED_TEMPLATES] as any : [...LAYOUT_TEMPLATES, ...ADVANCED_TEMPLATES] as any}
                                onUpdatePhotoPanAndZoom={onUpdatePhotoPanAndZoom || (() => { })}
                                onInteractionChange={() => { }}
                                onDropPhoto={onDropPhoto || (() => { })}
                                useSimpleImage={useSimpleImage}
                                photoIndexOffset={0}
                                onRemovePhoto={onRemovePhoto}
                            />
                        </div>
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
                            "relative h-full bg-white transition-all overflow-hidden",
                            isFull ? "flex-1" : isFront ? "w-full" : "hidden"
                        )}
                        style={{
                            backgroundColor: page.backgroundColor || config?.backgroundColor || '#fff',
                            backgroundImage: page.backgroundImage ? `url(${page.backgroundImage})` : undefined,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            padding: `${pageMargin}px`
                        }}
                    >
                        <div className="h-full w-full">
                            <PageLayout
                                page={page}
                                photoGap={photoGap}
                                // Use frontPhotos (second chunk) for Front Cover OR Right Page
                                overridePhotos={frontPhotos}
                                // Use Right Layout for regular pages, Front Layout for covers
                                overrideLayout={page.isCover ? frontLayoutId : (page.spreadLayouts?.right || LAYOUT_TEMPLATES[0].id)}
                                templateSource={page.isCover ? [...COVER_TEMPLATES, ...ADVANCED_TEMPLATES] as any : [...LAYOUT_TEMPLATES, ...ADVANCED_TEMPLATES] as any}
                                onUpdatePhotoPanAndZoom={onUpdatePhotoPanAndZoom || (() => { })}
                                onInteractionChange={() => { }}
                                onDropPhoto={onDropPhoto || (() => { })}
                                useSimpleImage={useSimpleImage}
                                photoIndexOffset={backPhotoCount}
                                onRemovePhoto={onRemovePhoto}
                            />
                        </div>
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
            const fontSizeCss = `${(textItem.style.fontSize / referenceWidth) * 100}cqw`;

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
                        onUpdateSize={(w) => {
                            // w is Local Percentage. Convert to Global.
                            let globalWidth = w;
                            if (isFront) {
                                const frontRange = 100 - frontStartPercent;
                                globalWidth = (w / 100) * frontRange;
                            } else if (isBack) {
                                globalWidth = (w / 100) * backEndPercent;
                            }

                            handleUpdateImageSize(imgItem.id, globalWidth);
                        }}
                        onDragEnd={handleDragEnd}
                        containerRef={containerRef}
                    />
                );
            } else {
                return (
                    <StaticCoverImage
                        key={imgItem.id}
                        item={{ ...imgItem, x: localX, y: localY, width: localWidth }}
                    />
                );
            }
        });
    };

    return (
        <div
            className="w-full h-full flex items-center justify-center overflow-hidden bg-transparent"
            onClick={handleCanvasClick}
        >
            <div
                ref={containerRef}
                className="w-full h-full relative overflow-hidden transition-all ease-in-out duration-300"
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
