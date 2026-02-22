'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual'; // NEW
import {
    Loader2,
    Sparkles,
    Wand2,
    AlertTriangle,
    Image as ImageIcon,
    FolderUp,
    Upload,
    Eraser,
    RotateCcw,
    ArrowUpDown,
    Check,
    Calendar,
    Hash,
    Trash2,
    Search,
    X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Switch } from "@/components/ui/switch";
import { Input } from '@/components/ui/input';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, TooltipArrow } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Photo } from '@/lib/types';
import { ScrollToTopButton } from '../../shared/scroll-to-top-button';
import { GalleryImage } from '@/components/gallery/gallery-image'; // NEW

interface PhotoGalleryCardProps {
    allPhotos: Photo[];
    isLoadingPhotos: boolean;
    isResizing?: boolean;
    photoUsageDetails: Record<string, { count: number; pages: number[] }>;
    chronologicalIndex: Record<string, number>;
    emptySlots: number; // Number of empty slots remaining in album
    allowDuplicates: boolean;
    setAllowDuplicates: (value: boolean) => void;
    multiSelectMode: boolean; // true = checkboxes, false = trash icons
    setMultiSelectMode: (value: boolean) => void;
    randomSeed: string | null;
    // Actions
    generateDummyPhotos: () => void;
    handleGenerateAlbum: () => void;
    handleAutoFillAlbum: () => void;
    handleClearGallery: () => void;
    handleResetAlbum: () => void;
    handleSortPhotos: () => void;
    processUploadedFiles: (input: FileList | DataTransferItemList | null) => void;
    onDeletePhotos: (ids: string[]) => void;
    onRemovePhotosFromAlbum: (ids: string[]) => void;
    // Refs 
    photoScrollRef: React.RefObject<HTMLDivElement | null>;
    folderUploadRef: React.RefObject<HTMLInputElement | null>;
    photoUploadRef: React.RefObject<HTMLInputElement | null>;
}



const GalleryPhotoItemComponent = ({
    photo,
    usage,
    index,
    isSelected,
    isActiveBubble,
    multiSelectMode,
    onToggleSelection,
    onSetActiveBubbleId,
    onDelete,
    onRemoveFromAlbum,
    style,
    onDimensionsLoaded,
    priority, // Destructure priority
    isHighlighted,
    onDragStart
}: {
    photo: Photo;
    usage?: { count: number; pages: number[] };
    index: number | string;
    isSelected: boolean;
    isActiveBubble: boolean;
    multiSelectMode: boolean;
    onToggleSelection: (id: string) => void;
    onSetActiveBubbleId: (id: string | null) => void;
    onDelete: (id: string) => void;
    onRemoveFromAlbum: (id: string) => void;
    style?: React.CSSProperties;
    onDimensionsLoaded?: (id: string, width: number, height: number) => void;
    priority?: boolean;
    isHighlighted?: boolean;
    onDragStart?: (e: React.DragEvent, photoId: string) => void;
}) => {
    const isUsed = !!usage;
    const hasWarning = usage && usage.count > 1;

    // Callbacks for this specific item to avoid creating inline functions in render
    const handleDragStart = useCallback((e: React.DragEvent) => {
        // photo.isUploading check REMOVED to allow optimistic dragging
        e.dataTransfer.setData('photoId', photo.id);
        if (onDragStart) {
            onDragStart(e, photo.id);
        }
    }, [photo.id, onDragStart]);

    // Simple handlers
    const handleMouseEnter = useCallback(() => onSetActiveBubbleId(photo.id), [photo.id, onSetActiveBubbleId]);
    const handleMouseLeave = useCallback(() => onSetActiveBubbleId(null), [onSetActiveBubbleId]);
    const handleToggleSelection = useCallback(() => onToggleSelection(photo.id), [photo.id, onToggleSelection]);

    // Stop propagation wrapper
    const stopPropagation = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

    // Handlers for Alert Dialog
    const handleConfirmDelete = useCallback(() => {
        if (isUsed) {
            onRemoveFromAlbum(photo.id);
        }
        onDelete(photo.id);
    }, [photo.id, isUsed, onRemoveFromAlbum, onDelete]);

    return (
        <div
            draggable={true}
            onDragStart={handleDragStart}
            style={style}
            className={cn(
                "relative rounded-md overflow-hidden bg-muted border-2 transition-all group border-transparent cursor-grab active:cursor-grabbing hover:border-primary/50",
                isHighlighted && "animate-photo-highlight"
            )}
        >
            <div className="relative h-full w-full transition-opacity duration-300 select-none">
                <GalleryImage
                    src={photo.remoteUrl || photo.src}
                    alt={photo.alt}
                    size="thumbnail"
                    className="w-full h-full block object-cover"
                    containerClassName="w-full h-full"
                    aspectRatio={undefined}
                    draggable={false}
                    fill
                    priority={priority}
                    sizes="(max-width: 768px) 33vw, 20vw"
                    onLoadingComplete={(img) => {
                        if (img.naturalWidth && img.naturalHeight) {
                            onDimensionsLoaded?.(photo.id, img.naturalWidth, img.naturalHeight);
                        }
                    }}
                />
            </div>

            {/* Top Overlays: Index, Usage (Right) */}
            <div className="absolute top-0 left-0 w-full p-2 flex items-center z-30 pointer-events-none">
                {/* Left: Index */}
                <Badge variant="secondary" className="h-5 px-2 text-[10px] bg-black/60 text-white border-0 backdrop-blur-md font-bold">
                    #{index}
                </Badge>

                {/* Right: Usage Indicator */}
                <div className="pointer-events-auto relative ml-auto">
                    {isUsed && (
                        <TooltipProvider delayDuration={0}>
                            <Tooltip open={isActiveBubble} onOpenChange={(open) => onSetActiveBubbleId(open ? photo.id : null)}>
                                <TooltipTrigger asChild>
                                    <div
                                        className={cn(
                                            "h-4 w-4 rounded-full flex items-center justify-center border-1 backdrop-blur-md shadow-xl transition-all cursor-help",
                                            hasWarning ? "border-0 rounded-none bg-destructive text-red-500 bg-transparent" : "bg-black/40 border-white text-green-500"
                                        )}
                                        onMouseEnter={handleMouseEnter}
                                        onMouseLeave={handleMouseLeave}
                                    >
                                        {hasWarning ? <AlertTriangle className="h-3 w-3" /> : <Check className="h-3 w-3 stroke-[3]" />}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent
                                    side="bottom"
                                    align="end"
                                    sideOffset={2}
                                    className="z-[9999] max-w-[250px] p-0 overflow-visible border-none shadow-xl"
                                >
                                    <TooltipArrow className="fill-popover" />
                                    <div className="p-2 space-y-1">
                                        <p className="text-[10px] text-muted-foreground font-medium">Appears on pages:</p>
                                        <div className="flex flex-wrap gap-1">
                                            {usage.pages.map(p => (
                                                <Badge key={p} variant="secondary" className="h-4 text-[9px] px-1.5 font-medium">
                                                    {p === 0 ? 'Cover' : `Page ${p}`}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
            </div>

            {/* Bottom Left: Selection / Trash */}
            <div className="absolute bottom-2 left-2 z-20 pointer-events-auto" onClick={stopPropagation}>
                {multiSelectMode ? (
                    <Checkbox
                        checked={isSelected}
                        onCheckedChange={handleToggleSelection}
                        style={{
                            width: '20px',
                            height: '20px',
                            color: 'white',
                            borderRadius: '5px',
                            borderWidth: '1px',
                            backgroundColor: '#0000002b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                        className="border-white/60 shadow-lg data-[state=checked]:bg-[#0000002b] data-[state=checked]:text-white data-[state=checked]:border-white/80 transition-none transform-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
                    />
                ) : (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <button className="p-1.5 bg-black/40 hover:bg-destructive text-white rounded-full transition-colors backdrop-blur-sm">
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    {isUsed
                                        ? 'This photo is used in the album. Deleting will remove it from album pages.'
                                        : 'This action cannot be undone.'}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90">
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </div>

            {/* Bottom Right: Date */}
            {photo.captureDate && (
                <div className="absolute bottom-2 right-2 z-20 pointer-events-none">
                    <div className="bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] text-white font-medium flex flex-col items-end leading-tight">
                        <span>{new Date(photo.captureDate).toLocaleDateString()}</span>
                        <span className="text-[8px] opacity-80">{new Date(photo.captureDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

const GalleryPhotoItem = React.memo(GalleryPhotoItemComponent, (prev, next) => {
    // Check primitive props
    if (prev.photo.id !== next.photo.id) return false;
    if (prev.photo.isUploading !== next.photo.isUploading) return false;
    // We can assume src/alt don't change often for the same ID, or check them if needed
    // if (prev.photo.src !== next.photo.src) return false;

    if (prev.index !== next.index) return false;
    if (prev.isSelected !== next.isSelected) return false;
    if (prev.isActiveBubble !== next.isActiveBubble) return false;
    if (prev.multiSelectMode !== next.multiSelectMode) return false;
    if (prev.isHighlighted !== next.isHighlighted) return false;
    // onDragStart is a function, ignore diff or check ref equality (usually stable)

    // Check usage object deeply-ish
    const prevUsage = prev.usage;
    const nextUsage = next.usage;

    if (!!prevUsage !== !!nextUsage) return false; // One is undefined, one is defined
    if (prevUsage && nextUsage) {
        if (prevUsage.count !== nextUsage.count) return false;
        if (prevUsage.pages.length !== nextUsage.pages.length) return false;
        // Check page arrays (usually short)
        for (let i = 0; i < prevUsage.pages.length; i++) {
            if (prevUsage.pages[i] !== nextUsage.pages[i]) return false;
        }
    }

    return true;
});

const VirtualGalleryContent = React.forwardRef(({
    isSingleColumn,
    filteredPhotos,
    displayRows,
    photoUsageDetails,
    chronologicalIndex,
    selectedPhotos,
    activeBubbleId,
    multiSelectMode,
    toggleSelection,
    setActiveBubbleId,
    onDeletePhotos,
    onRemovePhotosFromAlbum,
    parentRef,
    onDimensionsLoaded,
    containerWidth,
    highlightedPhotoId
}: {
    isSingleColumn: boolean;
    filteredPhotos: Photo[];
    displayRows: { photos: Photo[]; height: number; isLast?: boolean }[];
    photoUsageDetails: any;
    chronologicalIndex: any;
    selectedPhotos: Set<string>;
    activeBubbleId: string | null;
    multiSelectMode: boolean;
    toggleSelection: (id: string) => void;
    setActiveBubbleId: (id: string | null) => void;
    onDeletePhotos: (ids: string[]) => void;
    onRemovePhotosFromAlbum: (ids: string[]) => void;
    parentRef: React.RefObject<HTMLDivElement | null>;
    onDimensionsLoaded: (id: string, width: number, height: number) => void;
    containerWidth: number;
    highlightedPhotoId: string | null;
}, ref) => {
    const count = displayRows.length;
    // Gap is now handled via padding on the row wrapper
    const gap = 2;
    // Match the justifiedRows calculation padding (ScrollArea pr-4 + pl-1 = 20px)
    const usableWidth = Math.max(100, containerWidth - 20);

    // CRITICAL: Use a ref to always have the LATEST selectedPhotos at drag time
    // This fixes the stale closure issue where memo'd GalleryPhotoItem has old callbacks
    const selectedPhotosRef = useRef(selectedPhotos);
    selectedPhotosRef.current = selectedPhotos; // Update on every render

    const virtualizer = useVirtualizer({
        count,
        getScrollElement: () => parentRef.current,
        estimateSize: (index) => {
            return displayRows[index] ? displayRows[index].height + 2 : 140;
        },
        overscan: 20
    });

    // Force remeasure when displayRows change to prevent stale heights
    useLayoutEffect(() => {
        virtualizer.measure();
    }, [displayRows, containerWidth, virtualizer]);

    // Expose scrollToPhoto via ref
    React.useImperativeHandle(ref, () => ({
        scrollToPhoto: (photoId: string) => {
            const rowIndex = displayRows.findIndex(row => row.photos.some(p => p.id === photoId));
            if (rowIndex !== -1) {
                // Use default 'auto' behavior since 'smooth' scrolling fails over large distances 
                // in virtualized lists due to dynamic item measurement.
                virtualizer.scrollToIndex(rowIndex, { align: 'center', behavior: 'auto' });
            }
        }
    }));

    // Force remeasure and scroll to top when layout mode changes to prevent stale height glitches
    useEffect(() => {
        virtualizer.measure();
        virtualizer.scrollToOffset(0);
    }, [isSingleColumn, virtualizer]);

    const items = virtualizer.getVirtualItems();

    return (
        <div
            style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
            }}
        >
            {items.map((virtualRow) => {
                const row = displayRows[virtualRow.index];
                if (!row) return null;

                const style = {
                    position: 'absolute' as const,
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                };

                return (
                    <div
                        key={`${virtualRow.key}-${containerWidth}-${isSingleColumn}`}
                        ref={virtualizer.measureElement}
                        data-index={virtualRow.index}
                        style={{ ...style, paddingBottom: `${gap}px` }}
                        className="flex flex-row gap-[2px]"
                    >
                        {row.photos.map((photo) => {
                            const ar = (photo.width && photo.height) ? photo.width / photo.height : 1.0;
                            const photoPixelWidth = row.height * ar;

                            return (
                                <GalleryPhotoItem
                                    key={photo.id}
                                    photo={photo}
                                    usage={photoUsageDetails?.[photo.id]}
                                    index={chronologicalIndex[photo.id] ?? '?'}
                                    isSelected={selectedPhotos.has(photo.id)}
                                    isActiveBubble={activeBubbleId === photo.id}
                                    multiSelectMode={multiSelectMode}
                                    onToggleSelection={toggleSelection}
                                    onSetActiveBubbleId={setActiveBubbleId}
                                    onDelete={(id) => onDeletePhotos([id])}
                                    onRemoveFromAlbum={(id) => onRemovePhotosFromAlbum([id])}
                                    onDimensionsLoaded={onDimensionsLoaded}
                                    onDragStart={(e, id) => {
                                        // CRITICAL: Use ref to get LATEST selection, bypassing stale closure
                                        const currentSelection = selectedPhotosRef.current;
                                        // Only use multi-select mode (dynamic justified) when 2+ photos are selected
                                        // AND the dragged photo is one of the selected ones
                                        if (currentSelection.has(id) && currentSelection.size > 1) {
                                            const ids = Array.from(currentSelection);
                                            e.dataTransfer.setData('selectedPhotoIds', JSON.stringify(ids));
                                        }
                                        // Always set the single photo ID for normal drop targets
                                        e.dataTransfer.setData('photoId', id);
                                    }}
                                    style={{
                                        height: `${row.height}px`,
                                        width: `${photoPixelWidth}px`,
                                        flexShrink: 0,
                                    }}
                                    priority={virtualRow.index < 30}
                                    isHighlighted={photo.id === highlightedPhotoId}
                                />
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
});

import { useAlbumEditor } from '../../album-editor/context';
import { useSettings } from '@/hooks/use-settings';

const PhotoGalleryCardComponent = ({
    allPhotos,
    isLoadingPhotos,
    photoUsageDetails,
    chronologicalIndex,
    emptySlots,
    allowDuplicates,
    setAllowDuplicates,
    multiSelectMode,
    setMultiSelectMode,
    randomSeed,
    generateDummyPhotos,
    handleGenerateAlbum,
    handleAutoFillAlbum,
    handleClearGallery,
    handleResetAlbum,
    handleSortPhotos,
    processUploadedFiles,
    onDeletePhotos,
    onRemovePhotosFromAlbum,
    photoScrollRef,
    folderUploadRef,
    photoUploadRef,
    isResizing = false
}: PhotoGalleryCardProps) => {
    const { settings } = useSettings();
    const { registerGalleryScroll, highlightedPhotoId } = useAlbumEditor();
    const virtualContentRef = useRef<{ scrollToPhoto: (photoId: string) => void }>(null);

    useEffect(() => {
        registerGalleryScroll((photoId) => {
            virtualContentRef.current?.scrollToPhoto(photoId);
        });
    }, [registerGalleryScroll]);

    const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
    const [activeBubbleId, setActiveBubbleId] = useState<string | null>(null);
    const [dimensionsCache, setDimensionsCache] = useState<Record<string, { width: number; height: number }>>({});
    const hasSortedRef = useRef(false);

    useEffect(() => {
        if (!hasSortedRef.current && allPhotos.length > 0) {
            handleSortPhotos();
            hasSortedRef.current = true;
        }
    }, [allPhotos.length, handleSortPhotos]);

    const handlePhotoDimensionsLoaded = useCallback((id: string, width: number, height: number) => {
        setDimensionsCache(prev => {
            if (prev[id]?.width === width && prev[id]?.height === height) return prev;
            return { ...prev, [id]: { width, height } };
        });
    }, []);

    const [hideUsedPhotos, setHideUsedPhotos] = useState(false);
    const [isSingleColumn, setIsSingleColumn] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Track container width for justified layout
    const [containerWidth, setContainerWidth] = useState(0); // Initialize at 0 to wait for measurement
    const containerRef = useRef<HTMLDivElement>(null);
    const resizeTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

    useEffect(() => {
        const target = photoScrollRef.current || containerRef.current;
        if (!target) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                // Debounce layout updates to prevent thrashing and visual glitches while resizing
                if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);

                resizeTimeoutRef.current = setTimeout(() => {
                    setContainerWidth(Math.floor(entry.contentRect.width));
                }, 100); // Reduced delay for better responsiveness while maintaining stability
            }
        });

        observer.observe(target);

        return () => {
            observer.disconnect();
            if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
        };
    }, [photoScrollRef, containerRef]);

    const isClient = typeof window !== 'undefined';

    // Cache for justified rows - used during resize to prevent expensive recalculation
    const cachedRowsRef = useRef<{ photos: Photo[]; height: number; isLast?: boolean }[]>([]);

    // Filtered photos
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();

    const filteredPhotos = useMemo(() => {
        const usageFilteredPhotos = hideUsedPhotos
            ? allPhotos.filter(p => !photoUsageDetails[p.id])
            : allPhotos;

        if (!normalizedSearchQuery) {
            return usageFilteredPhotos;
        }

        return usageFilteredPhotos.filter(photo => (photo.alt || '').toLowerCase().includes(normalizedSearchQuery));
    }, [allPhotos, hideUsedPhotos, photoUsageDetails, normalizedSearchQuery]);

    // Merge dimensions from cache
    const effectivePhotos = useMemo(() => {
        return filteredPhotos.map(p => {
            const cached = dimensionsCache[p.id];
            if (cached) {
                // Prioritize cached dimensions (loaded from actual image) over DB metadata
                return { ...p, width: cached.width, height: cached.height };
            }
            return p;
        });
    }, [filteredPhotos, dimensionsCache]);

    // Invalidate row cache immediately when mode or photos change to prevent stale layouts
    // Done in render to avoid 1-frame flicker before useEffect runs
    const lastModeRef = useRef(isSingleColumn);
    const lastPhotosRef = useRef(effectivePhotos);

    if (lastModeRef.current !== isSingleColumn || lastPhotosRef.current !== effectivePhotos) {
        cachedRowsRef.current = [];
        lastModeRef.current = isSingleColumn;
        lastPhotosRef.current = effectivePhotos;
    }

    // Justified Layout Calculation
    const justifiedRows = useMemo(() => {
        if (containerWidth === 0) return []; // Wait for measurement

        // UNIFIED PADDING CONSTANT: Must match VirtualGalleryContent logic
        // Updated to 20px to match ScrollArea pr-4 (16px) + pl-1 (4px)
        const padding = 20;
        const effectiveWidth = Math.max(100, containerWidth - padding);

        const gap = 2;

        // Density rules for Wide View vs Normal View
        const maxPhotos = isSingleColumn
            ? (effectiveWidth < 400 ? 1 : 2) // Wide View: 1 narrow, max 2 wide
            : (effectiveWidth < 450 ? 2 : 3); // Normal View: 2 narrow, 3 wide

        // Adjusted target AR based on mode to encourage larger photos in Wide View
        const targetARSum = isSingleColumn
            ? Math.max(0.8, effectiveWidth / 350)
            : Math.max(1.0, effectiveWidth / 200);

        const rows: { photos: Photo[]; height: number; isLast?: boolean }[] = [];
        let currentRow: Photo[] = [];
        let currentRowARSum = 0;

        for (const photo of effectivePhotos) {
            const ar = (photo.width && photo.height) ? photo.width / photo.height : 1.0;

            currentRow.push(photo);
            currentRowARSum += ar;

            const isLastPhotoInSource = photo.id === effectivePhotos[effectivePhotos.length - 1].id;

            const hitMaxLimit = currentRow.length >= maxPhotos;
            const reachedTarget = currentRowARSum >= targetARSum;

            if (hitMaxLimit || reachedTarget || isLastPhotoInSource) {
                const usableWidth = effectiveWidth - (currentRow.length - 1) * gap;
                let rowHeight = usableWidth / currentRowARSum;

                rows.push({ photos: currentRow, height: rowHeight });
                currentRow = [];
                currentRowARSum = 0;
            }
        }

        return rows;
    }, [effectivePhotos, containerWidth, isSingleColumn]);

    // Use cached rows during resize to prevent layout thrashing, 
    // but ONLY if the cache is actually populated and valid for the current mode.
    if (!isResizing && justifiedRows.length > 0) {
        cachedRowsRef.current = justifiedRows;
    }
    const displayRows = (isResizing && cachedRowsRef.current.length > 0)
        ? cachedRowsRef.current
        : justifiedRows;

    const toggleSelection = (id: string) => {
        setSelectedPhotos(prev => {
            const newSelected = new Set(prev);
            if (newSelected.has(id)) {
                newSelected.delete(id);
            } else {
                newSelected.add(id);
            }
            return newSelected;
        });
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedPhotos(new Set(filteredPhotos.map(p => p.id)));
        } else {
            setSelectedPhotos(new Set());
        }
    };

    const handleDeleteSelected = () => {
        onDeletePhotos(Array.from(selectedPhotos));
        setSelectedPhotos(new Set());
    };

    const handleDeleteUnusedOnly = () => {
        const unusedIds = Array.from(selectedPhotos).filter(id => !photoUsageDetails[id]);
        onDeletePhotos(unusedIds);
        setSelectedPhotos(new Set());
    };

    const handleDeleteAllAndRemoveFromAlbum = () => {
        const usedIds = Array.from(selectedPhotos).filter(id => photoUsageDetails[id]);
        if (usedIds.length > 0) {
            onRemovePhotosFromAlbum(usedIds);
        }
        onDeletePhotos(Array.from(selectedPhotos));
        setSelectedPhotos(new Set());
    };

    // Calculate usage stats for selected photos
    const selectedUsedCount = Array.from(selectedPhotos).filter(id => photoUsageDetails[id]).length;
    const selectedUnusedCount = selectedPhotos.size - selectedUsedCount;

    const usedCount = Object.keys(photoUsageDetails).length;

    return (
        <div className="h-full space-y-0">
            <div
                ref={containerRef}
                className="h-full flex flex-col bg-background border-l shadow-none rounded-none"
                onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }}
                onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
                        processUploadedFiles(e.dataTransfer.items);
                    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        processUploadedFiles(e.dataTransfer.files);
                    }
                }}
            >
                <div className="px-3 py-2 border-b space-y-2 bg-background z-10">
                    <div className="flex items-center justify-between">
                        <h2 className="font-semibold text-sm">Photo Gallery</h2>
                        <div className="flex items-center gap-1">
                            {/* Icon Buttons */}
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={generateDummyPhotos} disabled={isLoadingPhotos || !randomSeed}>
                                            {isLoadingPhotos ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Load sample photos</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => folderUploadRef.current?.click()}>
                                            <FolderUp className="h-3 w-3" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Upload folder</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => photoUploadRef.current?.click()}>
                                            <Upload className="h-3 w-3" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Upload photos</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleGenerateAlbum}>
                                            <Wand2 className="h-3 w-3" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Auto-fill Album (Regenerate)</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleAutoFillAlbum}>
                                            <RotateCcw className="h-3 w-3 rotate-90" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Fill Empty Slots (Keep Layout)</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={handleSortPhotos}
                                            disabled={isLoadingPhotos || allPhotos.some(p => p.isUploading)}
                                        >
                                            <ArrowUpDown className="h-3 w-3" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Sort by Number</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            {/* Deletion Control */}
                            {selectedPhotos.size > 0 && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="sm" className="h-8 px-2 text-xs ml-1">
                                            <Trash2 className="h-3 w-3 mr-1" />
                                            Delete ({selectedPhotos.size})
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Delete {selectedPhotos.size} photos?</AlertDialogTitle>
                                            <AlertDialogDescription asChild>
                                                <div className="space-y-2">
                                                    {selectedUsedCount > 0 ? (
                                                        <>
                                                            <p className="text-sm"><strong>{selectedUnusedCount}</strong> photos are not used in the album</p>
                                                            <p className="text-sm text-destructive"><strong>{selectedUsedCount}</strong> photos are currently used in the album</p>
                                                        </>
                                                    ) : (
                                                        <p>This action cannot be undone.</p>
                                                    )}
                                                </div>
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter className="flex-col gap-2 sm:justify-start">
                                            <AlertDialogCancel className="w-full sm:w-auto mt-0">Cancel</AlertDialogCancel>
                                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto justify-end">
                                                {selectedUsedCount > 0 && selectedUnusedCount > 0 && (
                                                    <AlertDialogAction onClick={handleDeleteUnusedOnly} className="bg-secondary text-secondary-foreground hover:bg-secondary/80 w-full sm:w-auto">
                                                        Delete Only Unused ({selectedUnusedCount})
                                                    </AlertDialogAction>
                                                )}
                                                <AlertDialogAction onClick={selectedUsedCount > 0 ? handleDeleteAllAndRemoveFromAlbum : handleDeleteSelected} className="bg-destructive hover:bg-destructive/90 w-full sm:w-auto">
                                                    {selectedUsedCount > 0 ? `Delete All & Remove from Album (${selectedPhotos.size})` : 'Delete'}
                                                </AlertDialogAction>
                                            </div>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </div>
                    </div>

                    {/* Secondary Toolbar */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                                <Checkbox
                                    id="multi-select-mode"
                                    checked={multiSelectMode}
                                    onCheckedChange={(c) => {
                                        setMultiSelectMode(!!c);
                                        if (!c) setSelectedPhotos(new Set());
                                    }}
                                />
                                <label htmlFor="multi-select-mode" className="text-[10px] leading-none cursor-pointer">בחירה מרובה</label>
                            </div>

                            <div className="h-3 w-px bg-border my-auto" />

                            <div className="flex items-center gap-1">
                                <Checkbox
                                    id="hide-used-photos"
                                    checked={hideUsedPhotos}
                                    onCheckedChange={(c) => setHideUsedPhotos(!!c)}
                                />
                                <label htmlFor="hide-used-photos" className="text-[10px] leading-none cursor-pointer">הסתר משובצות</label>
                            </div>

                            <div className="h-3 w-px bg-border my-auto" />

                            <div className="flex items-center gap-1">
                                <Switch
                                    id="single-col-mode"
                                    checked={isSingleColumn}
                                    onCheckedChange={setIsSingleColumn}
                                    className="scale-75 origin-left"
                                />
                                <label htmlFor="single-col-mode" className="text-[10px] leading-none cursor-pointer">תצוגה רחבה</label>
                            </div>

                            {multiSelectMode && (
                                <>
                                    <div className="h-3 w-px bg-border my-auto" />
                                    <div className="flex items-center gap-1">
                                        <Checkbox
                                            id="select-all"
                                            checked={filteredPhotos.length > 0 && selectedPhotos.size === filteredPhotos.length}
                                            onCheckedChange={handleSelectAll}
                                            disabled={filteredPhotos.length === 0}
                                        />
                                        <label htmlFor="select-all" className="text-[10px] leading-none cursor-pointer">
                                            הכל
                                        </label>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by image name..."
                            className="h-8 pl-7 pr-7 text-xs"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                aria-label="Clear search"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    <input ref={folderUploadRef} type="file" accept="image/*" multiple className="hidden"
                        {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
                        onChange={(e) => { processUploadedFiles(e.target.files); e.target.value = ''; }} />
                    <input ref={photoUploadRef} type="file" accept="image/*" multiple className="hidden"
                        onChange={(e) => { processUploadedFiles(e.target.files); e.target.value = ''; }} />
                </div >

                <div ref={containerRef} className="flex-1 overflow-hidden relative">
                    {allPhotos.length === 0 ? (
                        isLoadingPhotos ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center animate-in fade-in">
                                <Loader2 className="h-10 w-10 mb-2 animate-spin text-primary" />
                                <p className="text-sm">Loading photos...</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center space-y-4">
                                <div className="p-4 rounded-full bg-muted/50 border-2 border-dashed border-muted-foreground/20">
                                    <FolderUp className="h-8 w-8 text-primary/40" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="font-medium text-foreground">No photos yet</h3>
                                    <p className="text-sm text-muted-foreground max-w-[200px] mx-auto">
                                        Drag & drop photos or entire folders here to start designing
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => photoUploadRef.current?.click()}
                                    className="gap-2"
                                >
                                    <Upload className="h-3 w-3" />
                                    Select Photos
                                </Button>
                            </div>
                        )
                    ) : (
                        <ScrollArea
                            viewportRef={photoScrollRef}
                            className="h-full w-full pr-4 pl-1 py-1"
                            thumbClassName="min-h-[50px]"
                        >
                            <VirtualGalleryContent
                                ref={virtualContentRef}
                                isSingleColumn={isSingleColumn}
                                filteredPhotos={filteredPhotos}
                                displayRows={displayRows}
                                photoUsageDetails={photoUsageDetails}
                                chronologicalIndex={chronologicalIndex}
                                selectedPhotos={selectedPhotos}
                                activeBubbleId={activeBubbleId}
                                multiSelectMode={multiSelectMode}
                                toggleSelection={toggleSelection}
                                setActiveBubbleId={setActiveBubbleId}
                                onDeletePhotos={onDeletePhotos}
                                onRemovePhotosFromAlbum={onRemovePhotosFromAlbum}
                                parentRef={photoScrollRef}
                                onDimensionsLoaded={handlePhotoDimensionsLoaded}
                                containerWidth={containerWidth}
                                highlightedPhotoId={highlightedPhotoId}
                            />
                        </ScrollArea>
                    )}
                    {allPhotos.length > 0 && (
                        <div className="absolute bottom-16 right-6 z-[100]">
                            <ScrollToTopButton scrollAreaRef={photoScrollRef} />
                        </div>
                    )}
                </div>

                {/* Footer Bar with Photo Count and Action Buttons */}
                <div className="p-3 border-t bg-muted/30 flex flex-col gap-2">
                    <div className="flex items-center justify-center gap-2">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                                    <Eraser className="h-3 w-3" />
                                    Clear Gallery
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Clear entire gallery?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will remove all photos. This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleClearGallery}>Clear Gallery</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>

                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                                    <RotateCcw className="h-3 w-3" />
                                    Reset Album
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Reset album layout?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will remove all pages and photos from the album. The gallery will remain.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleResetAlbum}>Reset Album</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                    <p className="text-[11px] text-muted-foreground text-center px-1">
                        {allPhotos.length} photos total • {usedCount} used{emptySlots > 0 && ` • ${emptySlots} empty`} • {settings.duplicateUploadAction === 'ignore' ? 'Ignore dupes' : 'Overwrite dupes'}
                    </p>
                </div>
            </div>
        </div>
    );
};

export const PhotoGalleryCard = React.memo(PhotoGalleryCardComponent);
