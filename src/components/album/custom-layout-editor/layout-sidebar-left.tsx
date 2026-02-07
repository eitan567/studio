'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Layout, Pencil, Square, Circle, Trash2, Play, ImageOff, FlipHorizontal, X, Frame, Loader2, Settings2 } from 'lucide-react';
import { getPhotoCount } from '@/hooks/useTemplates';
import { AdvancedTemplate } from '@/lib/advanced-layout-types';
import { useCanvaFrames } from '@/hooks/useCanvaFrames';
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
    // Fetch frames from database
    const { frames: canvaFrames, loading: framesLoading } = useCanvaFrames();
    return (
        <div className="w-full h-full border-r bg-background flex flex-col shrink-0 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b h-14 flex items-center justify-between bg-accent/5">
                <h2 className="font-semibold text-sm uppercase tracking-wider text-primary flex items-center gap-2">
                    <Layout className="w-4 h-4" /> Layout Tools
                </h2>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col min-h-0">
                {/* Tools Section - Top Fixed */}
                <div className="p-4 space-y-4 shrink-0">
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Vector Tools
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                variant={toolMode === 'select' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => onToolChange('select')}
                                className="justify-start gap-2"
                            >
                                <Play className="h-3.5 w-3.5 rotate-90" /> Select
                            </Button>
                            <Button
                                variant={toolMode === 'pencil' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => onToolChange('pencil')}
                                className="justify-start gap-2"
                            >
                                <Pencil className="h-3.5 w-3.5" /> Pencil
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="px-4 shrink-0">
                    <Separator />
                </div>

                {/* Canva Frames - Scrollable Section */}
                <div className="flex-1 flex flex-col min-h-0 p-4 space-y-3">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <Frame className="h-3.5 w-3.5" /> Frame Shapes
                    </Label>

                    <ScrollArea className="flex-1">
                        <div className="p-2 pr-4 grid grid-cols-2 gap-2">
                            {framesLoading ? (
                                <div className="col-span-2 flex items-center justify-center py-8">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                </div>
                            ) : canvaFrames.length === 0 ? (
                                <div className="col-span-2 py-4 text-center text-muted-foreground text-xs">
                                    No frames available
                                </div>
                            ) : canvaFrames.map((template) => {
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
                                        className="aspect-square rounded-md border-2 p-1 transition-all hover:border-primary/50 relative overflow-hidden bg-muted/30 border-muted"
                                        onClick={() => onAddCanvaFrame(template)}
                                        title={template.name}
                                    >
                                        <div className="w-full h-full relative overflow-hidden bg-muted rounded-sm">
                                            <svg viewBox={viewBox} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                                                <defs>
                                                    <clipPath id={clipId}>
                                                        <path d={pathD} />
                                                    </clipPath>
                                                    <linearGradient id={`thumbSky-${template.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                                        <stop offset="0%" stopColor="#b8e4f9" />
                                                        <stop offset="100%" stopColor="#e8f6fc" />
                                                    </linearGradient>
                                                    <linearGradient id={`thumbHill1-${template.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                                        <stop offset="0%" stopColor="#9cd67e" />
                                                        <stop offset="100%" stopColor="#7cc45a" />
                                                    </linearGradient>
                                                    <linearGradient id={`thumbHill2-${template.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                                        <stop offset="0%" stopColor="#85c95c" />
                                                        <stop offset="100%" stopColor="#6ab344" />
                                                    </linearGradient>
                                                </defs>
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
                                            </svg>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </div>

                <div className="px-4 shrink-0">
                    <Separator />
                </div>

                {/* Footer */}
                <div className="p-4 shrink-0 bg-accent/5">
                    <p className="text-[10px] text-muted-foreground text-center line-clamp-2">
                        {selectedAdvancedTemplate
                            ? `${selectedAdvancedTemplate.name} • ${getPhotoCount(selectedAdvancedTemplate)} photos`
                            : 'Select a template or use tools to draw'}
                    </p>
                </div>
            </div>
        </div>
    );
};
