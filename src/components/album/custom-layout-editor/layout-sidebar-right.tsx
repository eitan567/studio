import React from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { LAYOUT_TEMPLATES } from '../layout-templates';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LayoutSidebarRightProps {
    selectedLayout: string;
    onSelectLayout: (layoutId: string) => void;
    photoGap: number;
    onPhotoGapChange: (gap: number) => void;
    pageMargin: number;
    onPageMarginChange: (margin: number) => void;
}

export const LayoutSidebarRight = ({
    selectedLayout,
    onSelectLayout,
    photoGap,
    onPhotoGapChange,
    pageMargin,
    onPageMarginChange
}: LayoutSidebarRightProps) => {
    return (
        <div className="w-72 border-l bg-background flex flex-col shrink-0 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b">
                <h2 className="font-semibold text-sm">Layout Properties</h2>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
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

                {/* AI Generation Placeholder */}
                <div className="space-y-3 pt-4 border-t">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        AI Generation
                    </Label>
                    <Button variant="outline" className="w-full gap-2" disabled>
                        <Sparkles className="h-4 w-4" />
                        Generate with AI
                    </Button>
                    <p className="text-xs text-muted-foreground">
                        Coming soon: Generate custom layout templates using AI.
                    </p>
                </div>
            </div>
        </div>
    );
};
