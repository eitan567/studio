import React from 'react';
import { Button } from '@/components/ui/button';
import { Type, Check, X } from 'lucide-react';

interface SidebarLeftProps {
    onAddText: () => void;
    activeView: 'front' | 'back' | 'full';
    onViewChange: (view: 'front' | 'back' | 'full') => void;
    onSave: () => void;
    onCancel: () => void;
}

export const SidebarLeft = ({ onAddText, activeView, onViewChange, onSave, onCancel }: SidebarLeftProps) => {
    return (
        <div className="w-16 border-r flex flex-col items-center py-4 gap-4 bg-muted/10 h-full">

            {/* Actions Group */}
            <div className="flex flex-col gap-2">
                <Button
                    variant="default"
                    size="icon"
                    onClick={onSave}
                    className="bg-green-600 hover:bg-green-700 text-white shadow-md rounded-full h-10 w-10"
                    title="Save Changes"
                >
                    <Check className="h-5 w-5" />
                </Button>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onCancel}
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-full h-10 w-10"
                    title="Cancel"
                >
                    <X className="h-5 w-5" />
                </Button>
            </div>

            <div className="w-8 h-px bg-border/50 my-2" />

            <Button variant="outline" size="icon" title="Add Text" onClick={onAddText}>
                <Type className="h-5 w-5" />
            </Button>

            <div className="w-8 h-px bg-border/50 my-2" />

            {/* View Switchers */}
            <div className="flex flex-col gap-2">
                <Button
                    variant={activeView === 'full' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-8 w-8 text-[10px]"
                    onClick={() => onViewChange('full')}
                    title="Full Spread"
                >
                    Full
                </Button>
                <Button
                    variant={activeView === 'front' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-8 w-8 text-[10px]"
                    onClick={() => onViewChange('front')}
                    title="Front Cover"
                >
                    Front
                </Button>
                <Button
                    variant={activeView === 'back' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-8 w-8 text-[10px]"
                    onClick={() => onViewChange('back')}
                    title="Back Cover"
                >
                    Back
                </Button>
            </div>
        </div>
    );
};
