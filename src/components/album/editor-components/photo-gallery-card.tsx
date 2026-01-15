'use client';

import React from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, TooltipArrow } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Photo } from '@/lib/types';
import { ScrollToTopButton } from './scroll-to-top-button';

interface PhotoGalleryCardProps {
    allPhotos: Photo[];
    isLoadingPhotos: boolean;
    photoUsageCounts: Record<string, number>;
    usedPhotoIds: Set<string>;
    allowDuplicates: boolean;
    setAllowDuplicates: (value: boolean) => void;
    randomSeed: string | null;
    // Actions
    generateDummyPhotos: () => void;
    handleGenerateAlbum: () => void;
    handleClearGallery: () => void;
    handleResetAlbum: () => void;
    handleSortPhotos: () => void; // New prop
    processUploadedFiles: (files: FileList | null) => void;
    // Refs
    photoScrollRef: React.RefObject<HTMLDivElement | null>;
    folderUploadRef: React.RefObject<HTMLInputElement | null>;
    photoUploadRef: React.RefObject<HTMLInputElement | null>;
}

export function PhotoGalleryCard({
    allPhotos,
    isLoadingPhotos,
    photoUsageCounts,
    usedPhotoIds,
    allowDuplicates,
    setAllowDuplicates,
    randomSeed,
    generateDummyPhotos,
    handleGenerateAlbum,
    handleClearGallery,
    handleResetAlbum,
    handleSortPhotos,
    processUploadedFiles,
    photoScrollRef,
    folderUploadRef,
    photoUploadRef,
}: PhotoGalleryCardProps) {
    return (
        <div className="xl:col-span-3 space-y-4">
            <Card className="h-[85vh] flex flex-col">
                <CardHeader className="pb-3 border-bottom">
                    <div className="flex items-center justify-between">
                        <CardTitle className="font-headline text-lg">Photo Gallery</CardTitle>
                        <div className="flex items-center gap-2">
                            {/* Upload Buttons */}
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={generateDummyPhotos}
                                            disabled={isLoadingPhotos || !randomSeed}
                                            title="Load sample photos"
                                        >
                                            {isLoadingPhotos ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Sparkles className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Load sample photos</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => folderUploadRef.current?.click()}
                                            title="Upload folder"
                                        >
                                            <FolderUp className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Upload folder</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => photoUploadRef.current?.click()}
                                            title="Upload photos"
                                        >
                                            <Upload className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Upload photos</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={handleGenerateAlbum}
                                title="Generate album from photos"
                            >
                                <Wand2 className="h-4 w-4" />
                            </Button>
                            <div className="h-4 w-px bg-border" />
                            <label htmlFor="allow-duplicates" className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Allow Multi
                            </label>
                            <Checkbox
                                id="allow-duplicates"
                                checked={allowDuplicates}
                                onCheckedChange={(checked) => setAllowDuplicates(!!checked)}
                            />
                        </div>
                    </div>
                    {/* Hidden file inputs */}
                    <input
                        ref={folderUploadRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
                        onChange={(e) => {
                            processUploadedFiles(e.target.files);
                            e.target.value = '';
                        }}
                    />
                    <input
                        ref={photoUploadRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                            processUploadedFiles(e.target.files);
                            e.target.value = '';
                        }}
                    />
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0 relative">
                    {allPhotos.length === 0 ? (
                        isLoadingPhotos ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center animate-in fade-in duration-300">
                                <Loader2 className="h-10 w-10 mb-2 animate-spin text-primary" />
                                <p className="text-sm font-medium">Loading photos...</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center">
                                <ImageIcon className="h-10 w-10 mb-2 opacity-20" />
                                <p className="text-sm">No photos loaded yet. Use "Load Photos" to start.</p>
                            </div>
                        )
                    ) : (
                        <ScrollArea ref={photoScrollRef} className="h-full px-4 py-2">
                            <div className="columns-2 gap-2 pb-4">
                                {allPhotos.map((photo) => (
                                    <div
                                        key={photo.id}
                                        draggable={!photo.isUploading}
                                        onDragStart={(e) => {
                                            if (photo.isUploading) {
                                                e.preventDefault();
                                                return;
                                            }
                                            e.dataTransfer.setData('photoId', photo.id);
                                        }}
                                        className={cn(
                                            "relative break-inside-avoid mb-2 rounded-md overflow-hidden bg-muted border-2 border-transparent transition-all group",
                                            photo.isUploading ? "cursor-wait opacity-80" : "cursor-grab active:cursor-grabbing hover:border-primary"
                                        )}
                                    >
                                        <img
                                            src={photo.src}
                                            alt={photo.alt}
                                            className="w-full h-auto display-block"
                                        />
                                        {/* Resolution display - top right corner */}
                                        {!photo.isUploading && (
                                            <div className="absolute top-1 right-1 bg-black/60 text-white text-[9px] font-medium px-1 py-0.5 rounded z-10">
                                                {photo.width}×{photo.height}
                                            </div>
                                        )}

                                        {/* Uploading Overlay */}
                                        {photo.isUploading && (
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
                                                <Loader2 className="h-6 w-6 animate-spin text-white" />
                                            </div>
                                        )}

                                        {/* Error Overlay */}
                                        {photo.error && (
                                            <div className="absolute inset-0 bg-red-900/60 flex flex-col items-center justify-center z-20 p-2 text-center">
                                                <AlertTriangle className="h-6 w-6 text-white mb-1" />
                                                <span className="text-[10px] text-white font-medium leading-tight line-clamp-2">
                                                    {photo.error}
                                                </span>
                                            </div>
                                        )}
                                        {photoUsageCounts[photo.id] > 1 && (
                                            <div className="absolute top-1 left-1 bg-white/90 rounded-full p-0.5 shadow-sm text-orange-500 z-10">
                                                <AlertTriangle className="h-4 w-4 fill-orange-500 text-white" />
                                            </div>
                                        )}
                                        {/* Magnify button with Radix Tooltip - smart positioning */}
                                        <div className="absolute bottom-1 right-1 z-20">
                                            <TooltipProvider delayDuration={0}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={handleSortPhotos}
                                                            disabled={isLoadingPhotos || allPhotos.some(p => p.isUploading)}
                                                        >
                                                            <ArrowUpDown className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Sort by Date</TooltipContent>
                                                </Tooltip>

                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            className="p-1 bg-black/60 text-white rounded hover:bg-black/80 transition-colors"
                                                            onMouseDown={(e) => e.stopPropagation()}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <svg
                                                                xmlns="http://www.w3.org/2000/svg"
                                                                width="14"
                                                                height="14"
                                                                viewBox="0 0 24 24"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth="2"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                            >
                                                                <circle cx="11" cy="11" r="8" />
                                                                <path d="m21 21-4.3-4.3" />
                                                                <path d="M11 8v6" />
                                                                <path d="M8 11h6" />
                                                            </svg>
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent
                                                        side="left"
                                                        sideOffset={8}
                                                        className="p-0.5 bg-white rounded-lg shadow-2xl border-0"
                                                        style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
                                                    >
                                                        <TooltipArrow className="fill-white" width={12} height={8} />
                                                        <img
                                                            src={photo.src}
                                                            alt="Preview"
                                                            className="block rounded"
                                                            style={{ width: '300px', height: 'auto' }}
                                                        />
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                            <span className="text-[10px] text-white font-bold bg-black/50 px-1.5 py-0.5 rounded">DRAG ME</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                    <ScrollToTopButton scrollAreaRef={photoScrollRef} dependency={allPhotos.length} />
                </CardContent>
                <div className="p-3 border-t bg-muted/30 flex flex-col gap-2">
                    <div className="flex items-center justify-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={handleClearGallery}
                        >
                            <Eraser className="h-3 w-3" />
                            Clear Gallery
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={handleResetAlbum}
                        >
                            <RotateCcw className="h-3 w-3" />
                            Reset Album
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                        {allPhotos.length} photos total • {usedPhotoIds.size} used
                    </p>
                </div>
            </Card>
        </div>
    );
}
