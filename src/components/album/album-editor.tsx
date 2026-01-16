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
import { ModeToggle } from '@/components/mode-toggle';
import { ScrollToTopButton, AlbumConfigCard, PhotoGalleryCard, AlbumEditorToolbar } from './editor-components';

// Parse layout ID to extract base template and rotation
function parseLayoutId(layoutId: string): { baseId: string; rotation: number } {
  const rotationMatch = layoutId.match(/_r(90|180|270)$/);
  if (rotationMatch) {
    const rotation = parseInt(rotationMatch[1]);
    const baseId = layoutId.replace(/_r(90|180|270)$/, '');
    return { baseId, rotation };
  }
  return { baseId: layoutId, rotation: 0 };
}

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
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
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

  // Photo Upload Refs
  const folderUploadRef = useRef<HTMLInputElement>(null);
  const photoUploadRef = useRef<HTMLInputElement>(null);

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const exporterRef = useRef<AlbumExporterRef>(null);
  const photoScrollRef = useRef<HTMLDivElement>(null);

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





  const deletePage = (pageId: string) => {
    setAlbumPages(prev => prev.filter(p => p.id !== pageId));
    toast({
      title: "Page Deleted",
      variant: "destructive"
    })
  }

  // Add a new spread page at a specific index
  const addSpreadPage = (afterIndex: number) => {
    // Create 4 separate empty photo objects, each with its own unique ID
    const createEmptyPhoto = () => ({
      id: uuidv4(),
      src: '',
      alt: 'Drop photo here',
      panAndZoom: { scale: 1, x: 50, y: 50 }
    });

    const newSpread: AlbumPage = {
      id: uuidv4(),
      type: 'spread',
      photos: [createEmptyPhoto(), createEmptyPhoto(), createEmptyPhoto(), createEmptyPhoto()],
      layout: '4-grid'
    };

    setAlbumPages(prev => {
      const newPages = [...prev];
      newPages.splice(afterIndex + 1, 0, newSpread);
      return newPages;
    });

    toast({
      title: "Spread Added",
      description: "A new double-page spread has been added."
    });
  }

  // Simple layout change - only affects the specific page
  // If new layout needs more photos than available, create empty slots
  // If it needs fewer photos, keep what fits
  // Don't redistribute photos to other pages
  const updatePageLayout = (pageId: string, newLayoutId: string) => {
    setAlbumPages(prevPages => {
      return prevPages.map(page => {
        if (page.id !== pageId) return page;

        // Parse the layout ID to get the base template ID (without rotation suffix)
        const { baseId } = parseLayoutId(newLayoutId);
        const newTemplate = LAYOUT_TEMPLATES.find(t => t.id === baseId) || ADVANCED_TEMPLATES.find(t => t.id === baseId);
        if (!newTemplate) return page;

        const newPhotoCount = newTemplate.photoCount;
        const currentPhotos = [...page.photos];
        const defaultPanAndZoom = { scale: 1, x: 50, y: 50 };

        // If we need more photos than we have, create empty slots
        if (currentPhotos.length < newPhotoCount) {
          const emptySlotCount = newPhotoCount - currentPhotos.length;
          for (let i = 0; i < emptySlotCount; i++) {
            currentPhotos.push({
              id: uuidv4(),
              src: '',
              alt: 'Drop photo here',
              panAndZoom: defaultPanAndZoom
            });
          }
        }

        // Only keep photos that fit in the new layout
        // (Extra photos are kept in the array but won't be rendered)
        return {
          ...page,
          layout: newLayoutId,
          photos: currentPhotos
        };
      });
    });
  };

  const handleRemovePhoto = (pageId: string, photoId: string) => {
    setAlbumPages(prevPages => {
      return prevPages.map(page => {
        if (page.id !== pageId) return page;

        // Reset the photo to an empty state
        const newPhotos = page.photos.map(photo => {
          if (photo.id === photoId) {
            return {
              id: uuidv4(),
              src: '',
              alt: 'Drop photo here',
              width: 600,
              height: 400,
              panAndZoom: { scale: 1, x: 50, y: 50 }
            };
          }
          return photo;
        });

        return {
          ...page,
          photos: newPhotos
        };
      });
    });

    toast({
      title: "Photo Removed",
      description: "The photo has been removed from the frame."
    });
  };

  const handleUpdateCoverLayout = (pageId: string, side: 'front' | 'back' | 'full', newLayout: string) => {
    setAlbumPages(prevPages => {
      return prevPages.map(page => {
        if (page.id !== pageId || !page.isCover) return page;

        if (side === 'full') {
          const { baseId: baseLayoutId } = parseLayoutId(newLayout);
          const template = COVER_TEMPLATES.find(t => t.id === baseLayoutId) || ADVANCED_TEMPLATES.find(t => t.id === baseLayoutId) || COVER_TEMPLATES[0];
          const requiredPhotos = template.photoCount;
          let currentPhotos = [...page.photos];

          if (currentPhotos.length < requiredPhotos) {
            const missingCount = requiredPhotos - currentPhotos.length;
            for (let i = 0; i < missingCount; i++) {
              currentPhotos.push({
                id: uuidv4(),
                src: '',
                alt: 'Drop photo here',
                width: 600,
                height: 400
              });
            }
          }

          return {
            ...page,
            layout: newLayout,
            photos: currentPhotos
          };
        }

        const currentFrontLayout = page.coverLayouts?.front || '1-full';
        const currentBackLayout = page.coverLayouts?.back || '1-full';

        const frontLayout = side === 'front' ? newLayout : currentFrontLayout;
        const backLayout = side === 'back' ? newLayout : currentBackLayout;

        const { baseId: frontBaseId } = parseLayoutId(frontLayout);
        const { baseId: backBaseId } = parseLayoutId(backLayout);
        const frontTemplate = COVER_TEMPLATES.find(t => t.id === frontBaseId) || COVER_TEMPLATES[0];
        const backTemplate = COVER_TEMPLATES.find(t => t.id === backBaseId) || COVER_TEMPLATES[0];

        const requiredBackPhotos = backTemplate.photoCount;
        const requiredFrontPhotos = frontTemplate.photoCount;
        const totalRequired = requiredBackPhotos + requiredFrontPhotos;

        let currentPhotos = [...page.photos];

        // If 'back' (Left) layout changed size, we might need to shift front photos?
        // Cover logic originally just appended to end.
        // But for correctness (if changing Back layout requires MORE photos), we should probably insert them
        // However, 'Cover' usually treats Front/Back somewhat independently in data but shared in array.
        // Let's implement the smarter array splicing for both Spread and Cover if we want consistency,
        // but user said "DON'T TOUCH COVER". So leaving Cover logic AS IS (append only).

        // If we have fewer photos than required, add placeholders
        if (currentPhotos.length < totalRequired) {
          const missingCount = totalRequired - currentPhotos.length;
          for (let i = 0; i < missingCount; i++) {
            currentPhotos.push({
              id: uuidv4(),
              src: '',
              alt: 'Drop photo here',
              width: 600,
              height: 400
            });
          }
        }

        return {
          ...page,
          photos: currentPhotos,
          coverLayouts: {
            front: frontLayout,
            back: backLayout
          }
        };
      });
    });
  };

  const handleUpdateSpreadLayout = (pageId: string, side: 'left' | 'right', newLayout: string) => {
    setAlbumPages(prevPages => {
      return prevPages.map(page => {
        if (page.id !== pageId || page.isCover) return page; // Only regular spreads

        const currentLeftLayout = page.spreadLayouts?.left || LAYOUT_TEMPLATES[0].id;
        const currentRightLayout = page.spreadLayouts?.right || LAYOUT_TEMPLATES[0].id;

        const leftLayout = side === 'left' ? newLayout : currentLeftLayout;
        const rightLayout = side === 'right' ? newLayout : currentRightLayout;

        const { baseId: leftBaseId } = parseLayoutId(leftLayout);
        const { baseId: rightBaseId } = parseLayoutId(rightLayout);
        const leftTemplate = LAYOUT_TEMPLATES.find(t => t.id === leftBaseId) || ADVANCED_TEMPLATES.find(t => t.id === leftBaseId) || LAYOUT_TEMPLATES[0];
        const rightTemplate = LAYOUT_TEMPLATES.find(t => t.id === rightBaseId) || ADVANCED_TEMPLATES.find(t => t.id === rightBaseId) || LAYOUT_TEMPLATES[0];

        // We need to know how many photos the OLD left layout took, to find the insertion point
        const { baseId: oldLeftBaseId } = parseLayoutId(currentLeftLayout);
        const oldLeftTemplate = LAYOUT_TEMPLATES.find(t => t.id === oldLeftBaseId) || ADVANCED_TEMPLATES.find(t => t.id === oldLeftBaseId) || LAYOUT_TEMPLATES[0];
        const oldLeftCount = oldLeftTemplate.photoCount;

        const newLeftCount = leftTemplate.photoCount;
        const newRightCount = rightTemplate.photoCount;

        let currentPhotos = [...page.photos];

        if (side === 'left') {
          // If Left count changed, we must insert/remove photos at the junction
          const diff = newLeftCount - oldLeftCount;

          if (diff > 0) {
            // Need to insert 'diff' empty slots at index 'oldLeftCount'
            const newSlots = Array(diff).fill(null).map(() => ({
              id: uuidv4(),
              src: '',
              alt: 'Drop photo here',
              width: 600,
              height: 400,
              panAndZoom: { scale: 1, x: 50, y: 50 }
            }));
            currentPhotos.splice(oldLeftCount, 0, ...newSlots);
          } else if (diff < 0) {
            // Need to remove 'Math.abs(diff)' slots starting from 'newLeftCount'
            // Removing from the END of the Left section (keeping the first N)
            // Wait, splice(start, deleteCount).
            // We want to keep 0..(newLeftCount-1).
            // So we delete starting at newLeftCount.
            currentPhotos.splice(newLeftCount, Math.abs(diff));
          }
        } else {
          // If Right count changed, we just append/trim from the END of the array
          // But wait, the array might have surplus items if we just shrink.
          // The total required is Left + Right.
          // But existing photos might be > required?
          // Let's just ensure we have *enough* for the new Right layout.
          const totalRequired = newLeftCount + newRightCount;
          if (currentPhotos.length < totalRequired) {
            const missing = totalRequired - currentPhotos.length;
            const newSlots = Array(missing).fill(null).map(() => ({
              id: uuidv4(),
              src: '',
              alt: 'Drop photo here',
              width: 600,
              height: 400,
              panAndZoom: { scale: 1, x: 50, y: 50 }
            }));
            currentPhotos.push(...newSlots);
          }
          // Optionally trim if too many? For safety, maybe bad to auto-delete user data if they switch layout back and forth.
          // But for 'Split' mode logic, if we switch right 4->1, we probably want to hide/remove them?
          // Consistency: Editor usually trims.
          // Let's trim excess from the end if right changed.
          /*
          if (currentPhotos.length > totalRequired) {
             currentPhotos = currentPhotos.slice(0, totalRequired);
          }
          */
        }

        return {
          ...page,
          photos: currentPhotos,
          spreadLayouts: {
            left: leftLayout,
            right: rightLayout
          }
        };
      });
    });
  };

  const handleUpdateCoverType = (pageId: string, newType: 'split' | 'full') => {
    setAlbumPages(prevPages => prevPages.map(page => {
      if (page.id !== pageId) return page;
      // If switching to full, we might want to ensure a full spread layout is set?
      // For now just toggle the type. AlbumPreview will handle rendering differences.
      // Maybe we want to consolidate photos?
      // If switching from split to full: we have Front + Back photos. We merge them?
      // If switching from full to split: we split them?
      // For simplicity, let's keep the photos list as is. The layout logic (split vs full) will decide how to use them.
      // Wait, independent Front/Back layouts assume photos are partitioned?
      // Actually PageLayout uses `photos.slice(...)`. 
      // So if 'full' mode uses a "Spread Template", it will just use the first N photos.
      // This is fine.
      return { ...page, coverType: newType };
    }));
  };

  const handleUpdateSpineText = (pageId: string, text: string) => {
    setAlbumPages(prevPages => prevPages.map(page => {
      if (page.id !== pageId) return page;
      return { ...page, spineText: text };
    }));
  };

  const handleUpdateSpineSettings = (pageId: string, settings: { width?: number; color?: string; textColor?: string; fontSize?: number; fontFamily?: string }) => {
    setAlbumPages(prevPages => prevPages.map(page => {
      if (page.id !== pageId) return page;
      return {
        ...page,
        spineWidth: settings.width ?? page.spineWidth,
        spineColor: settings.color ?? page.spineColor,
        spineTextColor: settings.textColor ?? page.spineTextColor,
        spineFontSize: settings.fontSize ?? page.spineFontSize,
        spineFontFamily: settings.fontFamily ?? page.spineFontFamily
      };
    }));
  };

  const handleUpdateTitleSettings = (pageId: string, settings: { text?: string; color?: string; fontSize?: number; fontFamily?: string; position?: { x: number; y: number } }) => {
    setAlbumPages(prevPages => prevPages.map(page => {
      if (page.id !== pageId) return page;
      return {
        ...page,
        titleText: settings.text !== undefined ? settings.text : page.titleText,
        titleColor: settings.color ?? page.titleColor,
        titleFontSize: settings.fontSize ?? page.titleFontSize,
        titleFontFamily: settings.fontFamily ?? page.titleFontFamily,
        titlePosition: settings.position ?? page.titlePosition
      };
    }));
  };

  const handleUpdatePage = (updatedPage: AlbumPage) => {
    setAlbumPages(prevPages => prevPages.map(page =>
      page.id === updatedPage.id ? updatedPage : page
    ));
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

  const handleDropPhoto = useCallback((pageId: string, targetPhotoId: string, droppedPhotoId: string) => {
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

      // Handle Insertion into Empty Slot
      if (targetPhotoId.startsWith('__INSERT_AT__')) {
        const index = parseInt(targetPhotoId.replace('__INSERT_AT__', ''), 10);
        if (isNaN(index)) return page;

        const newPhotos = [...page.photos];
        const newPhotoObj = {
          ...droppedPhoto,
          id: uuidv4(), // Generate a new ID for this specific usage instance
          originalId: droppedPhoto.id, // Store original gallery ID for usage tracking
          panAndZoom: { scale: 1, x: 50, y: 50 },
          width: droppedPhoto.width || 800,
          height: droppedPhoto.height || 600
        };

        // Ensure array is filled up to index
        while (newPhotos.length < index) {
          newPhotos.push({
            id: uuidv4(),
            src: '',
            alt: 'Drop photo here',
            width: 600,
            height: 400
          });
        }

        newPhotos[index] = newPhotoObj;

        return {
          ...page,
          photos: newPhotos
        };
      }

      // Existing Replacement Logic
      return {
        ...page,
        photos: page.photos.map(p => {
          if (p.id === targetPhotoId) {
            return {
              ...droppedPhoto,
              id: targetPhotoId, // Keep the existing unique ID of the slot!
              originalId: droppedPhoto.id, // Reference original gallery photo
              panAndZoom: { scale: 1, x: 50, y: 50 },
              width: droppedPhoto.width || 800,
              height: droppedPhoto.height || 600
            };
          }
          return p;
        })
      };
    }));
  }, [allPhotos, allowDuplicates, usedPhotoIds]);


  // Process uploaded photo files (from folder or individual selection)
  // Photo Upload Hook
  // Photo Upload Hook
  const { uploadPhotos, uploadPhoto, isUploading: isUploadingHook } = usePhotoUpload();

  const handleSortPhotos = useCallback(() => {
    setAllPhotos(prev => {
      const sorted = [...prev].sort((a, b) => {
        const dateA = a.captureDate ? new Date(a.captureDate).getTime() : 0;
        const dateB = b.captureDate ? new Date(b.captureDate).getTime() : 0;
        return dateA - dateB;
      });
      return sorted;
    });
    toast({
      title: 'Photos Sorted',
      description: 'Gallery sorted by capture date.',
    });
  }, [toast]);

  // Process uploaded photo files (from folder or individual selection)
  const processUploadedFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter(file =>
      /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name)
    );

    if (imageFiles.length === 0) {
      toast({
        title: 'No images found',
        description: 'Please select valid image files (jpg, jpeg, png, gif, webp).',
        variant: 'destructive'
      });
      return;
    }

    setIsLoadingPhotos(true);
    const newFiles = Array.from(files);

    // Add placeholders at the END of the list
    const tempPhotos: Photo[] = newFiles.map(file => ({
      id: `temp-${Math.random().toString(36).substr(2, 9)}`,
      src: URL.createObjectURL(file),
      alt: file.name,
      isUploading: true
    }));

    setAllPhotos(prev => [...prev, ...tempPhotos]);

    // Auto-scroll logic
    setTimeout(() => {
      const scrollContainer = photoScrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
      }
    }, 100);

    toast({
      title: 'Uploading Photos',
      description: `Uploading ${imageFiles.length} image(s)...`,
    });

    const tasks = newFiles.map((file, index) => ({
      file,
      tempId: tempPhotos[index].id
    }));

    let successCount = 0;
    const failedUploads: { file: string; error: any }[] = [];

    // BATCH_SIZE 2 is good for stability
    const BATCH_SIZE = 2;

    try {
      for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
        const chunk = tasks.slice(i, i + BATCH_SIZE);

        await Promise.all(chunk.map(async ({ file, tempId }) => {
          let attempts = 0;
          const maxAttempts = 3;
          let success = false;
          let lastError = 'Unknown error';

          while (attempts < maxAttempts && !success) {
            attempts++;
            // Create a dedicated AbortController for this request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s hard timeout

            try {
              // Pass signal and skipStateUpdates to avoid global state conflicts
              // @ts-ignore - signal/skipStateUpdates added to hook recently
              const result = await uploadPhoto(file, {
                signal: controller.signal,
                skipStateUpdates: true
              });

              clearTimeout(timeoutId);

              if (result.success && result.photo) {
                success = true;
                // Success: Swap temp with real immediately
                setAllPhotos(prev => prev.map(p =>
                  p.id === tempId ? { ...result.photo!, isUploading: false } : p
                ));
                successCount++;

                // Opportunistic thumbnail update
                const isPlaceholder = !albumThumbnailUrl || placeholderImages.some(p => p.imageUrl === albumThumbnailUrl);
                if (isPlaceholder && successCount === 1) {
                  updateThumbnail(result.photo.src);
                }
              } else {
                throw new Error(result.error || 'Upload failed');
              }

            } catch (e: any) {
              clearTimeout(timeoutId);
              lastError = e.name === 'AbortError' ? 'Timeout (Network Aborted)' : (e.message || String(e));

              if (attempts < maxAttempts) {
                // Wait before retry (exponential backoff: 1s, 2s)
                await new Promise(r => setTimeout(r, 1000 * attempts));
              }
            }
          }

          if (!success) {
            console.warn(`Final failure for ${file.name}:`, lastError);
            failedUploads.push({ file: file.name, error: lastError });
            // Mark as error instead of removing
            setAllPhotos(prev => prev.map(p =>
              p.id === tempId ? { ...p, isUploading: false, error: lastError } : p
            ));
          }
        }));
      }

      if (successCount > 0) {
        toast({
          title: 'Upload Complete',
          description: `${successCount} photo(s) added to gallery.`,
        });
      }

      if (failedUploads.length > 0) {
        toast({
          title: 'Upload Partially Failed',
          description: `${failedUploads.length} images failed.`,
          variant: 'destructive'
        });
      }

    } catch (error) {
      console.error('Batch process error:', error);
      toast({
        title: 'Upload Process Error',
        description: 'Critical error during upload batch.',
        variant: 'destructive'
      });
      // Safety mark all remaining
      setAllPhotos(prev => prev.map(p =>
        tempPhotos.some(tp => tp.id === p.id) && p.isUploading
          ? { ...p, isUploading: false, error: 'Process Error' }
          : p
      ));
    } finally {
      setIsLoadingPhotos(false);

      // Cleanup stuck photos
      setAllPhotos(prev => prev.map(p => {
        const isTempPhoto = tempPhotos.some(tp => tp.id === p.id);
        if (isTempPhoto && p.isUploading) {
          return { ...p, isUploading: false, error: 'Stuck (Final Cleanup)' };
        }
        return p;
      }));

      setTimeout(() => {
        tempPhotos.forEach(p => URL.revokeObjectURL(p.src));
      }, 2000);
    }
  }, [uploadPhoto, updateThumbnail, albumThumbnailUrl, placeholderImages, toast]);

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
      if (!a.captureDate && !b.captureDate) return 0;
      if (!a.captureDate) return 1;
      if (!b.captureDate) return -1;
      return a.captureDate.getTime() - b.captureDate.getTime();
    });

    generateInitialPages(sortedPhotos);
    toast({
      title: 'Album Generated',
      description: `Album created with ${sortedPhotos.length} photos sorted by date.`,
    });
  };

  // Clear all photos from gallery and delete from server (Optimized)
  const handleClearGallery = useCallback(async () => {
    // 1. Optimistic Update
    const photosToDeleteSnapshot = [...allPhotos];
    setAllPhotos([]);

    // 2. Background Deletion
    try {
      const getStoragePath = (url: string) => {
        try {
          const parts = url.split('/photos/');
          if (parts.length > 1) return decodeURIComponent(parts[1]);
          return null;
        } catch (e) { return null; }
      };

      const photosToDelete = photosToDeleteSnapshot.map(p => ({
        id: p.id,
        storage_path: getStoragePath(p.src)
      })).filter(p => p.storage_path);

      if (photosToDelete.length > 0) {
        await fetch('/api/photos/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photos: photosToDelete })
        });
      }

      toast({
        title: 'Gallery Cleared',
        description: 'All photos have been permanently deleted.',
      });
    } catch (e) {
      console.error('Failed to clear gallery (server sync)', e);
      toast({ title: 'Warning', description: 'Gallery cleared locally, but server sync may have failed.', variant: 'destructive' });
    }
  }, [allPhotos, toast]);

  const handleDeletePhotos = useCallback(async (ids: string[]) => {
    // Optimistic
    setAllPhotos(prev => prev.filter(p => !ids.includes(p.id)));

    try {
      const getStoragePath = (url: string) => {
        try {
          const parts = url.split('/photos/');
          if (parts.length > 1) return decodeURIComponent(parts[1]);
          return null;
        } catch (e) { return null; }
      };

      // Note: allPhotos inside callback might be stale if we don't depend on it, 
      // but we can trust the 'ids' passed to the function are valid.
      // However, to find storage paths we need the photo objects.
      const photosToDelete = allPhotos.filter(p => ids.includes(p.id)).map(p => ({
        id: p.id,
        storage_path: getStoragePath(p.src)
      })).filter(p => p.storage_path);

      if (photosToDelete.length > 0) {
        await fetch('/api/photos/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photos: photosToDelete })
        });
      }
      toast({
        title: 'Photos Deleted',
        description: `${ids.length} photos removed from gallery.`
      });

    } catch (e) {
      console.error("Delete failed", e);
      toast({ title: "Error", description: "Failed to delete from server", variant: "destructive" });
    }
  }, [allPhotos, toast]);



  // Reset album to empty state
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
