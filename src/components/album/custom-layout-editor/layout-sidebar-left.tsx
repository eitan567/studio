'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Layout, Pencil, Square, Circle, Trash2, Play, ImageOff } from 'lucide-react';
import { getPhotoCount } from '@/hooks/useTemplates';
import { AdvancedTemplate, LayoutRegion } from '@/lib/advanced-layout-types';
import { cn } from '@/lib/utils';

export type ToolMode = 'select' | 'pencil' | 'freehand' | 'rect' | 'circle';

interface LayoutSidebarLeftProps {
    onSave: () => void;
    onCancel: () => void;
    selectedAdvancedTemplate: AdvancedTemplate | null;
    onSelectAdvancedTemplate: (template: AdvancedTemplate) => void;
    customTemplates?: AdvancedTemplate[];
    onAddTemplate?: (template: AdvancedTemplate) => void;
    // New Props for Vector Tools
    toolMode: ToolMode;
    onToolChange: (mode: ToolMode) => void;
    onClearStrokes: () => void;
    onProcessLayout: () => void;
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
    onSelectAdvancedTemplate,
    customTemplates = [],
    onAddTemplate,
    toolMode,
    onToolChange,
    onClearStrokes,
    onProcessLayout
}: LayoutSidebarLeftProps) => {
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
                    {/* Vector Tools Section */}
                    <div className="space-y-3">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Vector Tools
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                variant={toolMode === 'select' ? "default" : "outline"}
                                className="justify-start gap-2 h-9"
                                onClick={() => onToolChange('select')}
                            >
                                <Layout className="h-4 w-4" /> Select
                            </Button>
                            <Button
                                variant={toolMode === 'pencil' ? "default" : "outline"}
                                className="justify-start gap-2 h-9"
                                onClick={() => onToolChange('pencil')}
                            >
                                <Pencil className="h-4 w-4" /> Line
                            </Button>
                            <Button
                                variant={toolMode === 'freehand' ? "default" : "outline"}
                                className="justify-start gap-2 h-9"
                                onClick={() => onToolChange('freehand')}
                            >
                                <Pencil className="h-4 w-4" /> Free
                            </Button>
                            <Button
                                variant={toolMode === 'rect' ? "default" : "outline"}
                                className="justify-start gap-2 h-9"
                                onClick={() => onToolChange('rect')}
                            >
                                <Square className="h-4 w-4" /> Rect
                            </Button>
                            <Button
                                variant={toolMode === 'circle' ? "default" : "outline"}
                                className="justify-start gap-2 h-9"
                                onClick={() => onToolChange('circle')}
                            >
                                <Circle className="h-4 w-4" /> Circle
                            </Button>
                        </div>

                        {/* Actions */}
                        <div className="pt-2 grid grid-cols-2 gap-2">
                            <Button variant="secondary" size="sm" onClick={onClearStrokes} className="text-red-500 hover:text-red-600">
                                <Trash2 className="h-4 w-4 mr-2" /> Clear All
                            </Button>
                            <Button size="sm" onClick={onProcessLayout} className="bg-green-600 hover:bg-green-700">
                                <Play className="h-4 w-4 mr-2" /> Process
                            </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground italic text-center pt-1">
                            Draw lines to split the page. Click 'Process' to convert to frames.
                        </p>
                    </div>

                    {/* Custom Templates - My Templates (created during this session) */}
                    <div className="space-y-3">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            My Templates
                        </Label>

                        {customTemplates.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 px-4 text-center border-2 border-dashed border-muted-foreground/20 rounded-lg bg-muted/10">
                                <ImageOff className="h-8 w-8 text-muted-foreground/50 mb-2" />
                                <p className="text-xs text-muted-foreground">
                                    No templates yet.<br />
                                    Draw on the canvas and click <span className="font-medium">Process</span> to create your first template.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                {customTemplates.map((template) => (
                                    <button
                                        key={template.id}
                                        onClick={() => onSelectAdvancedTemplate(template)}
                                        className={cn(
                                            "aspect-square rounded-lg border-2 p-1 transition-all hover:border-primary/50 relative overflow-hidden bg-muted/30",
                                            selectedAdvancedTemplate?.id === template.id
                                                ? "border-primary ring-2 ring-primary/20"
                                                : "border-muted-foreground/20"
                                        )}
                                        title={`${template.name} (${getPhotoCount(template)} photos)`}
                                    >
                                        <TemplatePreview
                                            template={template}
                                            isSelected={selectedAdvancedTemplate?.id === template.id}
                                        />
                                        <span className="absolute bottom-0 left-0 right-0 text-[9px] text-center bg-background/90 py-1 font-medium truncate px-1">
                                            {template.name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Info Footer */}
                    <div className="p-4 border-t bg-muted/20">
                        <p className="text-xs text-muted-foreground text-center">
                            {selectedAdvancedTemplate
                                ? `${selectedAdvancedTemplate.name} • ${getPhotoCount(selectedAdvancedTemplate)} photos`
                                : 'Select a template'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
