import React, { useState } from 'react';
import { AlbumPage, CoverText, Photo, PhotoPanAndZoom } from '@/lib/types';
import { SidebarLeft } from './sidebar-left';
import { SidebarRight } from './sidebar-right';
import { CoverCanvas } from './cover-canvas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
    X,
    Check,
    Type,
    AlignStartVertical,
    AlignVerticalJustifyCenter,
    AlignEndVertical,
    AlignHorizontalJustifyStart,
    AlignHorizontalJustifyCenter,
    AlignHorizontalJustifyEnd,
    AlignHorizontalDistributeCenter,
    AlignVerticalDistributeCenter,
    AlignStartHorizontal,
    AlignEndHorizontal,
    AlignHorizontalJustifyCenterIcon,
    AlignCenter,
    AlignCenterIcon,
    AlignCenterHorizontal,
    AlignCenterVertical
} from 'lucide-react';

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

    // --- Alignment Logic ---
    const handleAlign = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
        if (activeTextIds.length < 2) return;

        // Get active text objects
        const selectedTexts = localPage.coverTexts?.filter(t => activeTextIds.includes(t.id)) || [];
        if (selectedTexts.length < 2) return;

        let newTexts = [...(localPage.coverTexts || [])];

        if (type === 'left') {
            const minX = Math.min(...selectedTexts.map(t => t.x));
            newTexts = newTexts.map(t => activeTextIds.includes(t.id) ? { ...t, x: minX } : t);
        } else if (type === 'center') {
            const avgX = selectedTexts.reduce((sum, t) => sum + t.x, 0) / selectedTexts.length;
            newTexts = newTexts.map(t => activeTextIds.includes(t.id) ? { ...t, x: avgX } : t);
        } else if (type === 'right') {
            const maxX = Math.max(...selectedTexts.map(t => t.x));
            newTexts = newTexts.map(t => activeTextIds.includes(t.id) ? { ...t, x: maxX } : t);
        } else if (type === 'top') {
            const minY = Math.min(...selectedTexts.map(t => t.y));
            newTexts = newTexts.map(t => activeTextIds.includes(t.id) ? { ...t, y: minY } : t);
        } else if (type === 'middle') {
            const avgY = selectedTexts.reduce((sum, t) => sum + t.y, 0) / selectedTexts.length;
            newTexts = newTexts.map(t => activeTextIds.includes(t.id) ? { ...t, y: avgY } : t);
        } else if (type === 'bottom') {
            const maxY = Math.max(...selectedTexts.map(t => t.y));
            newTexts = newTexts.map(t => activeTextIds.includes(t.id) ? { ...t, y: maxY } : t);
        }

        setLocalPage({ ...localPage, coverTexts: newTexts });
    };

    const handleDistribute = (type: 'horizontal' | 'vertical') => {
        if (activeTextIds.length < 3) return; // Need 3 to distribute meaningfully usually

        const selectedTexts = localPage.coverTexts?.filter(t => activeTextIds.includes(t.id)) || [];
        if (selectedTexts.length < 3) return;

        let newTexts = [...(localPage.coverTexts || [])];

        if (type === 'horizontal') {
            // Sort by X
            const sorted = [...selectedTexts].sort((a, b) => a.x - b.x);
            const minX = sorted[0].x;
            const maxX = sorted[sorted.length - 1].x;
            const totalSpan = maxX - minX;
            const step = totalSpan / (sorted.length - 1);

            sorted.forEach((item, index) => {
                const newX = minX + (step * index);
                newTexts = newTexts.map(t => t.id === item.id ? { ...t, x: newX } : t);
            });
        } else if (type === 'vertical') {
            // Sort by Y
            const sorted = [...selectedTexts].sort((a, b) => a.y - b.y);
            const minY = sorted[0].y;
            const maxY = sorted[sorted.length - 1].y;
            const totalSpan = maxY - minY;
            const step = totalSpan / (sorted.length - 1);

            sorted.forEach((item, index) => {
                const newY = minY + (step * index);
                newTexts = newTexts.map(t => t.id === item.id ? { ...t, y: newY } : t);
            });
        }

        setLocalPage({ ...localPage, coverTexts: newTexts });
    };

    return (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-8">
            <div className="w-full h-full max-w-[1800px] bg-background border shadow-2xl rounded-xl flex overflow-hidden">
                {/* 1. Left Sidebar */}
                <SidebarLeft
                    onSave={handleSave}
                    onCancel={handleCancel}
                    page={localPage}
                    activeTextIds={activeTextIds}
                    onUpdatePage={setLocalPage}
                />

                {/* 2. Main Content Area (Canvas) */}
                <div className="flex flex-col flex-1 relative bg-muted/10 h-full">

                    {/* Toolbar */}
                    <div className="h-14 border-b bg-background flex items-center justify-between px-4 gap-4 shadow-sm z-10">

                        {/* Left Side: View Controls & Add Text */}
                        <div className="flex items-center gap-2 mr-auto">
                            <Button variant="outline" size="sm" className="gap-2 h-8" onClick={handleAddText}>
                                <Type className="h-4 w-4" /> Add Text
                            </Button>

                            {/* Selection Info (Integrated) */}
                            <div className="text-xs text-muted-foreground font-medium border-l pl-4 ml-2">
                                {activeTextIds.length > 0 ? `${activeTextIds.length} items selected` : ''}
                            </div>
                        </div>


                        {/* Right Side: Spacing & Alignment */}
                        <div className="flex items-center gap-4">

                            {/* Spacing Tools */}
                            <div className="flex items-center gap-4 border-r pr-4 mr-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-muted-foreground w-6">Gap</span>
                                    <Slider
                                        className="w-20"
                                        min={0}
                                        max={50}
                                        step={1}
                                        value={[localPage.photoGap ?? 0]}
                                        onValueChange={(vals) => setLocalPage({ ...localPage, photoGap: vals[0] })}
                                    />
                                    <Input
                                        type="number"
                                        className="w-12 h-7 text-xs px-1 text-center"
                                        min={0}
                                        max={50}
                                        value={localPage.photoGap ?? 0}
                                        onChange={(e) => setLocalPage({ ...localPage, photoGap: Math.max(0, Number(e.target.value)) })}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-muted-foreground w-10">Margin</span>
                                    <Slider
                                        className="w-20"
                                        min={0}
                                        max={50}
                                        step={1}
                                        value={[localPage.pageMargin ?? 0]}
                                        onValueChange={(vals) => setLocalPage({ ...localPage, pageMargin: vals[0] })}
                                    />
                                    <Input
                                        type="number"
                                        className="w-12 h-7 text-xs px-1 text-center"
                                        min={0}
                                        max={50}
                                        value={localPage.pageMargin ?? 0}
                                        onChange={(e) => setLocalPage({ ...localPage, pageMargin: Math.max(0, Number(e.target.value)) })}
                                    />
                                </div>
                            </div>

                            {/* Alignment Tools (Horizontal Actions) - Using Vertical Icons per user request */}
                            <div className="flex items-center gap-1 border-r pr-4 mr-0">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleAlign('left')} disabled={activeTextIds.length < 2} title="Align Left">
                                    <AlignStartVertical className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleAlign('center')} disabled={activeTextIds.length < 2} title="Align Center">
                                    <AlignCenterVertical className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleAlign('right')} disabled={activeTextIds.length < 2} title="Align Right">
                                    <AlignEndVertical className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Alignment Tools (Vertical Actions) - Using Horizontal Icons per user request */}
                            <div className="flex items-center gap-1 border-r pr-4 mr-0">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleAlign('top')} disabled={activeTextIds.length < 2} title="Align Top">
                                    <AlignStartHorizontal className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleAlign('middle')} disabled={activeTextIds.length < 2} title="Align Middle">
                                    <AlignCenterHorizontal className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleAlign('bottom')} disabled={activeTextIds.length < 2} title="Align Bottom">
                                    <AlignEndHorizontal className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Distribute Tools */}
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDistribute('horizontal')} disabled={activeTextIds.length < 3} title="Distribute Horizontally">
                                    <AlignHorizontalDistributeCenter className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDistribute('vertical')} disabled={activeTextIds.length < 3} title="Distribute Vertically">
                                    <AlignVerticalDistributeCenter className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Canvas */}
                    <div className="flex-1 relative overflow-hidden">
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
                    </div>

                    {/* Bottom Toolbar */}
                    <div className="h-14 border-t bg-background flex items-center justify-between px-4 z-10 shrink-0">
                        <div className="text-xs text-muted-foreground">
                            {/* Optional status or info */}
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
                                <Check className="h-4 w-4" /> Save Changes
                            </Button>
                        </div>
                    </div>
                </div>

                {/* 3. Right Sidebar (Properties) */}
                <SidebarRight
                    page={localPage}
                    onUpdatePage={setLocalPage}
                    activeView={activeView}
                    onSetActiveView={setActiveView}
                />
            </div>
        </div>
    );
};
