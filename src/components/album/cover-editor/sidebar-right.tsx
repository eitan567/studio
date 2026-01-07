import React, { useRef, useState } from 'react';
import { AlbumPage } from '@/lib/types';
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
    Settings2,
    PlusSquare
} from 'lucide-react';
import { SpineColorPicker } from '../spine-color-picker';
import { AiBackgroundGenerator } from '../ai-background-generator';
import { cn } from '@/lib/utils';

// Helper for fonts
const AVAILABLE_FONTS = ['Inter', 'Serif', 'Mono', 'Cursive', 'Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Impact'];

interface SidebarRightProps {
    page: AlbumPage;
    onUpdatePage: (page: AlbumPage) => void;
    activeView: 'front' | 'back' | 'full';
    onSetActiveView: (view: 'front' | 'back' | 'full') => void;
    isCover?: boolean; // Determines if spine settings should be shown
}

export const SidebarRight = ({ page, onUpdatePage, activeView, onSetActiveView, isCover = true }: SidebarRightProps) => {

    const [availableBackgrounds, setAvailableBackgrounds] = useState<string[]>([
        'https://picsum.photos/seed/bg1/800/600',
        'https://picsum.photos/seed/bg2/800/600',
        'https://picsum.photos/seed/bg3/800/600',
    ]);
    const backgroundUploadRef = useRef<HTMLInputElement>(null);

    const handleUpdatePageProp = (updates: Partial<AlbumPage>) => {
        onUpdatePage({ ...page, ...updates });
    };

    return (
        <div className="w-80 h-full bg-card border-l flex flex-col shadow-xl z-50">
            <div className="p-4 border-b h-14">
                <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Settings2 className="w-4 h-4" /> Global Settings
                </h2>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-0 pb-8 min-h-0">
                {/* GLOBAL SETTINGS SECTION */}
                <div className="flex-1">
                    <Tabs defaultValue="style" className="w-full">
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

                            {/* Cover Mode & View Settings - Only shown for cover pages */}
                            {isCover && (
                                <div className="space-y-4">
                                    <Label className="text-xs font-semibold text-foreground flex items-center gap-2">
                                        <Layout className="w-3.5 h-3.5" /> Cover Configuration
                                    </Label>

                                    {/* Mode Selector */}
                                    <div className="space-y-2">
                                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Cover Mode</Label>
                                        <div className="flex items-center bg-muted/20 rounded-lg p-0.5 border">
                                            <Button
                                                variant={page.coverType === 'full' ? 'secondary' : 'ghost'}
                                                size="sm"
                                                className="flex-1 h-7 text-xs"
                                                onClick={() => {
                                                    onUpdatePage({ ...page, coverType: 'full' });
                                                    onSetActiveView('full');
                                                }}
                                            >
                                                Full Spread
                                            </Button>
                                            <Button
                                                variant={page.coverType === 'split' || !page.coverType ? 'secondary' : 'ghost'}
                                                size="sm"
                                                className="flex-1 h-7 text-xs"
                                                onClick={() => {
                                                    onUpdatePage({ ...page, coverType: 'split' });
                                                    // Optional: Set to 'front' or keep current? keeping current is usually safer unless requested otherwise.
                                                }}
                                            >
                                                Split Cover
                                            </Button>
                                        </div>
                                    </div>

                                    {/* View Selector */}
                                    <div className={cn("space-y-2", page.coverType === 'full' && "opacity-50 pointer-events-none")}>
                                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Active View</Label>
                                        <div className="flex items-center bg-muted/20 rounded-lg p-0.5 border">
                                            <Button
                                                variant={activeView === 'full' ? 'secondary' : 'ghost'}
                                                size="sm"
                                                className="flex-1 h-7 text-xs"
                                                onClick={() => onSetActiveView('full')}
                                            >
                                                Full
                                            </Button>
                                            <Button
                                                variant={activeView === 'front' ? 'secondary' : 'ghost'}
                                                size="sm"
                                                className="flex-1 h-7 text-xs"
                                                onClick={() => onSetActiveView('front')}
                                            >
                                                Front
                                            </Button>
                                            <Button
                                                variant={activeView === 'back' ? 'secondary' : 'ghost'}
                                                size="sm"
                                                className="flex-1 h-7 text-xs"
                                                onClick={() => onSetActiveView('back')}
                                            >
                                                Back
                                            </Button>
                                        </div>
                                    </div>
                                    <Separator />
                                </div>
                            )}

                            {/* Spine Structural Settings - Only shown for cover pages */}
                            {isCover && (
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
                            )}

                            {/* Spine Content & Style - Only shown for cover pages */}
                            {isCover && (
                                <>
                                    <Separator />

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
                                </>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>

            </div>
        </div>
    );
};
