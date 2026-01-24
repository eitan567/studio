'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/use-settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Save, RotateCcw } from 'lucide-react';
import { DEFAULT_SETTINGS } from '@/components/settings-provider';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import { Image as ImageIcon, ImagePlus, X } from 'lucide-react';

const DUMMY_IMAGES = [
    'https://picsum.photos/seed/book1/800/600',
    'https://picsum.photos/seed/book2/800/600',
    'https://picsum.photos/seed/book3/800/600',
];

// Color input component with hex value display
function ColorPicker({
    label,
    value,
    onChange
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <div className="flex flex-col gap-2">
            <Label>{label}</Label>
            <div className="flex items-center gap-3">
                <input
                    type="color"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-12 h-10 rounded border cursor-pointer"
                />
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-md text-sm font-mono"
                    placeholder="#000000"
                />
            </div>
        </div>
    );
}

// Slider with value display
function SliderWithValue({
    label,
    value,
    onChange,
    min,
    max,
    step = 1,
    unit = '',
    description,
}: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step?: number;
    unit?: string;
    description?: string;
}) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
                <Label>{label}</Label>
                <span className="text-sm font-mono text-muted-foreground">
                    {value.toFixed(step < 1 ? 2 : 0)}{unit}
                </span>
            </div>
            {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
            )}
            <Slider
                value={[value]}
                onValueChange={([v]) => onChange(v)}
                min={min}
                max={max}
                step={step}
                className="w-full"
            />
        </div>
    );
}

// Live preview component for spine effect
function SpineEffectPreview({
    spread,
    color,
    colorOpacity,
    width,
    opacity,
    centerOpacity,
    backgroundImage,
}: {
    spread: number;
    color: string;
    colorOpacity: number;
    width: number;
    opacity: number;
    centerOpacity: number;
    backgroundImage?: string | null;
}) {
    // Convert hex to rgba for the gradients
    const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    return (
        <div className="relative w-full aspect-[2/1] bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border">
            {backgroundImage ? (
                /* Background Image Mode */
                <div className="absolute inset-0">
                    <img
                        src={backgroundImage}
                        alt="Preview"
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex">
                        <div className="w-1/2 h-full border-r border-black/10"></div>
                    </div>
                </div>
            ) : (
                /* Default Blank Mode */
                <>
                    {/* Left page */}
                    <div className="absolute left-0 top-0 w-1/2 h-full bg-white dark:bg-gray-700 flex items-center justify-center">
                        <span className="text-muted-foreground text-sm">Left Page</span>
                    </div>
                    {/* Right page */}
                    <div className="absolute right-0 top-0 w-1/2 h-full bg-white dark:bg-gray-700 flex items-center justify-center">
                        <span className="text-muted-foreground text-sm">Right Page</span>
                    </div>
                </>
            )}

            {/* Spine effect overlay */}
            <div className="absolute inset-0 pointer-events-none">
                {/* Center line with shadow spread */}
                <div
                    className="absolute inset-y-0 w-px pointer-events-none"
                    style={{
                        left: `calc(50% - ${spread}px)`,
                        right: `calc(50% - ${spread}px)`,
                        width: `${spread * 2}px`,
                        background: `linear-gradient(to right, 
                            transparent, 
                            rgba(0,0,0,${centerOpacity}) 45%, 
                            ${hexToRgba(color, colorOpacity)} 50%, 
                            rgba(0,0,0,${centerOpacity}) 55%, 
                            transparent
                        )`,
                    }}
                />

                {/* Left shadow gradient */}
                <div
                    className="absolute inset-y-0 pointer-events-none"
                    style={{
                        left: `calc(50% - ${width}px)`,
                        width: `${width}px`,
                        background: `linear-gradient(to right, transparent, rgba(0,0,0,${opacity}))`,
                    }}
                />

                {/* Right shadow gradient */}
                <div
                    className="absolute inset-y-0 pointer-events-none"
                    style={{
                        right: `calc(50% - ${width}px)`,
                        width: `${width}px`,
                        background: `linear-gradient(to left, transparent, rgba(0,0,0,${opacity}))`,
                    }}
                />
            </div>
        </div>
    );
}

interface AdminSettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AdminSettingsDialog({ open, onOpenChange }: AdminSettingsDialogProps) {
    const { user, isAdmin } = useAuth();
    const { settings, updateSettings } = useSettings();
    const [isSaving, setIsSaving] = useState(false);

    // Local state for live preview
    const [localSettings, setLocalSettings] = useState({
        spineEffectSpread: settings.spineEffectSpread,
        spineEffectColor: settings.spineEffectColor,
        spineEffectColorOpacity: settings.spineEffectColorOpacity,
        spineEffectWidth: settings.spineEffectWidth,
        spineEffectOpacity: settings.spineEffectOpacity,
        spineEffectCenterOpacity: settings.spineEffectCenterOpacity,
    });

    // Preview Image State
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const loadNewPreviewImage = () => {
        // Use a random seed to ensure a fresh image from picsum
        const seed = Math.floor(Math.random() * 1000000);
        setPreviewImage(`https://picsum.photos/seed/${seed}/800/600`);
    };

    const clearPreviewImage = () => {
        setPreviewImage(null);
    };

    // ... (useEffect and hasChanges logic remain the same) ...

    // Sync local state when settings load or dialog opens
    useEffect(() => {
        if (open) {
            setLocalSettings({
                spineEffectSpread: settings.spineEffectSpread,
                spineEffectColor: settings.spineEffectColor,
                spineEffectColorOpacity: settings.spineEffectColorOpacity,
                spineEffectWidth: settings.spineEffectWidth,
                spineEffectOpacity: settings.spineEffectOpacity,
                spineEffectCenterOpacity: settings.spineEffectCenterOpacity,
            });
        }
    }, [settings, open]);

    // Check if values have changed
    const hasChanges = useMemo(() => {
        return (
            localSettings.spineEffectSpread !== settings.spineEffectSpread ||
            localSettings.spineEffectColor !== settings.spineEffectColor ||
            localSettings.spineEffectColorOpacity !== settings.spineEffectColorOpacity ||
            localSettings.spineEffectWidth !== settings.spineEffectWidth ||
            localSettings.spineEffectOpacity !== settings.spineEffectOpacity ||
            localSettings.spineEffectCenterOpacity !== settings.spineEffectCenterOpacity
        );
    }, [localSettings, settings]);

    if (!isAdmin) return null;

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateSettings(localSettings);
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        setLocalSettings({
            spineEffectSpread: DEFAULT_SETTINGS.spineEffectSpread,
            spineEffectColor: DEFAULT_SETTINGS.spineEffectColor,
            spineEffectColorOpacity: DEFAULT_SETTINGS.spineEffectColorOpacity,
            spineEffectWidth: DEFAULT_SETTINGS.spineEffectWidth,
            spineEffectOpacity: DEFAULT_SETTINGS.spineEffectOpacity,
            spineEffectCenterOpacity: DEFAULT_SETTINGS.spineEffectCenterOpacity,
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="fixed left-0 top-0 z-50 w-screen h-screen max-w-none m-0 rounded-none border-0 p-0 flex flex-col bg-background translate-x-0 translate-y-0 data-[state=open]:slide-in-from-bottom-0 data-[state=open]:slide-in-from-top-0 data-[state=open]:zoom-in-100">
                <DialogHeader className="px-6 py-4 pr-12 border-b flex flex-row items-center justify-between space-y-0 shrink-0 bg-card">
                    <div>
                        <DialogTitle className="text-xl">Admin Settings</DialogTitle>
                        <DialogDescription>
                            Configure global application settings
                        </DialogDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={handleReset}
                            disabled={isSaving}
                        >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Reset
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={!hasChanges || isSaving}
                        >
                            <Save className="h-4 w-4 mr-2" />
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto bg-muted/10">
                    <Tabs defaultValue="spine" className="w-full h-full flex flex-col">
                        <div className="bg-background border-b px-6">
                            <div className="max-w-7xl mx-auto w-full">
                                <TabsList className="h-12 w-full justify-start gap-4 bg-transparent p-0">
                                    <TabsTrigger
                                        value="spine"
                                        className="data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 h-full"
                                    >
                                        Book Spine
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="general"
                                        className="data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 h-full"
                                    >
                                        General
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="users"
                                        className="data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 h-full"
                                    >
                                        Users & Roles
                                    </TabsTrigger>
                                </TabsList>
                            </div>
                        </div>

                        <TabsContent value="spine" className="flex-1 p-6 m-0">
                            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
                                {/* Settings Sidebar */}
                                <div className="lg:col-span-4 space-y-6">
                                    <div className="bg-card border rounded-lg p-6 shadow-sm">
                                        <div className="mb-6">
                                            <h3 className="font-semibold text-lg flex items-center gap-2 mb-1">
                                                Visual Controls
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                Fine-tune the appearance of the spine effect.
                                            </p>
                                        </div>

                                        <div className="space-y-6">
                                            {/* Center Line Settings */}
                                            <div className="space-y-4">
                                                <h3 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">Center Line</h3>
                                                <ColorPicker
                                                    label="Line Color"
                                                    value={localSettings.spineEffectColor}
                                                    onChange={(v) => setLocalSettings(prev => ({ ...prev, spineEffectColor: v }))}
                                                />
                                                <SliderWithValue
                                                    label="Line Opacity"
                                                    value={localSettings.spineEffectColorOpacity}
                                                    onChange={(v) => setLocalSettings(prev => ({ ...prev, spineEffectColorOpacity: v }))}
                                                    min={0}
                                                    max={1}
                                                    step={0.01}
                                                    description="How visible the center line is"
                                                />
                                                <SliderWithValue
                                                    label="Spread"
                                                    value={localSettings.spineEffectSpread}
                                                    onChange={(v) => setLocalSettings(prev => ({ ...prev, spineEffectSpread: v }))}
                                                    min={0}
                                                    max={50}
                                                    step={1}
                                                    unit="px"
                                                    description="How far the center shadow extends"
                                                />
                                            </div>

                                            <Separator />

                                            {/* Side Shadow Settings */}
                                            <div className="space-y-4">
                                                <h3 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">Side Shadows</h3>
                                                <SliderWithValue
                                                    label="Shadow Width"
                                                    value={localSettings.spineEffectWidth}
                                                    onChange={(v) => setLocalSettings(prev => ({ ...prev, spineEffectWidth: v }))}
                                                    min={50}
                                                    max={300}
                                                    step={5}
                                                    unit="px"
                                                    description="Width of the shadow gradient on each side"
                                                />
                                                <SliderWithValue
                                                    label="Shadow Opacity"
                                                    value={localSettings.spineEffectOpacity}
                                                    onChange={(v) => setLocalSettings(prev => ({ ...prev, spineEffectOpacity: v }))}
                                                    min={0}
                                                    max={1}
                                                    step={0.01}
                                                    description="Darkness of the side shadows"
                                                />
                                                <SliderWithValue
                                                    label="Center Shadow Intensity"
                                                    value={localSettings.spineEffectCenterOpacity}
                                                    onChange={(v) => setLocalSettings(prev => ({ ...prev, spineEffectCenterOpacity: v }))}
                                                    min={0}
                                                    max={1}
                                                    step={0.01}
                                                    description="Intensity of the shadow at the center"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Live Preview Area */}
                                <div className="lg:col-span-8 space-y-6">
                                    <div className="bg-card border rounded-lg shadow-sm overflow-hidden h-fit">
                                        <div className="p-6 border-b flex flex-row items-center justify-between">
                                            <div>
                                                <h3 className="font-semibold text-lg mb-1">Live Preview</h3>
                                                <p className="text-sm text-muted-foreground">See your changes in real-time on a sample spread.</p>
                                            </div>
                                            <div className="flex gap-2">
                                                {previewImage && (
                                                    <Button variant="outline" size="icon" onClick={clearPreviewImage} title="Clear Image">
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                <Button variant="outline" size="icon" onClick={loadNewPreviewImage} title="Load New Dummy Image">
                                                    {previewImage ? <ImagePlus className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="p-8 bg-muted/30 flex items-center justify-center min-h-[400px]">
                                            <div className="w-full max-w-3xl">
                                                <SpineEffectPreview
                                                    spread={localSettings.spineEffectSpread}
                                                    color={localSettings.spineEffectColor}
                                                    colorOpacity={localSettings.spineEffectColorOpacity}
                                                    width={localSettings.spineEffectWidth}
                                                    opacity={localSettings.spineEffectOpacity}
                                                    centerOpacity={localSettings.spineEffectCenterOpacity}
                                                    backgroundImage={previewImage}
                                                />
                                            </div>
                                        </div>
                                        <div className="bg-muted/50 p-4 border-t">
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                                                <div className="space-y-1">
                                                    <div className="text-xs text-muted-foreground font-medium uppercase">Spread</div>
                                                    <div className="font-mono text-sm">{localSettings.spineEffectSpread}px</div>
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="text-xs text-muted-foreground font-medium uppercase">Color</div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: localSettings.spineEffectColor }} />
                                                        <span className="font-mono text-sm">{localSettings.spineEffectColor}</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="text-xs text-muted-foreground font-medium uppercase">Color Op.</div>
                                                    <div className="font-mono text-sm">{(localSettings.spineEffectColorOpacity * 100).toFixed(0)}%</div>
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="text-xs text-muted-foreground font-medium uppercase">Width</div>
                                                    <div className="font-mono text-sm">{localSettings.spineEffectWidth}px</div>
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="text-xs text-muted-foreground font-medium uppercase">Opacity</div>
                                                    <div className="font-mono text-sm">{(localSettings.spineEffectOpacity * 100).toFixed(0)}%</div>
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="text-xs text-muted-foreground font-medium uppercase">Center</div>
                                                    <div className="font-mono text-sm">{(localSettings.spineEffectCenterOpacity * 100).toFixed(0)}%</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="general" className="flex-1 p-6 m-0">
                            <div className="max-w-4xl mx-auto">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>General Settings</CardTitle>
                                        <CardDescription>Configure general application preferences.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="h-48 flex items-center justify-center border-2 border-dashed rounded-lg text-muted-foreground">
                                            General settings placeholder
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        <TabsContent value="users" className="flex-1 p-6 m-0">
                            <div className="max-w-4xl mx-auto">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Users & Roles</CardTitle>
                                        <CardDescription>Manage user access and permissions.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="h-48 flex items-center justify-center border-2 border-dashed rounded-lg text-muted-foreground">
                                            User management placeholder
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>
                    </Tabs >
                </div >
            </DialogContent >
        </Dialog >
    );
}

// Export default empty placeholder page for existing route compatibility if needed
export default function AdminSettingsPlaceholder() {
    return null;
}
