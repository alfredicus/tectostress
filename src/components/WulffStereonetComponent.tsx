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
import { TypeSynonyms } from '@/utils';

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
    stylolite: {
        displayName: 'Stylolite',
        columns: [
            { required: ['trend', 'plunge'] },
            { required: ['strike', 'dip'] },
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
    joint: {
        displayName: 'Joint',
        columns: [
            { required: ['trend', 'plunge'] },
            { required: ['strike', 'dip'] },
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
    fault: {
        displayName: 'Fault',
        columns: [
            { required: ['strike', 'dip', 'rake'] },
            { required: ['dip', 'strike', 'dip_direction', 'rake'] },
        ],
        representations: [
            {
                name: 'poles',
                displayName: 'Fault Poles',
                symbol: '●',
                defaultColor: '#ff0000'
            },
            {
                name: 'striated_planes',
                displayName: 'Fault Planes',
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
    key: string;
    dataType: string;
    representation: RepresentationConfig;
    availableInFiles: string[];
    enabled: boolean;
    color: string;
    opacity: number;
}

export interface WulffStereonetSettings {
    showGrid: boolean;
    showDirections: boolean;
    showLabels: boolean;
    gridInterval: number;
    gridColor: string;
    gridWidth: number;
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
    selectedFiles: string[];
    availableRepresentations: AvailableRepresentation[];
    zoomLevel: number;
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
    availableRepresentations: [],
    zoomLevel: 1.0
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getAvailableRepresentations(files: any[]): AvailableRepresentation[] {
    const available: AvailableRepresentation[] = [];

    Object.entries(DATA_TYPE_CONFIGS).forEach(([dataType, config]) => {
        config.representations.forEach(repr => {
            const availableInFiles = files
                .filter(file => {
                    const hasColumns = config.columns.some(columnConfig =>
                        columnConfig.required.every(col =>
                            file.headers && file.headers.includes(col)
                        )
                    );

                    const hasMatchingType = file.content.some((row: any) => TypeSynonyms.isSameType(dataType, row.type))
                    return hasColumns && hasMatchingType;
                })
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
    });

    return available;
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
    const containerRef = useRef<HTMLDivElement>(null);
    const [stereonet, setStereonet] = useState<WulffStereonet | null>(null);
    const [dataStats, setDataStats] = useState<any>(null);
    const [showStylePopup, setShowStylePopup] = useState<string | null>(null);
    const [showDataPanel, setShowDataPanel] = useState(false);

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
        const fileIds = files.map(f => f.id);

        const representationsChanged = JSON.stringify(newAvailableRepresentations.map(r => r.key)) !==
            JSON.stringify(currentState.settings.availableRepresentations.map(r => r.key));
        const filesChanged = JSON.stringify(fileIds) !== JSON.stringify(currentState.settings.selectedFiles);

        if (representationsChanged || filesChanged) {
            updateSettings({
                selectedFiles: fileIds,
                availableRepresentations: newAvailableRepresentations
            });
        }
    }, [files]);

    // Initialize stereonet
    useEffect(() => {
        if (!containerRef.current) return;

        containerRef.current.innerHTML = '';
        const containerId = `stereonet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        containerRef.current.id = containerId;

        const baseWidth = Math.max(currentState.plotDimensions.width - 40, 300);
        const baseHeight = Math.max(currentState.plotDimensions.height - 40, 300);
        const baseSize = Math.min(baseWidth, baseHeight);
        const zoomedSize = baseSize * currentState.settings.zoomLevel;
        const labelSize = 14 * currentState.settings.zoomLevel;

        const options: WulffStereonetOptions = {
            width: zoomedSize,
            height: zoomedSize,
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
                labelColor: '#989595ff',
                labelSize: `${labelSize}px`
            }
        };

        const newStereonet = new WulffStereonet(containerId, options);
        setStereonet(newStereonet);
    }, [currentState.plotDimensions, currentState.settings.showGrid, currentState.settings.showDirections, currentState.settings.showLabels, currentState.settings.gridInterval, currentState.settings.gridColor, currentState.settings.backgroundColor, currentState.settings.borderColor, currentState.settings.zoomLevel]);

    // Update data
    useEffect(() => {
        if (!stereonet || !files || files.length === 0) return;

        stereonet.clearData();
        let totalStats = { total: 0, plotted: 0, errors: 0 };

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
                        repr,
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
                            showLabels: currentState.settings.showLabels
                        };

                        plotDataOnStereonet(stereonet, processedData.data, repr, dataStyle);
                    }
                });
            });

        setDataStats(totalStats);
    }, [stereonet, currentState.settings.availableRepresentations, files]);

    const processDataForRepresentation = (data: any[], config: DataTypeConfig, repr: AvailableRepresentation, headers: string[]) => {
        const result = { data: [] as any[], stats: { total: data.length, plotted: 0, errors: 0 } };
        const representationType = repr.representation.name;

        const workingColumnConfig = config.columns.find(columnConfig =>
            columnConfig.required.every(col => headers.includes(col))
        );

        if (!workingColumnConfig) {
            result.stats.errors = data.length;
            return result;
        }

        data.forEach((row, index) => {
            if (TypeSynonyms.isSameType(repr.dataType, row.type)) {
                try {
                    let dataPoint: any = null;

                    if (representationType === 'poles') {
                        if (workingColumnConfig.required.includes('trend')) {
                            const trend = parseFloat(row.trend);
                            const plunge = parseFloat(row.plunge);
                            if (!isNaN(trend) && !isNaN(plunge)) {
                                dataPoint = { trend, plunge, id: index + 1 } as PoleData;
                            }
                        }
                        else if (workingColumnConfig.required.includes('strike')) {
                            const dip = parseFloat(row.dip);
                            const strike = parseFloat(row.strike);
                            if (!isNaN(strike) && !isNaN(dip)) {
                                const trend = (strike + 90) % 360;
                                const plunge = 90 - dip;
                                dataPoint = { trend, plunge, id: index + 1 } as PoleData;
                            }
                        }
                    }
                    else if (representationType === 'planes') {
                        if (workingColumnConfig.required.includes('trend')) {
                            const trend = parseFloat(row.trend);
                            const plunge = parseFloat(row.plunge);
                            if (!isNaN(trend) && !isNaN(plunge)) {
                                dataPoint = { trend, plunge, id: index + 1 } as PoleData;
                            }
                        }
                        else if (workingColumnConfig.required.includes('strike')) {
                            const dip = parseFloat(row.dip);
                            const strike = parseFloat(row.strike);
                            if (!isNaN(strike) && !isNaN(dip)) {
                                dataPoint = { strike, dip, id: index + 1 } as ExtensionFractureData;
                            }
                        }
                    }
                    else if (representationType === 'striated_planes') {
                        const strike = parseFloat(row.strike);
                        const dip = parseFloat(row.dip);
                        const rake = parseFloat(row.rake);
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
            }
        });

        return result;
    };

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

    const toggleFileSelection = (fileId: string) => {
        const newSelectedFiles = currentState.settings.selectedFiles.includes(fileId)
            ? currentState.settings.selectedFiles.filter(id => id !== fileId)
            : [...currentState.settings.selectedFiles, fileId];

        const selectedFiles = files.filter(f => newSelectedFiles.includes(f.id));
        const newAvailableRepresentations = getAvailableRepresentations(selectedFiles);

        updateSettings({
            selectedFiles: newSelectedFiles,
            availableRepresentations: newAvailableRepresentations
        });
    };

    const toggleRepresentation = (key: string) => {
        const updatedRepresentations = currentState.settings.availableRepresentations.map(repr =>
            repr.key === key ? { ...repr, enabled: !repr.enabled } : repr
        );

        updateSettings({ availableRepresentations: updatedRepresentations });
    };

    const updateRepresentationStyle = (key: string, updates: Partial<AvailableRepresentation>) => {
        const updatedRepresentations = currentState.settings.availableRepresentations.map(repr =>
            repr.key === key ? { ...repr, ...updates } : repr
        );
        updateSettings({ availableRepresentations: updatedRepresentations });
    };

    const StylePopup = ({ representation }: { representation: AvailableRepresentation }) => {
        const [localColor, setLocalColor] = React.useState(representation.color);
        const [localOpacity, setLocalOpacity] = React.useState(representation.opacity);

        const handleApply = () => {
            updateRepresentationStyle(representation.key, {
                color: localColor,
                opacity: localOpacity
            });
            setShowStylePopup(null);
        };

        const handleCancel = () => {
            setShowStylePopup(null);
        };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleCancel}>
                <div className="bg-white p-6 rounded-lg shadow-lg w-80" onClick={(e) => e.stopPropagation()}>
                    <h3 className="text-lg font-semibold mb-4">{representation.representation.displayName}</h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Color</label>
                            <input
                                type="color"
                                value={localColor}
                                onChange={(e) => setLocalColor(e.target.value)}
                                className="w-full h-10 rounded border"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Opacity: {localOpacity.toFixed(1)}
                            </label>
                            <input
                                type="range"
                                min="0.1"
                                max="1"
                                step="0.1"
                                value={localOpacity}
                                onChange={(e) => setLocalOpacity(parseFloat(e.target.value))}
                                className="w-full"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2 mt-6">
                        <button
                            onClick={handleCancel}
                            className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleApply}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                            Apply
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const dataSelectionPanel = (
        <div className="space-y-4">
            <div>
                <h4 className="font-medium text-gray-800 mb-2">Files to Plot</h4>
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
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

            <div>
                <h4 className="font-medium text-gray-800 mb-2">Data Types to Plot</h4>
                <div className="border rounded-lg p-3 max-h-64 overflow-y-auto">
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
        </div>
    );

    const plotContent = (
        <div className="flex flex-col h-full relative">
            <div className="flex-1 min-h-0 mb-4">
                <div
                    ref={containerRef}
                    className="w-full h-full border rounded-lg bg-white shadow-sm flex items-center justify-center"
                />
            </div>

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

            {showStylePopup && (
                <StylePopup
                    representation={currentState.settings.availableRepresentations.find(r => r.key === showStylePopup)!}
                />
            )}
        </div>
    );

    const settingsContent = (
        <div className="space-y-4">
            <div className="pb-4 border-b">
                <h5 className="font-medium text-gray-800 mb-3">Diagram Size</h5>
                <div>
                    <label className="block text-sm font-medium mb-2">  
                        Zoom: {(currentState.settings.zoomLevel * 100).toFixed(0)}%
                    </label>
                    <input
                        type="range"
                        min="0.5"
                        max="3.0"
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

    const headerActions = (
        <>
            {/* <button
                onClick={resetToDefaults}
                className="p-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                title="Reset to Defaults"
            >
                <RotateCcw size={16} />
            </button> */}

            {/* <button
                onClick={exportSVG}
                disabled={!stereonet}
                className="p-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                title="Export as SVG"
            >
                <Download size={16} />
            </button> */}
        </>
    );

    return (
        <StablePlotWithSettings
            title={title}
            leftPanel={dataSelectionPanel}
            settingsPanel={settingsContent}
            headerActions={headerActions}
            borderColor="#d1d5db"
            borderWidth={1}
            settingsPanelWidth={320}
            leftPanelWidth={320}
            enableZoom={true}
            initialSettingsOpen={currentState.open}
            initialLeftPanelOpen={showDataPanel}
            showLeftPanelButton={true}
            leftPanelButtonIcon={<Layers size={16} />}
            onLeftPanelToggle={(isOpen) => {
                setShowDataPanel(isOpen);
            }}
            onSettingsToggle={(isOpen) => {
                toggleSettingsPanel();

                setTimeout(() => {
                    if (containerRef.current) {
                        const containerWidth = containerRef.current.parentElement?.clientWidth || width || 600;
                        const settingsPanelWidth = isOpen ? 320 : 0;
                        const availableWidth = containerWidth - settingsPanelWidth - 40;
                        const availableHeight = containerRef.current?.clientHeight || height || 600;

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