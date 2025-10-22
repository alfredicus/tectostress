import React, { useEffect, useRef, useState } from 'react';
import { RoseDiagram } from './RoseDiagram';
//import { Navigation } from 'lucide-react';
import { Layers } from 'lucide-react';
import StablePlotWithSettings from '../PlotWithSettings';
import {
    BaseVisualizationProps,
    useVisualizationState
} from '../VisualizationStateSystem';
import { createRoseSettings, RoseCompState } from './RoseParameters';
import { beautifyName } from '@/utils';

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
            const headers = file.headers?.map((h: string) => beautifyName(h)) || [];
            headers.forEach(header => columns.add(header));
        });

    return Array.from(columns);
}

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
    const [rose, setRose] = useState<RoseDiagram | null>(null);
    const [dataStats, setDataStats] = useState<any>(null);
    const [showDataPanel, setShowDataPanel] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
    const [availableDataTypes, setAvailableDataTypes] = useState<AvailableDataType[]>([]);
    const [availableColumns, setAvailableColumns] = useState<string[]>([]);
    const [selectedColumn, setSelectedColumn] = useState<string>('');

    const {
        state: currentState,
        updateSettings,
        updatePlotDimensions,
        toggleSettingsPanel,
    } = useVisualizationState<RoseCompState>(
        'rose-diagram',
        createRoseSettings(),
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
            setAvailableColumns([]);
            setSelectedColumn('');
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
            setAvailableColumns([]);
            setSelectedColumn('');
            return;
        }

        const columns = getAvailableColumns(files, selectedFiles);
        setAvailableColumns(columns);

        // Auto-select first column if none selected or current selection is invalid
        if (columns.length > 0 && (!selectedColumn || !columns.includes(selectedColumn))) {
            setSelectedColumn(columns[0]);
        } else if (columns.length === 0) {
            setSelectedColumn('');
        }
    }, [files, selectedFiles]);

    // Initialize rose diagram container
    useEffect(() => {
        if (!containerRef.current) return;

        const baseWidth = Math.max(currentState.plotDimensions.width - 40, 300);
        const baseHeight = Math.max(currentState.plotDimensions.height - 40, 300);
        const baseSize = Math.min(baseWidth, baseHeight);
        const zoomedSize = baseSize * currentState.settings.zoomLevel;

        // Clear any existing content
        containerRef.current.innerHTML = '';
        const roseContainer = document.createElement('div');
        roseContainer.id = `rose-container-${Date.now()}`;
        roseContainer.style.width = '100%';
        roseContainer.style.height = '100%';
        containerRef.current.appendChild(roseContainer);

        // Initialize with empty data
        const newRose = new RoseDiagram(roseContainer.id, [], {
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
    }, [
        currentState.plotDimensions,
        currentState.settings.zoomLevel,
        currentState.settings.showLabels,
        currentState.settings.showCircles,
        currentState.settings.showLines,
        currentState.settings.showCardinals,
        currentState.settings.is360,
        currentState.settings.innerRadius,
        currentState.settings.binAngle,
        currentState.settings.binColor,
        currentState.settings.lineColor
    ]);

    // Update data (similar to Wulff component)
    useEffect(() => {
        if (!rose || !files || files.length === 0 || !selectedColumn) {
            if (rose) rose.data = [];
            return;
        }

        let totalStats = { total: 0, plotted: 0, errors: 0 };
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
                totalStats.total++;

                // Filter by data type if any are enabled
                if (enabledDataTypes.length !== 0) {
                    const passesTypeFilter = enabledDataTypes.length === 0 ||
                        enabledDataTypes.includes(row.type);

                    if (passesTypeFilter) {
                        const value = parseFloat(row[selectedColumn]);
                        if (!isNaN(value)) {
                            allData.push(value);
                            totalStats.plotted++;
                        } else {
                            totalStats.errors++;
                        }
                    } else {
                        totalStats.errors++;
                    }
                }

            });
        });

        // Update rose diagram with data
        if (allData.length > 0) {
            rose.data = allData;

            // Update stats
            setDataStats({
                total: totalStats.total,
                plotted: totalStats.plotted,
                errors: totalStats.errors,
                min: Math.min(...allData),
                max: Math.max(...allData),
                avg: allData.reduce((a, b) => a + b, 0) / allData.length
            });
        } else {
            // No data available
            rose.data = [];
            setDataStats({
                total: totalStats.total,
                plotted: 0,
                errors: totalStats.errors,
                min: 0,
                max: 0,
                avg: 0
            });
        }
    }, [rose, files, selectedFiles, availableDataTypes, selectedColumn]);

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
                    {availableColumns.length > 0 ? (
                        <select
                            value={selectedColumn}
                            onChange={(e) => setSelectedColumn(e.target.value)}
                            className="w-full p-2 border rounded text-sm"
                        >
                            {availableColumns.map(col => (
                                <option key={col} value={col}>{col}</option>
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

    // Main plot content
    const plotContent = (
        <div className="flex flex-col h-full">
            {/* Rose diagram container */}
            <div className="flex-1 min-h-0 mb-4">
                <div
                    ref={containerRef}
                    className="w-full h-full border rounded-lg bg-white shadow-sm flex items-center justify-center"
                />
            </div>

            {/* Data info panel */}
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
                    {dataStats.plotted > 0 && (
                        <div className="grid grid-cols-3 gap-4 text-sm mt-2 pt-2 border-t">
                            <div>
                                <span className="font-medium">Min:</span> {dataStats.min.toFixed(1)}°
                            </div>
                            <div>
                                <span className="font-medium">Max:</span> {dataStats.max.toFixed(1)}°
                            </div>
                            <div>
                                <span className="font-medium">Avg:</span> {dataStats.avg.toFixed(1)}°
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    // Settings panel content (right panel)
    const settingsContent = (
        <div className="space-y-4">
            {/* Zoom section */}
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

                    <div>
                        <label className="block text-sm font-medium mb-1">Bin Color</label>
                        <input
                            type="color"
                            value={currentState.settings.binColor}
                            onChange={(e) => updateSettings({ binColor: e.target.value })}
                            className="w-full h-8 rounded border"
                        />
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
        </div>
    );

    const headerActions = <></>;

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
                        const containerWidth = containerRef.current.parentElement?.clientWidth || width || 400;
                        const settingsPanelWidth = isOpen ? 320 : 0;
                        const availableWidth = containerWidth - settingsPanelWidth - 40;
                        const availableHeight = containerRef.current?.clientHeight || height || 400;

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

export default RoseDiagramComponent;