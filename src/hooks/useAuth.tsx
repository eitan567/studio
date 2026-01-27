'use client'

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { User, AuthChangeEvent, Session } from '@supabase/supabase-js'
import { createClient, signOut as supabaseSignOut } from '@/lib/supabase'
import { logger } from '@/lib/logger'

export type UserRole = 'USER' | 'ADMIN' | 'GUEST' // Updated types

interface AuthContextType {
    user: User | null
    role: UserRole | null
    isAdmin: boolean
    isLoading: boolean
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const router = useRouter()
    const [user, setUser] = useState<User | null>(null)
    const [role, setRole] = useState<UserRole | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // Create Supabase client once
    const [supabase] = useState(() => createClient())

    useEffect(() => {
        let mounted = true;

        const initAuth = async () => {
            // Get session
            const { data: { session } } = await supabase.auth.getSession();
            if (!mounted) return;

            const currentUser = session?.user ?? null;
            setUser(currentUser);

            if (currentUser) {
                // Read directly from metadata and normalize
                const rawRole = currentUser.app_metadata?.role as string;
                const metaRole = rawRole?.toUpperCase() as UserRole;
                logger.info('Role from metadata:', metaRole);
                setRole(metaRole || 'USER');
            } else {
                setRole(null);
            }
            setIsLoading(false);
        };

        initAuth();

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (!mounted) return;

                logger.debug('Auth change:', event);
                const currentUser = session?.user ?? null;
                setUser(currentUser);

                if (currentUser) {
                    const rawRole = currentUser.app_metadata?.role as string;
                    const metaRole = rawRole?.toUpperCase() as UserRole;
                    // Update role if changed
                    if (metaRole && metaRole !== role) {
                        setRole(metaRole);
                    } else if (!role) {
                        setRole(metaRole || 'USER');
                    }
                } else {
                    setRole(null);
                }
                setIsLoading(false);
            }
        );

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once on mount

    const signOut = useCallback(async () => {
        await supabaseSignOut()
        setUser(null)
        setRole(null)
        localStorage.removeItem('album_studio_user_settings')
        router.push('/')
        router.refresh()
    }, [router])

    const isAdmin = role === 'ADMIN'

    const value = {
        user,
        role,
        isAdmin,
        isLoading,
        signOut,
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

// Hook for components that just need to check auth status without the full context
export function useAuthStatus() {
    const [user, setUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const supabase = createClient()

        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null)
            setIsLoading(false)
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setUser(session?.user ?? null)
            }
        )

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    return { user, isLoading, isAuthenticated: !!user }
}
