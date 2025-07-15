import React, { useEffect, useRef, useState } from 'react';
import { Histogram, HistogramParameters } from './views/Histogram';
import { DataFiles } from './DataFile';
import { Download, RotateCcw, BarChart3, TrendingUp } from 'lucide-react';
import StablePlotWithSettings from './PlotWithSettings';

interface HistogramComponentProps {
    files: DataFiles;
    width?: number;
    height?: number;
    title?: string;
    onDimensionChange?: (newWidth: number, newHeight: number) => void;
}

interface DataColumnInfo {
    fileName: string;
    fileId: string;
    columnName: string;
    columnIndex: number;
    dataType: 'number' | 'string';
    sampleValues: any[];
}

interface StatisticalSummary {
    count: number;
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
    q1: number;
    q3: number;
}

const HistogramComponent: React.FC<HistogramComponentProps> = ({
    files,
    width = 600,
    height = 400,
    title = "Data Histogram",
    onDimensionChange
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [histogram, setHistogram] = useState<Histogram | null>(null);
    const [statistics, setStatistics] = useState<StatisticalSummary | null>(null);
    const [plotDimensions, setPlotDimensions] = useState({ width, height });

    // Available columns from files
    const [availableColumns, setAvailableColumns] = useState<DataColumnInfo[]>([]);
    const [selectedColumn, setSelectedColumn] = useState<string>('');

    // Histogram settings
    const [settings, setSettings] = useState({
        bins: 20,
        fillColor: '#3498db',
        strokeColor: '#2c3e50',
        showGrid: true,
        showDensity: false,
        showLabels: true,
        xAxisLabel: 'Value',
        yAxisLabel: 'Frequency'
    });

    // Extract numeric columns from files
    useEffect(() => {
        const columns: DataColumnInfo[] = [];

        files.forEach(file => {
            file.headers.forEach((header, index) => {
                if (index !== 0) {
                    // Sample a few values to determine if column is numeric
                    const sampleValues = file.content.slice(0, 10).map(row => {
                        if (Array.isArray(row)) {
                            return row[index];
                        } else {
                            return row[header];
                        }
                    }).filter(val => val !== undefined && val !== null);

                    const numericValues = sampleValues.filter(val => {
                        const num = Number(val);
                        return !isNaN(num) && isFinite(num);
                    });

                    // Consider column numeric if at least 70% of sample values are numeric
                    const isNumeric = numericValues.length / sampleValues.length >= 0.7;

                    if (isNumeric && sampleValues.length > 0) {
                        columns.push({
                            fileName: file.name,
                            fileId: file.id,
                            columnName: header,
                            columnIndex: index,
                            dataType: 'number',
                            sampleValues: numericValues
                        });
                    }
                }
            });
        });

        setAvailableColumns(columns);

        // Auto-select first numeric column
        if (columns.length > 0 && !selectedColumn) {
            setSelectedColumn(`${columns[0].fileId}::${columns[0].columnIndex}`);
        }
    }, [files]);

    // Extract data for selected column
    const getSelectedColumnData = (): number[] => {
        if (!selectedColumn) return [];

        const [fileId, columnIndexStr] = selectedColumn.split('::');
        const columnIndex = parseInt(columnIndexStr);

        const file = files.find(f => f.id === fileId);
        if (!file) return [];

        const data: number[] = [];

        file.content.forEach(row => {
            let value;
            if (Array.isArray(row)) {
                value = row[columnIndex];
            } else {
                const header = file.headers[columnIndex];
                value = row[header];
            }

            const num = Number(value);
            if (!isNaN(num) && isFinite(num)) {
                data.push(num);
            }
        });

        return data;
    };

    // Initialize and update histogram
    useEffect(() => {
        if (!containerRef.current) return;

        const data = getSelectedColumnData();
        if (data.length === 0) return;

        const selectedColumnInfo = availableColumns.find(col =>
            `${col.fileId}::${col.columnIndex}` === selectedColumn
        );

        // Calculate effective dimensions - leave space for margins and statistics
        const effectiveWidth = Math.max(plotDimensions.width - 40, 300);
        const effectiveHeight = Math.max(plotDimensions.height - 120, 200); // Leave space for statistics

        const params: HistogramParameters = {
            width: effectiveWidth,
            height: effectiveHeight,
            bins: settings.bins,
            fillColor: settings.fillColor,
            strokeColor: settings.strokeColor,
            title: title,
            xAxisLabel: selectedColumnInfo ? selectedColumnInfo.columnName : settings.xAxisLabel,
            yAxisLabel: settings.yAxisLabel,
            draw: {
                grid: settings.showGrid,
                density: settings.showDensity,
                labels: settings.showLabels,
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
    }, [selectedColumn, settings, plotDimensions, title, availableColumns]);

    // Update histogram when data changes
    useEffect(() => {
        if (!histogram) return;

        const data = getSelectedColumnData();
        if (data.length > 0) {
            histogram.data = data;
            const stats = histogram.getStatistics();
            setStatistics(stats);
        }
    }, [histogram, selectedColumn]);

    const handleSettingChange = (setting: string, value: any) => {
        setSettings(prev => ({ ...prev, [setting]: value }));
    };

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

    const resetView = () => {
        if (!histogram) return;
        
        // Reset to default settings
        setSettings({
            bins: 20,
            fillColor: '#3498db',
            strokeColor: '#2c3e50',
            showGrid: true,
            showDensity: false,
            showLabels: true,
            xAxisLabel: 'Value',
            yAxisLabel: 'Frequency'
        });
    };

    const getSelectedColumnInfo = () => {
        return availableColumns.find(col =>
            `${col.fileId}::${col.columnIndex}` === selectedColumn
        );
    };

    // Helper components for settings
    const ColorInput: React.FC<{
        value: string;
        onChange: (value: string) => void;
        label: string;
    }> = ({ value, onChange, label }) => (
        <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 min-w-[80px]">{label}:</label>
            <input
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-8 h-6 border border-gray-300 rounded cursor-pointer"
            />
            <span className="text-xs text-gray-500">{value}</span>
        </div>
    );

    const NumberInput: React.FC<{
        value: number;
        onChange: (value: number) => void;
        label: string;
        min?: number;
        max?: number;
        step?: number;
    }> = ({ value, onChange, label, min = 0, max = 100, step = 1 }) => (
        <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 min-w-[80px]">{label}:</label>
            <input
                type="number"
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                min={min}
                max={max}
                step={step}
                className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>
    );

    // Main plot content
    const plotContent = (
        <div className="flex flex-col h-full">
            {/* Column selector */}
            <div className="mb-4 flex-shrink-0">
                <label className="block text-sm font-medium mb-2">Select Data Column</label>
                <select
                    value={selectedColumn}
                    onChange={(e) => setSelectedColumn(e.target.value)}
                    className="w-full p-2 border rounded bg-white text-sm"
                >
                    <option value="">Choose a column...</option>
                    {availableColumns.map(col => (
                        <option
                            key={`${col.fileId}::${col.columnIndex}`}
                            value={`${col.fileId}::${col.columnIndex}`}
                        >
                            {col.fileName} → {col.columnName}
                        </option>
                    ))}
                </select>
            </div>

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
                            Number of Bins: {settings.bins}
                        </label>
                        <input
                            type="range"
                            min="5"
                            max="50"
                            value={settings.bins}
                            onChange={(e) => handleSettingChange('bins', parseInt(e.target.value))}
                            className="w-full"
                        />
                    </div>

                    {/* Colors */}
                    <ColorInput
                        value={settings.fillColor}
                        onChange={(value) => handleSettingChange('fillColor', value)}
                        label="Fill Color"
                    />

                    <ColorInput
                        value={settings.strokeColor}
                        onChange={(value) => handleSettingChange('strokeColor', value)}
                        label="Border Color"
                    />
                </div>
            </div>

            {/* Display options */}
            <div>
                <h5 className="font-medium text-gray-800 mb-3">Display Options</h5>
                <div className="space-y-2">
                    <label className="flex items-center">
                        <input
                            type="checkbox"
                            checked={settings.showGrid}
                            onChange={(e) => handleSettingChange('showGrid', e.target.checked)}
                            className="mr-2"
                        />
                        Show Grid
                    </label>

                    <label className="flex items-center">
                        <input
                            type="checkbox"
                            checked={settings.showDensity}
                            onChange={(e) => handleSettingChange('showDensity', e.target.checked)}
                            className="mr-2"
                        />
                        Show Density Curve
                    </label>

                    <label className="flex items-center">
                        <input
                            type="checkbox"
                            checked={settings.showLabels}
                            onChange={(e) => handleSettingChange('showLabels', e.target.checked)}
                            className="mr-2"
                        />
                        Show Axis Labels
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
                            value={settings.yAxisLabel}
                            onChange={(e) => handleSettingChange('yAxisLabel', e.target.value)}
                            className="w-full p-2 border rounded text-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Column info */}
            {getSelectedColumnInfo() && (
                <div className="border-t pt-4">
                    <h5 className="font-medium text-gray-800 mb-2">Column Info</h5>
                    <div className="p-3 bg-white rounded border">
                        <div className="text-sm space-y-1">
                            <div><strong>File:</strong> {getSelectedColumnInfo()?.fileName}</div>
                            <div><strong>Column:</strong> {getSelectedColumnInfo()?.columnName}</div>
                            <div><strong>Sample values:</strong> {getSelectedColumnInfo()?.sampleValues.slice(0, 3).join(', ')}...</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // Header actions
    const headerActions = (
        <>
            <button
                onClick={resetView}
                className="p-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                title="Reset View"
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
            title="Histogram"
            settingsPanel={settingsContent}
            headerActions={headerActions}
            borderColor="#d1d5db"
            borderWidth={1}
            settingsPanelWidth={300}
            onSettingsToggle={(isOpen) => {
                // When settings panel opens/closes, adjust the plot dimensions
                // but do NOT change the parent container size
                setTimeout(() => {
                    if (containerRef.current) {
                        // Calculate available width for the plot
                        const containerWidth = containerRef.current.parentElement?.clientWidth || width || 600;
                        const settingsPanelWidth = isOpen ? 300 : 0;
                        const availableWidth = containerWidth - settingsPanelWidth - 40; // 40px for padding
                        
                        setPlotDimensions({
                            width: Math.max(availableWidth, 250), // Minimum width for plot
                            height: containerRef.current?.clientHeight || height || 400
                        });
                    }
                }, 150);
            }}
        >
            {plotContent}
        </StablePlotWithSettings>
    );
};

export default HistogramComponent;