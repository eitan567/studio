import React from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useTemplates } from '@/hooks/useTemplates';
import { cn } from '@/lib/utils';
import { Settings2, Layout, Settings, Pencil, Play, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { TemplatePreview } from '@/components/album/shared/template-preview';
import { TemplateMetadataDialog } from './template-metadata-dialog';

import { AlbumConfig } from '@/lib/types';
import { AdvancedTemplate } from '@/lib/advanced-layout-types';
import { getPhotoCount } from '@/hooks/useTemplates';
export interface LayoutSidebarRightProps {
    selectedLayout: string;
    onSelectLayout: (layoutId: string, mode?: 'full' | 'split') => void;
    onSelectAdvancedTemplate: (template: AdvancedTemplate, mode?: 'full' | 'split') => void;
    onEditAdvancedTemplate?: (template: AdvancedTemplate, mode?: 'full' | 'split') => void;
    onDeleteTemplate?: (template: AdvancedTemplate) => void;
    selectedAdvancedTemplate: AdvancedTemplate | null;
    editingTemplateId?: string | number | null;
    customTemplates: AdvancedTemplate[];
    systemTemplates?: AdvancedTemplate[];
    spreadMode: 'full' | 'split';
    onSpreadModeChange: (mode: 'full' | 'split') => void;
    config?: AlbumConfig;
    photoGap: number;
    onPhotoGapChange: (gap: number) => void;
    pageMargin: number;
    onPageMarginChange: (margin: number) => void;
    cornerRadius: number;
    onCornerRadiusChange: (radius: number) => void;
    useDummyPhotos: boolean;
    onUseDummyPhotosChange: (use: boolean) => void;
    onRefresh?: () => void;
}

export const LayoutSidebarRight = ({
    selectedLayout,
    onSelectLayout,
    onSelectAdvancedTemplate,
    selectedAdvancedTemplate,
    customTemplates,
    spreadMode,
    onSpreadModeChange,
    config,
    photoGap,
    onPhotoGapChange,
    pageMargin,
    onPageMarginChange,
    cornerRadius,
    onCornerRadiusChange,
    useDummyPhotos,
    onUseDummyPhotosChange,
    onEditAdvancedTemplate,
    onDeleteTemplate,
    editingTemplateId,
    systemTemplates: propSystemTemplates,
    onRefresh
}: LayoutSidebarRightProps) => {
    const { allTemplates: hookTemplates, refresh } = useTemplates();
    const [activeTab, setActiveTab] = React.useState<'standard' | 'new'>('standard');

    // Use prop if available (reactive from parent), otherwise fall back to hook
    // This fixes the issue where parent refresh() doesn't update sidebar
    const systemTemplates = propSystemTemplates || hookTemplates;

    // Local state for filtering, independent of global canvas spreadMode
    const [sidebarMode, setSidebarMode] = React.useState<'full' | 'split'>(spreadMode);
    const [metadataInfoTemplate, setMetadataInfoTemplate] = React.useState<AdvancedTemplate | null>(null);

    // Calculate aspect ratio from config
    const aspectRatio = React.useMemo(() => {
        if (!config?.size) return 1; // Default square
        const [w, h] = config.size.split('x').map(Number);
        if (isNaN(w) || isNaN(h) || h === 0) return 1;

        const singlePageRatio = w / h;
        // In split mode (single page), use single page ratio
        // In full mode (spread), use double width ratio
        return sidebarMode === 'split' ? singlePageRatio : (singlePageRatio * 2);
    }, [config?.size, sidebarMode]);


    // Remove local filtering by mode here if we want to show all in "My Templates"
    // or keep it consistent. Let's keep it consistent but ensure we use sidebarMode.
    const filteredSystem = systemTemplates.filter(t => {
        const mode = sidebarMode === 'split' ? 'single' : 'spread';
        if (!t.type || t.type === 'both' || (t.type as string) === 'grid') return true;
        return t.type === mode;
    });

    const filteredCustom = customTemplates.filter(t => {
        // For "New Templates" tab, show EVERYTHING regardless of mode
        if (activeTab === 'new') return true;

        const mode = sidebarMode === 'split' ? 'single' : 'spread';
        if (t.type) return (t.type === mode || t.type === 'both');
        return true;
    });

    // Calculate counts for tabs
    const doublePageCount = React.useMemo(() => systemTemplates.filter(t =>
        !t.type || t.type === 'both' || t.type === 'spread' || (t.type as string) === 'grid'
    ).length, [systemTemplates]);

    const singlePageCount = React.useMemo(() => systemTemplates.filter(t =>
        !t.type || t.type === 'both' || t.type === 'single' || (t.type as string) === 'grid'
    ).length, [systemTemplates]);

    const customCount = customTemplates.length;

    return (
        <div className="w-full h-full border-l bg-background flex flex-col shrink-0 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b h-14 flex items-center justify-between bg-accent/5">
                <h2 className="font-semibold text-sm uppercase tracking-wider text-primary flex items-center gap-2">
                    <Settings2 className="w-4 h-4" /> Layout Properties
                </h2>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col min-h-0">
                {/* Template Type & Tabs - Fixed at Top */}
                <div className="p-4 space-y-4 shrink-0">
                    <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Template Type
                        </Label>
                        <div className="flex gap-1.5">
                            <Button
                                variant="outline"
                                size="sm"
                                className={cn(
                                    "flex-1 h-8 text-[11px] px-2",
                                    activeTab === 'standard' && sidebarMode === 'full' && "bg-primary hover:bg-primary/90 text-primary-foreground border-primary"
                                )}
                                onClick={() => {
                                    setActiveTab('standard');
                                    setSidebarMode('full');
                                }}
                            >
                                Double ({doublePageCount})
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className={cn(
                                    "flex-1 h-8 text-[11px] px-2",
                                    activeTab === 'standard' && sidebarMode === 'split' && "bg-primary hover:bg-primary/90 text-primary-foreground border-primary"
                                )}
                                onClick={() => {
                                    setActiveTab('standard');
                                    setSidebarMode('split');
                                }}
                            >
                                Single ({singlePageCount})
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className={cn(
                                    "flex-1 h-8 text-[11px] px-2",
                                    activeTab === 'new' && "bg-primary hover:bg-primary/90 text-primary-foreground border-primary"
                                )}
                                onClick={() => setActiveTab('new')}
                            >
                                New ({customCount})
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="px-4 shrink-0">
                    <Separator />
                </div>

                {/* Templates List Area */}
                <div className="flex-1 flex flex-col min-h-0 p-4 space-y-3">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {activeTab === 'standard' ? 'Standard Layouts' : 'My Templates'}
                    </Label>

                    <ScrollArea className="flex-1">
                        <div className="p-2 pr-4 space-y-6">
                            {activeTab === 'standard' ? (
                                <div className="grid grid-cols-2 gap-2">
                                    {filteredSystem.map((template) => (
                                        <div key={template.id} className="relative group">
                                            <button
                                                onClick={() => onSelectLayout(String(template.id), sidebarMode)}
                                                className={cn(
                                                    "w-full rounded-md border-2 p-1 transition-all hover:border-primary/50 relative overflow-hidden",
                                                    selectedLayout === String(template.id)
                                                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                                        : "border-muted bg-muted/30"
                                                )}
                                                style={{ aspectRatio }}
                                                title={template.name}
                                            >
                                                <div className="w-full h-full relative overflow-hidden bg-muted rounded-sm">
                                                    <TemplatePreview template={template} />
                                                </div>
                                            </button>

                                            {/* Edit Action (Top Right) */}
                                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                <Button
                                                    variant="secondary"
                                                    size="icon"
                                                    className="h-5 w-5 rounded-full shadow-sm bg-background/80 hover:bg-background border border-border/10 backdrop-blur-[2px]"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onEditAdvancedTemplate?.(template, sidebarMode);
                                                    }}
                                                    title="Edit this Layout"
                                                >
                                                    <Pencil className="h-2.5 w-2.5 text-foreground" />
                                                </Button>
                                            </div>

                                            {/* Delete Action (Top Left) */}
                                            <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5 rounded-full shadow-sm bg-background/80 hover:bg-destructive hover:text-destructive-foreground text-destructive border border-border/10 backdrop-blur-[2px] p-0"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDeleteTemplate?.(template);
                                                    }}
                                                    title="Delete Template"
                                                >
                                                    <Trash2 className="h-2.5 w-2.5" />
                                                </Button>
                                            </div>

                                            {/* Metadata Action (Bottom Left) */}
                                            <div className="absolute bottom-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                <Button
                                                    variant="secondary"
                                                    size="icon"
                                                    className="h-5 w-5 rounded-full shadow-sm bg-background/80 hover:bg-background border border-border/10 backdrop-blur-[2px]"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setMetadataInfoTemplate(template);
                                                    }}
                                                    title="Edit Metadata"
                                                >
                                                    <Settings className="h-2.5 w-2.5 text-foreground" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                customTemplates.length > 0 ? (
                                    <div className="space-y-6">
                                        {/* Full Spread Group */}

                                        <div className="grid grid-cols-2 gap-2">
                                            {filteredCustom
                                                .filter(t => t.type === 'spread')
                                                .map((template) => (
                                                    <div key={template.id} className="relative group col-span-2">
                                                        <button
                                                            onClick={() => onSelectAdvancedTemplate(template, sidebarMode)}
                                                            className={cn(
                                                                "w-full rounded-md border-2 p-1 transition-all hover:border-primary/50 relative overflow-hidden aspect-[2/1]",
                                                                selectedAdvancedTemplate?.id === template.id
                                                                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                                                    : "border-muted bg-muted/30",
                                                                editingTemplateId === template.id && "ring-2 ring-indigo-500/50 border-indigo-500"
                                                            )}
                                                            title={`${template.name} (${getPhotoCount(template)} photos)`}
                                                        >
                                                            <div className="w-full h-full relative overflow-hidden bg-muted rounded-sm">
                                                                <TemplatePreview template={template} />
                                                            </div>
                                                            <span className="absolute bottom-0 left-0 right-0 text-[8px] text-center bg-background/80 py-0.5 font-medium truncate px-1">
                                                                {template.name}
                                                                {editingTemplateId === template.id && " (Editing)"}
                                                            </span>
                                                        </button>

                                                        {/* Edit Action (Top Right) */}
                                                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                            <Button
                                                                variant="secondary"
                                                                size="icon"
                                                                className="h-5 w-5 rounded-full shadow-sm bg-background/80 hover:bg-background border border-border/10 backdrop-blur-[2px]"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onEditAdvancedTemplate?.(template, sidebarMode);
                                                                }}
                                                                title="Edit Template"
                                                            >
                                                                <Pencil className="h-2.5 w-2.5 text-foreground" />
                                                            </Button>
                                                        </div>

                                                        {/* Delete Action (Top Left) */}
                                                        <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-5 w-5 rounded-full shadow-sm bg-background/80 hover:bg-destructive hover:text-destructive-foreground text-destructive border border-border/10 backdrop-blur-[2px] p-0"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onDeleteTemplate?.(template);
                                                                }}
                                                                title="Delete Template"
                                                            >
                                                                <Trash2 className="h-2.5 w-2.5" />
                                                            </Button>
                                                        </div>

                                                        {/* Metadata Action (Bottom Left) */}
                                                        <div className="absolute bottom-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                            <Button
                                                                variant="secondary"
                                                                size="icon"
                                                                className="h-5 w-5 rounded-full shadow-sm bg-background/80 hover:bg-background border border-border/10 backdrop-blur-[2px]"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setMetadataInfoTemplate(template);
                                                                }}
                                                                title="Edit Metadata"
                                                            >
                                                                <Settings className="h-2.5 w-2.5 text-foreground" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>


                                        {/* Single Page Group */}
                                        {filteredCustom.some(t => t.type === 'single' || !t.type) && (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 px-1">
                                                    <span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">Single Pages</span>
                                                    <div className="h-[1px] flex-1 bg-border/50" />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {filteredCustom
                                                        .filter(t => t.type === 'single' || !t.type)
                                                        .map((template) => (
                                                            <div key={template.id} className="relative group">
                                                                <button
                                                                    onClick={() => onSelectAdvancedTemplate(template, sidebarMode)}
                                                                    className={cn(
                                                                        "w-full rounded-md border-2 p-1 transition-all hover:border-primary/50 relative overflow-hidden aspect-square",
                                                                        selectedAdvancedTemplate?.id === template.id
                                                                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                                                            : "border-muted bg-muted/30",
                                                                        editingTemplateId === template.id && "ring-2 ring-indigo-500/50 border-indigo-500"
                                                                    )}
                                                                    title={`${template.name} (${getPhotoCount(template)} photos)`}
                                                                >
                                                                    <div className="w-full h-full relative overflow-hidden bg-muted rounded-sm">
                                                                        <TemplatePreview template={template} />
                                                                    </div>
                                                                    <span className="absolute bottom-0 left-0 right-0 text-[8px] text-center bg-background/80 py-0.5 font-medium truncate px-1">
                                                                        {template.name}
                                                                        {editingTemplateId === template.id && " (Editing)"}
                                                                    </span>
                                                                </button>

                                                                {/* Edit Action (Top Right) */}
                                                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                                    <Button
                                                                        variant="secondary"
                                                                        size="icon"
                                                                        className="h-5 w-5 rounded-full shadow-sm bg-background/80 hover:bg-background border border-border/10 backdrop-blur-[2px]"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            onEditAdvancedTemplate?.(template, sidebarMode);
                                                                        }}
                                                                        title="Edit Template"
                                                                    >
                                                                        <Pencil className="h-2.5 w-2.5 text-foreground" />
                                                                    </Button>
                                                                </div>

                                                                {/* Delete Action (Top Left) */}
                                                                <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-5 w-5 rounded-full shadow-sm bg-background/80 hover:bg-destructive hover:text-destructive-foreground text-destructive border border-border/10 backdrop-blur-[2px] p-0"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            onDeleteTemplate?.(template);
                                                                        }}
                                                                        title="Delete Template"
                                                                    >
                                                                        <Trash2 className="h-2.5 w-2.5" />
                                                                    </Button>
                                                                </div>

                                                                {/* Metadata Action (Bottom Left) */}
                                                                <div className="absolute bottom-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                                    <Button
                                                                        variant="secondary"
                                                                        size="icon"
                                                                        className="h-5 w-5 rounded-full shadow-sm bg-background/80 hover:bg-background border border-border/10 backdrop-blur-[2px]"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setMetadataInfoTemplate(template);
                                                                        }}
                                                                        title="Edit Metadata"
                                                                    >
                                                                        <Settings className="h-2.5 w-2.5 text-foreground" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="col-span-2 py-12 flex flex-col items-center justify-center text-center space-y-2 opacity-50">
                                        <div className="p-3 rounded-full bg-muted">
                                            <Layout className="h-6 w-6 text-muted-foreground" />
                                        </div>
                                        <p className="text-xs text-muted-foreground">No custom templates yet</p>
                                    </div>
                                )
                            )}
                        </div>
                    </ScrollArea>

                    <TemplateMetadataDialog
                        open={!!metadataInfoTemplate}
                        onOpenChange={(open) => !open && setMetadataInfoTemplate(null)}
                        template={metadataInfoTemplate}
                        onSaveSuccess={() => {
                            // Trigger refresh if passed, or rely on global cache invalidation
                            if (onRefresh) onRefresh();
                            refresh();
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

