'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
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
import { ScrollToTopButton } from './scroll-to-top-button';

interface PhotoGalleryCardProps {
    allPhotos: Photo[];
    isLoadingPhotos: boolean;
    photoUsageDetails: Record<string, { count: number; pages: number[] }>;
    chronologicalIndex: Record<string, number>;
    allowDuplicates: boolean;
    setAllowDuplicates: (value: boolean) => void;
    multiSelectMode: boolean; // true = checkboxes, false = trash icons
    setMultiSelectMode: (value: boolean) => void;
    randomSeed: string | null;
    // Actions
    generateDummyPhotos: () => void;
    handleGenerateAlbum: () => void;
    handleClearGallery: () => void;
    handleResetAlbum: () => void;
    handleSortPhotos: () => void;
    processUploadedFiles: (files: FileList | null) => void;
    onDeletePhotos: (ids: string[]) => void;
    onRemovePhotosFromAlbum: (ids: string[]) => void;
    // Refs
    photoScrollRef: React.RefObject<HTMLDivElement | null>;
    folderUploadRef: React.RefObject<HTMLInputElement | null>;
    photoUploadRef: React.RefObject<HTMLInputElement | null>;
}



export function PhotoGalleryCard({
    allPhotos,
    isLoadingPhotos,
    photoUsageDetails,
    chronologicalIndex,
    allowDuplicates,
    setAllowDuplicates,
    multiSelectMode,
    setMultiSelectMode,
    randomSeed,
    generateDummyPhotos,
    handleGenerateAlbum,
    handleClearGallery,
    handleResetAlbum,
    handleSortPhotos,
    processUploadedFiles,
    onDeletePhotos,
    onRemovePhotosFromAlbum,
    photoScrollRef,
    folderUploadRef,
    photoUploadRef,
}: PhotoGalleryCardProps) {
    const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
    const [activeBubbleId, setActiveBubbleId] = useState<string | null>(null);

    const [hideUsedPhotos, setHideUsedPhotos] = useState(false);

    const filteredPhotos = hideUsedPhotos
        ? allPhotos.filter(p => !photoUsageDetails[p.id])
        : allPhotos;

    const toggleSelection = (id: string) => {
        const newSelected = new Set(selectedPhotos);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedPhotos(newSelected);
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
        <div className="xl:col-span-3 space-y-4">
            <Card className="h-[85vh] flex flex-col">
                <CardHeader className="pb-3 border-b space-y-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="font-headline text-lg">Photo Gallery</CardTitle>
                        <div className="flex items-center gap-1">
                            {/* Sort Button - Now correctly placed in header */}
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={handleSortPhotos}
                                            disabled={isLoadingPhotos || allPhotos.some(p => p.isUploading)}
                                        >
                                            <ArrowUpDown className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Sort by Date</TooltipContent>
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
                                        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            {selectedUsedCount > 0 && selectedUnusedCount > 0 && (
                                                <AlertDialogAction onClick={handleDeleteUnusedOnly} className="bg-secondary text-secondary-foreground hover:bg-secondary/80">
                                                    Delete Only Unused ({selectedUnusedCount})
                                                </AlertDialogAction>
                                            )}
                                            <AlertDialogAction onClick={selectedUsedCount > 0 ? handleDeleteAllAndRemoveFromAlbum : handleDeleteSelected} className="bg-destructive hover:bg-destructive/90">
                                                {selectedUsedCount > 0 ? `Delete All & Remove from Album (${selectedPhotos.size})` : 'Delete'}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </div>
                    </div>

                    {/* Secondary Toolbar */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {multiSelectMode && (
                                <>
                                    <Checkbox
                                        id="select-all"
                                        checked={filteredPhotos.length > 0 && selectedPhotos.size === filteredPhotos.length}
                                        onCheckedChange={handleSelectAll}
                                        disabled={filteredPhotos.length === 0}
                                    />
                                    <label htmlFor="select-all" className="text-xs text-muted-foreground cursor-pointer">
                                        Select All
                                    </label>
                                </>
                            )}
                        </div>

                        <div className="flex items-center gap-1">
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
                                    <TooltipContent>Auto-fill Album</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <div className="h-3 w-px bg-border mx-1" />
                            <div className="flex items-center gap-1">
                                <Checkbox id="allow-duplicates" checked={allowDuplicates} onCheckedChange={(c) => setAllowDuplicates(!!c)} />
                                <label htmlFor="allow-duplicates" className="text-[10px] leading-none">Multi</label>
                            </div>
                            <div className="h-3 w-px bg-border mx-1" />
                            <div className="flex items-center gap-1">
                                <Checkbox
                                    id="multi-select-mode"
                                    checked={multiSelectMode}
                                    onCheckedChange={(c) => {
                                        setMultiSelectMode(!!c);
                                        if (!c) setSelectedPhotos(new Set()); // Clear selection when switching to single mode
                                    }}
                                />
                                <label htmlFor="multi-select-mode" className="text-[10px] leading-none">בחירה מרובה</label>
                            </div>
                            <div className="h-3 w-px bg-border mx-1" />
                            <div className="flex items-center gap-1">
                                <Checkbox
                                    id="hide-used-photos"
                                    checked={hideUsedPhotos}
                                    onCheckedChange={(c) => setHideUsedPhotos(!!c)}
                                />
                                <label htmlFor="hide-used-photos" className="text-[10px] leading-none">הסתר משובצות</label>
                            </div>
                        </div>
                    </div>

                    <input ref={folderUploadRef} type="file" accept="image/*" multiple className="hidden"
                        {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
                        onChange={(e) => { processUploadedFiles(e.target.files); e.target.value = ''; }} />
                    <input ref={photoUploadRef} type="file" accept="image/*" multiple className="hidden"
                        onChange={(e) => { processUploadedFiles(e.target.files); e.target.value = ''; }} />
                </CardHeader>

                <CardContent className="flex-1 overflow-hidden p-0 relative">
                    {allPhotos.length === 0 ? (
                        isLoadingPhotos ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center animate-in fade-in">
                                <Loader2 className="h-10 w-10 mb-2 animate-spin text-primary" />
                                <p className="text-sm">Loading photos...</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center">
                                <ImageIcon className="h-10 w-10 mb-2 opacity-20" />
                                <p className="text-sm">No photos loaded.</p>
                            </div>
                        )
                    ) : (
                        <ScrollArea ref={photoScrollRef} className="h-full px-4 py-2">
                            <div className="columns-2 gap-2 pb-10">
                                {filteredPhotos.map((photo, index) => {
                                    const usage = photoUsageDetails?.[photo.id];
                                    const isUsed = !!usage;
                                    const hasWarning = usage && usage.count > 1;

                                    return (
                                        <div
                                            key={photo.id}
                                            draggable={!photo.isUploading}
                                            onDragStart={(e) => {
                                                if (photo.isUploading) { e.preventDefault(); return; }
                                                e.dataTransfer.setData('photoId', photo.id);
                                            }}
                                            className={cn(
                                                "relative break-inside-avoid mb-2 rounded-md overflow-hidden bg-muted border-2 transition-all group border-transparent",
                                                photo.isUploading ? "cursor-wait opacity-80" : "cursor-grab active:cursor-grabbing hover:border-primary/50"
                                            )}
                                        >
                                            <img src={photo.src} alt={photo.alt} className="w-full h-auto block" loading="lazy" />

                                            {/* Top Overlays: Index, Date (Center), Usage (Right) */}
                                            <div className="absolute top-0 left-0 w-full p-2 flex items-center z-30 pointer-events-none">
                                                {/* Left: Index */}
                                                <Badge variant="secondary" className="h-5 px-2 text-[10px] bg-black/60 text-white border-0 backdrop-blur-md font-bold">
                                                    #{chronologicalIndex[photo.id] ?? '?'}
                                                </Badge>



                                                {/* Right: Usage Indicator (Standard Radix) */}
                                                <div className="pointer-events-auto relative ml-auto">
                                                    {isUsed && (
                                                        <TooltipProvider delayDuration={0}>
                                                            <Tooltip open={activeBubbleId === photo.id} onOpenChange={(open) => setActiveBubbleId(open ? photo.id : null)}>
                                                                <TooltipTrigger asChild>
                                                                    <div
                                                                        className={cn(
                                                                            "h-4 w-4 rounded-full flex items-center justify-center border-1 backdrop-blur-md shadow-xl transition-all cursor-help",
                                                                            hasWarning ? "border-0 rounded-none bg-destructive text-red-500 bg-transparent" : "bg-black/40 border-white text-green-500"
                                                                        )}
                                                                        onMouseEnter={() => setActiveBubbleId(photo.id)}
                                                                        onMouseLeave={() => setActiveBubbleId(null)}
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
                                                                                <Badge
                                                                                    key={p}
                                                                                    variant="secondary"
                                                                                    className="h-4 text-[9px] px-1.5 font-medium"
                                                                                >
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

                                            {/* Bottom Left: Selection Checkbox OR Trash Icon */}
                                            <div className="absolute bottom-2 left-2 z-20 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                                                {multiSelectMode ? (
                                                    <Checkbox
                                                        checked={selectedPhotos.has(photo.id)}
                                                        onCheckedChange={() => toggleSelection(photo.id)}
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
                                                            <button
                                                                className="p-1.5 bg-black/40 hover:bg-destructive text-white rounded-full transition-colors backdrop-blur-sm"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    {photoUsageDetails[photo.id]
                                                                        ? 'This photo is used in the album. Deleting will remove it from album pages.'
                                                                        : 'This action cannot be undone.'}
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction
                                                                    onClick={() => {
                                                                        if (photoUsageDetails[photo.id]) {
                                                                            onRemovePhotosFromAlbum([photo.id]);
                                                                        }
                                                                        onDeletePhotos([photo.id]);
                                                                    }}
                                                                    className="bg-destructive hover:bg-destructive/90"
                                                                >
                                                                    Delete
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                )}
                                            </div>

                                            {/* Bottom Center: Resolution (Hover) - HIDDEN */}
                                            {/* {!photo.isUploading && (
                                                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[9px] font-medium px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 backdrop-blur-sm">
                                                    {photo.width}×{photo.height}
                                                </div>
                                            )} */}

                                            {/* Error State */}
                                            {photo.error && (
                                                <div className="absolute inset-0 bg-red-900/80 flex flex-col items-center justify-center z-30 p-2 text-center">
                                                    <AlertTriangle className="h-8 w-8 text-white mb-2" />
                                                    <span className="text-xs text-white font-medium">{photo.error}</span>
                                                </div>
                                            )}

                                            {/* Preview / Magnify */}
                                            {/* Date Display (moved from top) */}
                                            <div className="absolute bottom-2 right-2 z-20 pointer-events-none">
                                                <Badge variant="secondary" className="h-5 px-2 text-[10px] bg-black/60 text-white border-0 backdrop-blur-md flex gap-1 font-medium whitespace-nowrap shadow-sm">
                                                    {(() => {
                                                        const date = photo.captureDate
                                                            ? new Date(photo.captureDate)
                                                            : (() => {
                                                                const timestampMatch = (photo.src + photo.id).match(/(\d{13})/);
                                                                return timestampMatch ? new Date(parseInt(timestampMatch[1])) : null;
                                                            })();

                                                        if (!date) return 'Recent';

                                                        return date.toLocaleDateString('en-GB') + ' ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
                                                    })()}
                                                </Badge>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </ScrollArea>
                    )}
                    <ScrollToTopButton scrollAreaRef={photoScrollRef} dependency={allPhotos.length} />
                </CardContent>

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
                                    <AlertDialogDescription asChild>
                                        <div className="space-y-2">
                                            {usedCount > 0 ? (
                                                <>
                                                    <p className="text-sm"><strong>{allPhotos.length - usedCount}</strong> photos are not used in the album</p>
                                                    <p className="text-sm text-destructive"><strong>{usedCount}</strong> photos are currently used in the album</p>
                                                </>
                                            ) : (
                                                <p>This will remove all {allPhotos.length} photos. This action cannot be undone.</p>
                                            )}
                                        </div>
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    {usedCount > 0 && allPhotos.length - usedCount > 0 && (
                                        <AlertDialogAction
                                            onClick={() => {
                                                const unusedIds = allPhotos.filter(p => !photoUsageDetails[p.id]).map(p => p.id);
                                                onDeletePhotos(unusedIds);
                                            }}
                                            className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
                                        >
                                            Delete Only Unused ({allPhotos.length - usedCount})
                                        </AlertDialogAction>
                                    )}
                                    <AlertDialogAction
                                        onClick={() => {
                                            if (usedCount > 0) {
                                                onRemovePhotosFromAlbum(allPhotos.map(p => p.id));
                                            }
                                            handleClearGallery();
                                        }}
                                        className="bg-destructive hover:bg-destructive/90"
                                    >
                                        {usedCount > 0 ? `Clear All & Remove from Album (${allPhotos.length})` : 'Clear Gallery'}
                                    </AlertDialogAction>
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
                    <p className="text-xs text-muted-foreground text-center">
                        {allPhotos.length} photos total • {usedCount} used recently
                    </p>
                </div>
            </Card>
        </div>
    );
}
