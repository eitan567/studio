'use client';

import React from 'react';
import { useTemplates, AdvancedTemplate } from '@/hooks/useTemplates';
import { UserSettings } from '../settings-provider';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';
import { insetPolygon } from '@/lib/advanced-layout-types';

interface TemplateManagerProps {
    settings: UserSettings;
    onUpdate: (updates: Partial<UserSettings>) => void;
}

// Helper function to render a clean preview of an advanced template (Copied from AlbumEditor)
const renderAdvancedTemplatePreview = (template: AdvancedTemplate) => {
    const sortedRegions = [...template.regions].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

    // Small inset to create visible gaps between regions (matches gap-0.5)
    const GAP_INSET = 1; // 1% inset for gaps
    const EDGE_MARGIN = 2; // 2% margin on edges

    // Scale factor to fit content within margins
    const scale = (100 - EDGE_MARGIN * 2) / 100;

    return (
        <div className="w-full h-full relative">
            {sortedRegions.map((region, index) => {
                const isCircular = region.shape === 'circle' || region.shape === 'ellipse';
                const isPolygon = region.shape === 'polygon' && region.points && region.points.length >= 3;

                if (isPolygon && region.points) {
                    const insetPoints = insetPolygon(region.points, GAP_INSET);
                    const clipPathPoints = insetPoints.map(([px, py]) => {
                        const scaledX = EDGE_MARGIN + (px * scale);
                        const scaledY = EDGE_MARGIN + (py * scale);
                        return `${scaledX}% ${scaledY}%`;
                    }).join(', ');

                    return (
                        <div
                            key={region.id || index}
                            className="absolute bg-primary/20"
                            style={{
                                left: 0,
                                top: 0,
                                width: '100%',
                                height: '100%',
                                clipPath: `polygon(${clipPathPoints})`,
                                zIndex: region.zIndex ?? 0,
                            }}
                        />
                    );
                }

                const gapX = region.bounds.x + GAP_INSET;
                const gapY = region.bounds.y + GAP_INSET;
                const gapW = Math.max(0, region.bounds.width - (GAP_INSET * 2));
                const gapH = Math.max(0, region.bounds.height - (GAP_INSET * 2));

                const x = EDGE_MARGIN + (gapX * scale);
                const y = EDGE_MARGIN + (gapY * scale);
                const width = gapW * scale;
                const height = gapH * scale;

                return (
                    <div
                        key={region.id || index}
                        className={cn(
                            'absolute bg-primary/20',
                            isCircular ? 'rounded-full' : 'rounded-sm'
                        )}
                        style={{
                            left: `${x}%`,
                            top: `${y}%`,
                            width: `${width}%`,
                            height: `${height}%`,
                            zIndex: region.zIndex ?? 0,
                        }}
                    />
                );
            })}
        </div>
    );
};

export function TemplateManager({ settings, onUpdate }: TemplateManagerProps) {
    const { rawGridTemplates, rawAdvancedTemplates, rawCoverTemplates } = useTemplates();
    const hiddenIds = settings.hiddenTemplateIds || [];

    const toggleTemplate = (id: string) => {
        const isHidden = hiddenIds.includes(id);
        const newHiddenIds = isHidden
            ? hiddenIds.filter((hid) => hid !== id)
            : [...hiddenIds, id];

        onUpdate({ hiddenTemplateIds: newHiddenIds });
    };

    const renderTemplateList = (
        title: string,
        templates: AdvancedTemplate[],
        layoutType: 'grid' | 'cover' | 'advanced'
    ) => {
        if (templates.length === 0) return null;

        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur z-10 py-2 border-b">
                    <h3 className="font-medium text-sm text-foreground">{title} ({templates.length})</h3>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {templates.map((template) => {
                        const isHidden = hiddenIds.includes(template.id);

                        return (
                            <div
                                key={template.id}
                                className={cn(
                                    "group relative flex flex-col items-center cursor-pointer transition-all rounded-lg p-2 border-2",
                                    isHidden
                                        ? "border-muted bg-muted/20 opacity-60 grayscale hover:opacity-100 hover:grayscale-0"
                                        : "border-transparent hover:bg-accent hover:border-primary/20"
                                )}
                                onClick={() => toggleTemplate(template.id)}
                            >
                                {/* Thumbnail Box */}
                                <div className={cn(
                                    "w-full aspect-[4/3] rounded overflow-hidden relative mb-2",
                                    "bg-muted border border-border/50", // Base box style
                                    isHidden ? "opacity-50" : ""
                                )}>
                                    {/* Render Logic - All templates now use regions */}
                                    <div className="w-full h-full relative">
                                        {renderAdvancedTemplatePreview(template)}
                                    </div>

                                    {/* Selection Indicator Overlay */}
                                    <div className={cn(
                                        "absolute top-1 right-1 z-20 w-4 h-4 rounded-full flex items-center justify-center transition-all shadow-sm",
                                        isHidden
                                            ? "bg-muted-foreground/50 text-white"
                                            : "bg-primary text-primary-foreground"
                                    )}>
                                        {isHidden ? <X className="w-2.5 h-2.5" /> : <Check className="w-2.5 h-2.5" />}
                                    </div>
                                </div>

                                {/* Label */}
                                <span className="text-[10px] font-medium text-center text-muted-foreground truncate w-full px-1">
                                    {template.name}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8 pb-20">
            {renderTemplateList('Grid Layouts', rawGridTemplates, 'grid')}
            {renderTemplateList('Advanced Layouts', rawAdvancedTemplates, 'advanced')}
            {renderTemplateList('Cover Layouts', rawCoverTemplates.filter(t => !rawGridTemplates.find(g => g.id === t.id)), 'cover')}

            <div className="p-4 bg-muted/20 rounded-md text-xs text-muted-foreground text-center">
                Templates hidden here will not appear in the album editor layout selector.
            </div>
        </div>
    );
}
