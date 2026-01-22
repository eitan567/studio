import { useSettingsContext, UserSettings, DEFAULT_SETTINGS } from '@/components/settings-provider';

// Re-export types for backward compatibility
export type { UserSettings };
export { DEFAULT_SETTINGS };

export function useSettings() {
    const { settings, sessionSettings, ...rest } = useSettingsContext();

    return {
        settings: sessionSettings, // Default to session-based snapshot for UI
        liveSettings: settings,    // Expose live settings for creation dialogs
        ...rest
    };
}
