'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Layout, Pencil, Square, Circle, Trash2, Play, ImageOff, FlipHorizontal, X, Frame } from 'lucide-react';
import { getPhotoCount } from '@/hooks/useTemplates';
import { AdvancedTemplate } from '@/lib/advanced-layout-types';
import { CANVA_TEMPLATES } from '@/lib/canva-templates-data';
import { cn } from '@/lib/utils';
import { TemplatePreview } from '@/components/album/shared/template-preview';

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
    isMirrorMode: boolean;
    onToggleMirrorMode: () => void;
    // Property Controls
    strokeColor: string;
    onStrokeColorChange: (color: string) => void;
    strokeWidth: number;
    onStrokeWidthChange: (width: number) => void;
    fillColor: string;
    onFillColorChange: (color: string) => void;
    // Canva Frame Shapes
    onAddCanvaFrame: (template: AdvancedTemplate) => void;
}



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
    onProcessLayout,
    isMirrorMode,
    onToggleMirrorMode,
    strokeColor,
    onStrokeColorChange,
    strokeWidth,
    onStrokeWidthChange,
    fillColor,
    onFillColorChange,
    onAddCanvaFrame
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
                            <Button
                                variant={isMirrorMode ? "default" : "outline"}
                                className="justify-start gap-2 h-9"
                                onClick={onToggleMirrorMode}
                            >
                                <FlipHorizontal className="h-4 w-4" /> Mirror
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

                    {/* Property Controls Section */}
                    <div className="space-y-4 pt-2 border-t">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Shape Properties
                        </Label>

                        <div className="space-y-3">
                            {/* Stroke Color */}
                            <div className="flex items-center justify-between gap-2">
                                <Label className="text-xs">Stroke</Label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={strokeColor === 'transparent' ? '#000000' : strokeColor}
                                        onChange={(e) => onStrokeColorChange(e.target.value)}
                                        className="w-6 h-6 rounded cursor-pointer border-none bg-transparent"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => onStrokeColorChange('transparent')}
                                        title="No Stroke"
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>

                            {/* Stroke Width */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between">
                                    <Label className="text-xs">Thickness</Label>
                                    <span className="text-[10px] font-mono">{strokeWidth.toFixed(1)}pt</span>
                                </div>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="5"
                                    step="0.1"
                                    value={strokeWidth}
                                    onChange={(e) => onStrokeWidthChange(parseFloat(e.target.value))}
                                    className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                                />
                            </div>

                            {/* Fill Color */}
                            <div className="flex items-center justify-between gap-2">
                                <Label className="text-xs">Fill</Label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={fillColor === 'transparent' ? '#ffffff' : fillColor}
                                        onChange={(e) => onFillColorChange(e.target.value)}
                                        className="w-6 h-6 rounded cursor-pointer border-none bg-transparent"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => onFillColorChange('transparent')}
                                        title="No Fill"
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Frame Shapes Section */}
                    <div className="space-y-3 pt-4 border-t">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                            <Frame className="h-3.5 w-3.5" /> Frame Shapes
                        </Label>
                        <p className="text-[10px] text-muted-foreground italic">
                            Click to add a decorative frame to the canvas.
                        </p>
                        <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pr-1">
                            {CANVA_TEMPLATES.map((template) => {
                                // Get the first region's path for preview
                                const firstRegion = template.regions[0];
                                const pathD = firstRegion?.path || '';
                                const viewBox = firstRegion?.viewBox || '0 0 100 100';
                                const clipId = `thumb-clip-${template.id}`;
                                // Parse viewBox for positioning placeholder elements
                                const vb = viewBox.split(' ').map(Number);
                                const vbX = vb[0] || 0;
                                const vbY = vb[1] || 0;
                                const vbW = vb[2] || 100;
                                const vbH = vb[3] || 100;
                                return (
                                    <button
                                        key={template.id}
                                        className="aspect-square border rounded-md hover:border-primary hover:bg-primary/5 p-1 transition-all bg-muted/20"
                                        onClick={() => onAddCanvaFrame(template)}
                                        title={template.name}
                                    >
                                        <svg viewBox={viewBox} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                                            <defs>
                                                <clipPath id={clipId}>
                                                    <path d={pathD} />
                                                </clipPath>
                                                <linearGradient id={`thumbSky-${template.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                                    <stop offset="0%" stopColor="#d4eaf7" />
                                                    <stop offset="100%" stopColor="#eef8ff" />
                                                </linearGradient>
                                                <linearGradient id={`thumbHill1-${template.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                                    <stop offset="0%" stopColor="#90d5ac" />
                                                    <stop offset="100%" stopColor="#76c893" />
                                                </linearGradient>
                                                <linearGradient id={`thumbHill2-${template.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                                    <stop offset="0%" stopColor="#76c893" />
                                                    <stop offset="100%" stopColor="#52b788" />
                                                </linearGradient>
                                            </defs>
                                            {/* Placeholder clipped to frame shape */}
                                            <g clipPath={`url(#${clipId})`}>
                                                <rect x={vbX} y={vbY} width={vbW} height={vbH} fill={`url(#thumbSky-${template.id})`} />
                                                <circle cx={vbX + vbW * 0.85} cy={vbY + vbH * 0.15} r={vbW * 0.08} fill="#fdf2a4" />
                                                <g fill="white" opacity="0.6">
                                                    <circle cx={vbX + vbW * 0.2} cy={vbY + vbH * 0.2} r={vbW * 0.05} />
                                                    <circle cx={vbX + vbW * 0.25} cy={vbY + vbH * 0.22} r={vbW * 0.06} />
                                                    <circle cx={vbX + vbW * 0.3} cy={vbY + vbH * 0.2} r={vbW * 0.05} />
                                                </g>
                                                <path
                                                    d={`M ${vbX - vbW * 0.1} ${vbY + vbH} Q ${vbX + vbW * 0.5} ${vbY + vbH * 0.4} ${vbX + vbW * 1.1} ${vbY + vbH} Z`}
                                                    fill={`url(#thumbHill1-${template.id})`}
                                                    opacity="0.9"
                                                />
                                                <path
                                                    d={`M ${vbX - vbW * 0.2} ${vbY + vbH} Q ${vbX + vbW * 0.3} ${vbY + vbH * 0.6} ${vbX + vbW * 0.8} ${vbY + vbH * 1.1} Z`}
                                                    fill={`url(#thumbHill2-${template.id})`}
                                                />
                                            </g>
                                            {/* Frame border */}
                                            <path d={pathD} fill="none" stroke="#555" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                                        </svg>
                                    </button>
                                );
                            })}
                        </div>
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
                                        <div className="w-full h-full relative overflow-hidden bg-muted rounded-sm">
                                            <TemplatePreview template={template} />
                                        </div>
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
