import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RoseDiagram } from './views/RoseDiagram';
import { DataFiles } from './DataFile';
import { Download, RotateCcw, Navigation } from 'lucide-react';
import StablePlotWithSettings from './PlotWithSettings';
import { VisualizationState } from './types';

/**
 * State interface for the Rose Diagram visualization.
 * This defines the structure of the state used to manage the rose diagram's settings,
 * selected column, dimensions, and whether the settings panel is open.
 * 
 * This state is used to render the rose diagram and manage user interactions.
 * It allows users to customize the appearance and behavior of the diagram,
 * such as changing the bin angle, colors, and whether to show labels or cardinals.
 * The selected column determines which data is visualized in the rose diagram.
 * The plot dimensions define the size of the diagram area.
 * The settings panel can be toggled open or closed to allow users to adjust settings.
 */
interface RoseDiagramVisualizationState extends VisualizationState {
    type: 'rose';
    settings: {
        binAngle: number;
        binColor: string;
        lineColor: string;
        showLines: boolean;
        is360: boolean;
        showLabels: boolean;
        showCardinals: boolean;
        showCircles: boolean;
        innerRadius: number;
    };
    selectedColumn: string;
    plotDimensions: {
        width: number;
        height: number;
    };
    settingsPanelOpen: boolean;
}

/**
 * Props interface for the RoseDiagramComponent.
 * This defines the properties that can be passed to the component,
 * including the data files, dimensions, title, and state management functions.
 * 
 * The component expects a list of data files, each containing headers and content.
 * It allows customization of the diagram's width, height, and title.
 * The state prop is used to restore previous settings, and onStateChange is called
 * whenever the state changes to notify the parent component.
 */
interface RoseDiagramComponentProps {
    files: DataFiles;
    width?: number;
    height?: number;
    title?: string;
    state?: RoseDiagramVisualizationState;
    onStateChange?: (state: RoseDiagramVisualizationState) => void;
    onDimensionChange?: (newWidth: number, newHeight: number) => void;
}

/**
 * Interface for data column information.
 * This defines the structure of each column's metadata,
 * including the file it belongs to, its name, index, data type, and sample values.
 * 
 * This information is used to populate the column selector in the rose diagram component,
 * allowing users to choose which data column to visualize.
 */
interface DataColumnInfo {
    fileName: string;
    fileId: string;
    columnName: string;
    columnIndex: number;
    dataType: 'number' | 'string';
    sampleValues: any[];
}

/**
 * Interface for data information.
 */
interface DataInfo {
    filename: string;
    nbData: number;
    min: number;
    max: number;
}

/**
 * 
 * @param param0 - The props for the RoseDiagramComponent.
 * @param param0.files - The data files containing the headers and content to visualize.
 * @param param0.width - The width of the rose diagram (default is 400).
 * @param param0.height - The height of the rose diagram (default is 400).
 * @param param0.title - The title of the rose diagram (default is "Rose Diagram").
 * @param param0.state - The initial state to restore settings from.
 * @param param0.onStateChange - Callback function to notify parent component of state changes.
 * @param param0.onDimensionChange - Callback function to notify parent component of dimension changes.
 * 
 * This component renders a rose diagram based on the provided data files.
 * It allows users to select a column of angles, customize the appearance of the diagram,
 * and view data summaries. The component manages its own state and notifies the parent
 * component of any changes to the settings or dimensions.
 */
const RoseDiagramComponent: React.FC<RoseDiagramComponentProps> = ({
    files,
    width = 400,
    height = 400,
    title = "Rose Diagram",
    state,
    onStateChange,
    onDimensionChange
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [rose, setRose] = useState<RoseDiagram | null>(null);
    
    // Initialize from state prop if available
    const [plotDimensions, setPlotDimensions] = useState(() => {
        if (state?.plotDimensions) {
            return state.plotDimensions;
        }
        return { width, height };
    });

    // Available columns from files
    const [availableColumns, setAvailableColumns] = useState<DataColumnInfo[]>([]);
    const [selectedColumn, setSelectedColumn] = useState(() => {
        return state?.selectedColumn || '';
    });

    // Settings panel state
    const [settingsPanelOpen, setSettingsPanelOpen] = useState(() => {
        return state?.settingsPanelOpen || false;
    });

    // Data info state
    const [dataInfo, setDataInfo] = useState<DataInfo>({
        filename: '',
        nbData: 0,
        min: 0,
        max: 0,
    });

    // Rose diagram settings - initialize from state prop if available
    const [settings, setSettings] = useState(() => {
        if (state?.settings) {
            return state.settings;
        }
        return {
            binAngle: 10,
            binColor: '#FF0000',
            lineColor: '#000000',
            showLines: true,
            is360: false,
            showLabels: false,
            showCardinals: true,
            showCircles: true,
            innerRadius: 5,
        };
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

        // Auto-select first numeric column only if no column is selected and no state was restored
        if (columns.length > 0 && !selectedColumn && !state?.selectedColumn) {
            const firstColumn = `${columns[0].fileId}::${columns[0].columnIndex}`;
            setSelectedColumn(firstColumn);
        }
    }, [files, state?.selectedColumn]);

    // Create a function to serialize current state
    const serializeCurrentState = useCallback((): RoseDiagramVisualizationState => {
        return {
            type: 'rose',
            settings,
            selectedColumn,
            plotDimensions,
            settingsPanelOpen
        };
    }, [settings, selectedColumn, plotDimensions, settingsPanelOpen]);

    // Notify parent of state changes
    const notifyStateChange = useCallback(() => {
        if (onStateChange) {
            const currentState = serializeCurrentState();
            onStateChange(currentState);
        }
    }, [serializeCurrentState, onStateChange]);

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

    const updateDataInfo = (filename: string, data: number[]) => {
        if (data.length === 0) {
            setDataInfo({
                filename,
                nbData: 0,
                min: 0,
                max: 0,
            });
            return;
        }

        setDataInfo({
            filename,
            nbData: data.length,
            min: Math.min(...data),
            max: Math.max(...data),
        });
    };

    // Initialize and update rose diagram
    useEffect(() => {
        if (!containerRef.current) return;

        const data = getSelectedColumnData();
        
        // Use sample data if no data is available
        const finalData = data.length > 0 ? data : new Array(100).fill(0).map(() => Math.random() * 180);

        const selectedColumnInfo = availableColumns.find(col =>
            `${col.fileId}::${col.columnIndex}` === selectedColumn
        );

        // Calculate effective dimensions - leave space for margins
        const effectiveWidth = Math.max(plotDimensions.width - 40, 300);
        const effectiveHeight = Math.max(plotDimensions.height - 40, 300);

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
                width: effectiveWidth,
                height: effectiveHeight,
                draw: {
                    labels: settings.showLabels,
                    circles: settings.showCircles,
                    binBorder: settings.showLines,
                    cardinals: settings.showCardinals
                },
                is360: settings.is360,
                innerR: settings.innerRadius,
                deltaAngle: settings.binAngle,
                fillColor: settings.binColor,
                lineColor: settings.lineColor,
            });

            setRose(newRose);

            // Update data info
            updateDataInfo(
                selectedColumnInfo?.fileName || 'Sample data',
                finalData
            );
        }

        return () => {
            // Cleanup if needed
        };
    }, [selectedColumn, settings, plotDimensions, availableColumns]);

    // Trigger state notification when key state values change
    useEffect(() => {
        // Only notify if onStateChange is available and we have meaningful state
        if (onStateChange && (selectedColumn || Object.keys(settings).length > 0)) {
            notifyStateChange();
        }
    }, [settings, selectedColumn, plotDimensions, settingsPanelOpen, notifyStateChange, onStateChange]);

    const handleSettingChange = (setting: string, value: any) => {
        setSettings(prev => {
            const newSettings = { ...prev, [setting]: value };
            
            // Trigger state notification after state update
            setTimeout(() => notifyStateChange(), 0);
            
            return newSettings;
        });
    };

    const handleColumnChange = (newColumn: string) => {
        setSelectedColumn(newColumn);
        
        // Trigger state notification after state update
        setTimeout(() => notifyStateChange(), 0);
    };

    const handleSettingsPanelToggle = (isOpen: boolean) => {
        setSettingsPanelOpen(isOpen);
        
        // Trigger state notification after state update
        setTimeout(() => notifyStateChange(), 0);
    };

    const exportData = () => {
        if (!rose) return;

        const data = getSelectedColumnData();
        if (data.length === 0) return;

        // Create CSV with raw data
        let csv = 'Angle\n';
        data.forEach(angle => {
            csv += `${angle}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'rose_diagram_data.csv';
        link.click();
        URL.revokeObjectURL(url);
    };

    const resetView = () => {
        // Reset to default settings
        const defaultSettings = {
            binAngle: 10,
            binColor: '#FF0000',
            lineColor: '#000000',
            showLines: true,
            is360: false,
            showLabels: false,
            showCardinals: true,
            showCircles: true,
            innerRadius: 5,
        };
        
        setSettings(defaultSettings);
        
        // Trigger state notification after state update
        setTimeout(() => notifyStateChange(), 0);
    };

    const getSelectedColumnInfo = () => {
        return availableColumns.find(col =>
            `${col.fileId}::${col.columnIndex}` === selectedColumn
        );
    };

    // Main plot content
    const plotContent = (
        <div className="flex flex-col h-full">
            {/* Column selector */}
            <div className="mb-4 flex-shrink-0">
                <label className="block text-sm font-medium mb-2">Select Data Column (Angles)</label>
                <select
                    value={selectedColumn}
                    onChange={(e) => handleColumnChange(e.target.value)}
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
                        <span className="font-medium">File:</span> {dataInfo.filename || 'None'}
                    </div>
                    <div>
                        <span className="font-medium">Count:</span> {dataInfo.nbData}
                    </div>
                    <div>
                        <span className="font-medium">Min:</span> {dataInfo.min.toFixed(2)}°
                    </div>
                    <div>
                        <span className="font-medium">Max:</span> {dataInfo.max.toFixed(2)}°
                    </div>
                </div>
            </div>
        </div>
    );

    // Settings panel content
    const settingsContent = (
        <div className="space-y-4">
            {/* Bin settings */}
            <div>
                <h5 className="font-medium text-gray-800 mb-3">Bin Settings</h5>
                <div className="space-y-3">
                    {/* Bin angle */}
                    <div>
                        <label className="block text-sm font-medium mb-1">Bin Angle</label>
                        <select
                            value={settings.binAngle}
                            onChange={(e) => handleSettingChange('binAngle', parseInt(e.target.value))}
                            className="w-full p-2 border rounded text-sm"
                        >
                            {[2, 3, 5, 6, 10, 15, 30].map(angle => (
                                <option key={angle} value={angle}>{angle}°</option>
                            ))}
                        </select>
                    </div>

                    {/* Bin color */}
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700 min-w-[80px]">Bin Color:</label>
                        <input
                            type="color"
                            value={settings.binColor}
                            onChange={(e) => handleSettingChange('binColor', e.target.value)}
                            className="w-8 h-6 border border-gray-300 rounded cursor-pointer"
                        />
                        <span className="text-xs text-gray-500">{settings.binColor}</span>
                    </div>
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
                                checked={settings.showLines}
                                onChange={(e) => handleSettingChange('showLines', e.target.checked)}
                                className="rounded"
                            />
                            <input
                                type="color"
                                value={settings.lineColor}
                                onChange={(e) => handleSettingChange('lineColor', e.target.value)}
                                className="w-6 h-5 border rounded cursor-pointer"
                                disabled={!settings.showLines}
                            />
                        </div>
                    </label>

                    <label className="flex items-center justify-between">
                        <span className="text-sm">Use 360° mode</span>
                        <input
                            type="checkbox"
                            checked={settings.is360}
                            onChange={(e) => handleSettingChange('is360', e.target.checked)}
                            className="rounded"
                        />
                    </label>

                    <label className="flex items-center justify-between">
                        <span className="text-sm">Show frequency labels</span>
                        <input
                            type="checkbox"
                            checked={settings.showLabels}
                            onChange={(e) => handleSettingChange('showLabels', e.target.checked)}
                            className="rounded"
                        />
                    </label>

                    <label className="flex items-center justify-between">
                        <span className="text-sm">Show cardinals (N,E,S,W)</span>
                        <input
                            type="checkbox"
                            checked={settings.showCardinals}
                            onChange={(e) => handleSettingChange('showCardinals', e.target.checked)}
                            className="rounded"
                        />
                    </label>

                    <label className="flex items-center justify-between">
                        <span className="text-sm">Show concentric circles</span>
                        <input
                            type="checkbox"
                            checked={settings.showCircles}
                            onChange={(e) => handleSettingChange('showCircles', e.target.checked)}
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
                        Inner Radius: {settings.innerRadius}
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={settings.innerRadius}
                        onChange={(e) => handleSettingChange('innerRadius', parseInt(e.target.value))}
                        className="w-full"
                    />
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
            title="Rose Diagram"
            settingsPanel={settingsContent}
            headerActions={headerActions}
            borderColor="#d1d5db"
            borderWidth={1}
            settingsPanelWidth={300}
            initialSettingsOpen={settingsPanelOpen}
            onSettingsToggle={(isOpen) => {
                // Handle settings panel toggle
                handleSettingsPanelToggle(isOpen);
                
                // When settings panel opens/closes, adjust the plot dimensions
                // but do NOT change the parent container size
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
                        
                        setPlotDimensions(newDimensions);
                        
                        // Trigger state notification after dimension update
                        setTimeout(() => notifyStateChange(), 0);
                    }
                }, 150);
            }}
        >
            {plotContent}
        </StablePlotWithSettings>
    );
};

export default RoseDiagramComponent;