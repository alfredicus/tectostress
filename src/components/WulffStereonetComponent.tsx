import React, { useEffect, useRef, useState } from 'react';
import { WulffStereonet, WulffStereonetOptions, StriatedPlaneData, ExtensionFractureData, PoleData, LineData, DataStyle } from './views/WulffStereonet';
import { Download, RotateCcw, Navigation, Layers, Settings } from 'lucide-react';
import StablePlotWithSettings from './PlotWithSettings';
import {
    BaseVisualizationProps,
    useVisualizationState,
    DefaultSettingsFactory,
    DataExporter
} from './VisualizationStateSystem';

// ============================================================================
// DATA TYPE CONFIGURATIONS
// ============================================================================

interface ColumnConfig {
    required: string[];
}

interface RepresentationConfig {
    name: string;
    displayName: string;
    symbol: string;
    defaultColor: string;
}

interface DataTypeConfig {
    displayName: string;
    columns: ColumnConfig[];
    representations: RepresentationConfig[];
}

const DATA_TYPE_CONFIGS: Record<string, DataTypeConfig> = {
    stylolites: {
        displayName: 'Stylolites',
        columns: [
            { required: ['trend', 'plunge'] },
            { required: ['strike', 'dip'] }, // Simplifié - sans dip_direction
            { required: ['dip', 'strike', 'dip_direction'] },
        ],
        representations: [
            {
                name: 'poles',
                displayName: 'Stylolite Poles',
                symbol: '✕',
                defaultColor: '#00ff00'
            },
            {
                name: 'planes',
                displayName: 'Stylolite Planes',
                symbol: '──',
                defaultColor: '#008800'
            }
        ]
    },
    joints: {
        displayName: 'Joints',
        columns: [
            { required: ['trend', 'plunge'] },
            { required: ['strike', 'dip'] }, // Simplifié
            { required: ['dip', 'strike', 'dip_direction'] },
        ],
        representations: [
            {
                name: 'poles',
                displayName: 'Joint Poles',
                symbol: '●',
                defaultColor: '#ff0000'
            },
            {
                name: 'planes',
                displayName: 'Joint Planes',
                symbol: '──',
                defaultColor: '#cc0000'
            }
        ]
    },
    fractures: {
        displayName: 'Fractures',
        columns: [
            { required: ['trend', 'plunge'] },
            { required: ['strike', 'dip'] }, // Simplifié
            { required: ['dip', 'strike', 'dip_direction'] },
        ],
        representations: [
            {
                name: 'poles',
                displayName: 'Fracture Poles',
                symbol: '○',
                defaultColor: '#0066ff'
            },
            {
                name: 'planes',
                displayName: 'Fracture Planes',
                symbol: '──',
                defaultColor: '#0044cc'
            }
        ]
    },
    striated_faults: {
        displayName: 'Striated Faults',
        columns: [
            { required: ['strike', 'dip', 'rake'] },
            { required: ['dip', 'strike', 'dip_direction', 'rake'] },
        ],
        representations: [
            {
                name: 'striated_planes',
                displayName: 'Striated Fault Planes',
                symbol: '→',
                defaultColor: '#ff6600'
            }
        ]
    }
};

// ============================================================================
// COMPONENT STATE AND SETTINGS
// ============================================================================

interface AvailableRepresentation {
    key: string; // dataType_representation
    dataType: string;
    representation: RepresentationConfig;
    availableInFiles: string[]; // file IDs
    enabled: boolean;
    color: string;
    opacity: number;
}

export interface WulffStereonetSettings {
    // Stereonet display options
    showGrid: boolean;
    showDirections: boolean;
    showLabels: boolean;
    gridInterval: number;

    // Grid styling
    gridColor: string;
    gridWidth: number;
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;

    // Selected files
    selectedFiles: string[]; // file IDs

    // Available and selected data representations
    availableRepresentations: AvailableRepresentation[];
}

export interface WulffStereonetCompState {
    selectedColumn: string | null;
    plotDimensions: {
        width: number;
        height: number;
    };
    settings: WulffStereonetSettings;
    open: boolean;
}

// Default settings factory extension
declare module './VisualizationStateSystem' {
    namespace DefaultSettingsFactory {
        function createWulffStereonetSettings(): WulffStereonetSettings;
    }
}

// Extend DefaultSettingsFactory
(DefaultSettingsFactory as any).createWulffStereonetSettings = (): WulffStereonetSettings => ({
    showGrid: true,
    showDirections: true,
    showLabels: true,
    gridInterval: 10,
    gridColor: '#cccccc',
    gridWidth: 1,
    backgroundColor: '#ffffff',
    borderColor: '#000000',
    borderWidth: 2,
    selectedFiles: [],
    availableRepresentations: []
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getAvailableRepresentations(files: any[]): AvailableRepresentation[] {
    const available: AvailableRepresentation[] = [];

    Object.entries(DATA_TYPE_CONFIGS).forEach(([dataType, config]) => {

        // Check if at least one column configuration is available
        const hasValidColumns = config.columns.some(columnConfig => {
            const filesWithColumns = files.filter(file => {
                const hasAllColumns = columnConfig.required.every(col => {
                    const hasColumn = file.headers && file.headers.includes(col);
                    return hasColumn;
                });
                return hasAllColumns;
            });
            return filesWithColumns.length > 0;
        });

        if (hasValidColumns) {
            // Add each representation
            config.representations.forEach(repr => {
                const availableInFiles = files
                    .filter(file =>
                        config.columns.some(columnConfig =>
                            columnConfig.required.every(col =>
                                file.headers && file.headers.includes(col)
                            )
                        )
                    )
                    .map(file => file.id);

                if (availableInFiles.length > 0) {
                    available.push({
                        key: `${dataType}_${repr.name}`,
                        dataType,
                        representation: repr,
                        availableInFiles,
                        enabled: false,
                        color: repr.defaultColor,
                        opacity: 1.0
                    });
                }
            });
        }
    });

    return available;
}

function convertData(row: any, fromColumns: string[], toFormat: 'trend_plunge' | 'strike_dip'): any {
    console.log('Converting data row:', row, 'fromColumns:', fromColumns, 'toFormat:', toFormat);
    // Implementation of coordinate conversion
    if (toFormat === 'trend_plunge') {
        // Convert strike/dip to trend/plunge
        const strike = parseFloat(row.strike || row.Strike);
        const dip = parseFloat(row.dip || row.Dip);

        if (!isNaN(strike) && !isNaN(dip)) {
            // Pole to plane: trend = strike + 90°, plunge = 90° - dip
            const trend = (strike + 90) % 360;
            const plunge = 90 - dip;
            return { trend, plunge };
        }
    } else {
        // Convert trend/plunge to strike/dip
        const trend = parseFloat(row.trend || row.Trend);
        const plunge = parseFloat(row.plunge || row.Plunge);

        if (!isNaN(trend) && !isNaN(plunge)) {
            // Plane from pole: strike = trend - 90°, dip = 90° - plunge
            const strike = (trend - 90 + 360) % 360;
            const dip = 90 - plunge;
            return { strike, dip };
        }
    }

    return null;
}

// ============================================================================
// WULFF STEREONET COMPONENT
// ============================================================================

const WulffStereonetComponent: React.FC<BaseVisualizationProps<WulffStereonetCompState>> = ({
    files,
    width = 600,
    height = 600,
    title = "Wulff Stereonet",
    state,
    onStateChange,
    onDimensionChange
}) => {
    // console.log('WulffStereonetComponent rendered with:', {
    //     filesCount: files?.length || 0,
    //     files: files,
    //     width,
    //     height,
    //     hasState: !!state
    // });

    const containerRef = useRef<HTMLDivElement>(null);
    const [stereonet, setStereonet] = useState<WulffStereonet | null>(null);
    const [dataStats, setDataStats] = useState<any>(null);
    const [showStylePopup, setShowStylePopup] = useState<string | null>(null);

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
    } = useVisualizationState<WulffStereonetCompState>(
        'wulffStereonet',
        (DefaultSettingsFactory as any).createWulffStereonetSettings(),
        files,
        width,
        height,
        state,
        onStateChange
    );

    // Update available representations when files change
    useEffect(() => {
        if (!files || files.length === 0) {
            return;
        }

        const newAvailableRepresentations = getAvailableRepresentations(files);

        updateSettings({
            selectedFiles: files.map(f => f.id),
            availableRepresentations: newAvailableRepresentations
        });
    }, [files, updateSettings]); // Ajouter updateSettings en dépendance

    // Initialize and update stereonet
    useEffect(() => {
        if (!containerRef.current) return;

        // Clear any existing container content
        containerRef.current.innerHTML = '';

        // Create a unique ID for the container
        const containerId = `stereonet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        containerRef.current.id = containerId;

        const effectiveWidth = Math.max(currentState.plotDimensions.width - 40, 300);
        const effectiveHeight = Math.max(currentState.plotDimensions.height - 40, 300);

        // Make it square for better stereonet appearance
        const size = Math.min(effectiveWidth, effectiveHeight);

        const options: WulffStereonetOptions = {
            width: size,
            height: size,
            margin: 50,
            gridInterval: currentState.settings.gridInterval,
            showGrid: currentState.settings.showGrid,
            showDirections: currentState.settings.showDirections,
            showLabels: currentState.settings.showLabels,
            stereonetStyle: {
                gridColor: currentState.settings.gridColor,
                gridWidth: currentState.settings.gridWidth,
                backgroundColor: currentState.settings.backgroundColor,
                borderColor: currentState.settings.borderColor,
                borderWidth: currentState.settings.borderWidth,
                labelColor: '#000000',
                labelSize: '14px'
            }
        };

        const newStereonet = new WulffStereonet(containerId, options);
        setStereonet(newStereonet);

        return () => {
            // Cleanup if needed
        };
    }, [currentState.plotDimensions, currentState.settings.showGrid, currentState.settings.showDirections, currentState.settings.showLabels, currentState.settings.gridInterval, currentState.settings.gridColor, currentState.settings.backgroundColor, currentState.settings.borderColor]);

    // Update data when stereonet or settings change
    useEffect(() => {
        if (!stereonet || !files || files.length === 0) return;

        // Clear existing data
        stereonet.clearData();

        let totalStats = { total: 0, plotted: 0, errors: 0 };

        // Process each enabled representation
        currentState.settings.availableRepresentations
            .filter(repr => repr.enabled)
            .forEach(repr => {
                const relevantFiles = files.filter(f => repr.availableInFiles.includes(f.id));

                relevantFiles.forEach(file => {
                    const fileData = file.data || file.content;
                    if (!fileData || fileData.length === 0) return;

                    const config = DATA_TYPE_CONFIGS[repr.dataType];
                    const processedData = processDataForRepresentation(
                        fileData,
                        config,
                        repr.representation.name,
                        file.headers
                    );

                    totalStats.total += processedData.stats.total;
                    totalStats.plotted += processedData.stats.plotted;
                    totalStats.errors += processedData.stats.errors;

                    if (processedData.data.length > 0) {
                        const dataStyle: DataStyle = {
                            color: repr.color,
                            width: 2,
                            size: 4,
                            opacity: repr.opacity,
                            arrowSize: 15,
                            showLabels: true
                        };

                        plotDataOnStereonet(stereonet, processedData.data, repr, dataStyle);
                    }
                });
            });

        setDataStats(totalStats);
    }, [stereonet, currentState.settings.availableRepresentations, files]);

    // Helper function to process data for a specific representation
    const processDataForRepresentation = (data: any[], config: DataTypeConfig, representationType: string, headers: string[]) => {
        const result = { data: [] as any[], stats: { total: data.length, plotted: 0, errors: 0 } };

        // Find which column configuration works for this file
        const workingColumnConfig = config.columns.find(columnConfig =>
            columnConfig.required.every(col => headers.includes(col))
        );

        if (!workingColumnConfig) {
            result.stats.errors = data.length;
            return result;
        }

        data.forEach((row, index) => {
            try {
                let dataPoint: any = null;

                if (representationType === 'poles') {
                    // Convert to trend/plunge if needed
                    if (workingColumnConfig.required.includes('trend')) {
                        // Direct trend/plunge
                        const trend = parseFloat(row.trend || row.Trend);
                        const plunge = parseFloat(row.plunge || row.Plunge);
                        if (!isNaN(trend) && !isNaN(plunge)) {
                            dataPoint = { trend, plunge, id: index + 1 } as PoleData;
                        }
                    } else {
                        // Convert from strike/dip
                        const converted = convertData(row, workingColumnConfig.required, 'trend_plunge');
                        if (converted) {
                            dataPoint = { ...converted, id: index + 1 } as PoleData;
                        }
                    }
                } else if (representationType === 'planes') {
                    // Convert to strike/dip if needed
                    if (workingColumnConfig.required.includes('strike')) {
                        // Direct strike/dip
                        const strike = parseFloat(row.strike || row.Strike);
                        const dip = parseFloat(row.dip || row.Dip);
                        if (!isNaN(strike) && !isNaN(dip)) {
                            dataPoint = { strike, dip, id: index + 1 } as ExtensionFractureData;
                        }
                    } else {
                        // Convert from trend/plunge
                        const converted = convertData(row, workingColumnConfig.required, 'strike_dip');
                        if (converted) {
                            dataPoint = { ...converted, id: index + 1 } as ExtensionFractureData;
                        }
                    }
                } else if (representationType === 'striated_planes') {
                    // Striated fault planes need strike, dip, rake
                    const strike = parseFloat(row.strike || row.Strike);
                    const dip = parseFloat(row.dip || row.Dip);
                    const rake = parseFloat(row.rake || row.Rake);
                    if (!isNaN(strike) && !isNaN(dip) && !isNaN(rake)) {
                        dataPoint = { strike, dip, rake, id: index + 1 } as StriatedPlaneData;
                    }
                }

                if (dataPoint) {
                    result.data.push(dataPoint);
                    result.stats.plotted++;
                } else {
                    result.stats.errors++;
                }
            } catch (error) {
                console.error('Error processing row:', error);
                result.stats.errors++;
            }
        });

        return result;
    };

    // Helper function to plot data on stereonet
    const plotDataOnStereonet = (
        stereonet: WulffStereonet,
        data: any[],
        repr: AvailableRepresentation,
        style: DataStyle
    ) => {
        switch (repr.representation.name) {
            case 'poles':
                if (repr.dataType === 'stylolites') {
                    stereonet.addStylolitePoles(data as PoleData[], style);
                } else {
                    stereonet.addPoles(data as PoleData[], style, 'circle');
                }
                break;
            case 'planes':
                stereonet.addExtensionFractures(data as ExtensionFractureData[], style);
                break;
            case 'striated_planes':
                stereonet.addStriatedPlanes(data as StriatedPlaneData[], style);
                break;
        }
    };

    // Export functionality
    const exportSVG = () => {
        if (!stereonet) return;
        const svgString = stereonet.exportSVG();
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'stereonet.svg';
        link.click();
        URL.revokeObjectURL(url);
    };

    const exportState = () => {
        DataExporter.exportState(currentState, 'stereonet_state.json');
    };

    // Handle file selection
    const toggleFileSelection = (fileId: string) => {
        const newSelectedFiles = currentState.settings.selectedFiles.includes(fileId)
            ? currentState.settings.selectedFiles.filter(id => id !== fileId)
            : [...currentState.settings.selectedFiles, fileId];

        updateSettings({ selectedFiles: newSelectedFiles });

        // Recalculate available representations
        const selectedFiles = files.filter(f => newSelectedFiles.includes(f.id));
        const newAvailableRepresentations = getAvailableRepresentations(selectedFiles);
        updateSettings({ availableRepresentations: newAvailableRepresentations });
    };

    // Handle representation toggle
    const toggleRepresentation = (key: string) => {
        const updatedRepresentations = currentState.settings.availableRepresentations.map(repr =>
            repr.key === key ? { ...repr, enabled: !repr.enabled } : repr
        );
        updateSettings({ availableRepresentations: updatedRepresentations });
    };

    // Handle style change
    const updateRepresentationStyle = (key: string, updates: Partial<AvailableRepresentation>) => {
        const updatedRepresentations = currentState.settings.availableRepresentations.map(repr =>
            repr.key === key ? { ...repr, ...updates } : repr
        );
        updateSettings({ availableRepresentations: updatedRepresentations });
    };

    // Style popup component
    const StylePopup = ({ representation }: { representation: AvailableRepresentation }) => (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-80">
                <h3 className="text-lg font-semibold mb-4">{representation.representation.displayName}</h3>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Color</label>
                        <input
                            type="color"
                            value={representation.color}
                            onChange={(e) => updateRepresentationStyle(representation.key, { color: e.target.value })}
                            className="w-full h-10 rounded border"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Opacity: {representation.opacity.toFixed(1)}
                        </label>
                        <input
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.1"
                            value={representation.opacity}
                            onChange={(e) => updateRepresentationStyle(representation.key, { opacity: parseFloat(e.target.value) })}
                            className="w-full"
                        />
                    </div>
                </div>

                <div className="flex gap-2 mt-6">
                    <button
                        onClick={() => setShowStylePopup(null)}
                        className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => setShowStylePopup(null)}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Apply
                    </button>
                </div>
            </div>
        </div>
    );

    // Main plot content
    const plotContent = (
        <div className="flex flex-col h-full">
            {/* Files to Plot */}
            <div className="mb-4">
                <h4 className="font-medium text-gray-800 mb-2">Files to Plot</h4>
                <div className="border rounded-lg p-3 max-h-32 overflow-y-auto">
                    {files && files.map(file => (
                        <label key={file.id} className="flex items-center justify-between py-1">
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={currentState.settings.selectedFiles.includes(file.id)}
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
            <div className="mb-4">
                <h4 className="font-medium text-gray-800 mb-2">Data Types to Plot</h4>
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                    {currentState.settings.availableRepresentations.map(repr => (
                        <div key={repr.key} className="flex items-center justify-between py-2">
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={repr.enabled}
                                    onChange={() => toggleRepresentation(repr.key)}
                                    className="mr-2"
                                />
                                <span className="text-sm mr-2">{repr.representation.displayName}</span>
                                <div className="flex items-center">
                                    <div
                                        className="w-4 h-4 rounded mr-1"
                                        style={{ backgroundColor: repr.color }}
                                    />
                                    <span className="text-xs font-mono">{repr.representation.symbol}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowStylePopup(repr.key)}
                                className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
                            >
                                Change
                            </button>
                        </div>
                    ))}
                    {currentState.settings.availableRepresentations.length === 0 && (
                        <p className="text-sm text-gray-500 italic">No compatible data types found in selected files</p>
                    )}
                </div>
            </div>

            {/* Stereonet container */}
            <div className="flex-1 min-h-0 mb-4">
                <div
                    ref={containerRef}
                    className="w-full h-full border rounded-lg bg-white shadow-sm flex items-center justify-center"
                />
            </div>

            {/* Data statistics */}
            {dataStats && (
                <div className="flex-shrink-0 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                        <Layers className="w-5 h-5 text-blue-600" />
                        <h4 className="font-semibold">Data Summary</h4>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                            <span className="font-medium">Total:</span> {dataStats.total}
                        </div>
                        <div>
                            <span className="font-medium">Plotted:</span> {dataStats.plotted}
                        </div>
                        <div>
                            <span className="font-medium">Errors:</span> {dataStats.errors}
                        </div>
                    </div>
                </div>
            )}

            {/* Style Popup */}
            {showStylePopup && (
                <StylePopup
                    representation={currentState.settings.availableRepresentations.find(r => r.key === showStylePopup)!}
                />
            )}
        </div>
    );

    // Settings panel content
    const settingsContent = (
        <div className="space-y-4">
            {/* Stereonet display settings */}
            <div>
                <h5 className="font-medium text-gray-800 mb-3">Stereonet Display</h5>
                <div className="space-y-3">
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
                        <span className="text-sm">Show Directions</span>
                        <input
                            type="checkbox"
                            checked={currentState.settings.showDirections}
                            onChange={(e) => updateSettings({ showDirections: e.target.checked })}
                            className="rounded"
                        />
                    </label>

                    <label className="flex items-center justify-between">
                        <span className="text-sm">Show Labels</span>
                        <input
                            type="checkbox"
                            checked={currentState.settings.showLabels}
                            onChange={(e) => updateSettings({ showLabels: e.target.checked })}
                            className="rounded"
                        />
                    </label>

                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Grid Interval: {currentState.settings.gridInterval}°
                        </label>
                        <input
                            type="range"
                            min="5"
                            max="30"
                            step="5"
                            value={currentState.settings.gridInterval}
                            onChange={(e) => updateSettings({ gridInterval: parseInt(e.target.value) })}
                            className="w-full"
                        />
                    </div>
                </div>
            </div>

            {/* Grid styling */}
            <div>
                <h5 className="font-medium text-gray-800 mb-3">Grid Styling</h5>
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium mb-1">Grid Color</label>
                        <input
                            type="color"
                            value={currentState.settings.gridColor}
                            onChange={(e) => updateSettings({ gridColor: e.target.value })}
                            className="w-full h-8 rounded border"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Background Color</label>
                        <input
                            type="color"
                            value={currentState.settings.backgroundColor}
                            onChange={(e) => updateSettings({ backgroundColor: e.target.value })}
                            className="w-full h-8 rounded border"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Border Color</label>
                        <input
                            type="color"
                            value={currentState.settings.borderColor}
                            onChange={(e) => updateSettings({ borderColor: e.target.value })}
                            className="w-full h-8 rounded border"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Border Width: {currentState.settings.borderWidth}px
                        </label>
                        <input
                            type="range"
                            min="1"
                            max="5"
                            step="1"
                            value={currentState.settings.borderWidth}
                            onChange={(e) => updateSettings({ borderWidth: parseInt(e.target.value) })}
                            className="w-full"
                        />
                    </div>
                </div>
            </div>
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
                onClick={exportSVG}
                disabled={!stereonet}
                className="p-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                title="Export as SVG"
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
            settingsPanelWidth={320}
            initialSettingsOpen={currentState.open}
            onSettingsToggle={(isOpen) => {
                toggleSettingsPanel();

                setTimeout(() => {
                    if (containerRef.current) {
                        const containerWidth = containerRef.current.parentElement?.clientWidth || width || 600;
                        const settingsPanelWidth = isOpen ? 320 : 0;
                        const availableWidth = containerWidth - settingsPanelWidth - 40;
                        const availableHeight = containerRef.current?.clientHeight || height || 600;

                        // Make it square for better stereonet appearance
                        const size = Math.min(availableWidth, availableHeight - 100);

                        const newDimensions = {
                            width: Math.max(size, 300),
                            height: Math.max(size, 300)
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

export default WulffStereonetComponent;