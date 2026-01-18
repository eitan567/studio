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
import { LAYOUT_TEMPLATES, COVER_TEMPLATES, ADVANCED_TEMPLATES } from '@/hooks/useTemplates';
import { AdvancedTemplate } from '@/lib/advanced-layout-types';
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

  // LOCAL photo state - decoupled from DB persistence
  // This allows transient states (isUploading) without triggering DB saves
  const [localPhotos, setLocalPhotos] = useState<Photo[]>([]);

  // Track initialization to prevent re-hydrating deleted photos
  const photosInitialized = useRef(false);

  // Initialize local photos from saved photos on load (ONCE)
  useEffect(() => {
    if (!photosInitialized.current && savedPhotos && savedPhotos.length > 0) {
      setLocalPhotos(savedPhotos);
      photosInitialized.current = true;
    } else if (!photosInitialized.current && savedPhotos && savedPhotos.length === 0 && !isAlbumLoading) {
      // If loading finished and no photos, mark initialized so we don't overwrite later
      photosInitialized.current = true;
    }
  }, [savedPhotos, isAlbumLoading]);

  // Expose local photos for UI
  const allPhotos = localPhotos;

  // Track loading state via ref to access inside callbacks without dependencies
  const isLoadingPhotosRef = useRef(false);

  // Wrapper: updates local state immediately, syncs to DB only for completed photos
  const setAllPhotos = useCallback((updater: React.SetStateAction<Photo[]>) => {
    setLocalPhotos(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;

      // Filter out photos that are still uploading or have errors before persisting
      const photosToSave = next.filter(p => !p.isUploading && !p.error);

      // Persist if there are completed photos OR if we're explicitly clearing (empty array)
      // BUT SKIP if strictly uploading (to avoid DB churning/sorting)
      if ((photosToSave.length > 0 || next.length === 0) && !isLoadingPhotosRef.current) {
        // Debounce slightly standard saves, but block completely if uploading
        setTimeout(() => {
          if (!isLoadingPhotosRef.current) {
            savePhotos(photosToSave);
          }
        }, 500);
      }

      return next;
    });
  }, [savePhotos]);

  // State for pages - Defined early for use in updateThumbnail callback
  const [albumPages, setAlbumPages] = useState<AlbumPage[]>([]);

  const { toast } = useToast();
  // Photo Gallery Manager Hook - Moved UP to allow access to isLoadingPhotos
  // We need to define it here because we need `isLoadingPhotos` for the effects below
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
      updateThumbnail(url);
    },
    albumThumbnailUrl: albumThumbnailUrl,
  });

  // Sync ref with prop/state
  useEffect(() => {
    isLoadingPhotosRef.current = isLoadingPhotos;
  }, [isLoadingPhotos]);

  // Track previous loading state to detect transition
  const prevLoadingRef = useRef(false);

  // Delayed save after upload completes (Transition Logic)
  useEffect(() => {
    // Only trigger if we effectively transitioned from loading -> not loading
    if (prevLoadingRef.current && !isLoadingPhotos) {
      // Transition detected! Upload finished.
      if (localPhotos.length > 0) {
        const timer = setTimeout(() => {
          // Double check we haven't started loading again
          if (!isLoadingPhotosRef.current) {
            const validPhotos = localPhotos.filter(p => !p.isUploading && !p.error);
            if (validPhotos.length > 0) {
              console.log('[DEBUG] Delayed save triggered after upload');
              savePhotos(validPhotos);
            }
          }
        }, 2000);
        // Update ref immediately to prevent double-firing if dep changes
        prevLoadingRef.current = false;
        return () => clearTimeout(timer);
      }
    }

    // Update ref for next render
    prevLoadingRef.current = isLoadingPhotos;
  }, [isLoadingPhotos, localPhotos, savePhotos]);

  const photoUsageDetails = useMemo(() => {
    const details: Record<string, { count: number; pages: number[] }> = {};

    // Pre-compute a map of src -> photoId for faster lookup
    // This reduces the complexity from O(Pages * PhotosOnPage * AllPhotos) to O(Pages * PhotosOnPage)
    // which is massive for large galleries (e.g. 1000+ photos).
    const srcToIdMap = new Map<string, string>();
    allPhotos.forEach(p => {
      if (p.src) srcToIdMap.set(p.src, p.id);
    });

    albumPages.forEach((page, pageIndex) => {
      page.photos.forEach(photo => {
        // Use originalId if it exists, otherwise try to find the gallery photo by matching SRC
        let galleryId = photo.originalId;

        if (!galleryId && photo.src) {
          galleryId = srcToIdMap.get(photo.src);
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

  // Chronological index: maps photo.id -> 1-based position sorted by capture date
  const chronologicalIndex = useMemo(() => {
    const sorted = [...allPhotos].sort((a, b) => {
      const dateA = a.captureDate ? new Date(a.captureDate).getTime() : 0;
      const dateB = b.captureDate ? new Date(b.captureDate).getTime() : 0;
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateA - dateB;
    });
    const indexMap: Record<string, number> = {};
    sorted.forEach((photo, i) => {
      indexMap[photo.id] = i + 1;
    });
    return indexMap;
  }, [allPhotos]);

  // Calculate empty slots in album (photos with empty src)
  const emptySlots = useMemo(() => {
    return albumPages.reduce((total, page) => {
      return total + page.photos.filter(p => !p.src || p.src === '').length;
    }, 0);
  }, [albumPages]);

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

  const [randomSeed, setRandomSeed] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [allowDuplicates, setAllowDuplicates] = useState(true);
  const [multiSelectMode, setMultiSelectModeLocal] = useState(false); // true = checkboxes, false = trash icons
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



  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const exporterRef = useRef<AlbumExporterRef>(null);

  const handleExport = () => {
    exporterRef.current?.exportAlbum();
  };

  // Wrapper: updates local state and saves to config
  const setMultiSelectMode = useCallback((value: boolean) => {
    setMultiSelectModeLocal(value);
    updateConfig({ multiSelectMode: value });
  }, [updateConfig]);

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
    generateDummyPhotos,
    autoFillAlbum
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
        setMultiSelectModeLocal(savedConfig.multiSelectMode ?? true);
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


  const config: AlbumConfig = useMemo(() => ({
    size: watchedSize as '20x20',
    photoGap,
    pageMargin,
    backgroundColor,
    backgroundImage,
    cornerRadius,
  }), [watchedSize, photoGap, pageMargin, backgroundColor, backgroundImage, cornerRadius]);


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
    handleDropPhoto,
    handleRemovePhotosFromAlbum
  } = useAlbumPageEditor({
    setAlbumPages,
    allPhotos,
    allowDuplicates,
    usedPhotoIds
  });


  // Process uploaded photo files (from folder or individual selection)
  // Generate album from existing photos (sorted by capture date)
  const handleGenerateAlbum = useCallback(() => {
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
  }, [allPhotos, generateInitialPages, toast]);

  const handleAutoFillAlbum = useCallback(() => {
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

    autoFillAlbum(albumPages, sortedPhotos);
    toast({
      title: 'Album Filled',
      description: `Album pages filled with ${sortedPhotos.length} photos from gallery.`,
    });
  }, [allPhotos, albumPages, autoFillAlbum, toast]);

  const handleResetAlbum = useCallback(() => {
    generateEmptyAlbum();
    toast({
      title: 'Album Reset',
      description: 'Album has been reset to empty state.',
    });
  }, [generateEmptyAlbum, toast]);

  const handleDownloadPage = useCallback(async (pageId: string) => {
    toast({ title: "Downloading page..." });
    await exporterRef.current?.exportPage(pageId);
  }, [toast]);




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
            chronologicalIndex={chronologicalIndex}
            emptySlots={emptySlots}
            allowDuplicates={allowDuplicates}
            setAllowDuplicates={setAllowDuplicates}
            multiSelectMode={multiSelectMode}
            setMultiSelectMode={setMultiSelectMode}
            randomSeed={randomSeed}
            generateDummyPhotos={generateDummyPhotos}
            handleGenerateAlbum={handleGenerateAlbum}
            handleAutoFillAlbum={handleAutoFillAlbum}
            handleClearGallery={handleClearGallery}
            handleResetAlbum={handleResetAlbum}
            handleSortPhotos={handleSortPhotos}
            processUploadedFiles={processUploadedFiles}
            onDeletePhotos={handleDeletePhotos}
            onRemovePhotosFromAlbum={handleRemovePhotosFromAlbum}
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
