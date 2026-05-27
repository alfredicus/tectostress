// SettingsContext.tsx
// Global application preferences, persisted in localStorage.
// Wrap the app with <SettingsProvider> and consume with useSettings().

import React, { createContext, useContext, useState, useCallback } from 'react';

// ─── Convention type ──────────────────────────────────────────────────────────

/**
 * Geologist  : compression positive; σ1 = most compressive axis.
 * Engineer   : tension positive;     σ1 = algebraically largest (least compressive).
 *
 * Effect on displayed results:
 *  - label swap  : geologist σ1 ↔ engineer σ3
 *  - Mohr x-axis : compression→right (geologist) vs tension→right (engineer)
 */
export type StressConvention = 'geologist' | 'engineer';

// ─── Full settings shape ──────────────────────────────────────────────────────

export interface AppSettings {
    /** Which principal-stress labelling convention to use in results. */
    stressConvention: StressConvention;
    // Add more settings here as needed.
}

const DEFAULT_SETTINGS: AppSettings = {
    stressConvention: 'geologist',
};

const STORAGE_KEY = 'tectostress-app-settings';

function loadFromStorage(): AppSettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {/* ignore */}
    return DEFAULT_SETTINGS;
}

function saveToStorage(s: AppSettings): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {/* ignore */}
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface SettingsContextValue {
    settings: AppSettings;
    updateSettings: (patch: Partial<AppSettings>) => void;
    resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue>({
    settings: DEFAULT_SETTINGS,
    updateSettings: () => {},
    resetSettings: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<AppSettings>(loadFromStorage);

    const updateSettings = useCallback((patch: Partial<AppSettings>) => {
        setSettings(prev => {
            const next = { ...prev, ...patch };
            saveToStorage(next);
            return next;
        });
    }, []);

    const resetSettings = useCallback(() => {
        saveToStorage(DEFAULT_SETTINGS);
        setSettings(DEFAULT_SETTINGS);
    }, []);

    return (
        <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
            {children}
        </SettingsContext.Provider>
    );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSettings(): SettingsContextValue {
    return useContext(SettingsContext);
}
