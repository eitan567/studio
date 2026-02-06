import React from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, Play } from 'lucide-react';

interface BottomToolbarProps {
    onClearStrokes: () => void;
    onProcessLayout: () => void;
}

export const BottomToolbar = ({
    onClearStrokes,
    onProcessLayout
}: BottomToolbarProps) => {
    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 pointer-events-auto">
            <div className="bg-background/90 backdrop-blur border shadow-md rounded-full px-4 py-2 flex items-center gap-3">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClearStrokes}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-3 rounded-full flex items-center gap-2"
                >
                    <Trash2 className="h-4 w-4" />
                    <span>Clear All</span>
                </Button>

                <div className="w-[1px] h-4 bg-border" />

                <Button
                    size="sm"
                    onClick={onProcessLayout}
                    className="bg-green-600 hover:bg-green-700 h-8 px-4 rounded-full flex items-center gap-2 text-white"
                >
                    <Play className="h-4 w-4 fill-current" />
                    <span>Process Layout</span>
                </Button>
            </div>
        </div>
    );
};
