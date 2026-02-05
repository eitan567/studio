import React, { useState, useEffect, useCallback } from 'react';
import { AlbumPage, AlbumConfig } from '@/lib/types';
import { LayoutSidebarLeft, ToolMode } from './layout-sidebar-left';
import { LayoutSidebarRight } from './layout-sidebar-right';
import { LayoutCanvas } from './layout-canvas';
import { Button } from '@/components/ui/button';
import { Check, X, Layout } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useTemplates, getPhotoCount } from '@/hooks/useTemplates';
import { AdvancedTemplate } from '@/lib/advanced-layout-types';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { processLayoutGeometry, Segment, Point } from '@/lib/layout-geometry';
import { createClient } from '@/lib/supabase';
import { invalidateCache } from '@/lib/templates-cache';

interface CustomLayoutEditorOverlayProps {
    onClose: () => void;
    config?: AlbumConfig;
    customTemplates?: AdvancedTemplate[];
    onAddTemplate?: (template: AdvancedTemplate) => void;
}

export const CustomLayoutEditorOverlay = ({ onClose, config, customTemplates, onAddTemplate }: CustomLayoutEditorOverlayProps) => {
    const { findGridTemplate, defaultGridTemplate } = useTemplates();

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
    const [strokes, setStrokes] = useState<Segment[]>([]);
    const [currentStroke, setCurrentStroke] = useState<Segment | null>(null);
    const [currentPath, setCurrentPath] = useState<Point[]>([]);
    const [isMirrorMode, setIsMirrorMode] = useState(false);

    // Handle advanced template selection
    const handleSelectAdvancedTemplate = (template: AdvancedTemplate) => {
        setSelectedAdvancedTemplate(template);
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
        setDummyPage(prev => ({
            ...createDummyPage(layoutId, useDummyPhotos),
            photoGap,
            pageMargin,
            spreadMode
        }));
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

                // Prepare templates for insertion
                const templatesToInsert = createdTemplates.map(template => ({
                    id: template.id,
                    name: template.name,
                    category_id: 1, // Will be set based on category
                    photo_count: template.photoCount,
                    regions: template.regions,
                    created_by: userId,
                    is_system: false,
                    is_active: true,
                    sort_order: 999,
                    // Store page settings as JSON in description or separate field
                    description: JSON.stringify({
                        _pageMargin: template._pageMargin,
                        _photoGap: template._photoGap,
                        type: template.type
                    })
                }));

                // Upsert templates into Supabase
                const { error } = await supabase
                    .from('templates')
                    .upsert(templatesToInsert, { onConflict: 'id' });

                if (error) {
                    console.error('Error saving templates:', error);
                    throw error;
                }

                // Invalidate cache so templates are reloaded
                invalidateCache();

                console.log('Templates saved successfully to Supabase');
            } catch (error) {
                console.error('Failed to save templates to Supabase:', error);
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

    // Clear strokes and reset canvas for new template creation
    const handleClearAll = useCallback(() => {
        setStrokes([]);
        setCurrentStroke(null);
        setCurrentPath([]);
        // Clear the selected template so user can create a new one
        setSelectedAdvancedTemplate(null);
        setToolMode('select');
    }, []);

    // Process the drawn strokes into regions
    const handleProcessLayout = useCallback(() => {
        if (strokes.length === 0) return;

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

        // Core Geometry Calculation - Pass gap=0 so regions fill the entire page
        // The gap will be applied when the template is used in the album, not during creation
        const newRegions = processLayoutGeometry(strokes, 0, logicalWidthUnits);

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
            regions: newRegions,
            photoCount: newRegions.length,
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
        setStrokes([]);
    }, [strokes, config?.size, selectedAdvancedTemplate, handleSelectAdvancedTemplate, createdTemplates.length, pageMargin, photoGap]);

    return (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-8">
            <div className="w-full h-full max-w-[1800px] bg-background border shadow-2xl rounded-xl flex overflow-hidden">
                {/* 1. Left Sidebar */}
                <LayoutSidebarLeft
                    onSave={handleSave}
                    onCancel={handleCancel}
                    selectedAdvancedTemplate={selectedAdvancedTemplate}
                    onSelectAdvancedTemplate={handleSelectAdvancedTemplate}
                    customTemplates={createdTemplates}
                    onAddTemplate={onAddTemplate}
                    // New Vector Props
                    toolMode={toolMode}
                    onToolChange={setToolMode}
                    onClearStrokes={handleClearAll}
                    onProcessLayout={handleProcessLayout}
                    isMirrorMode={isMirrorMode}
                    onToggleMirrorMode={() => setIsMirrorMode(!isMirrorMode)}
                />

                {/* 2. Main Content Area (Canvas) */}
                <div className="flex flex-col flex-1 relative bg-muted/10 h-full">

                    {/* Toolbar */}
                    <div className="h-14 border-b bg-background flex items-center justify-between px-4 gap-4 shadow-sm z-10">
                        <div className="flex items-center gap-3">
                            <Layout className="h-5 w-5 text-primary" />
                            <span className="font-semibold">Custom Layout Editor</span>
                            <span className="text-xs text-muted-foreground ml-2 border-l pl-2">
                                Mode: <span className="font-medium text-foreground uppercase">{toolMode}</span>
                            </span>
                        </div>

                        <div className="text-sm text-muted-foreground">
                            Preview your layout template
                        </div>
                    </div>

                    {/* Canvas */}
                    <div className="flex-1 relative overflow-hidden">
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
                            strokes={strokes}
                            onUpdateStrokes={setStrokes}
                            isMirrorMode={isMirrorMode}
                        />
                    </div>

                    {/* Bottom Toolbar */}
                    <div className="h-14 border-t bg-background flex items-center justify-between px-4 z-10 shrink-0">
                        <div className="text-xs text-muted-foreground">
                            Create and preview custom layout templates for your album pages.
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
                </div>

                {/* 3. Right Sidebar (Properties) */}
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
    );
};
