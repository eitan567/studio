import React, { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SpineColorPickerProps {
    value?: string;
    onChange: (color: string) => void;
    disableAlpha?: boolean; // New prop
}

export function SpineColorPicker({ value = '#ffffff', onChange, disableAlpha = false }: SpineColorPickerProps) {
    const [internalColor, setInternalColor] = useState(value);

    // Sync internal state if value prop changes
    useEffect(() => {
        setInternalColor(value);
    }, [value]);

    const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newColor = e.target.value;
        setInternalColor(newColor);
        if ((disableAlpha && /^#[0-9A-Fa-f]{6}$/.test(newColor)) || (!disableAlpha && /^#[0-9A-Fa-f]{8}$/.test(newColor)) || /^#[0-9A-Fa-f]{6}$/.test(newColor) || /^#[0-9A-Fa-f]{3}$/.test(newColor)) {
            onChange(newColor);
        }
    };

    const handleColorInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newColor = e.target.value;
        setInternalColor(newColor);
        onChange(newColor);
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className="w-8 h-8 p-0 rounded-md border shadow-sm"
                    style={{ backgroundColor: value }}
                >
                    <span className="sr-only">Pick color</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <h4 className="font-medium leading-none">Color Picker</h4>
                        <p className="text-sm text-muted-foreground">
                            Select a color below.
                        </p>
                    </div>
                    <div className="flex flex-col gap-4">
                        <div className="flex gap-2">
                            <Input
                                type="color"
                                value={internalColor.substring(0, 7)} // Input type color only supports 6 hex
                                onChange={handleColorInput}
                                className="w-full h-10 p-1 cursor-pointer"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="hex">Hex Code</Label>
                            <Input
                                id="hex"
                                value={internalColor}
                                onChange={handleHexChange}
                                maxLength={disableAlpha ? 7 : 9}
                            />
                        </div>
                        {/* Opacity Slider could go here if we want to get fancy with 8-digit hex */}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
