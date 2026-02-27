'use client';

import React, { useState, useEffect } from 'react';
import {
    ChevronLeft,
    Loader2,
    Cloud,
    Save,
    BookOpen,
    Layout,
    Download,
    Upload,
    Share2,
    Check,
    X,
    Pencil,
    Shield,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModeToggle } from '@/components/mode-toggle';
import { AdminSettingsDialog } from '@/components/admin/admin-settings-dialog';
import { UserNav } from '@/components/user-nav';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface AlbumEditorToolbarProps {
    albumName: string;
    onUpdateName: (name: string) => void;
    saveStatus: 'saving' | 'unsaved' | 'saved' | 'uploading';
    onBack: () => void;
    onOpenBookView: () => void;
    onOpenCustomLayout: () => void;
    onExportBackup: () => void;
    onImportBackup: () => void;
    isImportingBackup?: boolean;
    showManualSaveButton?: boolean;
    onSaveNow?: () => void;
    disableManualSaveButton?: boolean;
    onExport: () => void;
    isExporting: boolean;
    onShare: () => void;
}

export function AlbumEditorToolbar({
    albumName,
    onUpdateName,
    saveStatus,
    onBack,
    onOpenBookView,
    onOpenCustomLayout,
    onExportBackup,
    onImportBackup,
    isImportingBackup = false,
    showManualSaveButton = false,
    onSaveNow,
    disableManualSaveButton = false,
    onExport,
    isExporting,
    onShare,
}: AlbumEditorToolbarProps) {
    const { isAdmin } = useAuth();
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editedTitle, setEditedTitle] = useState(albumName);
    const [adminOpen, setAdminOpen] = useState(false);

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
                    {saveStatus === 'uploading' ? (
                        <>
                            <Loader2 className="h-3 w-3 animate-spin text-primary" />
                            <span className="text-primary font-medium italic">Uploading...</span>
                        </>
                    ) : saveStatus === 'saving' ? (
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
                <TooltipProvider>
                    {/* Admin + Custom Layout Buttons */}
                    {isAdmin && (
                        <>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                                        onClick={onOpenCustomLayout}
                                        aria-label="Custom Layout"
                                    >
                                        <Layout className="h-5 w-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Custom Layout</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                        onClick={() => setAdminOpen(true)}
                                        aria-label="Admin Panel"
                                    >
                                        <Shield className="h-5 w-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Admin Panel</TooltipContent>
                            </Tooltip>
                            <AdminSettingsDialog open={adminOpen} onOpenChange={setAdminOpen} />
                        </>
                    )}
                </TooltipProvider>
                <ModeToggle />
                <div className="h-4 w-px bg-border mx-1" />
                <Button variant="outline" className="gap-2 bg-background" onClick={onOpenBookView}>
                    <BookOpen className="h-4 w-4" />
                    <span className="hidden sm:inline">Book View</span>
                </Button>
                <div className="h-4 w-px bg-border mx-1" />
                <Button variant="ghost" size="sm" className="gap-2" onClick={onExportBackup}>
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Backup</span>
                </Button>
                <Button variant="ghost" size="sm" className="gap-2" onClick={onImportBackup} disabled={isImportingBackup}>
                    {isImportingBackup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    <span className="hidden sm:inline">{isImportingBackup ? 'Restoring...' : 'Restore'}</span>
                </Button>
                <div className="h-4 w-px bg-border mx-1" />
                {showManualSaveButton && (
                    <>
                        <Button
                            variant="secondary"
                            size="sm"
                            className="gap-2"
                            onClick={onSaveNow}
                            disabled={disableManualSaveButton}
                        >
                            <Save className="h-4 w-4" />
                            <span className="hidden sm:inline">Save</span>
                        </Button>
                        <div className="h-4 w-px bg-border mx-1" />
                    </>
                )}
                <Button variant="ghost" size="sm" className="gap-2" onClick={onExport} disabled={isExporting}>
                    {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export'}</span>
                </Button>
                <div className="h-4 w-px bg-border mx-1" />
                <Button variant="ghost" size="sm" className="gap-2" onClick={onShare}>
                    <Share2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Share</span>
                </Button>
                <div className="h-4 w-px bg-border mx-1" />
                <UserNav showSettingsLink={false} />
            </div>
        </div >
    );
}
