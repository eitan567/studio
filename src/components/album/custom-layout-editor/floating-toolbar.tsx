'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Layout, Pencil, Square, Circle, Trash2, FlipHorizontal, X, MousePointer2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToolMode } from './layout-sidebar-left';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';

// Interface
interface FloatingToolbarProps {
    toolMode: ToolMode;
    onToolChange: (mode: ToolMode) => void;
    isMirrorMode: boolean;
    onToggleMirrorMode: () => void;
    // Property Controls
    strokeColor: string;
    onStrokeColorChange: (color: string) => void;
    strokeWidth: number;
    onStrokeWidthChange: (width: number) => void;
    fillColor: string;
    onFillColorChange: (color: string) => void;
}

export const FloatingToolbar = ({
    toolMode,
    onToolChange,
    isMirrorMode,
    onToggleMirrorMode,
    strokeColor,
    onStrokeColorChange,
    strokeWidth,
    onStrokeWidthChange,
    fillColor,
    onFillColorChange
}: FloatingToolbarProps) => {
    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-background border shadow-lg rounded-lg p-2 flex items-center gap-3">
            {/* Vector Tools Group */}
            <div className="flex items-center gap-1">
                <Button
                    variant={toolMode === 'select' ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onToolChange('select')}
                    title="Select"
                >
                    <MousePointer2 className="h-4 w-4" />
                </Button>
                <Button
                    variant={toolMode === 'pencil' ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onToolChange('pencil')} // Line tool mapped to pencil mode for now as per original code
                    title="Line Tool"
                >
                    <Pencil className="h-4 w-4" />
                </Button>
                <Button
                    variant={toolMode === 'freehand' ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onToolChange('freehand')}
                    title="Freehand Tool"
                >
                    <Layout className="h-4 w-4" />
                    {/* Using Layout icon as placeholder for Freehand if Pencil is used for Line, or switch icons. 
                        Checking original sidebar: 
                        Line -> Pencil icon
                        Free -> Pencil icon
                        Wait, original code used Pencil for BOTH Line and Free? 
                        Line -> Pencil className="h-4 w-4"
                        Free -> Pencil className="h-4 w-4"
                        Let's try to distinguish them. 'Line' usually is a Slash or Pen. 'Free' is a Pencil or Brush.
                        I'll use 'Pencil' for Free and maybe 'Minus' or 'Slash' or 'PenTool' for Line if available, or just keep as is but add titles. 
                        Let's use 'Pencil' for Line (as per original) and maybe 'Edit3' or similar for Freehand? 
                        Actually, original reused Pencil for both. I will keep Pencil for Line and maybe 'Signature' or 'Scribble' if available, otherwise reuse Pencil but change titles.
                        Let's stick to valid Lucide icons.
                        Line -> Pencil
                        Free -> 'Signature' is not in Lucide regular set? 'Pen' is.
                        Let's use Pencil for Line and 'Pen' for Freehand?
                        Or just keep them distinct by position/title.
                    */}
                </Button>
                <Button
                    variant={toolMode === 'rect' ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onToolChange('rect')}
                    title="Rectangle Tool"
                >
                    <Square className="h-4 w-4" />
                </Button>
                <Button
                    variant={toolMode === 'circle' ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onToolChange('circle')}
                    title="Circle Tool"
                >
                    <Circle className="h-4 w-4" />
                </Button>

                <Separator orientation="vertical" className="h-6 mx-1" />

                <Button
                    variant={isMirrorMode ? "secondary" : "ghost"}
                    size="icon"
                    className={cn("h-8 w-8", isMirrorMode && "text-primary")}
                    onClick={onToggleMirrorMode}
                    title="Toggle Mirror Mode"
                >
                    <FlipHorizontal className="h-4 w-4" />
                </Button>
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* Shape Properties Group */}
            <div className="flex items-center gap-3">
                {/* Stroke Color */}
                <div className="flex items-center gap-2" title="Stroke Color">
                    <div className="relative w-6 h-6 overflow-hidden rounded-full border border-muted-foreground/20 cursor-pointer">
                        <input
                            type="color"
                            value={strokeColor === 'transparent' ? '#000000' : strokeColor}
                            onChange={(e) => onStrokeColorChange(e.target.value)}
                            className="absolute inset-0 w-[150%] h-[150%] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-0 border-0 cursor-pointer"
                        />
                        {strokeColor === 'transparent' && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-background">
                                <span className="rotate-45 text-red-500 font-bold block w-full h-[2px] bg-red-500"></span>
                            </div>
                        )}
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground p-0"
                        onClick={() => onStrokeColorChange('transparent')}
                        title="No Stroke"
                    >
                        <X className="h-3 w-3" />
                    </Button>
                </div>

                {/* Stroke Width */}
                <div className="flex items-center gap-2 w-24" title="Stroke Width">
                    <input
                        type="range"
                        min="0.1"
                        max="5"
                        step="0.1"
                        value={strokeWidth}
                        onChange={(e) => onStrokeWidthChange(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <span className="text-[10px] font-mono w-8 text-right">{strokeWidth.toFixed(1)}</span>
                </div>

                {/* Fill Color */}
                <div className="flex items-center gap-2" title="Fill Color">
                    <div className="relative w-6 h-6 overflow-hidden rounded-full border border-muted-foreground/20 cursor-pointer">
                        <input
                            type="color"
                            value={fillColor === 'transparent' ? '#ffffff' : fillColor}
                            onChange={(e) => onFillColorChange(e.target.value)}
                            className="absolute inset-0 w-[150%] h-[150%] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-0 border-0 cursor-pointer"
                        />
                        {fillColor === 'transparent' && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="rotate-45 text-red-500 font-bold block w-full h-[1px] bg-red-500"></span>
                            </div>
                        )}
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground p-0"
                        onClick={() => onFillColorChange('transparent')}
                        title="No Fill"
                    >
                        <X className="h-3 w-3" />
                    </Button>
                </div>
            </div>
        </div>
    );
};
