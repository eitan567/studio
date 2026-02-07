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
            <div className="bg-background flex flex-col border-r shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] transition-all duration-300">
                {/* Header */}
                <div className="p-4 border-b h-14 flex items-center justify-between bg-accent/5">
                    <h2 className="font-semibold text-sm uppercase tracking-wider text-primary flex items-center gap-2">
                        <Layout className="w-4 h-4" /> Layout Tools
                    </h2>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">




                    {/* Frame Shapes Section */}
                    <div className="space-y-3">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                            <Frame className="h-3.5 w-3.5" /> Frame Shapes
                        </Label>
                        <p className="text-[10px] text-muted-foreground italic">
                            Click to add a decorative frame to the canvas.
                        </p>
                        <div className="grid grid-cols-3 gap-1.5 max-h-[400px] overflow-y-auto pr-1">
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
                                                {/* More vibrant sky gradient - matches Canva style */}
                                                <linearGradient id={`thumbSky-${template.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                                    <stop offset="0%" stopColor="#b8e4f9" />
                                                    <stop offset="100%" stopColor="#e8f6fc" />
                                                </linearGradient>
                                                {/* More vibrant hill gradients - matches Canva style */}
                                                <linearGradient id={`thumbHill1-${template.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                                    <stop offset="0%" stopColor="#9cd67e" />
                                                    <stop offset="100%" stopColor="#7cc45a" />
                                                </linearGradient>
                                                <linearGradient id={`thumbHill2-${template.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                                    <stop offset="0%" stopColor="#85c95c" />
                                                    <stop offset="100%" stopColor="#6ab344" />
                                                </linearGradient>
                                            </defs>
                                            {/* Placeholder clipped to frame shape */}
                                            <g clipPath={`url(#${clipId})`}>
                                                <rect x={vbX} y={vbY} width={vbW} height={vbH} fill={`url(#thumbSky-${template.id})`} />
                                                <circle cx={vbX + vbW * 0.85} cy={vbY + vbH * 0.15} r={vbW * 0.08} fill="#fdf2a4" />
                                                <g fill="white" opacity="0.8">
                                                    <circle cx={vbX + vbW * 0.2} cy={vbY + vbH * 0.2} r={vbW * 0.05} />
                                                    <circle cx={vbX + vbW * 0.25} cy={vbY + vbH * 0.22} r={vbW * 0.06} />
                                                    <circle cx={vbX + vbW * 0.3} cy={vbY + vbH * 0.2} r={vbW * 0.05} />
                                                </g>
                                                <path
                                                    d={`M ${vbX - vbW * 0.1} ${vbY + vbH} Q ${vbX + vbW * 0.5} ${vbY + vbH * 0.4} ${vbX + vbW * 1.1} ${vbY + vbH} Z`}
                                                    fill={`url(#thumbHill1-${template.id})`}
                                                />
                                                <path
                                                    d={`M ${vbX - vbW * 0.2} ${vbY + vbH} Q ${vbX + vbW * 0.3} ${vbY + vbH * 0.6} ${vbX + vbW * 0.8} ${vbY + vbH * 1.1} Z`}
                                                    fill={`url(#thumbHill2-${template.id})`}
                                                />
                                            </g>
                                            {/* No frame border - clean look like Canva */}
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
