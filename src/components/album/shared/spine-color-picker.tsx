import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SpineColorPickerProps {
    value?: string;
    onChange: (color: string) => void;
    // disableAlpha is kept for interface compatibility but alpha is handled externally now
    disableAlpha?: boolean;
}

export function SpineColorPicker({ value = '#ffffff', onChange }: SpineColorPickerProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    // Strip alpha if provided, as the separate slider handles it now
    const displayColor = value.startsWith('#') && value.length === 9
        ? value.substring(0, 7)
        : value === 'transparent' ? '#ffffff' : value;

    const handleButtonClick = () => {
        inputRef.current?.click();
    };

    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
    };

    return (
        <div className="relative inline-flex items-center w-8 h-8">
            <input
                ref={inputRef}
                type="color"
                value={displayColor}
                onChange={handleColorChange}
                // Standard absolute positioning to ensure the picker anchors correctly to this element
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer -z-10"
                tabIndex={-1}
            />
            <Button
                variant="outline"
                className={cn(
                    "w-full h-full p-0 rounded-md border shadow-sm transition-all hover:scale-105 active:scale-95",
                    value === 'transparent' && "bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAAXNSR0IArs4c6QAAACpJREFUGFdjZEACJ0+e/M/AwMDIACHBBKCsX79+/Wf48eMHIwMSAAkgBQCvLhXreX6XAAAAAElFTkSuQmCC')]"
                )}
                style={{ backgroundColor: value !== 'transparent' ? value : undefined }}
                onClick={handleButtonClick}
                title="Choose color"
            >
                <div
                    className="w-full h-full rounded-[inherit]"
                    style={{ backgroundColor: value !== 'transparent' ? value : undefined }}
                />
            </Button>
        </div>
    );
}
