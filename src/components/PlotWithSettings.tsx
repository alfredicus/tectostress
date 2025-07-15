import React, { useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { Settings, X, ChevronRight } from 'lucide-react';

interface StablePlotWithSettingsProps {
    // Required props
    children: ReactNode; // The main plot/visualization component
    settingsPanel: ReactNode; // The settings panel content

    // Optional customization
    title?: string;
    className?: string;
    settingsPanelWidth?: number;
    initialSettingsOpen?: boolean;
    showSettingsButton?: boolean;
    headerActions?: ReactNode; // Additional buttons in header

    // Callbacks - NO dimension change callback to prevent parent growth
    onSettingsToggle?: (isOpen: boolean) => void;

    // Styling options
    borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
    borderColor?: string;
    borderWidth?: number;
    backgroundColor?: string;
    headerBackgroundColor?: string;
}

const StablePlotWithSettings: React.FC<StablePlotWithSettingsProps> = ({
    children,
    settingsPanel,
    title = "Plot",
    className = "",
    settingsPanelWidth = 320,
    initialSettingsOpen = false,
    showSettingsButton = true,
    headerActions,
    onSettingsToggle,
    borderStyle = 'solid',
    borderColor = '#d1d5db',
    borderWidth = 1,
    backgroundColor = '#ffffff',
    headerBackgroundColor = '#f9fafb'
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const plotAreaRef = useRef<HTMLDivElement>(null);
    const [showSettings, setShowSettings] = useState(initialSettingsOpen);
    const [isAnimating, setIsAnimating] = useState(false);

    // Handle settings panel toggle with animation
    const toggleSettings = useCallback(async () => {
        setIsAnimating(true);
        const newState = !showSettings;
        setShowSettings(newState);

        // Notify parent of settings toggle
        onSettingsToggle?.(newState);

        // Wait for CSS transition to complete
        await new Promise(resolve => setTimeout(resolve, 300));
        setIsAnimating(false);
    }, [showSettings, onSettingsToggle]);

    // Handle container resize to adjust plot area
    useEffect(() => {
        const handleResize = () => {
            if (plotAreaRef.current && containerRef.current) {
                const containerWidth = containerRef.current.clientWidth;
                const availableWidth = showSettings ? containerWidth - settingsPanelWidth : containerWidth;
                
                // Update plot area width
                plotAreaRef.current.style.width = `${Math.max(availableWidth, 250)}px`;
            }
        };

        // Initial resize
        handleResize();

        // Listen for container resize
        const resizeObserver = new ResizeObserver(handleResize);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, [showSettings, settingsPanelWidth]);

    const containerStyle = {
        border: borderStyle !== 'none' ? `${borderWidth}px ${borderStyle} ${borderColor}` : 'none',
        backgroundColor,
        borderRadius: '8px',
        overflow: 'hidden'
    };

    const headerStyle = {
        backgroundColor: headerBackgroundColor,
        borderBottom: `1px solid ${borderColor}`
    };

    return (
        <div
            ref={containerRef}
            className={`w-full h-full flex flex-col relative ${className}`}
            style={containerStyle}
        >
            {/* Header */}
            {(title || headerActions || showSettingsButton) && (
                <div
                    className="flex items-center justify-between px-4 py-3 relative z-10"
                    style={headerStyle}
                >
                    <div className="flex items-center gap-3">
                        {title && (
                            <h3 className="text-lg font-semibold text-gray-800 truncate">
                                {title}
                            </h3>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {headerActions}

                        {showSettingsButton && (
                            <button
                                onClick={toggleSettings}
                                disabled={isAnimating}
                                className={`p-2 rounded-lg border transition-colors ${showSettings
                                        ? 'bg-blue-100 text-blue-600 border-blue-200'
                                        : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                                    } ${isAnimating ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title={showSettings ? "Hide Settings" : "Show Settings"}
                            >
                                {showSettings ? <ChevronRight size={16} /> : <Settings size={16} />}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Main content area */}
            <div className="flex-1 relative overflow-hidden">
                {/* Plot area - dynamically sized based on settings panel state */}
                <div 
                    ref={plotAreaRef}
                    className={`absolute top-0 left-0 h-full p-4 transition-all duration-300 ease-in-out ${
                        showSettings ? '' : 'w-full'
                    }`}
                    style={{
                        width: showSettings ? `calc(100% - ${settingsPanelWidth}px)` : '100%'
                    }}
                >
                    <div className="w-full h-full">
                        {children}
                    </div>
                </div>

                {/* Settings panel - overlay from right */}
                <div
                    className={`absolute top-0 right-0 h-full bg-white border-l shadow-lg transform transition-transform duration-300 ease-in-out overflow-y-auto z-20 ${
                        showSettings ? 'translate-x-0' : 'translate-x-full'
                    }`}
                    style={{
                        width: `${settingsPanelWidth}px`,
                        borderLeftColor: borderColor
                    }}
                >
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-lg font-semibold text-gray-800">Settings</h4>
                            <button
                                onClick={toggleSettings}
                                className="p-1 hover:bg-gray-100 rounded transition-colors"
                                title="Close Settings"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Settings content */}
                        <div className="space-y-4">
                            {settingsPanel}
                        </div>
                    </div>
                </div>
            </div>

            {/* Optional overlay backdrop for mobile */}
            {showSettings && (
                <div
                    className="absolute inset-0 bg-black bg-opacity-20 md:hidden z-10"
                    onClick={toggleSettings}
                />
            )}
        </div>
    );
};

export default StablePlotWithSettings;