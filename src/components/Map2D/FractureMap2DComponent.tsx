import React, { useEffect, useRef, useState } from 'react';
import { Download, RotateCcw, MapPin } from 'lucide-react';
import StablePlotWithSettings from '../PlotWithSettings';
import {
    BaseVisualizationProps,
    useVisualizationState
} from '../VisualizationStateSystem';
import { createFractureMap2DSettings, FractureMap2DCompState, FracturePoint } from './FractureMap2DParameters';
import { FractureMap2D } from './FractureMap2D';

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

    const {
        state: currentState,
        availableColumns,
        updateSettings,
        updateSelectedColumn,
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

    // Extraire les données
    useEffect(() => {
        if (!files || files.length === 0) return;

        const extractedData: FracturePoint[] = [];
        let totalPoints = 0;
        let validPoints = 0;

        files.forEach(file => {
            const fileData = file.data || file.content;
            if (!fileData || fileData.length === 0) return;

            const hasRequiredColumns =
                file.headers.includes('x') &&
                file.headers.includes('y') &&
                file.headers.includes('strike');

            if (!hasRequiredColumns) return;

            fileData.forEach((row: any, index: number) => {
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
    }, [files]);

    // Initialiser la carte
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

    // Mettre à jour le tracé
    useEffect(() => {
        if (!map || data.length === 0) return;

        map.plot(data, currentState.settings);
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
                            min="2"
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
                disabled={!map}
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
            onSettingsToggle={toggleSettingsPanel}
        >
            {plotContent}
        </StablePlotWithSettings>
    );
};

export default FractureMap2DComponent;