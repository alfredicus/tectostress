import React, { useEffect, useRef, useState } from 'react';
import { WulffStereonet, WulffStereonetOptions, DataStyle, StriatedPlaneData, ExtensionFractureData, PoleData, LineData } from './views/WulffStereonet';
import { DataFiles } from './DataFile';
import { Settings, Download, RotateCcw, Eye, EyeOff } from 'lucide-react';

interface WulffStereonetComponentProps {
    files: DataFiles;
    width?: number;
    height?: number;
    options?: WulffStereonetOptions;
}

interface DataTypeSettings {
    visible: boolean;
    style: DataStyle;
    name: string;
}

interface DataTypeSettingsCollection {
    striatedPlanes: DataTypeSettings;
    extensionFractures: DataTypeSettings;
    stylolitePoles: DataTypeSettings;
    lineations: DataTypeSettings;
}

const WulffStereonetComponent: React.FC<WulffStereonetComponentProps> = ({
    files,
    width = 500,
    height = 500,
    options = {}
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const stereonetRef = useRef<WulffStereonet | null>(null);
    const [containerId] = useState(`wulff-${Date.now()}`);
    const [showSettings, setShowSettings] = useState(false);

    // Data type visibility and styling settings
    const [dataSettings, setDataSettings] = useState<DataTypeSettingsCollection>({
        striatedPlanes: {
            visible: true,
            style: { color: '#1f77b4', width: 2, size: 4, arrowSize: 15, showLabels: true },
            name: 'Striated Planes'
        },
        extensionFractures: {
            visible: true,
            style: { color: '#ff7f0e', width: 2, size: 4, showLabels: true },
            name: 'Extension Fractures'
        },
        stylolitePoles: {
            visible: true,
            style: { color: '#2ca02c', width: 2, size: 6, showLabels: true },
            name: 'Stylolite Poles'
        },
        lineations: {
            visible: true,
            style: { color: '#d62728', width: 2, size: 5, showLabels: true },
            name: 'Lineations'
        }
    });

    const defaultOptions: WulffStereonetOptions = {
        width,
        height,
        margin: 50,
        gridInterval: 10,
        showGrid: true,
        showDirections: true,
        showLabels: true,
        stereonetStyle: {
            gridColor: '#cccccc',
            gridWidth: 1,
            gridDashArray: '2,2',
            backgroundColor: 'white',
            borderColor: '#000000',
            borderWidth: 2,
            labelColor: '#000000',
            labelSize: '14px'
        },
        ...options
    };

    // Initialize stereonet
    useEffect(() => {
        if (containerRef.current) {
            stereonetRef.current = new WulffStereonet(containerId, defaultOptions);
            updateStereonet();
        }

        return () => {
            // Cleanup
            if (stereonetRef.current) {
                stereonetRef.current = null;
            }
        };
    }, []);

    // Update stereonet when files or settings change
    useEffect(() => {
        updateStereonet();
    }, [files, dataSettings]);

    const updateStereonet = () => {
        if (!stereonetRef.current || !files) return;

        // Clear existing data
        stereonetRef.current.clearData();

        // Process each file
        files.forEach(file => {
            file.content.forEach((row: any, index: number) => {
                const dataType = row.type?.toLowerCase();

                try {
                    switch (dataType) {
                        case 'striated plane':
                        case 'striated fault':
                            if (dataSettings.striatedPlanes.visible) {
                                const striatedData: StriatedPlaneData = {
                                    strike: parseFloat(row.strike || row['strike [0 360)']),
                                    dip: parseFloat(row.dip || row['dip [0 90]']),
                                    rake: parseFloat(row.rake || row['rake [0 90]']),
                                    id: row.id || index + 1
                                };
                                stereonetRef.current!.addStriatedPlane(striatedData, dataSettings.striatedPlanes.style);
                            }
                            break;

                        case 'extension fracture':
                            if (dataSettings.extensionFractures.visible) {
                                const fractureData: ExtensionFractureData = {
                                    strike: parseFloat(row.strike || row['strike [0 360)']),
                                    dip: parseFloat(row.dip || row['dip [0 90]']),
                                    id: row.id || index + 1
                                };
                                stereonetRef.current!.addExtensionFracture(fractureData, dataSettings.extensionFractures.style);
                            }
                            break;

                        case 'stylolite interface':
                        case 'stylolite peaks':
                            if (dataSettings.stylolitePoles.visible) {
                                // Convert plane to pole for stylolite interface
                                if (row.strike !== undefined && row.dip !== undefined) {
                                    const poleData: PoleData = {
                                        trend: (parseFloat(row.strike) + 90) % 360,
                                        plunge: 90 - parseFloat(row.dip),
                                        id: row.id || index + 1
                                    };
                                    stereonetRef.current!.addStylolitePole(poleData, dataSettings.stylolitePoles.style);
                                }
                                // Direct lineation data for stylolite peaks
                                else if (row['line trend'] !== undefined && row['line plunge'] !== undefined) {
                                    const poleData: PoleData = {
                                        trend: parseFloat(row['line trend'] || row['line trend [0 360)']),
                                        plunge: parseFloat(row['line plunge'] || row['line plunge [0 90]']),
                                        id: row.id || index + 1
                                    };
                                    stereonetRef.current!.addStylolitePole(poleData, dataSettings.stylolitePoles.style);
                                }
                            }
                            break;

                        case 'crystal fibers in vein':
                            if (dataSettings.lineations.visible) {
                                const lineData: LineData = {
                                    trend: parseFloat(row['line trend'] || row['line trend [0 360)']),
                                    plunge: parseFloat(row['line plunge'] || row['line plunge [0 90]']),
                                    id: row.id || index + 1
                                };
                                stereonetRef.current!.addLineation(lineData, dataSettings.lineations.style);
                            }
                            break;

                        default:
                            console.warn(`Unknown data type: ${dataType}`);
                    }
                } catch (error) {
                    console.error(`Error processing row ${index + 1} of file ${file.name}:`, error);
                }
            });
        });
    };

    const handleDataSettingChange = (
        dataType: keyof DataTypeSettingsCollection,
        property: keyof DataTypeSettings | string,
        value: any
    ) => {
        setDataSettings(prev => ({
            ...prev,
            [dataType]: {
                ...prev[dataType],
                [property]: property === 'style' ? { ...prev[dataType].style, ...value } : value
            }
        }));
    };

    const handleStyleChange = (
        dataType: keyof DataTypeSettingsCollection,
        styleProperty: keyof DataStyle,
        value: any
    ) => {
        setDataSettings(prev => ({
            ...prev,
            [dataType]: {
                ...prev[dataType],
                style: {
                    ...prev[dataType].style,
                    [styleProperty]: value
                }
            }
        }));
    };

    const exportSVG = () => {
        if (stereonetRef.current) {
            const svgString = stereonetRef.current.exportSVG();
            const blob = new Blob([svgString], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = 'wulff_stereonet.svg';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    };

    const resetView = () => {
        if (stereonetRef.current) {
            stereonetRef.current.updateOptions(defaultOptions);
            updateStereonet();
        }
    };

    const toggleDataType = (dataType: keyof DataTypeSettingsCollection) => {
        handleDataSettingChange(dataType, 'visible', !dataSettings[dataType].visible);
    };

    const ColorInput: React.FC<{
        value: string;
        onChange: (value: string) => void;
        label: string;
    }> = ({ value, onChange, label }) => (
        <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 min-w-[60px]">{label}:</label>
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
            <label className="text-sm font-medium text-gray-700 min-w-[60px]">{label}:</label>
            <input
                type="number"
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                min={min}
                max={max}
                step={step}
                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>
    );

    const DataTypeSettingsPanel: React.FC<{
        dataType: keyof DataTypeSettingsCollection;
        settings: DataTypeSettings;
    }> = ({ dataType, settings }) => (
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-800">{settings.name}</h4>
                <button
                    onClick={() => toggleDataType(dataType)}
                    className={`p-1 rounded transition-colors ${settings.visible
                            ? 'text-green-600 hover:bg-green-100'
                            : 'text-gray-400 hover:bg-gray-200'
                        }`}
                    title={settings.visible ? 'Hide' : 'Show'}
                >
                    {settings.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
            </div>

            {settings.visible && (
                <div className="space-y-2">
                    <ColorInput
                        value={settings.style.color || '#000000'}
                        onChange={(value) => handleStyleChange(dataType, 'color', value)}
                        label="Color"
                    />

                    <NumberInput
                        value={settings.style.width || 2}
                        onChange={(value) => handleStyleChange(dataType, 'width', value)}
                        label="Width"
                        min={0.5}
                        max={10}
                        step={0.5}
                    />

                    <NumberInput
                        value={settings.style.size || 4}
                        onChange={(value) => handleStyleChange(dataType, 'size', value)}
                        label="Size"
                        min={1}
                        max={20}
                    />

                    {dataType === 'striatedPlanes' && (
                        <NumberInput
                            value={settings.style.arrowSize || 15}
                            onChange={(value) => handleStyleChange(dataType, 'arrowSize', value)}
                            label="Arrow"
                            min={5}
                            max={30}
                        />
                    )}

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={settings.style.showLabels || false}
                            onChange={(e) => handleStyleChange(dataType, 'showLabels', e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label className="text-sm text-gray-700">Show Labels</label>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="flex gap-4">
            {/* Main stereonet display */}
            <div className="flex-shrink-0">
                <div className="bg-white border border-gray-300 rounded-lg p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-800">Wulff Stereonet</h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className={`p-2 rounded transition-colors ${showSettings
                                        ? 'bg-blue-100 text-blue-600'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                title="Settings"
                            >
                                <Settings size={16} />
                            </button>
                            <button
                                onClick={resetView}
                                className="p-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                                title="Reset View"
                            >
                                <RotateCcw size={16} />
                            </button>
                            <button
                                onClick={exportSVG}
                                className="p-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                                title="Export SVG"
                            >
                                <Download size={16} />
                            </button>
                        </div>
                    </div>

                    <div ref={containerRef} id={containerId} className="flex justify-center" />

                    {/* Data summary */}
                    <div className="mt-4 text-sm text-gray-600">
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(dataSettings).map(([key, settings]) => {
                                const count = files?.reduce((total, file) => {
                                    return total + file.content.filter(row => {
                                        const type = row.type?.toLowerCase();
                                        switch (key) {
                                            case 'striatedPlanes':
                                                return type === 'striated plane' || type === 'striated fault';
                                            case 'extensionFractures':
                                                return type === 'extension fracture';
                                            case 'stylolitePoles':
                                                return type === 'stylolite interface' || type === 'stylolite peaks';
                                            case 'lineations':
                                                return type === 'crystal fibers in vein';
                                            default:
                                                return false;
                                        }
                                    }).length;
                                }, 0) || 0;

                                return (
                                    <div key={key} className="flex items-center gap-2">
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: settings.visible ? settings.style.color : '#cccccc' }}
                                        />
                                        <span>{settings.name}: {count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Settings panel */}
            {showSettings && (
                <div className="w-80 bg-white border border-gray-300 rounded-lg p-4 shadow-sm">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4">Display Settings</h4>

                    <div className="space-y-4">
                        {Object.entries(dataSettings).map(([key, settings]) => (
                            <DataTypeSettingsPanel
                                key={key}
                                dataType={key as keyof DataTypeSettingsCollection}
                                settings={settings}
                            />
                        ))}

                        {/* Global settings */}
                        <div className="border-t pt-4">
                            <h5 className="font-medium text-gray-800 mb-3">Global Settings</h5>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={defaultOptions.showGrid}
                                        onChange={(e) => {
                                            const newOptions = { ...defaultOptions, showGrid: e.target.checked };
                                            if (stereonetRef.current) {
                                                stereonetRef.current.updateOptions(newOptions);
                                            }
                                        }}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <label className="text-sm text-gray-700">Show Grid</label>
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={defaultOptions.showDirections}
                                        onChange={(e) => {
                                            const newOptions = { ...defaultOptions, showDirections: e.target.checked };
                                            if (stereonetRef.current) {
                                                stereonetRef.current.updateOptions(newOptions);
                                            }
                                        }}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <label className="text-sm text-gray-700">Show Directions</label>
                                </div>

                                <NumberInput
                                    value={defaultOptions.gridInterval || 10}
                                    onChange={(value) => {
                                        const newOptions = { ...defaultOptions, gridInterval: value };
                                        if (stereonetRef.current) {
                                            stereonetRef.current.updateOptions(newOptions);
                                        }
                                    }}
                                    label="Grid Interval"
                                    min={5}
                                    max={30}
                                    step={5}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WulffStereonetComponent;