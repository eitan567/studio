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
  onUpdateSpineText?: (pageId: string, text: string) => void;
  onUpdatePhotoPanAndZoom: (pageId: string, photoId: string, panAndZoom: PhotoPanAndZoom) => void;
  onDropPhoto: (pageId: string, targetPhotoId: string, droppedPhotoId: string) => void;
}

export function AlbumPreview({ pages, config, onDeletePage, onUpdateLayout, onUpdateCoverLayout, onUpdateCoverType, onUpdateSpineText, onUpdatePhotoPanAndZoom, onDropPhoto }: AlbumPreviewProps) {
  const { toast } = useToast();
  const [isInteracting, setIsInteracting] = useState(false);

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

  const PageToolbar = ({ page, pageNumber }: { page: AlbumPage; pageNumber: number }) => {
    if (page.isCover) {
      return (
        <div className="mb-2">
          <TooltipProvider>
            <div className="flex items-center justify-between gap-1 rounded-lg border bg-background p-0.5 shadow-lg px-2">
              <span className="text-sm font-semibold text-muted-foreground mr-2">Cover</span>

              {/* Spine Text Input */}
              <div className="flex items-center gap-2 border-r pr-2 mr-2">
                <input
                  type="text"
                  placeholder="Spine Text"
                  className="h-6 w-32 px-1 text-xs border rounded"
                  value={page.spineText || ''}
                  onChange={(e) => onUpdateSpineText?.(page.id, e.target.value)}
                />
              </div>

              {/* Cover Type Toggle */}
              <div className="flex items-center gap-1 border-r pr-2 mr-2">
                <Button
                  variant={page.coverType === 'full' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => onUpdateCoverType?.(page.id, 'full')}
                >
                  Full
                </Button>
                <Button
                  variant={page.coverType !== 'full' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => onUpdateCoverType?.(page.id, 'split')}
                >
                  Split
                </Button>
              </div>

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
                  /* Full Spread Layout Selector - Reusing Layout Selector logic but applying to page.layout */
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

    // ... Standard Page Toolbar continues below
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
  }; // Add closing brace for PageToolbar function

  // Helper for rendering Spine
  const Spine = ({ text }: { text?: string }) => (
    <div className="relative h-full w-[40px] bg-muted/30 border-x border-dashed border-border/50 flex items-center justify-center overflow-hidden z-20">
      <div className="whitespace-nowrap font-semibold text-muted-foreground/70 tracking-widest text-xs rotate-90 select-none">
        {text || 'ALBUM SPINE'}
      </div>
    </div>
  );

  return (
    <div className="w-full">
      <ScrollArea className="h-[85vh] w-full pr-4" style={{ overflowY: isInteracting ? 'hidden' : 'auto' }}>
        <div className="space-y-8">
          {pages.map((page) => (
            <div key={page.id} className="w-full max-w-4xl mx-auto">
              <div className="w-full relative group/page">

                <div className={cn("h-14", page.type === 'single' ? 'w-1/2 mx-auto' : 'w-full')}>
                  <PageToolbar page={page} pageNumber={pages.findIndex(p => p.id === page.id)} />
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
                        // Full Spread Mode
                        if (page.coverType === 'full') {
                          return (
                            <div className="relative h-full w-full">
                              {/* Spine Overlay */}
                              <div className="absolute inset-y-0 left-1/2 -ml-[20px] h-full z-30 pointer-events-none">
                                <Spine text={page.spineText} />
                              </div>

                              <PageLayout
                                page={page}
                                photoGap={config.photoGap}
                                onUpdatePhotoPanAndZoom={onUpdatePhotoPanAndZoom}
                                onInteractionChange={setIsInteracting}
                                onDropPhoto={onDropPhoto}
                                templateSource={COVER_TEMPLATES} // Uses page.layout
                              />
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

                        // Use grid with 3 columns: 1fr auto 1fr? Or fixed spine width?
                        // Let's use flexbox or grid. 
                        // Grid: [1fr_40px_1fr].
                        return (
                          <div className="grid h-full w-full" style={{ gridTemplateColumns: '1fr 40px 1fr' }}>
                            <div className="relative h-full w-full border-r border-dashed border-border/50 overflow-hidden">
                              <span className="absolute top-2 left-2 z-20 text-[10px] font-bold text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded pointer-events-none uppercase tracking-wider">Back Cover</span>
                              <PageLayout
                                page={page}
                                photoGap={config.photoGap}
                                onUpdatePhotoPanAndZoom={onUpdatePhotoPanAndZoom}
                                onInteractionChange={setIsInteracting}
                                onDropPhoto={onDropPhoto}
                                overrideLayout={backLayoutId}
                                overridePhotos={backPhotos}
                                templateSource={COVER_TEMPLATES}
                              />
                            </div>

                            <Spine text={page.spineText} />

                            <div className="relative h-full w-full border-l border-dashed border-border/50 overflow-hidden">
                              <span className="absolute top-2 left-2 z-20 text-[10px] font-bold text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded pointer-events-none uppercase tracking-wider">Front Cover</span>
                              <PageLayout
                                page={page}
                                photoGap={config.photoGap}
                                onUpdatePhotoPanAndZoom={onUpdatePhotoPanAndZoom}
                                onInteractionChange={setIsInteracting}
                                onDropPhoto={onDropPhoto}
                                overrideLayout={frontLayoutId}
                                overridePhotos={frontPhotos}
                                templateSource={COVER_TEMPLATES}
                              />
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
    </div>
  );
}
