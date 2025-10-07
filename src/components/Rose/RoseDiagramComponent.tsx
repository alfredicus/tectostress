import React, { useEffect, useRef } from 'react';
import { RoseDiagram } from './RoseDiagram';
import { Download, RotateCcw, Navigation } from 'lucide-react';
import StablePlotWithSettings from '../PlotWithSettings';
import {
    BaseVisualizationProps,
    useVisualizationState,
    DataExporter,
    ColumnSelector,
    ColorInput,
    NumberInput,
    ColumnInfo
} from '../VisualizationStateSystem';
import { createRoseSettings, RoseCompState } from './RoseParameters';

// ============================================================================
// ROSE DIAGRAM COMPONENT
// ============================================================================

const RoseDiagramComponent: React.FC<BaseVisualizationProps<RoseCompState>> = ({
    files,
    width = 400,
    height = 400,
    title = "Rose Diagram",
    state,
    onStateChange,
    onDimensionChange
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [rose, setRose] = React.useState<RoseDiagram | null>(null);

    // Use the factorized visualization state hook
    const {
        state: currentState,
        availableColumns,
        updateSettings,
        updateSelectedColumn,
        updatePlotDimensions,
        toggleSettingsPanel,
        resetToDefaults,
        getSelectedColumnData,
        getSelectedColumnInfo
    } = useVisualizationState<RoseCompState>(
        'rose-diagram',
        createRoseSettings(),
        files,
        width,
        height,
        state,
        onStateChange
    );

    // Initialize and update rose diagram
    useEffect(() => {
        if (!containerRef.current) return;

        const data = getSelectedColumnData();

        // Use sample data if no data is available
        const finalData = data.length > 0 ? data : new Array(100).fill(0).map(() => Math.random() * 180);

        // Calculate effective dimensions
        // const effectiveWidth = Math.max(currentState.plotDimensions.width - 40, 300);
        // const effectiveHeight = Math.max(currentState.plotDimensions.height - 40, 300);

        const baseWidth = Math.max(currentState.plotDimensions.width - 40, 300);
        const baseHeight = Math.max(currentState.plotDimensions.height - 40, 300);
        const baseSize = Math.min(baseWidth, baseHeight);
        const zoomedSize = baseSize * currentState.settings.zoomLevel;

        // Clear any existing content
        if (containerRef.current) {
            containerRef.current.innerHTML = '';
            // Create a unique container ID for the rose diagram
            const roseContainer = document.createElement('div');
            roseContainer.id = `rose-container-${Date.now()}`;
            roseContainer.style.width = '100%';
            roseContainer.style.height = '100%';
            containerRef.current.appendChild(roseContainer);

            const newRose = new RoseDiagram(roseContainer.id, finalData, {
                width: zoomedSize,
                height: zoomedSize,
                draw: {
                    labels: currentState.settings.showLabels,
                    circles: currentState.settings.showCircles,
                    binBorder: currentState.settings.showLines,
                    cardinals: currentState.settings.showCardinals
                },
                is360: currentState.settings.is360,
                innerR: currentState.settings.innerRadius,
                deltaAngle: currentState.settings.binAngle,
                fillColor: currentState.settings.binColor,
                lineColor: currentState.settings.lineColor,
            });

            setRose(newRose);
        }


        return () => {
            // Cleanup if needed
        };
    }, [currentState, getSelectedColumnData]);

    // Export functionality
    const exportData = () => {
        const data = getSelectedColumnData();
        if (data.length === 0) return;
        DataExporter.exportCSV(data, 'rose_diagram_data.csv');
    };

    const exportState = () => {
        DataExporter.exportState(currentState, 'rose_diagram_state.json');
    };

    // Data summary calculation
    const getDataSummary = () => {
        const data = getSelectedColumnData();
        if (data.length === 0) {
            return { count: 0, min: 0, max: 0, filename: 'None' };
        }

        const selectedColumnInfo = getSelectedColumnInfo();
        return {
            count: data.length,
            min: Math.min(...data),
            max: Math.max(...data),
            filename: selectedColumnInfo?.fileName || 'Unknown'
        };
    };

    const dataSummary = getDataSummary();

    // Main plot content
    const plotContent = (
        <div className="flex flex-col h-full">
            {/* Column selector */}
            <ColumnSelector
                availableColumns={availableColumns}
                selectedColumn={currentState.selectedColumn}
                onColumnChange={updateSelectedColumn}
                label="Select Data Column (Angles)"
            />

            {/* Rose diagram container */}
            <div className="flex-1 min-h-0 mb-4">
                <div
                    ref={containerRef}
                    className="w-full h-full border rounded-lg bg-white shadow-sm flex items-center justify-center"
                />
            </div>

            {/* Data info panel */}
            <div className="flex-shrink-0 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                    <Navigation className="w-5 h-5 text-blue-600" />
                    <h4 className="font-semibold">Data Summary</h4>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="font-medium">File:</span> {dataSummary.filename}
                    </div>
                    <div>
                        <span className="font-medium">Count:</span> {dataSummary.count}
                    </div>
                    <div>
                        <span className="font-medium">Min:</span> {dataSummary.min.toFixed(2)}°
                    </div>
                    <div>
                        <span className="font-medium">Max:</span> {dataSummary.max.toFixed(2)}°
                    </div>
                </div>
            </div>
        </div>
    );

    // Settings panel content
    const settingsContent = (
        <div className="space-y-4">
            {/* NOUVEAU : Section Zoom */}
            <div className="pb-4 border-b">
                <h5 className="font-medium text-gray-800 mb-3">Diagram Size</h5>
                <div>
                    <label className="block text-sm font-medium mb-2">
                        Zoom: {(currentState.settings.zoomLevel * 100).toFixed(0)}%
                    </label>
                    <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={currentState.settings.zoomLevel}
                        onChange={(e) => updateSettings({ zoomLevel: parseFloat(e.target.value) })}
                        className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>50%</span>
                        <span>100%</span>
                        <span>200%</span>
                    </div>
                    {currentState.settings.zoomLevel !== 1.0 && (
                        <button
                            onClick={() => updateSettings({ zoomLevel: 1.0 })}
                            className="mt-2 w-full text-xs px-3 py-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                        >
                            Reset to 100%
                        </button>
                    )}
                </div>
            </div>
            {/* Bin settings */}
            <div>
                <h5 className="font-medium text-gray-800 mb-3">Bin Settings</h5>
                <div className="space-y-3">
                    {/* Bin angle */}
                    <div>
                        <label className="block text-sm font-medium mb-1">Bin Angle</label>
                        <select
                            value={currentState.settings.binAngle}
                            onChange={(e) => updateSettings({ binAngle: parseInt(e.target.value) })}
                            className="w-full p-2 border rounded text-sm"
                        >
                            {[2, 3, 5, 6, 10, 15, 30].map(angle => (
                                <option key={angle} value={angle}>{angle}°</option>
                            ))}
                        </select>
                    </div>

                    {/* Bin color */}
                    <ColorInput
                        value={currentState.settings.binColor}
                        onChange={(value) => updateSettings({ binColor: value })}
                        label="Bin Color"
                    />
                </div>
            </div>

            {/* Display options */}
            <div>
                <h5 className="font-medium text-gray-800 mb-3">Display Options</h5>
                <div className="space-y-2">
                    <label className="flex items-center justify-between">
                        <span className="text-sm">Show bin borders</span>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={currentState.settings.showLines}
                                onChange={(e) => updateSettings({ showLines: e.target.checked })}
                                className="rounded"
                            />
                            <input
                                type="color"
                                value={currentState.settings.lineColor}
                                onChange={(e) => updateSettings({ lineColor: e.target.value })}
                                className="w-6 h-5 border rounded cursor-pointer"
                                disabled={!currentState.settings.showLines}
                            />
                        </div>
                    </label>

                    <label className="flex items-center justify-between">
                        <span className="text-sm">Use 360° mode</span>
                        <input
                            type="checkbox"
                            checked={currentState.settings.is360}
                            onChange={(e) => updateSettings({ is360: e.target.checked })}
                            className="rounded"
                        />
                    </label>

                    <label className="flex items-center justify-between">
                        <span className="text-sm">Show frequency labels</span>
                        <input
                            type="checkbox"
                            checked={currentState.settings.showLabels}
                            onChange={(e) => updateSettings({ showLabels: e.target.checked })}
                            className="rounded"
                        />
                    </label>

                    <label className="flex items-center justify-between">
                        <span className="text-sm">Show cardinals (N,E,S,W)</span>
                        <input
                            type="checkbox"
                            checked={currentState.settings.showCardinals}
                            onChange={(e) => updateSettings({ showCardinals: e.target.checked })}
                            className="rounded"
                        />
                    </label>

                    <label className="flex items-center justify-between">
                        <span className="text-sm">Show concentric circles</span>
                        <input
                            type="checkbox"
                            checked={currentState.settings.showCircles}
                            onChange={(e) => updateSettings({ showCircles: e.target.checked })}
                            className="rounded"
                        />
                    </label>
                </div>
            </div>

            {/* Inner radius */}
            <div>
                <h5 className="font-medium text-gray-800 mb-3">Geometry</h5>
                <div>
                    <label className="block text-sm font-medium mb-2">
                        Inner Radius: {currentState.settings.innerRadius}
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={currentState.settings.innerRadius}
                        onChange={(e) => updateSettings({ innerRadius: parseInt(e.target.value) })}
                        className="w-full"
                    />
                </div>
            </div>

            {/* Column info */}
            <ColumnInfo columnInfo={getSelectedColumnInfo()} />
        </div>
    );

    // Header actions
    const headerActions = (
        <>
            <button
                onClick={resetToDefaults}
                className="p-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                title="Reset to Defaults"
            >
                <RotateCcw size={16} />
            </button>
            <button
                onClick={exportData}
                disabled={!rose}
                className="p-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                title="Export Data"
            >
                <Download size={16} />
            </button>
        </>
    );

    return (
        <StablePlotWithSettings
            title={title}
            settingsPanel={settingsContent}
            headerActions={headerActions}
            borderColor="#d1d5db"
            borderWidth={1}
            settingsPanelWidth={300}
            initialSettingsOpen={currentState.open}
            onSettingsToggle={(isOpen) => {
                // Handle settings panel toggle
                toggleSettingsPanel();

                // When settings panel opens/closes, adjust the plot dimensions
                setTimeout(() => {
                    if (containerRef.current) {
                        // Calculate available width for the plot
                        const containerWidth = containerRef.current.parentElement?.clientWidth || width || 400;
                        const settingsPanelWidth = isOpen ? 300 : 0;
                        const availableWidth = containerWidth - settingsPanelWidth - 40; // 40px for padding

                        const newDimensions = {
                            width: Math.max(availableWidth, 300), // Minimum width for plot
                            height: containerRef.current?.clientHeight || height || 400
                        };

                        updatePlotDimensions(newDimensions);
                    }
                }, 150);
            }}
        >
            {plotContent}
        </StablePlotWithSettings>
    );
};

export default RoseDiagramComponent;