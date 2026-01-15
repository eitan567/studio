'use client';

import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { AiBackgroundGenerator } from '../ai-background-generator';

interface AlbumConfigCardProps {
    form: UseFormReturn<{ size: '20x20' | '25x25' | '30x30' }>;
    photoGap: number;
    setPhotoGap: (value: number) => void;
    pageMargin: number;
    setPageMargin: (value: number) => void;
    cornerRadius: number;
    setCornerRadius: (value: number) => void;
    backgroundColor: string;
    setBackgroundColor: (value: string) => void;
    handleColorChange: (color: string) => void;
    backgroundImage: string | undefined;
    setBackgroundImage: (value: string | undefined) => void;
    availableBackgrounds: string[];
    setAvailableBackgrounds: React.Dispatch<React.SetStateAction<string[]>>;
    backgroundUploadRef: React.RefObject<HTMLInputElement | null>;
}

export function AlbumConfigCard({
    form,
    photoGap,
    setPhotoGap,
    pageMargin,
    setPageMargin,
    cornerRadius,
    setCornerRadius,
    backgroundColor,
    setBackgroundColor,
    handleColorChange,
    backgroundImage,
    setBackgroundImage,
    availableBackgrounds,
    setAvailableBackgrounds,
    backgroundUploadRef,
}: AlbumConfigCardProps) {
    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="font-headline text-lg">Album Config</CardTitle>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form className="space-y-4">
                        <FormField
                            control={form.control}
                            name="size"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Size (cm)</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select size" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="20x20">20 x 20</SelectItem>
                                            <SelectItem value="25x25">25 x 25</SelectItem>
                                            <SelectItem value="30x30">30 x 30</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium">Photo Gap</label>
                                <div className="flex items-center gap-1">
                                    <input
                                        type="number"
                                        min="0"
                                        max="50"
                                        value={photoGap || 0}
                                        onChange={(e) => setPhotoGap(Math.max(0, Math.min(50, Number(e.target.value) || 0)))}
                                        className="w-14 h-7 text-center text-sm border rounded"
                                    />
                                    <span className="text-sm text-muted-foreground">px</span>
                                </div>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="50"
                                value={photoGap || 0}
                                onChange={(e) => setPhotoGap(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium">Page Margin</label>
                                <div className="flex items-center gap-1">
                                    <input
                                        type="number"
                                        min="0"
                                        max="50"
                                        value={pageMargin || 0}
                                        onChange={(e) => setPageMargin(Math.max(0, Math.min(50, Number(e.target.value) || 0)))}
                                        className="w-14 h-7 text-center text-sm border rounded"
                                    />
                                    <span className="text-sm text-muted-foreground">px</span>
                                </div>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="50"
                                value={pageMargin || 0}
                                onChange={(e) => setPageMargin(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium">Corner Radius</label>
                                <div className="flex items-center gap-1">
                                    <input
                                        type="number"
                                        min="0"
                                        max="20"
                                        value={cornerRadius || 0}
                                        onChange={(e) => setCornerRadius(Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
                                        className="w-14 h-7 text-center text-sm border rounded"
                                    />
                                    <span className="text-sm text-muted-foreground">px</span>
                                </div>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="20"
                                value={cornerRadius || 0}
                                onChange={(e) => setCornerRadius(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Background Color</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={backgroundColor || '#ffffff'}
                                    onChange={(e) => handleColorChange(e.target.value)}
                                    className="w-10 h-10 rounded border cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={backgroundColor || '#ffffff'}
                                    onChange={(e) => setBackgroundColor(e.target.value)}
                                    className="flex-1 h-8 px-2 text-sm border rounded"
                                    placeholder="#ffffff"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Background Image</label>
                            <div className="grid grid-cols-3 gap-2">
                                {/* None option */}
                                <div
                                    className={cn(
                                        "h-12 rounded border-2 cursor-pointer flex items-center justify-center bg-gray-100",
                                        !backgroundImage ? "border-primary ring-2 ring-primary/20" : "border-muted hover:border-primary/50"
                                    )}
                                    onClick={() => setBackgroundImage(undefined)}
                                >
                                    <span className="text-xs text-muted-foreground">None</span>
                                </div>
                                {/* Available backgrounds */}
                                {availableBackgrounds.map((bg, index) => (
                                    <div
                                        key={index}
                                        className={cn(
                                            "h-12 rounded border-2 cursor-pointer overflow-hidden relative group",
                                            backgroundImage === bg ? "border-primary ring-2 ring-primary/20" : "border-muted hover:border-primary/50"
                                        )}
                                        onClick={() => setBackgroundImage(bg)}
                                    >
                                        <img src={bg} alt={`Background ${index + 1}`} className="w-full h-full" />
                                        <button
                                            className="absolute top-0 right-0 w-5 h-5 bg-black/50 text-white text-xs rounded-bl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-black/70"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setAvailableBackgrounds(prev => prev.filter((_, i) => i !== index));
                                                if (backgroundImage === bg) {
                                                    setBackgroundImage(undefined);
                                                }
                                            }}
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                                {/* Upload button */}
                                <div
                                    className="h-12 rounded border-2 border-dashed cursor-pointer flex items-center justify-center bg-gray-50 hover:bg-gray-100"
                                    onClick={() => backgroundUploadRef.current?.click()}
                                >
                                    <span className="text-xl text-muted-foreground">+</span>
                                </div>
                            </div>
                            <input
                                ref={backgroundUploadRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onload = (event) => {
                                            const dataUrl = event.target?.result as string;
                                            setAvailableBackgrounds(prev => [...prev, dataUrl]);
                                            setBackgroundImage(dataUrl);
                                        };
                                        reader.readAsDataURL(file);
                                    }
                                    e.target.value = '';
                                }}
                            />
                            {backgroundImage && (
                                <div className="relative w-full h-16 rounded overflow-hidden border">
                                    <img src={backgroundImage} alt="Background preview" className="w-full h-full" />
                                </div>
                            )}
                            {/* AI Background Generation */}
                            <AiBackgroundGenerator
                                onBackgroundGenerated={(imageUrl) => {
                                    setAvailableBackgrounds(prev => [...prev, imageUrl]);
                                    setBackgroundImage(imageUrl);
                                }}
                            />
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
