import React, { useEffect, useRef, useState } from 'react';
import { Download, RotateCcw, MapPin, Layers } from 'lucide-react';
import StablePlotWithSettings from '../PlotWithSettings';
import {
    BaseVisualizationProps,
    useVisualizationState
} from '../VisualizationStateSystem';
import { createFractureMap2DSettings, FractureMap2DCompState, FracturePoint } from './FractureMap2DParameters';
import { FractureMap2D } from './FractureMap2D';

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

// ============================================================================
// FRACTURE MAP 2D COMPONENT
// ============================================================================

const FractureMap2DComponent: React.FC<BaseVisualizationProps<FractureMap2DCompState>> = ({
    files,
    width = 800,
    height = 600,
    title = "Fracture Orientation Map",
    state,
    onStateChange,
    onDimensionChange
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<FractureMap2D | null>(null);
    const [data, setData] = useState<FracturePoint[]>([]);
    const [dataStats, setDataStats] = useState<any>(null);
    const [showDataPanel, setShowDataPanel] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
    const [availableDataTypes, setAvailableDataTypes] = useState<AvailableDataType[]>([]);

    const {
        state: currentState,
        updateSettings,
        updatePlotDimensions,
        toggleSettingsPanel,
        resetToDefaults
    } = useVisualizationState<FractureMap2DCompState>(
        'fractureMap2D',
        createFractureMap2DSettings(),
        files,
        width,
        height,
        state,
        onStateChange
    );

    // Initialize selected files when files change
    useEffect(() => {
        if (!files || files.length === 0) {
            setSelectedFiles([]);
            setAvailableDataTypes([]);
            return;
        }

        // Select all files by default
        const fileIds = files.map(f => f.id);
        setSelectedFiles(fileIds);

        // Update available data types
        const dataTypes = getAvailableDataTypes(files);
        setAvailableDataTypes(dataTypes);
    }, [files]);

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

    // Extract and filter data
    useEffect(() => {
        if (!files || files.length === 0) {
            setData([]);
            //if (map) map.plot([], currentState.settings);
            setDataStats(null);
            return;
        }

        // Check if no files are selected
        if (selectedFiles.length === 0) {
            setData([]);
            if (map) map.plot([], currentState.settings);
            setDataStats({ total: 0, valid: 0, invalid: 0 });
            return;
        }

        const enabledDataTypes = availableDataTypes
            .filter(dt => dt.enabled)
            .map(dt => dt.dataType);

        // Check if data types exist but none are enabled
        if (availableDataTypes.length > 0 && enabledDataTypes.length === 0) {
            setData([]);
            setDataStats({ total: 0, valid: 0, invalid: 0 });
            return;
        }

        const extractedData: FracturePoint[] = [];
        let totalPoints = 0;
        let validPoints = 0;

        // Get relevant files (those that are selected)
        const relevantFiles = files.filter(f => selectedFiles.includes(f.id));

        relevantFiles.forEach(file => {
            const fileData = file.data || file.content;
            if (!fileData || fileData.length === 0) return;

            const hasRequiredColumns =
                file.headers.includes('x') &&
                file.headers.includes('y') &&
                file.headers.includes('strike');

            if (!hasRequiredColumns) return;

            fileData.forEach((row: any, index: number) => {
                // Determine if this row passes the type filter
                let passesTypeFilter: boolean;
                
                if (availableDataTypes.length === 0) {
                    // No data types defined, accept all rows
                    passesTypeFilter = true;
                } else if (!row.type) {
                    // Data types exist but this row has no type - reject it
                    passesTypeFilter = false;
                } else {
                    // Data types exist and row has a type - check if it's enabled
                    passesTypeFilter = enabledDataTypes.includes(row.type);
                }

                if (!passesTypeFilter) {
                    return;
                }

                totalPoints++;
                const x = parseFloat(row.x);
                const y = parseFloat(row.y);
                const strike = parseFloat(row.strike);

                if (!isNaN(x) && !isNaN(y) && !isNaN(strike)) {
                    const point: FracturePoint = {
                        x,
                        y,
                        strike,
                        id: row.id || index + 1
                    };

                    if (row.dip !== undefined) {
                        point.dip = parseFloat(row.dip);
                    }

                    if (row.predicted_strike !== undefined || row.predictedStrike !== undefined) {
                        const pred = parseFloat(row.predicted_strike || row.predictedStrike);
                        if (!isNaN(pred)) {
                            point.predictedStrike = pred;
                        }
                    }

                    extractedData.push(point);
                    validPoints++;
                }
            });
        });

        setData(extractedData);
        setDataStats({
            total: totalPoints,
            valid: validPoints,
            invalid: totalPoints - validPoints
        });
    }, [files, selectedFiles, availableDataTypes]);

    // Initialize the map
    useEffect(() => {
        if (!containerRef.current) return;

        containerRef.current.innerHTML = '';
        const containerId = `fracture-map-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        containerRef.current.id = containerId;

        const baseWidth = Math.max(currentState.plotDimensions.width - 40, 400);
        const baseHeight = Math.max(currentState.plotDimensions.height - 40, 300);
        const zoomedWidth = baseWidth * currentState.settings.zoomLevel;
        const zoomedHeight = baseHeight * currentState.settings.zoomLevel;

        const newMap = new FractureMap2D(
            containerId,
            zoomedWidth,
            zoomedHeight,
            currentState.settings.backgroundColor
        );

        setMap(newMap);
    }, [currentState.plotDimensions, currentState.settings.zoomLevel, currentState.settings.backgroundColor]);

    // Update the plot
    useEffect(() => {
        // if (!map || data.length === 0) return;

        if (map) map.plot(data, currentState.settings);
    }, [map, data, currentState.settings]);

    const exportSVG = () => {
        if (!map) return;
        const svgString = map.exportSVG();
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'fracture-map.svg';
        link.click();
        URL.revokeObjectURL(url);
    };

    // Main plot content
    const plotContent = (
        <div className="flex flex-col h-full">
            <div
                ref={containerRef}
                className="flex-1 w-full border rounded-lg bg-white shadow-sm flex items-center justify-center overflow-auto"
            />

            {dataStats && (
                <div className="flex-shrink-0 mt-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                        <MapPin className="w-5 h-5 text-blue-600" />
                        <h4 className="font-semibold">Data Summary</h4>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                            <span className="font-medium">Total:</span> {dataStats.total}
                        </div>
                        <div>
                            <span className="font-medium">Valid:</span> {dataStats.valid}
                        </div>
                        <div>
                            <span className="font-medium">Invalid:</span> {dataStats.invalid}
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

            {/* Required columns info */}
            <div>
                <h4 className="font-medium text-gray-800 mb-2">Required Columns</h4>
                <div className="border rounded-lg p-3 bg-blue-50 text-sm space-y-1">
                    <p><span className="font-medium">x</span> - X coordinate</p>
                    <p><span className="font-medium">y</span> - Y coordinate</p>
                    <p><span className="font-medium">strike</span> - Strike angle</p>
                </div>
            </div>
        </div>
    );

    const settingsContent = (
        <div className="space-y-4">
            <div className="pb-4 border-b">
                <h5 className="font-medium text-gray-800 mb-3">Display Options</h5>
                <div className="space-y-3">
                    <label className="flex items-center justify-between">
                        <span className="text-sm">Show Measured</span>
                        <input
                            type="checkbox"
                            checked={currentState.settings.showMeasured}
                            onChange={(e) => updateSettings({ showMeasured: e.target.checked })}
                            className="rounded"
                        />
                    </label>

                    <label className="flex items-center justify-between">
                        <span className="text-sm">Show Predicted</span>
                        <input
                            type="checkbox"
                            checked={currentState.settings.showPredicted}
                            onChange={(e) => updateSettings({ showPredicted: e.target.checked })}
                            className="rounded"
                        />
                    </label>

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
                        <span className="text-sm">Show Labels</span>
                        <input
                            type="checkbox"
                            checked={currentState.settings.showLabels}
                            onChange={(e) => updateSettings({ showLabels: e.target.checked })}
                            className="rounded"
                        />
                    </label>
                </div>
            </div>

            <div className="pb-4 border-b">
                <h5 className="font-medium text-gray-800 mb-3">Colors</h5>
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium mb-1">Measured Color</label>
                        <input
                            type="color"
                            value={currentState.settings.measuredColor}
                            onChange={(e) => updateSettings({ measuredColor: e.target.value })}
                            className="w-full h-8 rounded border"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Predicted Color</label>
                        <input
                            type="color"
                            value={currentState.settings.predictedColor}
                            onChange={(e) => updateSettings({ predictedColor: e.target.value })}
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
                </div>
            </div>

            <div className="pb-4 border-b">
                <h5 className="font-medium text-gray-800 mb-3">Sizes</h5>
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Point Size: {currentState.settings.pointSize}px
                        </label>
                        <input
                            type="range"
                            min="1"
                            max="10"
                            step="1"
                            value={currentState.settings.pointSize}
                            onChange={(e) => updateSettings({ pointSize: parseInt(e.target.value) })}
                            className="w-full"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Line Length: {currentState.settings.lineLength}px
                        </label>
                        <input
                            type="range"
                            min="10"
                            max="50"
                            step="5"
                            value={currentState.settings.lineLength}
                            onChange={(e) => updateSettings({ lineLength: parseInt(e.target.value) })}
                            className="w-full"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Line Width: {currentState.settings.lineWidth}px
                        </label>
                        <input
                            type="range"
                            min="1"
                            max="5"
                            step="0.5"
                            value={currentState.settings.lineWidth}
                            onChange={(e) => updateSettings({ lineWidth: parseFloat(e.target.value) })}
                            className="w-full"
                        />
                    </div>
                </div>
            </div>

            <div className="pb-4 border-b">
                <h5 className="font-medium text-gray-800 mb-3">Axis Labels</h5>
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium mb-1">X Axis Label</label>
                        <input
                            type="text"
                            value={currentState.settings.xAxisLabel}
                            onChange={(e) => updateSettings({ xAxisLabel: e.target.value })}
                            className="w-full px-2 py-1 text-sm border rounded"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Y Axis Label</label>
                        <input
                            type="text"
                            value={currentState.settings.yAxisLabel}
                            onChange={(e) => updateSettings({ yAxisLabel: e.target.value })}
                            className="w-full px-2 py-1 text-sm border rounded"
                        />
                    </div>
                </div>
            </div>

            <div>
                <h5 className="font-medium text-gray-800 mb-3">Zoom</h5>
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
        </div>
    );

    return (
        <StablePlotWithSettings
            title={title}
            leftPanel={dataSelectionPanel}
            settingsPanel={settingsContent}
            borderColor="#d1d5db"
            borderWidth={1}
            settingsPanelWidth={320}
            leftPanelWidth={280}
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
                        const containerWidth = containerRef.current.parentElement?.clientWidth || width || 800;
                        const settingsPanelWidth = isOpen ? 320 : 0;
                        const availableWidth = containerWidth - settingsPanelWidth - 40;

                        const newDimensions = {
                            width: Math.max(availableWidth, 300),
                            height: containerRef.current?.clientHeight || height || 600
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

export default FractureMap2DComponent;