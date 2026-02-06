import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AlbumPage, AlbumConfig } from '@/lib/types';
import { LayoutSidebarLeft, ToolMode } from './layout-sidebar-left';
import { LayoutSidebarRight } from './layout-sidebar-right';
import { LayoutCanvas } from './layout-canvas';
import { Button } from '@/components/ui/button';
import { Check, X, Layout } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useTemplates, getPhotoCount } from '@/hooks/useTemplates';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { processLayoutGeometry } from '@/lib/layout-geometry';
import { createClient } from '@/lib/supabase';
import { invalidateCache } from '@/lib/templates-cache';
import { VectorObject, Point, Segment, LayoutRegion, AdvancedTemplate } from '@/lib/advanced-layout-types';

interface CustomLayoutEditorOverlayProps {
    onClose: () => void;
    config?: AlbumConfig;
    customTemplates?: AdvancedTemplate[];
    onAddTemplate?: (template: AdvancedTemplate) => void;
}

export const CustomLayoutEditorOverlay = ({ onClose, config, customTemplates, onAddTemplate }: CustomLayoutEditorOverlayProps) => {
    const { findGridTemplate, defaultGridTemplate, allTemplates } = useTemplates();

    // Load existing custom templates from cache on mount
    const existingCustomTemplates = useMemo(() => {
        return allTemplates.filter(t => t.createdBy === 'user' || t.isCustom);
    }, [allTemplates]);

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
            spreadMode: 'split',
            spreadLayouts: {
                left: layoutId,
                right: layoutId
            },
            photoGap: photoGap,
            pageMargin: pageMargin
        };
    };


    const [selectedLayout, setSelectedLayout] = useState('4-grid');
    const [spreadMode, setSpreadMode] = useState<'full' | 'split'>('split');
    const [photoGap, setPhotoGap] = useState(() => config?.photoGap ?? 2);
    const [pageMargin, setPageMargin] = useState(() => config?.pageMargin ?? 0);
    const [cornerRadius, setCornerRadius] = useState(() => config?.cornerRadius ?? 0);
    const [useDummyPhotos, setUseDummyPhotos] = useState(true);
    const [dummyPage, setDummyPage] = useState<AlbumPage>(() => createDummyPage('4-grid', true));
    const [selectedAdvancedTemplate, setSelectedAdvancedTemplate] = useState<AdvancedTemplate | null>(null);

    // VECTOR TOOLS STATE
    const [toolMode, setToolMode] = useState<ToolMode>('select');
    const [vectorObjects, setVectorObjects] = useState<VectorObject[]>([]);
    const [currentStroke, setCurrentStroke] = useState<Segment | null>(null);
    const [currentPath, setCurrentPath] = useState<Point[]>([]);
    const [isMirrorMode, setIsMirrorMode] = useState(false);
    const [selectedShapeIndices, setSelectedShapeIndices] = useState<number[]>([]);

    // Vector Properties State
    const [strokeColor, setStrokeColor] = useState('#000000');
    const [strokeWidth, setStrokeWidth] = useState(0.5);
    const [fillColor, setFillColor] = useState('transparent');

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
    const handleSelectAdvancedTemplate = (template: AdvancedTemplate) => {
        setSelectedAdvancedTemplate(template);

        // Convert template regions to VectorObjects for interactivity
        const newVectorObjects: VectorObject[] = template.regions.map((region, index) => {
            const isPath = region.shape === 'path';
            const points: Point[] = region.points || [];

            // For path objects, generate a bounding box to allow manipulation (points will be used for translation)
            let pathPoints: Point[] | undefined = undefined;
            if (isPath) {
                const { x, y, width, height } = region.bounds;
                pathPoints = [[x, y], [x + width, y], [x + width, y + height], [x, y + height]];
            }

            // For polygons, generate segments
            const segments: Segment[] = [];
            if (!isPath && points.length > 1) {
                for (let i = 0; i < points.length - 1; i++) {
                    segments.push({ p1: points[i], p2: points[i + 1] });
                }
                // Close polygon if needed
                if (points.length > 2 && (points[0][0] !== points[points.length - 1][0] || points[0][1] !== points[points.length - 1][1])) {
                    segments.push({ p1: points[points.length - 1], p2: points[0] });
                }
            } else if (!isPath && region.shape === 'rect') {
                const { x, y, width, height } = region.bounds;
                const rectPoints: Point[] = [[x, y], [x + width, y], [x + width, y + height], [x, y + height]];
                for (let i = 0; i < 4; i++) {
                    segments.push({ p1: rectPoints[i], p2: rectPoints[(i + 1) % 4] });
                }
            }

            return {
                id: region.id || uuidv4(),
                type: isPath ? 'path' : (region.shape === 'rect' ? 'rect' : (region.shape === 'circle' ? 'circle' : 'polygon')),
                segments,
                points: isPath ? pathPoints : points,
                path: region.path,
                viewBox: region.viewBox,
                stroke: region.stroke || '#000000',
                strokeWidth: region.strokeWidth || 0.5,
                fill: region.fill || 'transparent',
                zIndex: region.zIndex || index,
                rotation: region.rotation || 0
            };
        });

        setVectorObjects(newVectorObjects);

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
            spreadMode
        }));
    };

    // Update dummy page when layout changes
    const handleLayoutChange = (layoutId: string) => {
        setSelectedLayout(layoutId);

        // Find the full template object to set selectedAdvancedTemplate
        const template = allTemplates.find(t => String(t.id) === String(layoutId));
        if (template) {
            handleSelectAdvancedTemplate(template);
        } else {
            setDummyPage(prev => ({
                ...createDummyPage(layoutId, useDummyPhotos),
                photoGap,
                pageMargin,
                spreadMode
            }));
        }
    };

    // Handle adding a Canva frame shape to the canvas as a VectorObject
    const handleAddCanvaFrame = (template: AdvancedTemplate) => {
        // Add only the first region as a draggable frame shape
        // We scale it to be placed at a reasonable size on the canvas
        const firstRegion = template.regions[0];
        if (!firstRegion || !firstRegion.path) return;

        // Default size for added frame (in canvas coordinate units)
        // Canvas uses 0-100 height with aspect ratio applied to width
        const frameWidth = 30;
        const frameHeight = 30;

        // Center position on canvas
        const centerX = 35; // Slightly left of center to account for aspect ratio
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
            stroke: strokeColor !== 'transparent' ? strokeColor : '#333333',
            strokeWidth: strokeWidth > 0 ? strokeWidth : 0.5,
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

                // Prepare templates for insertion
                const templatesToInsert = createdTemplates.map(template => {
                    // New templates have UUID strings, existing DB templates have integer IDs
                    const isNew = typeof template.id === 'string' && template.id.includes('-');

                    // Map type to type_id
                    let typeId = 3; // default BOTH
                    if (template.type === 'single') typeId = 1;
                    if (template.type === 'spread') typeId = 2;

                    const baseTemplate = {
                        name: template.name,
                        category_id: 5, // CUSTOM category
                        photo_count: template.photoCount,
                        regions: template.regions,
                        created_by: userId === 'anonymous' ? null : userId,
                        is_system: false,
                        is_active: true,
                        sort_order: 999,
                        type_id: typeId
                    };

                    // Generate new integer ID for new templates
                    if (isNew) {
                        const newIntegerId = nextId++;
                        return { ...baseTemplate, id: newIntegerId, _isNew: true };
                    } else {
                        return { ...baseTemplate, id: template.id, _isNew: false };
                    }
                });

                // Since some might be new (no ID) and some updates, we might need separate calls
                // or use a logic that works for both. 
                // If we want auto-increment, we use insert for new ones and update for existing.

                const newTemplates = templatesToInsert.filter(t => (t as any)._isNew).map(({ _isNew, ...rest }) => rest);
                const existingTemplates = templatesToInsert.filter(t => !(t as any)._isNew).map(({ _isNew, ...rest }) => rest);

                if (newTemplates.length > 0) {
                    const { data: insertedData, error: insertError } = await supabase
                        .from('templates')
                        .insert(newTemplates)
                        .select();

                    if (insertError) throw insertError;

                    // Update the local state with the returned IDs from DB
                    if (insertedData) {
                        setCreatedTemplates(prev => {
                            const updated = [...prev];
                            insertedData.forEach((dbT: any) => {
                                // Match by name and regions or something since we don't have ID matching easily
                                // Better: we only have one 'createdTemplates' usually
                                if (updated.length === 1 && insertedData.length === 1) {
                                    updated[0].id = dbT.id;
                                }
                            });
                            return updated;
                        });
                    }
                }

                if (existingTemplates.length > 0) {
                    const { error: updateError } = await supabase
                        .from('templates')
                        .upsert(existingTemplates, { onConflict: 'id' });

                    if (updateError) throw updateError;
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
        setCurrentPath([]);
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
        const targetTemplate: AdvancedTemplate = selectedAdvancedTemplate || {
            id: uuidv4(),
            name: `Custom Template ${templateCount}`,
            category: 'custom',
            regions: [],
            photoCount: 0,
            isCustom: true,
            createdBy: 'user',
            type: spreadMode === 'full' ? 'spread' : 'single',
            _pageMargin: pageMargin,
            _photoGap: photoGap
        };

        const updated: AdvancedTemplate = {
            ...targetTemplate,
            regions: updatedRegions,
            photoCount: updatedRegions.length,
            type: spreadMode === 'full' ? 'spread' : 'single',
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
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
            {/* 1. Header */}
            <div className="h-16 border-b flex items-center justify-between px-6 bg-card shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Layout className="h-5 w-5 text-primary" />
                        <span className="font-semibold text-lg">Custom Layout Editor</span>
                    </div>
                    <span className="text-sm text-muted-foreground border-l pl-4 hidden sm:inline-block">
                        Mode: <span className="font-medium text-foreground uppercase">{toolMode}</span>
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={handleCancel}
                        className="gap-2"
                    >
                        <X className="h-4 w-4" /> Cancel
                    </Button>
                    <Button
                        variant="default"
                        onClick={handleSave}
                        className="bg-green-600 hover:bg-green-700 text-white gap-2"
                    >
                        <Check className="h-4 w-4" /> Save Layout
                    </Button>
                </div>
            </div>

            {/* 2. Main Workspace */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar */}
                <div className="border-r bg-background h-full shrink-0 flex">
                    <LayoutSidebarLeft
                        onSave={handleSave}
                        onCancel={handleCancel}
                        selectedAdvancedTemplate={selectedAdvancedTemplate}
                        onSelectAdvancedTemplate={handleSelectAdvancedTemplate}
                        customTemplates={[...existingCustomTemplates, ...createdTemplates]}
                        onAddTemplate={onAddTemplate}
                        // New Vector Props
                        toolMode={toolMode}
                        onToolChange={setToolMode}
                        onClearStrokes={handleClearAll}
                        onProcessLayout={handleProcessLayout}
                        isMirrorMode={isMirrorMode}
                        onToggleMirrorMode={() => setIsMirrorMode(!isMirrorMode)}
                        // Property Controls
                        strokeColor={strokeColor}
                        onStrokeColorChange={setStrokeColor}
                        strokeWidth={strokeWidth}
                        onStrokeWidthChange={setStrokeWidth}
                        fillColor={fillColor}
                        onFillColorChange={setFillColor}
                        // Canva Frame Shapes
                        onAddCanvaFrame={handleAddCanvaFrame}
                    />
                </div>

                {/* Main Content Area (Canvas) */}
                <div className="flex-1 relative bg-muted/10 h-full overflow-hidden">
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
                    />
                </div>

                {/* Right Sidebar (Properties) */}
                <div className="border-l bg-background h-full shrink-0 flex">
                    <LayoutSidebarRight
                        selectedLayout={selectedLayout}
                        onSelectLayout={handleLayoutChange}
                        spreadMode={spreadMode}
                        onSpreadModeChange={handleSpreadModeChange}
                        photoGap={photoGap}
                        onPhotoGapChange={handlePhotoGapChange}
                        pageMargin={pageMargin}
                        onPageMarginChange={handlePageMarginChange}
                        cornerRadius={cornerRadius}
                        onCornerRadiusChange={handleCornerRadiusChange}
                        useDummyPhotos={useDummyPhotos}
                        onUseDummyPhotosChange={handleUseDummyPhotosChange}
                    />
                </div>
            </div>
        </div>
    );
};
