'use client';

import { useState } from 'react';
import Link from 'next/link';
import { User, Settings, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { normalizeSupabaseStorageUrl } from '@/lib/supabase-media-normalizer';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ProfileDialog } from '@/components/profile-dialog';

interface UserNavProps {
    showSettingsLink?: boolean;
}

export function UserNav({ showSettingsLink = true }: UserNavProps) {
    const { user, signOut } = useAuth();
    const [profileOpen, setProfileOpen] = useState(false);

    if (!user) return null;

    // Derive display name/avatar
    // useAuth updates user object from session, which should have metadata
    const fullName = user.user_metadata?.full_name;
    const avatarUrl = normalizeSupabaseStorageUrl(user.user_metadata?.avatar_url) || undefined;
    const email = user.email;

    return (
        <>
            <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                        <Avatar className="h-9 w-9 border border-border">
                            <AvatarImage src={avatarUrl} alt={fullName || 'User'} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                                {fullName?.[0]?.toUpperCase() || email?.[0]?.toUpperCase() || <User className="h-4 w-4" />}
                            </AvatarFallback>
                        </Avatar>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 z-[200]" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                            <p className="text-sm font-medium leading-none">{fullName || 'User'}</p>
                            <p className="text-xs leading-none text-muted-foreground">
                                {email}
                            </p>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                        <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
                            <User className="mr-2 h-4 w-4" />
                            <span>Profile</span>
                        </DropdownMenuItem>
                        {showSettingsLink && (
                            <DropdownMenuItem asChild>
                                <Link href="/dashboard">
                                    <Settings className="mr-2 h-4 w-4" />
                                    <span>Dashboard</span>
                                </Link>
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => signOut()}>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
        </>
    );
}
