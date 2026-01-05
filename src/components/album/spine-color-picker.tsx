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
        let newColor = e.target.value;

        // Preserve alpha if it exists in current internalColor and we're not disabling alpha
        if (!disableAlpha && internalColor.length === 9) {
            const currentAlpha = internalColor.substring(7);
            newColor = `${newColor}${currentAlpha}`;
        }

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
                        {!disableAlpha && (
                            <div className="flex flex-col gap-2">
                                <Label>Opacity</Label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={(() => {
                                            // Extract alpha from hex (last 2 chars if length is 9, default 100)
                                            if (internalColor.length === 9) {
                                                return Math.round((parseInt(internalColor.substring(7), 16) / 255) * 100);
                                            }
                                            return 100;
                                        })()}
                                        onChange={(e) => {
                                            const opacity = Number(e.target.value);
                                            const alphaVal = Math.round((opacity / 100) * 255);
                                            const alphaHex = alphaVal.toString(16).padStart(2, '0');

                                            // Base color (first 7 chars)
                                            let base = internalColor.length >= 7 ? internalColor.substring(0, 7) : internalColor;
                                            if (base.length < 7) base = base.padEnd(7, '0'); // Safety fallback

                                            const newColor = `${base}${alphaHex}`;
                                            setInternalColor(newColor);
                                            onChange(newColor);
                                        }}
                                        className="w-full"
                                    />
                                    <span className="text-xs w-8 text-right">
                                        {(() => {
                                            if (internalColor.length === 9) {
                                                return Math.round((parseInt(internalColor.substring(7), 16) / 255) * 100);
                                            }
                                            return 100;
                                        })()}%
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
