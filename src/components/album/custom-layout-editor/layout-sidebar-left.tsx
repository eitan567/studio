'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Layout, Sparkles, Loader2 } from 'lucide-react';
import { ADVANCED_TEMPLATES, AdvancedTemplate, LayoutRegion } from '@/lib/advanced-layout-types';
import { aiGenerateLayout } from '@/ai/ai-generate-layout';
import { cn } from '@/lib/utils';

interface LayoutSidebarLeftProps {
    onSave: () => void;
    onCancel: () => void;
    selectedAdvancedTemplate: AdvancedTemplate | null;
    onSelectAdvancedTemplate: (template: AdvancedTemplate) => void;
}

// Render a single region as SVG element
const renderRegionSvg = (region: LayoutRegion, index: number) => {
    const fill = region.zIndex && region.zIndex > 0
        ? 'rgba(100, 100, 130, 0.6)'
        : 'rgba(100, 100, 130, 0.4)';
    const stroke = 'rgba(255, 255, 255, 0.5)';

    switch (region.shape) {
        case 'circle': {
            const cx = region.bounds.x + region.bounds.width / 2;
            const cy = region.bounds.y + region.bounds.height / 2;
            const r = Math.min(region.bounds.width, region.bounds.height) / 2;
            return (
                <circle
                    key={region.id || index}
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth="0.5"
                />
            );
        }

        case 'ellipse': {
            const cx = region.bounds.x + region.bounds.width / 2;
            const cy = region.bounds.y + region.bounds.height / 2;
            return (
                <ellipse
                    key={region.id || index}
                    cx={cx}
                    cy={cy}
                    rx={region.bounds.width / 2}
                    ry={region.bounds.height / 2}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth="0.5"
                />
            );
        }

        case 'polygon': {
            if (!region.points || region.points.length < 3) {
                // Fallback to rect
                return (
                    <rect
                        key={region.id || index}
                        x={region.bounds.x}
                        y={region.bounds.y}
                        width={region.bounds.width}
                        height={region.bounds.height}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth="0.5"
                    />
                );
            }
            const points = region.points.map(([x, y]) => `${x},${y}`).join(' ');
            return (
                <polygon
                    key={region.id || index}
                    points={points}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth="0.5"
                />
            );
        }

        case 'rect':
        default: {
            return (
                <rect
                    key={region.id || index}
                    x={region.bounds.x}
                    y={region.bounds.y}
                    width={region.bounds.width}
                    height={region.bounds.height}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth="0.5"
                />
            );
        }
    }
};

// Template preview component using SVG
const TemplatePreview = ({ template, isSelected }: { template: AdvancedTemplate; isSelected: boolean }) => {
    // Sort by zIndex to render in correct order
    const sortedRegions = [...template.regions].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

    return (
        <svg
            viewBox="0 0 100 100"
            className="w-full h-full"
            preserveAspectRatio="xMidYMid meet"
        >
            {/* Background */}
            <rect x="0" y="0" width="100" height="100" fill="rgba(80, 80, 100, 0.2)" />

            {/* Render each region */}
            {sortedRegions.map((region, index) => renderRegionSvg(region, index))}
        </svg>
    );
};

export const LayoutSidebarLeft = ({
    onSave,
    onCancel,
    selectedAdvancedTemplate,
    onSelectAdvancedTemplate
}: LayoutSidebarLeftProps) => {
    const [aiPrompt, setAiPrompt] = useState('');
    const [photoCount, setPhotoCount] = useState(4);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerateLayout = async () => {
        if (!aiPrompt.trim()) return;

        setIsGenerating(true);
        setError(null);

        try {
            const result = await aiGenerateLayout({
                prompt: aiPrompt,
                photoCount,
            });

            if (result.success && result.template) {
                onSelectAdvancedTemplate(result.template as AdvancedTemplate);
                setAiPrompt('');
            } else {
                setError(result.error || 'Failed to generate layout');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="h-full z-20 flex bg-background">
            <div className="w-72 bg-background flex flex-col border-r shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] transition-all duration-300">
                {/* Header */}
                <div className="p-4 border-b h-14 flex items-center justify-between bg-accent/5">
                    <h2 className="font-semibold text-sm uppercase tracking-wider text-primary flex items-center gap-2">
                        <Layout className="w-4 h-4" /> Layout Tools
                    </h2>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* AI Generation Section */}
                    <div className="space-y-3">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            AI Generation
                        </Label>
                        <Input
                            placeholder="Describe your layout..."
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            className="text-sm"
                        />
                        <div className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground">Photos:</Label>
                            <Input
                                type="number"
                                min={1}
                                max={12}
                                value={photoCount}
                                onChange={(e) => setPhotoCount(Number(e.target.value))}
                                className="w-16 h-8 text-sm"
                            />
                        </div>
                        <Button
                            variant="outline"
                            className="w-full gap-2"
                            onClick={handleGenerateLayout}
                            disabled={isGenerating || !aiPrompt.trim()}
                        >
                            {isGenerating ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Sparkles className="h-4 w-4" />
                            )}
                            {isGenerating ? 'Generating...' : 'Generate with AI'}
                        </Button>
                        {error && (
                            <p className="text-xs text-destructive">{error}</p>
                        )}
                    </div>

                    {/* Advanced Templates */}
                    <div className="space-y-3">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Template Gallery
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                            {ADVANCED_TEMPLATES.map((template) => (
                                <button
                                    key={template.id}
                                    onClick={() => onSelectAdvancedTemplate(template)}
                                    className={cn(
                                        "aspect-square rounded-lg border-2 p-1 transition-all hover:border-primary/50 relative overflow-hidden bg-muted/30",
                                        selectedAdvancedTemplate?.id === template.id
                                            ? "border-primary ring-2 ring-primary/20"
                                            : "border-muted-foreground/20"
                                    )}
                                    title={`${template.name} (${template.photoCount} photos)`}
                                >
                                    {/* SVG Preview */}
                                    <TemplatePreview
                                        template={template}
                                        isSelected={selectedAdvancedTemplate?.id === template.id}
                                    />

                                    {/* Label */}
                                    <span className="absolute bottom-0 left-0 right-0 text-[9px] text-center bg-background/90 py-1 font-medium truncate px-1">
                                        {template.name}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Info Footer */}
                <div className="p-4 border-t bg-muted/20">
                    <p className="text-xs text-muted-foreground text-center">
                        {selectedAdvancedTemplate
                            ? `${selectedAdvancedTemplate.name} • ${selectedAdvancedTemplate.photoCount} photos`
                            : 'Select a template'}
                    </p>
                </div>
            </div>
        </div>
    );
};
