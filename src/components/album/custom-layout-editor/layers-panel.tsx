import React from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, ChevronRight, ChevronsUp, ChevronsDown, Trash2, Box, Circle, Frame, RotateCcw, X, Lock, LockOpen, LayoutGrid } from 'lucide-react';
import { VectorObject } from '@/lib/advanced-layout-types';

interface LayersPanelProps {
    vectorObjects: VectorObject[];
    showGridProxy?: boolean;
    selectedIndices: number[];
    leaderIndex?: number | null;
    onSelect: (indices: number[]) => void;
    onDelete: (index: number) => void;
    onReorder: (objectId: string, direction: 'up' | 'down') => void;
    onResetRotation: (index: number) => void;
    onClose?: () => void;
    onDragStart?: (e: React.PointerEvent<HTMLDivElement>) => void;
    isDocked?: boolean;
    isDockLocked?: boolean;
    onToggleDockLock?: () => void;
    onCollapsedLayersChange?: (collapsedLayers: Record<number, boolean>) => void;
    contentScrollable?: boolean;
    className?: string;
}

export const LayersPanel = ({
    vectorObjects,
    showGridProxy = false,
    selectedIndices,
    leaderIndex = null,
    onSelect,
    onDelete,
    onReorder,
    onResetRotation,
    onClose,
    onDragStart,
    isDocked = false,
    isDockLocked = false,
    onToggleDockLock,
    onCollapsedLayersChange,
    contentScrollable = true,
    className
}: LayersPanelProps) => {
    const getIcon = (type: string) => {
        switch (type) {
            case 'rect': return <Box className="h-3 w-3" />;
            case 'circle': return <Circle className="h-3 w-3" />;
            case 'path': return <Frame className="h-3 w-3" />;
            default: return <Box className="h-3 w-3" />;
        }
    };

    const getName = (obj: VectorObject, index: number) => {
        if (obj.type === 'path') return `Frame ${index + 1}`;
        if (obj.type === 'rect') return `Rectangle ${index + 1}`;
        if (obj.type === 'circle') return `Circle ${index + 1}`;
        return `Object ${index + 1}`;
    };

    const layers = React.useMemo(() => {
        const groups: { [z: number]: { originalIndex: number, obj: VectorObject }[] } = {};
        vectorObjects.forEach((obj, i) => {
            const z = obj.zIndex ?? 0;
            if (!groups[z]) groups[z] = [];
            groups[z].push({ originalIndex: i, obj });
        });
        if (showGridProxy && !groups[0]) {
            groups[0] = [];
        }
        const sortedZ = Object.keys(groups).map(Number).sort((a, b) => b - a);
        return sortedZ.map(z => ({ z, items: groups[z].reverse(), hasGridProxy: showGridProxy && z === 0 }));
    }, [vectorObjects, showGridProxy]);

    const [collapsedLayers, setCollapsedLayers] = React.useState<Record<number, boolean>>({});

    React.useEffect(() => {
        setCollapsedLayers((prev) => {
            const next: Record<number, boolean> = {};
            layers.forEach((layer) => {
                next[layer.z] = prev[layer.z] ?? false;
            });
            return next;
        });
    }, [layers]);

    React.useEffect(() => {
        onCollapsedLayersChange?.(collapsedLayers);
    }, [collapsedLayers, onCollapsedLayersChange]);

    const collapseAll = () => {
        const next: Record<number, boolean> = {};
        layers.forEach((layer) => { next[layer.z] = true; });
        setCollapsedLayers(next);
    };

    const expandAll = () => {
        const next: Record<number, boolean> = {};
        layers.forEach((layer) => { next[layer.z] = false; });
        setCollapsedLayers(next);
    };

    const toggleLayer = (z: number) => {
        setCollapsedLayers((prev) => ({ ...prev, [z]: !prev[z] }));
    };

    const listContent = (
        <div className="p-2 pb-2 space-y-4">
            {layers.length === 0 && (
                <div className="text-center py-8 text-xs text-muted-foreground">
                    No objects
                </div>
            )}

            {layers.map((layer) => {
                const isCollapsed = !!collapsedLayers[layer.z];
                return (
                    <div key={layer.z} className="space-y-1">
                        <button
                            type="button"
                            className="w-full flex items-center justify-between px-2 py-1 bg-muted/30 rounded text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
                            onClick={() => toggleLayer(layer.z)}
                        >
                            <span className="flex items-center gap-1.5">
                                {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                <span>Layer {layer.z}</span>
                            </span>
                            <span className="text-[10px] opacity-70">{layer.items.length} items</span>
                        </button>

                        {!isCollapsed && (
                            <div className="space-y-0.5 pl-1">
                                {layer.hasGridProxy && (
                                    <div
                                        className="group flex items-center gap-2 px-2 py-1.5 rounded-md border border-dashed border-primary/30 bg-primary/5 text-sm"
                                        title="Grid Designer base object"
                                    >
                                        <div className="p-1 rounded-sm bg-primary/10 text-primary">
                                            <LayoutGrid className="h-3 w-3" />
                                        </div>
                                        <div className="flex-1 min-w-0 flex items-center gap-1.5">
                                            <span className="whitespace-nowrap text-xs font-medium text-primary">
                                                Grid Designer
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground/80">base</span>
                                    </div>
                                )}

                                {layer.items.map((item) => {
                                    const isSelected = selectedIndices.includes(item.originalIndex);
                                    const isLeader = selectedIndices.length > 1 && leaderIndex === item.originalIndex;

                                    return (
                                        <div
                                            key={item.obj.id}
                                            className={cn(
                                                "group flex items-center gap-2 px-2 py-1.5 rounded-md border border-transparent text-sm cursor-pointer hover:bg-muted/50 transition-colors",
                                                isSelected && "bg-primary/10 border-primary/20 text-primary"
                                            )}
                                            onClick={() => onSelect([item.originalIndex])}
                                        >
                                            <div className={cn(
                                                "p-1 rounded-sm bg-muted text-muted-foreground",
                                                isSelected && "bg-primary/20 text-primary"
                                            )}>
                                                {getIcon(item.obj.type)}
                                            </div>

                                            <div className="flex-1 min-w-0 flex items-center gap-1.5">
                                                <span className="whitespace-nowrap text-xs font-medium">
                                                    {getName(item.obj, item.originalIndex)}
                                                </span>
                                                {isLeader && (
                                                    <span className="shrink-0 rounded-sm bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1 py-[1px] text-[9px] font-semibold leading-none">
                                                        Lead
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center opacity-70 group-hover:opacity-100 transition-opacity gap-0.5">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onReorder(item.obj.id, 'up');
                                                    }}
                                                    title="Layer Up"
                                                >
                                                    <ChevronUp className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onReorder(item.obj.id, 'down');
                                                    }}
                                                    disabled={layer.z <= 0}
                                                    title="Layer Down"
                                                >
                                                    <ChevronDown className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onResetRotation(item.originalIndex);
                                                    }}
                                                    title="Reset Rotation"
                                                >
                                                    <RotateCcw className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5 text-muted-foreground hover:text-destructive"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDelete(item.originalIndex);
                                                    }}
                                                    title="Delete"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );

    return (
        <div
            className={cn(
                "flex flex-col h-full w-full bg-background pointer-events-auto overflow-hidden",
                isDocked ? "border-0 rounded-none shadow-none" : "border rounded-lg shadow-lg",
                className
            )}
        >
            <div
                className={cn(
                    "p-3 border-b bg-muted/20 select-none",
                    onDragStart ? "cursor-move" : "cursor-default"
                )}
                onPointerDown={onDragStart}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Layers</span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-muted-foreground hover:text-foreground"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                expandAll();
                            }}
                            title="Expand All Layers"
                        >
                            <ChevronsDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-muted-foreground hover:text-foreground"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                collapseAll();
                            }}
                            title="Collapse All Layers"
                        >
                            <ChevronsUp className="h-3.5 w-3.5" />
                        </Button>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {vectorObjects.length + (showGridProxy ? 1 : 0)} objects
                        </span>
                        {isDocked && onToggleDockLock && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleDockLock();
                                }}
                                title={isDockLocked ? "Undock panel" : "Lock dock"}
                            >
                                {isDockLocked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                            </Button>
                        )}
                        {onClose && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClose();
                                }}
                                title="Close Layers Panel"
                            >
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {contentScrollable ? (
                <ScrollArea className="flex-1 min-h-0">
                    {listContent}
                </ScrollArea>
            ) : (
                <div className="flex-1 min-h-0 overflow-hidden">
                    {listContent}
                </div>
            )}

            <div className="px-3 py-2 border-t bg-muted/10">
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    Total layers: {layers.length}
                </span>
            </div>
        </div>
    );
};
