'use client';

import React, { memo, CSSProperties, useEffect, useRef, useCallback, useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { List } from 'react-window';
import { AlbumPage, AlbumConfig, Photo } from '@/lib/types';
import { AdvancedTemplate } from '@/lib/advanced-layout-types';
import { logger } from '@/lib/logger';
import { PageCanvas } from '@/components/album/page-editor/page-canvas';
import type { ExportRenderOptions } from '@/components/album/shared/album-exporter';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    ArrowUp,
    ChevronsUp,
    ChevronsDown,
    ChevronUp,
    ChevronDown,
    CornerDownLeft
} from 'lucide-react';

interface VirtualizedPageListProps {
    pages: AlbumPage[];
    zoom?: number;
    pageMaxWidth?: number;
    config: AlbumConfig;
    allPhotos: Photo[];
    onUpdatePage: (updatedPage: AlbumPage) => void;
    onDeletePage: (pageId: string) => void;
    onAddSpread: (afterIndex: number) => void;
    onMovePage: (pageId: string, direction: 'up' | 'down') => void;
    onUpdateLayout: (pageId: string, layoutId: string) => void;
    onUpdatePhotoPanAndZoom: (pageId: string, photoId: string, panAndZoom: any) => void;
    onDropPhoto: (pageId: string, targetPhotoId: string, droppedPhotoId: string, sourceInfo?: { pageId: string; photoId: string }) => void;
    onDownloadPage: (pageId: string, options?: ExportRenderOptions) => void;
    onRemovePhoto: (pageId: string, photoId: string) => void;

    onUpdateCoverLayout: (pageId: string, side: 'front' | 'back' | 'full', newLayout: string) => void;
    onUpdateCoverType: (pageId: string, newType: 'split' | 'full') => void;
    onUpdateSpineText: (pageId: string, text: string) => void;
    onUpdateSpineSettings: (pageId: string, settings: any) => void;
    onUpdateTitleSettings: (pageId: string, settings: any) => void;
    onUpdateSpreadLayout: (pageId: string, side: 'left' | 'right', newLayout: string) => void;
    onOpenEditor?: (pageId: string) => void;
    onEnhanceWithAi?: (pageId: string) => void;
    onEnhancePhotoWithAi?: (pageId: string, photoId: string, photo: Photo) => void;
    onUndo?: (pageId: string) => void;
    onRedo?: (pageId: string) => void;
    onToggleLock?: (pageId: string) => void;

    customTemplates: AdvancedTemplate[];
    onCreateCustomTemplate?: (template: AdvancedTemplate) => Promise<void> | void;
    defaultViewMode: 'single' | 'spread';
    visibleTemplateCategories: string[];
    allowedTemplateIds: string[];
    chronologicalIndex?: Record<string, number>;
}

// Fixed dimensions for fallback
const BASE_PAGE_HEIGHT = 650;
const ROW_HORIZONTAL_PADDING = 32; // Matches row px-4 (16px on each side)
const PAGE_TOP_PADDING = 40; // Matches Row pt-10
const PAGE_TOOLBAR_HEIGHT = 56; // Main top toolbar block above the canvas
const PAGE_ADD_SPREAD_HEIGHT = 40; // "Add Spread" row shown on non-cover pages
const PAGE_VERTICAL_GAP = 10; // Primary knob for spacing between page rows
const VirtualWindowList = List as any;

// Helper to calculate page height dynamically based on container width
const getPageHeight = (
    index: number,
    pages: AlbumPage[],
    config: AlbumConfig,
    containerWidth: number,
    containerHeight: number = 0,
    pageMaxWidth?: number
) => {
    const page = pages[index];
    if (!page) return BASE_PAGE_HEIGHT;

    // 1. Calculate the Aspect Ratio exactly as PageCanvas does
    const sizeStr = config?.size || '800x600';
    const [w, h] = sizeStr.split('x').map(Number);
    const baseRatio = w / h;

    let ratio;
    if (page.isCover) {
        const BASE_PAGE_PX = 450;
        const pxPerUnit = BASE_PAGE_PX / h;
        const singlePageW = w * pxPerUnit;
        const spineWidth = page.spineWidth !== undefined ? page.spineWidth : 40;
        const coverWidth = (singlePageW * 2) + spineWidth;
        ratio = coverWidth / BASE_PAGE_PX;
    } else {
        ratio = page.type === 'spread' ? baseRatio * 2 : baseRatio;
    }

    // Determine effective container width logic from PageCanvas
    const isSingle = page.type === 'single';
    const widthModifier = isSingle ? 0.5 : 1.0;

    // The row width follows available space (responsive), minus row padding.
    const availableContainerWidth = Math.max(containerWidth - ROW_HORIZONTAL_PADDING, 0);
    const effectiveContainerWidth = (pageMaxWidth && pageMaxWidth > 0)
        ? Math.min(availableContainerWidth, pageMaxWidth)
        : availableContainerWidth;

    const imageContainerWidth = effectiveContainerWidth * widthModifier;

    // Height = Width / Ratio
    const imageHeight = imageContainerWidth / ratio;

    const staticUiHeight =
        PAGE_TOP_PADDING +
        PAGE_TOOLBAR_HEIGHT +
        (!page.isCover ? PAGE_ADD_SPREAD_HEIGHT : 0) +
        PAGE_VERTICAL_GAP;

    let total = imageHeight + staticUiHeight;

    // Add exactly enough space to the last page so that scrolling to the absolute bottom 
    // puts the center of the CANVAS in the center of the viewport.
    if (index === pages.length - 1 && containerHeight > 0) {
        // Center math: itemTop + paddingTop + imageHeight/2 = (DocumentEnd - viewport) + viewport/2
        // DocumentEnd = itemTop + totalHeight + extra
        // paddingTop + imageHeight/2 = totalHeight + extra - viewport/2
        // extra = viewport/2 + paddingTop + imageHeight/2 - totalHeight
        const extra = (containerHeight / 2) + PAGE_TOP_PADDING + (imageHeight / 2) - total;

        if (extra > 0) {
            total += extra;
        }
    }

    return total;
};

// Custom hook to measure container size
function useContainerSize() {
    const [size, setSize] = React.useState({ width: 0, height: 0 });
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!ref.current) return;
        const updateSize = () => {
            if (ref.current) {
                const { clientWidth, clientHeight } = ref.current;
                setSize(prev => {
                    if (prev.width === clientWidth && prev.height === clientHeight) return prev;
                    return { width: clientWidth, height: clientHeight };
                });
            }
        };
        updateSize();
        const observer = new ResizeObserver(updateSize);
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    return { containerRef: ref, width: size.width, height: size.height };
}

// --- Navigation Controls ---
function NavigationControls({
    onScrollToPage,
    totalPages,
    pageInfo,
    currentPageIndex
}: {
    onScrollToPage: (index: number) => void,
    totalPages: number,
    pageInfo: { label: string; start: number; end: number; isCover: boolean; }[],
    currentPageIndex: number
}) {
    const [targetPage, setTargetPage] = useState<string>("");
    const [stepSize, setStepSize] = useState<string>("1");

    const handleJump = () => {
        const pageNum = parseInt(targetPage);
        if (!isNaN(pageNum)) {
            const targetIndex = pageInfo.findIndex(info => !info.isCover && pageNum >= info.start && pageNum <= info.end);
            if (targetIndex !== -1) {
                onScrollToPage(targetIndex);
                setTargetPage("");
            } else if (pageNum === 0) {
                onScrollToPage(0);
                setTargetPage("");
            }
        }
    };

    const handleStepJump = (direction: 'up' | 'down') => {
        const current = currentPageIndex;
        const step = parseInt(stepSize) || 1;
        let next = direction === 'up' ? current - step : current + step;

        if (next < 0) next = 0;
        if (next >= totalPages) next = totalPages - 1;

        logger.debug('[NavigationControls] Stepping:', {
            currentPageIndex: current,
            totalPages,
            step,
            direction,
            next
        });

        onScrollToPage(next);
    };

    return (
        <div className="absolute right-8 top-1/2 -translate-y-1/2 translate-x-1/2 z-40 flex flex-col gap-4 w-8">
            <div className="flex flex-col items-center gap-2 bg-background/90 backdrop-blur-sm p-1.5 rounded-full shadow-lg border">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-6 rounded-full" onClick={() => onScrollToPage(0)}>
                                <ChevronsUp className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left">Jump to Start</TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <div className="flex flex-col items-center gap-1 my-1">
                    <Input
                        type="number"
                        className="w-full h-8 px-0.5 text-center text-xs appearance-none [&::-webkit-inner-spin-button]:appearance-none focus-visible:ring-0 focus-visible:ring-offset-0 border border-input shadow-none"
                        placeholder="#"
                        value={targetPage}
                        onChange={(e) => setTargetPage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleJump()}
                        title="Type page number"
                    />
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={handleJump} disabled={!targetPage}>
                        <CornerDownLeft className="h-3 w-3" />
                    </Button>
                </div>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-6 rounded-full" onClick={() => {
                                onScrollToPage(totalPages - 1);
                                setTimeout(() => onScrollToPage(totalPages - 1), 100);
                            }}>
                                <ChevronsDown className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left">Jump to End</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            <div className="flex flex-col items-center gap-2 bg-background/90 backdrop-blur-sm p-1.5 rounded-full shadow-lg border">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-6 rounded-full" onClick={() => handleStepJump('up')}>
                                <ChevronUp className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left">Jump Up</TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <div className="flex flex-col items-center gap-1 my-1">
                    <Input
                        type="number"
                        className="w-full h-8 px-0.5 text-center text-xs appearance-none [&::-webkit-inner-spin-button]:appearance-none focus-visible:ring-0 focus-visible:ring-offset-0 border border-input shadow-none"
                        value={stepSize}
                        onChange={(e) => setStepSize(e.target.value)}
                        title="Pages to jump"
                    />
                </div>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-6 rounded-full" onClick={() => handleStepJump('down')}>
                                <ChevronDown className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left">Jump Down</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        </div>
    );
}

// --- Scroll To Top ---
function ScrollToTopButton({ onScrollToTop, scrollOffset }: { onScrollToTop: () => void, scrollOffset: number }) {
    const isVisible = scrollOffset > 100;

    return (
        <Button
            variant="secondary"
            size="icon"
            className={cn(
                "absolute bottom-6 right-2 z-49 rounded-full shadow-lg transition-all duration-300",
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
            )}
            onClick={onScrollToTop}
        >
            <ArrowUp className="h-5 w-5" />
        </Button>
    );
}

// Item Data Interface
interface ItemData {
    pages: AlbumPage[];
    config: AlbumConfig;
    pageInfo: any;
    onOpenEditor?: (pageId: string) => void;
    onEnhanceWithAi?: (pageId: string) => void;
    onUndo?: (pageId: string) => void;
    onRedo?: (pageId: string) => void;
    onToggleLock?: (pageId: string) => void;
    onMovePage?: (pageId: string, direction: 'up' | 'down') => void;
    // Pass all other props that Row needs
    [key: string]: any;
}

// Item Renderer outside of component to maintain identity
const Row = memo(({ index, style, ariaAttributes, ...data }: any) => {
    const { pages, config, pageInfo, onOpenEditor, onEnhanceWithAi, onEnhancePhotoWithAi, onUndo, onRedo, onToggleLock, onMovePage, pageMaxWidth, ...rest } = data;
    const page = pages?.[index];
    if (!page) return null;

    // Calculate previousPagePhotos for suggestion fan
    const previousPagePhotos = index > 0 ? (pages[index - 1]?.photos || []) : [];
    const isMovablePage = (candidate?: AlbumPage) => !!candidate && !candidate.isCover && candidate.type !== 'single';
    const canMoveUp = index > 0 && isMovablePage(page) && isMovablePage(pages[index - 1]);
    const canMoveDown = index < pages.length - 1 && isMovablePage(page) && isMovablePage(pages[index + 1]);

    // Only eager load the first page (index 0) and the second (index 1) which is usually partial or cover
    // index < 2 covers: 0 (Cover/First Page), 1 (Back Cover/Second Page)
    const isPriority = index < 2;

    if (isPriority) {
        logger.debug('[VirtualizedRow] rendering priority row:', index);
    } else {
        // Log every 10th row for non-priority to avoid flooding, but enough to see if it renders everything
        if (index % 10 === 0) {
            logger.debug('[VirtualizedRow] rendering row:', index);
        }
    }

    return (
        <div style={style} className="flex justify-center w-full px-4" data-page-id={page.id}>
            <div
                className="w-full flex flex-col justify-start pt-10"
                style={pageMaxWidth ? { maxWidth: `${pageMaxWidth}px` } : undefined}
            >
                <PageCanvas
                    page={page}
                    pageIndex={index}
                    config={config}
                    previousPagePhotos={previousPagePhotos}
                    displayLabel={pageInfo[index]?.label}
                    onOpenEditor={onOpenEditor}
                    onEnhanceWithAi={onEnhanceWithAi}
                    onEnhancePhotoWithAi={onEnhancePhotoWithAi}
                    onUndo={onUndo}
                    onRedo={onRedo}
                    onToggleLock={onToggleLock}
                    onMovePage={onMovePage}
                    canMoveUp={canMoveUp}
                    canMoveDown={canMoveDown}
                    priority={isPriority}
                    {...(rest as any)}
                />
            </div>
        </div>
    );
});

export const VirtualizedPageList = memo(forwardRef(({
    pages,
    config,
    onOpenEditor,
    onEnhanceWithAi,
    onEnhancePhotoWithAi,
    onUndo,
    onRedo,
    onToggleLock,
    onMovePage,
    pageMaxWidth,
    ...props
}: VirtualizedPageListProps, ref) => {
    const listRef = useRef<any>(null);
    const { containerRef, width, height } = useContainerSize();
    const [scrollOffset, setScrollOffset] = useState(0);
    const [centeredPageIndex, setCenteredPageIndex] = useState(0);
    const [centeredPageId, setCenteredPageId] = useState<string | null>(null);

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
        scrollToPage: (index: number) => {
            scrollToPageCentered(index);
        },
        getCurrentPageIndex: () => centeredPageIndex
    }));


    // Calculate Page Info for Navigation
    const pageInfo = useMemo(() => {
        let counter = 1;
        return pages.map(page => {
            if (page.isCover) return { label: "Cover", start: 0, end: 0, isCover: true };
            if (page.type === 'spread') {
                const start = counter;
                const end = counter + 1;
                counter += 2;
                return { label: `Pages ${start}-${end}`, start, end, isCover: false };
            }
            const current = counter;
            counter += 1;
            return { label: `Page ${current}`, start: current, end: current, isCover: false };
        });
    }, [pages]);

    // Memoize Item Data to prevent unnecessary Row re-renders
    const itemData = useMemo<ItemData>(() => ({
        pages,
        config,
        pageInfo,
        onOpenEditor,
        onEnhanceWithAi,
        onEnhancePhotoWithAi,
        onUndo,
        onRedo,
        onToggleLock,
        onMovePage,
        pageMaxWidth,
        ...props
    }), [pages, config, pageInfo, onOpenEditor, onEnhanceWithAi, onEnhancePhotoWithAi, onUndo, onRedo, onToggleLock, onMovePage, pageMaxWidth, props]);

    // Manual Centered Scrolling Logic
    const scrollToPageCentered = useCallback((index: number) => {
        if (!listRef.current || !listRef.current.element) return;

        // Calculate offset manually to ensure exact centering
        let offset = 0;
        for (let i = 0; i < index; i++) {
            offset += getPageHeight(i, pages, config, width, height, pageMaxWidth);
        }

        const fullPageHeight = getPageHeight(index, pages, config, width, height, pageMaxWidth);
        const isLast = index === pages.length - 1;

        // Use exactly the same padding variables as getPageHeight
        const paddingTop = 20;

        // Debug: Inspect listRef to understand what we are working with
        logger.debug('listRef keys:', Object.keys(listRef.current || {}));
        const el = listRef.current?.element || listRef.current?.outerRef?.current; // Handle different libs

        // Standard geometric centering for most pages. 
        // This is the most reliable way to center the entire "Spread UI" in the view.
        let targetScrollTop = offset + (fullPageHeight / 2) - (height / 2);

        // console.log('[scrollToPageCentered] Scrolling to:', targetScrollTop, 'isLast:', isLast, 'scrollHeight:', el?.scrollHeight);

        // Clamp
        if (targetScrollTop < 0) targetScrollTop = 0;

        // Execute scroll in correct context
        const performScroll = () => {
            if (listRef.current && typeof listRef.current.scrollToRow === 'function') {
                listRef.current.scrollToRow({
                    index,
                    align: 'center',
                    behavior: 'auto' // standard scroll window behavior
                });
            } else if (el) {
                if (isLast) {
                    el.scrollTop = el.scrollHeight;
                } else {
                    el.scrollTo({
                        top: targetScrollTop,
                        behavior: 'smooth'
                    });
                }
            }
        };

        setTimeout(performScroll, 0);
    }, [pages, config, width, height, pageMaxWidth]);



    // Efficiently determine which page is centered during scroll
    const onScroll = useCallback((e: any) => {
        // Handle both standard react-window ({scrollOffset}) and native (event) scroll params
        const actualOffset = typeof e.scrollOffset === 'number' ? e.scrollOffset : e.currentTarget?.scrollTop;

        if (actualOffset === undefined) return;

        setScrollOffset(actualOffset);

        if (height <= 0 || width <= 0 || typeof actualOffset !== 'number') return;

        // Find the page whose CENTER is closest to the viewport CENTER
        // Use robust distance check instead of intersection
        const viewportCenter = actualOffset + (height / 2);

        let currentOffset = 0;
        let closestIndex = 0;
        let minDistance = Number.MAX_VALUE;

        for (let i = 0; i < pages.length; i++) {
            const h = getPageHeight(i, pages, config, width, height, pageMaxWidth);
            const pageCenter = currentOffset + (h / 2);
            const dist = Math.abs(pageCenter - viewportCenter);

            if (dist < minDistance) {
                minDistance = dist;
                closestIndex = i;
            }

            currentOffset += h;
        }

        // console.log('[VirtualizedPageList] actualOffset:', actualOffset, 'closestIndex:', closestIndex);
        setCenteredPageIndex(closestIndex);

    }, [pages, config, width, height, pageMaxWidth]);

    // Force list recalculation when container size or data changes
    useEffect(() => {
        // In react-window v2.2.5, it might use a different method or automatically handle it via rowHeight memo
        // But if resetAfterIndex exists, we call it.
        const ref = listRef.current;
        if (ref && typeof ref.resetAfterIndex === 'function') {
            ref.resetAfterIndex(0);
        }
    }, [width, height, pages.length]);

    // NOTE: accessing onRowsRendered instead of onItemsRendered for this custom lib
    const onRowsRendered = useCallback(({ startIndex }: { startIndex: number }) => {
        // We prefer centeredPageIndex calculated in onScroll
    }, []);

    return (
        <div ref={containerRef} className="flex-1 h-full w-full relative h-[91vh]" style={{ minHeight: 0 }}>
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: hsl(var(--primary) / 0.3);
                    border-radius: 9999px;
                    border: 2px solid transparent;
                    background-clip: content-box;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background-color: hsl(var(--primary) / 0.5);
                }
            `}</style>

            {width > 0 && height > 0 ? (
                <>
                    <VirtualWindowList
                        listRef={listRef}
                        height={height}
                        width={width}
                        rowCount={pages.length}
                        rowHeight={(index: number) => getPageHeight(index, pages, config, width, height, pageMaxWidth)}
                        rowProps={itemData}
                        rowComponent={Row as any}
                        className="custom-scrollbar"
                        overscanCount={1}
                        onScroll={onScroll}
                    />
                    <NavigationControls
                        onScrollToPage={scrollToPageCentered}
                        totalPages={pages.length}
                        pageInfo={pageInfo}
                        currentPageIndex={centeredPageIndex}
                    />
                    <ScrollToTopButton
                        onScrollToTop={() => scrollToPageCentered(0)}
                        scrollOffset={scrollOffset}
                    />
                </>
            ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                    Initializing layout...
                </div>
            )}
        </div>
    );
}));

VirtualizedPageList.displayName = 'VirtualizedPageList';
