'use client';

import React, { useState, useEffect } from 'react';
import {
    ChevronLeft,
    Loader2,
    Cloud,
    BookOpen,
    Layout,
    FileImage,
    FileText,
    Share2,
    LogOut,
    Check,
    X,
    Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModeToggle } from '@/components/mode-toggle';
import { cn } from '@/lib/utils';

interface AlbumEditorToolbarProps {
    albumName: string;
    onUpdateName: (name: string) => void;
    saveStatus: 'saving' | 'unsaved' | 'saved';
    onBack: () => void;
    onOpenBookView: () => void;
    onOpenCustomLayout: () => void;
    onExportImages: () => void;
    onExportPdf: () => void;
    isExporting: boolean;
    onShare: () => void;
    onLogout: () => void;
}

export function AlbumEditorToolbar({
    albumName,
    onUpdateName,
    saveStatus,
    onBack,
    onOpenBookView,
    onOpenCustomLayout,
    onExportImages,
    onExportPdf,
    isExporting,
    onShare,
    onLogout,
}: AlbumEditorToolbarProps) {
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editedTitle, setEditedTitle] = useState(albumName);

    // Sync edited title when album name changes externally
    useEffect(() => {
        setEditedTitle(albumName);
    }, [albumName]);

    const handleSaveTitle = () => {
        if (editedTitle.trim()) {
            onUpdateName(editedTitle.trim());
            setIsEditingTitle(false);
        }
    };

    const handleCancelTitleEdit = () => {
        setEditedTitle(albumName);
        setIsEditingTitle(false);
    };

    return (
        <div className="flex justify-between items-center px-6 py-3 border-b bg-background sticky top-0 z-50">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onBack}>
                    <ChevronLeft className="h-5 w-5" />
                </Button>

                <div className="flex items-center gap-4 text-lg">
                    <span className="text-muted-foreground hidden md:inline">Editing</span>

                    {isEditingTitle ? (
                        <div className="flex items-center gap-1">
                            <Input
                                value={editedTitle}
                                onChange={(e) => setEditedTitle(e.target.value)}
                                className="h-8 w-48 lg:w-64"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveTitle();
                                    if (e.key === 'Escape') handleCancelTitleEdit();
                                }}
                            />
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={handleSaveTitle}>
                                <Check className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={handleCancelTitleEdit}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 group">
                            <span className="heading-sm">{albumName}</span>
                            <Pencil
                                className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-foreground opacity-50 group-hover:opacity-100 transition-opacity"
                                onClick={() => setIsEditingTitle(true)}
                            />
                        </div>
                    )}
                </div>

                {/* Save Status Indicator */}
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    {saveStatus === 'saving' ? (
                        <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Saving...</span>
                        </>
                    ) : saveStatus === 'unsaved' ? (
                        <>
                            <Cloud className="h-3 w-3" />
                            <span>Unsaved</span>
                        </>
                    ) : (
                        <>
                            <Cloud className="h-3 w-3 text-green-500" />
                            <span className="text-green-600">Saved</span>
                        </>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2">
                <ModeToggle />
                <div className="h-4 w-px bg-border mx-1" />
                <Button variant="outline" className="gap-2 bg-background" onClick={onOpenBookView}>
                    <BookOpen className="h-4 w-4" />
                    <span className="hidden sm:inline">Book View</span>
                </Button>
                <Button variant="outline" className="gap-2 bg-background" onClick={onOpenCustomLayout}>
                    <Layout className="h-4 w-4" />
                    <span className="hidden sm:inline">Custom Layout</span>
                </Button>
                <div className="h-4 w-px bg-border mx-1" />
                <Button variant="ghost" size="sm" className="gap-2" onClick={onExportImages} disabled={isExporting}>
                    {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileImage className="h-4 w-4" />}
                    <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export to Images'}</span>
                </Button>
                <Button variant="ghost" size="sm" className="gap-2" onClick={onExportPdf}>
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">Export to PDF</span>
                </Button>
                <div className="h-4 w-px bg-border mx-1" />
                <Button variant="ghost" size="sm" className="gap-2" onClick={onShare}>
                    <Share2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Share</span>
                </Button>
                <div className="h-4 w-px bg-border mx-1" />
                <Button variant="ghost" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={onLogout}>
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Logout</span>
                </Button>
            </div>
        </div>
    );
}
