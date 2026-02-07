'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Layout, Pencil, Square, Circle, Trash2, FlipHorizontal, X, MousePointer2, BookOpen, Book } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToolMode } from './custom-layout-editor-overlay';
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
    // Spacing/Layout Controls
    spreadMode: 'full' | 'split';
    onToggleSpreadMode: () => void;
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
    onFillColorChange,
    spreadMode,
    onToggleSpreadMode
}: FloatingToolbarProps) => {
    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-background border shadow-lg rounded-lg p-2 flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "h-8 w-8 transition-colors",
                        spreadMode === 'full'
                            ? "text-[#e35a6b] bg-[#fdf0f1] hover:bg-[#fae1e4] dark:bg-[#3d2428] dark:text-[#ff8a9a] dark:hover:bg-[#4d2e32]"
                            : "text-muted-foreground hover:bg-muted"
                    )}
                    onClick={onToggleSpreadMode}
                    title={spreadMode === 'full' ? "Double Page Mode" : "Single Page Mode"}
                >
                    <BookOpen className="h-4 w-4" />
                </Button>
            </div>

            <Separator orientation="vertical" className="h-6" />

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
                        min="0"
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
