'use client';

import Image from 'next/image';
import { BookOpenText, Info, Trash2, LayoutTemplate, Download, Image as ImageIcon, Wand2, Undo, Crop, AlertTriangle } from 'lucide-react';
import React, { useState } from 'react';

import type { AlbumPage, AlbumConfig, Photo } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PhotoPanAndZoom } from '@/lib/types';
import { PhotoRenderer } from './photo-renderer';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LAYOUT_TEMPLATES, COVER_TEMPLATES } from './layout-templates';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';


interface PageLayoutProps {
  page: AlbumPage;
  photoGap: number;
  onUpdatePhotoPanAndZoom: (pageId: string, photoId: string, panAndZoom: PhotoPanAndZoom) => void;
  onInteractionChange: (isInteracting: boolean) => void;
  onDropPhoto: (pageId: string, targetPhotoId: string, droppedPhotoId: string) => void;
  overridePhotos?: Photo[];
  overrideLayout?: string;
  templateSource?: typeof LAYOUT_TEMPLATES;
}

function PageLayout({
  page,
  photoGap,
  onUpdatePhotoPanAndZoom,
  onInteractionChange,
  onDropPhoto,
  overridePhotos,
  overrideLayout,
  templateSource = LAYOUT_TEMPLATES
}: PageLayoutProps) {
  const photos = overridePhotos || page.photos;
  const layout = overrideLayout || page.layout;
  const template = templateSource.find(t => t.id === layout) || templateSource[0];

  const [dragOverPhotoId, setDragOverPhotoId] = useState<string | null>(null);

  return (
    <div
      className={cn("grid grid-cols-12 grid-rows-12 h-full w-full")}
      style={{ gap: `${photoGap}px` }}
    >
      {photos.slice(0, template.photoCount).map((photo, index) => (
        <div
          key={photo.id}
          className={cn(
            'relative overflow-hidden bg-muted group/photo transition-all',
            template.grid[index],
            dragOverPhotoId === photo.id && 'ring-4 ring-primary ring-inset'
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverPhotoId(photo.id);
          }}
          onDragLeave={() => setDragOverPhotoId(null)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverPhotoId(null);
            const droppedPhotoId = e.dataTransfer.getData('photoId');
            if (droppedPhotoId) {
              onDropPhoto(page.id, photo.id, droppedPhotoId);
            }
          }}
        >
          <PhotoRenderer
            photo={photo}
            onUpdate={(panAndZoom) => onUpdatePhotoPanAndZoom(page.id, photo.id, panAndZoom)}
            onInteractionChange={onInteractionChange}
          />
        </div>
      ))}
    </div>
  );
}



interface AlbumPreviewProps {
  pages: AlbumPage[];
  config: AlbumConfig;
  onDeletePage: (pageId: string) => void;
  onUpdateLayout: (pageId: string, newLayout: string) => void;
  onUpdateCoverLayout?: (pageId: string, side: 'front' | 'back' | 'full', newLayout: string) => void;
  onUpdateCoverType?: (pageId: string, newType: 'split' | 'full') => void;

  onUpdatePage?: (page: AlbumPage) => void; // New generic update prop
  onUpdateSpineText?: (pageId: string, text: string) => void;
  onUpdateSpineSettings?: (pageId: string, settings: { width?: number; color?: string; textColor?: string; fontSize?: number; fontFamily?: string }) => void;
  onUpdateTitleSettings?: (pageId: string, settings: { text?: string; color?: string; fontSize?: number; fontFamily?: string; position?: { x: number; y: number } }) => void;
  onUpdatePhotoPanAndZoom: (pageId: string, photoId: string, panAndZoom: PhotoPanAndZoom) => void;
  onDropPhoto: (pageId: string, targetPhotoId: string, droppedPhotoId: string) => void;
  allPhotos?: Photo[];
}

import { CoverEditorOverlay } from './cover-editor/cover-editor-overlay';

const AVAILABLE_FONTS = ['Inter', 'Serif', 'Mono', 'Cursive', 'Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Impact'];

const DraggableTitle = ({
  text,
  color,
  fontSize = 24,
  fontFamily,
  position = { x: 50, y: 50 },
  containerId, // New prop
  onUpdatePosition
}: {
  text: string;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  position?: { x: number; y: number };
  containerId: string;
  onUpdatePosition: (x: number, y: number) => void;
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Convert movement to percentage relative to parent container
      const container = document.getElementById(containerId);
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      onUpdatePosition(Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)));
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
  }, [isDragging, onUpdatePosition, containerId]);

  return (
    <div
      className={cn(
        "absolute z-40 select-none cursor-move whitespace-nowrap",
        isDragging && "opacity-80 ring-2 ring-primary ring-dashed rounded"
      )}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)',
        fontSize: `${fontSize}px`,
        fontFamily: fontFamily,
        color: color,
        // Ensure pointer events are captured for dragging
        pointerEvents: 'auto'
      }}
      onMouseDown={handleMouseDown}
    >
      {text}
    </div>
  );
};

const Spine = ({ text, width, color, textColor, fontSize = 12, fontFamily, styleOverride }: { text?: string; width?: number; color?: string; textColor?: string; fontSize?: number; fontFamily?: string; styleOverride?: React.CSSProperties }) => (
  <div
    className="relative h-full bg-muted/30 border-x border-dashed border-border/50 flex items-center justify-center overflow-hidden z-20"
    style={{
      width: width ? `${width}px` : undefined, // Only enforce px width if provided
      backgroundColor: color,
      ...styleOverride // Apply overrides
    }}
  >
    <div
      className="whitespace-nowrap font-semibold text-muted-foreground/70 tracking-widest rotate-90 select-none"
      style={{
        fontSize: `${fontSize}px`,
        fontFamily: fontFamily,
        color: textColor,
      }}
    >
      {text || 'ALBUM SPINE'}
    </div>
  </div>
);

// Helper to manage color + opacity
const SpineColorPicker = ({
  value,
  onChange,
  disableAlpha = false
}: {
  value?: string;
  onChange: (color: string) => void;
  disableAlpha?: boolean;
}) => {
  // Parse initial values
  const [hex, setHex] = useState(() => {
    if (!value) return '#000000';
    if (value.startsWith('#')) return value;
    if (value.startsWith('rgba')) {
      // Try to extract RGB to Hex if possible, otherwise default black
      const parts = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (parts) {
        const toHex = (n: number) => n.toString(16).padStart(2, '0');
        return `#${toHex(parseInt(parts[1]))}${toHex(parseInt(parts[2]))}${toHex(parseInt(parts[3]))}`;
      }
      return '#000000';
    }
    return value;
  });

  const [opacity, setOpacity] = useState(() => {
    if (disableAlpha) return 1;
    if (!value) return 1;
    if (value.startsWith('rgba')) {
      const match = value.match(/rgba?\(.*,\s*([\d.]+)\)/);
      return match ? parseFloat(match[1]) : 1;
    }
    return 1;
  });

  // Actually, to properly support re-opening the popover with correct state:
  React.useEffect(() => {
    if (!value) {
      setHex('#000000');
      if (!disableAlpha) setOpacity(0);
      return;
    }
    if (value.startsWith('#')) {
      setHex(value);
      if (!disableAlpha) setOpacity(1);
    } else if (value.startsWith('rgba')) {
      // Parse rgba(r, g, b, a)
      const parts = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]*)\)/);
      if (parts) {
        const r = parseInt(parts[1]);
        const g = parseInt(parts[2]);
        const b = parseInt(parts[3]);
        const a = parts[4] ? parseFloat(parts[4]) : 1;
        // Convert rgb to hex
        const toHex = (n: number) => n.toString(16).padStart(2, '0');
        setHex(`#${toHex(r)}${toHex(g)}${toHex(b)}`);
        if (!disableAlpha) setOpacity(a);
      }
    }
  }, [value, disableAlpha]);

  const updateColor = (newHex: string, newOpacity: number) => {
    setHex(newHex);
    setOpacity(newOpacity);

    if (disableAlpha) {
      onChange(newHex);
    } else {
      // Construct RGBA
      const r = parseInt(newHex.slice(1, 3), 16);
      const g = parseInt(newHex.slice(3, 5), 16);
      const b = parseInt(newHex.slice(5, 7), 16);
      const rgba = `rgba(${r}, ${g}, ${b}, ${newOpacity})`;
      onChange(rgba);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-6 w-14 px-1 gap-1 border-dashed"
          style={{
            backgroundColor: (!disableAlpha && opacity === 0) ? 'transparent' : (disableAlpha ? hex : (value || (opacity === 0 ? 'transparent' : hex))),
            // If background is dark, text white, else black. Simple heuristic.
            color: (disableAlpha || opacity > 0.5) ? (parseInt(hex.slice(1), 16) > 0xffffff / 2 ? 'black' : 'white') : 'inherit'
          }}
        >
          <div className="w-full h-full flex items-center justify-center text-[10px]">
            {!disableAlpha && opacity === 0 ? 'None' : ''}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Color</Label>
          <div className="flex gap-2">
            <input
              type="color"
              className="h-8 w-12 p-0 border-0"
              value={hex}
              onChange={(e) => updateColor(e.target.value, opacity)}
            />
            <input
              type="text"
              className="flex-1 h-8 text-xs border rounded px-2 font-mono"
              value={hex}
              onChange={(e) => {
                if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                  updateColor(e.target.value, opacity);
                }
              }}
            />
          </div>
        </div>

        {!disableAlpha && (
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs">Opacity</Label>
              <span className="text-xs text-muted-foreground">{Math.round(opacity * 100)}%</span>
            </div>
            <Slider
              value={[opacity]}
              min={0}
              max={1}
              step={0.01}
              onValueChange={([val]) => updateColor(hex, val)}
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

const PageToolbar = ({
  page,
  pageNumber,
  onDeletePage,
  onUpdateLayout,
  onUpdateCoverLayout,
  onUpdateCoverType,
  onUpdateSpineText,
  onUpdateSpineSettings,
  onUpdateTitleSettings,
  onOpenCoverEditor, // New prop
  toast
}: {
  page: AlbumPage;
  pageNumber: number;
  onDeletePage: (id: string) => void;
  onUpdateLayout: (id: string, layout: string) => void;
  onUpdateCoverLayout?: (id: string, side: 'front' | 'back' | 'full', layout: string) => void;
  onUpdateCoverType?: (id: string, type: 'split' | 'full') => void;
  onUpdateSpineText?: (id: string, text: string) => void;
  onUpdateSpineSettings?: (id: string, settings: { width?: number; color?: string; textColor?: string; fontSize?: number; fontFamily?: string }) => void;
  onUpdateTitleSettings?: (id: string, settings: { text?: string; color?: string; fontSize?: number; fontFamily?: string; position?: { x: number; y: number } }) => void;
  onOpenCoverEditor?: (pageId: string) => void;
  toast: any;
}) => {
  if (page.isCover) {
    return (
      <div className="mb-2">
        <TooltipProvider>
          <div className="flex items-center justify-between gap-1 rounded-lg border bg-background p-0.5 shadow-lg px-2 flex-wrap">
            <span className="text-sm font-semibold text-muted-foreground mr-2">Cover</span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenCoverEditor?.(page.id)}
              className="gap-2 bg-primary/10 hover:bg-primary/20 mr-auto"
            >
              <BookOpenText className="h-4 w-4" />
              Edit Cover Design
            </Button>

            <div className="h-4 w-px bg-border mx-2" />

            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Mode:</span>
              <div className="flex bg-muted/50 p-0.5 rounded-md border">
                <button
                  onClick={() => onUpdateCoverType?.(page.id, 'full')}
                  className={cn(
                    "px-2 py-0.5 text-xs rounded-sm transition-all",
                    page.coverType === 'full'
                      ? "bg-background shadow-sm text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Full
                </button>
                <div className="w-px bg-border/50 my-0.5" />
                <button
                  onClick={() => onUpdateCoverType?.(page.id, 'split')}
                  className={cn(
                    "px-2 py-0.5 text-xs rounded-sm transition-all",
                    page.coverType === 'split' || !page.coverType
                      ? "bg-background shadow-sm text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Split
                </button>
              </div>
            </div>

            <div className="h-4 w-px bg-border mx-2" />

            {/* Layout Dropdowns (Simplified/Kept for Structure) */}
            <div className="flex items-center gap-2">
              {page.coverType !== 'full' ? (
                <>
                  {/* Back Cover Layout */}
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="gap-1 px-2">
                            <LayoutTemplate className="h-4 w-4" />
                            <span className="text-xs">Back</span>
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Back Cover Layout</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent className="p-2 grid grid-cols-4 gap-2">
                      {COVER_TEMPLATES.map(template => (
                        <DropdownMenuItem
                          key={template.id}
                          onSelect={() => onUpdateCoverLayout?.(page.id, 'back', template.id)}
                          className={cn("p-0 focus:bg-accent/50 rounded-md cursor-pointer", page.coverLayouts?.back === template.id && "ring-2 ring-primary")}
                        >
                          <div className="w-24 h-24 p-1 flex flex-col items-center">
                            <div className="w-full h-16 bg-muted grid grid-cols-12 grid-rows-12 gap-0.5 p-0.5">
                              {template.grid.map((gridClass, i) => (
                                <div key={i} className={cn('bg-primary/20 rounded-sm', gridClass)} />
                              ))}
                            </div>
                            <span className="text-xs pt-1 text-muted-foreground">{template.name}</span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <div className="h-4 w-px bg-border" />

                  {/* Front Cover Layout */}
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="gap-1 px-2">
                            <LayoutTemplate className="h-4 w-4" />
                            <span className="text-xs">Front</span>
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Front Cover Layout</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent className="p-2 grid grid-cols-4 gap-2">
                      {COVER_TEMPLATES.map(template => (
                        <DropdownMenuItem
                          key={template.id}
                          onSelect={() => onUpdateCoverLayout?.(page.id, 'front', template.id)}
                          className={cn("p-0 focus:bg-accent/50 rounded-md cursor-pointer", page.coverLayouts?.front === template.id && "ring-2 ring-primary")}
                        >
                          <div className="w-24 h-24 p-1 flex flex-col items-center">
                            <div className="w-full h-16 bg-muted grid grid-cols-12 grid-rows-12 gap-0.5 p-0.5">
                              {template.grid.map((gridClass, i) => (
                                <div key={i} className={cn('bg-primary/20 rounded-sm', gridClass)} />
                              ))}
                            </div>
                            <span className="text-xs pt-1 text-muted-foreground">{template.name}</span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                /* Full Spread Layout Selector */
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-1 px-2">
                          <LayoutTemplate className="h-4 w-4" />
                          <span className="text-xs">Layout</span>
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Spread Layout</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent className="p-2 grid grid-cols-4 gap-2">
                    {COVER_TEMPLATES.map(template => (
                      <DropdownMenuItem
                        key={template.id}
                        onSelect={() => onUpdateCoverLayout?.(page.id, 'full', template.id)}
                        className={cn("p-0 focus:bg-accent/50 rounded-md cursor-pointer", page.layout === template.id && "ring-2 ring-primary")}
                      >
                        <div className="w-24 h-24 p-1 flex flex-col items-center">
                          <div className="w-full h-16 bg-muted grid grid-cols-12 grid-rows-12 gap-0.5 p-0.5">
                            {template.grid.map((gridClass, i) => (
                              <div key={i} className={cn('bg-primary/20 rounded-sm', gridClass)} />
                            ))}
                          </div>
                          <span className="text-xs pt-1 text-muted-foreground">{template.name}</span>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div className="mb-2">
      <TooltipProvider>
        <div className="flex items-center justify-between gap-1 rounded-lg border bg-background p-0.5 shadow-lg px-2">
          <span className="text-sm font-semibold text-muted-foreground">
            {`Page ${pageNumber}`}
          </span>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon"><LayoutTemplate className="h-5 w-5" /></Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Page Layout</TooltipContent>
              </Tooltip>
              <DropdownMenuContent className="p-2 grid grid-cols-4 gap-2">
                {LAYOUT_TEMPLATES.map(template => (
                  <DropdownMenuItem key={template.id} onSelect={() => onUpdateLayout(page.id, template.id)} className="p-0 focus:bg-accent/50 rounded-md cursor-pointer">
                    <div className="w-24 h-24 p-1 flex flex-col items-center">
                      <div className="w-full h-16 bg-muted grid grid-cols-12 grid-rows-12 gap-0.5 p-0.5">
                        {template.grid.map((gridClass, i) => (
                          <div key={i} className={cn('bg-primary/20 rounded-sm', gridClass)} />
                        ))}
                      </div>
                      <span className="text-xs pt-1 text-muted-foreground">{template.name}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => toast({ title: "Feature coming soon!" })}><Download className="h-5 w-5" /></Button>
              </TooltipTrigger>
              <TooltipContent>Download Page</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => toast({ title: "Feature coming soon!" })}><ImageIcon className="h-5 w-5" /></Button>
              </TooltipTrigger>
              <TooltipContent>Set Background</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => toast({ title: "Feature coming soon!" })}><Wand2 className="h-5 w-5" /></Button>
              </TooltipTrigger>
              <TooltipContent>Enhance with AI</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => toast({ title: "Feature coming soon!" })}><Undo className="h-5 w-5" /></Button>
              </TooltipTrigger>
              <TooltipContent>Undo AI Changes</TooltipContent>
            </Tooltip>
            <div className="mx-1 h-6 w-px bg-border" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onDeletePage(page.id)}>
                  <Trash2 className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete Page</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </TooltipProvider>
    </div>
  );
};

export function AlbumPreview({
  pages,
  config,
  onDeletePage,
  onUpdateLayout,
  onUpdateCoverLayout,
  onUpdateCoverType,
  onUpdatePage, // New prop
  onUpdateSpineText,
  onUpdateSpineSettings,
  onUpdateTitleSettings,
  onUpdatePhotoPanAndZoom,
  onDropPhoto,
  allPhotos
}: AlbumPreviewProps) {
  const { toast } = useToast();
  const [isInteracting, setIsInteracting] = useState(false);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [isCoverEditorOpen, setIsCoverEditorOpen] = useState(false);
  const [dragOverPhotoId, setDragOverPhotoId] = useState<string | null>(null);

  const handleOpenCoverEditor = (pageId: string) => {
    setActivePageId(pageId);
    setIsCoverEditorOpen(true);
  };

  const coverPage = pages.find(p => p.id === activePageId && p.isCover);


  if (pages.length <= 0) {
    return (
      <Card className="flex h-[80vh] w-full items-center justify-center bg-muted/50 border-2 border-dashed">
        <div className="text-center text-muted-foreground">
          <BookOpenText className="mx-auto h-12 w-12" />
          <h3 className="mt-4 text-lg font-semibold">Your Album Preview</h3>
          <p>Generate dummy photos to begin creating your photobook.</p>
        </div>
      </Card>
    );
  }



  return (
    <div className="w-full">
      <ScrollArea className="h-[85vh] w-full pr-4" style={{ overflowY: isInteracting ? 'hidden' : 'auto' }}>
        <div className="space-y-8">
          {pages.map((page, index) => (
            <div key={page.id} className="w-full max-w-4xl mx-auto">
              <div className="w-full relative group/page">

                <div className={cn("h-18", page.type === 'single' ? 'w-1/2 mx-auto' : 'w-full')}>
                  <PageToolbar
                    page={page}
                    pageNumber={index}
                    onDeletePage={() => onDeletePage(page.id)}
                    onUpdateLayout={onUpdateLayout}
                    onUpdateCoverLayout={onUpdateCoverLayout}
                    onUpdateCoverType={onUpdateCoverType}
                    onUpdateSpineText={onUpdateSpineText}
                    onUpdateSpineSettings={onUpdateSpineSettings}
                    onUpdateTitleSettings={onUpdateTitleSettings}
                    onOpenCoverEditor={handleOpenCoverEditor}
                    toast={toast}
                  />
                </div>

                <AspectRatio ratio={page.isCover || page.type === 'spread' ? 2 / 1 : 2} className={cn(page.type === 'single' && 'w-1/2 mx-auto')}>
                  <Card
                    className="h-full w-full shadow-lg"
                    style={{
                      backgroundColor: config.backgroundColor,
                      backgroundImage: (page.backgroundImage || config.backgroundImage) ? `url(${page.backgroundImage || config.backgroundImage})` : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    <CardContent
                      className="flex h-full w-full items-center justify-center p-0"
                      style={{ padding: `${config.pageMargin}px` }}
                    >
                      {page.isCover ? (() => {
                        console.log('[AlbumPreview] Rendering COVER page:', page.id, 'coverType:', page.coverType);
                        // Full Spread Mode
                        if (page.coverType === 'full') {
                          // Calculate proportional values based on 1000px reference (Visual screen width)
                          const pageMarginVal = page.pageMargin ?? config.pageMargin ?? 0;
                          const photoGapVal = page.photoGap ?? config.photoGap ?? 5;
                          console.log('[AlbumPreview Full] page.photoGap:', page.photoGap, 'photoGapVal:', photoGapVal);
                          const pageMarginCqw = `${(pageMarginVal / 1000) * 100}%`;
                          const photoGapCqw = `${(photoGapVal / 1000) * 100}%`;
                          console.log('[AlbumPreview Full] photoGapCqw:', photoGapCqw);

                          return (
                            <div className="relative h-full w-full">
                              {/* Spine Overlay */}
                              <div
                                className="absolute inset-y-0 left-1/2 h-full z-30 pointer-events-none"
                                style={{
                                  marginLeft: `-${(page.spineWidth || 40) / 2}px`,
                                  width: `${page.spineWidth || 40}px`
                                }}
                              >
                                <Spine
                                  text={page.spineText}
                                  width={page.spineWidth}
                                  color={page.spineColor}
                                  textColor={page.spineTextColor}
                                  fontSize={page.spineFontSize}
                                  fontFamily={page.spineFontFamily}
                                />
                              </div>


                              {/* Front Cover Title Overlay */}
                              <div
                                className="relative h-full w-full overflow-hidden"
                                style={{
                                  containerType: 'inline-size',
                                  padding: pageMarginCqw
                                }}
                              >
                                {/* Draggable Title Overlay (if applies to full spread?) Usually title is mostly front. */}
                                <div className="absolute inset-0 z-20 pointer-events-none">
                                  <div className="pointer-events-auto h-full w-full relative">
                                    {page.titleText && (
                                      <DraggableTitle
                                        text={page.titleText}
                                        color={page.titleColor}
                                        fontSize={page.titleFontSize}
                                        fontFamily={page.titleFontFamily}
                                        position={page.titlePosition}
                                        containerId={`front-cover-container-${page.id}`}
                                        onUpdatePosition={(x, y) => onUpdateTitleSettings?.(page.id, { position: { x, y } })}
                                      />
                                    )}
                                  </div>
                                </div>

                                {/* Spine Overlay */}
                                <div
                                  className="absolute inset-y-0 left-1/2 h-full z-30 pointer-events-none"
                                  style={{
                                    marginLeft: `-${(page.spineWidth || 40) / 2}px`,
                                    width: `${page.spineWidth || 40}px`
                                  }}
                                >
                                  <Spine
                                    text={page.spineText}
                                    width={page.spineWidth}
                                    color={page.spineColor}
                                    textColor={page.spineTextColor}
                                    fontSize={page.spineFontSize}
                                    fontFamily={page.spineFontFamily}
                                  />
                                </div>

                                <PageLayout
                                  page={page}
                                  photoGap={photoGapCqw as any}
                                  onUpdatePhotoPanAndZoom={onUpdatePhotoPanAndZoom}
                                  onInteractionChange={setIsInteracting}
                                  onDropPhoto={onDropPhoto}
                                  templateSource={COVER_TEMPLATES} // Uses page.layout
                                />

                                {/* Render Text Objects Overlay */}
                                <div
                                  className="absolute inset-0 pointer-events-none overflow-hidden"
                                  style={{ containerType: 'inline-size' }}
                                >
                                  {page.coverTexts?.map(textItem => (
                                    <div
                                      key={textItem.id}
                                      className="absolute whitespace-nowrap"
                                      style={{
                                        left: `${textItem.x}%`,
                                        top: `${textItem.y}%`,
                                        transform: 'translate(-50%, -50%)',
                                        fontFamily: textItem.style.fontFamily,
                                        fontSize: `${(textItem.style.fontSize / 3200) * 100}cqw`,
                                        color: textItem.style.color,
                                        fontWeight: textItem.style.fontWeight === 'bold' ? 'bold' : 'normal',
                                        fontStyle: textItem.style.fontStyle === 'italic' ? 'italic' : 'normal',
                                        textAlign: textItem.style.textAlign || 'left',
                                        textShadow: textItem.style.textShadow,
                                      }}
                                    >
                                      {textItem.text}
                                    </div>
                                  ))
                                  }
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // Split Mode (Back | Spine | Front)
                        const backLayoutId = page.coverLayouts?.back || '1-full';
                        const frontLayoutId = page.coverLayouts?.front || '1-full';
                        const backTemplate = COVER_TEMPLATES.find(t => t.id === backLayoutId) || COVER_TEMPLATES[0];
                        const frontTemplate = COVER_TEMPLATES.find(t => t.id === frontLayoutId) || COVER_TEMPLATES[0];

                        // Split photos between back and front
                        const backPhotos = page.photos.slice(0, backTemplate.photoCount);
                        const frontPhotos = page.photos.slice(backTemplate.photoCount, backTemplate.photoCount + frontTemplate.photoCount);

                        // Current spine width (default 40)
                        const spineWidthPx = page.spineWidth || 40;
                        // Convert to PROPORTIONAL width for preview using standard 3200px width
                        // This prevents spine from being huge in small thumbnails
                        const spineWidthCqw = `${(spineWidthPx / 3200) * 100}cqw`;

                        // Calculate proportional values based on 1000px reference
                        const pageMarginVal = page.pageMargin ?? config.pageMargin ?? 0;
                        const photoGapVal = page.photoGap ?? config.photoGap ?? 5;
                        console.log('[AlbumPreview Split] page.photoGap:', page.photoGap, 'config.photoGap:', config.photoGap, 'photoGapVal:', photoGapVal);
                        const pageMarginCqw = `${(pageMarginVal / 1000) * 100}%`;
                        const photoGapCqw = `${(photoGapVal / 1000) * 100}%`;
                        console.log('[AlbumPreview Split] photoGapCqw:', photoGapCqw, 'pageMarginCqw:', pageMarginCqw);

                        return (
                          <div
                            className="grid h-full w-full"
                            style={{
                              gridTemplateColumns: `1fr ${spineWidthCqw} 1fr`, // Use CQW here
                              position: 'relative',
                              containerType: 'inline-size' // Ensure CQW works without Tailwind plugin
                            }}
                          >
                            {/* Text Objects Overlay (Absolute to spread container) */}
                            <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
                              {page.coverTexts?.map(textItem => (
                                <div
                                  key={textItem.id}
                                  className="absolute whitespace-nowrap"
                                  style={{
                                    left: `${textItem.x}%`,
                                    top: `${textItem.y}%`,
                                    transform: 'translate(-50%, -50%)',
                                    fontFamily: textItem.style.fontFamily,
                                    // Use cqw units relative to the @container
                                    // Assuming "standard" editor width of 3200px for the spread
                                    fontSize: `${(textItem.style.fontSize / 3200) * 100}cqw`,
                                    color: textItem.style.color,
                                    fontWeight: textItem.style.fontWeight === 'bold' ? 'bold' : 'normal',
                                    fontStyle: textItem.style.fontStyle === 'italic' ? 'italic' : 'normal',
                                    textAlign: textItem.style.textAlign || 'left',
                                    textShadow: textItem.style.textShadow,
                                  }}
                                >
                                  {textItem.text}
                                  {/* Debug helper: {textItem.x.toFixed(1)}% */}
                                </div>
                              ))}
                            </div>
                            <div
                              className="relative h-full w-full border-r border-dashed border-border/50 overflow-hidden"
                              style={{
                                padding: pageMarginCqw,
                                containerType: 'inline-size'
                              }}
                            >
                              <span className="absolute top-2 left-2 z-20 text-[10px] font-bold text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded pointer-events-none uppercase tracking-wider">Back Cover</span>
                              <div
                                className="grid grid-cols-12 grid-rows-12 h-full w-full"
                                style={{ gap: photoGapCqw }}
                              >
                                {(() => {
                                  const photos = backPhotos;
                                  const template = COVER_TEMPLATES.find(t => t.id === backLayoutId) || COVER_TEMPLATES[0];
                                  return template.grid.map((gridClass, index) => {
                                    const photo = photos[index];
                                    if (!photo) return <div key={index} className={cn("bg-muted rounded-sm", gridClass)} />;
                                    return (
                                      <div
                                        key={photo.id}
                                        className={cn(
                                          "relative overflow-hidden rounded-sm transition-all duration-200 group ring-2 ring-transparent hover:ring-primary/20",
                                          gridClass,
                                          dragOverPhotoId === photo.id && "ring-primary ring-offset-2"
                                        )}
                                        onDragOver={(e) => {
                                          e.preventDefault();
                                          setDragOverPhotoId(photo.id);
                                        }}
                                        onDragLeave={() => setDragOverPhotoId(null)}
                                        onDrop={(e) => {
                                          e.preventDefault();
                                          setDragOverPhotoId(null);
                                          const droppedPhotoId = e.dataTransfer.getData('photoId');
                                          if (droppedPhotoId) {
                                            onDropPhoto(page.id, photo.id, droppedPhotoId);
                                          }
                                        }}
                                      >
                                        <PhotoRenderer
                                          photo={photo}
                                          onUpdate={(panAndZoom) => onUpdatePhotoPanAndZoom(page.id, photo.id, panAndZoom)}
                                          onInteractionChange={setIsInteracting}
                                        />
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            </div>

                            <Spine
                              text={page.spineText}
                              width={undefined} // Let CSS grid handle width, or pass scaled px? Spine component might rely on width prop for internal logic (e.g. font rotation?) 
                              // Actually Spine component takes width to set its own style.width.
                              // If I pass number, it treats as px. 
                              // If I rely on grid, I can set width="100%" inside the grid cell. 
                              // Let's check Spine implementation.
                              color={page.spineColor}
                              textColor={page.spineTextColor}
                              fontSize={page.spineFontSize}
                              fontFamily={page.spineFontFamily}
                              styleOverride={{ width: '100%' }} // Need to ensure it fills the grid cell
                            />

                            <div
                              id={`front-cover-container-${page.id}`}
                              className="relative h-full w-full border-l border-dashed border-border/50 overflow-hidden bg-muted/20"
                              style={{
                                padding: pageMarginCqw,
                                containerType: 'inline-size'
                              }}
                            >
                              {/* Draggable Title */}
                              {page.titleText && (
                                <DraggableTitle
                                  text={page.titleText}
                                  color={page.titleColor}
                                  fontSize={page.titleFontSize}
                                  fontFamily={page.titleFontFamily}
                                  position={page.titlePosition}
                                  containerId={`front-cover-container-${page.id}`}
                                  onUpdatePosition={(x, y) => onUpdateTitleSettings?.(page.id, { position: { x, y } })}
                                />
                              )}
                              <span className="absolute top-2 left-2 z-20 text-[10px] font-bold text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded pointer-events-none uppercase tracking-wider">Front Cover</span>
                              <div
                                className="grid grid-cols-12 grid-rows-12 h-full w-full"
                                style={{ gap: photoGapCqw }}
                              >
                                {(() => {
                                  const photos = frontPhotos;
                                  const template = COVER_TEMPLATES.find(t => t.id === frontLayoutId) || COVER_TEMPLATES[0];
                                  return template.grid.map((gridClass, index) => {
                                    const photo = photos[index];
                                    if (!photo) return <div key={index} className={cn("bg-muted rounded-sm", gridClass)} />;
                                    return (
                                      <div
                                        key={photo.id}
                                        className={cn(
                                          "relative overflow-hidden rounded-sm transition-all duration-200 group ring-2 ring-transparent hover:ring-primary/20",
                                          gridClass,
                                          dragOverPhotoId === photo.id && "ring-primary ring-offset-2"
                                        )}
                                        onDragOver={(e) => {
                                          e.preventDefault();
                                          setDragOverPhotoId(photo.id);
                                        }}
                                        onDragLeave={() => setDragOverPhotoId(null)}
                                        onDrop={(e) => {
                                          e.preventDefault();
                                          setDragOverPhotoId(null);
                                          const droppedPhotoId = e.dataTransfer.getData('photoId');
                                          if (droppedPhotoId) {
                                            onDropPhoto(page.id, photo.id, droppedPhotoId);
                                          }
                                        }}
                                      >
                                        <PhotoRenderer
                                          photo={photo}
                                          onUpdate={(panAndZoom) => onUpdatePhotoPanAndZoom(page.id, photo.id, panAndZoom)}
                                          onInteractionChange={setIsInteracting}
                                        />
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                          </div>
                        );
                      })() : page.type === 'spread' ? (
                        <div className="relative h-full w-full">
                          {/* Spine simulation */}
                          <div className="absolute inset-y-0 left-1/2 -ml-px w-px bg-border z-10 pointer-events-none"></div>
                          <div className="absolute inset-y-0 left-1/2 w-4 -ml-2 bg-gradient-to-r from-transparent to-black/10 z-10 pointer-events-none"></div>
                          <div className="absolute inset-y-0 right-1/2 w-4 -mr-2 bg-gradient-to-l from-transparent to-black/10 z-10 pointer-events-none"></div>
                          <PageLayout
                            page={page}
                            photoGap={config.photoGap}
                            onUpdatePhotoPanAndZoom={onUpdatePhotoPanAndZoom}
                            onInteractionChange={setIsInteracting}
                            onDropPhoto={onDropPhoto}
                          />
                        </div>
                      ) : (
                        <PageLayout
                          page={page}
                          photoGap={config.photoGap}
                          onUpdatePhotoPanAndZoom={onUpdatePhotoPanAndZoom}
                          onInteractionChange={setIsInteracting}
                          onDropPhoto={onDropPhoto}
                        />
                      )}
                    </CardContent>
                  </Card>
                </AspectRatio>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {isCoverEditorOpen && coverPage && (
        <CoverEditorOverlay
          page={coverPage}
          allPhotos={allPhotos}
          onUpdatePage={(updatedPage) => {
            onUpdatePage?.(updatedPage);
          }}
          onClose={() => setIsCoverEditorOpen(false)}
        />
      )}
    </div>
  );
}
