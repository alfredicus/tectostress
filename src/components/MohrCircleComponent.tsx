import React, { useEffect, useRef } from 'react';
import { MohrCircle, MohrParameters } from './views/MohrCircle';
import { Download, RotateCcw, Circle, Gauge } from 'lucide-react';
import StablePlotWithSettings from './PlotWithSettings';
import {
    BaseVisualizationProps,
    TCompState,
    useVisualizationState,
    DataExporter,
    ColorInput,
    NumberInput
} from './VisualizationStateSystem';

// Add Mohr settings to the main VisualizationStateSystem if needed
declare module './VisualizationStateSystem' {
    interface MohrSettings {
        sigma1: number;
        sigma2: number;
        sigma3: number;
        n1: number;
        n2: number;
        n3: number;
        showGrid: boolean;
        showLabels: boolean;
        showColoredArea: boolean;
        showStressPoint: boolean;
        circle1Color: string;
        circle2Color: string;
        circle3Color: string;
        areaColor: string;
        stressPointColor: string;
        strokeWidth: number;
    }

    interface MohrCompState extends TCompState<MohrSettings> {
        type: 'mohr';
    }
}

// ============================================================================
// MOHR CIRCLE SETTINGS
// ============================================================================

export interface MohrSettings {
    sigma1: number;
    sigma2: number;
    sigma3: number;
    n1: number;
    n2: number;
    n3: number;
    showGrid: boolean;
    showLabels: boolean;
    showColoredArea: boolean;
    showStressPoint: boolean;
    circle1Color: string;
    circle2Color: string;
    circle3Color: string;
    areaColor: string;
    stressPointColor: string;
    strokeWidth: number;
}

export interface MohrCompState extends TCompState<MohrSettings> {
    type: 'mohr';
}

// ============================================================================
// DEFAULT SETTINGS FACTORY
// ============================================================================

const createDefaultMohrSettings = (): MohrSettings => ({
    sigma1: 100,
    sigma2: 60,
    sigma3: 20,
    n1: 1 / Math.sqrt(3),
    n2: 1 / Math.sqrt(3),
    n3: 1 / Math.sqrt(3),
    showGrid: true,
    showLabels: true,
    showColoredArea: true,
    showStressPoint: true,
    circle1Color: '#0066cc',
    circle2Color: '#ff6b35',
    circle3Color: '#28a745',
    areaColor: 'rgba(200, 200, 200, 0.3)',
    stressPointColor: '#8e44ad',
    strokeWidth: 2
});

// ============================================================================
// MOHR CIRCLE COMPONENT
// ============================================================================

const MohrCircleComponent: React.FC<BaseVisualizationProps<MohrCompState>> = ({
    files,
    width = 600,
    height = 400,
    title = "Mohr Circle",
    state,
    onStateChange,
    onDimensionChange
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [mohrCircle, setMohrCircle] = React.useState<MohrCircle | null>(null);
    const [stressState, setStressState] = React.useState<any>(null);

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
    } = useVisualizationState<MohrCompState>(
        'mohr-circle',
        createDefaultMohrSettings(),
        files,
        width,
        height,
        state,
        onStateChange
    );

    // Initialize and update Mohr circle
    useEffect(() => {
        if (!containerRef.current) return;

        // Calculate effective dimensions
        const effectiveWidth = Math.max(currentState.plotDimensions.width - 40, 400);
        const effectiveHeight = Math.max(currentState.plotDimensions.height - 40, 300);

        const params: MohrParameters = {
            width: effectiveWidth,
            height: effectiveHeight,
            title: title,
            draw: {
                grid: currentState.settings.showGrid,
                labels: currentState.settings.showLabels,
                axes: true,
                coloredArea: currentState.settings.showColoredArea,
                stressPoint: currentState.settings.showStressPoint
            },
            colors: {
                circle1: currentState.settings.circle1Color,
                circle2: currentState.settings.circle2Color,
                circle3: currentState.settings.circle3Color,
                area: currentState.settings.areaColor,
                stressPoint: currentState.settings.stressPointColor,
                principalPoints: '#333333'
            },
            strokeWidth: currentState.settings.strokeWidth
        };

        const newMohr = new MohrCircle(containerRef.current, params);

        // Set the stress values and normal vector
        newMohr.setPrincipalStresses(
            currentState.settings.sigma1,
            currentState.settings.sigma2,
            currentState.settings.sigma3
        );

        newMohr.normalVector = [
            currentState.settings.n1,
            currentState.settings.n2,
            currentState.settings.n3
        ];

        setMohrCircle(newMohr);

        // Update stress state info
        const stressInfo = newMohr.getStressState();
        setStressState(stressInfo);

        return () => {
            // Cleanup if needed
        };
    }, [currentState, title]);

    // Helper function to normalize vector and update all components
    const updateNormalVector = (n1: number, n2: number, n3: number) => {
        const magnitude = Math.sqrt(n1 * n1 + n2 * n2 + n3 * n3);
        if (magnitude === 0) return;

        const normalized = {
            n1: n1 / magnitude,
            n2: n2 / magnitude,
            n3: n3 / magnitude
        };

        updateSettings(normalized);
    };

    // Helper function to ensure principal stress order (σ1 >= σ2 >= σ3)
    const updatePrincipalStress = (stressType: 'sigma1' | 'sigma2' | 'sigma3', value: number) => {
        const current = currentState.settings;
        let newStresses = { sigma1: current.sigma1, sigma2: current.sigma2, sigma3: current.sigma3 };

        newStresses[stressType] = value;

        // Sort to maintain order
        const sortedValues = [newStresses.sigma1, newStresses.sigma2, newStresses.sigma3].sort((a, b) => b - a);

        updateSettings({
            sigma1: sortedValues[0],
            sigma2: sortedValues[1],
            sigma3: sortedValues[2]
        });
    };

    // Export functionality
    const exportData = () => {
        if (!mohrCircle) return;
        const csvData = mohrCircle.exportData();
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'mohr_circle_data.csv';
        link.click();
        URL.revokeObjectURL(url);
    };

    const exportState = () => {
        DataExporter.exportState(currentState, 'mohr_circle_state.json');
    };

    // Main plot content
    const plotContent = (
        <div className="flex flex-col h-full">
            {/* Mohr circle container */}
            <div className="flex-1 min-h-0 mb-4">
                <div
                    ref={containerRef}
                    className="w-full h-full border rounded-lg bg-white shadow-sm flex items-center justify-center"
                />
            </div>

            {/* Stress state summary */}
            {stressState && (
                <div className="flex-shrink-0 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                        <Gauge className="w-5 h-5 text-purple-600" />
                        <h4 className="font-semibold">Stress State</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="font-medium">σn:</span> {stressState.stressPoint.sigma_n.toFixed(2)}
                        </div>
                        <div>
                            <span className="font-medium">τ:</span> {stressState.stressPoint.tau.toFixed(2)}
                        </div>
                        <div>
                            <span className="font-medium">Max τ:</span> {stressState.maxShearStress.toFixed(2)}
                        </div>
                        <div>
                            <span className="font-medium">Mean σ:</span> {stressState.meanStress.toFixed(2)}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // Settings panel content
    const settingsContent = (
        <div className="space-y-4">
            {/* Principal Stresses */}
            <div>
                <h5 className="font-medium text-gray-800 mb-3">Principal Stresses</h5>
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            σ1 (Max): {currentState.settings.sigma1.toFixed(1)}
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="200"
                            step="1"
                            value={currentState.settings.sigma1}
                            onChange={(e) => updatePrincipalStress('sigma1', parseFloat(e.target.value))}
                            className="w-full"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">
                            σ2 (Intermediate): {currentState.settings.sigma2.toFixed(1)}
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="200"
                            step="1"
                            value={currentState.settings.sigma2}
                            onChange={(e) => updatePrincipalStress('sigma2', parseFloat(e.target.value))}
                            className="w-full"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">
                            σ3 (Min): {currentState.settings.sigma3.toFixed(1)}
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="200"
                            step="1"
                            value={currentState.settings.sigma3}
                            onChange={(e) => updatePrincipalStress('sigma3', parseFloat(e.target.value))}
                            className="w-full"
                        />
                    </div>
                </div>
            </div>

            {/* Normal Vector */}
            <div>
                <h5 className="font-medium text-gray-800 mb-3">Normal Vector (n)</h5>
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            n1: {currentState.settings.n1.toFixed(3)}
                        </label>
                        <input
                            type="range"
                            min="-1"
                            max="1"
                            step="0.01"
                            value={currentState.settings.n1}
                            onChange={(e) => updateNormalVector(
                                parseFloat(e.target.value),
                                currentState.settings.n2,
                                currentState.settings.n3
                            )}
                            className="w-full"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">
                            n2: {currentState.settings.n2.toFixed(3)}
                        </label>
                        <input
                            type="range"
                            min="-1"
                            max="1"
                            step="0.01"
                            value={currentState.settings.n2}
                            onChange={(e) => updateNormalVector(
                                currentState.settings.n1,
                                parseFloat(e.target.value),
                                currentState.settings.n3
                            )}
                            className="w-full"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">
                            n3: {currentState.settings.n3.toFixed(3)}
                        </label>
                        <input
                            type="range"
                            min="-1"
                            max="1"
                            step="0.01"
                            value={currentState.settings.n3}
                            onChange={(e) => updateNormalVector(
                                currentState.settings.n1,
                                currentState.settings.n2,
                                parseFloat(e.target.value)
                            )}
                            className="w-full"
                        />
                    </div>

                    <div className="text-xs text-gray-500">
                        Magnitude: {Math.sqrt(
                            currentState.settings.n1 ** 2 +
                            currentState.settings.n2 ** 2 +
                            currentState.settings.n3 ** 2
                        ).toFixed(3)}
                    </div>
                </div>
            </div>

            {/* Display Options */}
            <div>
                <h5 className="font-medium text-gray-800 mb-3">Display Options</h5>
                <div className="space-y-2">
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

                    <label className="flex items-center justify-between">
                        <span className="text-sm">Show Colored Area</span>
                        <input
                            type="checkbox"
                            checked={currentState.settings.showColoredArea}
                            onChange={(e) => updateSettings({ showColoredArea: e.target.checked })}
                            className="rounded"
                        />
                    </label>

                    <label className="flex items-center justify-between">
                        <span className="text-sm">Show Stress Point</span>
                        <input
                            type="checkbox"
                            checked={currentState.settings.showStressPoint}
                            onChange={(e) => updateSettings({ showStressPoint: e.target.checked })}
                            className="rounded"
                        />
                    </label>
                </div>
            </div>

            {/* Colors */}
            <div>
                <h5 className="font-medium text-gray-800 mb-3">Colors</h5>
                <div className="space-y-3">
                    <ColorInput
                        value={currentState.settings.circle1Color}
                        onChange={(value) => updateSettings({ circle1Color: value })}
                        label="Circle 1 (σ1-σ3)"
                    />

                    <ColorInput
                        value={currentState.settings.circle2Color}
                        onChange={(value) => updateSettings({ circle2Color: value })}
                        label="Circle 2 (σ1-σ2)"
                    />

                    <ColorInput
                        value={currentState.settings.circle3Color}
                        onChange={(value) => updateSettings({ circle3Color: value })}
                        label="Circle 3 (σ2-σ3)"
                    />

                    <ColorInput
                        value={currentState.settings.stressPointColor}
                        onChange={(value) => updateSettings({ stressPointColor: value })}
                        label="Stress Point"
                    />
                </div>
            </div>

            {/* Stroke Width */}
            <div>
                <h5 className="font-medium text-gray-800 mb-3">Appearance</h5>
                <div>
                    <label className="block text-sm font-medium mb-1">
                        Stroke Width: {currentState.settings.strokeWidth}
                    </label>
                    <input
                        type="range"
                        min="1"
                        max="5"
                        step="0.5"
                        value={currentState.settings.strokeWidth}
                        onChange={(e) => updateSettings({ strokeWidth: parseFloat(e.target.value) })}
                        className="w-full"
                    />
                </div>
            </div>

            {/* Quick presets */}
            <div>
                <h5 className="font-medium text-gray-800 mb-3">Quick Presets</h5>
                <div className="space-y-2">
                    <button
                        onClick={() => updateSettings({
                            sigma1: 100, sigma2: 60, sigma3: 20,
                            n1: 1 / Math.sqrt(3), n2: 1 / Math.sqrt(3), n3: 1 / Math.sqrt(3)
                        })}
                        className="w-full px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                    >
                        Default State
                    </button>

                    <button
                        onClick={() => updateSettings({
                            sigma1: 80, sigma2: 40, sigma3: 0,
                            n1: 1, n2: 0, n3: 0
                        })}
                        className="w-full px-3 py-2 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                    >
                        Uniaxial Tension
                    </button>

                    <button
                        onClick={() => updateSettings({
                            sigma1: 50, sigma2: 50, sigma3: 0,
                            n1: 0.707, n2: 0.707, n3: 0
                        })}
                        className="w-full px-3 py-2 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
                    >
                        Biaxial State
                    </button>

                    <button
                        onClick={() => updateNormalVector(
                            Math.random() - 0.5,
                            Math.random() - 0.5,
                            Math.random() - 0.5
                        )}
                        className="w-full px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                    >
                        Random Normal Vector
                    </button>
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
                onClick={exportData}
                disabled={!mohrCircle}
                className="p-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                title="Export Data"
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
                // Handle settings panel toggle
                toggleSettingsPanel();

                // When settings panel opens/closes, adjust the plot dimensions
                setTimeout(() => {
                    if (containerRef.current) {
                        // Calculate available width for the plot
                        const containerWidth = containerRef.current.parentElement?.clientWidth || width || 600;
                        const settingsPanelWidth = isOpen ? 320 : 0;
                        const availableWidth = containerWidth - settingsPanelWidth - 40; // 40px for padding

                        const newDimensions = {
                            width: Math.max(availableWidth, 400), // Minimum width for plot
                            height: containerRef.current?.clientHeight || height || 400
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

export default MohrCircleComponent;