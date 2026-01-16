'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Loader2,
  Trash2,
  Upload,
  Eraser,
  RotateCcw,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import placeholderImagesData from '@/lib/placeholder-images.json';

const placeholderImages = placeholderImagesData.placeholderImages;
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { v4 as uuidv4 } from 'uuid';

import type { Photo, AlbumConfig, AlbumPage, PhotoPanAndZoom } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlbumPreview } from './album-preview';
import { AlbumPreviewProvider } from './album-preview-context';
import { BookViewOverlay } from './book-view-overlay';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LAYOUT_TEMPLATES, COVER_TEMPLATES } from './layout-templates';
import { ADVANCED_TEMPLATES, AdvancedTemplate } from '@/lib/advanced-layout-types';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, TooltipArrow } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import Image from 'next/image';

// Fix for alert import
import { Alert as AlertUI, AlertDescription as AlertDescriptionUI, AlertTitle as AlertTitleUI } from '@/components/ui/alert';
import { AiBackgroundGenerator } from './ai-background-generator';
import { AlbumExporter, AlbumExporterRef } from './album-exporter';
import { CustomLayoutEditorOverlay } from './custom-layout-editor/custom-layout-editor-overlay';
import { useAlbum } from '@/hooks/useAlbum';
import { usePhotoUpload } from '@/hooks/usePhotoUpload';
import { useAlbumGeneration } from '@/hooks/use-album-generation';
import { useAlbumPageEditor } from '@/hooks/useAlbumPageEditor';
import { usePhotoGalleryManager } from '@/hooks/usePhotoGalleryManager';
import { ModeToggle } from '@/components/mode-toggle';
import { ScrollToTopButton, AlbumConfigCard, PhotoGalleryCard, AlbumEditorToolbar } from './editor-components';

// Parse layout ID helper removed (now in useAlbumPageEditor or used via import if needed)

interface AlbumEditorProps {
  albumId: string;
}

const configSchema = z.object({
  size: z.enum(['20x20', '25x25', '30x30']),
});

type ConfigFormData = z.infer<typeof configSchema>;

export function AlbumEditor({ albumId }: AlbumEditorProps) {
  // Album persistence hook
  const {
    album,
    isLoading: isAlbumLoading,
    isSaving,
    error: albumError,
    hasUnsavedChanges,
    lastSaved,
    createAlbum,
    updatePages,
    updateConfig,
    updateName,
    isNew,
    config: savedConfig,
    pages: savedPages,
    name: albumName,

    updateThumbnail,
    thumbnail_url: albumThumbnailUrl,
    photos: savedPhotos,
    updatePhotos: savePhotos,
    saveNow,
  } = useAlbum(albumId);

  const router = useRouter();
  const { signOut } = useAuth();

  // Use hook's photos instead of local state
  const allPhotos = savedPhotos;
  const setAllPhotos = savePhotos;

  const [albumPages, setAlbumPages] = useState<AlbumPage[]>([]);

  // Calculate photo usage details across all pages
  const photoUsageDetails = useMemo(() => {
    const details: Record<string, { count: number; pages: number[] }> = {};
    albumPages.forEach((page, pageIndex) => {
      page.photos.forEach(photo => {
        // Use originalId if it exists, otherwise try to find the gallery photo by matching SRC
        let galleryId = photo.originalId;

        if (!galleryId && photo.src) {
          const match = allPhotos.find(p => p.src === photo.src);
          if (match) galleryId = match.id;
        }

        // Fallback to photo.id if still not found
        galleryId = galleryId || photo.id;

        // Skip placeholders (no actual photo content)
        if (!photo.src || photo.src === '') return;

        if (!details[galleryId]) {
          details[galleryId] = { count: 0, pages: [] };
        }
        details[galleryId].count++;
        // Keep track of which pages the photo appears on
        if (!details[galleryId].pages.includes(pageIndex)) {
          details[galleryId].pages.push(pageIndex);
        }
      });
    });
    return details;
  }, [albumPages, allPhotos]);

  // Derived from photoUsageDetails for easier boolean checks
  const usedPhotoIds = useMemo(() => {
    return new Set(Object.keys(photoUsageDetails));
  }, [photoUsageDetails]);
  const [isLoading, setIsLoading] = useState(false);

  const [isBookViewOpen, setIsBookViewOpen] = useState(false);
  const [isCustomLayoutEditorOpen, setIsCustomLayoutEditorOpen] = useState(false);
  const [isCoverEditorOpen, setIsCoverEditorOpen] = useState(false);

  const [customTemplates, setCustomTemplates] = useState<AdvancedTemplate[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load custom templates from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('custom_album_templates');
    if (saved) {
      try {
        setCustomTemplates(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load custom templates', e);
      }
    }
  }, []);

  const handleAddCustomTemplate = (template: AdvancedTemplate) => {
    setCustomTemplates(prev => {
      const next = [...prev, template];
      localStorage.setItem('custom_album_templates', JSON.stringify(next));
      return next;
    });
  };
  const { toast } = useToast();
  const [randomSeed, setRandomSeed] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [allowDuplicates, setAllowDuplicates] = useState(true);
  const [photoGap, setPhotoGap] = useState(10);
  const [pageMargin, setPageMargin] = useState(10);
  const [cornerRadius, setCornerRadius] = useState(0);
  // Preview values - Handled by AlbumPreviewContext
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [backgroundImage, setBackgroundImage] = useState<string | undefined>(undefined);
  const [availableBackgrounds, setAvailableBackgrounds] = useState<string[]>([
    'https://picsum.photos/seed/bg1/800/600',
    'https://picsum.photos/seed/bg2/800/600',
    'https://picsum.photos/seed/bg3/800/600',
  ]);
  const backgroundUploadRef = useRef<HTMLInputElement>(null);
  const colorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Photo Gallery Manager Hook
  const {
    isLoadingPhotos,
    setIsLoadingPhotos,
    processUploadedFiles,
    handleSortPhotos,
    handleClearGallery,
    handleDeletePhotos,
    photoScrollRef,
    folderUploadRef,
    photoUploadRef
  } = usePhotoGalleryManager({
    allPhotos,
    setAllPhotos,
    updateThumbnail: (url) => {
      updatePages(albumPages.map(page =>
        page.isCover && page.coverLayouts?.front === '1-full' && (!page.photos[0] || !page.photos[0].src)
          ? { ...page, photos: [{ ...page.photos[0], src: url }] }
          : page
      ));
      // The `updateThumbnail` from `useAlbum` updates the album's thumbnail_url in the DB.
      // This is distinct from setting a photo on the cover page.
      // We should call the `updateThumbnail` from `useAlbum` here as well if the first uploaded photo
      // is meant to be the album's overall thumbnail.
      updateThumbnail(url);
    },
    albumThumbnailUrl: albumThumbnailUrl, // Pass the current album thumbnail URL
  });

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const exporterRef = useRef<AlbumExporterRef>(null);

  const handleExport = () => {
    exporterRef.current?.exportAlbum();
  };

  const handleColorChange = (color: string) => {
    // Clear previous timeout
    if (colorDebounceRef.current) {
      clearTimeout(colorDebounceRef.current);
    }

    // Debounce update by 100ms
    colorDebounceRef.current = setTimeout(() => {
      setBackgroundColor(color);
    }, 100);
  };

  const {
    generateEmptyAlbum,
    extractExifDate,
    generateInitialPages,
    generateDummyPhotos
  } = useAlbumGeneration({
    setAlbumPages,
    setAllPhotos,
    setIsLoadingPhotos,
    randomSeed
  });

  // Load album from server or create empty album

  useEffect(() => {
    setIsClient(true);
    setRandomSeed(Math.random().toString(36).substring(7));
  }, []);



  // Load album from server or create empty album
  useEffect(() => {
    if (isAlbumLoading || isInitialized) return;

    if (album) {
      if (savedPages.length > 0) {
        // Load existing pages from server
        setAlbumPages(savedPages);
        setPhotoGap(savedConfig.photoGap ?? 10);
        setPageMargin(savedConfig.pageMargin ?? 10);
        setCornerRadius(savedConfig.cornerRadius || 0);
        setBackgroundColor(savedConfig.backgroundColor || '#ffffff');
        setBackgroundImage(savedConfig.backgroundImage);
        form.setValue('size', savedConfig.size);
      } else {
        // Existing album but empty -> Initialize with default structure
        generateEmptyAlbum();
      }
      setIsInitialized(true);
    } else if (isNew || (!album && !isAlbumLoading)) {
      // Initialize with empty album for new albums
      generateEmptyAlbum();
      setIsInitialized(true);
    }
  }, [album, savedPages, savedConfig, isAlbumLoading, isNew, isInitialized]);

  const handleSaveTitle = (newTitle: string) => {
    updateName(newTitle);
  };


  const form = useForm<ConfigFormData>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      size: '20x20',
    },
  });

  const watchedSize = form.watch('size');

  // Auto-save pages when they change
  useEffect(() => {
    if (!isInitialized || isAlbumLoading) return;
    if (albumPages.length === 0) return;

    // If this is a new album, create it first
    if (isNew) {
      createAlbum(albumName, config, albumPages);
      return;
    }

    // Otherwise, update pages
    if (album) {
      updatePages(albumPages);
    }
  }, [albumPages, isInitialized]);

  // Auto-set thumbnail if missing and we have photos
  useEffect(() => {
    if (!isAlbumLoading && !albumThumbnailUrl && allPhotos && allPhotos.length > 0) {
      // Find first photo with actual src (not empty placeholder)
      const firstValidPhoto = allPhotos.find(p => p.src && p.src.length > 0);
      if (firstValidPhoto) {
        updateThumbnail(firstValidPhoto.src);
      }
    }
  }, [isAlbumLoading, albumThumbnailUrl, allPhotos, updateThumbnail]);

  // Auto-save config when it changes
  useEffect(() => {
    if (!isInitialized || isAlbumLoading || isNew || !album) return;
    updateConfig(config);
  }, [photoGap, pageMargin, cornerRadius, backgroundColor, backgroundImage, watchedSize]);


  const config: AlbumConfig = {
    size: form.watch('size') as '20x20',
    photoGap,
    pageMargin,
    backgroundColor,
    backgroundImage,
    cornerRadius,
  };





  // Page Manipulation Hook
  const {
    deletePage,
    addSpreadPage,
    updatePageLayout,
    handleRemovePhoto,
    handleUpdateCoverLayout,
    handleUpdateSpreadLayout,
    handleUpdateCoverType,
    handleUpdateSpineText,
    handleUpdateSpineSettings,
    handleUpdateTitleSettings,
    handleUpdatePage,
    updatePhotoPanAndZoom,
    handleDropPhoto
  } = useAlbumPageEditor({
    setAlbumPages,
    allPhotos,
    allowDuplicates,
    usedPhotoIds
  });


  // Process uploaded photo files (from folder or individual selection)
  // Generate album from existing photos (sorted by capture date)
  const handleGenerateAlbum = () => {
    if (allPhotos.length === 0) {
      toast({
        title: 'No photos',
        description: 'Please upload photos first.',
        variant: 'destructive'
      });
      return;
    }

    // Sort photos by capture date (oldest first), photos without date go to end
    const sortedPhotos = [...allPhotos].sort((a, b) => {
      const dateA = a.captureDate ? new Date(a.captureDate).getTime() : 0;
      const dateB = b.captureDate ? new Date(b.captureDate).getTime() : 0;

      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      return dateA - dateB;
    });

    generateInitialPages(sortedPhotos);
    toast({
      title: 'Album Generated',
      description: `Album created with ${sortedPhotos.length} photos sorted by date.`,
    });
  };
  const handleResetAlbum = () => {
    generateEmptyAlbum();
    toast({
      title: 'Album Reset',
      description: 'Album has been reset to empty state.',
    });
  };

  const handleDownloadPage = async (pageId: string) => {
    toast({ title: "Downloading page..." });
    await exporterRef.current?.exportPage(pageId);
  };



  return (
    <AlbumPreviewProvider>
      <div className="flex flex-col h-screen bg-background text-foreground">
        {/* Global Top Toolbar */}
        <AlbumEditorToolbar
          albumName={albumName}
          onUpdateName={handleSaveTitle}
          saveStatus={isSaving ? 'saving' : hasUnsavedChanges ? 'unsaved' : 'saved'}
          onBack={async () => {
            // Check if we need to set thumbnail before saving
            if (!albumThumbnailUrl && savedPhotos && savedPhotos.length > 0) {
              const firstValidPhoto = savedPhotos.find(p => p.src && p.src.length > 0);
              if (firstValidPhoto) {
                updateThumbnail(firstValidPhoto.src);
              }
            }
            await saveNow();
            router.push('/dashboard');
          }}
          onOpenBookView={() => setIsBookViewOpen(true)}
          onOpenCustomLayout={() => setIsCustomLayoutEditorOpen(true)}
          onExportImages={handleExport}
          onExportPdf={() => exporterRef.current?.exportToPdf()}
          isExporting={isExporting}
          onShare={() => toast({ title: "Sharing Album..." })}
          onLogout={() => signOut().then(() => router.push('/'))}
        />

        {/* Exporter Component */}
        <AlbumExporter
          ref={exporterRef}
          pages={albumPages}
          config={config}
          onExportStart={() => {
            setIsExporting(true);
            toast({ title: "Starting Export", description: "Preparing your images..." });
          }}
          onExportProgress={(current, total) => {
            // Optional: Update toast or state if we want detailed progress
            // toast({ title: "Exporting", description: `Processing page ${current} of ${total}` });
          }}
          onExportComplete={() => {
            setIsExporting(false);
            toast({ title: "Export Complete", description: "Your download should start shortly." });
          }}
          onExportError={(err) => {
            setIsExporting(false);
            toast({ title: "Export Failed", description: "Something went wrong.", variant: "destructive" });
          }}
        />

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 p-6 flex-1 overflow-hidden">
          {/* Left Sidebar: Config & Tools */}
          <div className="xl:col-span-2 space-y-6">
            {isClient && (
              <AlbumConfigCard
                form={form}
                photoGap={photoGap}
                setPhotoGap={setPhotoGap}
                pageMargin={pageMargin}
                setPageMargin={setPageMargin}
                cornerRadius={cornerRadius}
                setCornerRadius={setCornerRadius}
                backgroundColor={backgroundColor}
                setBackgroundColor={setBackgroundColor}
                handleColorChange={handleColorChange}
                backgroundImage={backgroundImage}
                setBackgroundImage={setBackgroundImage}
                availableBackgrounds={availableBackgrounds}
                setAvailableBackgrounds={setAvailableBackgrounds}
                backgroundUploadRef={backgroundUploadRef}
              />
            )}
          </div>

          {/* Main Content: Album Preview */}
          <div className="xl:col-span-7">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-[85vh] text-muted-foreground p-6 text-center animate-in fade-in duration-300 bg-muted/30 border-2 border-dashed rounded-lg">
                <Loader2 className="h-12 w-12 mb-4 animate-spin text-primary" />
                <h3 className="text-lg font-semibold mb-2">Generating Album Layout...</h3>
                <p className="text-sm">Please wait while we prepare your pages.</p>
              </div>
            ) : (
              <AlbumPreview
                pages={albumPages}
                config={config}
                onDeletePage={deletePage}
                onAddSpread={addSpreadPage}
                onUpdateLayout={updatePageLayout}
                onUpdatePhotoPanAndZoom={updatePhotoPanAndZoom}
                onDropPhoto={handleDropPhoto}
                onDownloadPage={handleDownloadPage}
                onRemovePhoto={handleRemovePhoto}
                onUpdateCoverLayout={handleUpdateCoverLayout}
                onUpdateCoverType={handleUpdateCoverType}
                onUpdateSpineText={handleUpdateSpineText}
                onUpdateSpineSettings={handleUpdateSpineSettings}
                onUpdateTitleSettings={handleUpdateTitleSettings}
                onUpdatePage={handleUpdatePage}
                onUpdateSpreadLayout={handleUpdateSpreadLayout}
                allPhotos={allPhotos}
                customTemplates={customTemplates}
              />
            )}
          </div>

          <PhotoGalleryCard
            allPhotos={allPhotos}
            isLoadingPhotos={isLoadingPhotos}
            photoUsageDetails={photoUsageDetails}
            allowDuplicates={allowDuplicates}
            setAllowDuplicates={setAllowDuplicates}
            randomSeed={randomSeed}
            generateDummyPhotos={generateDummyPhotos}
            handleGenerateAlbum={handleGenerateAlbum}
            handleClearGallery={handleClearGallery}
            handleResetAlbum={handleResetAlbum}
            handleSortPhotos={handleSortPhotos}
            processUploadedFiles={processUploadedFiles}
            onDeletePhotos={handleDeletePhotos}
            photoScrollRef={photoScrollRef}
            folderUploadRef={folderUploadRef}
            photoUploadRef={photoUploadRef}
          />
        </div >
        {isBookViewOpen && (
          <BookViewOverlay
            pages={albumPages}
            config={config}
            onClose={() => setIsBookViewOpen(false)}
          />
        )}
        {isCustomLayoutEditorOpen && (
          <CustomLayoutEditorOverlay
            config={config}
            onClose={() => setIsCustomLayoutEditorOpen(false)}
            customTemplates={customTemplates}
            onAddTemplate={handleAddCustomTemplate}
          />
        )}
      </div>
    </AlbumPreviewProvider>
  );
}
