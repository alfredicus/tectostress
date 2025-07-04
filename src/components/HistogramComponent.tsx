import React, { useEffect, useRef, useState } from 'react';
import { Histogram, HistogramParameters } from './views/Histogram';
import { DataFiles } from './DataFile';
import { Download, Settings, BarChart3, TrendingUp } from 'lucide-react';

interface HistogramComponentProps {
    files: DataFiles;
    width?: number;
    height?: number;
    title?: string;
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
    title = "Data Histogram"
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [histogram, setHistogram] = useState<Histogram | null>(null);
    const [showSettings, setShowSettings] = useState(true);
    const [statistics, setStatistics] = useState<StatisticalSummary | null>(null);

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

        const params: HistogramParameters = {
            width,
            height,
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
    }, [selectedColumn, settings, width, height, title, availableColumns]);

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

    const getSelectedColumnInfo = () => {
        return availableColumns.find(col =>
            `${col.fileId}::${col.columnIndex}` === selectedColumn
        );
    };

    return (
        <div className="flex gap-4 h-full">
            {/* Main histogram container */}
            <div className="flex-1 min-h-0">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-blue-600" />
                        <h3 className="text-lg font-semibold">Histogram</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={exportData}
                            disabled={!histogram}
                            className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                            <Download className="w-4 h-4" />
                            Export
                        </button>
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${showSettings
                                    ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                                    : 'bg-gray-100 hover:bg-gray-200'
                                }`}
                        >
                            <Settings className="w-4 h-4" />
                            Settings
                        </button>
                    </div>
                </div>

                {/* Column selector */}
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Select Data Column</label>
                    <select
                        value={selectedColumn}
                        onChange={(e) => setSelectedColumn(e.target.value)}
                        className="w-full p-2 border rounded bg-white"
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
                <div
                    ref={containerRef}
                    className="w-full border rounded-lg bg-white shadow-sm"
                    style={{ height: `${height}px` }}
                />

                {/* Statistics summary */}
                {statistics && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
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

            {/* Settings panel */}
            {showSettings && (
                <div className="w-80 bg-gray-100 p-4 rounded-lg shadow">
                    <h4 className="font-semibold mb-4">Histogram Settings</h4>

                    <div className="space-y-4">
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

                        {/* Fill color */}
                        <div>
                            <label className="block text-sm font-medium mb-1">Fill Color</label>
                            <input
                                type="color"
                                value={settings.fillColor}
                                onChange={(e) => handleSettingChange('fillColor', e.target.value)}
                                className="w-full h-8 rounded border"
                            />
                        </div>

                        {/* Stroke color */}
                        <div>
                            <label className="block text-sm font-medium mb-1">Border Color</label>
                            <input
                                type="color"
                                value={settings.strokeColor}
                                onChange={(e) => handleSettingChange('strokeColor', e.target.value)}
                                className="w-full h-8 rounded border"
                            />
                        </div>

                        {/* Display options */}
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

                        {/* Axis labels */}
                        <div>
                            <label className="block text-sm font-medium mb-1">Y-Axis Label</label>
                            <input
                                type="text"
                                value={settings.yAxisLabel}
                                onChange={(e) => handleSettingChange('yAxisLabel', e.target.value)}
                                className="w-full p-2 border rounded"
                            />
                        </div>

                        {/* Column info */}
                        {getSelectedColumnInfo() && (
                            <div className="mt-6 p-3 bg-white rounded border">
                                <h5 className="font-medium mb-2">Column Info</h5>
                                <div className="text-sm space-y-1">
                                    <div><strong>File:</strong> {getSelectedColumnInfo()?.fileName}</div>
                                    <div><strong>Column:</strong> {getSelectedColumnInfo()?.columnName}</div>
                                    <div><strong>Sample values:</strong> {getSelectedColumnInfo()?.sampleValues.slice(0, 3).join(', ')}...</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default HistogramComponent;