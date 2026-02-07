import React from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useTemplates } from '@/hooks/useTemplates';
import { cn } from '@/lib/utils';
import { Settings2, Layout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { TemplatePreview } from '@/components/album/shared/template-preview';

import { AlbumConfig } from '@/lib/types';
import { AdvancedTemplate } from '@/lib/advanced-layout-types';
import { getPhotoCount } from '@/hooks/useTemplates';

interface LayoutSidebarRightProps {
    selectedLayout: string;
    onSelectLayout: (layoutId: string) => void;
    onSelectAdvancedTemplate: (template: AdvancedTemplate) => void;
    selectedAdvancedTemplate: AdvancedTemplate | null;
    customTemplates: AdvancedTemplate[];
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
    onUseDummyPhotosChange
}: LayoutSidebarRightProps) => {
    const { allTemplates } = useTemplates();
    const [activeTab, setActiveTab] = React.useState<'standard' | 'new'>('standard');

    // Calculate aspect ratio from config
    const aspectRatio = React.useMemo(() => {
        if (!config?.size) return 1; // Default square
        const [w, h] = config.size.split('x').map(Number);
        if (isNaN(w) || isNaN(h) || h === 0) return 1;

        const singlePageRatio = w / h;
        // In split mode (single page), use single page ratio
        // In full mode (spread), use double width ratio
        return spreadMode === 'split' ? singlePageRatio : (singlePageRatio * 2);
    }, [config?.size, spreadMode]);

    // Filter templates by category and type
    const systemTemplates = allTemplates.filter(t => t.createdBy === 'system');

    const filterByMode = (templates: typeof allTemplates) => {
        const type = spreadMode === 'split' ? 'single' : 'spread';
        return templates.filter(t => {
            if (t.type) return (t.type === type || t.type === 'both');

            // Priority 2: System templates without explicit type
            // Match PageCanvas logic: Available in both views by default for flexibility
            if (t.createdBy === 'system') {
                return true;
            }

            return false;
        });
    };

    const filteredSystem = filterByMode(systemTemplates);

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
                                variant={activeTab === 'standard' && spreadMode === 'full' ? 'default' : 'outline'}
                                size="sm"
                                className="flex-1 h-8 text-[11px] px-2"
                                onClick={() => {
                                    setActiveTab('standard');
                                    onSpreadModeChange('full');
                                }}
                            >
                                Double Page
                            </Button>
                            <Button
                                variant={activeTab === 'standard' && spreadMode === 'split' ? 'default' : 'outline'}
                                size="sm"
                                className="flex-1 h-8 text-[11px] px-2"
                                onClick={() => {
                                    setActiveTab('standard');
                                    onSpreadModeChange('split');
                                }}
                            >
                                Single Page
                            </Button>
                            <Button
                                variant={activeTab === 'new' ? 'default' : 'outline'}
                                size="sm"
                                className="flex-1 h-8 text-[11px] px-2 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-indigo-500/20 hover:from-indigo-500/20 hover:to-purple-500/20"
                                onClick={() => setActiveTab('new')}
                            >
                                New Templates
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
                        <div className="p-2 pr-4 grid grid-cols-2 gap-2">
                            {activeTab === 'standard' ? (
                                filteredSystem.map((template) => (
                                    <button
                                        key={template.id}
                                        onClick={() => onSelectLayout(String(template.id))}
                                        className={cn(
                                            "rounded-md border-2 p-1 transition-all hover:border-primary/50 relative overflow-hidden",
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
                                ))
                            ) : (
                                customTemplates.length > 0 ? (
                                    customTemplates.map((template) => {
                                        const isSpread = template.type === 'spread';
                                        const templateRatio = isSpread ? aspectRatio : (aspectRatio / (spreadMode === 'full' ? 2 : 1));

                                        return (
                                            <button
                                                key={template.id}
                                                onClick={() => onSelectAdvancedTemplate(template)}
                                                className={cn(
                                                    "rounded-md border-2 p-1 transition-all hover:border-primary/50 relative overflow-hidden",
                                                    selectedAdvancedTemplate?.id === template.id
                                                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                                        : "border-muted bg-muted/30",
                                                    isSpread ? "col-span-2 aspect-[2/1]" : "aspect-square"
                                                )}
                                                title={`${template.name} (${getPhotoCount(template)} photos)`}
                                            >
                                                <div className="w-full h-full relative overflow-hidden bg-muted rounded-sm">
                                                    <TemplatePreview template={template} />
                                                </div>
                                                <span className="absolute bottom-0 left-0 right-0 text-[8px] text-center bg-background/80 py-0.5 font-medium truncate px-1">
                                                    {template.name}
                                                </span>
                                            </button>
                                        );
                                    })
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
                </div>

                {/* Info Footer */}
                {(activeTab === 'new' && selectedAdvancedTemplate) && (
                    <div className="p-3 border-t bg-muted/20 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-tight">
                            Selected: {selectedAdvancedTemplate.name} ({getPhotoCount(selectedAdvancedTemplate)} slots)
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
