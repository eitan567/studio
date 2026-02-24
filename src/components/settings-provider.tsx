'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase';
import { useTheme } from 'next-themes';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

// --- Types & Defaults (Moved from use-settings.ts to avoid circular deps if possible, or just redefined) ---
// ideally these should be in a separate file, but for now I will define them here 
// and re-export so use-settings.ts can just re-export or use them.

export interface UserSettings {
    // --- [CATEGORY: Album Creator] (Applied immediately to new albums) ---
    defaultAlbumSize: '20x20' | '25x25' | '30x30';
    defaultPhotoGap: number;
    defaultPageMargin: number;
    defaultCornerRadius: number;
    defaultBackgroundColor: string;

    // Auto-Fill Logic
    autoFillLayoutMode: 'full' | 'split' | 'auto';
    autoFillMaxPhotosPerPage: number; // 0 for unlimited/auto
    autoFillSmartMatching: boolean;

    // Spine Defaults
    defaultSpineWidth: number; // in px
    defaultSpineColor: string;
    defaultSpineOpacity: number; // 0-1
    defaultSpineText: string;
    defaultSpineDirection: 'ltr' | 'rtl';
    defaultSpineFontFamily: string;
    defaultSpineFontSize: number;
    defaultSpineTextColor: string;
    defaultSpineFontWeight: 'bold' | 'normal';
    defaultSpineFontStyle: 'italic' | 'normal';
    defaultSpineTextAlign: 'left' | 'center' | 'right';

    // --- [CATEGORY: Spine Visual Effect] (For double-page spread preview) ---
    spineEffectSpread: number;         // Spread of center shadow (-left-X -right-X)
    spineEffectColor: string;          // Base color for center line (hex)
    spineEffectColorOpacity: number;   // Opacity for center line (0-1)
    spineEffectWidth: number;          // Width of side shadow gradients (px)
    spineEffectOpacity: number;        // Opacity for side shadow gradients (0-1)
    spineEffectCenterOpacity: number;  // Opacity for center of shadow gradient (0-1)

    // --- [CATEGORY: Session/General] (Applied ONLY on next app load) ---
    defaultEditorViewMode: 'full' | 'split';
    themePreference: 'light' | 'dark' | 'system';
    exportWarnDuplicates: boolean;
    visibleTemplateCategories: string[];
    allowedTemplateIds?: string[]; // Empty or undefined means ALL are allowed.
    hiddenTemplateIds: string[];   // Explicitly hidden templates (opt-out)

    // --- [CATEGORY: Upload API] ---
    duplicateUploadAction: 'ignore' | 'replace';

    // --- [CATEGORY: Safety Controls] ---
    showRiskyGalleryToolbarActions: boolean;
    showDangerousGalleryResetActions: boolean;
    showExistingTemplateEditDeleteIcons: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
    defaultAlbumSize: '20x20',
    defaultPhotoGap: 2,
    defaultPageMargin: 0,
    defaultCornerRadius: 0,
    defaultBackgroundColor: '#ffffff',

    autoFillLayoutMode: 'full',
    autoFillMaxPhotosPerPage: 4,
    autoFillSmartMatching: true,

    defaultEditorViewMode: 'full',
    exportWarnDuplicates: true,
    visibleTemplateCategories: ['grid', 'advanced', 'cover'],

    themePreference: 'light',
    allowedTemplateIds: [],
    hiddenTemplateIds: [],

    duplicateUploadAction: 'ignore',

    showRiskyGalleryToolbarActions: false,
    showDangerousGalleryResetActions: false,
    showExistingTemplateEditDeleteIcons: false,

    defaultSpineWidth: 15,
    defaultSpineColor: '#000000',
    defaultSpineOpacity: 0.2,
    defaultSpineText: 'My Album',
    defaultSpineDirection: 'ltr',
    defaultSpineFontFamily: 'Tahoma',
    defaultSpineFontSize: 10,
    defaultSpineTextColor: '#ffffff',
    defaultSpineFontWeight: 'normal',
    defaultSpineFontStyle: 'italic',
    defaultSpineTextAlign: 'center',

    // Spine Visual Effect defaults (for double-page spread)
    spineEffectSpread: 22,
    spineEffectColor: '#9ca3af', // gray-400
    spineEffectColorOpacity: 0.9,
    spineEffectWidth: 160,
    spineEffectOpacity: 0.64,
    spineEffectCenterOpacity: 0.85,
};

const STORAGE_KEY = 'album_studio_user_settings';
const SESSION_INIT_KEY = 'album_studio_session_user';

// Helper to load settings synchronously
export function loadSettingsFromStorage(): UserSettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
        }
    } catch (e) {
        logger.error('Failed to load settings', e);
    }
    return DEFAULT_SETTINGS;
}

// --- Context Definition ---

interface SettingsContextType {
    settings: UserSettings;        // The "Live" store (for creation defaults)
    sessionSettings: UserSettings; // The "Snapshot" (for Theme/General UI)
    updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
    resetSettings: () => Promise<void>;
    refreshSettings: () => Promise<void>;
    clearLocalSettings: () => void;
    isLoaded: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
    // Initialize with safe defaults (localStorage or static)
    const [settings, setSettings] = useState<UserSettings>(() => loadSettingsFromStorage());
    const [sessionSettings, setSessionSettings] = useState<UserSettings>(() => loadSettingsFromStorage());
    const [isLoaded, setIsLoaded] = useState(false);
    const { setTheme } = useTheme();
    const { user, isLoading: authLoading } = useAuth();
    const themeAppliedRef = useRef(false);
    const syncLockRef = useRef(false); // Prevents accidental re-saves during reset/init

    // Create Supabase client ONCE
    const [supabase] = useState(() => createClient());

    const fetchRemoteSettings = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            const { data, error } = await supabase
                .from('user_settings')
                .select('settings')
                .eq('user_id', user.id)
                .maybeSingle();

            if (data?.settings) {
                return { ...DEFAULT_SETTINGS, ...data.settings };
            }
            return null;
        } catch (e) {
            logger.error('Error fetching remote settings', e);
            return null;
        }
    }, [supabase]);

    // --- STRICT INITIALIZATION LOGIC ---
    // We use a ref to track if we have already initialized for the current session/user.
    // This prevents "loops" or re-running logic when user state updates rapidly.
    const initializationRef = useRef<{ initialized: boolean, userId: string | null, promise: boolean }>({ initialized: false, userId: null, promise: false });

    // Load from DB on mount or when user changes
    useEffect(() => {
        let mounted = true;

        const initSettings = async () => {
            // 0. Wait for Auth to settle
            if (authLoading) return;

            const currentUser = user;
            const currentUserId = user?.id || null;

            // 1. Strict Guard: If already initialized for this user, STOP.
            if (initializationRef.current.initialized && initializationRef.current.userId === currentUserId) {
                // If we are just re-rendering but user hasn't changed, do nothing.
                return;
            }

            // 1b. Promise Guard: If an init is already running for this user, skip.
            if (initializationRef.current.promise && initializationRef.current.userId === currentUserId) {
                // console.log('[SettingsProvider] Init already in progress for', currentUserId);
                return;
            }

            // Start lock
            initializationRef.current.promise = true;
            initializationRef.current.userId = currentUserId; // Tentatively set user ID to lock it

            // NEW LOGIC: Use Browser Navigation Type to distinguish Reload vs. Fresh Navigation
            // manual: "Only on Ctrl+F5 (Reload) should it keep the manual setting."
            // Login/Redirect is a 'navigate' or 'back_forward', not 'reload'.

            let isReload = false;
            try {
                if (typeof performance !== 'undefined') {
                    const nav = performance.getEntriesByType("navigation");
                    if (nav.length > 0) {
                        const timing = nav[0] as PerformanceNavigationTiming;
                        if (timing.type === 'reload') {
                            isReload = true;
                        }
                    } else if (performance.navigation && performance.navigation.type === 1) { // Fallback (type 1 = TYPE_RELOAD)
                        isReload = true;
                    }
                }
            } catch (e) {
                // Fallback: If we can't detect, assume it might be a reload if session exists
            }

            // We only respect the Local Override (Session Lock) if it is explicitly a RELOAD event.
            // If it's a fresh navigation (Login, Link Click), we force sync from DB.
            const sessionUser = (typeof window !== 'undefined' && isReload) ? sessionStorage.getItem(SESSION_INIT_KEY) : null;
            const userTag = currentUserId || 'guest';

            // console.log(`[SettingsProvider] Init: User=${userTag}, IsReload=${isReload}, SessionLock=${sessionUser}`);

            try {
                if (currentUser) {
                    // 2. Fetch remote settings
                    const remote = await fetchRemoteSettings();

                    if (mounted) {
                        if (remote) {
                            // Found remote settings - use them
                            logger.info('Loaded remote settings for user', currentUserId);
                            setSettings(remote);
                            setSessionSettings(remote);
                            localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
                        } else {
                            // 3. Migration: No remote settings. Check local storage
                            logger.info('No remote settings, migrating local...');
                            const local = loadSettingsFromStorage();

                            // Save local settings to DB
                            await supabase.from('user_settings').upsert({
                                user_id: currentUser.id,
                                settings: local,
                                updated_at: new Date().toISOString()
                            });
                        }
                    }
                } else {
                    // Guest Mode
                    logger.debug('Guest mode, clearing session lock');
                    if (typeof window !== 'undefined') sessionStorage.removeItem(SESSION_INIT_KEY);

                    logger.debug('Guest mode, using local settings');
                    const local = loadSettingsFromStorage();
                    if (local.themePreference) {
                        if (sessionUser !== 'guest') {
                            setTheme(local.themePreference);
                            if (typeof window !== 'undefined') sessionStorage.setItem(SESSION_INIT_KEY, 'guest');
                        }
                    }
                }
            } catch (err) {
                logger.error('Error syncing settings:', err);
            } finally {
                if (mounted) {
                    initializationRef.current = {
                        initialized: true,
                        userId: currentUserId,
                        promise: false
                    };
                    setIsLoaded(true);
                }
            }
        };

        initSettings();

        return () => {
            mounted = false;
            // CRITICAL FIX: If we abort mid-flight (e.g. auth change), release the lock
            // so the next effect run can try again.
            if (initializationRef.current.promise) {
                initializationRef.current.promise = false;
            }
        };
    }, [user, authLoading, fetchRemoteSettings, setTheme, supabase]);

    // Cleanup session key on Logout so next login is treated as fresh
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_OUT') {
                logger.debug('Auth: Signed Out - clearing session init key');
                if (typeof window !== 'undefined') sessionStorage.removeItem(SESSION_INIT_KEY);
            }
        });
        return () => subscription.unsubscribe();
    }, [supabase]);

    // Listen for cross-tab updates (Only update data, do NOT change theme mid-session)
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY && e.newValue) {
                logger.debug('Detected external storage update');
                try {
                    const newSettings = JSON.parse(e.newValue);
                    const merged = { ...DEFAULT_SETTINGS, ...newSettings };

                    // Update LIVE settings for album creation
                    setSettings(merged);

                    // Do NOT update sessionSettings or Theme. 
                    // User requested: "Any change... should not change the display mode... only at login next time".
                } catch (err) {
                    logger.error('Failed to parse external settings update', err);
                }
            }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('storage', handleStorageChange);
        }
        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('storage', handleStorageChange);
            }
        };
    }, []); // Empty dependency array - purely setup logic

    // Theme application is handled strictly within the initSettings logic on mount/login.
    // We removed the redundant useEffect here to prevent manual theme changes from being overridden.

    // Test comment to verify edit capability
    // Save settings helper
    const updateSettings = useCallback(async (newSettings: Partial<UserSettings>) => {
        if (syncLockRef.current) {
            logger.debug('Sync lock active, ignoring update');
            return;
        }

        logger.debug('Starting Step 1: Prepare Update', newSettings);

        // 1. Calculate merged state based on current settings
        // Note: interacting with 'settings' directly requires it in dependency array
        const finalState = { ...settings, ...newSettings };

        // 2. Sync to DB FIRST
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                logger.debug('Starting Step 2: DB Update for user', user.id, 'Theme:', finalState.themePreference);
                const { error } = await supabase.from('user_settings').upsert({
                    user_id: user.id,
                    settings: finalState,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });

                if (error) {
                    logger.error('DB Update FAILED:', error);
                    throw error;
                }
                logger.debug('Step 2: DB Update Success');

                // VERIFICATION READ
                const { data: verifyData } = await supabase
                    .from('user_settings')
                    .select('settings')
                    .eq('user_id', user.id)
                    .single();
                logger.debug('Step 2b: Verification Read:', verifyData?.settings?.themePreference);

                if (verifyData?.settings?.themePreference !== finalState.themePreference) {
                    logger.error('CRITICAL: DB Verification Failed! Expected:', finalState.themePreference, 'Got:', verifyData?.settings?.themePreference);
                    // If verification fails, it means the DB update didn't persist (likely RLS).
                }

            } else {
                logger.warn('User not logged in, skipping DB update. Settings will only be local.');
            }
        } catch (e) {
            logger.error('Failed to save settings to DB:', e);
            // We proceed to local update, but warn
        }

        // 3. Update Cache / State / LocalStorage
        logger.debug('Starting Step 3: Cache Update', finalState);
        setSettings(finalState);
        // Also update session settings immediately if sticking to this pattern
        setSessionSettings(finalState); // Updated: Explicit user save should reflect in UI immediately

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(finalState));
            logger.debug('Step 3: LocalStorage Update Success');

            // Apply theme immediately ONLY if it was part of the update
            if (newSettings.themePreference) {
                setTheme(finalState.themePreference);
            }
        } catch (e) {
            logger.error('Failed to save settings locally', e);
        }

    }, [supabase, settings]);

    const resetSettings = useCallback(async () => {
        syncLockRef.current = true;
        try {
            setSettings(DEFAULT_SETTINGS);
            setSessionSettings(DEFAULT_SETTINGS);
            localStorage.removeItem(STORAGE_KEY);
            setTheme(DEFAULT_SETTINGS.themePreference);
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase.from('user_settings').delete().eq('user_id', user.id);
            }
        } catch (e) {
            logger.error('Failed to reset DB settings (silent fail is okay as localStorage is cleared)', e);
        } finally {
            setTimeout(() => { syncLockRef.current = false; }, 1000);
        }
    }, [supabase, setTheme]);

    const refreshSettings = useCallback(async () => {
        // Force re-fetch from storage or DB
        const remote = await fetchRemoteSettings();
        if (remote) {
            setSettings(remote);
            setSessionSettings(remote); // Update snapshot on manual refresh
            localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
            // Do NOT re-apply theme on refresh. Theme is strictly session-locked to login/mount.
            // if (remote.themePreference) setTheme(remote.themePreference);
        } else {
            // Revert to local
            const local = loadSettingsFromStorage();
            setSettings(local);
            setSessionSettings(local);
        }
    }, [fetchRemoteSettings, setTheme]);

    const clearLocalSettings = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setSettings(DEFAULT_SETTINGS);
    }, []);

    const value = useMemo(() => ({
        settings,
        sessionSettings,
        updateSettings,
        resetSettings,
        refreshSettings,
        clearLocalSettings,
        isLoaded
    }), [settings, sessionSettings, updateSettings, resetSettings, refreshSettings, isLoaded]);

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettingsContext() {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettingsContext must be used within a SettingsProvider');
    }
    return context;
}
