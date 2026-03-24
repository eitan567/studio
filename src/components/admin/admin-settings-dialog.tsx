'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/use-settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
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
                {/* Left Shadow Gradient */}
                <div
                    className="absolute inset-y-0 pointer-events-none"
                    style={{
                        left: `calc(50% - ${width}px)`,
                        width: `${width}px`,
                        background: `linear-gradient(to left, rgba(0,0,0,${opacity}), transparent)`,
                    }}
                />

                {/* Center Spine Binding (the actual line) */}
                <div
                    className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] z-10"
                    style={{
                        backgroundColor: hexToRgba(color, colorOpacity),
                    }}
                >
                    {/* Spread shadow around the center line */}
                    <div
                        className="absolute inset-y-0 pointer-events-none"
                        style={{
                            left: `-${spread}px`,
                            right: `-${spread}px`,
                            background: `linear-gradient(to right, transparent, rgba(0,0,0,${centerOpacity}), transparent)`,
                        }}
                    />
                </div>

                {/* Right Shadow Gradient */}
                <div
                    className="absolute inset-y-0 left-1/2 pointer-events-none"
                    style={{
                        width: `${width}px`,
                        background: `linear-gradient(to right, rgba(0,0,0,${opacity}), transparent)`,
                    }}
                />
            </div>
        </div>
    );
}

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase";
import { normalizeSupabaseStorageUrl } from "@/lib/supabase-media-normalizer";

interface UserProfile {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    role_id: number;
    created_at: string;
    role?: {
        code: string;
        description: string;
    }
}

interface UserRole {
    id: number;
    code: string;
    description: string;
}

function UsersTab() {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [roles, setRoles] = useState<UserRole[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const supabase = createClient();

    // Fetch users and roles
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch roles
                const { data: rolesData, error: rolesError } = await supabase
                    .from('user_roles')
                    .select('*')
                    .order('id');

                if (rolesError) throw rolesError;
                setRoles(rolesData || []);

                // Fetch profiles with their roles
                const { data: usersData, error: usersError } = await supabase
                    .from('profiles')
                    .select('*, role:user_roles(code, description)')
                    .order('created_at', { ascending: false });

                if (usersError) throw usersError;
                // @ts-ignore - Join typing can be tricky
                setUsers(
                    (usersData || []).map((profile) => ({
                        ...profile,
                        avatar_url: normalizeSupabaseStorageUrl(profile.avatar_url) || profile.avatar_url,
                    }))
                );

            } catch (error) {
                console.error('Error fetching users full details:', JSON.stringify(error, null, 2));
                console.error(error); // Log raw object too
                toast({
                    title: "Failed to load users",
                    variant: "destructive"
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleRoleChange = async (userId: string, newRoleId: string) => {
        const roleId = parseInt(newRoleId);
        if (isNaN(roleId)) return;

        // Optimistic update
        const originalUsers = [...users];
        setUsers(users.map(u => u.id === userId ? { ...u, role_id: roleId } : u));

        try {
            const { error } = await supabase.rpc('update_user_role', {
                target_user_id: userId,
                new_role_id: roleId
            });

            if (error) throw error;

            toast({
                title: "User role updated"
            });

            // Refresh to confirm sync (optional, but good for robust UI)
            // For now, relies on optimistic update success

        } catch (error) {
            console.error('Error updating role:', error);
            toast({
                title: "Failed to update role",
                variant: "destructive"
            });
            setUsers(originalUsers); // Revert
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="mb-6">
                <h3 className="font-semibold text-lg flex items-center gap-2 mb-1">Users & Roles</h3>
                <p className="text-sm text-muted-foreground">Manage user access and permissions across the application.</p>
            </div>
            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Joined</TableHead>
                            <TableHead>Role</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-3">
                                        {user.avatar_url ? (
                                            <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full bg-muted object-cover" />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                                {user.full_name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1.5">
                                                <span>{user.full_name || 'No Name'}</span>
                                                {user.role_id === 1 && (
                                                    <div className="text-blue-500" title="Admin">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shield-check"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="m9 12 2 2 4-4" /></svg>
                                                    </div>
                                                )}
                                            </div>
                                            {currentUser?.id === user.id && (
                                                <span className="text-[10px] text-primary font-medium">(You)</span>
                                            )}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                    {new Date(user.created_at).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                    <Select
                                        value={user.role_id.toString()}
                                        onValueChange={(val) => {
                                            const newRole = parseInt(val);
                                            if (currentUser?.id === user.id && newRole !== 1) {
                                                const confirmed = window.confirm("Are you sure you want to remove your own Admin privileges? you will not be able to undo this.");
                                                if (!confirmed) return;
                                            }
                                            handleRoleChange(user.id, val)
                                        }}
                                    >
                                        <SelectTrigger className="w-[140px] h-8">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {roles.map((role) => (
                                                <SelectItem key={role.id} value={role.id.toString()}>
                                                    <div className="flex items-center gap-2">
                                                        <span>{role.code}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
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
    const { toast } = useToast();

    // Local state for live preview
    const [localSettings, setLocalSettings] = useState({
        spineEffectSpread: settings.spineEffectSpread,
        spineEffectColor: settings.spineEffectColor,
        spineEffectColorOpacity: settings.spineEffectColorOpacity,
        spineEffectWidth: settings.spineEffectWidth,
        spineEffectOpacity: settings.spineEffectOpacity,
        spineEffectCenterOpacity: settings.spineEffectCenterOpacity,
        duplicateUploadAction: settings.duplicateUploadAction,
        showExistingTemplateEditDeleteIcons: settings.showExistingTemplateEditDeleteIcons,
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
                duplicateUploadAction: settings.duplicateUploadAction,
                showExistingTemplateEditDeleteIcons: settings.showExistingTemplateEditDeleteIcons,
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
            localSettings.spineEffectCenterOpacity !== settings.spineEffectCenterOpacity ||
            localSettings.duplicateUploadAction !== settings.duplicateUploadAction ||
            localSettings.showExistingTemplateEditDeleteIcons !== settings.showExistingTemplateEditDeleteIcons
        );
    }, [localSettings, settings]);

    if (!isAdmin) return null;

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateSettings(localSettings);
            toast({
                title: "Settings saved"
            });
            onOpenChange(false);
        } catch (error) {
            toast({
                title: "Failed to save settings",
                variant: "destructive"
            });
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
            duplicateUploadAction: DEFAULT_SETTINGS.duplicateUploadAction,
            showExistingTemplateEditDeleteIcons: DEFAULT_SETTINGS.showExistingTemplateEditDeleteIcons,
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="fixed left-0 top-0 z-[200] w-screen h-screen max-w-none m-0 rounded-none border-0 p-0 flex flex-col bg-background translate-x-0 translate-y-0 data-[state=open]:slide-in-from-bottom-0 data-[state=open]:slide-in-from-top-0 data-[state=open]:zoom-in-100 [&>button]:hidden">
                <Tabs defaultValue="spine" className="w-full flex-1 flex flex-col overflow-hidden">
                    <DialogHeader className="pt-6 border-b shrink-0 bg-card relative flex flex-col justify-end">
                        {/* Title at absolute left for large screens */}
                        <div className="px-6 absolute top-6 left-0 flex-col items-start hidden 2xl:flex pointer-events-none">
                            <DialogTitle className="text-xl text-left">Admin Settings</DialogTitle>
                            <DialogDescription className="text-sm text-left">
                                Configure global application settings
                            </DialogDescription>
                        </div>

                        <div className="px-6 w-full">
                            <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row items-start md:items-end justify-start gap-4 md:gap-8">
                                {/* Title inline for smaller screens */}
                                <div className="flex flex-col items-start 2xl:hidden shrink-0 pointer-events-auto pb-2 md:pb-4">
                                    <DialogTitle className="text-xl text-left">Admin Settings</DialogTitle>
                                    <DialogDescription className="text-sm text-left">
                                        Configure global application settings
                                    </DialogDescription>
                                </div>

                                <TabsList className="h-12 justify-start gap-4 bg-transparent p-0 mb-[-1px]">
                                    <TabsTrigger
                                        value="spine"
                                        className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 h-full"
                                    >
                                        Book Spine
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="users"
                                        className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 h-full"
                                    >
                                        Users & Roles
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="general"
                                        className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 h-full"
                                    >
                                        General
                                    </TabsTrigger>
                                </TabsList>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto bg-muted/10">

                        <TabsContent value="spine" className="flex-1 p-6 m-0">
                            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
                                {/* Settings Sidebar */}
                                <div className="lg:col-span-4 space-y-6">
                                    <div className="">
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
                                                    min={0}
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

                        <TabsContent value="users" className="flex-1 p-6 m-0">
                            <div className="max-w-7xl mx-auto">
                                <UsersTab />
                            </div>
                        </TabsContent>

                        <TabsContent value="general" className="flex-1 p-6 m-0">
                            <div className="max-w-7xl mx-auto">
                                <div className="mb-6">
                                    <h3 className="font-semibold text-lg flex items-center gap-2 mb-1">General Settings</h3>
                                    <p className="text-sm text-muted-foreground">Configure general application preferences.</p>
                                </div>

                                <div className="space-y-6 max-w-2xl">
                                    <div className="space-y-4">
                                        <div className="flex flex-col gap-2">
                                            <Label className="text-base font-semibold">Duplicate Photo Uploads</Label>
                                            <p className="text-sm text-muted-foreground">
                                                Choose how the system should handle when a user uploads a photo with the same filename as an existing one.
                                            </p>
                                        </div>
                                        <RadioGroup
                                            value={localSettings.duplicateUploadAction}
                                            onValueChange={(value) => setLocalSettings(prev => ({ ...prev, duplicateUploadAction: value as 'ignore' | 'replace' }))}
                                            className="flex flex-col gap-3"
                                        >
                                            <div className="flex items-start space-x-3 p-3 border rounded-md hover:bg-accent/50 transition-colors">
                                                <RadioGroupItem value="ignore" id="ignore" className="mt-1" />
                                                <div className="grid gap-1.5">
                                                    <Label htmlFor="ignore" className="font-medium cursor-pointer">Ignore Duplicates (Default)</Label>
                                                    <p className="text-sm text-muted-foreground">
                                                        If a photo with the same name exists, the upload is skipped and the existing photo is used. Best for preventing clutter.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-start space-x-3 p-3 border rounded-md hover:bg-accent/50 transition-colors">
                                                <RadioGroupItem value="replace" id="replace" className="mt-1" />
                                                <div className="grid gap-1.5">
                                                    <Label htmlFor="replace" className="font-medium cursor-pointer">Overwrite Existing</Label>
                                                    <p className="text-sm text-muted-foreground">
                                                        The new photo will replace the old photo across all albums where it is used. Best for updating edited photos.
                                                    </p>
                                                </div>
                                            </div>
                                        </RadioGroup>
                                    </div>

                                    <div className="flex items-center justify-between rounded-md border p-3">
                                        <div className="space-y-0.5">
                                            <Label className="text-base">Show edit/delete/metadata icons for existing templates</Label>
                                            <p className="text-xs text-muted-foreground">
                                                When off, edit/delete/metadata icons are shown only for new unsaved templates in the NEW tab.
                                            </p>
                                        </div>
                                        <Switch
                                            checked={localSettings.showExistingTemplateEditDeleteIcons}
                                            onCheckedChange={(checked) => setLocalSettings(prev => ({ ...prev, showExistingTemplateEditDeleteIcons: checked }))}
                                        />
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>

                {/* Fixed Footer */}
                <div className="flex-shrink-0 border-t bg-background px-6 py-4 flex items-center justify-between z-10 w-full">
                    <Button
                        variant="outline"
                        onClick={handleReset}
                        disabled={isSaving}
                    >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reset
                    </Button>

                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onOpenChange(false)}
                            className="gap-2 text-muted-foreground hover:text-foreground h-9 px-4"
                        >
                            <X className="h-4 w-4" /> Cancel
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
            </DialogContent>
        </Dialog >
    );
}

// Export default empty placeholder page for existing route compatibility if needed
export default function AdminSettingsPlaceholder() {
    return null;
}
