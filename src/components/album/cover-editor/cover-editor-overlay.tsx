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
    const [activeTextIds, setActiveTextIds] = useState<string[]>([]);

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
        const existingTexts = localPage.coverTexts || [];

        // 1. Calculate Next Number "New Text X"
        const regex = /^New Text (\d+)$/;
        let maxNum = 0;
        existingTexts.forEach(t => {
            const match = t.text.match(regex);
            if (match) {
                const num = parseInt(match[1]);
                if (!isNaN(num) && num > maxNum) maxNum = num;
            }
        });
        const nextNum = maxNum + 1;
        const newTextStr = `New Text ${nextNum}`;

        // 2. Calculate Offset Position
        // Find the last created/selected text to offset from, or default center
        // Default center: x: 50, y: 50
        let newX = 50;
        let newY = 50;

        // If there are existing texts, try to offset from the last one to avoid perfect overlap
        if (existingTexts.length > 0) {
            const lastText = existingTexts[existingTexts.length - 1];
            newX = lastText.x + 2; // +2% offset
            newY = lastText.y + 2; // +2% offset

            // Boundary checks to keep it somewhat reasonably on screen (optional but good)
            if (newX > 90) newX = 10;
            if (newY > 90) newY = 10;
        }

        // 3. Inherit Style from active text or last text
        let initialStyle = {
            fontFamily: 'Inter',
            fontSize: 24,
            color: '#000000',
        };

        const activeId = activeTextIds.length > 0 ? activeTextIds[activeTextIds.length - 1] : null;
        const referenceText = activeId
            ? existingTexts.find(t => t.id === activeId)
            : existingTexts.length > 0 ? existingTexts[existingTexts.length - 1] : null;

        if (referenceText) {
            initialStyle = { ...referenceText.style };
        }

        const newText: CoverText = {
            id: crypto.randomUUID(),
            text: newTextStr,
            x: newX,
            y: newY,
            style: initialStyle,
        };
        updateTexts([...existingTexts, newText]);
        setActiveTextIds([newText.id]);
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
                    activeTextIds={activeTextIds}
                    onSelectText={(target, isMulti) => {
                        const targets = Array.isArray(target) ? target : (target ? [target] : []);

                        if (targets.length === 0) {
                            if (!isMulti) setActiveTextIds([]);
                            return;
                        }

                        if (isMulti) {
                            setActiveTextIds(prev => {
                                const next = [...prev];
                                targets.forEach(t => {
                                    if (next.includes(t)) {
                                        // Toggle off if already selected? 
                                        // Standard behavior for Ctrl+Click on unselected is Add. On selected is Remove.
                                        // But if we selecting a GROUP, we probably want to add the whole group.
                                        // Let's assume if any in target is not selected, we add all. If all selected, we remove all?
                                        // Simplify: Just toggle individually for now, or add if not present.
                                        // Let's implement simple "Toggle" for single click, and "Union" for group click?
                                        // User said: "choose multiple ... with CTRL".
                                        const idx = next.indexOf(t);
                                        if (idx > -1) next.splice(idx, 1);
                                        else next.push(t);
                                    } else {
                                        next.push(t);
                                    }
                                });
                                return next;
                            });
                        } else {
                            setActiveTextIds(targets);
                        }
                    }}
                    onUpdatePage={setLocalPage}
                    onDropPhoto={handleDropPhoto}
                    onUpdatePhotoPanAndZoom={handleUpdatePhotoPanAndZoom}
                />
            </main>

            <SidebarRight
                page={localPage}
                activeTextIds={activeTextIds}
                onUpdatePage={setLocalPage}
            />
        </div>
    );
};
