import React from 'react';
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
    Settings2
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

            <ScrollArea className="flex-1">
                <div className="p-4 space-y-8">

                    {/* Text Properties Section */}
                    <div className={cn("space-y-4 transition-all duration-300", activeTexts.length === 0 && "opacity-50 grayscale")}>
                        <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-2 text-primary font-semibold">
                                <Type className="w-4 h-4" /> Text Properties
                            </Label>
                            {activeTexts.length === 0 && <span className="text-[10px] text-muted-foreground italic">No selection</span>}
                            {activeTexts.length > 1 && <span className="text-[10px] text-primary italic">{activeTexts.length} items</span>}
                        </div>

                        <div className="space-y-4 pointer-events-none" style={{ pointerEvents: activeTexts.length > 0 ? 'auto' : 'none' }}>
                            {/* Grouping Actions */}
                            <div className="flex gap-2">
                                {(isMultiple || isLinked) && (
                                    <>
                                        {isMultiple && (
                                            <Button variant="outline" size="sm" className="flex-1 text-xs h-7" onClick={handleGroupTexts}>
                                                Link
                                            </Button>
                                        )}
                                        {isLinked && (
                                            <Button variant="outline" size="sm" className="flex-1 text-xs h-7" onClick={handleUngroupTexts}>
                                                Unlink
                                            </Button>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Content */}
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Content</Label>
                                <Input
                                    value={activeTexts.length === 1 ? activeText?.text || '' : 'Multiple Selected'}
                                    disabled={activeTexts.length !== 1}
                                    onChange={(e) => handleUpdateText({ text: e.target.value })}
                                    className="font-medium"
                                    placeholder={activeTexts.length === 0 ? "Select text to edit" : "Multiple"}
                                />
                            </div>

                            {/* Typography */}
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Font</Label>
                                    <select
                                        className="w-full h-9 px-2 text-sm border rounded bg-background"
                                        value={activeText?.style.fontFamily || 'Inter'}
                                        onChange={(e) => handleUpdateText({ fontFamily: e.target.value })}
                                    >
                                        {AVAILABLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Size (px)</Label>
                                    <Input
                                        type="number"
                                        value={activeText?.style.fontSize || 24}
                                        onChange={(e) => handleUpdateText({ fontSize: Number(e.target.value) })}
                                    />
                                </div>
                            </div>

                            {/* Color & Styles */}
                            <div className="flex gap-2">
                                <div className="space-y-1 flex-1">
                                    <Label className="text-xs text-muted-foreground">Color</Label>
                                    <div className="flex items-center gap-2">
                                        <SpineColorPicker
                                            value={activeText?.style.color || '#000000'}
                                            onChange={(c) => handleUpdateText({ color: c })}
                                            disableAlpha
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1 flex-[2]">
                                    <div className="flex items-center justify-between bg-muted/30 p-1 rounded-md border mt-5">
                                        <div className="flex gap-0.5 border-r pr-1">
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
                                        <div className="flex gap-0.5 pl-1">
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

                            <Button
                                variant="destructive"
                                size="sm"
                                className="w-full gap-2 opacity-80 hover:opacity-100"
                                onClick={handleDeleteText}
                            >
                                <Trash2 className="h-3 w-3" /> Delete
                            </Button>
                        </div>
                    </div>

                    <Separator />

                    {/* Global Cover Settings */}
                    <div className="space-y-4">
                        <Label className="flex items-center gap-2 text-primary font-semibold">
                            <Layout className="w-4 h-4" /> Global Settings
                        </Label>

                        <Tabs defaultValue="style">
                            <TabsList className="w-full grid grid-cols-2 h-8">
                                <TabsTrigger value="style" className="text-xs">Background</TabsTrigger>
                                <TabsTrigger value="structure" className="text-xs">Layout & Spine</TabsTrigger>
                            </TabsList>

                            <TabsContent value="style" className="space-y-4 pt-4">
                                {/* Background Section */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-xs">Base Color</Label>
                                        <SpineColorPicker
                                            value={page.spineColor}
                                            onChange={(c) => handleUpdatePageProp({ spineColor: c })}
                                        />
                                    </div>

                                    <Separator />

                                    <div className="space-y-2">
                                        <Label className="text-xs">Background Image (AI)</Label>
                                        <AiBackgroundGenerator
                                            onBackgroundGenerated={(url) => handleUpdatePageProp({ backgroundImage: url })}
                                        />
                                    </div>

                                    {page.backgroundImage && (
                                        <div className="mt-2 relative group w-full aspect-video rounded-md overflow-hidden border">
                                            <img src={page.backgroundImage} alt="Bg" className="w-full h-full" />
                                            <Button
                                                variant="destructive"
                                                size="icon"
                                                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => handleUpdatePageProp({ backgroundImage: undefined })}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="structure" className="space-y-4 pt-4">
                                {/* Spine Settings */}
                                <div className="space-y-3 p-3 bg-muted/20 rounded-lg border">
                                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Spine</Label>

                                    <div className="space-y-1">
                                        <Input
                                            className="h-8 bg-background"
                                            value={page.spineText || ''}
                                            onChange={(e) => handleUpdatePageProp({ spineText: e.target.value })}
                                            placeholder="Spine Text"
                                        />
                                    </div>

                                    {/* Typography Grid: Font + Size */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">Font</Label>
                                            <select
                                                className="w-full h-8 px-2 text-sm border rounded bg-background"
                                                value={page.spineFontFamily || 'Tahoma'}
                                                onChange={(e) => handleUpdatePageProp({ spineFontFamily: e.target.value })}
                                            >
                                                {AVAILABLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">Size (px)</Label>
                                            <Input
                                                type="number" className="h-8 bg-background"
                                                value={page.spineFontSize || 12}
                                                onChange={(e) => handleUpdatePageProp({ spineFontSize: Number(e.target.value) })}
                                            />
                                        </div>
                                    </div>

                                    {/* Width */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between">
                                            <Label className="text-[10px] text-muted-foreground mb-1">Spine Width (px)</Label>
                                            <span className="text-[10px] text-muted-foreground">{page.spineWidth ?? 40}px</span>
                                        </div>
                                        <Slider
                                            value={[page.spineWidth ?? 40]}
                                            min={0} max={100} step={1}
                                            onValueChange={(val) => handleUpdatePageProp({ spineWidth: val[0] })}
                                        />
                                    </div>

                                    {/* Color & Styles */}
                                    <div className="flex gap-2">
                                        <div className="space-y-1 flex-1">
                                            <Label className="text-[10px] text-muted-foreground">Color</Label>
                                            <div className="flex items-center gap-2">
                                                <SpineColorPicker
                                                    value={page.spineTextColor}
                                                    onChange={(c) => handleUpdatePageProp({ spineTextColor: c })}
                                                    disableAlpha
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1 flex-[2]">
                                            <Label className="text-[10px] text-muted-foreground invisible">Style</Label>
                                            <div className="flex items-center justify-between bg-muted/30 p-1 rounded-md border">
                                                <div className="flex gap-0.5 border-r pr-1">
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
                                                <div className="flex gap-0.5 pl-1">
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
                                                    <div className="w-px bg-border mx-0.5" />
                                                    <Button
                                                        variant={page.spineTextRotated ? 'secondary' : 'ghost'}
                                                        size="icon" className="h-7 w-7"
                                                        onClick={() => handleUpdatePageProp({ spineTextRotated: !page.spineTextRotated })}
                                                        title="Flip text direction"
                                                    >
                                                        <RotateCw className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Dimensions / Spacing */}
                                <div className="space-y-3 p-3 bg-muted/20 rounded-lg border">
                                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Spacing</Label>
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <div className="flex justify-between">
                                                <Label className="text-[10px] mb-1">Photo Gap</Label>
                                                <span className="text-[10px] text-muted-foreground">{page.photoGap ?? 5}px</span>
                                            </div>
                                            <Slider
                                                value={[page.photoGap ?? 5]}
                                                min={0} max={20} step={1}
                                                onValueChange={(val) => handleUpdatePageProp({ photoGap: val[0] })}
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <div className="flex justify-between">
                                                <Label className="text-[10px] mb-1">Page Margin</Label>
                                                <span className="text-[10px] text-muted-foreground">{page.pageMargin ?? 0}px</span>
                                            </div>
                                            <Slider
                                                value={[page.pageMargin ?? 0]}
                                                min={0} max={50} step={1}
                                                onValueChange={(val) => handleUpdatePageProp({ pageMargin: val[0] })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
};
