'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase';
import { Loader2, User as UserIcon, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface ProfileDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
    const { user, role } = useAuth();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [fullName, setFullName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load initial data
    useEffect(() => {
        if (open && user) {
            const fetchProfile = async () => {
                const supabase = createClient();
                const { data, error } = await supabase
                    .from('profiles')
                    .select('full_name, avatar_url')
                    .eq('id', user.id)
                    .single();

                if (data && !error) {
                    setFullName(data.full_name || user.user_metadata?.full_name || '');
                    setAvatarUrl(data.avatar_url || user.user_metadata?.avatar_url || '');
                } else {
                    setFullName(user.user_metadata?.full_name || '');
                    setAvatarUrl(user.user_metadata?.avatar_url || '');
                }
            };
            fetchProfile();
        }
    }, [open, user]);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !user) return;

        const file = e.target.files[0];
        setIsUploading(true);

        try {
            // 1. Resize Image
            const { resizeImage } = await import('@/lib/image-utils');
            const resizedBlob = await resizeImage(file, 256, 0.8);
            const resizedFile = new File([resizedBlob], "avatar.jpg", { type: "image/jpeg" });

            // 2. Upload to Supabase
            const supabase = createClient();
            const filePath = `${user.id}/${Date.now()}.jpg`; // Unique path to bust cache

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, resizedFile, { upsert: true });

            if (uploadError) throw uploadError;

            // 3. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            // 4. Update Preview State immediately
            setAvatarUrl(publicUrl);

            toast({
                title: "Photo Ready",
                description: "Click 'Save Changes' to apply your new avatar.",
            });

        } catch (error) {
            console.error("Avatar upload failed:", error);
            toast({
                title: "Upload Failed",
                description: "Could not upload image. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSave = async () => {
        if (!user) return;
        setIsLoading(true);

        try {
            const supabase = createClient();

            // 1. Update Profile Table
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: fullName,
                    avatar_url: avatarUrl,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', user.id);

            if (error) throw error;

            // 2. Update Auth Metadata
            await supabase.auth.updateUser({
                data: { full_name: fullName, avatar_url: avatarUrl }
            });

            toast({
                title: 'Profile Updated',
                description: 'Your changes have been saved successfully.',
            });
            onOpenChange(false);
        } catch (error) {
            console.error('Error updating profile:', error);
            toast({
                title: 'Error',
                description: 'Failed to update profile. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Profile</DialogTitle>
                    <DialogDescription>
                        Make changes to your profile here. Click save when you're done.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">

                    {/* Avatar Upload Section */}
                    <div className="flex flex-col items-center gap-4">
                        <div
                            className="relative cursor-pointer group"
                            onClick={() => !isUploading && fileInputRef.current?.click()}
                        >
                            <Avatar className="h-24 w-24 border-2 border-border shadow-sm">
                                <AvatarImage src={avatarUrl} alt="Avatar" className="object-cover" />
                                <AvatarFallback className="text-3xl bg-primary/10 text-primary">
                                    {fullName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || <UserIcon />}
                                </AvatarFallback>
                            </Avatar>

                            {/* Hover Overlay */}
                            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 z-10">
                                {isUploading ? (
                                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <Camera className="h-6 w-6 text-white mb-1" />
                                        <span className="text-white text-[10px] font-medium uppercase tracking-wider">Change</span>
                                    </div>
                                )}
                            </div>

                            {/* Permanent Badge */}
                            {!isUploading && (
                                <div className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-background transition-transform group-hover:scale-0 z-20">
                                    <Camera className="h-3.5 w-3.5" />
                                </div>
                            )}
                        </div>

                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            className="hidden"
                            accept="image/png, image/jpeg, image/webp"
                        />
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="email" className="text-right">
                            Email
                        </Label>
                        <Input
                            id="email"
                            value={user?.email || ''}
                            disabled
                            className="col-span-3 bg-muted"
                        />
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="role" className="text-right">
                            Role
                        </Label>
                        <div className="col-span-3">
                            <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                                {role || 'USER'}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                            Name
                        </Label>
                        <Input
                            id="name"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="col-span-3"
                            placeholder="Your full name"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading || isUploading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isLoading || isUploading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
