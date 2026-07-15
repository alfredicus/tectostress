import React, { useEffect, useRef, useState } from 'react';
import { Wulff, WulffOptions, StriatedPlaneData, ExtensionFractureData, PoleData, DataStyle, Vector3D } from './Wulff';
import { Layers } from 'lucide-react';
import { FaultDataHelper, Direction, CDirection, TypeOfMovement, CTypeOfMovement } from '@alfredo-taboada/stress';

// ============================================================================
// COORDINATE CONVERSION UTILITIES
// ============================================================================

/**
 * Map a numeric azimuth (degrees clockwise from N) to the nearest compass Direction enum.
 */
function azimuthToDirection(az: number): Direction {
    const a = ((az % 360) + 360) % 360;
    if (a <= 22.5 || a > 337.5) return Direction.N;
    if (a <= 67.5)  return Direction.NE;
    if (a <= 112.5) return Direction.E;
    if (a <= 157.5) return Direction.SE;
    if (a <= 202.5) return Direction.S;
    if (a <= 247.5) return Direction.SW;
    if (a <= 292.5) return Direction.W;
    return Direction.NW;
}

/** Parse dip Direction from a row field, falling back to deriving it from strike. */
function parseDipDirection(row: any, strike: number): Direction {
    const dd = row['dip direction'];
    if (dd && CDirection.exists(String(dd))) {
        return CDirection.fromString(String(dd));
    }
    return azimuthToDirection((strike + 90) % 360);
}

/**
 * Parse strike Direction from a row field.
 * Returns Direction.UND when absent so FaultDataHelper can handle rake=0/90 correctly;
 * for oblique rake with UND the create() call will throw and fall back to striationFromRakeGeometry().
 */
function parseStrikeDirection(row: any): Direction {
    const sd = row['strike direction'];
    if (sd && CDirection.exists(String(sd))) {
        return CDirection.fromString(String(sd));
    }
    return Direction.UND;
}

/** Convert a library Vector3 ([E, N, Up]) to a Wulff Vector3D ({x, y, z}). */
function libVec3ToVector3D(v: number[]): Vector3D {
    return { x: v[0], y: v[1], z: v[2] };
}

/**
 * Compute striation vector from strike/dip/rake using pure geometry (no movement validation).
 * Fallback when FaultDataHelper.create() rejects the typeOfMovement.
 * Uses the plane's strike (e_phi) and dip (e_theta) unit vectors.
 */
function striationFromRakeGeometry(normal: Vector3D, strike: number, rake: number): Vector3D {
    const phi = Math.atan2(normal.x, normal.y); // azimuthal angle of dip direction
    // e_phi: unit vector along strike (perpendicular to normal, horizontal)
    const epx = -Math.sin(phi), epy = Math.cos(phi), epz = 0;
    // e_theta: unit vector along dip (cross of e_phi and normal, points down-dip)
    const etx = normal.y * epz - normal.z * epy;
    const ety = normal.z * epx - normal.x * epz;
    const etz = normal.x * epy - normal.y * epx;
    const rakeRad = (rake * Math.PI) / 180;
    return {
        x: Math.cos(rakeRad) * epx + Math.sin(rakeRad) * etx,
        y: Math.cos(rakeRad) * epy + Math.sin(rakeRad) * ety,
        z: Math.cos(rakeRad) * epz + Math.sin(rakeRad) * etz,
    };
}

/**
 * Convert trend/plunge angles to a direction vector.
 * Convention: trend is clockwise from North, plunge is angle below horizontal.
 */
function trendPlungeToVector(trend: number, plunge: number): Vector3D {
    const trendRad = trend * Math.PI / 180;
    const plungeRad = plunge * Math.PI / 180;
    return {
        x:  Math.cos(plungeRad) * Math.sin(trendRad),
        y:  Math.cos(plungeRad) * Math.cos(trendRad),
        z: -Math.sin(plungeRad),
    };
}
import StablePlotWithSettings from '../PlotWithSettings';
import {
    BaseVisualizationProps,
    useVisualizationState
} from '../VisualizationStateSystem';
import { beautifyName, TypeSynonyms } from '@/utils';
import {
    WulffSettings,
    WulffCompState,
    DATA_TYPE_CONFIGS,
    AvailableRepresentation,
    createWulffSettings
} from './WulffParameters';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getAvailableRepresentations(files: any[], enableByDefault = false): AvailableRepresentation[] {
    const available: AvailableRepresentation[] = [];

    Object.entries(DATA_TYPE_CONFIGS).forEach(([dataType, config]) => {
        config.representations.forEach(repr => {
            const availableInFiles = files
                .filter(file => {
                    // Transform dataType and column names to a standard format for comparison
                    file.headers = file.headers.map((h: string) => beautifyName(h));
                    const hasColumns = config.columns.some(columnConfig => {
                        return columnConfig.required.every(col => {
                            return file.headers && file.headers.includes(col)
                        })
                    }
                    )

                    const hasMatchingType = file.content.some((row: any) => row.type != null && TypeSynonyms.isSameType(dataType, row.type))
                    return hasColumns && hasMatchingType;
                })
                .map(file => file.id);

            if (availableInFiles.length > 0) {
                available.push({
                    key: `${dataType}_${repr.name}`,
                    dataType,
                    representation: repr,
                    availableInFiles,
                    enabled: enableByDefault,
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

const WulffComponent: React.FC<BaseVisualizationProps<WulffCompState> & { autoEnable?: boolean }> = ({
    files,
    width = 600,
    height = 600,
    title = "Wulff Stereonet",
    state,
    onStateChange,
    onDimensionChange,
    autoEnable = false
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [stereonet, setStereonet] = useState<Wulff | null>(null);
    const [dataStats, setDataStats] = useState<any>(null);
    const [showStylePopup, setShowStylePopup] = useState<string | null>(null);
    const [showDataPanel, setShowDataPanel] = useState(false);

    // ========== UTILISATION DU HOOK useVisualizationState ==========
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
    } = useVisualizationState<WulffCompState>(
        'wulff',
        createWulffSettings(), // ← Utilisation de la factory du WulffParameters
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

    // Update available representations when files change
    useEffect(() => {
        if (!files || files.length === 0) {
            return;
        }

        const newAvailableRepresentations = getAvailableRepresentations(files, autoEnable);
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

        // Use available space, accounting for dataStats panel (~80px) and padding
        const statsHeight = dataStats ? 80 : 0;
        const baseWidth = Math.max(currentState.plotDimensions.width - 32, 150);
        const baseHeight = Math.max(currentState.plotDimensions.height - statsHeight - 32, 150);
        const baseSize = Math.min(baseWidth, baseHeight);
        const zoomedSize = baseSize * currentState.settings.zoomLevel;
        const labelSize = 14 * currentState.settings.zoomLevel;

        const options: WulffOptions = {
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

        const newStereonet = new Wulff(containerId, options);
        setStereonet(newStereonet);
    }, [
        currentState.plotDimensions,
        currentState.settings.showGrid,
        currentState.settings.showDirections,
        currentState.settings.showLabels,
        currentState.settings.gridInterval,
        currentState.settings.gridColor,
        currentState.settings.backgroundColor,
        currentState.settings.borderColor,
        currentState.settings.zoomLevel
    ]);

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

                    const symbolSize = currentState.settings.symbolSize ?? 4;
                    const arrowLength = currentState.settings.arrowLength ?? 15;

                    if (processedData.data.length > 0) {
                        const dataStyle: DataStyle = {
                            color: repr.color,
                            width: 2,
                            size: symbolSize,
                            opacity: repr.opacity,
                            arrowLength,
                            arrowSize: Math.max(6, arrowLength * 0.55),
                            showLabels: currentState.settings.showLabels
                        };

                        plotDataOnStereonet(stereonet, processedData.data, repr, dataStyle);
                    }

                    if (currentState.settings.showPredicted && processedData.predicted.length > 0) {
                        const predictedStyle: DataStyle = {
                            color: currentState.settings.predictedColor,
                            width: 2,
                            size: symbolSize,
                            opacity: repr.opacity,
                            arrowLength,
                            arrowSize: Math.max(6, arrowLength * 0.55),
                            showLabels: false
                        };

                        plotPredictedOnStereonet(stereonet, processedData.predicted, repr, predictedStyle);
                    }
                });
            });

        // Overlay the principal stress axes (σ1, σ2, σ3) from the inversion, if present.
        // Treat undefined (old persisted settings) as "show".
        if (currentState.settings.showStressAxes !== false) {
            const axesFile = files.find(f => (f as any).stressAxes);
            const axes = (axesFile as any)?.stressAxes;
            if (axes) {
                const specs = [
                    { key: 'sigma1', label: 'σ1', color: '#dc2626' }, // red
                    { key: 'sigma2', label: 'σ2', color: '#16a34a' }, // green
                    { key: 'sigma3', label: 'σ3', color: '#2563eb' }, // blue
                ];
                // Stars are drawn a bit larger than data markers so they read clearly.
                const starSize = (currentState.settings.symbolSize ?? 4) * 2.2;
                specs.forEach(s => {
                    const dir = axes[s.key];
                    if (Array.isArray(dir) && dir.length === 3) {
                        stereonet.addPole(
                            { vector: libVec3ToVector3D(dir), id: s.label },
                            {
                                color: s.color,
                                fillColor: s.color,
                                strokeColor: '#000000',
                                size: starSize,
                                opacity: 1,
                                showLabels: true,
                            },
                            'star'
                        );
                    }
                });
            }
        }

        setDataStats(totalStats);
    }, [
        stereonet,
        currentState.settings.availableRepresentations,
        files,
        currentState.settings.showPredicted,
        currentState.settings.predictedColor,
        currentState.settings.showStressAxes,
        currentState.settings.symbolSize,
        currentState.settings.arrowLength
    ]);

    const processDataForRepresentation = (
        data: any[],
        config: any,
        repr: AvailableRepresentation,
        headers: string[]
    ) => {
        const result = { data: [] as any[], predicted: [] as any[], stats: { total: data.length, plotted: 0, errors: 0 } };
        const representationType = repr.representation.name;

        const workingColumnConfig = config.columns.find((columnConfig: any) =>
            columnConfig.required.every((col: string) => headers.includes(col))
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
                                const vector = trendPlungeToVector(trend, plunge);
                                dataPoint = { vector, id: index + 1 } as PoleData;
                            }
                        } else if (workingColumnConfig.required.includes('strike')) {
                            const strike = parseFloat(row.strike);
                            const dip = parseFloat(row.dip);
                            if (!isNaN(strike) && !isNaN(dip)) {
                                // Derive the pole from the plane normal (same source as the
                                // 'planes' / 'striated_planes' branches) so the azimuth is the
                                // true anti-dip direction. projectVector() then forces it into
                                // the lower hemisphere. The former strike+90 / 90−dip shortcut
                                // placed the pole on the dip side, making it look like an
                                // upper-hemisphere pole.
                                const dipDirection = parseDipDirection(row, strike);
                                const helper = new FaultDataHelper({ strike, dipDirection, dip });
                                const vector = libVec3ToVector3D(helper.normal);
                                dataPoint = { vector, id: index + 1 } as PoleData;
                            }
                        }
                        // Predicted pole = predicted plane normal (∥ σ3 for joints, σ1 for stylolites)
                        if (row.predicted_normal) {
                            result.predicted.push({ vector: libVec3ToVector3D(row.predicted_normal), id: index + 1 } as PoleData);
                        }
                    } else if (representationType === 'planes') {
                        if (workingColumnConfig.required.includes('trend')) {
                            const trend = parseFloat(row.trend);
                            const plunge = parseFloat(row.plunge);
                            if (!isNaN(trend) && !isNaN(plunge)) {
                                const normal = trendPlungeToVector(trend, plunge);
                                dataPoint = { normal, id: index + 1 } as ExtensionFractureData;
                            }
                        } else if (workingColumnConfig.required.includes('strike')) {
                            const strike = parseFloat(row.strike);
                            const dip = parseFloat(row.dip);
                            if (!isNaN(strike) && !isNaN(dip)) {
                                const dipDirection = parseDipDirection(row, strike);
                                const helper = new FaultDataHelper({ strike, dipDirection, dip });
                                const normal = libVec3ToVector3D(helper.normal);
                                dataPoint = { normal, id: index + 1 } as ExtensionFractureData;
                            }
                        }
                        // Predicted plane = great circle of the predicted normal
                        if (row.predicted_normal) {
                            result.predicted.push({ normal: libVec3ToVector3D(row.predicted_normal), id: index + 1 } as ExtensionFractureData);
                        }
                    } else if (representationType === 'striated_planes') {
                        const strike = parseFloat(row.strike);
                        const dip = parseFloat(row.dip);
                        const rake = parseFloat(row.rake);
                        if (!isNaN(strike) && !isNaN(dip) && !isNaN(rake)) {
                            const dipDirection = parseDipDirection(row, strike);
                            const planeHelper = new FaultDataHelper({ strike, dipDirection, dip });
                            const normal = libVec3ToVector3D(planeHelper.normal);
                            let striation: Vector3D;

                            try {
                                const movRaw = row['type of movement'];
                                const parsedMov = movRaw
                                    ? CTypeOfMovement.fromString(String(movRaw))
                                    : undefined;
                                const typeOfMovement = CTypeOfMovement.isOk(parsedMov) ? parsedMov : TypeOfMovement.UND;
                                const strikeDir = parseStrikeDirection(row);
                                const fullHelper = FaultDataHelper.create(
                                    { strike, dipDirection, dip },
                                    { trendIsDefined: false, rake, strikeDirection: strikeDir, typeOfMovement, trend: 0 }
                                );
                                striation = libVec3ToVector3D(fullHelper.striation);
                                // console.log('1', normal, striation)
                            } catch {
                                striation = striationFromRakeGeometry(normal, strike, rake);
                                // console.log('2', normal, striation)
                            }

                            dataPoint = { normal, striation, id: index + 1 } as StriatedPlaneData;

                            // Predicted striation = computed slip direction on the same plane
                            if (row.predicted_striation) {
                                result.predicted.push({
                                    normal,
                                    striation: libVec3ToVector3D(row.predicted_striation),
                                    id: index + 1
                                } as StriatedPlaneData);
                            }
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
        stereonet: Wulff,
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

    // Overlay the computed (predicted) data in a distinct colour. For striated planes we draw
    // only the striation arrow (the measured great circle is already drawn) so measured and
    // computed slip directions can be compared on the same plane.
    const plotPredictedOnStereonet = (
        stereonet: Wulff,
        predicted: any[],
        repr: AvailableRepresentation,
        style: DataStyle
    ) => {
        switch (repr.representation.name) {
            case 'poles':
                stereonet.addPoles(predicted as PoleData[], style, 'square');
                break;
            case 'planes':
                stereonet.addExtensionFractures(predicted as ExtensionFractureData[], style);
                break;
            case 'striated_planes':
                (predicted as StriatedPlaneData[]).forEach(p => stereonet.addStriationArrow(p, style));
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
        <div className="flex flex-col h-full overflow-hidden relative">
            {/* Stereonet container - takes remaining space */}
            <div className="flex-1 min-h-0 overflow-auto">
                <div
                    ref={containerRef}
                    className="w-full h-full border rounded-lg bg-white shadow-sm flex items-center justify-center"
                />
            </div>

            {/* Data stats panel - fixed at bottom */}
            {dataStats && (
                <div className="flex-shrink-0 p-3 bg-gray-50 rounded-lg mt-2 text-xs">
                    <div className="flex items-center gap-2 mb-2">
                        <Layers className="w-4 h-4 text-blue-600" />
                        <h4 className="font-semibold text-sm">Data Summary</h4>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
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

                    <label className="flex items-center justify-between">
                        <span className="text-sm">Show Predicted</span>
                        <input
                            type="checkbox"
                            checked={currentState.settings.showPredicted}
                            onChange={(e) => updateSettings({ showPredicted: e.target.checked })}
                            className="rounded"
                        />
                    </label>

                    {currentState.settings.showPredicted && (
                        <label className="flex items-center justify-between">
                            <span className="text-sm">Predicted Color</span>
                            <input
                                type="color"
                                value={currentState.settings.predictedColor}
                                onChange={(e) => updateSettings({ predictedColor: e.target.value })}
                                className="w-10 h-6 rounded"
                            />
                        </label>
                    )}

                    <label className="flex items-center justify-between">
                        <span className="text-sm">Show Stress Axes (σ₁ σ₂ σ₃)</span>
                        <input
                            type="checkbox"
                            checked={currentState.settings.showStressAxes !== false}
                            onChange={(e) => updateSettings({ showStressAxes: e.target.checked })}
                            className="rounded"
                        />
                    </label>

                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Symbol size: {currentState.settings.symbolSize ?? 4} px
                        </label>
                        <input
                            type="range"
                            min="2"
                            max="16"
                            step="1"
                            value={currentState.settings.symbolSize ?? 4}
                            onChange={(e) => updateSettings({ symbolSize: parseInt(e.target.value) })}
                            className="w-full"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Arrow length: {currentState.settings.arrowLength ?? 15} px
                        </label>
                        <input
                            type="range"
                            min="5"
                            max="40"
                            step="1"
                            value={currentState.settings.arrowLength ?? 15}
                            onChange={(e) => updateSettings({ arrowLength: parseInt(e.target.value) })}
                            className="w-full"
                        />
                    </div>

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
            onSettingsToggle={() => {
                toggleSettingsPanel();
                // Dimensions are now automatically synced via useEffect
            }}
        >
            {plotContent}
        </StablePlotWithSettings>
    );
};

export default WulffComponent;