import React from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useTemplates } from '@/hooks/useTemplates';
import { cn } from '@/lib/utils';
import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { TemplatePreview } from '@/components/album/shared/template-preview';

import { AlbumConfig } from '@/lib/types';

interface LayoutSidebarRightProps {
    selectedLayout: string;
    onSelectLayout: (layoutId: string) => void;
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
    const userTemplates = allTemplates.filter(t => t.createdBy === 'user' || t.isCustom);

    const filterByMode = (templates: typeof allTemplates) => {
        const type = spreadMode === 'split' ? 'single' : 'spread';
        return templates.filter(t => {
            if (t.type) return t.type === type || t.type === 'both';

            // Priority 2: System templates without explicit type
            // Match PageCanvas logic: Available in both views by default for flexibility
            if (t.createdBy === 'system') {
                return true;
            }

            return false;
        });
    };

    const filteredSystem = filterByMode(systemTemplates);
    const filteredUser = filterByMode(userTemplates);

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
                {/* Template Type - Fixed at Top */}
                <div className="p-4 space-y-3 shrink-0">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Template Type
                    </Label>
                    <div className="flex gap-2">
                        <Button
                            variant={spreadMode === 'full' ? 'default' : 'outline'}
                            size="sm"
                            className="flex-1"
                            onClick={() => onSpreadModeChange('full')}
                        >
                            Double Page
                        </Button>
                        <Button
                            variant={spreadMode === 'split' ? 'default' : 'outline'}
                            size="sm"
                            className="flex-1"
                            onClick={() => onSpreadModeChange('split')}
                        >
                            Single Page
                        </Button>
                    </div>
                </div>

                <div className="px-4 shrink-0">
                    <Separator />
                </div>

                {/* System Layout Templates - Scrollable Middle Section */}
                <div className="flex-1 flex flex-col min-h-0 p-4 space-y-3">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Standard Layouts
                    </Label>
                    <ScrollArea className="flex-1">
                        <div className="p-2 pr-6 grid grid-cols-2 gap-1">
                            {filteredSystem.map((template) => (
                                <button
                                    key={template.id}
                                    onClick={() => onSelectLayout(String(template.id))}
                                    className={cn(
                                        "rounded-md border-2 p-1 transition-all hover:border-primary/50",
                                        selectedLayout === String(template.id)
                                            ? "border-primary bg-primary/5"
                                            : "border-muted bg-muted/30"
                                    )}
                                    style={{ aspectRatio }}
                                    title={template.name}
                                >
                                    <div className="w-full h-full relative overflow-hidden bg-muted rounded-sm">
                                        <TemplatePreview template={template} />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>

                {/* User Layout Templates - Fixed at Bottom (if present) */}
                {filteredUser.length > 0 && (
                    <div className="p-4 pt-0 space-y-3 shrink-0">
                        <Separator className="mb-4" />
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            My Layouts
                        </Label>
                        <ScrollArea className="h-[120px] w-full rounded-md border bg-muted/20">
                            <div className="p-2 grid grid-cols-2 gap-2">
                                {filteredUser.map((template) => (
                                    <button
                                        key={template.id}
                                        onClick={() => onSelectLayout(String(template.id))}
                                        className={cn(
                                            "rounded-md border-2 p-1 transition-all hover:border-primary/50",
                                            selectedLayout === String(template.id)
                                                ? "border-primary bg-primary/5"
                                                : "border-muted bg-muted/30"
                                        )}
                                        style={{ aspectRatio }}
                                        title={template.name}
                                    >
                                        <div className="w-full h-full relative overflow-hidden bg-muted rounded-sm">
                                            <TemplatePreview template={template} />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                )}
            </div>
        </div>
    );
};
