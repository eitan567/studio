'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Cloud,
  Loader2,
  Sparkles,
  UploadCloud,
  Wand2,
  PlusSquare,
  AlertTriangle,
  Image as ImageIcon,
} from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { v4 as uuidv4 } from 'uuid';

import type { Photo, AlbumConfig, AlbumPage, PhotoPanAndZoom } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlbumPreview } from './album-preview';
import { useToast } from '@/hooks/use-toast';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LAYOUT_TEMPLATES } from './layout-templates';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import Image from 'next/image';

// Fix for alert import
import { Alert as AlertUI, AlertDescription as AlertDescriptionUI, AlertTitle as AlertTitleUI } from '@/components/ui/alert';

interface AlbumEditorProps {
  albumId: string;
}

const configSchema = z.object({
  size: z.enum(['20x20', '25x25', '30x30']),
});

type ConfigFormData = z.infer<typeof configSchema>;

export function AlbumEditor({ albumId }: AlbumEditorProps) {
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [albumPages, setAlbumPages] = useState<AlbumPage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const [randomSeed, setRandomSeed] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [randomSuggestion, setRandomSuggestion] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [allowDuplicates, setAllowDuplicates] = useState(true);

  useEffect(() => {
    setIsClient(true);
    setRandomSeed(Math.random().toString(36).substring(7));
    const suggestions = [
      "For a more dynamic feel, try a 6-photo spread for pages with action shots.",
      "The portrait on page 3 would 'pop' more with increased contrast.",
      "Consider a black and white filter for the photos on pages 8-9 for a timeless look.",
    ];
    setRandomSuggestion(suggestions[Math.floor(Math.random() * suggestions.length)]);
  }, []);

  const form = useForm<ConfigFormData>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      size: '20x20',
    },
  });

  const config: AlbumConfig = {
    size: form.watch('size') as '20x20',
  };

  const generateInitialPages = (photos: Photo[]) => {
    let photosPool = [...photos];
    const newPages: AlbumPage[] = [];
    const defaultPanAndZoom = { scale: 1, x: 50, y: 50 };

    newPages.push({ id: 'cover', type: 'spread', photos: [], layout: 'cover', isCover: true });

    if (photosPool.length > 0) {
      newPages.push({ id: uuidv4(), type: 'single', photos: photosPool.splice(0, 1).map(p => ({ ...p, panAndZoom: defaultPanAndZoom })), layout: '1-full' });
    }

    const photosPerSpread = 2;
    while (photosPool.length >= photosPerSpread) {
      newPages.push({ id: uuidv4(), type: 'spread', photos: photosPool.splice(0, photosPerSpread).map(p => ({ ...p, panAndZoom: defaultPanAndZoom })), layout: '2-horiz' });
    }

    if (photosPool.length > 0) {
      newPages.push({ id: uuidv4(), type: 'single', photos: photosPool.splice(0, 1).map(p => ({ ...p, panAndZoom: defaultPanAndZoom })), layout: '1-full' });
    }

    setAlbumPages(newPages);
  };

  const photoUsageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    albumPages.forEach(page => {
      page.photos.forEach(photo => {
        counts[photo.id] = (counts[photo.id] || 0) + 1;
      });
    });
    return counts;
  }, [albumPages]);

  const usedPhotoIds = useMemo(() => {
    return new Set(Object.keys(photoUsageCounts));
  }, [photoUsageCounts]);


  const deletePage = (pageId: string) => {
    setAlbumPages(prev => prev.filter(p => p.id !== pageId));
    toast({
      title: "Page Deleted",
      variant: "destructive"
    })
  }

  const updatePageLayout = (pageId: string, newLayoutId: string) => {
    setAlbumPages(prevPages => {
      const pageIndex = prevPages.findIndex(p => p.id === pageId);
      if (pageIndex === -1) return prevPages;

      const pageToUpdate = { ...prevPages[pageIndex] };
      const newTemplate = LAYOUT_TEMPLATES.find(t => t.id === newLayoutId);
      if (!newTemplate) return prevPages;

      const newPhotoCount = newTemplate.photoCount;

      const subsequentPages = prevPages.slice(pageIndex);
      const subsequentPhotos = subsequentPages.flatMap(p => p.photos);
      const subsequentLayouts = prevPages.slice(pageIndex + 1).map(p => ({
        type: p.type,
        layout: p.layout
      }));

      if (newPhotoCount > subsequentPhotos.length) {
        toast({
          title: 'Not Enough Photos',
          description: `You don't have enough photos in the rest of the album to create this layout.`,
          variant: 'destructive',
        });
        return prevPages;
      }

      const defaultPanAndZoom = { scale: 1, x: 50, y: 50 };
      const newPages = [...prevPages.slice(0, pageIndex)];

      const updatedPagePhotos = subsequentPhotos.splice(0, newPhotoCount).map(p => ({
        ...p,
        panAndZoom: p.panAndZoom || defaultPanAndZoom,
      }));

      newPages.push({ ...pageToUpdate, photos: updatedPagePhotos, layout: newLayoutId });

      let remainingPhotosPool = [...subsequentPhotos];
      let layoutIndex = 0;

      while (remainingPhotosPool.length > 0) {
        let photosForNextPage: Photo[] = [];
        let nextPageType: 'single' | 'spread' = 'spread';
        let nextPageLayout = '2-horiz';

        if (layoutIndex < subsequentLayouts.length) {
          const originalLayout = subsequentLayouts[layoutIndex];
          const originalTemplate = LAYOUT_TEMPLATES.find(t => t.id === originalLayout.layout);
          const originalPhotoCount = originalTemplate ? originalTemplate.photoCount : 1;

          if (remainingPhotosPool.length >= originalPhotoCount) {
            photosForNextPage = remainingPhotosPool.splice(0, originalPhotoCount);
            nextPageType = originalLayout.type;
            nextPageLayout = originalLayout.layout;
          } else {
            photosForNextPage = remainingPhotosPool.splice(0);
            nextPageType = originalLayout.type;
            const bestFitTemplate = LAYOUT_TEMPLATES.find(t => t.photoCount === photosForNextPage.length) || LAYOUT_TEMPLATES.find(t => t.photoCount === 1)!;
            nextPageLayout = bestFitTemplate.id;
          }
          layoutIndex++;
        } else {
          const lastPage = newPages[newPages.length - 1];
          if (lastPage.type === 'single' && remainingPhotosPool.length >= 2) {
            photosForNextPage = remainingPhotosPool.splice(0, 2);
            nextPageType = 'spread';
            nextPageLayout = '2-horiz';
          } else if (remainingPhotosPool.length === 1) {
            photosForNextPage = remainingPhotosPool.splice(0, 1);
            nextPageType = 'single';
            nextPageLayout = '1-full';
          } else {
            const count = Math.min(remainingPhotosPool.length, 2);
            photosForNextPage = remainingPhotosPool.splice(0, count);
            const bestFitTemplate = LAYOUT_TEMPLATES.find(t => t.photoCount === count) || LAYOUT_TEMPLATES.find(t => t.photoCount === 1)!;
            nextPageType = count > 1 ? 'spread' : 'single';
            nextPageLayout = bestFitTemplate.id;
          }
        }

        if (photosForNextPage.length > 0) {
          newPages.push({
            id: uuidv4(),
            type: nextPageType,
            photos: photosForNextPage.map(p => ({ ...p, panAndZoom: defaultPanAndZoom })),
            layout: nextPageLayout,
          });
        }
      }

      return newPages;
    });
  };

  const updatePhotoPanAndZoom = (pageId: string, photoId: string, panAndZoom: PhotoPanAndZoom) => {
    setAlbumPages(pages => pages.map(page => {
      if (page.id !== pageId) return page;
      return {
        ...page,
        photos: page.photos.map(photo => {
          if (photo.id !== photoId) return photo;
          return { ...photo, panAndZoom };
        })
      };
    }));
  };

  const handleDropPhoto = (pageId: string, targetPhotoId: string, droppedPhotoId: string) => {
    const droppedPhoto = allPhotos.find(p => p.id === droppedPhotoId);
    if (!droppedPhoto) return;

    if (!allowDuplicates && usedPhotoIds.has(droppedPhotoId)) {
      toast({
        title: "Photo already in album",
        description: "Duplicate photos are not allowed with current settings.",
        variant: "destructive"
      });
      return;
    }

    setAlbumPages(prevPages => prevPages.map(page => {
      if (page.id !== pageId) return page;
      return {
        ...page,
        photos: page.photos.map(p => {
          if (p.id === targetPhotoId) {
            return {
              ...droppedPhoto,
              panAndZoom: { scale: 1, x: 50, y: 50 }
            };
          }
          return p;
        })
      };
    }));
  };

  const generateDummyPhotos = () => {
    if (!randomSeed) {
      toast({
        title: 'Please wait',
        description: 'Component is initializing.',
        variant: 'destructive'
      });
      return;
    }
    setIsLoading(true);
    toast({
      title: 'Generating Dummy Photos',
      description: 'Please wait while we create 100 sample images with various aspect ratios.',
    });
    setTimeout(() => {
      const dimensions = [
        { w: 1200, h: 800 },
        { w: 800, h: 1200 },
        { w: 1000, h: 1000 },
        { w: 1600, h: 900 },
        { w: 900, h: 1600 }
      ];

      const dummyPhotos: Photo[] = Array.from({ length: 100 }, (_, i) => {
        const seed = `${randomSeed}-${i}`;
        const dim = dimensions[i % dimensions.length];
        return {
          id: `dummy-${seed}-${i}`,
          src: `https://picsum.photos/seed/${seed}/${dim.w}/${dim.h}`,
          alt: `Dummy photo ${i + 1}`,
          width: dim.w,
          height: dim.h,
        };
      });
      setAllPhotos(dummyPhotos);
      generateInitialPages(dummyPhotos); // Use all photos
      setIsLoading(false);
      toast({
        title: 'Photos & Album Generated',
        description: '100 dummy photos and a full album layout have been created.',
      });
    }, 1500);
  };

  const handleAiEnhance = async () => {
    setIsGenerating(true);
    setAiSuggestion(null);
    toast({
      title: 'AI Assistant',
      description: 'Analyzing your album and generating suggestions...'
    });
    await new Promise((res) => setTimeout(res, 2000));
    setAiSuggestion(randomSuggestion);
    setIsGenerating(false);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      {/* Left Sidebar: Config & Tools */}
      <div className="xl:col-span-2 space-y-6">
        {isClient && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-headline text-lg">Album Config</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form className="space-y-4">
                    <FormField
                      control={form.control}
                      name="size"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Size (cm)</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select size" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="20x20">20 x 20</SelectItem>
                              <SelectItem value="25x25">25 x 25</SelectItem>
                              <SelectItem value="30x30">30 x 30</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-headline text-lg flex items-center gap-2">
                  <Wand2 className="h-5 w-5" /> Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={generateDummyPhotos}
                  disabled={isLoading || !randomSeed}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <PlusSquare className="mr-2 h-4 w-4" />
                  )}
                  Load Photos
                </Button>

                <Button
                  variant="outline"
                  className="w-full border-accent text-accent hover:bg-accent hover:text-accent-foreground"
                  onClick={handleAiEnhance}
                  disabled={isGenerating || allPhotos.length === 0}
                >
                  {isGenerating ? (<Loader2 className="h-4 w-4 animate-spin" />) : (<Sparkles className="mr-2 h-4 w-4" />)}
                  AI Suggest
                </Button>

                {aiSuggestion && (
                  <AlertUI className="mt-2">
                    <Sparkles className="h-4 w-4" />
                    <AlertTitleUI className="text-xs">AI Suggestion</AlertTitleUI>
                    <AlertDescriptionUI className="text-xs">{aiSuggestion}</AlertDescriptionUI>
                  </AlertUI>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Main Content: Album Preview */}
      <div className="xl:col-span-7">
        <AlbumPreview
          pages={albumPages}
          config={config}
          onDeletePage={deletePage}
          onUpdateLayout={updatePageLayout}
          onUpdatePhotoPanAndZoom={updatePhotoPanAndZoom}
          onDropPhoto={handleDropPhoto}
        />
      </div>

      {/* Right Sidebar: Photo Gallery */}
      <div className="xl:col-span-3 space-y-4">
        <Card className="h-[85vh] flex flex-col">
          <CardHeader className="pb-3 border-bottom">
            <div className="flex items-center justify-between">
              <CardTitle className="font-headline text-lg">Photo Gallery</CardTitle>
              <div className="flex items-center gap-2">
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
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            {allPhotos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center">
                <ImageIcon className="h-10 w-10 mb-2 opacity-20" />
                <p className="text-sm">No photos loaded yet. Use "Load Photos" to start.</p>
              </div>
            ) : (
              <ScrollArea className="h-full px-4 py-2">
                <div className="columns-2 gap-2 pb-4">
                  {allPhotos.map((photo) => (
                    <div
                      key={photo.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('photoId', photo.id);
                      }}
                      className="relative break-inside-avoid mb-2 rounded-md overflow-hidden bg-muted cursor-grab active:cursor-grabbing border-2 border-transparent hover:border-primary transition-all group"
                    >
                      <img
                        src={photo.src}
                        alt={photo.alt}
                        className="w-full h-auto display-block"
                      />
                      {/* Resolution display - top right corner */}
                      <div className="absolute top-1 right-1 bg-black/60 text-white text-[9px] font-medium px-1 py-0.5 rounded z-10">
                        {photo.width}×{photo.height}
                      </div>
                      {photoUsageCounts[photo.id] > 1 && (
                        <div className="absolute top-1 left-1 bg-white/90 rounded-full p-0.5 shadow-sm text-orange-500 z-10">
                          <AlertTriangle className="h-4 w-4 fill-orange-500 text-white" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <span className="text-[10px] text-white font-bold bg-black/50 px-1.5 py-0.5 rounded">DRAG ME</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
          <div className="p-3 border-t bg-muted/30 text-center">
            <p className="text-xs text-muted-foreground">
              {allPhotos.length} photos total • {usedPhotoIds.size} used
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
