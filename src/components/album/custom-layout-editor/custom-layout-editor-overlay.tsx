import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AlbumPage, AlbumConfig } from '@/lib/types';
import { LayoutSidebarLeft } from './layout-sidebar-left';
import { LayoutSidebarRight } from './layout-sidebar-right';
import { LayoutCanvas } from './layout-canvas';
import { FloatingToolbar } from './floating-toolbar';
import { BottomToolbar } from './bottom-toolbar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Check, X, Layout, BookOpen, Book, Maximize, FolderOpen, Trash2, Shield } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useTemplates, getPhotoCount } from '@/hooks/useTemplates';
import { Sheet } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { processLayoutGeometry } from '@/lib/layout-geometry';
import { createClient } from '@/lib/supabase';
import { invalidateCache } from '@/lib/templates-cache';
import { VectorObject, Point, Segment, LayoutRegion, AdvancedTemplate } from '@/lib/advanced-layout-types';
import { useAuth } from "@/hooks/useAuth";
import { ModeToggle } from "@/components/mode-toggle";
import { UserNav } from "@/components/user-nav";
import { AdminSettingsDialog } from "@/components/admin/admin-settings-dialog";

export type ToolMode = 'select' | 'pencil' | 'rect' | 'circle';

interface CustomLayoutEditorOverlayProps {
    onClose: () => void;
    config?: AlbumConfig;
    customTemplates?: AdvancedTemplate[];
    onAddTemplate?: (template: AdvancedTemplate) => void;
}

import { useTheme } from 'next-themes';

export const CustomLayoutEditorOverlay = ({ onClose, config, customTemplates, onAddTemplate }: CustomLayoutEditorOverlayProps) => {
    const { findGridTemplate, defaultGridTemplate, allTemplates } = useTemplates();
    const { resolvedTheme } = useTheme();
    const { isAdmin } = useAuth();
    const [adminOpen, setAdminOpen] = useState(false);

    // Use only templates passed via props (if any) or start empty for session
    // Do NOT auto-load all custom templates from the global cache to avoid cluttering "New Templates"
    const existingCustomTemplates = useMemo(() => {
        return customTemplates || [];
    }, [customTemplates]);

    // Local state for created templates (starts empty)
    const [createdTemplates, setCreatedTemplates] = useState<AdvancedTemplate[]>([]);

    // Create a dummy page with empty or sample photo slots
    const createDummyPage = (layoutId: string, useDummy: boolean = false): AlbumPage => {
        const template = findGridTemplate(layoutId) || defaultGridTemplate;
        const totalPhotos = getPhotoCount(template) * 2; // For both pages of spread

        const photos = Array(totalPhotos).fill(null).map((_, index) => {
            if (useDummy) {
                // Generate sample images using picsum.photos with different seeds
                const seed = `layout-${layoutId}-${index}`;
                return {
                    id: uuidv4(),
                    src: `https://picsum.photos/seed/${seed}/800/600`,
                    alt: `Sample photo ${index + 1}`,
                    width: 800,
                    height: 600,
                    panAndZoom: { scale: 1, x: 50, y: 50 }
                };
            } else {
                return {
                    id: uuidv4(),
                    src: '',
                    alt: 'Drop photo here',
                    panAndZoom: { scale: 1, x: 50, y: 50 }
                };
            }
        });

        return {
            id: 'custom-layout-preview',
            type: 'spread',
            photos,
            layout: layoutId,
            spreadMode: 'full',
            spreadLayouts: {
                left: layoutId,
                right: layoutId
            },
            photoGap: photoGap,
            pageMargin: pageMargin
        };
    };


    const [selectedLayout, setSelectedLayout] = useState('4-grid');
    const [spreadMode, setSpreadMode] = useState<'full' | 'split'>('full');
    const [photoGap, setPhotoGap] = useState(() => config?.photoGap ?? 2);
    const [pageMargin, setPageMargin] = useState(() => config?.pageMargin ?? 0);
    const [cornerRadius, setCornerRadius] = useState(() => config?.cornerRadius ?? 0);
    const [useDummyPhotos, setUseDummyPhotos] = useState(true);
    const [dummyPage, setDummyPage] = useState<AlbumPage>(() => createDummyPage('4-grid', true));
    const [selectedAdvancedTemplate, setSelectedAdvancedTemplate] = useState<AdvancedTemplate | null>(null);
    const [editingTemplateId, setEditingTemplateId] = useState<string | number | null>(null);
    const [templateName, setTemplateName] = useState('');

    // VECTOR TOOLS STATE
    const [toolMode, setToolMode] = useState<ToolMode>('select');
    const [vectorObjects, setVectorObjects] = useState<VectorObject[]>([]);
    // Vector Properties State
    const [strokeColor, setStrokeColor] = useState('#000000');
    const [strokeWidth, setStrokeWidth] = useState(0.5);
    const [fillColor, setFillColor] = useState('transparent');

    const [currentStroke, setCurrentStroke] = useState<Segment | null>(null);
    const [isMirrorMode, setIsMirrorMode] = useState(false);
    const [selectedShapeIndices, setSelectedShapeIndices] = useState<number[]>([]);
    const [showGuides, setShowGuides] = useState(true);

    // Dynamic Theme Update: When theme changes, update state AND existing objects
    useEffect(() => {
        const isDark = resolvedTheme === 'dark';
        const newStroke = isDark ? '#ffffff' : '#000000';
        const newFill = isDark ? '#292929' : '#ededed';

        setStrokeColor(newStroke);
        setFillColor(newFill);

        // Update all existing shapes to match the new theme defaults
        setVectorObjects(prev => prev.map((obj, index) => {
            // Background frame (index 0) gets a distinct color
            const isBackground = index === 0;
            const bgFill = isDark ? '#1f1f1f' : '#f5f5f5';

            return {
                ...obj,
                stroke: newStroke,
                fill: isBackground ? bgFill : newFill // Force update fill to match theme with distinction
            };
        }));
    }, [resolvedTheme]);

    // 1. When selection changes, update sidebar to match the first selected object's properties
    useEffect(() => {
        if (selectedShapeIndices.length > 0) {
            const firstIdx = selectedShapeIndices[0];
            const obj = vectorObjects[firstIdx];
            if (obj) {
                if (obj.stroke) setStrokeColor(obj.stroke);
                if (obj.strokeWidth !== undefined) setStrokeWidth(obj.strokeWidth);
                if (obj.fill) setFillColor(obj.fill);
            }
        }
    }, [selectedShapeIndices]); // Note: we don't depend on vectorObjects here to avoid loops during property updates

    // 2. When properties change in sidebar, apply them to all selected objects
    useEffect(() => {
        if (selectedShapeIndices.length > 0 && vectorObjects.length > 0) {
            let changed = false;
            const newObjects = vectorObjects.map((obj, idx) => {
                if (selectedShapeIndices.includes(idx)) {
                    if (obj.stroke !== strokeColor || obj.strokeWidth !== strokeWidth || obj.fill !== fillColor) {
                        changed = true;
                        return {
                            ...obj,
                            stroke: strokeColor,
                            strokeWidth: strokeWidth,
                            fill: fillColor
                        };
                    }
                }
                return obj;
            });

            if (changed) {
                setVectorObjects(newObjects);
            }
        }
    }, [strokeColor, strokeWidth, fillColor]);

    // Handle advanced template selection
    const handleSelectAdvancedTemplate = (template: AdvancedTemplate, preferredMode?: 'full' | 'split', isEdit: boolean = false) => {
        setSelectedAdvancedTemplate(template);

        const isSystemTemplate = template.createdBy === 'system';

        if (isEdit) {
            if (isSystemTemplate) {
                // For system templates, force save-as-new by keeping editingTemplateId null
                setEditingTemplateId(null);
                setTemplateName(`${template.name} Copy`);
            } else {
                // For custom templates, allow updating
                setEditingTemplateId(template.id);
                setTemplateName(template.name);
            }
        } else {
            setEditingTemplateId(null);
            setTemplateName('');
        }
        // Determine target spread mode and coordinate scaling
        let targetSpreadMode = preferredMode || spreadMode;
        if (template.type === 'spread') {
            targetSpreadMode = 'full';
        } else if (template.type === 'single') {
            targetSpreadMode = 'split';
        }

        const isFullSpread = targetSpreadMode === 'full';
        const scaleX = isFullSpread ? 2 : 1;


        // Only load vector objects for editing mode
        if (isEdit) {
            // Convert template regions to VectorObjects for interactivity
            const newVectorObjects: VectorObject[] = template.regions.map((region, index) => {
                const isPath = region.shape === 'path';
                let points: Point[] = region.points || [];

                // For path objects, generate a bounding box to allow manipulation (points will be used for translation)
                let pathPoints: Point[] | undefined = undefined;
                if (isPath) {
                    const { x, y, width, height } = region.bounds;
                    pathPoints = [
                        [x * scaleX, y],
                        [(x + width) * scaleX, y],
                        [(x + width) * scaleX, y + height],
                        [x * scaleX, y + height]
                    ];
                }

                // For polygons, generate segments
                const segments: Segment[] = [];
                if (!isPath && points.length > 1) {
                    for (let i = 0; i < points.length - 1; i++) {
                        segments.push({ p1: [points[i][0] * scaleX, points[i][1]] as Point, p2: [points[i + 1][0] * scaleX, points[i + 1][1]] as Point });
                    }
                    // Close polygon if needed
                    if (points.length > 2 && (points[0][0] !== points[points.length - 1][0] || points[0][1] !== points[points.length - 1][1])) {
                        segments.push({ p1: [points[points.length - 1][0] * scaleX, points[points.length - 1][1]] as Point, p2: [points[0][0] * scaleX, points[0][1]] as Point });
                    }
                } else if (!isPath && region.shape === 'rect') {
                    const { x, y, width, height } = region.bounds;
                    const rectPoints: Point[] = [
                        [x * scaleX, y],
                        [(x + width) * scaleX, y],
                        [(x + width) * scaleX, y + height],
                        [x * scaleX, y + height]
                    ];
                    for (let i = 0; i < 4; i++) {
                        segments.push({ p1: rectPoints[i], p2: rectPoints[(i + 1) % 4] });
                    }
                    // For rect shapes, we MUST ensure points are populated so LayoutCanvas can render the polygon
                    points = rectPoints;
                }

                // For other polygons/points, scale them if needed
                const finalPoints = (region.shape === 'rect') ? points : points.map(p => [p[0] * scaleX, p[1]] as Point);

                // Background frame (index 0) gets a distinct color
                const isBackground = index === 0;
                const isDark = resolvedTheme === 'dark';
                const bgFill = isDark ? '#1f1f1f' : '#f5f5f5';

                return {
                    id: region.id || uuidv4(),
                    type: isPath ? 'path' : (region.shape === 'rect' ? 'rect' : (region.shape === 'circle' ? 'circle' : 'polygon')),
                    segments,
                    points: isPath ? pathPoints : finalPoints,
                    path: region.path,
                    viewBox: region.viewBox,
                    stroke: strokeColor,
                    strokeWidth: region.strokeWidth || 0.5,
                    fill: isBackground ? bgFill : fillColor,
                    zIndex: region.zIndex || index,
                    rotation: region.rotation || 0
                };
            });
            setVectorObjects(newVectorObjects);
        } else {
            // Preview mode: clear vector objects so we see the final rendered result
            setVectorObjects([]);
        }

        if (targetSpreadMode !== spreadMode) {
            setSpreadMode(targetSpreadMode);
        }

        // Create a dummy page with the right number of photos for this template
        const photos = Array(getPhotoCount(template)).fill(null).map((_, index) => {
            if (useDummyPhotos) {
                const seed = `adv-${template.id}-${index}`;
                return {
                    id: uuidv4(),
                    src: `https://picsum.photos/seed/${seed}/800/600`,
                    alt: `Sample photo ${index + 1}`,
                    width: 800,
                    height: 600,
                    panAndZoom: { scale: 1, x: 50, y: 50 }
                };
            }
            return {
                id: uuidv4(),
                src: '',
                alt: 'Drop photo here',
                panAndZoom: { scale: 1, x: 50, y: 50 }
            };
        });

        setDummyPage(prev => ({
            ...prev,
            photos,
            layout: template.id,
            photoGap: photoGap,
            pageMargin: pageMargin,
            spreadMode: targetSpreadMode
        }));
    };

    // Update dummy page when layout changes
    const handleLayoutChange = (layoutId: string, preferredMode?: 'full' | 'split') => {
        setSelectedLayout(layoutId);

        // Find the full template object to set selectedAdvancedTemplate
        const template = allTemplates.find(t => String(t.id) === String(layoutId));
        if (template) {
            handleSelectAdvancedTemplate(template, preferredMode);
        } else {
            setDummyPage(prev => ({
                ...createDummyPage(layoutId, useDummyPhotos),
                photoGap,
                pageMargin,
                spreadMode: preferredMode || spreadMode
            }));
        }
    };

    // Handle adding a Canva frame shape to the canvas as a VectorObject
    const handleAddCanvaFrame = (template: AdvancedTemplate) => {
        // Add only the first region as a draggable frame shape
        // We scale it to be placed at a reasonable size on the canvas while maintaining aspect ratio
        const firstRegion = template.regions[0];
        if (!firstRegion || !firstRegion.path) return;

        // Parse viewBox to get natural aspect ratio
        const viewBox = firstRegion.viewBox || '0 0 100 100';
        const vbParts = viewBox.split(' ').map(Number);
        const vbWidth = vbParts[2] || 100;
        const vbHeight = vbParts[3] || 100;
        const aspectRatio = vbWidth / vbHeight;

        // Base size for the frame (the larger dimension will be 30 canvas units)
        const baseSize = 30;
        let frameWidth: number;
        let frameHeight: number;

        if (aspectRatio >= 1) {
            // Wider than tall
            frameWidth = baseSize;
            frameHeight = baseSize / aspectRatio;
        } else {
            // Taller than wide
            frameHeight = baseSize;
            frameWidth = baseSize * aspectRatio;
        }

        // Center position on canvas
        const centerX = 35;
        const centerY = 35;

        // Calculate bounding box points for the frame
        const x = centerX;
        const y = centerY;
        const pathPoints: Point[] = [
            [x, y],
            [x + frameWidth, y],
            [x + frameWidth, y + frameHeight],
            [x, y + frameHeight]
        ];

        const newVectorObject: VectorObject = {
            id: uuidv4(),
            type: 'path' as const,
            segments: [],
            points: pathPoints,
            path: firstRegion.path,
            viewBox: firstRegion.viewBox,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            // Use a visible default fill - a soft gray/blue that looks like a frame placeholder
            fill: fillColor !== 'transparent' ? fillColor : 'rgba(100, 130, 180, 0.3)',
            zIndex: vectorObjects.length + 1,
            rotation: 0
        };

        // Add to existing vector objects
        setVectorObjects(prev => [...prev, newVectorObject]);
    };

    // Update dummy page when useDummyPhotos changes
    const handleUseDummyPhotosChange = (use: boolean) => {
        setUseDummyPhotos(use);
        setDummyPage(prev => ({
            ...createDummyPage(selectedLayout, use),
            photoGap,
            pageMargin,
            spreadMode
        }));
    };

    // Update dummy page when spread mode changes
    const handleSpreadModeChange = (mode: 'full' | 'split') => {
        setSpreadMode(mode);
        setDummyPage(prev => ({
            ...prev,
            spreadMode: mode
        }));
    };

    // Update dummy page when gap/margin changes
    const handlePhotoGapChange = (gap: number) => {
        setPhotoGap(gap);
        setDummyPage(prev => ({ ...prev, photoGap: gap }));
    };

    const handlePageMarginChange = (margin: number) => {
        setPageMargin(margin);
        setDummyPage(prev => ({ ...prev, pageMargin: margin }));
    };

    const handleCornerRadiusChange = (radius: number) => {
        setCornerRadius(radius);
        setDummyPage(prev => ({ ...prev, cornerRadius: radius }));
    };

    const handleSave = async () => {
        // Save all created templates to Supabase
        if (createdTemplates.length > 0) {
            try {
                const supabase = createClient();

                // Get current user
                const { data: { user } } = await supabase.auth.getUser();
                const userId = user?.id || 'anonymous';

                // Get the max ID from existing templates to generate new IDs
                const { data: maxIdResult } = await supabase
                    .from('templates')
                    .select('id')
                    .order('id', { ascending: false })
                    .limit(1);

                let nextId = (maxIdResult && maxIdResult.length > 0) ? (maxIdResult[0].id + 1) : 1000;

                // Prepare templates for insertion/update
                const templatesToProcess = createdTemplates.map(template => {
                    // Map type to type_id
                    let typeId = 3; // default BOTH
                    if (template.type === 'single') typeId = 1;
                    if (template.type === 'spread') typeId = 2;

                    const baseTemplate = {
                        name: templateName || template.name,
                        category_id: 5, // CUSTOM category
                        photo_count: template.photoCount,
                        regions: template.regions,
                        created_by: userId === 'anonymous' ? null : userId,
                        is_system: false,
                        is_active: true,
                        sort_order: 999,
                        type_id: typeId
                    };

                    // Use the template's own ID. It adheres to logic:
                    // - If it was a system clone, handleProcessLayout assigned a UUID.
                    // - If it was a custom edit, handleProcessLayout kept the original ID.
                    const targetId = template.id;
                    const isNew = typeof targetId === 'string' && targetId.includes('-');

                    if (isNew) {
                        const newIntegerId = nextId++;
                        return { ...baseTemplate, id: newIntegerId };
                    } else {
                        return { ...baseTemplate, id: targetId };
                    }
                });

                if (templatesToProcess.length > 0) {
                    const { error: upsertError } = await supabase
                        .from('templates')
                        .upsert(templatesToProcess, { onConflict: 'id' });

                    if (upsertError) throw upsertError;
                }
                console.log('Templates saved successfully to Supabase');

                // Invalidate cache so templates are reloaded
                invalidateCache();

                console.log('Templates saved successfully to Supabase');
            } catch (error: any) {
                console.error('Failed to save templates to Supabase:', error);
                console.error('Error details:', {
                    message: error?.message,
                    code: error?.code,
                    details: error?.details,
                    hint: error?.hint,
                    name: error?.name
                });
                // Continue closing even if save fails - user can retry
            }
        }

        // Call parent callback if provided
        if (onAddTemplate && createdTemplates.length > 0) {
            createdTemplates.forEach(template => onAddTemplate(template));
        }

        onClose();
    };

    const handleCancel = () => {
        onClose();
    };

    const handleUpdatePage = (page: AlbumPage) => {
        setDummyPage(page);
    };

    // Clear all vector objects and reset canvas for new template creation
    const handleClearAll = useCallback(() => {
        setVectorObjects([]);
        setCurrentStroke(null);
        // Clear the selected template so user can create a new one
        setSelectedAdvancedTemplate(null);
        setToolMode('select');
        setSelectedShapeIndices([]);
    }, []);

    // Process the drawn strokes into regions
    const handleProcessLayout = useCallback(() => {
        if (vectorObjects.length === 0) return;

        // Calculate aspect ratio to pass to geometry engine
        let configW = 20;
        let configH = 20;
        if (config?.size) {
            const parts = config.size.split('x').map(Number);
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                configW = parts[0];
                configH = parts[1];
            }
        }

        // Match LayoutCanvas calculation to ensure strokes (0..100*aspect) map correctly to 0..100%
        const BASE_PAGE_PX = 450;
        const pxPerUnit = BASE_PAGE_PX / configH;
        const pageW_px = configW * pxPerUnit;
        const pageH_px = BASE_PAGE_PX;

        const isFull = spreadMode === 'full';
        const logicalWidthPx = isFull ? pageW_px * 2 : pageW_px;
        const logicalHeightPx = pageH_px;

        // Determine the coordinate system aspect ratio used during drawing
        // Note: Strokes are captured in a coordinate system of [0..Aspect*100] x [0..100]
        const innerW = logicalWidthPx - (pageMargin * 2);
        const innerH = logicalHeightPx - (pageMargin * 2);
        const aspect = innerW / innerH;

        const logicalWidthUnits = aspect * 100;

        // Separate vector objects into calculated (lines) and direct (paths)
        const lineSegments = vectorObjects
            .filter(obj => obj.type !== 'path')
            .flatMap(obj => obj.segments);

        const pathRegions: LayoutRegion[] = vectorObjects
            .filter(obj => obj.type === 'path')
            .map(obj => {
                // Calculate bounds from obj.points (the 4-corner bounding box)
                // Points are in canvas coordinate system (0..100*aspect x 0..100)
                const pts = obj.points || [];
                const minX = pts.length ? Math.min(...pts.map(p => p[0])) : 0;
                const minY = pts.length ? Math.min(...pts.map(p => p[1])) : 0;
                const maxX = pts.length ? Math.max(...pts.map(p => p[0])) : logicalWidthUnits;
                const maxY = pts.length ? Math.max(...pts.map(p => p[1])) : 100;

                // Convert from canvas units to percentage (0-100)
                const boundsX = (minX / logicalWidthUnits) * 100;
                const boundsY = minY; // Y is already in 0-100
                const boundsW = ((maxX - minX) / logicalWidthUnits) * 100;
                const boundsH = maxY - minY;

                return {
                    id: obj.id,
                    shape: 'path' as const,
                    path: obj.path,
                    viewBox: obj.viewBox,
                    bounds: { x: boundsX, y: boundsY, width: boundsW, height: boundsH },
                    stroke: obj.stroke !== 'transparent' ? obj.stroke : undefined,
                    strokeWidth: obj.strokeWidth > 0 ? obj.strokeWidth : undefined,
                    fill: obj.fill !== 'transparent' ? obj.fill : undefined,
                    zIndex: obj.zIndex,
                    rotation: obj.rotation
                };
            });

        // Core Geometry Calculation for lines
        const newRegions = processLayoutGeometry(lineSegments, 0, logicalWidthUnits);

        // Combine regions
        const finalRegions = [...newRegions, ...pathRegions];

        // Map properties from vector objects to regions if possible
        const updatedRegions = finalRegions.map(region => {
            if (region.shape === 'path') return region; // Already mapped
            return {
                ...region,
                stroke: strokeColor !== 'transparent' ? strokeColor : undefined,
                strokeWidth: strokeWidth > 0 ? strokeWidth : undefined,
                fill: fillColor !== 'transparent' ? fillColor : undefined
            };
        });

        // Generate a unique name for the new template
        const templateCount = createdTemplates.length + 1;

        // Update or Create Template
        // If we are editing an existing custom template, use its ID.
        // If we are cloning a system template (editingTemplateId is null), generate a new UUID.
        // If we are creating a brand new template (selectedAdvancedTemplate is null), generate a new UUID.
        const baseId = (editingTemplateId) ? editingTemplateId : uuidv4();

        // If selectedAdvancedTemplate exists but we are NOT editing it (i.e. system clone),
        // we must ensure we don't accidentally use its system ID.
        // The logic above handles this: if editingTemplateId is null, we generate a UUID.

        const targetTemplate: AdvancedTemplate = selectedAdvancedTemplate || {
            id: baseId,
            name: `Custom Template ${templateCount}`,
            category: 'custom',
            regions: [],
            photoCount: 0,
            isCustom: true,
            createdBy: null,
            type: spreadMode === 'full' ? 'spread' : 'single',
            _pageMargin: pageMargin,
            _photoGap: photoGap
        };

        const updated: AdvancedTemplate = {
            ...targetTemplate,
            id: baseId, // Ensure we use the determined ID (either existing custom ID or new UUID)
            name: templateName || targetTemplate.name, // Use the input name if available
            regions: updatedRegions,
            photoCount: updatedRegions.length,
            type: spreadMode === 'full' ? 'spread' : 'single',
            isCustom: true, // Always mark as custom
            createdBy: null, // Custom templates owned by user (handled by RLS/context)
            _pageMargin: pageMargin,
            _photoGap: photoGap
        };

        // Add to local created templates (avoid duplicates)
        setCreatedTemplates(prev => {
            const existingIndex = prev.findIndex(t => t.id === updated.id);
            if (existingIndex >= 0) {
                const newTemplates = [...prev];
                newTemplates[existingIndex] = updated;
                return newTemplates;
            }
            return [...prev, updated];
        });

        // Select the updated template
        handleSelectAdvancedTemplate(updated);

        // Auto-switch back to select mode to see results
        setToolMode('select');
        setVectorObjects([]);
        setSelectedShapeIndices([]);
    }, [vectorObjects, config?.size, selectedAdvancedTemplate, handleSelectAdvancedTemplate, createdTemplates.length, pageMargin, photoGap, strokeColor, strokeWidth, fillColor, spreadMode]);

    return (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col">
            {/* 1. Global Header */}
            <div className="h-14 border-b bg-background flex items-center px-6 shrink-0 z-20 gap-4">
                <span className="heading-sm whitespace-nowrap">Custom Layout Editor</span>

                <div className="w-px h-6 bg-border mx-2" />

                {/* Template Name Input */}
                <div className="flex items-center gap-2 max-w-sm flex-1">
                    <Label htmlFor="template-name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                        {editingTemplateId ? "Editing:" : "New Template:"}
                    </Label>
                    <Input
                        id="template-name"
                        placeholder="Enter template name..."
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        className="h-8 text-sm bg-muted/30 border-muted-foreground/20 focus:bg-background"
                    />
                </div>

                <div className="flex-1" />

                <div className="flex items-center gap-2">
                    {/* Admin Button */}
                    {isAdmin && (
                        <>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                title="Admin Panel"
                                onClick={() => setAdminOpen(true)}
                            >
                                <Shield className="h-5 w-5" />
                            </Button>
                            <AdminSettingsDialog open={adminOpen} onOpenChange={setAdminOpen} />
                        </>
                    )}

                    <ModeToggle />
                    <div className="h-4 w-px bg-border mx-1" />
                    <UserNav showSettingsLink={false} />
                </div>
            </div>

            {/* 2. Main Workspace */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar */}
                <div className="w-[300px] border-r bg-background flex-shrink-0 z-10">
                    <LayoutSidebarLeft
                        onAddCanvaFrame={handleAddCanvaFrame}
                    />
                </div>

                {/* Main Canvas Area */}
                <div className="flex-1 flex flex-col relative bg-muted/10 h-full overflow-hidden">


                    {/* Canvas */}
                    <div className="flex-1 relative overflow-hidden">
                        <FloatingToolbar
                            toolMode={toolMode}
                            onToolChange={setToolMode}
                            isMirrorMode={isMirrorMode}
                            onToggleMirrorMode={() => setIsMirrorMode(!isMirrorMode)}
                            strokeColor={strokeColor}
                            onStrokeColorChange={setStrokeColor}
                            strokeWidth={strokeWidth}
                            onStrokeWidthChange={setStrokeWidth}
                            fillColor={fillColor}
                            onFillColorChange={setFillColor}
                            spreadMode={spreadMode}
                            onToggleSpreadMode={() => handleSpreadModeChange(spreadMode === 'full' ? 'split' : 'full')}
                            showGuides={showGuides}
                            onToggleGuides={() => setShowGuides(!showGuides)}
                            onClearStrokes={handleClearAll}
                            onProcessLayout={handleProcessLayout}
                        />

                        <LayoutCanvas
                            page={dummyPage}
                            config={{
                                size: config?.size ?? '20x20',
                                backgroundColor: config?.backgroundColor ?? '#ffffff',
                                backgroundImage: config?.backgroundImage,
                                photoGap,
                                pageMargin,
                                cornerRadius
                            }}
                            onUpdatePage={handleUpdatePage}
                            advancedTemplate={selectedAdvancedTemplate}
                            // Vector Props
                            toolMode={toolMode}
                            vectorObjects={vectorObjects}
                            onUpdateVectorObjects={setVectorObjects}
                            selectedShapeIndices={selectedShapeIndices}
                            onSelectionChange={setSelectedShapeIndices}
                            isMirrorMode={isMirrorMode}
                            // Active Styles
                            activeStrokeColor={strokeColor}
                            activeStrokeWidth={strokeWidth}
                            activeFillColor={fillColor}
                            showGuides={showGuides}
                        />
                    </div>
                </div>

                {/* Right Sidebar */}
                <div className="w-[300px] border-l bg-background flex-shrink-0 z-10">
                    <LayoutSidebarRight
                        selectedLayout={selectedLayout}
                        onSelectLayout={handleLayoutChange}
                        onSelectAdvancedTemplate={handleSelectAdvancedTemplate}
                        selectedAdvancedTemplate={selectedAdvancedTemplate}
                        customTemplates={createdTemplates}
                        spreadMode={spreadMode}
                        onSpreadModeChange={handleSpreadModeChange}
                        config={config}
                        photoGap={photoGap}
                        onPhotoGapChange={handlePhotoGapChange}
                        pageMargin={pageMargin}
                        onPageMarginChange={handlePageMarginChange}
                        cornerRadius={cornerRadius}
                        onCornerRadiusChange={handleCornerRadiusChange}
                        useDummyPhotos={useDummyPhotos}
                        onUseDummyPhotosChange={handleUseDummyPhotosChange}
                        onEditAdvancedTemplate={(t, m) => handleSelectAdvancedTemplate(t, m, true)}
                        editingTemplateId={editingTemplateId}
                    />
                </div>
            </div>

            {/* 3. Full-Width Bottom Toolbar & Actions */}
            <div className="h-16 border-t bg-background grid grid-cols-[300px_1fr_300px] items-center px-6 shrink-0 z-20">
                {/* Left side empty placeholder to balance the grid for centering */}
                <div />

                {/* Spacing Controls (Center) */}
                <div className="flex items-center gap-10 justify-center">
                    {/* Photo Gap */}
                    <div className="flex items-center gap-4 min-w-[180px]">
                        <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Photo Gap</Label>
                        <div className="flex items-center gap-3 flex-1">
                            <Slider
                                min={0}
                                max={50}
                                step={1}
                                value={[photoGap]}
                                onValueChange={(vals) => handlePhotoGapChange(vals[0])}
                                className="w-24"
                            />
                            <Input
                                type="number"
                                className="w-10 h-7 text-[10px] text-center px-1 bg-muted/30"
                                value={photoGap}
                                min={0}
                                max={50}
                                onChange={(e) => handlePhotoGapChange(Math.max(0, Math.min(50, Number(e.target.value))))}
                            />
                        </div>
                    </div>

                    {/* Page Margin */}
                    <div className="flex items-center gap-4 min-w-[180px]">
                        <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Page Margin</Label>
                        <div className="flex items-center gap-3 flex-1">
                            <Slider
                                min={0}
                                max={50}
                                step={1}
                                value={[pageMargin]}
                                onValueChange={(vals) => handlePageMarginChange(vals[0])}
                                className="w-24"
                            />
                            <Input
                                type="number"
                                className="w-10 h-7 text-[10px] text-center px-1 bg-muted/30"
                                value={pageMargin}
                                min={0}
                                max={50}
                                onChange={(e) => handlePageMarginChange(Math.max(0, Math.min(50, Number(e.target.value))))}
                            />
                        </div>
                    </div>

                    {/* Corner Radius */}
                    <div className="flex items-center gap-4 min-w-[180px] hidden xl:flex">
                        <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Corner Radius</Label>
                        <div className="flex items-center gap-3 flex-1">
                            <Slider
                                min={0}
                                max={20}
                                step={1}
                                value={[cornerRadius]}
                                onValueChange={(vals) => handleCornerRadiusChange(vals[0])}
                                className="w-24"
                            />
                            <Input
                                type="number"
                                className="w-10 h-7 text-[10px] text-center px-1 bg-muted/30"
                                value={cornerRadius}
                                min={0}
                                max={20}
                                onChange={(e) => handleCornerRadiusChange(Math.max(0, Math.min(20, Number(e.target.value))))}
                            />
                        </div>
                    </div>

                    {/* Dummy Photos Toggle */}
                    <div className="flex items-center gap-3 pl-4 border-l hidden 2xl:flex">
                        <Switch
                            id="dummy-photos-bottom"
                            checked={useDummyPhotos}
                            onCheckedChange={handleUseDummyPhotosChange}
                        />
                        <Label htmlFor="dummy-photos-bottom" className="text-xs font-semibold whitespace-nowrap cursor-pointer">
                            Sample Photos
                        </Label>
                    </div>
                </div>

                {/* Action Buttons (Right) */}
                <div className="flex items-center gap-3 justify-end">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancel}
                        className="gap-2 text-muted-foreground hover:text-foreground h-9 px-4"
                    >
                        <X className="h-4 w-4" /> Cancel
                    </Button>
                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleSave}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 min-w-[130px] h-9"
                    >
                        <Check className="h-4 w-4" /> Save Template
                    </Button>
                </div>
            </div>
        </div>
    );
};
