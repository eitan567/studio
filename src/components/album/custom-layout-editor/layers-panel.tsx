import React from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, Trash2, Box, Circle, Rat, Frame } from 'lucide-react';
import { VectorObject } from '@/lib/advanced-layout-types';

interface LayersPanelProps {
    vectorObjects: VectorObject[];
    selectedIndices: number[];
    onSelect: (indices: number[]) => void;
    onDelete: (index: number) => void;
    onReorder: (index: number, direction: 'up' | 'down') => void;
}

export const LayersPanel = ({
    vectorObjects,
    selectedIndices,
    onSelect,
    onDelete,
    onReorder
}: LayersPanelProps) => {

    // Helper to get icon based on type
    const getIcon = (type: string) => {
        switch (type) {
            case 'rect': return <Box className="h-3 w-3" />;
            case 'circle': return <Circle className="h-3 w-3" />;
            case 'path': return <Frame className="h-3 w-3" />;
            default: return <Box className="h-3 w-3" />;
        }
    };

    // Helper to get name
    const getName = (obj: VectorObject, index: number) => {
        if (obj.type === 'path') return `Frame ${index + 1}`;
        if (obj.type === 'rect') return `Rectangle ${index + 1}`;
        if (obj.type === 'circle') return `Circle ${index + 1}`;
        return `Object ${index + 1}`;
    };

    // We render the list in reverse order visually (Top layer at top of list), 
    // but we need to map clicks back to the original index.
    // However, simplest way is just to iterate normally but use flex-col-reverse if we wanted visual stacking,
    // OR just map standard order (Index 0 = Bottom).
    // Usually Layers panel shows Top layer at Top.
    // So VectorObjects[length-1] is Top.

    // Group items by Z-Index
    const layers = React.useMemo(() => {
        const groups: { [z: number]: { originalIndex: number, obj: VectorObject }[] } = {};
        vectorObjects.forEach((obj, i) => {
            const z = obj.zIndex ?? 0;
            if (!groups[z]) groups[z] = [];
            groups[z].push({ originalIndex: i, obj });
        });
        // Sort Z-indices descending (Top layer first)
        const sortedZ = Object.keys(groups).map(Number).sort((a, b) => b - a);
        return sortedZ.map(z => ({ z, items: groups[z].reverse() })); // Items within layer reversed to show top-first visually? Or maybe standard order? Standard order within layer is fine.
        // Actually, within a layer, index matters for "sub-ordering" (painting order).
        // Let's reverse items so highest index (painted last/on top) is at top of list.
    }, [vectorObjects]);

    return (
        <div className="flex flex-col h-full bg-background border-l w-64 pointer-events-auto shadow-sm">
            <div className="p-3 border-b flex items-center justify-between bg-muted/20">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Layers</span>
                <span className="text-[10px] text-muted-foreground">{vectorObjects.length} objects</span>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-2 space-y-4">
                    {layers.length === 0 && (
                        <div className="text-center py-8 text-xs text-muted-foreground">
                            No objects
                        </div>
                    )}

                    {layers.map((layer) => (
                        <div key={layer.z} className="space-y-1">
                            <div className="flex items-center justify-between px-2 py-1 bg-muted/30 rounded text-xs font-medium text-muted-foreground">
                                <span>Layer {layer.z}</span>
                                <span className="text-[10px] opacity-70">{layer.items.length} items</span>
                            </div>

                            <div className="space-y-0.5 pl-1">
                                {layer.items.map((item) => {
                                    const isSelected = selectedIndices.includes(item.originalIndex);

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

                                            <span className="flex-1 truncate text-xs font-medium">
                                                {getName(item.obj, item.originalIndex)}
                                            </span>

                                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-0.5">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onReorder(item.originalIndex, 'up'); // Treat 'up' as +Z
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
                                                        onReorder(item.originalIndex, 'down'); // Treat 'down' as -Z
                                                    }}
                                                    disabled={layer.z <= 0} // Assuming 0 is min? Or 1? Let's check logic.
                                                    title="Layer Down"
                                                >
                                                    <ChevronDown className="h-3 w-3" />
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
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
};
