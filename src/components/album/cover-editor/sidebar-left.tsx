import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Type,
    Check,
    X,
    Settings2,
    Trash2,
    Bold,
    Italic,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Search
} from 'lucide-react';
import { AlbumPage, CoverText } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { SpineColorPicker } from '../spine-color-picker';

const AVAILABLE_FONTS = ['Inter', 'Serif', 'Mono', 'Cursive', 'Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Impact'];

interface SidebarLeftProps {
    onSave: () => void;
    onCancel: () => void;
    page: AlbumPage;
    activeTextIds: string[];
    onUpdatePage: (page: AlbumPage) => void;
}

export const SidebarLeft = ({
    onSave,
    onCancel,
    page,
    activeTextIds,
    onUpdatePage
}: SidebarLeftProps) => {

    // --- Logic from SidebarRight ---
    const activeTexts = page.coverTexts?.filter(t => activeTextIds.includes(t.id)) || [];
    const activeText = activeTexts.length > 0 ? activeTexts[activeTexts.length - 1] : null;

    // Check grouping state
    const isMultiple = activeTexts.length > 1;
    const isLinked = activeTexts.some(t => !!t.groupId);

    const handleUpdateText = (updates: Partial<CoverText> | Partial<CoverText['style']>) => {
        if (activeTexts.length === 0 || !page.coverTexts) return;

        const newTexts = page.coverTexts.map(t => {
            if (!activeTextIds.includes(t.id)) return t;
            const isStyleUpdate = !('text' in updates);
            if (isStyleUpdate) {
                return { ...t, style: { ...t.style, ...updates } };
            }
            return { ...t, ...(updates as Partial<CoverText>) };
        });

        onUpdatePage({ ...page, coverTexts: newTexts });
    };

    const handleDeleteText = () => {
        if (activeTexts.length === 0 || !page.coverTexts) return;
        const newTexts = page.coverTexts.filter(t => !activeTextIds.includes(t.id));
        onUpdatePage({ ...page, coverTexts: newTexts });
    };

    const handleGroupTexts = () => {
        if (activeTexts.length === 0 || !page.coverTexts) return;
        const newGroupId = crypto.randomUUID();
        const newTexts = page.coverTexts.map(t => {
            if (activeTextIds.includes(t.id)) {
                return { ...t, groupId: newGroupId };
            }
            return t;
        });
        onUpdatePage({ ...page, coverTexts: newTexts });
    };

    const handleUngroupTexts = () => {
        if (activeTexts.length === 0 || !page.coverTexts) return;
        const newTexts = page.coverTexts.map(t => {
            if (activeTextIds.includes(t.id)) {
                const { groupId, ...rest } = t;
                return { ...rest, groupId: undefined };
            }
            return t;
        });
        onUpdatePage({ ...page, coverTexts: newTexts });
    };

    const hasSelection = activeTexts.length > 0;

    return (
        <div className="h-full z-20 flex bg-background">
            {/* Expandable Properties Panel - Always Visible */}
            <div className="w-72 bg-background flex flex-col border-r shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] transition-all duration-300">
                <div className="p-4 border-b h-14 flex items-center justify-between bg-accent/5">
                    <h2 className="font-semibold text-sm uppercase tracking-wider text-primary flex items-center gap-2">
                        <Settings2 className="w-4 h-4" /> Selected Text
                    </h2>
                    {hasSelection && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={handleDeleteText}
                            title="Delete Selection"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    )}
                </div>

                {hasSelection ? (
                    <>
                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {/* Grouping Actions */}
                            {(isMultiple || isLinked) && (
                                <div className="space-y-2">
                                    <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Grouping</Label>
                                    <div className="flex items-center gap-2">
                                        {isMultiple && (
                                            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-2" onClick={handleGroupTexts}>
                                                <Settings2 className="w-3.5 h-3.5" /> Group Selected
                                            </Button>
                                        )}
                                        {isLinked && (
                                            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-2 text-destructive hover:text-destructive" onClick={handleUngroupTexts}>
                                                <Trash2 className="w-3.5 h-3.5 rotate-45" /> Ungroup
                                            </Button>
                                        )}
                                    </div>
                                    <Separator className="my-2" />
                                </div>
                            )}

                            {/* Main Content Input */}
                            <div className="space-y-1.5">
                                <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Content</Label>
                                <Input
                                    value={activeTexts.length === 1 ? activeText?.text || '' : 'Multiple Selected'}
                                    disabled={activeTexts.length !== 1}
                                    onChange={(e) => handleUpdateText({ text: e.target.value })}
                                    className="font-medium bg-background shadow-sm"
                                    placeholder={activeTexts.length === 0 ? "Select text to edit" : "Multiple"}
                                />
                            </div>

                            <Separator className="bg-border/50" />

                            {/* Typography Grid */}
                            <div className="grid grid-cols-5 gap-2">
                                <div className="col-span-3 space-y-1.5">
                                    <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Typeface</Label>
                                    <div className="relative">
                                        <select
                                            className="w-full h-9 pl-2 pr-6 text-sm border rounded-md bg-background shadow-sm focus:outline-none focus:ring-1 focus:ring-primary appearance-none truncate"
                                            value={activeText?.style.fontFamily || 'Inter'}
                                            onChange={(e) => handleUpdateText({ fontFamily: e.target.value })}
                                        >
                                            {AVAILABLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-muted-foreground">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-span-2 space-y-1.5">
                                    <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Size</Label>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            value={activeText?.style.fontSize || 24}
                                            onChange={(e) => handleUpdateText({ fontSize: Number(e.target.value) })}
                                            className="h-9 pr-6 bg-background shadow-sm"
                                        />
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">px</span>
                                    </div>
                                </div>
                            </div>

                            {/* Style Row */}
                            <div className="space-y-1.5">
                                <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Appearance</Label>
                                <div className="flex items-center gap-3">
                                    <div className="flex-shrink-0">
                                        <SpineColorPicker
                                            value={activeText?.style.color || '#000000'}
                                            onChange={(c) => handleUpdateText({ color: c })}
                                            disableAlpha
                                        />
                                    </div>

                                    <div className="flex-1 flex items-center justify-between gap-1 bg-background border rounded-md p-1 shadow-sm">
                                        <div className="flex gap-0.5">
                                            <Button
                                                variant={activeText?.style.fontWeight === 'bold' ? 'secondary' : 'ghost'}
                                                size="icon" className="h-7 w-7"
                                                onClick={() => handleUpdateText({ fontWeight: activeText?.style.fontWeight === 'bold' ? 'normal' : 'bold' })}
                                                title="Bold"
                                            >
                                                <Bold className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                variant={activeText?.style.fontStyle === 'italic' ? 'secondary' : 'ghost'}
                                                size="icon" className="h-7 w-7"
                                                onClick={() => handleUpdateText({ fontStyle: activeText?.style.fontStyle === 'italic' ? 'normal' : 'italic' })}
                                                title="Italic"
                                            >
                                                <Italic className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                        <div className="w-px h-4 bg-border" />
                                        <div className="flex gap-0.5">
                                            <Button
                                                variant={activeText?.style.textAlign === 'left' ? 'secondary' : 'ghost'}
                                                size="icon" className="h-7 w-7"
                                                onClick={() => handleUpdateText({ textAlign: 'left' })}
                                                title="Align Left"
                                            >
                                                <AlignLeft className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                variant={activeText?.style.textAlign === 'center' || !activeText?.style.textAlign ? 'secondary' : 'ghost'}
                                                size="icon" className="h-7 w-7"
                                                onClick={() => handleUpdateText({ textAlign: 'center' })}
                                                title="Align Center"
                                            >
                                                <AlignCenter className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                variant={activeText?.style.textAlign === 'right' ? 'secondary' : 'ghost'}
                                                size="icon" className="h-7 w-7"
                                                onClick={() => handleUpdateText({ textAlign: 'right' })}
                                                title="Align Right"
                                            >
                                                <AlignRight className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Optional Footer/Tip */}
                        <div className="p-4 border-t bg-muted/20 text-xs text-muted-foreground text-center">
                            {isMultiple ? "Editing multiple items" : "Edits apply to selected text"}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground space-y-3">
                        <div className="w-12 h-12 rounded-full bg-muted/20 flex items-center justify-center">
                            <span className="text-2xl font-serif">T</span>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium">No Text Selected</p>
                            <p className="text-xs max-w-[180px]">Select a text object on the canvas to edit its properties, or add new text.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
