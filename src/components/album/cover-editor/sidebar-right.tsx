import React, { useRef, useState } from 'react';
import { AlbumPage, CoverText } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Bold,
    Italic,
    AlignLeft,
    AlignCenter,
    AlignRight,
    RotateCw,
    Trash2,
    Type,
    Layout,
    Palette,
    Settings2,
    PlusSquare,
    Image as ImageIcon
} from 'lucide-react';
import { SpineColorPicker } from '../spine-color-picker';
import { AiBackgroundGenerator } from '../ai-background-generator';
import { cn } from '@/lib/utils';

// Helper for fonts
const AVAILABLE_FONTS = ['Inter', 'Serif', 'Mono', 'Cursive', 'Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Impact'];

interface SidebarRightProps {
    page: AlbumPage;
    activeTextIds: string[];
    onUpdatePage: (page: AlbumPage) => void;
}

export const SidebarRight = ({ page, activeTextIds, onUpdatePage }: SidebarRightProps) => {

    // Find active text objects
    const activeTexts = page.coverTexts?.filter(t => activeTextIds.includes(t.id)) || [];
    // Primary text for displaying values (use the last selected)
    const activeText = activeTexts.length > 0 ? activeTexts[activeTexts.length - 1] : null;

    const [availableBackgrounds, setAvailableBackgrounds] = useState<string[]>([
        'https://picsum.photos/seed/bg1/800/600',
        'https://picsum.photos/seed/bg2/800/600',
        'https://picsum.photos/seed/bg3/800/600',
    ]);
    const backgroundUploadRef = useRef<HTMLInputElement>(null);

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
                // Removing groupId
                return { ...rest, groupId: undefined };
            }
            return t;
        });
        onUpdatePage({ ...page, coverTexts: newTexts });
    };

    const handleUpdatePageProp = (updates: Partial<AlbumPage>) => {
        onUpdatePage({ ...page, ...updates });
    };

    // Check grouping state
    const isMultiple = activeTexts.length > 1;
    // Check if any selected item is part of a group
    const isLinked = activeTexts.some(t => !!t.groupId);

    return (
        <div className="w-80 h-full bg-card border-l flex flex-col shadow-xl z-50">
            <div className="p-4 border-b h-14">
                <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Settings2 className="w-4 h-4" /> Editor Properties
                </h2>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-0 pb-8 min-h-0">

                {/* TEXT PROPERTIES SECTION (Only if selection exists) */}
                <div className={cn(
                    "flex-shrink-0 transition-all duration-300 overflow-hidden border-b",
                    activeTexts.length === 0 ? "h-0 opacity-0 border-none" : "opacity-100"
                )}>
                    <div className="p-4 space-y-4 bg-accent/5">
                        {/* Selection Header & Actions */}
                        <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-2 text-primary font-semibold">
                                <Type className="w-4 h-4" /> Selected Text
                            </Label>
                            <div className="flex items-center gap-2">
                                {(isMultiple || isLinked) && (
                                    <div className="flex items-center bg-background border rounded-md h-7 shadow-sm">
                                        {isMultiple && (
                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none" onClick={handleGroupTexts} title="Link Selected">
                                                <Settings2 className="w-3.5 h-3.5" />
                                            </Button>
                                        )}
                                        {isLinked && (
                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none text-destructive hover:text-destructive" onClick={handleUngroupTexts} title="Unlink">
                                                <Trash2 className="w-3.5 h-3.5 rotate-45" /> {/* Using Trash rotated as 'break' icon substitute */}
                                            </Button>
                                        )}
                                    </div>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                    onClick={handleDeleteText}
                                    title="Delete Selection"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

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
                        <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-2 space-y-1.5">
                                <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Typeface</Label>
                                <select
                                    className="w-full h-9 px-2 text-sm border rounded-md bg-background shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                    value={activeText?.style.fontFamily || 'Inter'}
                                    onChange={(e) => handleUpdateText({ fontFamily: e.target.value })}
                                >
                                    {AVAILABLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
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

                                <Separator orientation="vertical" className="h-8" />

                                <div className="flex-1 flex items-center justify-between gap-1 bg-background border rounded-md p-1 shadow-sm">
                                    <div className="flex gap-0.5">
                                        <Button
                                            variant={activeText?.style.fontWeight === 'bold' ? 'secondary' : 'ghost'}
                                            size="icon" className="h-7 w-7"
                                            onClick={() => handleUpdateText({ fontWeight: activeText?.style.fontWeight === 'bold' ? 'normal' : 'bold' })}
                                        >
                                            <Bold className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant={activeText?.style.fontStyle === 'italic' ? 'secondary' : 'ghost'}
                                            size="icon" className="h-7 w-7"
                                            onClick={() => handleUpdateText({ fontStyle: activeText?.style.fontStyle === 'italic' ? 'normal' : 'italic' })}
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
                                        >
                                            <AlignLeft className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant={activeText?.style.textAlign === 'center' || !activeText?.style.textAlign ? 'secondary' : 'ghost'}
                                            size="icon" className="h-7 w-7"
                                            onClick={() => handleUpdateText({ textAlign: 'center' })}
                                        >
                                            <AlignCenter className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant={activeText?.style.textAlign === 'right' ? 'secondary' : 'ghost'}
                                            size="icon" className="h-7 w-7"
                                            onClick={() => handleUpdateText({ textAlign: 'right' })}
                                        >
                                            <AlignRight className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* GLOBAL SETTINGS SECTION */}
                {/* Header only visible if no text selected to avoid clutter, OR always visible but collapsed? keeping always visible tabs for access */}
                <div className="flex-1">
                    <Tabs defaultValue="style" className="w-full">
                        <div className="px-4 py-3 bg-muted/20 border-b flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Global Settings</span>
                        </div>
                        <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-10 p-0">
                            <TabsTrigger
                                value="style"
                                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-xs font-medium"
                            >
                                Background
                            </TabsTrigger>
                            <TabsTrigger
                                value="structure"
                                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-xs font-medium"
                            >
                                Layout & Spine
                            </TabsTrigger>
                        </TabsList>

                        {/* BACKGROUND TAB */}
                        <TabsContent value="style" className="p-4 space-y-6">
                            {/* Color Config */}
                            <div className="space-y-3">
                                <Label className="text-xs font-semibold text-foreground">Background Color</Label>
                                <div className="flex items-center gap-2">
                                    <div className="relative group cursor-pointer">
                                        <div
                                            className="w-10 h-10 rounded-md border shadow-sm"
                                            style={{ backgroundColor: page.backgroundColor || '#ffffff' }}
                                        />
                                        <input
                                            type="color"
                                            value={page.backgroundColor || '#ffffff'}
                                            onChange={(e) => handleUpdatePageProp({ backgroundColor: e.target.value })}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <Input
                                            type="text"
                                            value={page.backgroundColor || ''}
                                            onChange={(e) => handleUpdatePageProp({ backgroundColor: e.target.value })}
                                            className="h-9 font-mono text-xs uppercase"
                                            placeholder="#FFFFFF"
                                        />
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Image Config */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-semibold text-foreground">Background Image</Label>
                                    {page.backgroundImage && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-xs text-destructive hover:bg-destructive/10 px-2"
                                            onClick={() => handleUpdatePageProp({ backgroundImage: undefined })}
                                        >
                                            Remove
                                        </Button>
                                    )}
                                </div>

                                {/* Grid of Preset/Uploaded Options */}
                                <div className="grid grid-cols-4 gap-2">
                                    <div
                                        className={cn(
                                            "aspect-square rounded-md border-2 cursor-pointer flex items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors",
                                            !page.backgroundImage ? "border-primary ring-2 ring-primary/10" : "border-muted"
                                        )}
                                        onClick={() => handleUpdatePageProp({ backgroundImage: undefined })}
                                        title="No Image"
                                    >
                                        <span className="text-[10px] text-muted-foreground">None</span>
                                    </div>

                                    {availableBackgrounds.map((bg, index) => (
                                        <div
                                            key={index}
                                            className={cn(
                                                "aspect-square rounded-md border-2 cursor-pointer overflow-hidden relative group transition-all",
                                                page.backgroundImage === bg ? "border-primary ring-2 ring-primary/10" : "border-muted hover:border-primary/50"
                                            )}
                                            onClick={() => handleUpdatePageProp({ backgroundImage: bg })}
                                        >
                                            <img src={bg} alt="bg" className="w-full h-full object-cover" />
                                            <button
                                                className="absolute top-0 right-0 p-1 bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-bl-md"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setAvailableBackgrounds(prev => prev.filter((_, i) => i !== index));
                                                    if (page.backgroundImage === bg) handleUpdatePageProp({ backgroundImage: undefined });
                                                }}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}

                                    <div
                                        className="aspect-square rounded-md border-2 border-dashed border-muted hover:border-primary/50 cursor-pointer flex items-center justify-center bg-background transition-colors"
                                        onClick={() => backgroundUploadRef.current?.click()}
                                        title="Upload Image"
                                    >
                                        <PlusSquare className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                </div>
                                <input
                                    ref={backgroundUploadRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onload = (event) => {
                                                const dataUrl = event.target?.result as string;
                                                setAvailableBackgrounds(prev => [...prev, dataUrl]);
                                                handleUpdatePageProp({ backgroundImage: dataUrl });
                                            };
                                            reader.readAsDataURL(file);
                                        }
                                        e.target.value = '';
                                    }}
                                />

                                {/* Preview Box - Now separate and larger */}
                                {page.backgroundImage && (
                                    <div className="pt-2">
                                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Active Preview</Label>
                                        <div className="relative w-full h-32 rounded-lg border overflow-hidden bg-gray-100 shadow-inner">
                                            <img src={page.backgroundImage} className="w-full h-full object-cover" alt="Active" />
                                        </div>
                                    </div>
                                )}

                                <div className="pt-2">
                                    <AiBackgroundGenerator
                                        onBackgroundGenerated={(url) => {
                                            setAvailableBackgrounds(prev => [...prev, url]);
                                            handleUpdatePageProp({ backgroundImage: url });
                                        }}
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        {/* STRUCTURE (SPINE & LAYOUT) TAB */}
                        <TabsContent value="structure" className="p-4 space-y-6">
                            {/* Spine Structural Settings */}
                            <div className="space-y-4">
                                <Label className="text-xs font-semibold text-foreground flex items-center gap-2">
                                    <Layout className="w-3.5 h-3.5" /> Spine Structure
                                </Label>

                                {/* Spine Background Color - RESTORED */}
                                <div className="space-y-2">
                                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Background Color & Opacity</Label>
                                    <div className="flex items-center gap-3">
                                        <SpineColorPicker
                                            value={page.spineColor || 'transparent'}
                                            onChange={(c) => handleUpdatePageProp({ spineColor: c })}
                                            disableAlpha={false} // Transparency allowed for spine background
                                        />
                                        <div className="flex-1 text-xs text-muted-foreground">
                                            Select the background color for the spine area. Supports transparency.
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between">
                                        <Label className="text-[10px] text-muted-foreground mb-1">Spine Width (px)</Label>
                                        <span className="text-[10px] text-muted-foreground">{page.spineWidth ?? 40}px</span>
                                    </div>
                                    <Slider
                                        value={[page.spineWidth ?? 40]}
                                        min={20} max={100} step={1}
                                        onValueChange={(val) => handleUpdatePageProp({ spineWidth: val[0] })}
                                        className="py-1"
                                    />
                                </div>
                            </div>

                            <Separator />

                            {/* Spine Content & Style */}
                            <div className="space-y-4">
                                <Label className="text-xs font-semibold text-foreground flex items-center gap-2">
                                    <Type className="w-3.5 h-3.5" /> Spine Text
                                </Label>

                                <Input
                                    className="h-9 bg-background shadow-sm"
                                    value={page.spineText || ''}
                                    onChange={(e) => handleUpdatePageProp({ spineText: e.target.value })}
                                    placeholder="Enter spine text (e.g. Album Title)"
                                />

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Typeface</Label>
                                        <select
                                            className="w-full h-9 px-2 text-sm border rounded-md bg-background shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                            value={page.spineFontFamily || 'Tahoma'}
                                            onChange={(e) => handleUpdatePageProp({ spineFontFamily: e.target.value })}
                                        >
                                            {AVAILABLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Size</Label>
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                value={page.spineFontSize || 12}
                                                onChange={(e) => handleUpdatePageProp({ spineFontSize: Number(e.target.value) })}
                                                className="h-9 pr-6 bg-background shadow-sm"
                                            />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">px</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Appearance</Label>
                                    <div className="flex items-center gap-3">
                                        <SpineColorPicker
                                            value={page.spineTextColor}
                                            onChange={(c) => handleUpdatePageProp({ spineTextColor: c })}
                                            disableAlpha
                                        />

                                        <Separator orientation="vertical" className="h-8" />

                                        <div className="flex-1 flex items-center justify-between gap-1 bg-background border rounded-md p-1 shadow-sm">
                                            <div className="flex gap-0.5">
                                                <Button
                                                    variant={page.spineFontWeight === 'bold' ? 'secondary' : 'ghost'}
                                                    size="icon" className="h-7 w-7"
                                                    onClick={() => handleUpdatePageProp({ spineFontWeight: page.spineFontWeight === 'bold' ? 'normal' : 'bold' })}
                                                >
                                                    <Bold className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    variant={page.spineFontStyle === 'italic' ? 'secondary' : 'ghost'}
                                                    size="icon" className="h-7 w-7"
                                                    onClick={() => handleUpdatePageProp({ spineFontStyle: page.spineFontStyle === 'italic' ? 'normal' : 'italic' })}
                                                >
                                                    <Italic className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                            <div className="w-px h-4 bg-border" />
                                            <div className="flex gap-0.5">
                                                <Button
                                                    variant={page.spineTextAlign === 'left' ? 'secondary' : 'ghost'}
                                                    size="icon" className="h-7 w-7"
                                                    onClick={() => handleUpdatePageProp({ spineTextAlign: 'left' })}
                                                >
                                                    <AlignLeft className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    variant={page.spineTextAlign === 'center' || !page.spineTextAlign ? 'secondary' : 'ghost'}
                                                    size="icon" className="h-7 w-7"
                                                    onClick={() => handleUpdatePageProp({ spineTextAlign: 'center' })}
                                                >
                                                    <AlignCenter className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    variant={page.spineTextAlign === 'right' ? 'secondary' : 'ghost'}
                                                    size="icon" className="h-7 w-7"
                                                    onClick={() => handleUpdatePageProp({ spineTextAlign: 'right' })}
                                                >
                                                    <AlignRight className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                            <div className="w-px h-4 bg-border" />
                                            <Button
                                                variant={page.spineTextRotated ? 'secondary' : 'ghost'}
                                                size="icon" className="h-7 w-7"
                                                onClick={() => handleUpdatePageProp({ spineTextRotated: !page.spineTextRotated })}
                                                title="Rotate Text"
                                            >
                                                <RotateCw className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

            </div>
        </div>
    );
};
