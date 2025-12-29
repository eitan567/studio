'use client';

import Image from 'next/image';
import { BookOpenText, Info, Trash2, LayoutTemplate, Crop } from 'lucide-react';
import React, { useState } from 'react';

import type { AlbumPage, AlbumConfig, Photo } from '@/lib/types';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
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
import { PhotoEditorDialog } from './photo-editor-dialog';
import type { PhotoPanAndZoom } from '@/lib/types';


interface PageLayoutProps {
  page: AlbumPage;
}

function PageLayout({ page }: PageLayoutProps) {
    const { photos, layout } = page;
    const photoCount = parseInt(layout) || photos.length;
    
    // --- Grid Classes ---
    const gridClasses: { [key: string]: string } = {
        '1': 'grid-cols-1 grid-rows-1',
        '2': 'grid-cols-2 grid-rows-1',
        '3': 'grid-cols-2 grid-rows-2',
        '4': 'grid-cols-2 grid-rows-2',
        '6': 'grid-cols-3 grid-rows-2',
    };
    
    // --- Photo Span Classes ---
    const photoSpanClasses: { [key:string]: string[] } = {
        '1': ['col-span-full row-span-full'],
        '2': ['', ''],
        '3': ['row-span-2', '', ''],
        '4': ['', '', '', ''],
        '6': ['', '', '', '', '', ''],
    };

    const getGridClass = (index: number) => {
        const layoutKey = photoCount.toString();
        if (layoutKey in photoSpanClasses && photoSpanClasses[layoutKey][index]) {
          return photoSpanClasses[layoutKey][index];
        }
        return '';
    };
    
    const baseGrid = gridClasses[layout] || 'grid-cols-2 grid-rows-1';

    return (
        <div className={`grid ${baseGrid} gap-2 h-full w-full p-4`}>
            {photos.map((photo, index) => (
                <div
                    key={photo.id}
                    className={cn(
                        'relative rounded-md overflow-hidden bg-muted group/photo',
                        getGridClass(index)
                    )}
                >
                    <Image
                        src={photo.src}
                        alt={photo.alt}
                        fill
                        className="object-cover"
                        style={{
                            transform: `scale(${photo.panAndZoom?.scale ?? 1}) translate(${(photo.panAndZoom?.x ?? 50) - 50}%, ${(photo.panAndZoom?.y ?? 50) - 50}%)`,
                        }}
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center">
                        <PhotoEditorTrigger pageId={page.id} photo={photo} />
                    </div>
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

// Global state to manage the dialog's content and visibility
let photoToEdit: { pageId: string, photo: Photo } | null = null;
let setDialogState: React.Dispatch<React.SetStateAction<boolean>> | null = null;

// Trigger component that can be placed anywhere
function PhotoEditorTrigger({ pageId, photo }: { pageId: string, photo: Photo }) {
    return (
        <Button
            variant="secondary"
            size="sm"
            onClick={() => {
                photoToEdit = { pageId, photo };
                setDialogState?.(true);
            }}
        >
            <Crop className="mr-2 h-4 w-4" /> Edit
        </Button>
    );
}

export function AlbumPreview({ pages, config, onDeletePage, onUpdateLayout, onUpdatePhotoPanAndZoom }: AlbumPreviewProps) {
  const [isPhotoEditorOpen, setIsPhotoEditorOpen] = useState(false);
  setDialogState = setIsPhotoEditorOpen;
  
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
      <Carousel
        opts={{
          align: 'start',
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-2 md:-ml-8">
          {pages.map((page, index) => (
            <CarouselItem key={page.id} className="pl-2 md:pl-8 md:basis-full">
              <div className="flex justify-center">
                <div
                  className={cn(
                    'w-full',
                    page.type === 'spread' ? 'md:w-full' : 'md:w-1/2'
                  )}
                >
                  <AspectRatio ratio={page.type === 'spread' ? 2 / 1 : 1 / 1}>
                    <Card className="h-full w-full shadow-lg group/page">
                      <CardContent className="flex h-full w-full items-center justify-center p-0">
                        {page.type === 'spread' ? (
                          <div className="relative h-full w-full">
                             {/* Spine simulation */}
                            {!page.isCover && <div className="absolute inset-y-0 left-1/2 -ml-px w-px bg-border z-10"></div>}
                            {!page.isCover && <div className="absolute inset-y-0 left-1/2 w-4 -ml-2 bg-gradient-to-r from-transparent to-black/10 z-10 pointer-events-none"></div>}
                            {!page.isCover && <div className="absolute inset-y-0 right-1/2 w-4 -mr-2 bg-gradient-to-l from-transparent to-black/10 z-10 pointer-events-none"></div>}

                            {page.isCover ? (
                                <div className="grid grid-cols-2 h-full w-full">
                                    <CoverPageLayout side="back" />
                                    <CoverPageLayout side="front" />
                                </div>
                            ) : (
                                <PageLayout page={page} />
                            )}
                          </div>
                        ) : (
                           <div className="w-full h-full flex justify-center">
                                <div className="w-full h-full">
                                    <PageLayout page={page} />
                                </div>
                            </div>
                        )}
                      </CardContent>
                      {!page.isCover && (
                         <div className="absolute top-2 right-2 z-20 flex items-center gap-2 opacity-0 group-hover/page:opacity-100 transition-opacity">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="secondary" size="sm"><LayoutTemplate className="mr-2 h-4 w-4" /> Layout</Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                {[1, 2, 3, 4, 6].map(num => (
                                    <DropdownMenuItem key={num} onSelect={() => onUpdateLayout(page.id, num.toString())}>
                                    {num} Photo{num > 1 ? 's' : ''}
                                    </DropdownMenuItem>
                                ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                           <Button variant="destructive" size="sm" onClick={() => onDeletePage(page.id)}>
                             <Trash2 className="h-4 w-4" />
                           </Button>
                         </div>
                       )}
                    </Card>
                  </AspectRatio>
                  <div className="pt-2 text-center text-sm text-muted-foreground">
                    {page.isCover ? 'Cover' : `Page ${pages.findIndex(p => p.id === page.id)}`}
                  </div>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="-left-4" />
        <CarouselNext className="-right-4" />
      </Carousel>

      <PhotoEditorDialog
        isOpen={isPhotoEditorOpen}
        setIsOpen={setIsPhotoEditorOpen}
        photo={photoToEdit?.photo}
        pageId={photoToEdit?.pageId}
        onSave={onUpdatePhotoPanAndZoom}
      />

      <div className="mt-4 flex items-center rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        <Info className="mr-3 h-5 w-5 shrink-0" />
        This is a digital preview. Colors and cropping may vary slightly in the
        final printed product. The book spine and page gutter are simulated.
      </div>
    </div>
  );
}
    