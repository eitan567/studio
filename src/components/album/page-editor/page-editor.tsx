'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  AlertTriangle,
  ImageOff,
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

import type { Photo, AlbumConfig, AlbumPage, PhotoPanAndZoom, BookOpeningDirection } from '@/lib/types';
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
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { LAYOUT_TEMPLATES, COVER_TEMPLATES, ADVANCED_TEMPLATES, getPhotoCount, useTemplates } from '@/hooks/useTemplates';
import { AdvancedTemplate } from '@/lib/advanced-layout-types';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, TooltipArrow } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import Image from 'next/image';

// Fix for alert import
import { Alert as AlertUI, AlertDescription as AlertDescriptionUI, AlertTitle as AlertTitleUI } from '@/components/ui/alert';
import { AiBackgroundGenerator } from '../shared/ai-background-generator';
import { AlbumExporter, AlbumExporterRef, type ExportRenderOptions } from '../shared/album-exporter';
import { ExportDialog, ExportOptions } from './export-dialog';
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
import { AiPhotoEnhancerSheet } from '../shared/ai-photo-enhancer-sheet';
import { AlbumConfigCard } from './sidebar/config-card';
import { PhotoGalleryCard } from './sidebar/gallery-card';
import { AlbumEditorToolbar } from './toolbar';
import { VirtualizedPageList } from './virtualized-page-list';
import { extractSupabaseStoragePath, normalizePhotoMediaUrls } from '@/lib/supabase-media-normalizer';
import { parseLayoutId } from '@/lib/layout-id-utils';
import {
  buildAlbumBackupPayload,
  describeBackupPhotoRef,
  getMissingBackupPhotoRefs,
  hydratePagesFromBackup,
  parseAlbumBackupPayload,
} from '@/lib/album-backup';
import type { AlbumBackupPayload, AlbumBackupPhotoRef } from '@/lib/album-backup';

// Parse layout ID helper removed (now in useAlbumPageEditor or used via import if needed)

interface PageEditorProps {
  albumId: string;
}

const configSchema = z.object({
  size: z.enum(['20x20', '25x25', '30x30']),
});

type ConfigFormData = z.infer<typeof configSchema>;

type EnhanceTarget = {
  pageId: string;
  photoId: string;
  photo: Photo;
  sourceImageUrl: string;
};

type PendingBackupImport = {
  backupPayload: AlbumBackupPayload;
  missingRefs: AlbumBackupPhotoRef[];
  requiredCount: number;
};

export function PageEditor({ albumId }: PageEditorProps) {
  const { settings, liveSettings, isLoaded: isSettingsLoaded } = useSettings();
  const { defaultCoverTemplate, defaultGridTemplate, findTemplate, findCoverTemplate } = useTemplates();
  const isManualSaveMode = settings.albumSaveMode === 'manual';
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
  } = useAlbum(albumId, {
    autoSave: !isManualSaveMode,
  });




  const router = useRouter();
  const { signOut } = useAuth();



  // LOCAL photo state - decoupled from DB persistence
  // This allows transient states (isUploading) without triggering DB saves
  const [localPhotos, setLocalPhotos] = useState<Photo[]>([]);

  // Track initialization to prevent re-hydrating deleted photos
  const photosInitialized = useRef(false);

  const mergeGalleryPhotosWithPages = useCallback((galleryPhotos: Photo[], pages: AlbumPage[]): Photo[] => {
    const merged: Photo[] = [];
    const seenIds = new Set<string>();
    const seenSrc = new Set<string>();

    for (const photo of galleryPhotos || []) {
      const normalizedPhoto = normalizePhotoMediaUrls(photo);
      const effectiveSrc = (normalizedPhoto.remoteUrl || normalizedPhoto.src || '').trim();
      if (!effectiveSrc) continue;
      merged.push({
        ...normalizedPhoto,
        storagePath: normalizedPhoto.storagePath || extractSupabaseStoragePath(effectiveSrc) || undefined,
      });
      if (normalizedPhoto.id) seenIds.add(normalizedPhoto.id);
      seenSrc.add(effectiveSrc);
    }

    for (const page of pages || []) {
      for (const slotPhoto of page.photos || []) {
        const effectiveSrc = (slotPhoto.remoteUrl || slotPhoto.src || '').trim();
        if (!effectiveSrc) continue;

        const preferredId = (slotPhoto.originalId || slotPhoto.id || '').trim();
        const hasKnownId = preferredId ? seenIds.has(preferredId) : false;
        if (hasKnownId || seenSrc.has(effectiveSrc)) continue;

        const recoveredId = preferredId || crypto.randomUUID();
        merged.push({
          id: recoveredId,
          src: effectiveSrc,
          remoteUrl: effectiveSrc,
          storagePath: slotPhoto.storagePath || extractSupabaseStoragePath(effectiveSrc) || undefined,
          alt: slotPhoto.alt || 'Recovered Photo',
          width: slotPhoto.width,
          height: slotPhoto.height,
          captureDate: slotPhoto.captureDate,
        });
        seenIds.add(recoveredId);
        seenSrc.add(effectiveSrc);
      }
    }

    return merged;
  }, []);

  // Initialize local photos from saved photos/pages on load (ONCE)
  useEffect(() => {
    if (photosInitialized.current || isAlbumLoading) return;

    const hydratedPhotos = mergeGalleryPhotosWithPages(savedPhotos || [], savedPages || []);
    setLocalPhotos(hydratedPhotos);
    photosInitialized.current = true;
  }, [savedPhotos, savedPages, isAlbumLoading, mergeGalleryPhotosWithPages]);

  // Expose local photos for UI
  const allPhotos = localPhotos;
  const { uploadPhoto } = usePhotoUpload();

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
  const undoStackRef = useRef<AlbumPage[][]>([]);
  const redoStackRef = useRef<AlbumPage[][]>([]);
  const skipNextHistoryRecordRef = useRef(false);
  const lastHistorySignatureRef = useRef('');
  const MAX_HISTORY_ENTRIES = 120;

  const clonePagesSnapshot = useCallback((pages: AlbumPage[]): AlbumPage[] => {
    if (typeof structuredClone === 'function') {
      return structuredClone(pages);
    }
    return JSON.parse(JSON.stringify(pages));
  }, []);

  useEffect(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    skipNextHistoryRecordRef.current = false;
    lastHistorySignatureRef.current = '';
  }, [albumId]);

  // Ref for the virtualized list to trigger scrolling
  const virtualListRef = useRef<{
    scrollToPage: (index: number) => void;
    getCurrentPageIndex: () => number;
  } | null>(null);

  // State dependencies needed for hooks below
  const [allowDuplicates, setAllowDuplicates] = useState(true);
  const [customTemplates, setCustomTemplates] = useState<AdvancedTemplate[]>([]);

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
    movePage,
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
    replacePhotoId,
    replacePhotoInSlot,
    togglePageLock
  } = useAlbumPageEditor({
    albumPages,
    setAlbumPages,
    allPhotos,
    allowDuplicates,
    usedPhotoIds,
    customTemplates
  });

  const { toast } = useToast();
  const [enhanceTarget, setEnhanceTarget] = useState<EnhanceTarget | null>(null);
  const [isEnhancerOpen, setIsEnhancerOpen] = useState(false);

  const handleOpenEditor = useCallback((pageId: string) => {
    const page = albumPages.find(p => p.id === pageId);
    if (!page) return;
    if (page.isLocked) return;

    setEditingPageId(pageId);
    setIsCoverEditorOpen(true);
  }, [albumPages]);

  const resolveEnhanceSourceUrl = useCallback((photo: Photo): string | null => {
    if (photo.remoteUrl && photo.remoteUrl.trim()) return photo.remoteUrl.trim();
    if (photo.src && !photo.src.startsWith('blob:')) return photo.src;
    return null;
  }, []);

  const mimeToExtension = useCallback((mimeType?: string) => {
    if (!mimeType) return '.png';
    const lower = mimeType.toLowerCase();
    if (lower.includes('jpeg') || lower.includes('jpg')) return '.jpg';
    if (lower.includes('webp')) return '.webp';
    if (lower.includes('gif')) return '.gif';
    if (lower.includes('bmp')) return '.bmp';
    if (lower.includes('heic')) return '.heic';
    return '.png';
  }, []);

  const buildEnhancedFileName = useCallback((originalName: string, mimeType?: string) => {
    const fallbackBase = 'photo';
    const sanitizedOriginal = (originalName || fallbackBase).trim();
    const dotIndex = sanitizedOriginal.lastIndexOf('.');
    const hasExt = dotIndex > 0 && dotIndex < sanitizedOriginal.length - 1;
    const base = hasExt ? sanitizedOriginal.slice(0, dotIndex) : sanitizedOriginal;
    const extFromName = hasExt ? sanitizedOriginal.slice(dotIndex) : '';
    const fallbackExt = mimeToExtension(mimeType);
    const ext = extFromName || fallbackExt;
    const normalizedBase = base.replace(/\s+/g, '_');
    const existingNames = new Set(
      allPhotos
        .map(photo => photo.alt?.toLowerCase())
        .filter((name): name is string => !!name)
    );

    let candidate = `${normalizedBase}_Enhance${ext}`;
    let suffix = 2;
    while (existingNames.has(candidate.toLowerCase())) {
      candidate = `${normalizedBase}_Enhance_${suffix}${ext}`;
      suffix += 1;
    }

    return candidate;
  }, [allPhotos, mimeToExtension]);

  const handleOpenPhotoEnhancer = useCallback((pageId: string, photoId: string, photo: Photo) => {
    const page = albumPages.find(p => p.id === pageId);
    if (page?.isLocked) {
      toast({
        title: 'Page is locked',
        description: 'Unlock this page before editing photos.',
        variant: 'destructive',
      });
      return;
    }

    const sourceImageUrl = resolveEnhanceSourceUrl(photo);
    if (!sourceImageUrl) {
      toast({
        title: 'Image is not ready',
        description: 'Please wait for upload to finish before AI enhancement.',
        variant: 'destructive',
      });
      return;
    }

    setEnhanceTarget({
      pageId,
      photoId,
      photo,
      sourceImageUrl,
    });
    setIsEnhancerOpen(true);
  }, [albumPages, resolveEnhanceSourceUrl, toast]);

  const handleEnhancerOpenChange = useCallback((nextOpen: boolean) => {
    setIsEnhancerOpen(nextOpen);
    if (!nextOpen) {
      setEnhanceTarget(null);
    }
  }, []);

  const handleApproveEnhancedPhoto = useCallback(async (enhancedImage: string | Blob) => {
    if (!enhanceTarget) {
      throw new Error('No photo selected for enhancement.');
    }

    let blob: Blob;
    if (typeof enhancedImage === 'string') {
      const imageResponse = await fetch(enhancedImage);
      if (!imageResponse.ok) {
        throw new Error('Could not download enhanced image.');
      }
      blob = await imageResponse.blob();
    } else {
      blob = enhancedImage;
    }

    const fileName = buildEnhancedFileName(enhanceTarget.photo.alt || 'photo', blob.type);
    const file = new File([blob], fileName, {
      type: blob.type || 'image/png',
    });

    // @ts-ignore - skipStateUpdates is supported by usePhotoUpload
    const uploadResult = await uploadPhoto(file, { skipStateUpdates: true });
    if (!uploadResult.success || !uploadResult.photo) {
      throw new Error(uploadResult.error || 'Upload of enhanced photo failed.');
    }

    const uploadedPhoto: Photo = {
      ...uploadResult.photo,
      alt: fileName,
      captureDate: enhanceTarget.photo.captureDate,
      remoteUrl: uploadResult.photo.remoteUrl || uploadResult.photo.src,
    };

    setAllPhotos(prev => [...prev, uploadedPhoto]);
    replacePhotoInSlot(enhanceTarget.pageId, enhanceTarget.photoId, uploadedPhoto);

    toast({
      title: 'Enhanced photo applied',
      description: `${fileName} was added to the gallery and applied to the album.`,
    });
  }, [buildEnhancedFileName, enhanceTarget, replacePhotoInSlot, setAllPhotos, toast, uploadPhoto]);

  const handleEnhanceWithAi = useCallback((pageId: string) => {
    toast({
      title: "AI Enhancement",
      description: "Enhancing photos on this page using AI...",
    });
  }, [toast]);

  const handleUndo = useCallback((_pageId?: string) => {
    if (undoStackRef.current.length <= 1) {
      toast({
        title: 'Nothing to undo',
        description: 'No previous page edits were found.',
      });
      return;
    }

    const currentSnapshot = undoStackRef.current.pop();
    const previousSnapshot = undoStackRef.current[undoStackRef.current.length - 1];
    if (!currentSnapshot || !previousSnapshot) return;

    redoStackRef.current.push(clonePagesSnapshot(currentSnapshot));
    skipNextHistoryRecordRef.current = true;
    lastHistorySignatureRef.current = JSON.stringify(previousSnapshot);
    setAlbumPages(clonePagesSnapshot(previousSnapshot));

    toast({
      title: 'Undo complete',
      description: 'Reverted the last page change.',
    });
  }, [clonePagesSnapshot, toast]);

  const handleRedo = useCallback((_pageId?: string) => {
    if (redoStackRef.current.length === 0) {
      toast({
        title: 'Nothing to redo',
        description: 'No reverted changes are available.',
      });
      return;
    }

    const nextSnapshot = redoStackRef.current.pop();
    if (!nextSnapshot) return;

    undoStackRef.current.push(clonePagesSnapshot(nextSnapshot));
    if (undoStackRef.current.length > MAX_HISTORY_ENTRIES) {
      undoStackRef.current.shift();
    }

    skipNextHistoryRecordRef.current = true;
    lastHistorySignatureRef.current = JSON.stringify(nextSnapshot);
    setAlbumPages(clonePagesSnapshot(nextSnapshot));

    toast({
      title: 'Redo complete',
      description: 'Re-applied the last reverted change.',
    });
  }, [clonePagesSnapshot, toast]);

  useEffect(() => {
    const handleHistoryShortcuts = (event: KeyboardEvent) => {
      const isMetaOrCtrl = event.metaKey || event.ctrlKey;
      if (!isMetaOrCtrl) return;

      const activeElement = document.activeElement as HTMLElement | null;
      if (activeElement) {
        const tagName = activeElement.tagName;
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' || activeElement.isContentEditable) {
          return;
        }
      }

      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
        return;
      }

      if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleHistoryShortcuts);
    return () => window.removeEventListener('keydown', handleHistoryShortcuts);
  }, [handleRedo, handleUndo]);
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
    sortedPhotos,
    chronologicalIndex
  } = usePhotoGalleryManager({
    allPhotos,
    setAllPhotos,
    updateThumbnail: (url) => {
      updatePages(albumPages.map(page =>
        page.isCover && page.coverLayouts?.front === (defaultCoverTemplate?.id || '') && (!page.photos[0] || !page.photos[0].src)
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



  const getRequiredPhotoSlotsForPage = useCallback((page: AlbumPage): number => {
    const resolveTemplateCount = (
      layoutId: string | number | null | undefined,
      fallbackId: string | number | undefined,
      isCoverLayout: boolean
    ) => {
      const { baseId } = parseLayoutId(layoutId || fallbackId || '');
      const normalizedBaseId = String(baseId || '');

      if (normalizedBaseId.startsWith('dynamic-justified')) {
        // Dynamic layouts are data-driven and may use all currently available slots.
        return page.photos.length;
      }

      const template = isCoverLayout
        ? (findCoverTemplate(baseId) || defaultCoverTemplate)
        : (findTemplate(baseId) || defaultGridTemplate);

      return template ? getPhotoCount(template) : 0;
    };

    if (page.isCover) {
      const isSplitCover = page.coverType === 'split' || !page.coverType;
      if (!isSplitCover) {
        const count = resolveTemplateCount(page.layout, defaultCoverTemplate?.id, true);
        return count > 0 ? count : page.photos.length;
      }

      const backLayout = page.coverLayouts?.back || defaultCoverTemplate?.id || '';
      const frontLayout = page.coverLayouts?.front || defaultCoverTemplate?.id || '';
      const backBaseId = String(parseLayoutId(backLayout).baseId || '');
      const frontBaseId = String(parseLayoutId(frontLayout).baseId || '');

      // Cover with dynamic on either side behaves as full dynamic spread.
      if (backBaseId.startsWith('dynamic-justified') || frontBaseId.startsWith('dynamic-justified')) {
        return page.photos.length;
      }

      return resolveTemplateCount(backLayout, defaultCoverTemplate?.id, true)
        + resolveTemplateCount(frontLayout, defaultCoverTemplate?.id, true);
    }

    if (page.type === 'spread') {
      if (page.spreadMode !== 'split') {
        const count = resolveTemplateCount(page.layout, defaultGridTemplate?.id, false);
        return count > 0 ? count : page.photos.length;
      }

      const leftLayout = page.spreadLayouts?.left || defaultGridTemplate?.id || '';
      const rightLayout = page.spreadLayouts?.right || defaultGridTemplate?.id || '';
      const leftBaseId = String(parseLayoutId(leftLayout).baseId || '');
      const rightBaseId = String(parseLayoutId(rightLayout).baseId || '');

      // Spread with dynamic on either side behaves as full dynamic spread.
      if (leftBaseId.startsWith('dynamic-justified') || rightBaseId.startsWith('dynamic-justified')) {
        return page.photos.length;
      }

      return resolveTemplateCount(leftLayout, defaultGridTemplate?.id, false)
        + resolveTemplateCount(rightLayout, defaultGridTemplate?.id, false);
    }

    const singleCount = resolveTemplateCount(page.layout, defaultGridTemplate?.id, false);
    return singleCount > 0 ? singleCount : page.photos.length;
  }, [defaultCoverTemplate, defaultGridTemplate, findCoverTemplate, findTemplate]);

  const getMissingPhotoSlotsForPage = useCallback((page: AlbumPage): number => {
    const requiredSlots = Math.max(0, getRequiredPhotoSlotsForPage(page));
    if (requiredSlots === 0) return 0;

    const consideredSlots = page.photos.slice(0, requiredSlots);
    const filledCount = consideredSlots.reduce((count, photo) => {
      const source = (photo.remoteUrl || photo.src || '').trim();
      return source.length > 0 ? count + 1 : count;
    }, 0);

    // If consideredSlots is shorter than requiredSlots, those are also missing.
    return Math.max(0, requiredSlots - filledCount);
  }, [getRequiredPhotoSlotsForPage]);

  // Calculate empty slots in album based on active template requirements per page.
  const emptySlots = useMemo(() => {
    return albumPages.reduce((total, page) => total + getMissingPhotoSlotsForPage(page), 0);
  }, [albumPages, getMissingPhotoSlotsForPage]);

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

        const hasEmpty = getMissingPhotoSlotsForPage(page) > 0;
        return { index, label, hasEmpty };
      })
      .filter(p => p.hasEmpty);
  }, [albumPages, getMissingPhotoSlotsForPage]);

  const [isLoading, setIsLoading] = useState(false);

  const [isBookViewOpen, setIsBookViewOpen] = useState(false);
  const [isCustomLayoutEditorOpen, setIsCustomLayoutEditorOpen] = useState(false);
  const [isCoverEditorOpen, setIsCoverEditorOpen] = useState(false);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);

  const handleTogglePageLock = useCallback((pageId: string) => {
    const targetPage = albumPages.find(page => page.id === pageId);
    if (!targetPage) return;

    const willLock = !targetPage.isLocked;
    if (willLock && editingPageId === pageId) {
      setIsCoverEditorOpen(false);
      setEditingPageId(null);
    }

    togglePageLock(pageId);
  }, [albumPages, editingPageId, togglePageLock]);

  useEffect(() => {
    if (!isCoverEditorOpen || !editingPageId) return;
    const editedPage = albumPages.find(page => page.id === editingPageId);
    if (!editedPage || editedPage.isLocked) {
      setIsCoverEditorOpen(false);
      setEditingPageId(null);
    }
  }, [albumPages, editingPageId, isCoverEditorOpen]);

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!isInitialized || isAlbumLoading) return;

    const signature = JSON.stringify(albumPages);
    if (skipNextHistoryRecordRef.current) {
      skipNextHistoryRecordRef.current = false;
      lastHistorySignatureRef.current = signature;
      return;
    }

    if (signature === lastHistorySignatureRef.current) return;

    if (undoStackRef.current.length === 0) {
      undoStackRef.current = [clonePagesSnapshot(albumPages)];
      redoStackRef.current = [];
      lastHistorySignatureRef.current = signature;
      return;
    }

    undoStackRef.current.push(clonePagesSnapshot(albumPages));
    if (undoStackRef.current.length > MAX_HISTORY_ENTRIES) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
    lastHistorySignatureRef.current = signature;
  }, [albumPages, clonePagesSnapshot, isAlbumLoading, isInitialized]);

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
  const [multiSelectMode, setMultiSelectModeLocal] = useState(true); // true = checkboxes, false = trash icons
  // Left Config Sidebar State
  const CONFIG_PANEL_WIDTH = 300;
  const PAGE_LIST_ROW_HORIZONTAL_PADDING = 32; // Must match VirtualizedPageList ROW_HORIZONTAL_PADDING
  const [isConfigPanelPinned, setIsConfigPanelPinned] = useState(true);
  const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(true);
  const configPanelRecenterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const configPanelAutoOpenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const CONFIG_PANEL_TRANSITION_MS = 300;
  const CONFIG_PANEL_AUTO_OPEN_DELAY_MS = 220;
  const mainContentRef = useRef<HTMLDivElement>(null);
  const [mainContentWidth, setMainContentWidth] = useState(0);
  // Gallery Sidebar State
  type GalleryMode = 'collapsed' | 'default' | 'expanded';
  const [galleryMode, setGalleryMode] = useState<GalleryMode>('default');
  const [configPanelPageMaxWidthByGalleryMode, setConfigPanelPageMaxWidthByGalleryMode] = useState<Partial<Record<GalleryMode, number>>>({});
  const galleryRecenterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const GALLERY_WIDTH_TRANSITION_MS = 300;
  const COLLAPSED_PAGE_MAX_WIDTH = 1300;

  const getGalleryWidth = (mode: GalleryMode) => {
    switch (mode) {
      case 'collapsed': return 0;
      case 'expanded': return 525;
      default: return 356;
    }
  };

  const resolveConfigPanelCapForMode = useCallback((mode: GalleryMode) => {
    return configPanelPageMaxWidthByGalleryMode[mode]
      ?? configPanelPageMaxWidthByGalleryMode.default
      ?? configPanelPageMaxWidthByGalleryMode.expanded
      ?? configPanelPageMaxWidthByGalleryMode.collapsed
      ?? undefined;
  }, [configPanelPageMaxWidthByGalleryMode]);

  const setGalleryModePreservingPage = useCallback((nextMode: GalleryMode) => {
    if (nextMode === galleryMode) return;

    const currentPageIndex = virtualListRef.current?.getCurrentPageIndex?.();

    if (galleryRecenterTimeoutRef.current) {
      clearTimeout(galleryRecenterTimeoutRef.current);
      galleryRecenterTimeoutRef.current = null;
    }

    setGalleryMode(nextMode);

    if (typeof currentPageIndex !== 'number' || Number.isNaN(currentPageIndex)) {
      return;
    }

    const recenterToPreviousPage = () => {
      virtualListRef.current?.scrollToPage(currentPageIndex);
    };

    // Keep the same centered page during and after width transition.
    requestAnimationFrame(() => {
      requestAnimationFrame(recenterToPreviousPage);
    });

    galleryRecenterTimeoutRef.current = setTimeout(() => {
      recenterToPreviousPage();
      galleryRecenterTimeoutRef.current = null;
    }, GALLERY_WIDTH_TRANSITION_MS + 40);
  }, [galleryMode]);

  const setConfigPanelOpenPreservingPage = useCallback((nextOpen: boolean) => {
    if (nextOpen === isConfigPanelOpen) return;

    const currentPageIndex = virtualListRef.current?.getCurrentPageIndex?.();

    if (configPanelRecenterTimeoutRef.current) {
      clearTimeout(configPanelRecenterTimeoutRef.current);
      configPanelRecenterTimeoutRef.current = null;
    }

    setIsConfigPanelOpen(nextOpen);

    if (typeof currentPageIndex !== 'number' || Number.isNaN(currentPageIndex)) {
      return;
    }

    const recenterToPreviousPage = () => {
      virtualListRef.current?.scrollToPage(currentPageIndex);
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(recenterToPreviousPage);
    });

    configPanelRecenterTimeoutRef.current = setTimeout(() => {
      recenterToPreviousPage();
      configPanelRecenterTimeoutRef.current = null;
    }, CONFIG_PANEL_TRANSITION_MS + 40);
  }, [isConfigPanelOpen]);

  const handleToggleConfigPanelPinned = useCallback(() => {
    setIsConfigPanelPinned((prev) => {
      const next = !prev;
      if (next) {
        setConfigPanelOpenPreservingPage(true);
      }
      return next;
    });
  }, [setConfigPanelOpenPreservingPage]);

  const cancelConfigPanelAutoOpen = useCallback(() => {
    if (configPanelAutoOpenTimeoutRef.current) {
      clearTimeout(configPanelAutoOpenTimeoutRef.current);
      configPanelAutoOpenTimeoutRef.current = null;
    }
  }, []);

  const scheduleConfigPanelAutoOpen = useCallback(() => {
    if (isConfigPanelPinned || isConfigPanelOpen) return;
    if (configPanelAutoOpenTimeoutRef.current) return;

    configPanelAutoOpenTimeoutRef.current = setTimeout(() => {
      setConfigPanelOpenPreservingPage(true);
      configPanelAutoOpenTimeoutRef.current = null;
    }, CONFIG_PANEL_AUTO_OPEN_DELAY_MS);
  }, [isConfigPanelPinned, isConfigPanelOpen, setConfigPanelOpenPreservingPage]);

  useEffect(() => {
    const target = mainContentRef.current;
    if (!target) return;

    const updateWidth = () => {
      const nextWidth = Math.floor(target.clientWidth || 0);
      setMainContentWidth(prev => (prev === nextWidth ? prev : nextWidth));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isConfigPanelOpen || mainContentWidth <= 0) return;
    const nextCap = Math.max(0, mainContentWidth - PAGE_LIST_ROW_HORIZONTAL_PADDING);

    setConfigPanelPageMaxWidthByGalleryMode(prev => {
      if (prev[galleryMode] === nextCap) return prev;
      return { ...prev, [galleryMode]: nextCap };
    });
  }, [isConfigPanelOpen, mainContentWidth, galleryMode]);

  const effectivePageMaxWidth = useMemo(() => {
    const galleryCap = galleryMode === 'collapsed' ? COLLAPSED_PAGE_MAX_WIDTH : undefined;
    const configPanelCap = (!isConfigPanelPinned && !isConfigPanelOpen)
      ? resolveConfigPanelCapForMode(galleryMode)
      : undefined;

    if (galleryCap && configPanelCap) return Math.min(galleryCap, configPanelCap);
    return galleryCap ?? configPanelCap;
  }, [galleryMode, isConfigPanelPinned, isConfigPanelOpen, resolveConfigPanelCapForMode]);

  useEffect(() => {
    return () => {
      if (galleryRecenterTimeoutRef.current) {
        clearTimeout(galleryRecenterTimeoutRef.current);
      }
      if (configPanelRecenterTimeoutRef.current) {
        clearTimeout(configPanelRecenterTimeoutRef.current);
      }
      if (configPanelAutoOpenTimeoutRef.current) {
        clearTimeout(configPanelAutoOpenTimeoutRef.current);
      }
    };
  }, []);


  const [photoGap, setPhotoGap] = useState(2);
  const [pageMargin, setPageMargin] = useState(0);
  const [cornerRadius, setCornerRadius] = useState(0);
  const [bookOpeningDirection, setBookOpeningDirection] = useState<BookOpeningDirection>('ltr');
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
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const [isMissingPhotosDialogOpen, setIsMissingPhotosDialogOpen] = useState(false);
  const [isLeaveManualUnsavedDialogOpen, setIsLeaveManualUnsavedDialogOpen] = useState(false);
  const [pendingBackupImport, setPendingBackupImport] = useState<PendingBackupImport | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number; label?: string } | null>(null);
  const exporterRef = useRef<AlbumExporterRef>(null);
  const backupImportInputRef = useRef<HTMLInputElement>(null);

  const handleExportConfirm = (options: ExportOptions) => {
    setExportDialogOpen(false);
    const range = options.pageRange === 'all' ? undefined : options.pageRange;
    const exportRenderOptions: ExportRenderOptions = {
      dpi: options.dpi,
      whiteMarginMm: options.whiteMarginMm,
      coverWhiteMarginMm: options.coverWhiteMarginMm,
      coverWhiteMarginsMm: options.coverWhiteMarginsMm,
    };
    if (options.format === 'pdf') {
      exporterRef.current?.exportToPdf(range, exportRenderOptions);
    } else {
      exporterRef.current?.exportAlbum(range, exportRenderOptions);
    }
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
      setBookOpeningDirection(savedConfig.bookOpeningDirection ?? 'ltr');
      setBackgroundColor(savedConfig.backgroundColor || '#ffffff');
      setBackgroundImage(savedConfig.backgroundImage);
      setMultiSelectModeLocal(savedConfig.multiSelectMode ?? false);
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
      setBookOpeningDirection('ltr');
      setBackgroundColor(liveSettings.defaultBackgroundColor);
      setIsInitialized(true);
    }
  }, [album, savedPages, savedConfig, isAlbumLoading, isNew, isInitialized, isSettingsLoaded, generateEmptyAlbum, liveSettings]);

  const handleSaveTitle = (newTitle: string) => {
    updateName(newTitle);
  };

  const handleManualSaveNow = useCallback(async () => {
    if (!hasUnsavedChanges) {
      toast({
        title: 'No changes to save',
      });
      return;
    }

    await saveNow();
    toast({
      title: 'Album saved',
      description: 'All pending changes were saved.',
    });
  }, [hasUnsavedChanges, saveNow, toast]);

  const saveAndLeaveAlbum = useCallback(async () => {
    // Keep legacy behavior for flows that explicitly save before leaving.
    if (!albumThumbnailUrl && savedPhotos && savedPhotos.length > 0) {
      const firstValidPhoto = savedPhotos.find(p => p.src && p.src.length > 0);
      if (firstValidPhoto) {
        updateThumbnail(firstValidPhoto.src);
      }
    }

    await saveNow();
    router.push('/dashboard');
  }, [albumThumbnailUrl, savedPhotos, saveNow, router, updateThumbnail]);

  const handleBack = useCallback(async () => {
    if (isManualSaveMode) {
      if (hasUnsavedChanges) {
        setIsLeaveManualUnsavedDialogOpen(true);
        return;
      }

      router.push('/dashboard');
      return;
    }

    await saveAndLeaveAlbum();
  }, [hasUnsavedChanges, isManualSaveMode, router, saveAndLeaveAlbum]);

  const handleLeaveWithoutSaving = useCallback(() => {
    setIsLeaveManualUnsavedDialogOpen(false);
    router.push('/dashboard');
  }, [router]);

  const handleSaveAndLeaveFromDialog = useCallback(async () => {
    setIsLeaveManualUnsavedDialogOpen(false);
    await saveAndLeaveAlbum();
  }, [saveAndLeaveAlbum]);


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
      config.bookOpeningDirection !== (savedConfig.bookOpeningDirection ?? 'ltr') ||
      config.backgroundColor !== savedConfig.backgroundColor ||
      config.backgroundImage !== savedConfig.backgroundImage ||
      watchedSize !== savedConfig.size;

    if (!isConfigChanged) {
      logger.debug('Skipping auto-save: Config matches server hydration');
      return;
    }

    logger.debug('Auto-saving config...');
    updateConfig(config);
  }, [photoGap, pageMargin, cornerRadius, bookOpeningDirection, backgroundColor, backgroundImage, watchedSize, isInitialized, isAlbumLoading, isNew, album, savedConfig]);


  const config: AlbumConfig = useMemo(() => ({
    size: watchedSize as '20x20',
    photoGap,
    pageMargin,
    bookOpeningDirection,
    backgroundColor,
    backgroundImage,
    cornerRadius,
  }), [watchedSize, photoGap, pageMargin, bookOpeningDirection, backgroundColor, backgroundImage, cornerRadius]);

  const hasLockedPages = useMemo(() => albumPages.some(page => !!page.isLocked), [albumPages]);

  const lockEligiblePageIds = useMemo(() => {
    return albumPages
      .filter((page) =>
        page.photos.some((photo) => {
          const source = (photo.remoteUrl || photo.src || '').trim();
          return source.length > 0;
        })
      )
      .map((page) => page.id);
  }, [albumPages]);

  const areAllLockEligiblePagesLocked = useMemo(() => {
    if (lockEligiblePageIds.length === 0) return false;
    const eligibleSet = new Set(lockEligiblePageIds);
    return albumPages
      .filter((page) => eligibleSet.has(page.id))
      .every((page) => !!page.isLocked);
  }, [albumPages, lockEligiblePageIds]);

  const handleToggleLockPagesWithPhotos = useCallback(() => {
    if (albumPages.length === 0) {
      toast({
        title: 'No pages found',
        description: 'The album has no pages yet.',
        variant: 'destructive',
      });
      return;
    }

    if (lockEligiblePageIds.length === 0) {
      toast({
        title: 'No filled pages found',
        description: 'Only pages with at least one photo can be locked.',
      });
      return;
    }

    const eligibleSet = new Set(lockEligiblePageIds);
    const shouldLock = !areAllLockEligiblePagesLocked;
    let changedCount = 0;

    const nextPages = albumPages.map((page) => {
      if (!eligibleSet.has(page.id)) return page;
      const currentLocked = !!page.isLocked;
      if (currentLocked === shouldLock) return page;
      changedCount += 1;
      return { ...page, isLocked: shouldLock };
    });

    if (changedCount === 0) {
      toast({
        title: shouldLock ? 'Nothing to lock' : 'Nothing to unlock',
        description: shouldLock
          ? `All ${lockEligiblePageIds.length} page(s) with photos are already locked.`
          : `All ${lockEligiblePageIds.length} eligible page(s) are already unlocked.`,
      });
      return;
    }

    setAlbumPages(nextPages);
    toast({
      title: shouldLock ? 'Pages locked' : 'Pages unlocked',
      description: shouldLock
        ? `${changedCount} page(s) with photos were locked.`
        : `${changedCount} page(s) with photos were unlocked.`,
    });
  }, [albumPages, areAllLockEligiblePagesLocked, lockEligiblePageIds, toast]);

  const handleExportBackup = useCallback(() => {
    if (albumPages.length === 0) {
      toast({
        title: 'No pages to back up',
        description: 'Generate or load album pages before creating a backup.',
        variant: 'destructive',
      });
      return;
    }

    const payload = buildAlbumBackupPayload({
      albumId,
      albumName,
      config,
      pages: albumPages,
    });

    const safeName = (albumName || 'album')
      .trim()
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'album';
    const dateStamp = new Date().toISOString().slice(0, 10);
    const backupBlob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });

    const objectUrl = URL.createObjectURL(backupBlob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `${safeName}-album-backup-${dateStamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);

    toast({
      title: 'Backup downloaded',
      description: `Saved ${payload.requiredPhotos.length} required photo reference(s) with album layout.`,
    });
  }, [albumId, albumName, config, albumPages, toast]);

  const handleRequestImportBackup = useCallback(() => {
    if (allPhotos.length === 0) {
      toast({
        title: 'Upload photos first',
        description: 'Restore requires gallery photos to be uploaded before importing backup JSON.',
        variant: 'destructive',
      });
      return;
    }
    backupImportInputRef.current?.click();
  }, [allPhotos.length, toast]);

  const applyImportedBackupConfig = useCallback((importedConfig: Partial<AlbumConfig>) => {
    if (!importedConfig || typeof importedConfig !== 'object') return;

    if (importedConfig.size === '20x20' || importedConfig.size === '25x25' || importedConfig.size === '30x30') {
      form.setValue('size', importedConfig.size);
    }
    if (typeof importedConfig.photoGap === 'number') {
      setPhotoGap(importedConfig.photoGap);
    }
    if (typeof importedConfig.pageMargin === 'number') {
      setPageMargin(importedConfig.pageMargin);
    }
    if (typeof importedConfig.cornerRadius === 'number') {
      setCornerRadius(importedConfig.cornerRadius);
    }
    if (importedConfig.bookOpeningDirection === 'ltr' || importedConfig.bookOpeningDirection === 'rtl') {
      setBookOpeningDirection(importedConfig.bookOpeningDirection);
    }
    if (typeof importedConfig.backgroundColor === 'string' && importedConfig.backgroundColor.trim()) {
      setBackgroundColor(importedConfig.backgroundColor);
    }
    setBackgroundImage(typeof importedConfig.backgroundImage === 'string' && importedConfig.backgroundImage.trim()
      ? importedConfig.backgroundImage
      : undefined);
    if (typeof importedConfig.multiSelectMode === 'boolean') {
      setMultiSelectModeLocal(importedConfig.multiSelectMode);
    }
  }, [form]);

  const applyImportedBackupPayload = useCallback((backupPayload: AlbumBackupPayload) => {
    const hydrated = hydratePagesFromBackup(backupPayload.album.pages, allPhotos, {
      clearMissingPhotos: true,
    });

    applyImportedBackupConfig(backupPayload.album.config || {});
    setAlbumPages(hydrated.pages);

    const importedName = backupPayload.album.name?.trim();
    if (importedName && importedName !== albumName) {
      updateName(importedName);
    }

    if (hydrated.missingRefs.length > 0) {
      toast({
        title: 'Backup restored with missing photos',
        description: `${hydrated.missingRefs.length} slot reference(s) were missing and left empty.`,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Backup restored',
        description: `Loaded ${hydrated.resolvedCount} photo slot(s) from backup.`,
      });
    }
  }, [albumName, allPhotos, applyImportedBackupConfig, toast, updateName]);

  const handleConfirmImportWithMissing = useCallback(() => {
    const pendingImport = pendingBackupImport;
    if (!pendingImport) return;

    setPendingBackupImport(null);
    setIsMissingPhotosDialogOpen(false);
    applyImportedBackupPayload(pendingImport.backupPayload);
  }, [applyImportedBackupPayload, pendingBackupImport]);

  const handleCancelImportWithMissing = useCallback(() => {
    setPendingBackupImport(null);
    setIsMissingPhotosDialogOpen(false);
    toast({
      title: 'Restore canceled',
      description: 'Import canceled until all required photos are in the gallery.',
    });
  }, [toast]);

  const handleMissingDialogOpenChange = useCallback((open: boolean) => {
    setIsMissingPhotosDialogOpen(open);
    if (!open) {
      setPendingBackupImport(null);
    }
  }, []);

  const handleImportBackupFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';
    if (!selectedFile) return;

    setIsImportingBackup(true);

    try {
      const rawText = await selectedFile.text();

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawText);
      } catch {
        throw new Error('Backup file is not valid JSON.');
      }

      const backupPayload = parseAlbumBackupPayload(parsedJson);
      const requiredRefs = backupPayload.requiredPhotos || [];
      const missingRefs = getMissingBackupPhotoRefs(requiredRefs, allPhotos);

      if (missingRefs.length > 0) {
        setPendingBackupImport({
          backupPayload,
          missingRefs,
          requiredCount: requiredRefs.length,
        });
        setIsMissingPhotosDialogOpen(true);
        toast({
          title: 'Missing photos detected',
          description: `${missingRefs.length} required photo(s) are missing from your gallery.`,
          variant: 'destructive',
        });
        return;
      }

      applyImportedBackupPayload(backupPayload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import backup file.';
      toast({
        title: 'Backup restore failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsImportingBackup(false);
    }
  }, [allPhotos, applyImportedBackupPayload, toast]);


  // Page Manipulation Hook (Moved up)


  // Process uploaded photo files (from folder or individual selection)
  // Generate album from existing photos (sorted by capture date)
  const handleGenerateAlbum = useCallback(() => {
    if (hasLockedPages) {
      toast({
        title: 'Locked pages detected',
        description: 'Unlock pages before regenerating the album.',
        variant: 'destructive'
      });
      return;
    }

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
      const dateA = a.captureDate ? new Date(a.captureDate).getTime() : null;
      const dateB = b.captureDate ? new Date(b.captureDate).getTime() : null;

      // 1. Primary Sort: Presence of date (Defined dates always come first)
      if (dateA !== null && dateB === null) return -1;
      if (dateA === null && dateB !== null) return 1;

      // 2. Both have dates: Sort ASC
      if (dateA !== null && dateB !== null) {
        if (dateA !== dateB) return dateA - dateB;
      }

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
  }, [allPhotos, generateInitialPages, hasLockedPages, toast]);

  const handleAutoFillAlbum = useCallback(() => {
    if (hasLockedPages) {
      toast({
        title: 'Locked pages detected',
        description: 'Unlock pages before auto-filling the album.',
        variant: 'destructive'
      });
      return;
    }

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
      const dateA = a.captureDate ? new Date(a.captureDate).getTime() : null;
      const dateB = b.captureDate ? new Date(b.captureDate).getTime() : null;

      // 1. Primary Sort: Presence of date (Defined dates always come first)
      if (dateA !== null && dateB === null) return -1;
      if (dateA === null && dateB !== null) return 1;

      // 2. Both have dates: Sort ASC
      if (dateA !== null && dateB !== null) {
        if (dateA !== dateB) return dateA - dateB;
      }

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
  }, [allPhotos, albumPages, autoFillAlbum, hasLockedPages, toast]);

  const handleResetAlbum = useCallback(() => {
    if (hasLockedPages) {
      toast({
        title: 'Locked pages detected',
        description: 'Unlock pages before resetting the album.',
        variant: 'destructive'
      });
      return;
    }

    generateEmptyAlbum();
    toast({
      title: 'Album Reset',
      description: 'Album has been reset to empty state.',
    });
  }, [generateEmptyAlbum, hasLockedPages, toast]);

  const handleDownloadPage = useCallback(async (pageId: string, options?: ExportRenderOptions) => {
    const dpi = options?.dpi ?? 300;
    toast({ title: `Downloading page (${dpi} DPI)...` });
    await exporterRef.current?.exportPage(pageId, { dpi });
  }, [toast]);




  return (
    <AlbumEditorProvider>
      <div className="flex flex-col h-screen bg-background text-foreground">
        {/* Global Top Toolbar */}
        <AlbumEditorToolbar
          albumName={albumName}
          onUpdateName={handleSaveTitle}
          saveStatus={isLoadingPhotos ? 'uploading' : isSaving ? 'saving' : hasUnsavedChanges ? 'unsaved' : 'saved'}
          onBack={() => {
            void handleBack();
          }}
          onOpenBookView={() => setIsBookViewOpen(true)}
          onOpenCustomLayout={() => setIsCustomLayoutEditorOpen(true)}
          onExportBackup={handleExportBackup}
          onImportBackup={handleRequestImportBackup}
          isImportingBackup={isImportingBackup}
          showManualSaveButton={isManualSaveMode}
          onSaveNow={handleManualSaveNow}
          disableManualSaveButton={isSaving || isLoadingPhotos || !hasUnsavedChanges}
          onExport={() => setExportDialogOpen(true)}
          isExporting={isExporting}
          onShare={() => toast({ title: "Sharing Album..." })}
        />
        <input
          ref={backupImportInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleImportBackupFile}
        />
        <AlertDialog
          open={isLeaveManualUnsavedDialogOpen}
          onOpenChange={setIsLeaveManualUnsavedDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
              <AlertDialogDescription>
                You have unsaved changes. Continue without saving, or save and continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSaving}>Stay</AlertDialogCancel>
              <Button
                type="button"
                variant="destructive"
                onClick={handleLeaveWithoutSaving}
                disabled={isSaving}
              >
                Continue without saving
              </Button>
              <Button
                type="button"
                onClick={() => {
                  void handleSaveAndLeaveFromDialog();
                }}
                disabled={isSaving || isLoadingPhotos}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save and continue
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={isMissingPhotosDialogOpen} onOpenChange={handleMissingDialogOpenChange}>
          <AlertDialogContent className="sm:max-w-2xl border border-destructive/30 bg-background/95 backdrop-blur-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-left justify-start">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <span>Missing Photos In Gallery</span>
              </AlertDialogTitle>
              <AlertDialogDescription>
                <div className="space-y-3 text-left">
                  <p>
                    The backup file requires <strong>{pendingBackupImport?.requiredCount ?? 0}</strong> photo(s).
                    Missing right now: <strong>{pendingBackupImport?.missingRefs.length ?? 0}</strong>.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-start">
                    <Badge variant="secondary" className="gap-1">
                      <ImageOff className="h-3.5 w-3.5" />
                      Missing: {pendingBackupImport?.missingRefs.length ?? 0}
                    </Badge>
                    <Badge variant="outline">
                      Required: {pendingBackupImport?.requiredCount ?? 0}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    If you continue, the album will load and missing photo slots will stay empty.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            {pendingBackupImport && (
              <ScrollArea className="max-h-64 rounded-md border bg-muted/30 p-3">
                <ul className="space-y-1 text-sm text-left">
                  {pendingBackupImport.missingRefs.slice(0, 200).map((ref, index) => (
                    <li key={`${ref.key}-${index}`}>
                      {index + 1}. {describeBackupPhotoRef(ref)}
                    </li>
                  ))}
                </ul>
                {pendingBackupImport.missingRefs.length > 200 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    ...and {pendingBackupImport.missingRefs.length - 200} more.
                  </p>
                )}
              </ScrollArea>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleCancelImportWithMissing}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmImportWithMissing} className="bg-primary text-primary-foreground hover:bg-primary/90">
                Continue Import
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlbumExporter
          ref={exporterRef}
          pages={albumPages}
          config={config}
          albumName={albumName}
          extraTemplates={customTemplates}
          onExportStart={() => {
            setIsExporting(true);
            setExportProgress(null);
          }}
          onExportProgress={(current, total) => {
            setExportProgress({ current, total, label: `Exporting page ${current} of ${total}...` });
          }}
          onExportComplete={() => {
            setIsExporting(false);
            setExportProgress(null);
            toast({ title: "Export Complete", description: "Your download should start shortly." });
          }}
          onExportError={(err) => {
            setIsExporting(false);
            setExportProgress(null);
            toast({ title: "Export Failed", description: "Something went wrong.", variant: "destructive" });
          }}
        />

        <ExportDialog
          open={exportDialogOpen || isExporting}
          onOpenChange={setExportDialogOpen}
          totalPages={albumPages.length}
          onConfirm={handleExportConfirm}
          isExporting={isExporting}
          exportProgress={exportProgress}
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
          <div
            style={{ width: `${isConfigPanelOpen ? CONFIG_PANEL_WIDTH : 0}px` }}
            className="shrink-0 transition-[width] duration-300 ease-in-out overflow-hidden will-change-[width]"
            onMouseLeave={() => {
              if (!isConfigPanelPinned) {
                setConfigPanelOpenPreservingPage(false);
              }
            }}
          >
            {/* Rigid container to prevent layout thrashing during transition */}
            <div
              className={cn(
                "h-full w-[300px] min-w-full overflow-y-auto border-r bg-background z-10 transition-transform duration-300 ease-in-out will-change-transform",
                isConfigPanelOpen ? "translate-x-0" : "-translate-x-full"
              )}
            >
              {isClient && isInitialized ? (
                <AlbumConfigCard
                  form={form}
                  photoGap={photoGap}
                  setPhotoGap={setPhotoGap}
                  pageMargin={pageMargin}
                  setPageMargin={setPageMargin}
                  cornerRadius={cornerRadius}
                  setCornerRadius={setCornerRadius}
                  bookOpeningDirection={bookOpeningDirection}
                  setBookOpeningDirection={setBookOpeningDirection}
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
                  isPinned={isConfigPanelPinned}
                  onTogglePinned={handleToggleConfigPanelPinned}
                />
              ) : (
                <div className="space-y-4">
                  <Skeleton className="h-[300px] w-full rounded-xl" />
                  <Skeleton className="h-[100px] w-full rounded-xl" />
                </div>
              )}
            </div>
          </div>

          {/* Config Control Strip (visible only when unpinned) */}
          {!isConfigPanelPinned && (
            <div
              className="w-[1px] shrink-0 bg-border z-20 flex flex-col items-center justify-center relative overflow-visible"
              onMouseEnter={scheduleConfigPanelAutoOpen}
              onMouseLeave={cancelConfigPanelAutoOpen}
            >
              {!isConfigPanelOpen && (
                <div
                  className="absolute top-0 left-0 h-full w-6"
                  onMouseEnter={scheduleConfigPanelAutoOpen}
                  onMouseLeave={cancelConfigPanelAutoOpen}
                />
              )}
              <div className="absolute top-8 -translate-y-1/2 flex flex-col gap-1 -left-2 -translate-x-[50%] z-30">
                {isConfigPanelOpen ? (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-10 w-4 rounded-r-md rounded-l-none border shadow-md bg-background translate-x-full"
                    onClick={() => setConfigPanelOpenPreservingPage(false)}
                    title="Collapse Album Config"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-10 w-4 rounded-r-md rounded-l-none border shadow-md bg-background translate-x-full"
                    onClick={() => setConfigPanelOpenPreservingPage(true)}
                    title="Open Album Config"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Main Content: Album Preview */}
          <div ref={mainContentRef} className="flex-1 min-w-0 pr-6 h-full flex flex-col" style={{ colorScheme: 'light' }}>
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
                pageMaxWidth={effectivePageMaxWidth}
                onDeletePage={deletePage}
                onAddSpread={addSpreadPage}
                onMovePage={movePage}
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
                onEnhancePhotoWithAi={handleOpenPhotoEnhancer}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onToggleLock={handleTogglePageLock}
                customTemplates={customTemplates}
                onCreateCustomTemplate={handleAddCustomTemplate}
                defaultViewMode={settings.defaultEditorViewMode as "single" | "spread"}
                visibleTemplateCategories={settings.visibleTemplateCategories}
                allowedTemplateIds={settings.allowedTemplateIds || []}
                chronologicalIndex={chronologicalIndex}
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
                  onClick={() => setGalleryModePreservingPage('default')}
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
                    onClick={() => setGalleryModePreservingPage('expanded')}
                    title="Maximize Width"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary" size="icon"
                    className="h-8 w-4 rounded-l-md rounded-r-none border shadow-sm bg-background"
                    onClick={() => setGalleryModePreservingPage('collapsed')}
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
                  onClick={() => setGalleryModePreservingPage('default')}
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
                handleLockFilledPages={handleToggleLockPagesWithPhotos}
                areLockEligiblePagesLocked={areAllLockEligiblePagesLocked}
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
        </div>
        <AiPhotoEnhancerSheet
          open={isEnhancerOpen}
          onOpenChange={handleEnhancerOpenChange}
          sourcePhoto={enhanceTarget?.photo || null}
          sourceImageUrl={enhanceTarget?.sourceImageUrl || null}
          onApprove={handleApproveEnhancedPhoto}
        />
        {isBookViewOpen && (
          <BookViewOverlay
            pages={albumPages}
            config={config}
            extraTemplates={customTemplates}
            onClose={() => setIsBookViewOpen(false)}
            onUpdatePage={(_pageId, updatedPage) => handleUpdatePage(updatedPage)}
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

