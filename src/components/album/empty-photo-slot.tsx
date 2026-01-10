'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Image as ImageIcon, Plus } from 'lucide-react';

interface EmptyPhotoSlotProps {
    className?: string;
    onDragOver?: (e: React.DragEvent) => void;
    onDragLeave?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent) => void;
    iconSize?: number;
    showText?: boolean;
}

export const EmptyPhotoSlot = ({
    className,
    onDragOver,
    onDragLeave,
    onDrop,
    iconSize = 8,
    showText = true,
}: EmptyPhotoSlotProps) => {
    return (
        <div
            className={cn(
                "bg-muted flex flex-col items-center justify-center transition-all duration-200 w-full h-full",
                className
            )}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            <div className="relative text-muted-foreground/50">
                <ImageIcon className={cn("w-8 h-8", `w-${iconSize} h-${iconSize}`)} />
                <div className="absolute -bottom-1 -right-1 bg-muted rounded-full p-0.5">
                    <Plus className="w-3 h-3 text-primary" />
                </div>
            </div>
            {showText && (
                <span className="text-xs font-medium text-muted-foreground/50 mt-2">
                    Drop photo here
                </span>
            )}
        </div>
    );
};
