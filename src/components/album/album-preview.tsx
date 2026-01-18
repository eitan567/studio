'use client';

import Image from 'next/image';
import { BookOpenText, Info, Trash2, LayoutTemplate, Download, Image as ImageIcon, Wand2, Undo, Crop, AlertTriangle, Pencil, BookOpen, Share2, FileText, FileDown, MoreHorizontal, FileImage, Plus, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, CornerDownRight, CornerDownLeft, RotateCw, ChevronUp, ChevronDown } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';

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
import { useAlbumPreview } from './album-preview-context';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTemplates, getPhotoCount } from '@/hooks/useTemplates';
import { AdvancedTemplate, LayoutRegion, insetPolygon } from '@/lib/advanced-layout-types';
import { ShapeRegion } from './shape-region';
import { PageLayout } from './page-layout';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { rotateGridTemplate, rotateAdvancedTemplate, getNextRotation, RotationAngle } from '@/lib/template-rotation';

// Helper function to render a clean preview of an advanced template
// Uses CSS positioned divs to match the style of grid-based templates
const renderAdvancedTemplatePreview = (template: AdvancedTemplate) => {
  const sortedRegions = [...template.regions].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

  // Small inset to create visible gaps between regions (matches gap-0.5)
  const GAP_INSET = 1; // 1% inset for gaps between regions
  const EDGE_MARGIN = 2; // 2% margin on edges (p-0.5 equivalent)

  // Scale factor to fit content within margins
  const scale = (100 - EDGE_MARGIN * 2) / 100;

  return (
    <div className="w-full h-full relative">
      {sortedRegions.map((region, index) => {
        // For circles/ellipses, we'll use border-radius
        const isCircular = region.shape === 'circle' || region.shape === 'ellipse';
        const isPolygon = region.shape === 'polygon' && region.points && region.points.length >= 3;

        // For polygons, render using CSS clip-path with the actual polygon points
        if (isPolygon && region.points) {
          // Apply inset to polygon points to create visible gaps between shapes
          const insetPoints = insetPolygon(region.points, GAP_INSET);

          const clipPathPoints = insetPoints.map(([px, py]) => {
            const scaledX = EDGE_MARGIN + (px * scale);
            const scaledY = EDGE_MARGIN + (py * scale);
            return `${scaledX}% ${scaledY}%`;
          }).join(', ');

          return (
            <div
              key={region.id || index}
              className="absolute bg-primary/20"
              style={{
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
                clipPath: `polygon(${clipPathPoints})`,
                zIndex: region.zIndex ?? 0,
              }}
            />
          );
        }

        // For rectangles and circles: use bounds with gap inset
        const gapX = region.bounds.x + GAP_INSET;
        const gapY = region.bounds.y + GAP_INSET;
        const gapW = Math.max(0, region.bounds.width - (GAP_INSET * 2));
        const gapH = Math.max(0, region.bounds.height - (GAP_INSET * 2));

        // Apply edge margin scaling
        const x = EDGE_MARGIN + (gapX * scale);
        const y = EDGE_MARGIN + (gapY * scale);
        const width = gapW * scale;
        const height = gapH * scale;

        return (
          <div
            key={region.id || index}
            className={cn(
              'absolute bg-primary/20',
              isCircular ? 'rounded-full' : 'rounded-sm'
            )}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: `${width}%`,
              height: `${height}%`,
              zIndex: region.zIndex ?? 0,
            }}
          />
        );
      })}
    </div>
  );
};


// Template Thumbnail - simple static preview for selection
type TemplateWithGrid = { id: string; name: string; photoCount?: number; grid: string[] };
type TemplateUnion = TemplateWithGrid | AdvancedTemplate;

// Parse layout ID to extract base template and rotation (same as in page-layout.tsx)
function parseLayoutId(layoutId: string): { baseId: string; rotation: RotationAngle } {
  const rotationMatch = layoutId.match(/_r(90|180|270)$/);
  if (rotationMatch) {
    const rotation = parseInt(rotationMatch[1]) as RotationAngle;
    const baseId = layoutId.replace(/_r(90|180|270)$/, '');
    return { baseId, rotation };
  }
  return { baseId: layoutId, rotation: 0 };
}

const TemplateThumbnail = ({
  template,
  isSelected,
  onSelect
}: {
  template: TemplateUnion;
  isSelected: boolean;
  onSelect: (templateId: string) => void;
}) => {
  // Render static preview (no rotation - rotation is handled in toolbar)
  const renderPreview = () => {
    if ('grid' in template) {
      return (
        <div className="w-full h-16 bg-muted grid grid-cols-12 grid-rows-12 gap-0.5 p-0.5">
          {template.grid.map((gridClass, i) => (
            <div key={i} className={cn('bg-primary/20 rounded-sm', gridClass)} />
          ))}
        </div>
      );
    } else {
      return (
        <div className="w-full h-16 bg-muted relative overflow-hidden">
          {renderAdvancedTemplatePreview(template as AdvancedTemplate)}
        </div>
      );
    }
  };

  return (
    <DropdownMenuItem
      onSelect={() => onSelect(template.id)}
      className={cn(
        "p-0 focus:bg-accent/50 rounded-md cursor-pointer",
        isSelected && "ring-2 ring-primary"
      )}
    >
      <div className="w-24 h-24 p-1 flex flex-col items-center">
        {renderPreview()}
        <span className="text-xs pt-1 text-muted-foreground">{template.name}</span>
      </div>
    </DropdownMenuItem>
  );
};


interface AlbumPreviewProps {
  pages: AlbumPage[];
  config: AlbumConfig;
  onDeletePage: (pageId: string) => void;
  onAddSpread?: (afterIndex: number) => void;
  onUpdateLayout: (pageId: string, newLayout: string) => void;
  onUpdateCoverLayout?: (pageId: string, side: 'front' | 'back' | 'full', newLayout: string) => void;
  onUpdateSpreadLayout?: (pageId: string, side: 'left' | 'right', newLayout: string) => void;
  onUpdateCoverType?: (pageId: string, newType: 'split' | 'full') => void;

  onUpdatePage?: (page: AlbumPage) => void; // New generic update prop
  onUpdateSpineText?: (pageId: string, text: string) => void;
  onUpdateSpineSettings?: (pageId: string, settings: { width?: number; color?: string; textColor?: string; fontSize?: number; fontFamily?: string }) => void;
  onUpdateTitleSettings?: (pageId: string, settings: { text?: string; color?: string; fontSize?: number; fontFamily?: string; position?: { x: number; y: number } }) => void;
  onUpdatePhotoPanAndZoom: (pageId: string, photoId: string, panAndZoom: PhotoPanAndZoom) => void;
  onDropPhoto: (pageId: string, targetPhotoId: string, droppedPhotoId: string, sourceInfo?: { pageId: string; photoId: string }) => void;
  onDownloadPage: (pageId: string) => void;
  onRemovePhoto: (pageId: string, photoId: string) => void;
  allPhotos?: Photo[];
  customTemplates?: AdvancedTemplate[];
}

import { CoverEditorOverlay } from './cover-editor/cover-editor-overlay';
import { AlbumCover } from './album-cover';

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

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onUpdatePosition]);

  return (
    <div
      id={`draggable-title-${containerId}`}
      onMouseDown={handleMouseDown}
      className={cn(
        "absolute p-2 border border-transparent hover:border-blue-500 rounded cursor-move select-none z-50 group",
        isDragging && "border-blue-500 bg-blue-500/10"
      )}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div style={{ color: color || '#000000', fontSize: `${fontSize}px`, fontFamily: fontFamily || 'Inter', whiteSpace: 'nowrap' }}>
        {text}
      </div>
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/75 text-white text-[10px] px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        Drag to move
      </div>
    </div>
  );
};


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
  displayLabel, // New Prop
  canDelete = true,
  onDeletePage,
  onUpdateLayout,
  onUpdateSpreadLayout,
  onUpdateCoverLayout,
  onUpdateCoverType,
  onUpdateSpineText,
  onUpdateSpineSettings,
  onUpdateTitleSettings,
  onOpenCoverEditor, // New prop
  onDownloadPage,
  onUpdatePage,
  toast
}: {
  page: AlbumPage;
  pageNumber: number;
  displayLabel?: string;
  canDelete?: boolean;
  onDeletePage: (id: string) => void;
  onUpdateLayout: (id: string, layout: string) => void;
  onUpdateSpreadLayout?: (id: string, side: 'left' | 'right', layout: string) => void;
  onUpdateCoverLayout?: (id: string, side: 'front' | 'back' | 'full', layout: string) => void;
  onUpdateCoverType?: (id: string, type: 'split' | 'full') => void;
  onUpdateSpineText?: (id: string, text: string) => void;
  onUpdateSpineSettings?: (id: string, settings: { width?: number; color?: string; textColor?: string; fontSize?: number; fontFamily?: string }) => void;
  onUpdateTitleSettings?: (id: string, settings: { text?: string; color?: string; fontSize?: number; fontFamily?: string; position?: { x: number; y: number } }) => void;
  onOpenCoverEditor?: (pageId: string) => void;
  onDownloadPage?: (pageId: string) => void;
  onUpdatePage?: (page: AlbumPage) => void;
  toast: any;
}) => {
  const {
    gridTemplates,
    coverTemplates,
    advancedTemplates,
    defaultGridTemplate
  } = useTemplates();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showSpineSettings, setShowSpineSettings] = useState(false);
  const isCoverOrSpread = page.isCover || page.type === 'spread';
  const isSplit = page.isCover ? (page.coverType === 'split' || !page.coverType) : (page.spreadMode === 'split');
  const isFull = !isSplit;

  if (isCoverOrSpread) {
    return (
      <div className="mb-2">
        <TooltipProvider>
          <div className="flex items-center justify-between gap-1 rounded-lg border bg-background p-0.5 shadow-lg px-2 flex-wrap">
            <span className="text-sm font-semibold text-muted-foreground mr-auto pl-1">
              {displayLabel || (page.isCover ? "Cover" : `Page ${pageNumber}`)}
            </span>

            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Mode:</span>
              <div className="flex bg-muted/50 p-0.5 rounded-md border">
                <button
                  onClick={() => {
                    if (page.isCover) {
                      onUpdateCoverType?.(page.id, 'full');
                    } else {
                      onUpdatePage?.({ ...page, spreadMode: 'full' });
                    }
                  }}
                  className={cn(
                    "px-2 py-0.5 text-xs rounded-sm transition-all",
                    isFull
                      ? "bg-background shadow-sm text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Full
                </button>
                <div className="w-px bg-border/50 my-0.5" />
                <button
                  onClick={() => {
                    if (page.isCover) {
                      onUpdateCoverType?.(page.id, 'split');
                    } else {
                      onUpdatePage?.({ ...page, spreadMode: 'split' });
                    }
                  }}
                  className={cn(
                    "px-2 py-0.5 text-xs rounded-sm transition-all",
                    isSplit
                      ? "bg-background shadow-sm text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Split
                </button>
              </div>
            </div>

            <div className="h-4 w-px bg-border mx-2" />

            {/* Layout Dropdowns */}
            <div className="flex items-center gap-2">
              {isSplit ? (
                <>
                  {/* Left / Back Layout + Rotation */}
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="gap-1 px-2">
                            <LayoutTemplate className="h-4 w-4" />
                            <span className="text-xs">{page.isCover ? "Back" : "Page 1"}</span>
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>{page.isCover ? "Back Cover Layout" : "Page 1 Layout"}</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent className="p-2 grid grid-cols-4 gap-2">
                      {(page.isCover ? [...coverTemplates, ...advancedTemplates] : [...gridTemplates, ...advancedTemplates]).map(template => (
                        <TemplateThumbnail
                          key={template.id}
                          template={template}
                          isSelected={parseLayoutId(page.isCover ? page.coverLayouts?.back || '' : page.spreadLayouts?.left || '').baseId === template.id}
                          onSelect={(templateId) => {
                            // When selecting a new template, preserve current rotation if any
                            const currentLayoutId = page.isCover ? page.coverLayouts?.back : page.spreadLayouts?.left;
                            const { rotation } = parseLayoutId(currentLayoutId || '');
                            const finalId = rotation === 0 ? templateId : `${templateId}_r${rotation}`;
                            if (page.isCover) {
                              onUpdateCoverLayout?.(page.id, 'back', finalId);
                            } else {
                              if (onUpdateSpreadLayout) {
                                onUpdateSpreadLayout(page.id, 'left', finalId);
                              } else {
                                const currentLayouts = page.spreadLayouts || { left: defaultGridTemplate.id, right: defaultGridTemplate.id };
                                onUpdatePage?.({ ...page, spreadLayouts: { ...currentLayouts, left: finalId } });
                              }
                            }
                          }}
                        />
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {/* Rotation Button for Left/Back */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="relative h-8 w-8"
                        onClick={() => {
                          const currentLayoutId = page.isCover ? page.coverLayouts?.back : page.spreadLayouts?.left;
                          const { baseId, rotation } = parseLayoutId(currentLayoutId || '1-full');
                          const newRotation = getNextRotation(rotation);
                          const newLayout = newRotation === 0 ? baseId : `${baseId}_r${newRotation}`;
                          if (page.isCover) {
                            onUpdateCoverLayout?.(page.id, 'back', newLayout);
                          } else {
                            if (onUpdateSpreadLayout) {
                              onUpdateSpreadLayout(page.id, 'left', newLayout);
                            } else {
                              const currentLayouts = page.spreadLayouts || { left: defaultGridTemplate.id, right: defaultGridTemplate.id };
                              onUpdatePage?.({ ...page, spreadLayouts: { ...currentLayouts, left: newLayout } });
                            }
                          }
                        }}
                      >
                        <RotateCw className="h-4 w-4" />
                        {parseLayoutId(page.isCover ? page.coverLayouts?.back || '1-full' : page.spreadLayouts?.left || '1-full').rotation !== 0 && (
                          <span className="absolute -top-1 -right-1 text-[9px] bg-primary text-primary-foreground px-1 rounded">
                            {parseLayoutId(page.isCover ? page.coverLayouts?.back || '1-full' : page.spreadLayouts?.left || '1-full').rotation}°
                          </span>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Rotate {page.isCover ? "Back" : "Page 1"} Layout 90°</TooltipContent>
                  </Tooltip>

                  <div className="h-4 w-px bg-border mx-1" />

                  {/* Right / Front Layout + Rotation */}
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="gap-1 px-2">
                            <LayoutTemplate className="h-4 w-4" />
                            <span className="text-xs">{page.isCover ? "Front" : "Page 2"}</span>
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>{page.isCover ? "Front Cover Layout" : "Page 2 Layout"}</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent className="p-2 grid grid-cols-4 gap-2">
                      {/* For Cover: Combine Cover Templates + Advanced Templates */}
                      {/* For Pages: Combine Layout Templates + Advanced Templates */}
                      {(page.isCover
                        ? [...coverTemplates, ...advancedTemplates]
                        : [...gridTemplates, ...advancedTemplates]
                      ).map(template => (
                        <TemplateThumbnail
                          key={template.id}
                          template={template}
                          isSelected={parseLayoutId(page.isCover ? page.coverLayouts?.front || '1-full' : page.spreadLayouts?.right || '1-full').baseId === template.id}
                          onSelect={(templateId) => {
                            const currentLayoutId = page.isCover ? page.coverLayouts?.front : page.spreadLayouts?.right;
                            const { rotation } = parseLayoutId(currentLayoutId || '1-full');
                            const finalId = rotation === 0 ? templateId : `${templateId}_r${rotation}`;
                            if (page.isCover) {
                              onUpdateCoverLayout?.(page.id, 'front', finalId);
                            } else {
                              if (onUpdateSpreadLayout) {
                                onUpdateSpreadLayout(page.id, 'right', finalId);
                              } else {
                                const currentLayouts = page.spreadLayouts || { left: defaultGridTemplate.id, right: defaultGridTemplate.id };
                                onUpdatePage?.({ ...page, spreadLayouts: { ...currentLayouts, right: finalId } });
                              }
                            }
                          }}
                        />
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {/* Rotation Button for Right/Front */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="relative h-8 w-8"
                        onClick={() => {
                          const currentLayoutId = page.isCover ? page.coverLayouts?.front : page.spreadLayouts?.right;
                          const { baseId, rotation } = parseLayoutId(currentLayoutId || '1-full');
                          const newRotation = getNextRotation(rotation);
                          const newLayout = newRotation === 0 ? baseId : `${baseId}_r${newRotation}`;
                          if (page.isCover) {
                            onUpdateCoverLayout?.(page.id, 'front', newLayout);
                          } else {
                            if (onUpdateSpreadLayout) {
                              onUpdateSpreadLayout(page.id, 'right', newLayout);
                            } else {
                              const currentLayouts = page.spreadLayouts || { left: defaultGridTemplate.id, right: defaultGridTemplate.id };
                              onUpdatePage?.({ ...page, spreadLayouts: { ...currentLayouts, right: newLayout } });
                            }
                          }
                        }}
                      >
                        <RotateCw className="h-4 w-4" />
                        {parseLayoutId(page.isCover ? page.coverLayouts?.front || '1-full' : page.spreadLayouts?.right || '1-full').rotation !== 0 && (
                          <span className="absolute -top-1 -right-1 text-[9px] bg-primary text-primary-foreground px-1 rounded">
                            {parseLayoutId(page.isCover ? page.coverLayouts?.front || '1-full' : page.spreadLayouts?.right || '1-full').rotation}°
                          </span>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Rotate {page.isCover ? "Front" : "Page 2"} Layout 90°</TooltipContent>
                  </Tooltip>
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
                    {(page.isCover ? [...coverTemplates, ...advancedTemplates] : [...gridTemplates, ...advancedTemplates]).map(template => (
                      <TemplateThumbnail
                        key={template.id}
                        template={template}
                        isSelected={parseLayoutId(page.layout || '1-full').baseId === template.id}
                        onSelect={(templateId) => {
                          const { rotation } = parseLayoutId(page.layout || '1-full');
                          const finalId = rotation === 0 ? templateId : `${templateId}_r${rotation}`;
                          if (page.isCover) {
                            onUpdateCoverLayout?.(page.id, 'full', finalId);
                          } else {
                            onUpdateLayout(page.id, finalId);
                          }
                        }}
                      />
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Rotation Button for Full mode only (Split mode has its own rotation buttons above) */}
            {isFull && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const { baseId, rotation } = parseLayoutId(page.layout || '1-full');
                      const newRotation = getNextRotation(rotation);
                      const newLayout = newRotation === 0 ? baseId : `${baseId}_r${newRotation}`;
                      if (page.isCover) {
                        onUpdateCoverLayout?.(page.id, 'full', newLayout);
                      } else {
                        onUpdateLayout(page.id, newLayout);
                      }
                    }}
                  >
                    <RotateCw className="h-4 w-4" />
                    {parseLayoutId(page.layout || '1-full').rotation !== 0 && (
                      <span className="absolute -top-1 -right-1 text-[9px] bg-primary text-primary-foreground px-1 rounded">
                        {parseLayoutId(page.layout || '1-full').rotation}°
                      </span>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Rotate Layout 90°</TooltipContent>
              </Tooltip>
            )}

            <div className="h-4 w-px bg-border mx-2" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => onDownloadPage?.(page.id)}><Download className="h-5 w-5" /></Button>
              </TooltipTrigger>
              <TooltipContent>Download {page.isCover ? "Cover" : "Spread"}</TooltipContent>
            </Tooltip>

            {/* Restored Buttons: Pencil, Wand, Undo */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onOpenCoverEditor?.(page.id)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit Design</TooltipContent>
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


            {!page.isCover && (
              <>
                <div className="h-4 w-px bg-border mx-2" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "text-destructive hover:bg-destructive/10 hover:text-destructive",
                        !canDelete && "opacity-50 cursor-not-allowed"
                      )}
                      onClick={() => canDelete && onDeletePage(page.id)}
                      disabled={!canDelete}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete Spread</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </TooltipProvider>
      </div>
    );
  }


  return (
    <div className="mb-2">
      <TooltipProvider>
        <div className="flex items-center justify-between gap-1 rounded-lg border bg-background p-0.5 shadow-lg px-2">
          <span className="text-sm font-semibold text-muted-foreground mr-auto">
            {displayLabel || `Page ${pageNumber}`}
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
                {[...gridTemplates, ...advancedTemplates].map(template => (
                  <TemplateThumbnail
                    key={template.id}
                    template={template}
                    isSelected={parseLayoutId(page.layout || '1-full').baseId === template.id}
                    onSelect={(templateId) => {
                      const { rotation } = parseLayoutId(page.layout || '1-full');
                      const finalId = rotation === 0 ? templateId : `${templateId}_r${rotation}`;
                      onUpdateLayout(page.id, finalId);
                    }}
                  />
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Rotation Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    console.log('[RotateButton] Clicked! Current layout:', page.layout);
                    const { baseId, rotation } = parseLayoutId(page.layout || '1-full');
                    console.log('[RotateButton] Parsed:', { baseId, rotation });
                    const newRotation = getNextRotation(rotation);
                    console.log('[RotateButton] New rotation:', newRotation);
                    const newLayout = newRotation === 0 ? baseId : `${baseId}_r${newRotation}`;
                    console.log('[RotateButton] New layout ID:', newLayout);
                    onUpdateLayout(page.id, newLayout);
                  }}
                  className="relative"
                >
                  <RotateCw className="h-4 w-4" />
                  {parseLayoutId(page.layout || '1-full').rotation !== 0 && (
                    <span className="absolute -top-1 -right-1 text-[9px] bg-primary text-primary-foreground px-1 rounded">
                      {parseLayoutId(page.layout || '1-full').rotation}°
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Rotate Layout 90°</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => onDownloadPage?.(page.id)}><Download className="h-5 w-5" /></Button>
              </TooltipTrigger>
              <TooltipContent>Download Page</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onOpenCoverEditor?.(page.id)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit Page Design</TooltipContent>
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
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "text-destructive hover:bg-destructive/10 hover:text-destructive",
                    !canDelete && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => canDelete && onDeletePage(page.id)}
                  disabled={!canDelete}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{canDelete ? "Delete Page" : "Cannot delete first/last page"}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </TooltipProvider>
    </div>
  );
};

// --- Scaled Cover Preview Wrapper ---
const ScaledCoverPreview = React.memo(({
  page,
  config,
  onUpdateTitleSettings,
  onDropPhoto,
  onUpdatePhotoPanAndZoom,
  onInteractionChange,
  onRemovePhoto,
  allPhotos = [],
  previousPagePhotos = [],
}: {
  page: AlbumPage;
  config: AlbumConfig;
  onUpdateTitleSettings?: any;
  onDropPhoto?: any;
  onUpdatePhotoPanAndZoom?: any;
  onInteractionChange?: (isInteracting: boolean) => void;
  onRemovePhoto?: (pageId: string, photoId: string) => void;
  allPhotos?: Photo[];
  previousPagePhotos?: Photo[];
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const BASE_PAGE_PX = 450;

  // Re-calculate logical dimensions for rendering
  const sizeStr = config?.size || '800x600';
  const [wStr, hStr] = sizeStr.split('x');
  const cfgW = Number(wStr);
  const cfgH = Number(hStr);
  const pxPerUnit = BASE_PAGE_PX / cfgH;
  const singlePageLogicalW = cfgW * pxPerUnit;
  // Use same logic as cover-canvas to ensure consistent "logical" size vs editor
  // Spine is 0 for regular pages
  const spineWidth = page.isCover ? (page.spineWidth ?? 40) : 0;
  const isDouble = page.isCover || page.type === 'spread';
  const logicalWidth = isDouble ? (singlePageLogicalW * 2) + spineWidth : singlePageLogicalW;
  const logicalHeight = BASE_PAGE_PX;

  useEffect(() => {
    if (!wrapperRef.current) return;
    const measure = () => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const { width: availW, height: availH } = wrapper.getBoundingClientRect();
      if (availW === 0 || availH === 0) return;

      const scaleX = availW / logicalWidth;
      const scaleY = availH / logicalHeight;
      const fitScale = Math.min(scaleX, scaleY);
      setScale(fitScale);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, [logicalWidth, logicalHeight]);

  return (
    <div ref={wrapperRef} className="w-full h-full flex items-center justify-center overflow-hidden">
      <div className="shadow-lg" style={{
        width: logicalWidth,
        height: logicalHeight,
        transform: `scale(${scale})`,
        transformOrigin: 'center center', // Scale from center
        flexShrink: 0,
        position: 'relative' // Ensure relative positioning for children
      }}>
        <AlbumCover
          page={page}
          config={config}
          mode="preview"
          activeView="full"
          onUpdateTitleSettings={onUpdateTitleSettings}
          onDropPhoto={onDropPhoto}
          onUpdatePhotoPanAndZoom={onUpdatePhotoPanAndZoom}
          onInteractionChange={onInteractionChange}
          onRemovePhoto={onRemovePhoto}
          allPhotos={allPhotos}
          previousPagePhotos={previousPagePhotos}
        />
        <div className="absolute inset-0 z-20 pointer-events-none">
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

    </div>
  );
});
ScaledCoverPreview.displayName = 'ScaledCoverPreview';


export function AlbumPreview({
  pages,
  config,
  onDeletePage,
  onAddSpread,
  onUpdateLayout,
  onUpdateCoverLayout,
  onUpdateSpreadLayout,
  onUpdateCoverType,
  onUpdatePage, // New prop
  onUpdateSpineText,
  onUpdateSpineSettings,
  onUpdateTitleSettings,
  onUpdatePhotoPanAndZoom,
  onDropPhoto,
  onDownloadPage,
  allPhotos,
  onRemovePhoto,
  customTemplates,
}: AlbumPreviewProps) {
  const { previewPhotoGap, previewPageMargin, previewCornerRadius } = useAlbumPreview();
  const { toast } = useToast();
  const [isInteracting, setIsInteracting] = useState(false);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [isPageEditorOpen, setIsPageEditorOpen] = useState(false);
  const [dragOverPhotoId, setDragOverPhotoId] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Track visible pages using IntersectionObserver
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set());
  const pageRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        setVisiblePages(prev => {
          const next = new Set(prev);
          entries.forEach(entry => {
            const index = parseInt(entry.target.getAttribute('data-page-index') || '-1');
            if (index >= 0) {
              if (entry.isIntersecting) {
                next.add(index);
              } else {
                next.delete(index);
              }
            }
          });
          return next;
        });
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    // Observe all page refs
    pageRefs.current.forEach((el, index) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [pages.length]);

  const handleOpenPageEditor = (pageId: string) => {
    setActivePageId(pageId);
    setIsPageEditorOpen(true);
  };

  const editingPage = pages.find(p => p.id === activePageId);
  // Calculate Page Info (Labels and Ranges)
  const pageInfo = React.useMemo(() => {
    let counter = 1;
    return pages.map(page => {
      if (page.isCover) {
        return { label: "Cover", start: 0, end: 0, isCover: true };
      }
      if (page.type === 'spread') {
        const start = counter;
        const end = counter + 1;
        counter += 2;
        return { label: `Pages ${start}-${end}`, start, end, isCover: false };
      }
      // Single
      const current = counter;
      counter += 1;
      return { label: `Page ${current}`, start: current, end: current, isCover: false };
    });
  }, [pages]);


  if (pages.length <= 0) {
    return (
      <Card className="flex h-[85vh] w-full items-center justify-center bg-muted/50 border-2 border-dashed">
        <div className="text-center text-muted-foreground">
          <BookOpenText className="mx-auto h-12 w-12" />
          <h3 className="mt-4 text-lg font-semibold">Your Album Preview</h3>
          <p>Generate dummy photos to begin creating your photobook.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="w-full relative">
      <ScrollArea ref={scrollAreaRef} className="h-[85vh] w-full" style={{ overflowY: isInteracting ? 'hidden' : 'auto' }}>
        <div className="space-y-8">
          {pages.map((page, index) => {
            const info = pageInfo[index];
            const isVisible = visiblePages.has(index);

            // Calculate previousPagePhotos for suggestion fan
            const previousPagePhotos = index > 0 ? (pages[index - 1]?.photos || []) : [];

            // Create effective config: visible pages get preview values, hidden pages keep actual values
            // Optimization: Reuse the 'config' object reference for hidden pages to allow memoization to work
            const effectiveConfig: AlbumConfig = (isVisible && (previewPhotoGap !== null || previewPageMargin !== null || previewCornerRadius !== null))
              ? {
                ...config,
                photoGap: (previewPhotoGap !== null && previewPhotoGap !== undefined) ? previewPhotoGap : (config.photoGap ?? 0),
                pageMargin: (previewPageMargin !== null && previewPageMargin !== undefined) ? previewPageMargin : (config.pageMargin ?? 0),
                cornerRadius: (previewCornerRadius !== null && previewCornerRadius !== undefined) ? previewCornerRadius : (config.cornerRadius ?? 0),
              }
              : config;

            return (
              <div
                key={page.id}
                id={`album-page-${index}`}
                data-page-index={index}
                ref={(el) => {
                  pageRefs.current.set(index, el);
                }}
                className="w-full max-w-4xl mx-auto"
              >
                <div className="w-full relative group/page">

                  <div className={cn("h-18", page.type === 'single' ? 'w-1/2 mx-auto' : 'w-full')}>
                    <PageToolbar
                      page={page}
                      pageNumber={index} // Keep for internal logic if needed, but display comes from label
                      displayLabel={info.label} // New Prop
                      canDelete={!page.isCover && page.type !== 'single'}
                      onDeletePage={() => onDeletePage(page.id)}
                      onUpdateLayout={onUpdateLayout}
                      onUpdateSpreadLayout={onUpdateSpreadLayout}
                      onUpdateCoverLayout={onUpdateCoverLayout}
                      onUpdateCoverType={onUpdateCoverType}
                      onUpdateSpineText={onUpdateSpineText}
                      onUpdateSpineSettings={onUpdateSpineSettings}
                      onUpdateTitleSettings={onUpdateTitleSettings}
                      onOpenCoverEditor={handleOpenPageEditor}
                      onDownloadPage={onDownloadPage}
                      onUpdatePage={onUpdatePage}
                      toast={toast}
                    />
                  </div>

                  <div className={cn(page.type === 'single' && 'w-1/2 mx-auto')}>
                    <AspectRatio
                      ratio={(
                        () => {
                          const sizeStr = config?.size || '800x600';
                          const [w, h] = sizeStr.split('x').map(Number);
                          const baseRatio = w / h;
                          if (page.isCover) {
                            // Include spine width in cover ratio to match ScaledCoverPreview
                            const BASE_PAGE_PX = 450;
                            const pxPerUnit = BASE_PAGE_PX / h;
                            const singlePageW = w * pxPerUnit;
                            const spineWidth = page.spineWidth ?? 40;
                            const coverWidth = (singlePageW * 2) + spineWidth;
                            return coverWidth / BASE_PAGE_PX;
                          }
                          return page.type === 'spread' ? baseRatio * 2 : baseRatio;
                        }
                      )()}
                    >

                      <Card
                        className="h-full w-full border-none bg-transparent shadow-none"
                      >
                        <CardContent
                          className="flex h-full w-full items-center justify-center p-0"
                          style={{ padding: 0 }}
                        >
                          {page.isCover ? (
                            <ScaledCoverPreview
                              page={page}
                              config={effectiveConfig}
                              onUpdateTitleSettings={onUpdateTitleSettings}
                              onDropPhoto={onDropPhoto}
                              onUpdatePhotoPanAndZoom={onUpdatePhotoPanAndZoom}
                              onInteractionChange={setIsInteracting}
                              onRemovePhoto={onRemovePhoto}
                              allPhotos={allPhotos}
                              previousPagePhotos={previousPagePhotos}
                            />
                          ) : page.type === 'spread' ? (
                            <div className="relative h-full w-full">
                              {/* Spine simulation */}
                              <div className="absolute inset-y-0 left-1/2 -ml-px w-px bg-border z-10 pointer-events-none"></div>
                              <div className="absolute inset-y-0 left-1/2 w-4 -ml-2 bg-gradient-to-r from-transparent to-black/10 z-10 pointer-events-none"></div>
                              <div className="absolute inset-y-0 right-1/2 w-4 -mr-2 bg-gradient-to-l from-transparent to-black/10 z-10 pointer-events-none"></div>
                              <ScaledCoverPreview
                                page={page}
                                config={effectiveConfig}
                                onUpdateTitleSettings={onUpdateTitleSettings}
                                onDropPhoto={onDropPhoto}
                                onUpdatePhotoPanAndZoom={onUpdatePhotoPanAndZoom}
                                onInteractionChange={setIsInteracting}
                                onRemovePhoto={onRemovePhoto}
                                allPhotos={allPhotos}
                                previousPagePhotos={previousPagePhotos}
                              />
                            </div>
                          ) : (
                            <ScaledCoverPreview
                              page={page}
                              config={effectiveConfig}
                              onUpdateTitleSettings={onUpdateTitleSettings}
                              onDropPhoto={onDropPhoto}
                              onUpdatePhotoPanAndZoom={onUpdatePhotoPanAndZoom}
                              onRemovePhoto={onRemovePhoto}
                              allPhotos={allPhotos}
                              previousPagePhotos={previousPagePhotos}
                            />
                          )}

                        </CardContent>
                      </Card>
                    </AspectRatio>
                  </div>
                </div>

                {/* Add Spread Button - Show between pages (not after cover, not after last page) */}
                {onAddSpread && !page.isCover && index < pages.length - 1 && (
                  <div className="flex justify-center py-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="opacity-40 hover:opacity-100 transition-opacity"
                      onClick={() => onAddSpread(index)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Spread
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div >
      </ScrollArea >

      {isPageEditorOpen && editingPage && (
        <CoverEditorOverlay
          page={editingPage}
          allPhotos={allPhotos}
          isCover={editingPage.isCover ?? false}
          config={config}
          onUpdatePage={(updatedPage) => {
            onUpdatePage?.(updatedPage);
          }}
          onClose={() => setIsPageEditorOpen(false)}
        />
      )}

      {/* Scroll to Top Button */}
      <ScrollToTopButton scrollAreaRef={scrollAreaRef} />

      {/* Navigation Controls */}
      <NavigationControls
        scrollAreaRef={scrollAreaRef}
        totalPages={pages.length}
        pageInfo={pageInfo} // Pass the calculated info
      />
    </div >
  );
}

// Helper Component for Scroll To Top
function ScrollToTopButton({ scrollAreaRef }: { scrollAreaRef: React.RefObject<HTMLDivElement | null> }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollContainer) return;

    const handleScroll = () => {
      if (scrollContainer.scrollTop > 100) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [scrollAreaRef]);

  const scrollToTop = () => {
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    scrollContainer?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Button
      variant="secondary"
      size="icon"
      className={cn(
        "absolute bottom-6 right-8 z-49 rounded-full shadow-lg transition-all duration-300",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
      )}
      onClick={scrollToTop}
    >
      <ArrowUp className="h-5 w-5" />
    </Button>
  );
}

function NavigationControls({
  scrollAreaRef,
  totalPages,
  pageInfo
}: {
  scrollAreaRef: React.RefObject<HTMLDivElement | null>,
  totalPages: number,
  pageInfo: { label: string; start: number; end: number; isCover: boolean; }[]
}) {
  const [targetPage, setTargetPage] = useState<string>("");
  const [stepSize, setStepSize] = useState<string>("5");

  const scrollToIndex = (index: number) => {
    const el = document.getElementById(`album-page-${index}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleJump = () => {
    const pageNum = parseInt(targetPage);
    if (!isNaN(pageNum)) {
      // Find the index where the pageNum falls within range
      const targetIndex = pageInfo.findIndex(info => !info.isCover && pageNum >= info.start && pageNum <= info.end);

      if (targetIndex !== -1) {
        scrollToIndex(targetIndex);
        setTargetPage("");
      } else if (pageNum === 0) {
        // Allow 0 for cover
        scrollToIndex(0);
        setTargetPage("");
      }
    }
  };

  const activeIndexRef = useRef(0);

  // Helper to get current visible index
  const getVisibleIndex = () => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) return 0;

    const viewportRect = viewport.getBoundingClientRect();
    let bestIndex = 0;
    let minDiff = Infinity;

    for (let i = 0; i < totalPages; i++) {
      const el = document.getElementById(`album-page-${i}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        // Distance of element center to viewport center
        const dist = Math.abs((rect.top + rect.height / 2) - (viewportRect.top + viewportRect.height / 2));
        if (dist < minDiff) {
          minDiff = dist;
          bestIndex = i;
        }
      }
    }
    return bestIndex;
  };

  const handleStepJump = (direction: 'up' | 'down') => {
    const current = getVisibleIndex();
    const step = parseInt(stepSize) || 1;
    let next = direction === 'up' ? current - step : current + step;

    // Clamp
    if (next < 0) next = 0;
    if (next >= totalPages) next = totalPages - 1;

    scrollToIndex(next);
  };

  return (
    <div className="absolute right-6 top-1/2 -translate-y-1/2 z-49 flex flex-col gap-4">
      {/* Absolute Jump (Start/End/Specific) */}
      <div className="flex flex-col items-center gap-2 bg-background/90 backdrop-blur-sm p-1.5 rounded-full shadow-lg border">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => scrollToIndex(0)}>
                <ChevronsUp className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Jump to Start</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex flex-col items-center gap-1 my-1">
          <Input
            type="number"
            className="w-10 h-8 px-0.5 text-center text-xs appearance-none [&::-webkit-inner-spin-button]:appearance-none focus-visible:ring-0 focus-visible:ring-offset-0 border border-input shadow-none"
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
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => scrollToIndex(totalPages - 1)}>
                <ChevronsDown className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Jump to End</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Relative Step Jump */}
      <div className="flex flex-col items-center gap-2 bg-background/90 backdrop-blur-sm p-1.5 rounded-full shadow-lg border">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleStepJump('up')}>
                <ChevronUp className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Jump Up</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex flex-col items-center gap-1 my-1">
          <Input
            type="number"
            className="w-10 h-8 px-0.5 text-center text-xs appearance-none [&::-webkit-inner-spin-button]:appearance-none focus-visible:ring-0 focus-visible:ring-offset-0 border border-input shadow-none"
            value={stepSize}
            onChange={(e) => setStepSize(e.target.value)}
            title="Pages to jump"
          />
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleStepJump('down')}>
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
