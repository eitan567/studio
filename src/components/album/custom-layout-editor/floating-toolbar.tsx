'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
    Pencil,
    Square,
    Circle,
    Trash2,
    FlipHorizontal,
    X,
    MousePointer2,
    BookOpen,
    Ruler,
    Play,
    Layers,
    AlignHorizontalJustifyCenter,
    AlignVerticalJustifyCenter,
    Layout,
    Maximize,
    RotateCcw,
    RotateCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToolMode } from './custom-layout-editor-overlay';
import { Separator } from '@/components/ui/separator';
import { GridDesignerMode } from './grid-designer-types';
import { TemplateImageRotationMode } from '@/lib/advanced-layout-types';

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
    imageRotationMode: TemplateImageRotationMode;
    onImageRotationModeChange: (mode: TemplateImageRotationMode) => void;
    // Spacing/Layout Controls
    spreadMode: 'full' | 'split';
    onToggleSpreadMode: () => void;
    showGuides: boolean;
    onToggleGuides: () => void;
    isLayersPanelOpen: boolean;
    onToggleLayersPanel: () => void;
    // Grid Designer Controls
    gridRows: number;
    onGridRowsChange: (rows: number) => void;
    gridCols: number;
    onGridColsChange: (cols: number) => void;
    onCreateGrid: () => void;
    gridDesignerEnabled: boolean;
    gridDesignerMode: GridDesignerMode;
    onGridModeChange: (mode: GridDesignerMode) => void;
    hasGridSegments: boolean;
    gridRotationDeg: number;
    onRotateGrid: (deltaDeg: number) => void;
    isGridRotationActive: boolean;
    // Action Controls
    onClearStrokes: () => void;
    onProcessLayout: () => void;
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
    imageRotationMode,
    onImageRotationModeChange,
    spreadMode,
    onToggleSpreadMode,
    showGuides,
    onToggleGuides,
    isLayersPanelOpen,
    onToggleLayersPanel,
    gridRows,
    onGridRowsChange,
    gridCols,
    onGridColsChange,
    onCreateGrid,
    gridDesignerEnabled,
    gridDesignerMode,
    onGridModeChange,
    hasGridSegments,
    gridRotationDeg,
    onRotateGrid,
    isGridRotationActive,
    onClearStrokes,
    onProcessLayout
}: FloatingToolbarProps) => {
    return (
        <>
            {/* Top Toolbar: tools above the page */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-background/95 backdrop-blur-sm border shadow-md rounded-full p-2 px-4 flex items-center gap-4">
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
                        onClick={() => onToolChange('pencil')}
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

                    <Separator orientation="vertical" className="h-6 mx-1" />

                    <Button
                        variant={showGuides ? "secondary" : "ghost"}
                        size="icon"
                        className={cn("h-8 w-8", showGuides && "text-primary")}
                        onClick={onToggleGuides}
                        title="Toggle Rulers & Grid"
                    >
                        <Ruler className="h-4 w-4" />
                    </Button>

                    <Button
                        variant={isLayersPanelOpen ? "secondary" : "ghost"}
                        size="icon"
                        className={cn("h-8 w-8", isLayersPanelOpen && "text-primary")}
                        onClick={onToggleLayersPanel}
                        title={isLayersPanelOpen ? "Hide Layers Panel" : "Show Layers Panel"}
                    >
                        <Layers className="h-4 w-4" />
                    </Button>
                </div>

                <Separator orientation="vertical" className="h-6" />

                {/* Grid Designer Group */}
                <div className="flex items-center gap-1">
                    <input
                        type="number"
                        min={1}
                        max={12}
                        value={gridRows}
                        onChange={(e) => onGridRowsChange(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
                        className="h-8 w-10 rounded-md border border-input bg-background px-1 text-center text-[10px]"
                        title="Grid rows"
                    />
                    <input
                        type="number"
                        min={1}
                        max={12}
                        value={gridCols}
                        onChange={(e) => onGridColsChange(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
                        className="h-8 w-10 rounded-md border border-input bg-background px-1 text-center text-[10px]"
                        title="Grid columns"
                    />
                    <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8"
                        onClick={onCreateGrid}
                        title="Create equal grid"
                    >
                        <Layout className="h-4 w-4" />
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onRotateGrid(-5)}
                        disabled={!hasGridSegments}
                        title="Rotate grid -5deg"
                    >
                        <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onRotateGrid(5)}
                        disabled={!hasGridSegments}
                        title="Rotate grid +5deg"
                    >
                        <RotateCw className="h-4 w-4" />
                    </Button>
                    <span className="w-10 text-center text-[10px] font-mono text-muted-foreground">
                        {`${Math.round(gridRotationDeg)}°`}
                    </span>

                    <Separator orientation="vertical" className="h-6 mx-1" />

                    <Button
                        variant={gridDesignerEnabled && gridDesignerMode === 'move' ? "secondary" : "ghost"}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onGridModeChange('move')}
                        disabled={!hasGridSegments}
                        title="Move segments"
                    >
                        <Maximize className="h-4 w-4" />
                    </Button>
                    <Button
                        variant={gridDesignerEnabled && gridDesignerMode === 'delete' ? "secondary" : "ghost"}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onGridModeChange('delete')}
                        disabled={!hasGridSegments}
                        title="Delete segment"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                        variant={gridDesignerEnabled && gridDesignerMode === 'add-horizontal' ? "secondary" : "ghost"}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onGridModeChange('add-horizontal')}
                        disabled={!hasGridSegments}
                        title="Add horizontal segment inside a cell"
                    >
                        <AlignVerticalJustifyCenter className="h-4 w-4" />
                    </Button>
                    <Button
                        variant={gridDesignerEnabled && gridDesignerMode === 'add-vertical' ? "secondary" : "ghost"}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onGridModeChange('add-vertical')}
                        disabled={!hasGridSegments}
                        title="Add vertical segment inside a cell"
                    >
                        <AlignHorizontalJustifyCenter className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Bottom Toolbar: style + actions */}
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-50 bg-background/95 backdrop-blur-sm border shadow-md rounded-full p-2 px-4 flex items-center gap-4">
                {/* Image Mode Group */}
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                        Image Mode
                    </span>
                    <div className="flex items-center rounded-full border border-border/70 bg-muted/20 p-0.5">
                        <Button
                            type="button"
                            variant={imageRotationMode === 'follow-frame' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-6 rounded-full px-2 text-[10px]"
                            onClick={() => onImageRotationModeChange('follow-frame')}
                        >
                            Follow
                        </Button>
                        <Button
                            type="button"
                            variant={imageRotationMode === 'keep-horizontal' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-6 rounded-full px-2 text-[10px]"
                            onClick={() => onImageRotationModeChange('keep-horizontal')}
                        >
                            Horizontal
                        </Button>
                    </div>
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

                <Separator orientation="vertical" className="h-6" />

                {/* Main Action Group */}
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClearStrokes}
                        className="text-primary hover:text-primary hover:bg-primary/10 h-8 px-3 rounded-full flex items-center gap-2"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Clear All</span>
                    </Button>

                    <Button
                        size="sm"
                        onClick={onProcessLayout}
                        className="bg-green-600 hover:bg-green-700 h-8 px-4 rounded-full flex items-center gap-2 text-white shadow-sm transition-all active:scale-95"
                    >
                        <Play className="h-3.5 w-3.5 fill-current" />
                        <span className="text-xs font-medium">Process Layout</span>
                    </Button>
                </div>
            </div>
        </>
    );
};
