// ThemeContext.tsx - Theme management system

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

// ============================================================================
// THEME TYPES AND CONFIGURATIONS
// ============================================================================

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
    // Background colors
    background: {
        primary: string;
        secondary: string;
        tertiary: string;
        elevated: string;
        paper: string;
    };

    // Text colors
    text: {
        primary: string;
        secondary: string;
        tertiary: string;
        inverse: string;
    };

    // Border colors
    border: {
        primary: string;
        secondary: string;
        focus: string;
    };

    // Status colors
    status: {
        success: string;
        warning: string;
        error: string;
        info: string;
    };

    // Interactive colors
    interactive: {
        primary: string;
        primaryHover: string;
        secondary: string;
        secondaryHover: string;
        danger: string;
        dangerHover: string;
    };

    // Visualization-specific colors
    visualization: {
        rose: string;
        histogram: string;
        wulff: string;
        mohr: string;
        grid: string;
        axis: string;
    };

    // Component-specific colors
    components: {
        header: string;
        sidebar: string;
        card: string;
        input: string;
        button: string;
        console: string;
    };
}

export interface Theme {
    mode: 'light' | 'dark';
    colors: ThemeColors;
    shadows: {
        sm: string;
        md: string;
        lg: string;
        xl: string;
    };
    spacing: {
        xs: string;
        sm: string;
        md: string;
        lg: string;
        xl: string;
    };
}

// ============================================================================
// THEME DEFINITIONS
// ============================================================================

export const lightTheme: Theme = {
    mode: 'light',
    colors: {
        background: {
            primary: '#ffffff',
            secondary: '#f8fafc',
            tertiary: '#f1f5f9',
            elevated: '#ffffff',
            paper: '#ffffff',
        },
        text: {
            primary: '#1e293b',
            secondary: '#475569',
            tertiary: '#64748b',
            inverse: '#ffffff',
        },
        border: {
            primary: '#e2e8f0',
            secondary: '#cbd5e1',
            focus: '#3b82f6',
        },
        status: {
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444',
            info: '#3b82f6',
        },
        interactive: {
            primary: '#3b82f6',
            primaryHover: '#2563eb',
            secondary: '#6b7280',
            secondaryHover: '#4b5563',
            danger: '#ef4444',
            dangerHover: '#dc2626',
        },
        visualization: {
            rose: '#ff6b6b',
            histogram: '#4ecdc4',
            wulff: '#45b7d1',
            mohr: '#96ceb4',
            grid: '#e5e7eb',
            axis: '#374151',
        },
        components: {
            header: '#1f2937',
            sidebar: '#f9fafb',
            card: '#ffffff',
            input: '#ffffff',
            button: '#3b82f6',
            console: '#1f2937',
        },
    },
    shadows: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    },
    spacing: {
        xs: '0.5rem',
        sm: '1rem',
        md: '1.5rem',
        lg: '2rem',
        xl: '3rem',
    },
};

export const darkTheme: Theme = {
    mode: 'dark',
    colors: {
        background: {
            primary: '#0f172a',
            secondary: '#1e293b',
            tertiary: '#334155',
            elevated: '#1e293b',
            paper: '#334155',
        },
        text: {
            primary: '#f1f5f9',        // ✅ Light text (was #868686ff)
            secondary: '#cbd5e1',
            tertiary: '#94a3b8',       // ✅ Lighter than before
            inverse: '#000000',        // ✅ For use on light backgrounds
        },
        border: {
            primary: '#334155',
            secondary: '#475569',
            focus: '#60a5fa',
        },
        status: {
            success: '#34d399',
            warning: '#fbbf24',
            error: '#f87171',
            info: '#60a5fa',
        },
        interactive: {
            primary: '#60a5fa',
            primaryHover: '#3b82f6',
            secondary: '#9ca3af',
            secondaryHover: '#6b7280',
            danger: '#f87171',
            dangerHover: '#ef4444',
        },
        visualization: {
            rose: '#ff8a80',
            histogram: '#64d8cb',
            wulff: '#64b5f6',
            mohr: '#aed581',
            grid: '#4b5563',
            axis: '#e5e7eb',
        },
        components: {
            header: '#0f172a',
            sidebar: '#1e293b',
            card: '#334155',
            input: '#334155',
            button: '#60a5fa',
            console: '#0f172a',
        },
    },
    shadows: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.3)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.3)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.4), 0 4px 6px -4px rgb(0 0 0 / 0.3)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.4), 0 8px 10px -6px rgb(0 0 0 / 0.3)',
    },
    spacing: {
        xs: '0.5rem',
        sm: '1rem',
        md: '1.5rem',
        lg: '2rem',
        xl: '3rem',
    },
};

// ============================================================================
// THEME CONTEXT
// ============================================================================

interface ThemeContextType {
    theme: Theme;
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    toggleTheme: () => void;
    isDark: boolean;
    isLight: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ============================================================================
// THEME PROVIDER
// ============================================================================

interface ThemeProviderProps {
    children: ReactNode;
    defaultMode?: ThemeMode;
    storageKey?: string;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
    children,
    defaultMode = 'system',
    storageKey = 'tectostress-theme',
}) => {
    const [themeMode, setThemeModeState] = useState<ThemeMode>(defaultMode);
    const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');

    // Detect system theme preference
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        setSystemTheme(mediaQuery.matches ? 'dark' : 'light');

        const handleChange = (e: MediaQueryListEvent) => {
            setSystemTheme(e.matches ? 'dark' : 'light');
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    // Load theme from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(storageKey) as ThemeMode;
            if (stored && ['light', 'dark', 'system'].includes(stored)) {
                setThemeModeState(stored);
            }
        } catch (error) {
            console.warn('Failed to load theme from localStorage:', error);
        }
    }, [storageKey]);

    // Save theme to localStorage when changed
    useEffect(() => {
        try {
            localStorage.setItem(storageKey, themeMode);
        } catch (error) {
            console.warn('Failed to save theme to localStorage:', error);
        }
    }, [themeMode, storageKey]);

    // Determine active theme
    const activeThemeMode = themeMode === 'system' ? systemTheme : themeMode;
    const theme = activeThemeMode === 'dark' ? darkTheme : lightTheme;

    // Apply theme to document root
    useEffect(() => {
        const root = document.documentElement;

        // Remove existing theme classes
        root.classList.remove('light', 'dark');

        // Add current theme class
        root.classList.add(activeThemeMode);

        // Set CSS custom properties for the theme
        Object.entries(theme.colors).forEach(([category, colors]) => {
            if (typeof colors === 'object') {
                Object.entries(colors).forEach(([key, value]) => {
                    root.style.setProperty(`--color-${category}-${key}`, value);
                });
            } else {
                root.style.setProperty(`--color-${category}`, colors);
            }
        });

        // Set shadow variables
        Object.entries(theme.shadows).forEach(([key, value]) => {
            root.style.setProperty(`--shadow-${key}`, value);
        });

        // Set spacing variables
        Object.entries(theme.spacing).forEach(([key, value]) => {
            root.style.setProperty(`--spacing-${key}`, value);
        });
    }, [theme, activeThemeMode]);

    const setThemeMode = (mode: ThemeMode) => {
        setThemeModeState(mode);
    };

    const toggleTheme = () => {
        if (themeMode === 'system') {
            setThemeMode('light');
        } else if (themeMode === 'light') {
            setThemeMode('dark');
        } else {
            setThemeMode('light');
        }
    };

    const value: ThemeContextType = {
        theme,
        themeMode,
        setThemeMode,
        toggleTheme,
        isDark: activeThemeMode === 'dark',
        isLight: activeThemeMode === 'light',
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

// ============================================================================
// THEME HOOK
// ============================================================================

export const useTheme = (): ThemeContextType => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

// ============================================================================
// THEME TOGGLE COMPONENT
// ============================================================================

import { Sun, Moon, Monitor } from 'lucide-react';

export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
    const { themeMode, setThemeMode, isDark } = useTheme();

    const modes: { mode: ThemeMode; icon: React.ReactNode; label: string }[] = [
        { mode: 'light', icon: <Sun size={16} />, label: 'Light' },
        { mode: 'dark', icon: <Moon size={16} />, label: 'Dark' },
        { mode: 'system', icon: <Monitor size={16} />, label: 'System' },
    ];

    return (
        <div className={`flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 ${className}`}>
            {modes.map(({ mode, icon, label }) => (
                <button
                    key={mode}
                    onClick={() => setThemeMode(mode)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${themeMode === mode
                            ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                    title={`Switch to ${label} mode`}
                >
                    {icon}
                    <span className="hidden sm:inline">{label}</span>
                </button>
            ))}
        </div>
    );
};

// ============================================================================
// QUICK THEME TOGGLE BUTTON
// ============================================================================

export const QuickThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
    const { toggleTheme, isDark } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 ${className}`}
            title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
    );
};

// ============================================================================
// STYLED COMPONENTS UTILITIES
// ============================================================================

/**
 * Utility function to create theme-aware styled components
 */
export const createThemedComponent = <T extends Record<string, any>>(
    Component: React.ComponentType<T>,
    themeStyles: {
        light?: React.CSSProperties;
        dark?: React.CSSProperties;
        base?: React.CSSProperties;
    }
) => {
    return React.forwardRef<any, T>((props, ref) => {
        const { theme } = useTheme();

        const styles = {
            ...themeStyles.base,
            ...(theme.mode === 'light' ? themeStyles.light : themeStyles.dark),
        };

        return <Component ref={ref} {...props} style={{ ...styles, ...props.style }} />;
    });
};

/**
 * Theme-aware CSS class generator
 */
export const useThemeClasses = (classes: {
    light?: string;
    dark?: string;
    base?: string;
}) => {
    const { isDark } = useTheme();

    return [
        classes.base,
        isDark ? classes.dark : classes.light,
    ].filter(Boolean).join(' ');
};

// ============================================================================
// CSS CUSTOM PROPERTIES INTEGRATION
// ============================================================================

/**
 * Generate CSS custom properties from theme
 */
export const generateThemeCSS = (theme: Theme): string => {
    const cssVariables: string[] = [];

    Object.entries(theme.colors).forEach(([category, colors]) => {
        if (typeof colors === 'object') {
            Object.entries(colors).forEach(([key, value]) => {
                cssVariables.push(`  --color-${category}-${key}: ${value};`);
            });
        }
    });

    Object.entries(theme.shadows).forEach(([key, value]) => {
        cssVariables.push(`  --shadow-${key}: ${value};`);
    });

    Object.entries(theme.spacing).forEach(([key, value]) => {
        cssVariables.push(`  --spacing-${key}: ${value};`);
    });

    return `:root {\n${cssVariables.join('\n')}\n}`;
};

// ============================================================================
// THEME PERSISTENCE UTILITIES
// ============================================================================

export const ThemeUtils = {
    /**
     * Export current theme configuration
     */
    exportTheme: (theme: Theme): string => {
        return JSON.stringify(theme, null, 2);
    },

    /**
     * Import theme configuration
     */
    importTheme: (themeJson: string): Theme | null => {
        try {
            const theme = JSON.parse(themeJson);
            // Validate theme structure here if needed
            return theme;
        } catch (error) {
            console.error('Failed to import theme:', error);
            return null;
        }
    },

    /**
     * Reset theme to defaults
     */
    resetTheme: (mode: 'light' | 'dark'): Theme => {
        return mode === 'dark' ? darkTheme : lightTheme;
    },

    /**
     * Create custom theme based on existing theme
     */
    createCustomTheme: (baseTheme: Theme, overrides: Partial<Theme>): Theme => {
        return {
            ...baseTheme,
            ...overrides,
            colors: {
                ...baseTheme.colors,
                ...overrides.colors,
            },
        };
    },
};