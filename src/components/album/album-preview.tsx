'use client';

import Image from 'next/image';
import { BookOpenText, Info, Trash2, LayoutTemplate, Download, Image as ImageIcon, Wand2, Undo, Crop } from 'lucide-react';
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
import { LAYOUT_TEMPLATES } from './layout-templates';
import { ScrollArea } from '@/components/ui/scroll-area';


interface PageLayoutProps {
  page: AlbumPage;
  onUpdatePhotoPanAndZoom: (pageId: string, photoId: string, panAndZoom: PhotoPanAndZoom) => void;
}

function PageLayout({ page, onUpdatePhotoPanAndZoom }: PageLayoutProps) {
    const { photos, layout } = page;
    const template = LAYOUT_TEMPLATES.find(t => t.id === layout) || LAYOUT_TEMPLATES[0];

    return (
        <div className={cn(
            "grid grid-cols-12 grid-rows-12 gap-2 h-full w-full"
        )}>
            {photos.slice(0, template.photoCount).map((photo, index) => (
                <div
                    key={photo.id}
                    className={cn(
                        'relative rounded-md overflow-hidden bg-muted group/photo',
                        template.grid[index]
                    )}
                >
                    <PhotoRenderer 
                      photo={photo} 
                      onUpdate={(panAndZoom) => onUpdatePhotoPanAndZoom(page.id, photo.id, panAndZoom)}
                    />
                </div>
            ))}
        </div>
    );
}

function CoverPageLayout({ side }: { side: 'front' | 'back' }) {
  return (
    <div className="relative h-full w-full bg-muted flex items-center justify-center">
      <span className="text-6xl font-bold text-black/10 select-none uppercase">
        {side}
      </span>
    </div>
  );
}

interface AlbumPreviewProps {
  pages: AlbumPage[];
  config: AlbumConfig;
  onDeletePage: (pageId: string) => void;
  onUpdateLayout: (pageId: string, newLayout: string) => void;
  onUpdatePhotoPanAndZoom: (pageId: string, photoId: string, panAndZoom: PhotoPanAndZoom) => void;
}

export function AlbumPreview({ pages, config, onDeletePage, onUpdateLayout, onUpdatePhotoPanAndZoom }: AlbumPreviewProps) {
  const { toast } = useToast();
  
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
        <ScrollArea className="h-[85vh] w-full pr-4">
            <div className="space-y-8">
                {pages.map((page) => (
                    <div key={page.id} className="pt-12" onWheel={(e) => e.stopPropagation()}>
                        <div className={cn('w-full relative group/page max-w-4xl mx-auto')}>
                            {/* Page Toolbar */}
                            {!page.isCover && (
                                <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center">
                                <TooltipProvider>
                                    <div className="flex items-center gap-1 rounded-lg border bg-background p-0.5 shadow-lg">
                                        <DropdownMenu>
                                            <Tooltip>
                                            <TooltipTrigger asChild>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon"><LayoutTemplate className="h-5 w-5" /></Button>
                                                </DropdownMenuTrigger>
                                            </TooltipTrigger>
                                            <TooltipContent>Page Layout</TooltipContent>
                                            </Tooltip>
                                            <DropdownMenuContent className="p-2 grid grid-cols-4 gap-2 w-[400px]">
                                            {LAYOUT_TEMPLATES.map(template => {
                                                return (
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
                                                );
                                            })}
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={() => toast({ title: "Feature coming soon!" })}>
                                            <Download className="h-5 w-5" />
                                            </Button>
                                        </TooltipTrigger>
                                            <TooltipContent>Download Page</TooltipContent>
                                        </Tooltip>

                                        <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={() => toast({ title: "Feature coming soon!" })}>
                                            <ImageIcon className="h-5 w-5" />
                                            </Button>
                                        </TooltipTrigger>
                                            <TooltipContent>Set Background</TooltipContent>
                                        </Tooltip>

                                        <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={() => toast({ title: "Feature coming soon!" })}>
                                            <Wand2 className="h-5 w-5" />
                                            </Button>
                                        </TooltipTrigger>
                                            <TooltipContent>Enhance with AI</TooltipContent>
                                        </Tooltip>
                                        
                                        <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={() => toast({ title: "Feature coming soon!" })}>
                                            <Undo className="h-5 w-5" />
                                            </Button>
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
                                </TooltipProvider>
                                </div>
                            )}
                            <AspectRatio ratio={page.isCover ? 2 / 1 : (page.type === 'spread' ? 2 / 1 : 1 / 1)}>
                                <Card className="h-full w-full shadow-lg">
                                <CardContent className="flex h-full w-full items-center justify-center p-2">
                                    <div className="relative h-full w-full">
                                        {/* Spine simulation */}
                                        {!page.isCover && page.type === 'spread' && <div className="absolute inset-y-0 left-1/2 -ml-px w-px bg-border z-10 pointer-events-none"></div>}
                                        {!page.isCover && page.type === 'spread' && <div className="absolute inset-y-0 left-1/2 w-4 -ml-2 bg-gradient-to-r from-transparent to-black/10 z-10 pointer-events-none"></div>}
                                        {!page.isCover && page.type === 'spread' && <div className="absolute inset-y-0 right-1/2 w-4 -mr-2 bg-gradient-to-l from-transparent to-black/10 z-10 pointer-events-none"></div>}

                                        {page.isCover ? (
                                            <div className="grid grid-cols-2 h-full w-full">
                                                <CoverPageLayout side="back" />
                                                <CoverPageLayout side="front" />
                                            </div>
                                        ) : (
                                            <PageLayout page={page} onUpdatePhotoPanAndZoom={onUpdatePhotoPanAndZoom} />
                                        )}
                                    </div>
                                </CardContent>
                                </Card>
                            </AspectRatio>
                            <div className="pt-2 text-center text-sm text-muted-foreground">
                                {page.isCover ? 'Cover' : `Page ${pages.findIndex(p => p.id === page.id)}`}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
      </ScrollArea>

      <div className="mt-4 flex items-center rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        <Info className="mr-3 h-5 w-5 shrink-0" />
        This is a digital preview. Colors and cropping may vary slightly in the
        final printed product. The book spine and page gutter are simulated.
      </div>
    </div>
  );
}
    
