import React, { useEffect, useRef, useState } from 'react';
import { Histogram, HistogramParameters } from './Histogram';
import { Download, RotateCcw, BarChart3, TrendingUp, Layers } from 'lucide-react';
import StablePlotWithSettings from '../PlotWithSettings';

import {
    BaseVisualizationProps,
    useVisualizationState,
    DataExporter,
    ColorInput
} from '../VisualizationStateSystem';
import { createHistogramSettings, HistogramCompState } from './HistogramParameters';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

interface AvailableDataType {
    key: string;
    dataType: string;
    availableInFiles: string[];
    enabled: boolean;
}

function getAvailableDataTypes(files: any[]): AvailableDataType[] {
    const available: AvailableDataType[] = [];
    const dataTypeMap = new Map<string, string[]>();

    files.forEach(file => {
        const fileData = file.data || file.content;
        if (!fileData || fileData.length === 0) return;

        fileData.forEach((row: any) => {
            if (row.type) {
                const type = row.type;
                if (!dataTypeMap.has(type)) {
                    dataTypeMap.set(type, []);
                }
                if (!dataTypeMap.get(type)!.includes(file.id)) {
                    dataTypeMap.get(type)!.push(file.id);
                }
            }
        });
    });

    dataTypeMap.forEach((fileIds, dataType) => {
        available.push({
            key: dataType,
            dataType: dataType,
            availableInFiles: fileIds,
            enabled: false
        });
    });

    return available;
}

function getAvailableColumns(files: any[], selectedFiles: string[]): string[] {
    const columns = new Set<string>();

    files
        .filter(file => selectedFiles.includes(file.id))
        .forEach(file => {
            const headers = file.headers?.map((h: string) => h) || [];
            headers.forEach(header => columns.add(header));
        });

    return Array.from(columns).sort();
}

// ============================================================================
// HISTOGRAM COMPONENT
// ============================================================================

const HistogramComponent: React.FC<BaseVisualizationProps<HistogramCompState>> = ({
    files,
    width = 600,
    height = 500,
    title = "Data Histogram",
    state,
    onStateChange,
    onDimensionChange
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [histogram, setHistogram] = React.useState<Histogram | null>(null);
    const [dataStats, setDataStats] = React.useState<any>(null);
    const [showDataPanel, setShowDataPanel] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
    const [availableDataTypes, setAvailableDataTypes] = useState<AvailableDataType[]>([]);
    const [availableColumnsLocal, setAvailableColumnsLocal] = useState<string[]>([]);

    // Initialize selected files when files change
    useEffect(() => {
        if (!files || files.length === 0) {
            setSelectedFiles([]);
            setAvailableDataTypes([]);
            setAvailableColumnsLocal([]);
            return;
        }

        // Select all files by default
        const fileIds = files.map(f => f.id);
        setSelectedFiles(fileIds);

        // Update available data types
        const dataTypes = getAvailableDataTypes(files);
        setAvailableDataTypes(dataTypes);
    }, [files]);

    // Update available columns when files or data types change
    useEffect(() => {
        if (!files || files.length === 0) {
            setAvailableColumnsLocal([]);
            return;
        }

        const columns = getAvailableColumns(files, selectedFiles);
        setAvailableColumnsLocal(columns);

        // Auto-select first column if none selected or current selection is invalid
        if (columns.length > 0 && (!currentState.selectedColumn || !columns.includes(currentState.selectedColumn))) {
            updateSelectedColumn(columns[0]);
        } else if (columns.length === 0) {
            updateSelectedColumn('');
        }
    }, [files, selectedFiles]);

    // Handlers for file and data type selection
    const toggleFileSelection = (fileId: string) => {
        setSelectedFiles(prev =>
            prev.includes(fileId)
                ? prev.filter(id => id !== fileId)
                : [...prev, fileId]
        );
    };

    const toggleDataType = (key: string) => {
        setAvailableDataTypes(prev =>
            prev.map(dt =>
                dt.key === key ? { ...dt, enabled: !dt.enabled } : dt
            )
        );
    };

    // Use the factorized visualization state hook
    const {
        state: currentState,
        updateSettings,
        updateSelectedColumn,
        updatePlotDimensions,
        toggleSettingsPanel,
        resetToDefaults
    } = useVisualizationState<HistogramCompState>(
        'histogram',
        createHistogramSettings(),
        files,
        width,
        height,
        state,
        onStateChange
    );

    // Sync dimensions from props - only update if actually changed
    useEffect(() => {
        if (width > 0 && height > 0) {
            const currentWidth = currentState.plotDimensions.width;
            const currentHeight = currentState.plotDimensions.height;
            if (currentWidth !== width || currentHeight !== height) {
                updatePlotDimensions({ width, height });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [width, height]);

    // Initialize and update histogram
    useEffect(() => {
        if (!containerRef.current || !currentState.selectedColumn) return;

        // Use available space, accounting for dataStats panel (~80px) and padding
        const statsHeight = dataStats ? 80 : 0;
        const effectiveWidth = Math.max(currentState.plotDimensions.width - 32, 200);
        const effectiveHeight = Math.max(currentState.plotDimensions.height - statsHeight - 32, 150);

        const params: HistogramParameters = {
            width: effectiveWidth,
            height: effectiveHeight,
            bins: currentState.settings.bins,
            fillColor: currentState.settings.fillColor,
            strokeColor: currentState.settings.strokeColor,
            title: title,
            xAxisLabel: currentState.selectedColumn,
            yAxisLabel: currentState.settings.yAxisLabel,
            draw: {
                grid: currentState.settings.showGrid,
                density: currentState.settings.showDensity,
                labels: currentState.settings.showLabels,
                axes: true
            }
        };

        const newHistogram = new Histogram(containerRef.current, [], params);
        setHistogram(newHistogram);
    }, [
        currentState.plotDimensions,
        currentState.settings.bins,
        currentState.settings.fillColor,
        currentState.settings.strokeColor,
        currentState.settings.showGrid,
        currentState.settings.showDensity,
        currentState.settings.showLabels,
        currentState.selectedColumn,
        title
    ]);

    // Update histogram when data changes
    useEffect(() => {
        if (!histogram || !files || files.length === 0 || !currentState.selectedColumn) {
            if (histogram) histogram.data = [];
            return;
        }

        const allData: number[] = [];

        const enabledDataTypes = availableDataTypes
            .filter(dt => dt.enabled)
            .map(dt => dt.dataType);

        // Get relevant files (those that are selected)
        const relevantFiles = files.filter(f => selectedFiles.includes(f.id));

        relevantFiles.forEach(file => {
            const fileData = file.data || file.content;
            if (!fileData || fileData.length === 0) return;

            fileData.forEach((row: any) => {
                // Filter by data type if any are enabled
                const passesTypeFilter = enabledDataTypes.length === 0 ||
                    enabledDataTypes.includes(row.type);

                if (passesTypeFilter) {
                    const value = parseFloat(row[currentState.selectedColumn]);
                    if (!isNaN(value)) {
                        allData.push(value);
                    }
                }
            });
        });

        // Update histogram with data
        if (allData.length > 0) {
            histogram.data = allData;
            const stats = histogram.getStatistics();
            setDataStats(stats);
        } else {
            histogram.data = [];
            setDataStats(null);
        }
    }, [histogram, files, selectedFiles, availableDataTypes, currentState.selectedColumn]);

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
        <div className="flex flex-col h-full overflow-hidden">
            {/* Histogram container - takes remaining space */}
            <div className="flex-1 min-h-0 overflow-auto">
                <div
                    ref={containerRef}
                    className="w-full h-full border rounded-lg bg-white shadow-sm flex items-center justify-center"
                />
            </div>

            {/* Data stats summary - fixed at bottom */}
            {dataStats && (
                <div className="flex-shrink-0 p-3 bg-gray-50 rounded-lg mt-2 text-xs">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <h4 className="font-semibold text-sm">Data Summary</h4>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        <div>
                            <span className="font-medium">Count:</span> {dataStats.count}
                        </div>
                        <div>
                            <span className="font-medium">Mean:</span> {dataStats.mean?.toFixed(3)}
                        </div>
                        <div>
                            <span className="font-medium">Median:</span> {dataStats.median?.toFixed(3)}
                        </div>
                        <div>
                            <span className="font-medium">Std Dev:</span> {dataStats.stdDev?.toFixed(3)}
                        </div>
                        <div>
                            <span className="font-medium">Min:</span> {dataStats.min?.toFixed(3)}
                        </div>
                        <div>
                            <span className="font-medium">Q1:</span> {dataStats.q1?.toFixed(3)}
                        </div>
                        <div>
                            <span className="font-medium">Q3:</span> {dataStats.q3?.toFixed(3)}
                        </div>
                        <div>
                            <span className="font-medium">Max:</span> {dataStats.max?.toFixed(3)}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // Data selection panel (left panel)
    const dataSelectionPanel = (
        <div className="space-y-4">
            {/* Files to Plot */}
            <div>
                <h4 className="font-medium text-gray-800 mb-2">Files to Plot</h4>
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                    {files && files.map(file => (
                        <label key={file.id} className="flex items-center justify-between py-1">
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={selectedFiles.includes(file.id)}
                                    onChange={() => toggleFileSelection(file.id)}
                                    className="mr-2"
                                />
                                <span className="text-sm">
                                    {file.name} ({(file.data || file.content)?.length || 0} rows)
                                </span>
                            </div>
                        </label>
                    ))}
                </div>
            </div>

            {/* Data Types to Plot */}
            <div>
                <h4 className="font-medium text-gray-800 mb-2">Data Types to Plot</h4>
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                    {availableDataTypes.map(dataType => (
                        <label key={dataType.key} className="flex items-center justify-between py-1">
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={dataType.enabled}
                                    onChange={() => toggleDataType(dataType.key)}
                                    className="mr-2"
                                />
                                <span className="text-sm">{dataType.dataType}</span>
                            </div>
                        </label>
                    ))}
                    {availableDataTypes.length === 0 && (
                        <p className="text-sm text-gray-500 italic">
                            No data types found in selected files
                        </p>
                    )}
                </div>
            </div>

            {/* Column to Plot */}
            <div>
                <h4 className="font-medium text-gray-800 mb-2">Column to Plot</h4>
                <div className="border rounded-lg p-3">
                    {availableColumnsLocal.length > 0 ? (
                        <select
                            value={currentState.selectedColumn}
                            onChange={(e) => updateSelectedColumn(e.target.value)}
                            className="w-full p-2 border rounded text-sm"
                        >
                            <option value="">-- Select a column --</option>
                            {availableColumnsLocal.map((col, index) => (
                                <option key={index} value={col}>
                                    {col}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <p className="text-sm text-gray-500 italic">
                            No columns available in selected files
                        </p>
                    )}
                </div>
            </div>
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
        </div>
    );

    return (
        <StablePlotWithSettings
            title={title}
            leftPanel={dataSelectionPanel}
            settingsPanel={settingsContent}
            borderColor="#d1d5db"
            borderWidth={1}
            settingsPanelWidth={300}
            leftPanelWidth={280}
            initialSettingsOpen={currentState.open}
            initialLeftPanelOpen={showDataPanel}
            showLeftPanelButton={true}
            leftPanelButtonIcon={<Layers size={16} />}
            onLeftPanelToggle={(isOpen) => {
                setShowDataPanel(isOpen);
            }}
            onSettingsToggle={() => {
                toggleSettingsPanel();
                // Dimensions are now automatically synced via useEffect
            }}
        >
            {plotContent}
        </StablePlotWithSettings>
    );
};

export default HistogramComponent;