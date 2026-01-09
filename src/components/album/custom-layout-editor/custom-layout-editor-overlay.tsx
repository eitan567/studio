import React, { useState } from 'react';
import { AlbumPage, AlbumConfig } from '@/lib/types';
import { LayoutSidebarLeft } from './layout-sidebar-left';
import { LayoutSidebarRight } from './layout-sidebar-right';
import { LayoutCanvas } from './layout-canvas';
import { Button } from '@/components/ui/button';
import { Check, X, Layout } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { LAYOUT_TEMPLATES } from '../layout-templates';

interface CustomLayoutEditorOverlayProps {
    onClose: () => void;
    config?: AlbumConfig;
}

export const CustomLayoutEditorOverlay = ({ onClose, config }: CustomLayoutEditorOverlayProps) => {
    // Create a dummy page with empty or sample photo slots
    const createDummyPage = (layoutId: string, useDummy: boolean = false): AlbumPage => {
        const template = LAYOUT_TEMPLATES.find(t => t.id === layoutId) || LAYOUT_TEMPLATES[0];
        const totalPhotos = template.photoCount * 2; // For both pages of spread

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
            photoGap: 10,
            pageMargin: 10
        };
    };


    const [selectedLayout, setSelectedLayout] = useState('4-grid');
    const [spreadMode, setSpreadMode] = useState<'full' | 'split'>('split');
    const [photoGap, setPhotoGap] = useState(10);
    const [pageMargin, setPageMargin] = useState(10);
    const [useDummyPhotos, setUseDummyPhotos] = useState(true);
    const [dummyPage, setDummyPage] = useState<AlbumPage>(() => createDummyPage('4-grid', true));

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

    const handleSave = () => {
        // For now, just close - future: save custom layout template
        onClose();
    };

    const handleCancel = () => {
        onClose();
    };

    const handleUpdatePage = (page: AlbumPage) => {
        setDummyPage(page);
    };

    return (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-8">
            <div className="w-full h-full max-w-[1800px] bg-background border shadow-2xl rounded-xl flex overflow-hidden">
                {/* 1. Left Sidebar */}
                <LayoutSidebarLeft
                    onSave={handleSave}
                    onCancel={handleCancel}
                />

                {/* 2. Main Content Area (Canvas) */}
                <div className="flex flex-col flex-1 relative bg-muted/10 h-full">

                    {/* Toolbar */}
                    <div className="h-14 border-b bg-background flex items-center justify-between px-4 gap-4 shadow-sm z-10">
                        <div className="flex items-center gap-3">
                            <Layout className="h-5 w-5 text-primary" />
                            <span className="font-semibold">Custom Layout Editor</span>
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
                                pageMargin
                            }}
                            onUpdatePage={handleUpdatePage}
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
                    useDummyPhotos={useDummyPhotos}
                    onUseDummyPhotosChange={handleUseDummyPhotosChange}
                />
            </div>
        </div>
    );
};
