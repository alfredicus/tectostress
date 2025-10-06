import React, { useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { Settings, X, ChevronRight, ChevronLeft, ZoomIn, ZoomOut } from 'lucide-react';

interface StablePlotWithSettingsProps {
    children: ReactNode;
    settingsPanel?: ReactNode;
    leftPanel?: ReactNode;
    title?: string;
    className?: string;
    settingsPanelWidth?: number;
    leftPanelWidth?: number;
    initialSettingsOpen?: boolean;
    initialLeftPanelOpen?: boolean;
    showSettingsButton?: boolean;
    showLeftPanelButton?: boolean;
    leftPanelButtonIcon?: ReactNode;
    headerActions?: ReactNode;
    onSettingsToggle?: (isOpen: boolean) => void;
    onLeftPanelToggle?: (isOpen: boolean) => void;
    borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
    borderColor?: string;
    borderWidth?: number;
    backgroundColor?: string;
    headerBackgroundColor?: string;
    enableZoom?: boolean;
    minZoom?: number;
    maxZoom?: number;
    defaultZoom?: number;
    onZoomChange?: (zoom: number) => void;
}

const StablePlotWithSettings: React.FC<StablePlotWithSettingsProps> = ({
    children,
    settingsPanel,
    leftPanel,
    title = "Plot",
    className = "",
    settingsPanelWidth = 320,
    leftPanelWidth = 320,
    initialSettingsOpen = false,
    initialLeftPanelOpen = false,
    showSettingsButton = true,
    showLeftPanelButton = false,
    leftPanelButtonIcon,
    headerActions,
    onSettingsToggle,
    onLeftPanelToggle,
    borderStyle = 'solid',
    borderColor = '#d1d5db',
    borderWidth = 1,
    backgroundColor = '#ffffff',
    headerBackgroundColor = '#f9fafb',
    enableZoom = false,
    minZoom = 0.5,
    maxZoom = 2.0,
    defaultZoom = 1.0,
    onZoomChange
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const plotAreaRef = useRef<HTMLDivElement>(null);
    const [showSettings, setShowSettings] = useState(initialSettingsOpen);
    const [showLeftPanel, setShowLeftPanel] = useState(initialLeftPanelOpen);
    const [isAnimating, setIsAnimating] = useState(false);
    const [zoom, setZoom] = useState(defaultZoom);

    const toggleSettings = useCallback(async () => {
        setIsAnimating(true);
        const newState = !showSettings;
        setShowSettings(newState);
        onSettingsToggle?.(newState);
        await new Promise(resolve => setTimeout(resolve, 300));
        setIsAnimating(false);
    }, [showSettings, onSettingsToggle]);

    const toggleLeftPanel = useCallback(async () => {
        setIsAnimating(true);
        const newState = !showLeftPanel;
        setShowLeftPanel(newState);
        onLeftPanelToggle?.(newState);
        await new Promise(resolve => setTimeout(resolve, 300));
        setIsAnimating(false);
    }, [showLeftPanel, onLeftPanelToggle]);

    const handleZoomChange = (newZoom: number) => {
        const clampedZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
        setZoom(clampedZoom);
        onZoomChange?.(clampedZoom);
    };

    const zoomIn = () => handleZoomChange(zoom + 0.1);
    const zoomOut = () => handleZoomChange(zoom - 0.1);
    const resetZoom = () => handleZoomChange(1.0);

    useEffect(() => {
        const handleResize = () => {
            if (plotAreaRef.current && containerRef.current) {
                const containerWidth = containerRef.current.clientWidth;
                const leftOffset = showLeftPanel ? leftPanelWidth : 0;
                const rightOffset = showSettings ? settingsPanelWidth : 0;
                const availableWidth = containerWidth - leftOffset - rightOffset;
                plotAreaRef.current.style.width = `${Math.max(availableWidth, 250)}px`;
                plotAreaRef.current.style.left = `${leftOffset}px`;
            }
        };

        handleResize();
        const resizeObserver = new ResizeObserver(handleResize);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, [showSettings, showLeftPanel, settingsPanelWidth, leftPanelWidth]);

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
            {(title || headerActions || showSettingsButton || showLeftPanelButton || enableZoom) && (
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
                        {/* Zoom Controls */}
                        {enableZoom && (
                            <div className="flex items-center gap-1 mr-2">
                                {/* <button
                                    onClick={zoomOut}
                                    disabled={zoom <= minZoom}
                                    className="p-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Zoom Out"
                                >
                                    <ZoomOut size={14} />
                                </button>
                                <span className="text-xs font-medium text-gray-600 min-w-[45px] text-center">
                                    {(zoom * 100).toFixed(0)}%
                                </span>
                                <button
                                    onClick={zoomIn}
                                    disabled={zoom >= maxZoom}
                                    className="p-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Zoom In"
                                >
                                    <ZoomIn size={14} />
                                </button>
                                {zoom !== 1.0 && (
                                    <button
                                        onClick={resetZoom}
                                        className="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors"
                                        title="Reset Zoom"
                                    >
                                        Reset
                                    </button>
                                )} */}
                            </div>
                        )}

                        {headerActions}

                        {showLeftPanelButton && leftPanel && (
                            <button
                                onClick={toggleLeftPanel}
                                disabled={isAnimating}
                                className={`p-2 rounded-lg border transition-colors ${showLeftPanel
                                    ? 'bg-green-100 text-green-600 border-green-200'
                                    : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                                    } ${isAnimating ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title={showLeftPanel ? "Hide Left Panel" : "Show Left Panel"}
                            >
                                {leftPanelButtonIcon || (showLeftPanel ? <ChevronLeft size={16} /> : <ChevronRight size={16} />)}
                            </button>
                        )}

                        {showSettingsButton && settingsPanel && (
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
                {/* Left Panel */}
                {leftPanel && (
                    <div
                        className={`absolute top-0 left-0 h-full bg-white border-r shadow-lg transform transition-transform duration-300 ease-in-out overflow-y-auto z-20 ${showLeftPanel ? 'translate-x-0' : '-translate-x-full'
                            }`}
                        style={{
                            width: `${leftPanelWidth}px`,
                            borderRightColor: borderColor
                        }}
                    >
                        <div className="p-4">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-lg font-semibold text-gray-800">Data Selection</h4>
                                <button
                                    onClick={toggleLeftPanel}
                                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                                    title="Close Panel"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                {leftPanel}
                            </div>
                        </div>
                    </div>
                )}

                {/* Plot area with zoom transform */}
                <div
                    ref={plotAreaRef}
                    className={`absolute top-0 h-full p-4 transition-all duration-300 ease-in-out`}
                    style={{
                        width: showSettings || showLeftPanel
                            ? `calc(100% - ${(showLeftPanel ? leftPanelWidth : 0) + (showSettings ? settingsPanelWidth : 0)}px)`
                            : '100%',
                        left: showLeftPanel ? `${leftPanelWidth}px` : '0'
                    }}
                >
                    <div
                        className="w-full h-full flex items-center justify-center"
                        style={{
                            transform: enableZoom ? `scale(${zoom})` : 'none',
                            transformOrigin: 'center center',
                            transition: 'transform 0.2s ease-out'
                        }}
                    >
                        {children}
                    </div>
                </div>

                {/* Settings panel (Right) */}
                {settingsPanel && (
                    <div
                        className={`absolute top-0 right-0 h-full bg-white border-l shadow-lg transform transition-transform duration-300 ease-in-out overflow-y-auto z-20 ${showSettings ? 'translate-x-0' : 'translate-x-full'
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

                            <div className="space-y-4">
                                {settingsPanel}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Overlay backdrop for mobile */}
            {(showSettings || showLeftPanel) && (
                <div
                    className="absolute inset-0 bg-black bg-opacity-20 md:hidden z-10"
                    onClick={() => {
                        if (showSettings) toggleSettings();
                        if (showLeftPanel) toggleLeftPanel();
                    }}
                />
            )}
        </div>
    );
};

export default StablePlotWithSettings;