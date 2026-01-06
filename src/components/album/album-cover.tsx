import React, { useRef, useState, useEffect } from 'react';
import { AlbumPage, CoverText, AlbumConfig, Photo, PhotoPanAndZoom } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PageLayout } from './page-layout';
import { COVER_TEMPLATES } from './layout-templates';

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
const StaticCoverText = ({
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


// --- Main Component ---

export const AlbumCover = ({
    page,
    config,
    mode = 'preview',
    activeView = 'full',
    activeTextIds = [],
    onSelectText,
    onUpdatePage,
    onDropPhoto,
    onUpdatePhotoPanAndZoom,
    // onUpdateTitleSettings
    useSimpleImage
}: AlbumCoverProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    // Optimization: Local state for drag positions to avoid global re-renders
    const [dragPositions, setDragPositions] = useState<Record<string, { x: number, y: number }>>({});

    // Canvas click handler (for deselecting)
    const handleCanvasClick = (e: React.MouseEvent) => {
        if (mode === 'editor' && onSelectText) {
            // If we clicked on a text, stop propagation would have prevented this.
            // So this is a click on empty space.
            onSelectText(null);
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

    const handleDragEnd = () => {
        if (!onUpdatePage || !page.coverTexts) return;

        // Commit changes to actual page state
        if (Object.keys(dragPositions).length === 0) return;

        const newTexts = page.coverTexts.map(t => {
            if (dragPositions[t.id]) {
                return { ...t, ...dragPositions[t.id] };
            }
            return t;
        });

        onUpdatePage({ ...page, coverTexts: newTexts });
        setDragPositions({});
    };

    // View State
    const isFull = activeView === 'full';
    const isFront = activeView === 'front';
    const isBack = activeView === 'back';
    const isFullSpread = page.coverType === 'full';

    // Layout Data
    const backLayoutId = page.coverLayouts?.back || COVER_TEMPLATES[0].id;
    const frontLayoutId = page.coverLayouts?.front || COVER_TEMPLATES[0].id;
    const backTemplate = COVER_TEMPLATES.find(t => t.id === backLayoutId) || COVER_TEMPLATES[0];
    const backPhotoCount = backTemplate.grid.length;

    // Photos
    const backPhotos = page.photos.slice(0, backPhotoCount);
    const frontPhotos = page.photos.slice(backPhotoCount);

    // Derived Styles
    const pageMargin = page.pageMargin ?? 0;
    // Assuming config.photoGap is number. If string, parse it.
    const photoGap = page.photoGap ?? config?.photoGap ?? 0;
    const spineWidth = page.spineWidth ?? 40;

    // --- Render Content Helper ---
    const renderContent = () => (
        <>
            {isFullSpread ? (
                /* FULL COVER MODE (Spread) */
                <div
                    className="relative h-full w-full bg-white transition-all overflow-hidden flex"
                    style={{
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
                            overrideLayout={page.layout || COVER_TEMPLATES[0].id}
                            templateSource={COVER_TEMPLATES}
                            onUpdatePhotoPanAndZoom={onUpdatePhotoPanAndZoom || (() => { })}
                            onInteractionChange={() => { }}
                            onDropPhoto={onDropPhoto || (() => { })}
                            useSimpleImage={useSimpleImage}
                            photoIndexOffset={0}
                        />
                    </div>
                </div>
            ) : (
                /* SPLIT COVER MODE */
                <div className="relative w-full h-full flex">
                    {/* Back Cover */}
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
                                overridePhotos={backPhotos}
                                overrideLayout={backLayoutId}
                                templateSource={COVER_TEMPLATES}
                                onUpdatePhotoPanAndZoom={onUpdatePhotoPanAndZoom || (() => { })}
                                onInteractionChange={() => { }}
                                onDropPhoto={onDropPhoto || (() => { })}
                                useSimpleImage={useSimpleImage}
                                photoIndexOffset={0}
                            />
                        </div>
                    </div>

                    {/* Spine */}
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

                    {/* Front Cover */}
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
                                overridePhotos={frontPhotos}
                                overrideLayout={frontLayoutId}
                                templateSource={COVER_TEMPLATES}
                                onUpdatePhotoPanAndZoom={onUpdatePhotoPanAndZoom || (() => { })}
                                onInteractionChange={() => { }}
                                onDropPhoto={onDropPhoto || (() => { })}
                                useSimpleImage={useSimpleImage}
                                photoIndexOffset={backPhotoCount}
                            />
                        </div>
                    </div>
                </div>
            )}
            {/* Text Overlay */}
            {renderTextOverlay()}
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
                localX = (currentX - 50) * 2;
                if (currentX < 50) isVisible = false;
            } else if (isBack) { // Viewing only Back
                localX = currentX * 2;
                if (currentX > 50) isVisible = false;
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
                            if (isFront) globalX = 50 + (x / 2);
                            else if (isBack) globalX = x / 2;

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
