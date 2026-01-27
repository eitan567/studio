'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Loader2,
  Trash2,
  Upload,
  Eraser,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';
import placeholderImagesData from '@/lib/placeholder-images.json';

const placeholderImages = placeholderImagesData.placeholderImages;
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { v4 as uuidv4 } from 'uuid';

import type { Photo, AlbumConfig, AlbumPage, PhotoPanAndZoom } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { AlbumEditor } from '../album-editor/album-editor'; // Removed in favor of VirtualizedPageList
import { AlbumEditorProvider } from '../album-editor/context';
import { BookViewOverlay } from '../book-view/book-view-overlay';
import { useToast } from '@/hooks/use-toast';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
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
import { AiBackgroundGenerator } from '../shared/ai-background-generator';
import { AlbumExporter, AlbumExporterRef } from '../shared/album-exporter';
import { CustomLayoutEditorOverlay } from '../custom-layout-editor/custom-layout-editor-overlay';
import { CoverEditorOverlay } from '../cover-editor/cover-editor-overlay';
import { useAlbum } from '@/hooks/useAlbum';
import { usePhotoUpload } from '@/hooks/usePhotoUpload';
import { useAlbumGeneration } from '@/hooks/use-album-generation';
import { useAlbumPageEditor } from '@/hooks/useAlbumPageEditor';
import { usePhotoGalleryManager } from '@/hooks/usePhotoGalleryManager';
import { useSettings } from '@/hooks/use-settings';
import { ModeToggle } from '@/components/mode-toggle';
import { ScrollToTopButton } from '../shared/scroll-to-top-button';
import { AlbumConfigCard } from './sidebar/config-card';
import { PhotoGalleryCard } from './sidebar/gallery-card';
import { AlbumEditorToolbar } from './toolbar';
import { VirtualizedPageList } from './virtualized-page-list';

// Parse layout ID helper removed (now in useAlbumPageEditor or used via import if needed)

interface PageEditorProps {
  albumId: string;
}

const configSchema = z.object({
  size: z.enum(['20x20', '25x25', '30x30']),
});

type ConfigFormData = z.infer<typeof configSchema>;

export function PageEditor({ albumId }: PageEditorProps) {
  const { settings, liveSettings, isLoaded: isSettingsLoaded } = useSettings();
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
    setIsUploading,
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

  // Ref for the virtualized list to trigger scrolling
  const virtualListRef = useRef<{ scrollToPage: (index: number) => void } | null>(null);

  // State dependencies needed for hooks below
  const [allowDuplicates, setAllowDuplicates] = useState(true);

  // Computed dependencies
  const photoUsageDetails = useMemo(() => {
    const details: Record<string, { count: number; pages: number[] }> = {};

    // Pre-compute a map of src -> photoId for faster lookup
    const srcToIdMap = new Map<string, string>();
    allPhotos.forEach(p => {
      if (p.src) srcToIdMap.set(p.src, p.id);
    });

    albumPages.forEach((page, pageIndex) => {
      page.photos.forEach(photo => {
        let galleryId = photo.originalId;
        if (!galleryId && photo.src) {
          galleryId = srcToIdMap.get(photo.src);
        }
        galleryId = galleryId || photo.id;

        if (!photo.src || photo.src === '') return;

        if (!details[galleryId]) {
          details[galleryId] = { count: 0, pages: [] };
        }
        details[galleryId].count++;
        if (!details[galleryId].pages.includes(pageIndex)) {
          details[galleryId].pages.push(pageIndex);
        }
      });
    });
    return details;
  }, [albumPages, allPhotos]);

  const usedPhotoIds = useMemo(() => {
    return new Set(Object.keys(photoUsageDetails));
  }, [photoUsageDetails]);

  // Page Manipulation Hook - Moved UP to provide callbacks to Gallery Manager
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
    handleRemovePhotosFromAlbum,
    replacePhotoId
  } = useAlbumPageEditor({
    setAlbumPages,
    allPhotos,
    allowDuplicates,
    usedPhotoIds
  });

  const { toast } = useToast();

  const handleOpenEditor = useCallback((pageId: string) => {
    const page = albumPages.find(p => p.id === pageId);
    if (!page) return;

    setEditingPageId(pageId);
    setIsCoverEditorOpen(true);
  }, [albumPages]);

  const handleEnhanceWithAi = useCallback((pageId: string) => {
    toast({
      title: "AI Enhancement",
      description: "Enhancing photos on this page using AI...",
    });
  }, [toast]);

  const handleUndo = useCallback((pageId: string) => {
    toast({
      title: "Undo",
      description: "Reverting last change...",
    });
  }, [toast]);
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
    photoUploadRef,
    sortedPhotos
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
    onRemovePhotosFromAlbum: handleRemovePhotosFromAlbum,
    onPhotoUploadComplete: replacePhotoId
  });

  // Sync upload status to persistence layer for safety nets
  useEffect(() => {
    setIsUploading(isLoadingPhotos);
  }, [isLoadingPhotos, setIsUploading]);

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
              logger.debug('Delayed save triggered after upload');
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

  // photoUsageDetails and usedPhotoIds moved to top

  // Chronological index: maps photo.id -> 1-based position sorted by capture date
  const chronologicalIndex = useMemo(() => {
    const sorted = [...allPhotos].sort((a, b) => {
      const dateA = a.captureDate ? new Date(a.captureDate).getTime() : 0;
      const dateB = b.captureDate ? new Date(b.captureDate).getTime() : 0;

      // 1. Primary Sort: Date (Always ASC for numbering)
      if (dateA !== dateB) return dateA - dateB;

      // 2. Secondary Sort: Filename
      const nameA = a.alt || '';
      const nameB = b.alt || '';
      if (nameA !== nameB) return nameA.localeCompare(nameB);

      // 3. Absolute Tie-breaker: ID
      return a.id.localeCompare(b.id);
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

  // Calculate specific pages that have empty slots
  const pagesWithEmptySlots = useMemo(() => {
    let counter = 1;
    return albumPages
      .map((page, index) => {
        let label = "";
        const start = counter;
        if (page.isCover) {
          label = "Cover";
        } else if (page.type === 'spread') {
          label = `Pages ${start}-${start + 1}`;
          counter += 2;
        } else {
          label = `Page ${start}`;
          counter += 1;
        }

        const hasEmpty = page.photos.some(p => !p.src || p.src === '');
        return { index, label, hasEmpty };
      })
      .filter(p => p.hasEmpty);
  }, [albumPages]);

  const [isLoading, setIsLoading] = useState(false);

  const [isBookViewOpen, setIsBookViewOpen] = useState(false);
  const [isCustomLayoutEditorOpen, setIsCustomLayoutEditorOpen] = useState(false);
  const [isCoverEditorOpen, setIsCoverEditorOpen] = useState(false);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);

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
  // allowDuplicates moved up
  const [multiSelectMode, setMultiSelectModeLocal] = useState(false); // true = checkboxes, false = trash icons
  // Gallery Sidebar State
  type GalleryMode = 'collapsed' | 'default' | 'expanded';
  const [galleryMode, setGalleryMode] = useState<GalleryMode>('default');

  const getGalleryWidth = (mode: GalleryMode) => {
    switch (mode) {
      case 'collapsed': return 0;
      case 'expanded': return 525;
      default: return 356;
    }
  };


  const [photoGap, setPhotoGap] = useState(2);
  const [pageMargin, setPageMargin] = useState(0);
  const [cornerRadius, setCornerRadius] = useState(0);
  // Preview values - Handled by AlbumEditorContext
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

  // Wrapper: updates local state only (no config persistence)
  const setMultiSelectMode = useCallback((value: boolean) => {
    setMultiSelectModeLocal(value);
  }, []);

  const handleColorChange = useCallback((color: string) => {
    logger.debug('Color change requested:', color);
    // Clear previous timeout
    if (colorDebounceRef.current) {
      clearTimeout(colorDebounceRef.current);
    }

    // Debounce update by 100ms
    colorDebounceRef.current = setTimeout(() => {
      setBackgroundColor(color);
    }, 100);
  }, []);

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
    randomSeed,
    settings: liveSettings
  });

  // Load album from server or create empty album

  useEffect(() => {
    setIsClient(true);
    setRandomSeed(Math.random().toString(36).substring(7));
  }, []);



  // Load album from server or create empty album
  useEffect(() => {
    if (isAlbumLoading || isInitialized || !isSettingsLoaded) return;

    logger.debug('Initializing [AlbumEditor] with settings:', {
      photoGap: settings.defaultPhotoGap,
      pageMargin: settings.defaultPageMargin,
      spineOpacity: settings.defaultSpineOpacity,
      spineWidth: settings.defaultSpineWidth
    });

    if (album) {
      // Apply saved config immediately, regardless of whether pages exist
      setPhotoGap(savedConfig.photoGap ?? settings.defaultPhotoGap);
      setPageMargin(savedConfig.pageMargin ?? settings.defaultPageMargin);
      setCornerRadius(savedConfig.cornerRadius || 0);
      setBackgroundColor(savedConfig.backgroundColor || '#ffffff');
      setBackgroundImage(savedConfig.backgroundImage);
      setMultiSelectModeLocal(savedConfig.multiSelectMode ?? true);
      form.setValue('size', savedConfig.size);

      if (savedPages.length > 0) {
        // Load existing pages from server
        setAlbumPages(savedPages);
      } else {
        // Existing album but empty -> Initialize with default structure
        generateEmptyAlbum();
      }
      setIsInitialized(true);
    } else if (isNew || (!album && !isAlbumLoading)) {
      // Initialize with empty album for new albums
      generateEmptyAlbum();

      // Also initialize local config states from user settings
      setPhotoGap(liveSettings.defaultPhotoGap);
      setPageMargin(liveSettings.defaultPageMargin);
      setCornerRadius(liveSettings.defaultCornerRadius);
      setBackgroundColor(liveSettings.defaultBackgroundColor);
      setIsInitialized(true);
    }
  }, [album, savedPages, savedConfig, isAlbumLoading, isNew, isInitialized, isSettingsLoaded, generateEmptyAlbum, liveSettings]);

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

  // Sync form defaults with settings once loaded for NEW projects
  useEffect(() => {
    if (isSettingsLoaded && isNew && !isInitialized) {
      form.reset({
        size: settings.defaultAlbumSize,
      });
    }
  }, [isSettingsLoaded, isNew, isInitialized, settings.defaultAlbumSize, form]);

  // Track the last stringified version of pages we know is on the server to prevent redundant saves
  const lastSavedPagesRef = useRef<string>('');

  // Auto-save pages when they change
  useEffect(() => {
    if (!isInitialized || isAlbumLoading) return;
    if (albumPages.length === 0) return;

    // Fast change detection
    const currentPagesStr = JSON.stringify(albumPages);

    // 1. Initial hydration check: if we just initialized and the pages match what came from server, skip
    if (lastSavedPagesRef.current === '') {
      const serverPagesStr = JSON.stringify(savedPages);
      if (currentPagesStr === serverPagesStr) {
        logger.debug('Skipping auto-save: Pages match server hydration');
        lastSavedPagesRef.current = currentPagesStr;
        return;
      }
    }

    // 2. Redundancy check: if the pages haven't changed since our last local save, skip
    if (currentPagesStr === lastSavedPagesRef.current) return;

    // If this is a new album, create it first
    if (isNew) {
      lastSavedPagesRef.current = currentPagesStr;
      createAlbum(albumName, config, albumPages);
      return;
    }

    // Otherwise, update pages
    if (album) {
      logger.debug('Auto-saving pages...');
      lastSavedPagesRef.current = currentPagesStr;
      updatePages(albumPages);
    }
  }, [albumPages, isInitialized, isAlbumLoading, isNew, savedPages]);

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

    // Compare with saved config to prevent redundant save on hydration
    const isConfigChanged =
      config.photoGap !== savedConfig.photoGap ||
      config.pageMargin !== savedConfig.pageMargin ||
      config.cornerRadius !== savedConfig.cornerRadius ||
      config.backgroundColor !== savedConfig.backgroundColor ||
      config.backgroundImage !== savedConfig.backgroundImage ||
      watchedSize !== savedConfig.size;

    if (!isConfigChanged) {
      logger.debug('Skipping auto-save: Config matches server hydration');
      return;
    }

    logger.debug('Auto-saving config...');
    updateConfig(config);
  }, [photoGap, pageMargin, cornerRadius, backgroundColor, backgroundImage, watchedSize, isInitialized, isAlbumLoading, isNew, album, savedConfig]);


  const config: AlbumConfig = useMemo(() => ({
    size: watchedSize as '20x20',
    photoGap,
    pageMargin,
    backgroundColor,
    backgroundImage,
    cornerRadius,
  }), [watchedSize, photoGap, pageMargin, backgroundColor, backgroundImage, cornerRadius]);


  // Page Manipulation Hook (Moved up)


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

      // 1. Primary Sort: Date
      if (dateA !== dateB) return dateA - dateB;

      // 2. Secondary Sort: Filename
      const nameA = a.alt || '';
      const nameB = b.alt || '';
      if (nameA !== nameB) return nameA.localeCompare(nameB);

      // 3. Absolute Tie-breaker: ID
      return a.id.localeCompare(b.id);
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

      // 1. Primary Sort: Date
      if (dateA !== dateB) return dateA - dateB;

      // 2. Secondary Sort: Filename
      const nameA = a.alt || '';
      const nameB = b.alt || '';
      if (nameA !== nameB) return nameA.localeCompare(nameB);

      // 3. Absolute Tie-breaker: ID
      return a.id.localeCompare(b.id);
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
    <AlbumEditorProvider>
      <div className="flex flex-col h-screen bg-background text-foreground">
        {/* Global Top Toolbar */}
        <AlbumEditorToolbar
          albumName={albumName}
          onUpdateName={handleSaveTitle}
          saveStatus={isLoadingPhotos ? 'uploading' : isSaving ? 'saving' : hasUnsavedChanges ? 'unsaved' : 'saved'}
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

        <div
          className="flex h-[calc(100vh-3.5rem)] flex-1 overflow-hidden bg-muted/30 dark:bg-muted/10 items-stretch"
          style={{
            backgroundImage: `
              linear-gradient(to right, hsl(var(--foreground) / 0.04) 1px, transparent 1px),
              linear-gradient(to bottom, hsl(var(--foreground) / 0.04) 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px'
          }}
        >
          {/* Left Sidebar: Config & Tools */}
          <div className="w-[300px] shrink-0 overflow-y-auto border-r bg-background z-10">
            {isClient && isInitialized ? (
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
                pagesWithEmptySlots={pagesWithEmptySlots}
                onNavigateToPage={(index) => virtualListRef.current?.scrollToPage(index)}
              />
            ) : (
              <div className="space-y-4">
                <Skeleton className="h-[300px] w-full rounded-xl" />
                <Skeleton className="h-[100px] w-full rounded-xl" />
              </div>
            )}
          </div>

          {/* Main Content: Album Preview */}
          <div className="flex-1 min-w-0 pr-6 h-full flex flex-col" style={{ colorScheme: 'light' }}>
            {isLoading || isAlbumLoading || !isInitialized ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center animate-in fade-in duration-300 bg-muted/30 border-2 border-dashed rounded-lg">
                <Loader2 className="h-12 w-12 mb-4 animate-spin text-primary" />
                <h3 className="text-lg font-semibold mb-2">
                  {isAlbumLoading ? "Loading Album..." : "Generating Album Layout..."}
                </h3>
                <p className="text-sm">
                  {isAlbumLoading ? "Please wait while we fetch your data." : "Please wait while we prepare your pages."}
                </p>
              </div>
            ) : (
              <VirtualizedPageList
                pages={albumPages}
                config={config}
                allPhotos={allPhotos}
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
                onOpenEditor={handleOpenEditor}
                onEnhanceWithAi={handleEnhanceWithAi}
                onUndo={handleUndo}
                customTemplates={customTemplates}
                defaultViewMode={settings.defaultEditorViewMode as "single" | "spread"}
                visibleTemplateCategories={settings.visibleTemplateCategories}
                allowedTemplateIds={settings.allowedTemplateIds || []}
                ref={virtualListRef}
              />
            )}
          </div>

          {/* Gallery Control Strip */}
          <div className="w-[1px] shrink-0 bg-border z-20 flex flex-col items-center justify-center relative overflow-visible">
            {/* Buttons attached to the strip */}
            <div className="absolute top-8 -translate-y-1/2 flex flex-col gap-1 -right-2 translate-x-[50%] z-30">
              {/* Collapsed Mode: Show Left Arrow to open */}
              {galleryMode === 'collapsed' && (
                <Button
                  variant="secondary" size="icon"
                  className="h-10 w-4 rounded-l-md rounded-r-none border shadow-md bg-background -translate-x-full"
                  onClick={() => setGalleryMode('default')}
                  title="Open Gallery"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}

              {/* Default Mode: Show Left (Expand) and Right (Collapse) */}
              {galleryMode === 'default' && (
                <div className="flex flex-col gap-1 -translate-x-full">
                  <Button
                    variant="secondary" size="icon"
                    className="h-8 w-4 rounded-l-md rounded-r-none border shadow-sm bg-background"
                    onClick={() => setGalleryMode('expanded')}
                    title="Maximize Width"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary" size="icon"
                    className="h-8 w-4 rounded-l-md rounded-r-none border shadow-sm bg-background"
                    onClick={() => setGalleryMode('collapsed')}
                    title="Collapse"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Expanded Mode: Show Right Arrow to shrink */}
              {galleryMode === 'expanded' && (
                <Button
                  variant="secondary" size="icon"
                  className="h-10 w-4 rounded-l-md rounded-r-none border shadow-md bg-background -translate-x-full"
                  onClick={() => setGalleryMode('default')}
                  title="Restore Standard Width"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Right Panel: Photo Gallery */}
          <div
            style={{ width: `${getGalleryWidth(galleryMode)}px` }}
            className="shrink-0 transition-[width] duration-300 ease-in-out overflow-hidden"
          >
            {/* Rigid container to prevent layout thrashing during transition */}
            <div className="h-full w-[356px] min-w-full">
              <PhotoGalleryCard
                allPhotos={sortedPhotos}
                isLoadingPhotos={isLoadingPhotos || isAlbumLoading}
                isResizing={false} // No longer used really
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
            </div>
          </div>
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
        {isCoverEditorOpen && editingPageId && (
          <CoverEditorOverlay
            page={albumPages.find(p => p.id === editingPageId) || albumPages[0]}
            onUpdatePage={handleUpdatePage}
            onClose={() => {
              setIsCoverEditorOpen(false);
              setEditingPageId(null);
            }}
            allPhotos={album?.photos || []}
            isCover={albumPages.find(p => p.id === editingPageId)?.isCover ?? false}
            config={config}
          />
        )}
      </div>
    </AlbumEditorProvider>
  );
}
