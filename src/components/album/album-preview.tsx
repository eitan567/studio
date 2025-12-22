'use client';

import Image from 'next/image';
import { BookOpenText, Info } from 'lucide-react';

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

interface AlbumPreviewProps {
  pages: AlbumPage[];
  config: AlbumConfig;
}

function PageLayout({ photos, isCover, side }: { photos: Photo[], isCover?: boolean, side?: 'front' | 'back' }) {
    if (isCover) {
        return (
          <div className="relative h-full w-full bg-muted flex items-center justify-center">
            <span className="text-6xl font-bold text-black/10 select-none uppercase">
              {side}
            </span>
          </div>
        );
      }

  const gridClasses = {
    1: 'grid-cols-1 grid-rows-1',
    2: 'grid-cols-2 grid-rows-1',
    3: 'grid-cols-2 grid-rows-2',
    4: 'grid-cols-2 grid-rows-2',
    5: 'grid-cols-3 grid-rows-2',
    6: 'grid-cols-3 grid-rows-2',
  };

  const specialLayouts: { [key: number]: string[] } = {
    3: ['row-span-2', '', ''],
    5: ['row-span-2', '', '', '', ''],
  }

  const getGridClass = (index: number) => {
    if (photos.length in specialLayouts) {
      return specialLayouts[photos.length][index]
    }
    return '';
  }

  return (
    <div className={`grid ${gridClasses[photos.length as keyof typeof gridClasses] || 'grid-cols-2 grid-rows-2'} gap-2 h-full w-full p-4`}>
        {photos.map((photo, index) => (
            <div key={photo.id} className={cn("relative rounded-md overflow-hidden bg-muted", getGridClass(index))}>
                 <Image src={photo.src} alt={photo.alt} fill className="object-cover" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
            </div>
        ))}
    </div>
  );
}

export function AlbumPreview({ pages, config }: AlbumPreviewProps) {
  if (pages.length <= 1 && pages[0]?.isCover) {
    return (
      <Card className="flex h-[80vh] w-full items-center justify-center bg-muted/50 border-2 border-dashed">
        <div className="text-center text-muted-foreground">
          <BookOpenText className="mx-auto h-12 w-12" />
          <h3 className="mt-4 text-lg font-semibold">Your Album Preview</h3>
          <p>Add photos to begin creating your photobook.</p>
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
        <CarouselContent className="-ml-2">
          {pages.map((page, index) => (
            <CarouselItem key={index} className={cn("pl-8", page.type === 'spread' ? "md:basis-full" : "md:basis-1/2")}>
                <AspectRatio ratio={page.type === 'spread' ? 2/1 : 1/1}>
                    <Card className="h-full w-full shadow-lg">
                        <CardContent className="flex h-full w-full items-center justify-center p-0">
                        {page.type === 'spread' ? (
                            <div className="grid grid-cols-2 h-full w-full relative">
                                <div className="absolute inset-y-0 left-1/2 -ml-px w-px bg-border z-10"></div>
                                <div className="absolute inset-y-0 left-1/2 w-4 -ml-2 bg-gradient-to-r from-transparent to-black/10 z-10"></div>
                                 <div className="absolute inset-y-0 right-1/2 w-4 -mr-2 bg-gradient-to-l from-transparent to-black/10 z-10"></div>
                                 {page.isCover ? (
                                    <>
                                        <PageLayout photos={[]} isCover={true} side="back" />
                                        <PageLayout photos={[]} isCover={true} side="front" />
                                    </>
                                ) : (
                                    <>
                                        <PageLayout photos={page.photos.slice(0, page.photos.length / 2)} />
                                        <PageLayout photos={page.photos.slice(page.photos.length / 2)} />
                                    </>
                                )}
                            </div>
                        ) : (
                            <PageLayout photos={page.photos} />
                        )}
                        </CardContent>
                    </Card>
              </AspectRatio>
              <div className="text-center text-sm text-muted-foreground pt-2">Page {index === 0 ? 'Cover' : index}</div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="-left-4" />
        <CarouselNext className="-right-4" />
      </Carousel>
      <div className="mt-4 rounded-lg bg-card p-4 flex items-center text-sm text-muted-foreground border">
          <Info className="h-5 w-5 mr-3 shrink-0" />
          This is a digital preview. Colors and cropping may vary slightly in the final printed product. The book spine and page gutter are simulated.
      </div>
    </div>
  );
}
