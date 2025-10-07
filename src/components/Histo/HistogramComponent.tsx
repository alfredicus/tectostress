import React, { useEffect, useRef } from 'react';
import { Histogram, HistogramParameters } from './Histogram';
import { Download, RotateCcw, BarChart3, TrendingUp } from 'lucide-react';
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
import { createHistogramSettings, HistogramCompState } from './HistogramParameters';

// ============================================================================
// HISTOGRAM COMPONENT
// ============================================================================

const HistogramComponent: React.FC<BaseVisualizationProps<HistogramCompState>> = ({
    files,
    width = 600,
    height = 400,
    title = "Data Histogram",
    state,
    onStateChange,
    onDimensionChange
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [histogram, setHistogram] = React.useState<Histogram | null>(null);
    const [statistics, setStatistics] = React.useState<any>(null);

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
    } = useVisualizationState<HistogramCompState>(
        'histogram',
        createHistogramSettings(),
        files,
        width,
        height,
        state,
        onStateChange
    );

    // Initialize and update histogram
    useEffect(() => {
        if (!containerRef.current) return;

        const data = getSelectedColumnData();
        if (data.length === 0) return;

        const selectedColumnInfo = getSelectedColumnInfo();

        // Calculate effective dimensions - leave space for margins and statistics
        const effectiveWidth = Math.max(currentState.plotDimensions.width - 40, 300);
        const effectiveHeight = Math.max(currentState.plotDimensions.height - 120, 200); // Leave space for statistics

        const params: HistogramParameters = {
            width: effectiveWidth,
            height: effectiveHeight,
            bins: currentState.settings.bins,
            fillColor: currentState.settings.fillColor,
            strokeColor: currentState.settings.strokeColor,
            title: title,
            xAxisLabel: selectedColumnInfo ? selectedColumnInfo.columnName : currentState.settings.xAxisLabel,
            yAxisLabel: currentState.settings.yAxisLabel,
            draw: {
                grid: currentState.settings.showGrid,
                density: currentState.settings.showDensity,
                labels: currentState.settings.showLabels,
                axes: true
            }
        };

        const newHistogram = new Histogram(containerRef.current, data, params);
        setHistogram(newHistogram);

        // Update statistics
        const stats = newHistogram.getStatistics();
        setStatistics(stats);

        return () => {
            // Cleanup if needed
        };
    }, [currentState, getSelectedColumnData, getSelectedColumnInfo, title]);

    // Update histogram when data changes
    useEffect(() => {
        if (!histogram) return;

        const data = getSelectedColumnData();
        if (data.length > 0) {
            histogram.data = data;
            const stats = histogram.getStatistics();
            setStatistics(stats);
        }
    }, [histogram, getSelectedColumnData]);

    // Export functionality
    const exportData = () => {
        if (!histogram) return;
        const csvData = histogram.exportData();
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'histogram_data.csv';
        link.click();
        URL.revokeObjectURL(url);
    };

    const exportState = () => {
        DataExporter.exportState(currentState, 'histogram_state.json');
    };

    // Main plot content
    const plotContent = (
        <div className="flex flex-col h-full">
            {/* Column selector */}
            <ColumnSelector
                availableColumns={availableColumns}
                selectedColumn={currentState.selectedColumn}
                onColumnChange={updateSelectedColumn}
                label="Select Data Column"
            />

            {/* Histogram container */}
            <div className="flex-1 min-h-0 mb-4">
                <div
                    ref={containerRef}
                    className="w-full h-full border rounded-lg bg-white shadow-sm flex items-center justify-center"
                />
            </div>

            {/* Statistics summary */}
            {statistics && (
                <div className="flex-shrink-0 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                        <h4 className="font-semibold">Statistical Summary</h4>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                            <span className="font-medium">Count:</span> {statistics.count}
                        </div>
                        <div>
                            <span className="font-medium">Mean:</span> {statistics.mean?.toFixed(3)}
                        </div>
                        <div>
                            <span className="font-medium">Median:</span> {statistics.median?.toFixed(3)}
                        </div>
                        <div>
                            <span className="font-medium">Std Dev:</span> {statistics.stdDev?.toFixed(3)}
                        </div>
                        <div>
                            <span className="font-medium">Min:</span> {statistics.min?.toFixed(3)}
                        </div>
                        <div>
                            <span className="font-medium">Q1:</span> {statistics.q1?.toFixed(3)}
                        </div>
                        <div>
                            <span className="font-medium">Q3:</span> {statistics.q3?.toFixed(3)}
                        </div>
                        <div>
                            <span className="font-medium">Max:</span> {statistics.max?.toFixed(3)}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // Settings panel content
    const settingsContent = (
        <div className="space-y-4">
            {/* Histogram settings */}
            <div>
                <h5 className="font-medium text-gray-800 mb-3">Histogram Settings</h5>
                <div className="space-y-3">
                    {/* Number of bins */}
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Number of Bins: {currentState.settings.bins}
                        </label>
                        <input
                            type="range"
                            min="5"
                            max="50"
                            value={currentState.settings.bins}
                            onChange={(e) => updateSettings({ bins: parseInt(e.target.value) })}
                            className="w-full"
                        />
                    </div>

                    {/* Colors */}
                    <ColorInput
                        value={currentState.settings.fillColor}
                        onChange={(value) => updateSettings({ fillColor: value })}
                        label="Fill Color"
                    />

                    <ColorInput
                        value={currentState.settings.strokeColor}
                        onChange={(value) => updateSettings({ strokeColor: value })}
                        label="Border Color"
                    />
                </div>
            </div>

            {/* Display options */}
            <div>
                <h5 className="font-medium text-gray-800 mb-3">Display Options</h5>
                <div className="space-y-2">
                    <label className="flex items-center justify-between">
                        <span className="text-sm">Show Grid</span>
                        <input
                            type="checkbox"
                            checked={currentState.settings.showGrid}
                            onChange={(e) => updateSettings({ showGrid: e.target.checked })}
                            className="rounded"
                        />
                    </label>

                    <label className="flex items-center justify-between">
                        <span className="text-sm">Show Density Curve</span>
                        <input
                            type="checkbox"
                            checked={currentState.settings.showDensity}
                            onChange={(e) => updateSettings({ showDensity: e.target.checked })}
                            className="rounded"
                        />
                    </label>

                    <label className="flex items-center justify-between">
                        <span className="text-sm">Show Axis Labels</span>
                        <input
                            type="checkbox"
                            checked={currentState.settings.showLabels}
                            onChange={(e) => updateSettings({ showLabels: e.target.checked })}
                            className="rounded"
                        />
                    </label>
                </div>
            </div>

            {/* Axis labels */}
            <div>
                <h5 className="font-medium text-gray-800 mb-3">Axis Labels</h5>
                <div className="space-y-2">
                    <div>
                        <label className="block text-sm font-medium mb-1">Y-Axis Label</label>
                        <input
                            type="text"
                            value={currentState.settings.yAxisLabel}
                            onChange={(e) => updateSettings({ yAxisLabel: e.target.value })}
                            className="w-full p-2 border rounded text-sm"
                        />
                    </div>
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
                disabled={!histogram}
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
                        const containerWidth = containerRef.current.parentElement?.clientWidth || width || 600;
                        const settingsPanelWidth = isOpen ? 300 : 0;
                        const availableWidth = containerWidth - settingsPanelWidth - 40; // 40px for padding

                        const newDimensions = {
                            width: Math.max(availableWidth, 250), // Minimum width for plot
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

export default HistogramComponent;