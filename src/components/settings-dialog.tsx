'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RotateCcw, Monitor, Moon, Sun, LayoutGrid, Bold, Italic, AlignLeft, AlignCenter, AlignRight, RotateCw, Type, Layout } from 'lucide-react';
import { useSettings, UserSettings, DEFAULT_SETTINGS } from '@/hooks/use-settings';
import { TemplateManager } from './settings/template-manager';
import { toast } from '@/hooks/use-toast';
import { useTheme } from 'next-themes';

interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
    const { settings, liveSettings, updateSettings, resetSettings } = useSettings();
    const [localSettings, setLocalSettings] = useState<UserSettings>(liveSettings);

    useEffect(() => {
        if (open) {
            setLocalSettings(liveSettings);
        }
    }, [open]);
    const [activeTab, setActiveTab] = useState('general');
    const { setTheme } = useTheme();

    // Reset local state ONLY when dialog is transition to "open"
    // This prevents background updates or hook reference changes from wiping user edits
    useEffect(() => {
        if (open) {
            setLocalSettings(liveSettings);
        }
    }, [open]); // Removed liveSettings from dependencies to prevent the jumping behavior

    const handleUpdateLocal = (updates: Partial<UserSettings>) => {
        setLocalSettings(prev => {
            const next = { ...prev, ...updates };
            // Preview Theme changes immediately, revert on cancel?
            // No, best to keep "Save" as the commit. But theme feels better live.
            // Let's stick to explicit save for everything for consistency, 
            // but maybe preview Theme if I had a "Preview" state. 
            // For now, standard form behavior.
            return next;
        });
    };

    const handleSave = () => {
        // Exclude themePreference from the update payload.
        // Since we removed the UI for theme selection, localSettings contains a potentially stale
        // default value. Sending it would trigger SettingsProvider to force-apply that theme,
        // overriding the user's active session theme (controlled by ModeToggle).
        const { themePreference, ...settingsToSave } = localSettings;

        updateSettings(settingsToSave);
        toast({
            title: "Settings Saved",
            description: "Your preferences have been updated.",
        });
        onOpenChange(false);
    };

    const handleCancel = () => {
        // Revert any side-effects if we implemented live preview
        // For now, just close. active settings are untouched.
        onOpenChange(false);
    };

    const handleReset = () => {
        resetSettings();
        setLocalSettings(DEFAULT_SETTINGS); // Immediate feedback with new defaults
        toast({
            title: "Settings Reset",
            description: "All settings have been restored to defaults.",
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[700px] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle className="text-2xl">Studio Settings</DialogTitle>
                    <DialogDescription>
                        Manage your global preferences and album defaults.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex">
                    <Tabs value={activeTab} onValueChange={setActiveTab} orientation="vertical" className="flex-1 flex h-full">
                        <div className="w-48 border-r h-full bg-muted/30 p-4">
                            <TabsList className="flex flex-col h-auto bg-transparent space-y-1 p-0">
                                <TabsTrigger value="general" className="w-full justify-start px-3">General</TabsTrigger>
                                <TabsTrigger value="autofill" className="w-full justify-start px-3">Auto-Fill</TabsTrigger>
                                <TabsTrigger value="spine" className="w-full justify-start px-3">Spine</TabsTrigger>
                                <TabsTrigger value="layouts" className="w-full justify-start px-3">Layouts</TabsTrigger>
                                <TabsTrigger value="system" className="w-full justify-start px-3">System</TabsTrigger>
                            </TabsList>
                        </div>

                        <ScrollArea className="flex-1 h-full">
                            <div className="p-6 pb-20">
                                {/* GENERAL TAB */}
                                <TabsContent value="general" className="mt-0 space-y-6">
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-medium">Album Defaults</h3>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label>Default Album Size</Label>
                                                <Select
                                                    value={localSettings.defaultAlbumSize}
                                                    onValueChange={(val: any) => handleUpdateLocal({ defaultAlbumSize: val })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select size" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="20x20">20x20 cm</SelectItem>
                                                        <SelectItem value="25x25">25x25 cm</SelectItem>
                                                        <SelectItem value="30x30">30x30 cm</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Default Background</Label>
                                                <div className="flex gap-2">
                                                    <Input
                                                        type="color"
                                                        className="w-12 h-10 p-1 cursor-pointer"
                                                        value={localSettings.defaultBackgroundColor}
                                                        onChange={(e) => handleUpdateLocal({ defaultBackgroundColor: e.target.value })}
                                                    />
                                                    <Input
                                                        value={localSettings.defaultBackgroundColor}
                                                        onChange={(e) => handleUpdateLocal({ defaultBackgroundColor: e.target.value })}
                                                        className="font-mono uppercase"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-6 pt-4">
                                            <div className="space-y-3">
                                                <div className="flex justify-between">
                                                    <Label>Photo Gap</Label>
                                                    <span className="text-sm text-muted-foreground">{localSettings.defaultPhotoGap}px</span>
                                                </div>
                                                <Slider
                                                    min={0} max={20} step={1}
                                                    value={[localSettings.defaultPhotoGap]}
                                                    onValueChange={(val) => handleUpdateLocal({ defaultPhotoGap: val[0] })}
                                                />
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex justify-between">
                                                    <Label>Page Margin</Label>
                                                    <span className="text-sm text-muted-foreground">{localSettings.defaultPageMargin}px</span>
                                                </div>
                                                <Slider
                                                    min={0} max={50} step={1}
                                                    value={[localSettings.defaultPageMargin]}
                                                    onValueChange={(val) => handleUpdateLocal({ defaultPageMargin: val[0] })}
                                                />
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex justify-between">
                                                    <Label>Corner Radius</Label>
                                                    <span className="text-sm text-muted-foreground">{localSettings.defaultCornerRadius}px</span>
                                                </div>
                                                <Slider
                                                    min={0} max={50} step={1}
                                                    value={[localSettings.defaultCornerRadius]}
                                                    onValueChange={(val) => handleUpdateLocal({ defaultCornerRadius: val[0] })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* AUTO-FILL TAB */}
                                <TabsContent value="autofill" className="mt-0 space-y-6">
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-medium">Auto-Fill Logic</h3>

                                        <div className="space-y-3">
                                            <Label>Layout Mode Preference</Label>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {[
                                                    { id: 'full', label: 'Full Spread', desc: 'Photos span across both pages' },
                                                    { id: 'split', label: 'Split Pages', desc: 'Photos separated by gutter' },
                                                    { id: 'auto', label: 'Automatic', desc: 'Intelligently mixes both' }
                                                ].map((mode: any) => (
                                                    <div
                                                        key={mode.id}
                                                        className={`border rounded-md p-3 cursor-pointer transition-all ${localSettings.autoFillLayoutMode === mode.id
                                                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                                            : 'hover:bg-muted/50'
                                                            }`}
                                                        onClick={() => handleUpdateLocal({ autoFillLayoutMode: mode.id })}
                                                    >
                                                        <div className="font-medium text-sm">{mode.label}</div>
                                                        <div className="text-xs text-muted-foreground mt-1">{mode.desc}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-6 pt-2">
                                            <div className="space-y-2">
                                                <Label>Max Photos Per Page</Label>
                                                <Select
                                                    value={localSettings.autoFillMaxPhotosPerPage.toString()}
                                                    onValueChange={(val) => handleUpdateLocal({ autoFillMaxPhotosPerPage: parseInt(val) })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="0">Detailed (No Limit)</SelectItem>
                                                        <SelectItem value="1">Single (Max 1)</SelectItem>
                                                        <SelectItem value="2">Minimalist (Max 2)</SelectItem>
                                                        <SelectItem value="3">Cozy (Max 3)</SelectItem>
                                                        <SelectItem value="4">Standard (Max 4)</SelectItem>
                                                        <SelectItem value="5">Balanced (Max 5)</SelectItem>
                                                        <SelectItem value="6">Dense (Max 6)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="flex items-center justify-between space-x-2 border p-3 rounded-md">
                                                <div className="space-y-0.5">
                                                    <Label className="text-base">Smart Matching</Label>
                                                    <div className="text-xs text-muted-foreground">Match photo aspect ratios</div>
                                                </div>
                                                <Switch
                                                    checked={localSettings.autoFillSmartMatching}
                                                    onCheckedChange={(c) => handleUpdateLocal({ autoFillSmartMatching: c })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* SPINE TAB */}
                                <TabsContent value="spine" className="mt-0 space-y-6">
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-medium">Cover & Spine Defaults</h3>

                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label>Default Text</Label>
                                                <Input
                                                    value={localSettings.defaultSpineText}
                                                    onChange={(e) => handleUpdateLocal({ defaultSpineText: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Text Direction</Label>
                                                <Select
                                                    value={localSettings.defaultSpineDirection}
                                                    onValueChange={(val: any) => handleUpdateLocal({ defaultSpineDirection: val })}
                                                >
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="ltr">Left to Right</SelectItem>
                                                        <SelectItem value="rtl">Right to Left</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Background Color</Label>
                                                <div className="flex items-center gap-2">
                                                    <div className="relative w-10 h-10 rounded-md border shadow-sm overflow-hidden">
                                                        <input
                                                            type="color"
                                                            value={localSettings.defaultSpineColor}
                                                            onChange={(e) => handleUpdateLocal({ defaultSpineColor: e.target.value })}
                                                            className="absolute inset-0 w-full h-full p-0 border-0 opacity-0 cursor-pointer"
                                                        />
                                                        <div
                                                            className="w-full h-full"
                                                            style={{ backgroundColor: localSettings.defaultSpineColor }}
                                                        />
                                                    </div>
                                                    <Input
                                                        value={localSettings.defaultSpineColor}
                                                        onChange={(e) => handleUpdateLocal({ defaultSpineColor: e.target.value })}
                                                        className="font-mono uppercase w-24"
                                                        maxLength={7}
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex justify-between">
                                                    <Label>Opacity</Label>
                                                    <span className="text-sm text-muted-foreground">{Math.round((localSettings.defaultSpineOpacity || 1) * 100)}%</span>
                                                </div>
                                                <Slider
                                                    min={0} max={1} step={0.01}
                                                    value={[localSettings.defaultSpineOpacity || 1]}
                                                    onValueChange={(val) => handleUpdateLocal({ defaultSpineOpacity: val[0] })}
                                                    className="py-2"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-6 pt-2">
                                            <div className="space-y-3">
                                                <div className="flex justify-between">
                                                    <Label>Spine Width</Label>
                                                    <span className="text-sm text-muted-foreground">{localSettings.defaultSpineWidth}px</span>
                                                </div>
                                                <Slider
                                                    min={0} max={100} step={1}
                                                    value={[localSettings.defaultSpineWidth]}
                                                    onValueChange={(val) => handleUpdateLocal({ defaultSpineWidth: val[0] })}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label>Typeface</Label>
                                                <Select
                                                    value={localSettings.defaultSpineFontFamily}
                                                    onValueChange={(val) => handleUpdateLocal({ defaultSpineFontFamily: val })}
                                                >
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {['Inter', 'Serif', 'Mono', 'Cursive', 'Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Impact'].map(f => (
                                                            <SelectItem key={f} value={f}>
                                                                <span style={{ fontFamily: f }}>{f}</span>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Text Color</Label>
                                                <div className="flex gap-2">
                                                    <Input
                                                        type="color"
                                                        className="w-12 h-10 p-1 cursor-pointer"
                                                        value={localSettings.defaultSpineTextColor}
                                                        onChange={(e) => handleUpdateLocal({ defaultSpineTextColor: e.target.value })}
                                                    />
                                                    <Input
                                                        value={localSettings.defaultSpineTextColor}
                                                        onChange={(e) => handleUpdateLocal({ defaultSpineTextColor: e.target.value })}
                                                        className="font-mono uppercase h-10"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-3">
                                                <div className="flex justify-between">
                                                    <Label>Font Size</Label>
                                                    <span className="text-sm text-muted-foreground">{localSettings.defaultSpineFontSize}px</span>
                                                </div>
                                                <Slider
                                                    min={8} max={72} step={1}
                                                    value={[localSettings.defaultSpineFontSize]}
                                                    onValueChange={(val) => handleUpdateLocal({ defaultSpineFontSize: val[0] })}
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <Label>Appearance</Label>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 flex items-center justify-between gap-1 bg-background border rounded-md p-1 shadow-sm h-10">
                                                        <div className="flex gap-0.5">
                                                            <Button
                                                                variant={localSettings.defaultSpineFontWeight === 'bold' ? 'secondary' : 'ghost'}
                                                                size="icon" className="h-8 w-8"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    handleUpdateLocal({ defaultSpineFontWeight: localSettings.defaultSpineFontWeight === 'bold' ? 'normal' : 'bold' });
                                                                }}
                                                            >
                                                                <Bold className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant={localSettings.defaultSpineFontStyle === 'italic' ? 'secondary' : 'ghost'}
                                                                size="icon" className="h-8 w-8"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    handleUpdateLocal({ defaultSpineFontStyle: localSettings.defaultSpineFontStyle === 'italic' ? 'normal' : 'italic' });
                                                                }}
                                                            >
                                                                <Italic className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                        <div className="w-px h-4 bg-border" />
                                                        <div className="flex gap-0.5">
                                                            <Button
                                                                variant={localSettings.defaultSpineTextAlign === 'left' ? 'secondary' : 'ghost'}
                                                                size="icon" className="h-8 w-8"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    handleUpdateLocal({ defaultSpineTextAlign: 'left' });
                                                                }}
                                                            >
                                                                <AlignLeft className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant={localSettings.defaultSpineTextAlign === 'center' ? 'secondary' : 'ghost'}
                                                                size="icon" className="h-8 w-8"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    handleUpdateLocal({ defaultSpineTextAlign: 'center' });
                                                                }}
                                                            >
                                                                <AlignCenter className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant={localSettings.defaultSpineTextAlign === 'right' ? 'secondary' : 'ghost'}
                                                                size="icon" className="h-8 w-8"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    handleUpdateLocal({ defaultSpineTextAlign: 'right' });
                                                                }}
                                                            >
                                                                <AlignRight className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                </TabsContent>

                                {/* LAYOUTS TAB */}
                                <TabsContent value="layouts" className="mt-0 space-y-6">
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-medium">Template Visibility</h3>
                                        <p className="text-sm text-muted-foreground">Select which template categories should appear in the editor.</p>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {['grid', 'advanced', 'cover'].map((cat) => (
                                                <div key={cat} className="flex items-center justify-between p-4 border rounded-md">
                                                    <div className="flex items-center gap-3">
                                                        <LayoutGrid className="h-5 w-5 text-muted-foreground" />
                                                        <div className="capitalize font-medium">{cat} Layouts</div>
                                                    </div>
                                                    <Switch
                                                        checked={localSettings.visibleTemplateCategories?.includes(cat)}
                                                        onCheckedChange={(checked) => {
                                                            const current = localSettings.visibleTemplateCategories || [];
                                                            const next = checked
                                                                ? [...current, cat]
                                                                : current.filter(c => c !== cat);
                                                            handleUpdateLocal({ visibleTemplateCategories: next });
                                                        }}
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        <div className="p-4 bg-muted/20 rounded-md border border-dashed text-center text-sm text-muted-foreground hidden">
                                            Detailed template selection coming soon
                                        </div>

                                        <div className="pt-4 border-t">
                                            <TemplateManager
                                                settings={localSettings}
                                                onUpdate={handleUpdateLocal}
                                            />
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* SYSTEM TAB */}
                                <TabsContent value="system" className="mt-0 space-y-6">
                                    <div className="space-y-6">
                                        {/* Appearance Section Removed per user request */}

                                        <div className="space-y-4">
                                            <h3 className="text-lg font-medium">Gallery Safety</h3>
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between rounded-md border p-3">
                                                    <div className="space-y-0.5">
                                                        <Label className="text-base">Show risky gallery toolbar icons</Label>
                                                        <p className="text-xs text-muted-foreground">
                                                            Includes: sample photos, regenerate album, and fill empty slots.
                                                        </p>
                                                    </div>
                                                    <Switch
                                                        checked={localSettings.showRiskyGalleryToolbarActions}
                                                        onCheckedChange={(checked) => handleUpdateLocal({ showRiskyGalleryToolbarActions: checked })}
                                                    />
                                                </div>

                                                <div className="flex items-center justify-between rounded-md border p-3">
                                                    <div className="space-y-0.5">
                                                        <Label className="text-base">Show dangerous reset buttons in gallery</Label>
                                                        <p className="text-xs text-muted-foreground">
                                                            Includes: Clear Gallery and Reset Album actions.
                                                        </p>
                                                    </div>
                                                    <Switch
                                                        checked={localSettings.showDangerousGalleryResetActions}
                                                        onCheckedChange={(checked) => handleUpdateLocal({ showDangerousGalleryResetActions: checked })}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-6 border-t">
                                            <h3 className="text-lg font-medium text-destructive mb-4">Danger Zone</h3>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="destructive" className="w-full sm:w-auto">
                                                        <RotateCcw className="h-4 w-4 mr-2" />
                                                        Reset All Settings
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Reset all settings?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This will restore all settings to their default values. This action cannot be undone.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={handleReset} className="bg-destructive hover:bg-destructive/90">
                                                            Reset Settings
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                            <p className="text-xs text-muted-foreground mt-2">
                                                This will restore all settings to their default values. This action cannot be undone.
                                            </p>
                                        </div>
                                    </div>
                                </TabsContent>
                            </div>
                        </ScrollArea>
                    </Tabs>
                </div >

                <DialogFooter className="border-t p-4 bg-background z-10">
                    <Button variant="outline" onClick={handleCancel}>Cancel</Button>
                    <Button onClick={handleSave}>Save Changes</Button>
                </DialogFooter>
            </DialogContent >
        </Dialog >
    );
}
