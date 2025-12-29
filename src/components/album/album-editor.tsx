'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Cloud,
  Loader2,
  Sparkles,
  UploadCloud,
  Wand2,
  PlusSquare,
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

  useEffect(() => {
    // This effect runs only on the client, after the component has mounted.
    setIsClient(true);
    // Generate a random seed on component mount for dummy photos
    setRandomSeed(Math.random().toString(36).substring(7));
    // Pre-set a random AI suggestion for demo purposes
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

    // 1. Cover page
    newPages.push({ id: 'cover', type: 'spread', photos: [], layout: 'cover', isCover: true });
    
    // 2. First single page if there are photos
    if (photosPool.length > 0) {
      newPages.push({ id: uuidv4(), type: 'single', photos: photosPool.splice(0, 1).map(p => ({...p, panAndZoom: { scale: 1, x: 50, y: 50 }})), layout: '1' });
    }

    // 3. Spread pages
    const photosPerSpread = 2; // Default to 2 for spreads
    while (photosPool.length >= photosPerSpread) {
      newPages.push({ id: uuidv4(), type: 'spread', photos: photosPool.splice(0, photosPerSpread).map(p => ({...p, panAndZoom: { scale: 1, x: 50, y: 50 }})), layout: '2' });
    }

    // 4. Last single page if there are leftovers
    if (photosPool.length > 0) {
        newPages.push({ id: uuidv4(), type: 'single', photos: photosPool.splice(0, 1).map(p => ({...p, panAndZoom: { scale: 1, x: 50, y: 50 }})), layout: '1' });
    }
    
    setAlbumPages(newPages);
  };

  const getAvailablePhotos = (usedPhotoIds: Set<string>): Photo[] => {
    return allPhotos.filter(p => !usedPhotoIds.has(p.id));
  }

  const usedPhotoIds = useMemo(() => {
    return new Set(albumPages.flatMap(p => p.photos.map(photo => photo.id)));
  }, [albumPages]);


  const addPage = () => {
    const availablePhotos = getAvailablePhotos(usedPhotoIds);
    if (availablePhotos.length === 0) {
      toast({
        title: "No more photos",
        description: "All available photos are already in the album.",
        variant: "destructive",
      });
      return;
    }
    const photosForNewPage = availablePhotos.slice(0, 2);
    
    const newPage: AlbumPage = {
      id: uuidv4(),
      type: 'spread',
      photos: photosForNewPage.map(p => ({...p, panAndZoom: { scale: 1, x: 50, y: 50 }})),
      layout: '2'
    };
    
    setAlbumPages(prev => [...prev, newPage]);
    toast({
      title: "Page Added",
      description: `A new spread page with ${photosForNewPage.length} photos has been added.`,
    })
  };

  const deletePage = (pageId: string) => {
    setAlbumPages(prev => prev.filter(p => p.id !== pageId));
    toast({
      title: "Page Deleted",
      variant: "destructive"
    })
  }

  const updatePageLayout = (pageId: string, newLayout: string) => {
    setAlbumPages(prev => prev.map(page => {
      if (page.id !== pageId) return page;

      const newPhotoCount = parseInt(newLayout, 10);
      
      // For cover page, don't change layout
      if(page.isCover) return page;
      if(page.type === 'single') return page; // For now, don't allow changing layout of single pages

      const currentPhotos = page.photos;
      let newPhotos = [...currentPhotos];

      if (newPhotoCount > currentPhotos.length) {
        const currentlyUsedIds = new Set(prev.flatMap(p => p.photos.map(photo => photo.id)));
        const availablePhotos = allPhotos.filter(p => !currentlyUsedIds.has(p.id));
        
        const photosToAddCount = newPhotoCount - currentPhotos.length;
        
        if (photosToAddCount > availablePhotos.length) {
            toast({
                title: "Not enough photos",
                description: `You need ${photosToAddCount} more photos to create a ${newPhotoCount}-photo layout. Upload more or reduce photo count on other pages.`,
                variant: 'destructive'
            });
            return page; // Return original page if not enough photos
        }
        const photosToAdd = availablePhotos.slice(0, photosToAddCount);
        newPhotos.push(...photosToAdd.map(p => ({...p, panAndZoom: { scale: 1, x: 50, y: 50 }})));
      } else if (newPhotoCount < currentPhotos.length) {
        newPhotos = newPhotos.slice(0, newPhotoCount);
      }

      return { ...page, layout: newLayout, photos: newPhotos };
    }));
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
      description: 'Please wait while we create 100 sample images.',
    });
    setTimeout(() => {
      const dummyPhotos: Photo[] = Array.from({ length: 100 }, (_, i) => {
        const seed = `${randomSeed}-${i}`;
        return {
          id: `dummy-${seed}-${i}`,
          src: `https://picsum.photos/seed/${seed}/800/800`,
          alt: `Dummy photo ${i + 1}`,
        };
      });
      setAllPhotos(dummyPhotos);
      generateInitialPages(dummyPhotos);
      setIsLoading(false);
      toast({
        title: 'Photos & Album Generated',
        description: '100 dummy photos and an initial album layout have been created.',
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Album Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="space-y-6">
                 <FormField
                  control={form.control}
                  name="size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Album Size (cm)</FormLabel>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </CardContent>
        </Card>
        
        {isClient && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2">
                  <UploadCloud className="h-6 w-6" /> Photo Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button className="w-full" onClick={() => { toast({title: 'Feature coming soon!'})}}>
                  <Cloud className="mr-2 h-4 w-4" /> Upload from Computer
                </Button>
                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={generateDummyPhotos}
                  disabled={isLoading || !randomSeed}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="mr-2 h-4 w-4" />
                  )}
                  Generate 100 Dummy Photos
                </Button>
                <p className="text-sm text-muted-foreground text-center pt-2">
                    {allPhotos.length > 0 ? `${allPhotos.length - usedPhotoIds.size} photos available.` : 'Start by generating photos.'}
                </p>
              </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="font-headline flex items-center gap-2">
                        <Sparkles className="h-6 w-6 text-accent" /> AI Album Assistant
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">Let our AI analyze your album and provide suggestions for improvements and layouts.</p>
                    <Button variant="outline" className="w-full border-accent text-accent hover:bg-accent hover:text-accent-foreground" onClick={handleAiEnhance} disabled={isGenerating || allPhotos.length === 0}>
                        {isGenerating ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</>) : (<>Enhance with AI</>)}
                    </Button>

                    {aiSuggestion && (
                        <Alert>
                            <Sparkles className="h-4 w-4" />
                            <AlertTitle>AI Suggestion</AlertTitle>
                            <AlertDescription>{aiSuggestion}</AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>
          </>
        )}
      </div>
      <div className="lg:col-span-2">
        <AlbumPreview 
          pages={albumPages} 
          config={config} 
          onDeletePage={deletePage}
          onUpdateLayout={updatePageLayout}
          onUpdatePhotoPanAndZoom={updatePhotoPanAndZoom}
        />
      </div>
    </div>
  );
}
