import React, { useRef, useState, useEffect } from 'react';
import { AlbumPage, CoverText, AlbumConfig } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PageLayout } from '../page-layout';
import { COVER_TEMPLATES } from '../layout-templates';

interface CoverCanvasProps {
    page: AlbumPage;
    activeView: 'front' | 'back' | 'full';
    activeTextId: string | null;
    onSelectText: (id: string | null) => void;
    onUpdatePage: (page: AlbumPage) => void;
    onDropPhoto: (pageId: string, targetPhotoId: string, droppedPhotoId: string) => void;
    config?: AlbumConfig;
}

// Draggable Cover Text Component (Internal)
const DraggableCoverText = ({
    item,
    isSelected,
    onSelect,
    onUpdatePosition,
    containerRef,
    fontSizeOverride
}: {
    item: CoverText;
    isSelected: boolean;
    onSelect: (e: React.MouseEvent) => void;
    onUpdatePosition: (x: number, y: number) => void;
    containerRef: React.RefObject<HTMLDivElement>;
    fontSizeOverride?: string;
}) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        e.stopPropagation(); // Prevent canvas deselect
        onSelect(e);
        setIsDragging(true);
    };

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();

            // Calculate percentage position
            let x = ((e.clientX - rect.left) / rect.width) * 100;
            let y = ((e.clientY - rect.top) / rect.height) * 100;

            onUpdatePosition(x, y);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, onUpdatePosition, containerRef]);

    return (
        <div
            className={cn(
                "absolute cursor-move select-none whitespace-nowrap p-1 border-2 transition-all",
                isSelected ? "border-primary border-dashed bg-primary/5 z-50" : "border-transparent hover:border-primary/20 z-40"
            )}
            style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                transform: 'translate(-50%, -50%)',
                // Style mapping
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
            onClick={(e) => e.stopPropagation()}
        >
            {item.text}
        </div>
    );
};


export const CoverCanvas = ({ page, activeView, activeTextId, onSelectText, onUpdatePage, onDropPhoto, config }: CoverCanvasProps) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const handleCanvasClick = () => {
        onSelectText(null);
    };

    const handleUpdateTextPosition = (id: string, x: number, y: number) => {
        // Create copy
        if (!page.coverTexts) return;
        const newTexts = page.coverTexts.map(t => t.id === id ? { ...t, x, y } : t);
        onUpdatePage({ ...page, coverTexts: newTexts });
    };

    // Helper stubs for now - ideally these come from global config or page props
    const photoGap = config?.photoGap || 5;

    // Determine views
    const isFull = activeView === 'full';
    const isFront = activeView === 'front';
    const isBack = activeView === 'back';

    // Determine Layouts and Photos for Front/Back
    const backLayoutId = page.coverLayouts?.back || COVER_TEMPLATES[0].id;
    const frontLayoutId = page.coverLayouts?.front || COVER_TEMPLATES[0].id;

    const backTemplate = COVER_TEMPLATES.find(t => t.id === backLayoutId) || COVER_TEMPLATES[0];
    const backPhotoCount = backTemplate.grid.length;

    // Slice photos
    const backPhotos = page.photos.slice(0, backPhotoCount);
    // Front photos start after back photos
    const frontPhotos = page.photos.slice(backPhotoCount);

    return (
        <div className="h-full w-full flex items-center justify-center bg-transparent" onClick={handleCanvasClick}>

            {/* Canvas Area */}
            <div
                ref={containerRef}
                className={cn(
                    "relative shadow-2xl transition-all duration-300 ease-in-out overflow-hidden flex @container", // Added @container
                    // Aspect Ratio handling
                    isFull ? "aspect-[2/1] w-[90%] max-h-[90%]" : "aspect-square h-[90%]"
                )}
                style={{
                    backgroundColor: page.spineColor || '#eee', // Base Spine/Page color
                    containerType: 'inline-size' // Ensure CQW works without Tailwind plugin
                }}
            >
                {/* Content Area - Conditional on Cover Type */}
                {page.coverType === 'full' ? (
                    /* FULL COVER MODE */
                    <div
                        className={cn(
                            "relative h-full w-full bg-white transition-all overflow-hidden flex",
                            // If zooming to front/back in full mode, we might need translation/scaling logic. 
                            // For now, let's keep it simple: Full mode usually implies viewing the full spread.
                            // But if activeView is forcing front/back, we can try to crop.
                            // Currently, standard behavior for full spread pages is just showing the whole thing.
                        )}
                        style={{
                            backgroundColor: page.backgroundImage ? 'transparent' : '#fff',
                            backgroundImage: page.backgroundImage ? `url(${page.backgroundImage})` : undefined,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            padding: `${page.pageMargin ?? 0}px`
                        }}
                    >
                        {/* Spine Overlay for Full Mode (Visual Guide) */}
                        <div
                            className="absolute top-0 bottom-0 left-1/2 z-10 pointer-events-none border-l border-dashed border-black/20 flex flex-col items-center overflow-hidden"
                            style={{
                                marginLeft: `-${(page.spineWidth || 40) / 2}px`,
                                width: `${page.spineWidth || 40}px`,
                                backgroundColor: page.spineColor ? `${page.spineColor}80` : 'transparent', // Semi-transparent spine visualization
                                padding: page.spineTextAlign === 'left' || page.spineTextAlign === 'right' ? '10px 0' : '0',
                                justifyContent: page.spineTextAlign === 'left' ? 'flex-start' : page.spineTextAlign === 'right' ? 'flex-end' : 'center'
                            }}
                        >
                            {/* Spine Text */}
                            <span
                                className="whitespace-nowrap tracking-widest select-none"
                                style={{
                                    writingMode: 'vertical-rl',
                                    textOrientation: 'mixed',
                                    transform: page.spineTextRotated ? 'rotate(180deg)' : 'none',
                                    color: page.spineTextColor,
                                    fontSize: `${page.spineFontSize || 12}px`,
                                    fontFamily: page.spineFontFamily || 'Tahoma',
                                    fontWeight: page.spineFontWeight === 'bold' ? 'bold' : 'normal',
                                    fontStyle: page.spineFontStyle === 'italic' ? 'italic' : 'normal'
                                }}
                            >
                                {page.spineText || 'SPINE'}
                            </span>
                        </div>

                        <div className="h-full w-full relative z-0">
                            <PageLayout
                                page={page}
                                photoGap={page.photoGap ?? config?.photoGap ?? 0}
                                overridePhotos={page.photos} // Use ALL photos for full spread
                                overrideLayout={page.layout || COVER_TEMPLATES[0].id} // Use spread layout
                                templateSource={COVER_TEMPLATES}
                                onUpdatePhotoPanAndZoom={() => { }}
                                onInteractionChange={() => { }}
                                onDropPhoto={onDropPhoto}
                            />
                        </div>
                    </div>
                ) : (
                    /* SPLIT COVER MODE (Original Logic) */
                    <>
                        {/* Back Cover Area */}
                        <div
                            className={cn(
                                "relative h-full bg-white transition-all overflow-hidden",
                                isFull ? "flex-1" : isBack ? "w-full" : "hidden"
                            )}
                            style={{
                                backgroundColor: page.backgroundImage ? 'transparent' : '#fff', // if bg image exists
                                backgroundImage: page.backgroundImage ? `url(${page.backgroundImage})` : undefined,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                // Padding?
                                padding: `${page.pageMargin ?? 0}px`
                            }}
                        >
                            <div className="h-full w-full">
                                <PageLayout
                                    page={page}
                                    photoGap={page.photoGap ?? config?.photoGap ?? 0}
                                    overridePhotos={backPhotos}
                                    overrideLayout={backLayoutId}
                                    templateSource={COVER_TEMPLATES}
                                    onUpdatePhotoPanAndZoom={() => { }} // Read only in editor for now? Or implement props
                                    onInteractionChange={() => { }}
                                    onDropPhoto={onDropPhoto}
                                />
                            </div>
                        </div>

                        {/* Spine Area */}
                        <div
                            className={cn(
                                "relative h-full flex flex-col items-center bg-muted/30 z-10 shrink-0",
                                isFull ? "flex" : "hidden",
                                page.spineTextAlign === 'left' ? 'justify-start' :
                                    page.spineTextAlign === 'right' ? 'justify-end' :
                                        'justify-center'
                            )}
                            style={{
                                backgroundColor: page.spineColor,
                                width: `${page.spineWidth || 40}px`,
                                padding: page.spineTextAlign === 'left' || page.spineTextAlign === 'right' ? '10px 0' : '0'
                            }}
                        >
                            {/* Spine Text */}
                            <span
                                className="whitespace-nowrap tracking-widest select-none"
                                style={{
                                    writingMode: 'vertical-rl',
                                    textOrientation: 'mixed',
                                    transform: page.spineTextRotated ? 'rotate(180deg)' : 'none',
                                    color: page.spineTextColor,
                                    fontSize: `${page.spineFontSize || 12}px`,
                                    fontFamily: page.spineFontFamily || 'Tahoma',
                                    fontWeight: page.spineFontWeight === 'bold' ? 'bold' : 'normal',
                                    fontStyle: page.spineFontStyle === 'italic' ? 'italic' : 'normal'
                                }}
                            >
                                {page.spineText || 'SPINE'}
                            </span>
                        </div>

                        {/* Front Cover Area */}
                        <div
                            className={cn(
                                "relative h-full bg-white transition-all overflow-hidden",
                                isFull ? "flex-1" : isFront ? "w-full" : "hidden"
                            )}
                            style={{
                                backgroundColor: page.backgroundImage ? 'transparent' : '#fff',
                                backgroundImage: page.backgroundImage ? `url(${page.backgroundImage})` : undefined,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                padding: `${page.pageMargin ?? 0}px`
                            }}
                        >
                            <div className="h-full w-full">
                                <PageLayout
                                    page={page}
                                    // ensure photoGap also falls back correctly if not already handled
                                    photoGap={page.photoGap ?? config?.photoGap ?? 0}
                                    overridePhotos={frontPhotos}
                                    overrideLayout={frontLayoutId}
                                    templateSource={COVER_TEMPLATES}
                                    onUpdatePhotoPanAndZoom={() => { }}
                                    onInteractionChange={() => { }}
                                    onDropPhoto={onDropPhoto}
                                />
                            </div>
                        </div>
                    </>
                )}

                {/* Render Text Objects - OVERLAY on top of everything */}
                {page.coverTexts?.map(textItem => {
                    // 1. Transform Global Coordinates to Local View coordinates for rendering
                    let localX = textItem.x;
                    let localY = textItem.y;

                    // Hide if not in view (optional, but good for UX)
                    let isVisible = true;

                    if (isFront) {
                        // Global 50-100% -> Local 0-100%
                        localX = (textItem.x - 50) * 2;
                        if (textItem.x < 50) isVisible = false; // Or just let it Render off-screen
                    } else if (isBack) {
                        // Global 0-50% -> Local 0-100%
                        localX = textItem.x * 2;
                        if (textItem.x > 50) isVisible = false;
                    }

                    if (!isVisible) return null;

                    // Calculate Font Size Scaling
                    // We standardise on Spread Width = 3200px (Fine tuning based on user feedback 3000px was almost perfect).
                    // If Full View: Ref = 3200.
                    // If Front/Back View: Ref = 1600.
                    const referenceWidth = isFull ? 3200 : 1600;
                    // Use 'cqw' to make it responsive to the editor's actual size (WYSIWYG)
                    const fontSizeCss = `${(textItem.style.fontSize / referenceWidth) * 100}cqw`;


                    return (
                        <DraggableCoverText
                            key={textItem.id}
                            item={{ ...textItem, x: localX, y: localY }} // Pass transformed coords
                            isSelected={activeTextId === textItem.id}
                            onSelect={() => onSelectText(textItem.id)}
                            onUpdatePosition={(x, y) => {
                                // 2. Transform Local View coordinates back to Global for saving
                                let globalX = x;
                                let globalY = y;

                                if (isFront) {
                                    // Local 0-100% -> Global 50-100%
                                    globalX = 50 + (x / 2);
                                } else if (isBack) {
                                    // Local 0-100% -> Global 0-50%
                                    globalX = x / 2;
                                }
                                // Full view is 1:1

                                handleUpdateTextPosition(textItem.id, globalX, globalY);
                            }}
                            containerRef={containerRef as React.RefObject<HTMLDivElement>}
                            fontSizeOverride={fontSizeCss}
                        />
                    );
                })}

            </div>
        </div >
    );
};
