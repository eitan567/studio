'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Cloud,
  Loader2,
  Sparkles,
  UploadCloud,
  Wand2,
} from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import type { Photo, AlbumConfig, AlbumPage } from '@/lib/types';
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
  photosPerSpread: z.enum(['2', '4', '6']),
  size: z.enum(['20x20', '25x25', '30x30']),
});

type ConfigFormData = z.infer<typeof configSchema>;

export function AlbumEditor({ albumId }: AlbumEditorProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const form = useForm<ConfigFormData>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      photosPerSpread: '4',
      size: '20x20',
    },
  });

  const config: AlbumConfig = {
    photosPerSpread: parseInt(form.watch('photosPerSpread')) as 4, // Type assertion
    size: form.watch('size') as '20x20',
  };

  const generateDummyPhotos = () => {
    setIsLoading(true);
    toast({
      title: 'Generating Dummy Photos',
      description: 'Please wait while we create 100 sample images.',
    });
    // Simulate network delay
    setTimeout(() => {
      const dummyPhotos: Photo[] = Array.from({ length: 100 }, (_, i) => {
        const seed = i + 1;
        return {
          id: `dummy-${seed}-${i}`,
          src: `https://picsum.photos/seed/${seed}/800/800`,
          alt: `Dummy photo ${i + 1}`,
        };
      });
      setPhotos(dummyPhotos);
      setIsLoading(false);
      toast({
        title: 'Photos Generated',
        description: '100 dummy photos have been added to your album.',
      });
    }, 1500);
  };

  const albumPages = useMemo((): AlbumPage[] => {
    if (photos.length === 0) return [];

    const pages: AlbumPage[] = [];
    const photosCopy = [...photos];

    // First page (single)
    const firstPagePhotoCount = Math.ceil(config.photosPerSpread / 2);
    pages.push({
      type: 'single',
      photos: photosCopy.splice(0, firstPagePhotoCount),
    });

    // Middle pages (spreads)
    while (photosCopy.length > config.photosPerSpread) {
      pages.push({
        type: 'spread',
        photos: photosCopy.splice(0, config.photosPerSpread),
      });
    }

    // Last page (single)
    if (photosCopy.length > 0) {
      pages.push({ type: 'single', photos: photosCopy });
    }

    return pages;
  }, [photos, config]);

  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [randomSuggestion, setRandomSuggestion] = useState('');

  useEffect(() => {
    const suggestions = [
      "For a more dynamic feel, try a 6-photo spread for pages with action shots.",
      "The portrait on page 3 would 'pop' more with increased contrast.",
      "Consider a black and white filter for the photos on pages 8-9 for a timeless look.",
    ];
    setRandomSuggestion(suggestions[Math.floor(Math.random() * suggestions.length)]);
  }, []);

  const handleAiEnhance = async () => {
    setIsGenerating(true);
    setAiSuggestion(null);
    // Mock AI analysis
    await new Promise((res) => setTimeout(res, 2000));
    setAiSuggestion(randomSuggestion);
    setIsGenerating(false);
  };


  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
              <UploadCloud className="h-6 w-6" /> Photo Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full" onClick={() => { /* Mock upload */ toast({title: 'Feature coming soon!'})}}>
              <Cloud className="mr-2 h-4 w-4" /> Upload from Computer
            </Button>
            <Button
              className="w-full"
              variant="secondary"
              onClick={generateDummyPhotos}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              Generate 100 Dummy Photos
            </Button>
             <p className="text-sm text-muted-foreground text-center pt-2">
                {photos.length} photos loaded.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Album Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="space-y-6">
                <FormField
                  control={form.control}
                  name="photosPerSpread"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Photos per Spread</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select layout" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="2">2 Photos</SelectItem>
                          <SelectItem value="4">4 Photos</SelectItem>
                          <SelectItem value="6">6 Photos</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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

        <Card>
            <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2">
                    <Sparkles className="h-6 w-6 text-accent" /> AI Album Assistant
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                 <p className="text-sm text-muted-foreground">Let our AI analyze your album and provide suggestions for improvements and layouts.</p>
                <Button variant="outline" className="w-full border-accent text-accent hover:bg-accent hover:text-accent-foreground" onClick={handleAiEnhance} disabled={isGenerating || photos.length === 0}>
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

      </div>
      <div className="lg:col-span-2">
        <AlbumPreview pages={albumPages} config={config} />
      </div>
    </div>
  );
}
