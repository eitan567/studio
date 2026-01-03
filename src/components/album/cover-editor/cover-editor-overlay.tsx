import React, { useState } from 'react';
import { AlbumPage, CoverText } from '@/lib/types';
import { SidebarLeft } from './sidebar-left';
import { SidebarRight } from './sidebar-right';
import { CoverCanvas } from './cover-canvas';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface CoverEditorOverlayProps {
    page: AlbumPage;
    onUpdatePage: (page: AlbumPage) => void;
    onClose: () => void;
}

export const CoverEditorOverlay = ({ page, onUpdatePage, onClose }: CoverEditorOverlayProps) => {
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
