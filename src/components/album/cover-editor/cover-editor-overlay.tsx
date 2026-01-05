import React, { useState } from 'react';
import { AlbumPage, CoverText, Photo, PhotoPanAndZoom } from '@/lib/types';
import { SidebarLeft } from './sidebar-left';
import { SidebarRight } from './sidebar-right';
import { CoverCanvas } from './cover-canvas';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface CoverEditorOverlayProps {
    page: AlbumPage;
    onUpdatePage: (page: AlbumPage) => void;
    onClose: () => void;
    allPhotos?: Photo[];
}

export const CoverEditorOverlay = ({ page, onUpdatePage, onClose, allPhotos }: CoverEditorOverlayProps) => {
    // 1. Local State for Transactional Editing
    const [localPage, setLocalPage] = useState<AlbumPage>(page);
    const [activeView, setActiveView] = useState<'front' | 'back' | 'full'>('full');
    const [activeTextId, setActiveTextId] = useState<string | null>(null);

    // 2. Handle Save
    const handleSave = () => {
        onUpdatePage(localPage);
        onClose();
    };

    // 3. Handle Cancel
    const handleCancel = () => {
        onClose(); // Discard local changes
    };

    // Helper to update texts
    const updateTexts = (newTexts: CoverText[]) => {
        setLocalPage({ ...localPage, coverTexts: newTexts });
    };

    const handleAddText = () => {
        const newText: CoverText = {
            id: crypto.randomUUID(),
            text: 'New Text',
            x: 50,
            y: 50,
            style: {
                fontFamily: 'Inter',
                fontSize: 24,
                color: '#000000',
            },
        };
        updateTexts([...(localPage.coverTexts || []), newText]);
        setActiveTextId(newText.id);
    };

    const handleDropPhoto = (pageId: string, targetPhotoId: string, droppedPhotoId: string) => {
        if (!allPhotos) return;
        const droppedPhoto = allPhotos.find(p => p.id === droppedPhotoId);
        if (!droppedPhoto) return;

        // Transactional update on localPage
        setLocalPage(prevPage => {
            const newPhotos = prevPage.photos.map(p => {
                if (p.id === targetPhotoId) {
                    return {
                        ...droppedPhoto,
                        id: targetPhotoId, // Keep slot ID
                        panAndZoom: { scale: 1, x: 50, y: 50 } // Reset pan/zoom
                    };
                }
                return p;
            });
            return { ...prevPage, photos: newPhotos };
        });
    };

    const handleUpdatePhotoPanAndZoom = (pageId: string, photoId: string, panAndZoom: PhotoPanAndZoom) => {
        setLocalPage(prevPage => ({
            ...prevPage,
            photos: prevPage.photos.map(p =>
                p.id === photoId ? { ...p, panAndZoom } : p
            )
        }));
    };

    return (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex">
            {/* Overlay Close Button (Acts as Cancel) */}
            <div className="absolute top-4 right-4 z-50">
                <Button variant="ghost" size="icon" onClick={handleCancel}>
                    <X className="h-6 w-6" />
                </Button>
            </div>

            <SidebarLeft
                onAddText={handleAddText}
                activeView={activeView}
                onViewChange={setActiveView}
                onSave={handleSave}
                onCancel={handleCancel}
            />

            <main className="flex-1 overflow-hidden relative flex items-center justify-center p-8">
                <CoverCanvas
                    page={localPage}
                    activeView={activeView}
                    activeTextId={activeTextId}
                    onSelectText={setActiveTextId}
                    onUpdatePage={setLocalPage}
                    onDropPhoto={handleDropPhoto}
                    onUpdatePhotoPanAndZoom={handleUpdatePhotoPanAndZoom}
                />
            </main>

            <SidebarRight
                page={localPage}
                activeTextId={activeTextId}
                onUpdatePage={setLocalPage}
            />
        </div>
    );
};
