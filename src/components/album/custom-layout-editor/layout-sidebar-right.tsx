import React from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { LAYOUT_TEMPLATES } from '../layout-templates';
import { cn } from '@/lib/utils';
import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LayoutSidebarRightProps {
    selectedLayout: string;
    onSelectLayout: (layoutId: string) => void;
    spreadMode: 'full' | 'split';
    onSpreadModeChange: (mode: 'full' | 'split') => void;
    photoGap: number;
    onPhotoGapChange: (gap: number) => void;
    pageMargin: number;
    onPageMarginChange: (margin: number) => void;
    useDummyPhotos: boolean;
    onUseDummyPhotosChange: (use: boolean) => void;
}

export const LayoutSidebarRight = ({
    selectedLayout,
    onSelectLayout,
    spreadMode,
    onSpreadModeChange,
    photoGap,
    onPhotoGapChange,
    pageMargin,
    onPageMarginChange,
    useDummyPhotos,
    onUseDummyPhotosChange
}: LayoutSidebarRightProps) => {
    return (
        <div className="w-72 border-l bg-background flex flex-col shrink-0 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b h-14 flex items-center justify-between bg-accent/5">
                <h2 className="font-semibold text-sm uppercase tracking-wider text-primary flex items-center gap-2">
                    <Settings2 className="w-4 h-4" /> Layout Properties
                </h2>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Spread Mode */}
                <div className="space-y-3">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Spread Mode
                    </Label>
                    <div className="flex gap-2">
                        <Button
                            variant={spreadMode === 'full' ? 'default' : 'outline'}
                            size="sm"
                            className="flex-1"
                            onClick={() => onSpreadModeChange('full')}
                        >
                            Full
                        </Button>
                        <Button
                            variant={spreadMode === 'split' ? 'default' : 'outline'}
                            size="sm"
                            className="flex-1"
                            onClick={() => onSpreadModeChange('split')}
                        >
                            Split
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {spreadMode === 'full'
                            ? 'Full mode: Layout spans entire spread.'
                            : 'Split mode: Separate layouts for left and right pages.'}
                    </p>
                </div>

                {/* Layout Templates */}
                <div className="space-y-3">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Layout Template
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                        {LAYOUT_TEMPLATES.map((template) => (
                            <button
                                key={template.id}
                                onClick={() => onSelectLayout(template.id)}
                                className={cn(
                                    "aspect-[4/3] rounded-md border-2 p-1 transition-all hover:border-primary/50",
                                    selectedLayout === template.id
                                        ? "border-primary bg-primary/5"
                                        : "border-muted bg-muted/30"
                                )}
                                title={template.name}
                            >
                                {/* Mini grid preview */}
                                <div className="w-full h-full grid grid-cols-12 grid-rows-12 gap-0.5">
                                    {template.grid.map((gridClass, idx) => (
                                        <div
                                            key={idx}
                                            className={cn(
                                                "bg-muted-foreground/20 rounded-sm",
                                                gridClass
                                            )}
                                        />
                                    ))}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Spacing Controls */}
                <div className="space-y-4">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Spacing
                    </Label>

                    {/* Photo Gap */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm">Photo Gap</Label>
                            <Input
                                type="number"
                                className="w-16 h-7 text-xs text-center"
                                value={photoGap}
                                min={0}
                                max={50}
                                onChange={(e) => onPhotoGapChange(Math.max(0, Math.min(50, Number(e.target.value))))}
                            />
                        </div>
                        <Slider
                            min={0}
                            max={50}
                            step={1}
                            value={[photoGap]}
                            onValueChange={(vals) => onPhotoGapChange(vals[0])}
                        />
                    </div>

                    {/* Page Margin */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm">Page Margin</Label>
                            <Input
                                type="number"
                                className="w-16 h-7 text-xs text-center"
                                value={pageMargin}
                                min={0}
                                max={50}
                                onChange={(e) => onPageMarginChange(Math.max(0, Math.min(50, Number(e.target.value))))}
                            />
                        </div>
                        <Slider
                            min={0}
                            max={50}
                            step={1}
                            value={[pageMargin]}
                            onValueChange={(vals) => onPageMarginChange(vals[0])}
                        />
                    </div>
                </div>

                {/* Dummy Photos Option */}
                <div className="space-y-3 pt-4 border-t">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Preview Options
                    </Label>
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="useDummyPhotos"
                            checked={useDummyPhotos}
                            onCheckedChange={(checked) => onUseDummyPhotosChange(checked === true)}
                        />
                        <Label
                            htmlFor="useDummyPhotos"
                            className="text-sm font-normal cursor-pointer"
                        >
                            Load dummy photos
                        </Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Automatically fill layout with sample images when changing templates.
                    </p>
                </div>
            </div>
        </div>
    );
};
