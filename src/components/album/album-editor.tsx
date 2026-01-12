'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Cloud,
  Loader2,
  Sparkles,
  UploadCloud,
  Wand2,
  PlusSquare,
  AlertTriangle,
  Image as ImageIcon,
  Trash2,
  BookOpen,
  Share2,
  FileText,
  FileImage,
  Pencil,
  Download,
  ArrowUp,
  Layout,
  FolderUp,
  Upload,
  Eraser,
  RotateCcw,
} from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { v4 as uuidv4 } from 'uuid';

import type { Photo, AlbumConfig, AlbumPage, PhotoPanAndZoom } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlbumPreview } from './album-preview';
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
import { cn } from '@/lib/utils';
import Image from 'next/image';

// Fix for alert import
import { Alert as AlertUI, AlertDescription as AlertDescriptionUI, AlertTitle as AlertTitleUI } from '@/components/ui/alert';
import { AiBackgroundGenerator } from './ai-background-generator';
import { AlbumExporter, AlbumExporterRef } from './album-exporter';
import { CustomLayoutEditorOverlay } from './custom-layout-editor/custom-layout-editor-overlay';

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
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [albumPages, setAlbumPages] = useState<AlbumPage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBookViewOpen, setIsBookViewOpen] = useState(false);
  const [isCustomLayoutEditorOpen, setIsCustomLayoutEditorOpen] = useState(false);
  const [isCoverEditorOpen, setIsCoverEditorOpen] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<AdvancedTemplate[]>([]);

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

  // Generate empty album structure (cover + single + spread + single)
  const generateEmptyAlbum = () => {
    const emptyPhoto = (id?: string) => ({
      id: id || uuidv4(),
      src: '',
      alt: 'Drop photo here',
      width: 600,
      height: 400,
      panAndZoom: { scale: 1, x: 50, y: 50 }
    });

    const newPages: AlbumPage[] = [
      // Cover page
      {
        id: 'cover',
        type: 'spread',
        photos: [emptyPhoto()],
        layout: '1-full',
        isCover: true,
        coverLayouts: { front: '1-full', back: '1-full' },
        coverType: 'full',
        spineText: '',
        spineWidth: 20,
        spineColor: '#ffffff',
        spineTextColor: '#000000',
        spineFontFamily: 'Tahoma'
        // Note: photoGap and pageMargin are intentionally omitted
        // so the cover uses global config values from sliders
      },
      // First single page (right side)
      {
        id: uuidv4(),
        type: 'single',
        photos: [emptyPhoto()],
        layout: '1-full'
      },
      // Double spread (empty)
      {
        id: uuidv4(),
        type: 'spread',
        photos: [emptyPhoto(), emptyPhoto()],
        layout: '2-horizontal',
        spreadMode: 'split',
        spreadLayouts: { left: '1-full', right: '1-full' }
      },
      // Last single page (left side)
      {
        id: uuidv4(),
        type: 'single',
        photos: [emptyPhoto()],
        layout: '1-full'
      }
    ];

    setAlbumPages(newPages);
  };

  // Extract EXIF date from JPEG files
  const extractExifDate = (arrayBuffer: ArrayBuffer): Date | undefined => {
    try {
      const view = new DataView(arrayBuffer);
      // Check for JPEG magic number
      if (view.getUint16(0) !== 0xFFD8) return undefined;

      let offset = 2;
      while (offset < view.byteLength - 2) {
        const marker = view.getUint16(offset);
        offset += 2;

        if (marker === 0xFFE1) { // APP1 - EXIF
          const length = view.getUint16(offset);
          offset += 2;

          // Check for "Exif\0\0"
          const exifHeader = String.fromCharCode(
            view.getUint8(offset), view.getUint8(offset + 1),
            view.getUint8(offset + 2), view.getUint8(offset + 3)
          );
          if (exifHeader !== 'Exif') return undefined;

          const tiffOffset = offset + 6;
          const littleEndian = view.getUint16(tiffOffset) === 0x4949;

          // Find IFD0
          const ifd0Offset = tiffOffset + view.getUint32(tiffOffset + 4, littleEndian);

          // Look for EXIF IFD pointer (tag 0x8769)
          const ifd0Count = view.getUint16(ifd0Offset, littleEndian);
          let exifIfdOffset = 0;

          for (let i = 0; i < ifd0Count; i++) {
            const entryOffset = ifd0Offset + 2 + i * 12;
            const tag = view.getUint16(entryOffset, littleEndian);
            if (tag === 0x8769) {
              exifIfdOffset = tiffOffset + view.getUint32(entryOffset + 8, littleEndian);
              break;
            }
          }

          if (exifIfdOffset) {
            const exifCount = view.getUint16(exifIfdOffset, littleEndian);
            for (let i = 0; i < exifCount; i++) {
              const entryOffset = exifIfdOffset + 2 + i * 12;
              const tag = view.getUint16(entryOffset, littleEndian);
              if (tag === 0x9003 || tag === 0x9004) { // DateTimeOriginal or DateTimeDigitized
                const valueOffset = tiffOffset + view.getUint32(entryOffset + 8, littleEndian);
                let dateStr = '';
                for (let j = 0; j < 19; j++) {
                  dateStr += String.fromCharCode(view.getUint8(valueOffset + j));
                }
                // Format: "YYYY:MM:DD HH:MM:SS"
                const [datePart, timePart] = dateStr.split(' ');
                const [year, month, day] = datePart.split(':').map(Number);
                const [hour, min, sec] = timePart.split(':').map(Number);
                return new Date(year, month - 1, day, hour, min, sec);
              }
            }
          }
          return undefined;
        } else if ((marker & 0xFF00) === 0xFF00) {
          // Skip other markers
          offset += view.getUint16(offset);
        } else {
          break;
        }
      }
    } catch {
      return undefined;
    }
    return undefined;
  };

  useEffect(() => {
    setIsClient(true);
    setRandomSeed(Math.random().toString(36).substring(7));
    // Initialize with empty album
    generateEmptyAlbum();
  }, []);

  const form = useForm<ConfigFormData>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      size: '20x20',
    },
  });

  const config: AlbumConfig = {
    size: form.watch('size') as '20x20',
    photoGap,
    pageMargin,
    backgroundColor,
    backgroundImage,
    cornerRadius,
  };

  const generateInitialPages = (photos: Photo[]) => {
    let photosPool = [...photos];
    const newPages: AlbumPage[] = [];
    const defaultPanAndZoom = { scale: 1, x: 50, y: 50 };

    // --- 1. Randomize Cover Configuration ---
    const coverTypes: ('full' | 'split')[] = ['full', 'split'];
    const randomCoverType = coverTypes[Math.floor(Math.random() * coverTypes.length)];

    let coverLayoutShim = { front: '4-mosaic-1', back: '4-mosaic-1' }; // Config for split
    let fullCoverLayout = '1-full'; // Config for full
    let coverPhotos: Photo[] = [];

    if (randomCoverType === 'split') {
      // Randomize Front Layout
      const frontTemplate = COVER_TEMPLATES[Math.floor(Math.random() * COVER_TEMPLATES.length)];
      // Randomize Back Layout
      const backTemplate = COVER_TEMPLATES[Math.floor(Math.random() * COVER_TEMPLATES.length)];

      coverLayoutShim = { front: frontTemplate.id, back: backTemplate.id };
      const totalCoverPhotos = frontTemplate.photoCount + backTemplate.photoCount;

      // Pick random photos for cover
      for (let i = 0; i < totalCoverPhotos; i++) {
        if (photos.length > 0) {
          const randomIndex = Math.floor(Math.random() * photos.length);
          const randomPhoto = photos[randomIndex];
          coverPhotos.push({ ...randomPhoto, id: uuidv4(), panAndZoom: defaultPanAndZoom });
        }
      }
    } else {
      // Full Mode
      const fullTemplate = COVER_TEMPLATES[Math.floor(Math.random() * COVER_TEMPLATES.length)];
      fullCoverLayout = fullTemplate.id;

      // Pick random photos for full cover
      for (let i = 0; i < fullTemplate.photoCount; i++) {
        if (photos.length > 0) {
          const randomIndex = Math.floor(Math.random() * photos.length);
          const randomPhoto = photos[randomIndex];
          coverPhotos.push({ ...randomPhoto, id: uuidv4(), panAndZoom: defaultPanAndZoom });
        }
      }
    }

    newPages.push({
      id: 'cover',
      type: 'spread',
      photos: coverPhotos,
      layout: randomCoverType === 'full' ? fullCoverLayout : 'cover', // 'cover' layout is just a placeholder for split logic usually
      isCover: true,
      coverLayouts: coverLayoutShim,
      coverType: randomCoverType,
      spineText: '',
      spineWidth: 20,
      spineColor: '#ffffff',
      spineTextColor: '#000000',
      spineFontFamily: 'Tahoma'
      // Note: photoGap and pageMargin are intentionally omitted
      // so the cover uses global config values from sliders
    });


    // --- 2. Randomize Inner Pages ---

    // Helper to get random template for N photos
    const getRandomTemplateForCount = (count: number) => {
      const matching = LAYOUT_TEMPLATES.filter(t => t.photoCount === count);
      if (matching.length === 0) return LAYOUT_TEMPLATES[0];
      return matching[Math.floor(Math.random() * matching.length)];
    };

    // Helper to get ANY random template that fits within max photos
    const getRandomTemplateMax = (maxPhotos: number) => {
      const candidates = LAYOUT_TEMPLATES.filter(t => t.photoCount <= maxPhotos);
      if (candidates.length === 0) return LAYOUT_TEMPLATES[0]; // Fallback
      return candidates[Math.floor(Math.random() * candidates.length)];
    }

    // First page should be Single (Right side)
    if (photosPool.length > 0) {
      // Try to pick a layout for 1 photo (standard start) or maybe complex single page?
      // Usually single pages are 1 photo, but let's allow up to 4 if we have them?
      // Actually, 'single' type pages in this app usually just support '1-full' layout or others? 
      // Based on existing logic: layout='1-full'. Let's see if we can randomize.
      // The app differentiates 'single' vs 'spread' mainly by canvas size. A 'single' page can have a grid layout too!
      // Let's pick a random photo count for first page (1 to 4)

      // NOTE: Current 'single' rendering might assume full page or specific layouts? 
      // Checking album-preview.tsx might be wise, but let's stick to simple 1-photo start for safety, 
      // OR randomize if we trust PageLayout handles 'single' with grid templates.
      // Safety: Let's do 1 photo for first page for now to match classic book style, or maybe random 1.

      const firstPagePhotos = photosPool.splice(0, 1);
      newPages.push({
        id: uuidv4(),
        type: 'single',
        photos: firstPagePhotos.map(p => ({ ...p, panAndZoom: defaultPanAndZoom })),
        layout: '1-full' // Could randomize this if 'single' supports other layouts
      });
    }

    // --- 3. Reserve photo for Last Single Page ---
    // Always have first AND last single pages
    let lastPagePhoto: typeof photosPool[0] | null = null;
    if (photosPool.length > 0) {
      lastPagePhoto = photosPool.pop()!; // Reserve last photo for final single page
    }

    // --- 4. Inner Spreads ---
    while (photosPool.length > 0) {
      // Randomly decide between Full (panoramic) and Split (left/right) modes
      const isSplit = Math.random() > 0.5;

      if (isSplit) {
        // --- SPLIT MODE ---
        let leftTemplate = LAYOUT_TEMPLATES[Math.floor(Math.random() * LAYOUT_TEMPLATES.length)];
        let rightTemplate = LAYOUT_TEMPLATES[Math.floor(Math.random() * LAYOUT_TEMPLATES.length)];

        // Ensure we have enough photos. If not, fallback to smaller templates.
        const totalNeeded = leftTemplate.photoCount + rightTemplate.photoCount;

        if (photosPool.length < totalNeeded) {
          // Try to find templates that fit the remaining photos
          // Very simple strategy: assign remaining to left, empty right, or 1-1.
          // Let's just try to fit what we can into Left, and fallback Right to empty or 1.
          // Actually, easier to fall back to specifically fitting templates or just 1 per side.

          // Simplest fallback: If not enough for the rand selection, just pick 1-photo templates if possible
          if (photosPool.length >= 2) {
            leftTemplate = LAYOUT_TEMPLATES.find(t => t.photoCount === 1) || LAYOUT_TEMPLATES[0];
            rightTemplate = LAYOUT_TEMPLATES.find(t => t.photoCount === 1) || LAYOUT_TEMPLATES[0];
          } else {
            // Only 1 photo left? Panic fallback to Full mode 1-photo
            // Or just Left=1, Right=Empty (if we supported empty)
            // Let's just break loop and let the "Last Single Page" handler take it? 
            // No, that handler expects "lastPagePhoto" to be pre-reserved. 
            // Let's just create a last spread with what we have.
            leftTemplate = LAYOUT_TEMPLATES.find(t => t.photoCount === 1) || LAYOUT_TEMPLATES[0];
            rightTemplate = LAYOUT_TEMPLATES[0]; // Assume [0] is valid? usually [0] is 1-full or 1-grid.

            // If we strictly only have 1 photo, we can't really do a split spread effectively unless right is empty.
            // We'll revert to Full mode for this last chunk.
            const fallbackTemplate = LAYOUT_TEMPLATES.find(t => t.photoCount === photosPool.length) || LAYOUT_TEMPLATES.find(t => t.photoCount === 1) || LAYOUT_TEMPLATES[0];
            const pagePhotos = photosPool.splice(0, fallbackTemplate.photoCount);
            newPages.push({
              id: uuidv4(),
              type: 'spread',
              photos: pagePhotos.map(p => ({ ...p, panAndZoom: defaultPanAndZoom })),
              layout: fallbackTemplate.id,
              spreadMode: 'full'
            });
            continue;
          }
        }

        // consume photos
        const leftPhotosCount = leftTemplate.photoCount;
        const rightPhotosCount = rightTemplate.photoCount;

        // Double check we have enough now
        if (photosPool.length >= leftPhotosCount + rightPhotosCount) {
          const pagePhotos = photosPool.splice(0, leftPhotosCount + rightPhotosCount);
          newPages.push({
            id: uuidv4(),
            type: 'spread',
            photos: pagePhotos.map(p => ({ ...p, panAndZoom: defaultPanAndZoom })),
            layout: '4-grid', // Placeholder, not used in split mode
            spreadMode: 'split',
            spreadLayouts: {
              left: leftTemplate.id,
              right: rightTemplate.id
            }
          });
        } else {
          // Should not happen due to check above, but purely safe fallback
          const fallbackTemplate = LAYOUT_TEMPLATES.find(t => t.photoCount === 1) || LAYOUT_TEMPLATES[0];
          const pagePhotos = photosPool.splice(0, Math.min(photosPool.length, fallbackTemplate.photoCount));
          newPages.push({
            id: uuidv4(),
            type: 'spread',
            photos: pagePhotos.map(p => ({ ...p, panAndZoom: defaultPanAndZoom })),
            layout: fallbackTemplate.id,
            spreadMode: 'full'
          });
        }

      } else {
        // --- FULL MODE ---
        let selectedTemplate = LAYOUT_TEMPLATES[Math.floor(Math.random() * LAYOUT_TEMPLATES.length)];

        // If not enough photos for this template, find one that fits
        if (photosPool.length < selectedTemplate.photoCount) {
          const exactFit = LAYOUT_TEMPLATES.find(t => t.photoCount === photosPool.length);
          if (exactFit) {
            selectedTemplate = exactFit;
          } else {
            // Fallback to 1-photo layout
            selectedTemplate = LAYOUT_TEMPLATES.find(t => t.photoCount === 1)!;
          }
        }

        const pagePhotos = photosPool.splice(0, selectedTemplate.photoCount);

        newPages.push({
          id: uuidv4(),
          type: 'spread',
          photos: pagePhotos.map(p => ({ ...p, panAndZoom: defaultPanAndZoom })),
          layout: selectedTemplate.id,
          spreadMode: 'full'
        });
      }
    }

    // --- 5. Last Single Page (always present) ---
    if (lastPagePhoto) {
      newPages.push({
        id: uuidv4(),
        type: 'single',
        photos: [{ ...lastPagePhoto, panAndZoom: defaultPanAndZoom }],
        layout: '1-full'
      });
    } else if (newPages.length > 1) {
      // No photo left for last page - duplicate first photo
      const firstPagePhoto = newPages[1]?.photos?.[0];
      if (firstPagePhoto) {
        newPages.push({
          id: uuidv4(),
          type: 'single',
          photos: [{ ...firstPagePhoto, id: uuidv4(), panAndZoom: defaultPanAndZoom }],
          layout: '1-full'
        });
      }
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

      // Handle Insertion into Empty Slot
      if (targetPhotoId.startsWith('__INSERT_AT__')) {
        const index = parseInt(targetPhotoId.replace('__INSERT_AT__', ''), 10);
        if (isNaN(index)) return page;

        const newPhotos = [...page.photos];
        const newPhotoObj = {
          ...droppedPhoto,
          id: uuidv4(), // Generate a new ID for this specific usage instance
          panAndZoom: { scale: 1, x: 50, y: 50 },
          width: droppedPhoto.width || 800,
          height: droppedPhoto.height || 600
        };

        // If index is outside bounds, fill with placeholders?
        // Or strictly set. Array in JS will handle sparse but it's better to be safe.
        // If we are at index 2 but length is 0 (unlikely for Front cover, should have filled with Back cover photos?)
        // Actually, if we are in Split mode, 'frontPhotos' rendering assumes 'backPhotos' exist.
        // If they don't, we should fill them.

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
              panAndZoom: { scale: 1, x: 50, y: 50 },
              width: droppedPhoto.width || 800,
              height: droppedPhoto.height || 600
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

      // Preload images
      const preloadImage = (src: string) => {
        return new Promise((resolve, reject) => {
          const img = new window.Image();
          img.src = src;
          img.onload = resolve;
          img.onerror = resolve; // Resolve even on error to not block everything
        });
      };

      Promise.all(dummyPhotos.map(photo => preloadImage(photo.src)))
        .then(() => {
          setAllPhotos(dummyPhotos);
          generateInitialPages(dummyPhotos); // Use all photos
          setIsLoading(false);
          toast({
            title: 'Photos & Album Generated',
            description: '100 dummy photos and a full album layout have been created.',
          });
        });
    }, 1500);
  };

  // Process uploaded photo files (from folder or individual selection)
  const processUploadedFiles = async (files: FileList | null) => {
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

    setIsLoading(true);
    toast({
      title: 'Uploading Photos',
      description: `Processing ${imageFiles.length} image(s)...`,
    });

    try {
      const newPhotos: Photo[] = await Promise.all(
        imageFiles.map(file => {
          return new Promise<Photo>((resolve, reject) => {
            // Read as ArrayBuffer for EXIF, then convert to data URL
            const arrayReader = new FileReader();
            arrayReader.onload = (arrayEvent) => {
              const arrayBuffer = arrayEvent.target?.result as ArrayBuffer;
              const captureDate = extractExifDate(arrayBuffer);

              // Now read as data URL for display
              const dataReader = new FileReader();
              dataReader.onload = (dataEvent) => {
                const dataUrl = dataEvent.target?.result as string;
                const img = new window.Image();
                img.onload = () => {
                  resolve({
                    id: uuidv4(),
                    src: dataUrl,
                    alt: file.name,
                    width: img.width,
                    height: img.height,
                    captureDate,
                  });
                };
                img.onerror = () => reject(new Error(`Failed to load image: ${file.name}`));
                img.src = dataUrl;
              };
              dataReader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
              dataReader.readAsDataURL(file);
            };
            arrayReader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
            arrayReader.readAsArrayBuffer(file);
          });
        })
      );

      setAllPhotos(prev => [...prev, ...newPhotos]);
      setIsLoading(false);
      toast({
        title: 'Photos Uploaded',
        description: `${newPhotos.length} photo(s) added to gallery.`,
      });
    } catch (error) {
      setIsLoading(false);
      toast({
        title: 'Upload Failed',
        description: 'Some images could not be processed.',
        variant: 'destructive'
      });
    }
  };

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

  // Clear all photos from gallery
  const handleClearGallery = () => {
    setAllPhotos([]);
    toast({
      title: 'Gallery Cleared',
      description: 'All photos have been removed from the gallery.',
    });
  };

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
    <div className="flex flex-col h-full">
      {/* Global Top Toolbar */}
      <div className="flex justify-between items-center px-6 py-3 border-b bg-background sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-lg">
            <span className="text-muted-foreground">Editing</span>
            <span className="font-semibold">travel-2023</span>
            <Pencil className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-foreground ml-2" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 bg-background" onClick={() => setIsBookViewOpen(true)}>
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Book View</span>
          </Button>
          <Button variant="outline" className="gap-2 bg-background" onClick={() => setIsCustomLayoutEditorOpen(true)}>
            <Layout className="h-4 w-4" />
            <span className="hidden sm:inline">Custom Layout</span>
          </Button>
          <div className="h-4 w-px bg-border mx-1" />
          <Button variant="ghost" size="sm" className="gap-2" onClick={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileImage className="h-4 w-4" />}
            <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export to Images'}</span>
          </Button>
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => exporterRef.current?.exportToPdf()}>
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Export to PDF</span>
          </Button>
          <div className="h-4 w-px bg-border mx-1" />
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => toast({ title: "Sharing Album..." })}>
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Share</span>
          </Button>
        </div>
      </div>

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
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Photo Gap</label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="50"
                              value={photoGap}
                              onChange={(e) => setPhotoGap(Math.max(0, Math.min(50, Number(e.target.value) || 0)))}
                              className="w-14 h-7 text-center text-sm border rounded"
                            />
                            <span className="text-sm text-muted-foreground">px</span>
                          </div>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="50"
                          value={photoGap}
                          onChange={(e) => setPhotoGap(Number(e.target.value))}
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Page Margin</label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="50"
                              value={pageMargin}
                              onChange={(e) => setPageMargin(Math.max(0, Math.min(50, Number(e.target.value) || 0)))}
                              className="w-14 h-7 text-center text-sm border rounded"
                            />
                            <span className="text-sm text-muted-foreground">px</span>
                          </div>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="50"
                          value={pageMargin}
                          onChange={(e) => setPageMargin(Number(e.target.value))}
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Corner Radius</label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="20"
                              value={cornerRadius}
                              onChange={(e) => setCornerRadius(Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
                              className="w-14 h-7 text-center text-sm border rounded"
                            />
                            <span className="text-sm text-muted-foreground">px</span>
                          </div>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="20"
                          value={cornerRadius}
                          onChange={(e) => setCornerRadius(Number(e.target.value))}
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Background Color</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={backgroundColor}
                            onChange={(e) => handleColorChange(e.target.value)}
                            className="w-10 h-10 rounded border cursor-pointer"
                          />
                          <input
                            type="text"
                            value={backgroundColor}
                            onChange={(e) => setBackgroundColor(e.target.value)}
                            className="flex-1 h-8 px-2 text-sm border rounded"
                            placeholder="#ffffff"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Background Image</label>
                        <div className="grid grid-cols-3 gap-2">
                          {/* None option */}
                          <div
                            className={cn(
                              "h-12 rounded border-2 cursor-pointer flex items-center justify-center bg-gray-100",
                              !backgroundImage ? "border-primary ring-2 ring-primary/20" : "border-muted hover:border-primary/50"
                            )}
                            onClick={() => setBackgroundImage(undefined)}
                          >
                            <span className="text-xs text-muted-foreground">None</span>
                          </div>
                          {/* Available backgrounds */}
                          {availableBackgrounds.map((bg, index) => (
                            <div
                              key={index}
                              className={cn(
                                "h-12 rounded border-2 cursor-pointer overflow-hidden relative group",
                                backgroundImage === bg ? "border-primary ring-2 ring-primary/20" : "border-muted hover:border-primary/50"
                              )}
                              onClick={() => setBackgroundImage(bg)}
                            >
                              <img src={bg} alt={`Background ${index + 1}`} className="w-full h-full" />
                              <button
                                className="absolute top-0 right-0 w-5 h-5 bg-black/50 text-white text-xs rounded-bl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-black/70"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAvailableBackgrounds(prev => prev.filter((_, i) => i !== index));
                                  if (backgroundImage === bg) {
                                    setBackgroundImage(undefined);
                                  }
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          {/* Upload button */}
                          <div
                            className="h-12 rounded border-2 border-dashed cursor-pointer flex items-center justify-center bg-gray-50 hover:bg-gray-100"
                            onClick={() => backgroundUploadRef.current?.click()}
                          >
                            <span className="text-xl text-muted-foreground">+</span>
                          </div>
                        </div>
                        <input
                          ref={backgroundUploadRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const dataUrl = event.target?.result as string;
                                setAvailableBackgrounds(prev => [...prev, dataUrl]);
                                setBackgroundImage(dataUrl);
                              };
                              reader.readAsDataURL(file);
                            }
                            e.target.value = '';
                          }}
                        />
                        {backgroundImage && (
                          <div className="relative w-full h-16 rounded overflow-hidden border">
                            <img src={backgroundImage} alt="Background preview" className="w-full h-full" />
                          </div>
                        )}
                        {/* AI Background Generation */}
                        <AiBackgroundGenerator
                          onBackgroundGenerated={(imageUrl) => {
                            setAvailableBackgrounds(prev => [...prev, imageUrl]);
                            setBackgroundImage(imageUrl);
                          }}
                        />
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="font-headline text-lg flex items-center gap-2">
                    <Wand2 className="h-5 w-5" /> Test Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                    onClick={generateDummyPhotos}
                    disabled={isLoading || !randomSeed}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <PlusSquare className="mr-2 h-4 w-4" />
                    )}
                    Load Photos
                  </Button>
                </CardContent>
              </Card>
            </>
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

        {/* Right Sidebar: Photo Gallery */}
        <div className="xl:col-span-3 space-y-4">
          <Card className="h-[85vh] flex flex-col">
            <CardHeader className="pb-3 border-bottom">
              <div className="flex items-center justify-between">
                <CardTitle className="font-headline text-lg">Photo Gallery</CardTitle>
                <div className="flex items-center gap-2">
                  {/* Upload Buttons */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => folderUploadRef.current?.click()}
                    title="Upload folder"
                  >
                    <FolderUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => photoUploadRef.current?.click()}
                    title="Upload photos"
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleGenerateAlbum}
                    title="Generate album from photos"
                  >
                    <Wand2 className="h-4 w-4" />
                  </Button>
                  <div className="h-4 w-px bg-border" />
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
              {/* Hidden file inputs */}
              <input
                ref={folderUploadRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
                onChange={(e) => {
                  processUploadedFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <input
                ref={photoUploadRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  processUploadedFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0 relative">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center animate-in fade-in duration-300">
                  <Loader2 className="h-10 w-10 mb-2 animate-spin text-primary" />
                  <p className="text-sm font-medium">Loading photos...</p>
                </div>
              ) : allPhotos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center">
                  <ImageIcon className="h-10 w-10 mb-2 opacity-20" />
                  <p className="text-sm">No photos loaded yet. Use "Load Photos" to start.</p>
                </div>
              ) : (
                <ScrollArea ref={photoScrollRef} className="h-full px-4 py-2">
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
              <ScrollToTopButton scrollAreaRef={photoScrollRef} dependency={allPhotos.length} />
            </CardContent>
            <div className="p-3 border-t bg-muted/30 flex flex-col gap-2">
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={handleClearGallery}
                >
                  <Eraser className="h-3 w-3" />
                  Clear Gallery
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={handleResetAlbum}
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset Album
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {allPhotos.length} photos total • {usedPhotoIds.size} used
              </p>
            </div>
          </Card>
        </div >
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
  );
}

// Helper Component for Scroll To Top
function ScrollToTopButton({ scrollAreaRef, className, dependency }: { scrollAreaRef: React.RefObject<HTMLDivElement | null>; className?: string; dependency?: any }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollContainer) return;

    const handleScroll = () => {
      if (scrollContainer.scrollTop > 100) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [scrollAreaRef, dependency]);

  const scrollToTop = () => {
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    scrollContainer?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Button
      variant="secondary"
      size="icon"
      className={cn(
        "absolute bottom-4 right-4 z-50 rounded-full shadow-lg transition-all duration-300",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none",
        className
      )}
      onClick={scrollToTop}
    >
      <ArrowUp className="h-5 w-5" />
    </Button>
  );
}
