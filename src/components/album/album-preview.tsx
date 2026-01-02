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
import { LAYOUT_TEMPLATES } from './layout-templates';
import { ScrollArea } from '@/components/ui/scroll-area';


interface PageLayoutProps {
  page: AlbumPage;
  photoGap: number;
  onUpdatePhotoPanAndZoom: (pageId: string, photoId: string, panAndZoom: PhotoPanAndZoom) => void;
  onInteractionChange: (isInteracting: boolean) => void;
  onDropPhoto: (pageId: string, targetPhotoId: string, droppedPhotoId: string) => void;
}

function PageLayout({ page, photoGap, onUpdatePhotoPanAndZoom, onInteractionChange, onDropPhoto }: PageLayoutProps) {
  const { photos, layout } = page;
  const template = LAYOUT_TEMPLATES.find(t => t.id === layout) || LAYOUT_TEMPLATES[0];

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
  onDropPhoto: (pageId: string, targetPhotoId: string, droppedPhotoId: string) => void;
}

export function AlbumPreview({ pages, config, onDeletePage, onUpdateLayout, onUpdatePhotoPanAndZoom, onDropPhoto }: AlbumPreviewProps) {
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

  const PageToolbar = ({ page, pageNumber }: { page: AlbumPage; pageNumber: number }) => (
    <div className="mb-2">
      <TooltipProvider>
        <div className="flex items-center justify-between gap-1 rounded-lg border bg-background p-0.5 shadow-lg px-2">
          <span className="text-sm font-semibold text-muted-foreground">
            {page.isCover ? 'Cover' : `Page ${pageNumber}`}
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

  return (
    <div className="w-full">
      <ScrollArea className="h-[85vh] w-full pr-4" style={{ overflowY: isInteracting ? 'hidden' : 'auto' }}>
        <div className="space-y-8">
          {pages.map((page) => (
            <div key={page.id} className="w-full max-w-4xl mx-auto">
              <div className="w-full relative group/page">

                {!page.isCover && (
                  <div className={cn("h-14", page.type === 'single' ? 'w-1/2 mx-auto' : 'w-full')}>
                    <PageToolbar page={page} pageNumber={pages.findIndex(p => p.id === page.id)} />
                  </div>
                )}

                <AspectRatio ratio={page.isCover || page.type === 'spread' ? 2 / 1 : 2} className={cn(page.type === 'single' && 'w-1/2 mx-auto')}>
                  <Card className="h-full w-full shadow-lg">
                    <CardContent
                      className="flex h-full w-full items-center justify-center p-0"
                      style={{ padding: `${config.pageMargin}px` }}
                    >
                      {page.isCover ? (
                        <div className="grid grid-cols-2 h-full w-full">
                          <CoverPageLayout side="back" />
                          <CoverPageLayout side="front" />
                        </div>
                      ) : page.type === 'spread' ? (
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
