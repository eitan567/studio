'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/use-settings';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Save, RotateCcw } from 'lucide-react';
import { DEFAULT_SETTINGS } from '@/components/settings-provider';

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
}: {
    spread: number;
    color: string;
    colorOpacity: number;
    width: number;
    opacity: number;
    centerOpacity: number;
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
            {/* Left page */}
            <div className="absolute left-0 top-0 w-1/2 h-full bg-white dark:bg-gray-700 flex items-center justify-center">
                <span className="text-muted-foreground text-sm">Left Page</span>
            </div>
            {/* Right page */}
            <div className="absolute right-0 top-0 w-1/2 h-full bg-white dark:bg-gray-700 flex items-center justify-center">
                <span className="text-muted-foreground text-sm">Right Page</span>
            </div>

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

export default function AdminPage() {
    const router = useRouter();
    const { user, isAdmin, isLoading: authLoading } = useAuth();
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

    // Sync local state when settings load
    useEffect(() => {
        setLocalSettings({
            spineEffectSpread: settings.spineEffectSpread,
            spineEffectColor: settings.spineEffectColor,
            spineEffectColorOpacity: settings.spineEffectColorOpacity,
            spineEffectWidth: settings.spineEffectWidth,
            spineEffectOpacity: settings.spineEffectOpacity,
            spineEffectCenterOpacity: settings.spineEffectCenterOpacity,
        });
    }, [settings]);

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

    // Redirect non-admin users (only after role is loaded)
    useEffect(() => {
        logger.debug('Auth state:', { user: user?.email, isAdmin, authLoading, role: (useAuth as any).role });
        // Wait until auth is fully loaded before making redirect decision
        if (!authLoading && user && isAdmin === false) {
            logger.info('Not admin, redirecting to dashboard');
            router.push('/dashboard');
        } else if (!authLoading && !user) {
            logger.info('No user, redirecting to dashboard');
            router.push('/dashboard');
        }
    }, [user, isAdmin, authLoading, router]);

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

    // Loading state
    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    // Not authorized
    if (!user || !isAdmin) {
        return null; // Will redirect
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b bg-card">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.back()}
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-xl font-semibold">Admin Settings</h1>
                            <p className="text-sm text-muted-foreground">
                                Configure global application settings
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={handleReset}
                            disabled={isSaving}
                        >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Reset to Defaults
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={!hasChanges || isSaving}
                        >
                            <Save className="h-4 w-4 mr-2" />
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="container mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Settings Panel */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Book Spine Effect</CardTitle>
                            <CardDescription>
                                Configure the visual effect that appears in the center of double-page spreads
                                to simulate a book&apos;s binding fold.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <Separator />

                            {/* Center Line Settings */}
                            <div className="space-y-4">
                                <h3 className="font-medium">Center Line</h3>

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
                                <h3 className="font-medium">Side Shadows</h3>

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
                        </CardContent>
                    </Card>

                    {/* Live Preview Panel */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Live Preview</CardTitle>
                            <CardDescription>
                                See how the spine effect will look on double-page spreads
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <SpineEffectPreview
                                spread={localSettings.spineEffectSpread}
                                color={localSettings.spineEffectColor}
                                colorOpacity={localSettings.spineEffectColorOpacity}
                                width={localSettings.spineEffectWidth}
                                opacity={localSettings.spineEffectOpacity}
                                centerOpacity={localSettings.spineEffectCenterOpacity}
                            />

                            <div className="mt-6 p-4 bg-muted rounded-lg">
                                <h4 className="font-medium mb-2">Current Values</h4>
                                <div className="grid grid-cols-2 gap-2 text-sm font-mono">
                                    <span className="text-muted-foreground">Spread:</span>
                                    <span>{localSettings.spineEffectSpread}px</span>
                                    <span className="text-muted-foreground">Color:</span>
                                    <span>{localSettings.spineEffectColor}</span>
                                    <span className="text-muted-foreground">Color Opacity:</span>
                                    <span>{(localSettings.spineEffectColorOpacity * 100).toFixed(0)}%</span>
                                    <span className="text-muted-foreground">Shadow Width:</span>
                                    <span>{localSettings.spineEffectWidth}px</span>
                                    <span className="text-muted-foreground">Shadow Opacity:</span>
                                    <span>{(localSettings.spineEffectOpacity * 100).toFixed(0)}%</span>
                                    <span className="text-muted-foreground">Center Intensity:</span>
                                    <span>{(localSettings.spineEffectCenterOpacity * 100).toFixed(0)}%</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
