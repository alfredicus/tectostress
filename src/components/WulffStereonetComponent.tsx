import React, { useEffect, useRef } from 'react';
import { Download, RotateCcw, Target } from 'lucide-react';
import StablePlotWithSettings from './PlotWithSettings';
import {
    BaseVisualizationProps,
    WulffCompState,
    WulffSettings,
    useVisualizationState,
    DefaultSettingsFactory,
    DataExporter,
    ColumnSelector,
    ColorInput,
    NumberInput,
    ColumnInfo
} from './VisualizationStateSystem';

// ============================================================================
// WULFF STEREONET COMPONENT
// ============================================================================

const WulffStereonetComponent: React.FC<BaseVisualizationProps<WulffCompState>> = ({
    files,
    width = 500,
    height = 500,
    title = "Wulff Stereonet",
    state,
    onStateChange,
    onDimensionChange
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [stereonet, setStereonet] = React.useState<any>(null);

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
    } = useVisualizationState<WulffCompState>(
        'wulff-stereonet',
        DefaultSettingsFactory.createWulffSettings(),
        files,
        width,
        height,
        state,
        onStateChange
    );

    // Initialize and update stereonet
    useEffect(() => {
        if (!containerRef.current) return;

        const data = getSelectedColumnData();

        // Use sample data if no data is available (for demonstration)
        const finalData = data.length > 0 ? data : generateSampleStereonetData();

        // Calculate effective dimensions
        const effectiveWidth = Math.max(currentState.plotDimensions.width - 40, 300);
        const effectiveHeight = Math.max(currentState.plotDimensions.height - 40, 300);

        // Clear container and create stereonet visualization
        containerRef.current.innerHTML = '';

        // Create a mock stereonet visualization (replace with actual implementation)
        const mockStereonet = createMockStereonet(
            containerRef.current,
            finalData,
            effectiveWidth,
            effectiveHeight,
            currentState.settings
        );

        setStereonet(mockStereonet);

        return () => {
            // Cleanup if needed
        };
    }, [currentState, getSelectedColumnData]);

    // Generate sample data for demonstration
    const generateSampleStereonetData = (): number[] => {
        return Array.from({ length: 50 }, () => Math.random() * 360);
    };

    // Mock stereonet creation (replace with actual Wulff stereonet implementation)
    const createMockStereonet = (
        container: HTMLElement,
        data: number[],
        width: number,
        height: number,
        settings: WulffSettings
    ) => {
        // This is a placeholder - replace with actual stereonet library
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.style.border = '1px solid #ccc';
        canvas.style.borderRadius = '8px';

        const ctx = canvas.getContext('2d');
        if (ctx) {
            // Draw basic stereonet circle
            const centerX = width / 2;
            const centerY = height / 2;
            const radius = Math.min(width, height) / 2 - 20;

            // Clear canvas
            ctx.clearRect(0, 0, width, height);

            // Draw outer circle
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw grid if enabled
            if (settings.showGrid) {
                ctx.strokeStyle = '#ccc';
                ctx.lineWidth = 1;

                // Draw meridians and parallels
                for (let i = 0; i < 360; i += settings.gridSpacing) {
                    const angle = (i * Math.PI) / 180;
                    ctx.beginPath();
                    ctx.moveTo(centerX, centerY);
                    ctx.lineTo(
                        centerX + radius * Math.cos(angle),
                        centerY + radius * Math.sin(angle)
                    );
                    ctx.stroke();
                }
            }

            // Plot data points
            ctx.fillStyle = settings.pointColor;
            data.forEach(angle => {
                const rad = (angle * Math.PI) / 180;
                const x = centerX + (radius * 0.8) * Math.cos(rad);
                const y = centerY + (radius * 0.8) * Math.sin(rad);

                ctx.beginPath();
                ctx.arc(x, y, settings.pointSize, 0, 2 * Math.PI);
                ctx.fill();
            });
        }

        container.appendChild(canvas);

        return {
            canvas,
            data,
            updateData: (newData: number[]) => {
                // Re-render with new data
                createMockStereonet(container, newData, width, height, settings);
            }
        };
    };

    // Export functionality
    const exportData = () => {
        const data = getSelectedColumnData();
        if (data.length === 0) return;
        DataExporter.exportCSV(data, 'wulff_stereonet_data.csv');
    };

    const exportState = () => {
        DataExporter.exportState(currentState, 'wulff_stereonet_state.json');
    };

    // Data summary calculation
    const getDataSummary = () => {
        const data = getSelectedColumnData();
        if (data.length === 0) {
            return { count: 0, min: 0, max: 0, filename: 'None' };
        }

        const selectedColumnInfo = getSelectedColumnInfo();
        return {
            count: data.length,
            min: Math.min(...data),
            max: Math.max(...data),
            filename: selectedColumnInfo?.fileName || 'Sample data'
        };
    };

    const dataSummary = getDataSummary();

    // Main plot content
    const plotContent = (
        <div className="flex flex-col h-full">
            {/* Column selector */}
            <ColumnSelector
                availableColumns={availableColumns}
                selectedColumn={currentState.selectedColumn}
                onColumnChange={updateSelectedColumn}
                label="Select Data Column (Orientations)"
            />

            {/* Stereonet container */}
            <div className="flex-1 min-h-0 mb-4">
                <div
                    ref={containerRef}
                    className="w-full h-full border rounded-lg bg-white shadow-sm flex items-center justify-center"
                />
            </div>

            {/* Data info panel */}
            <div className="flex-shrink-0 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                    <Target className="w-5 h-5 text-purple-600" />
                    <h4 className="font-semibold">Data Summary</h4>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="font-medium">File:</span> {dataSummary.filename}
                    </div>
                    <div>
                        <span className="font-medium">Count:</span> {dataSummary.count}
                    </div>
                    <div>
                        <span className="font-medium">Min:</span> {dataSummary.min.toFixed(2)}°
                    </div>
                    <div>
                        <span className="font-medium">Max:</span> {dataSummary.max.toFixed(2)}°
                    </div>
                </div>
            </div>
        </div>
    );

    // Settings panel content
    const settingsContent = (
        <div className="space-y-4">
            {/* Projection settings */}
            <div>
                <h5 className="font-medium text-gray-800 mb-3">Projection Settings</h5>
                <div className="space-y-3">
                    {/* Projection type */}
                    <div>
                        <label className="block text-sm font-medium mb-1">Projection Type</label>
                        <select
                            value={currentState.settings.projection}
                            onChange={(e) => updateSettings({ projection: e.target.value as 'stereonet' | 'equal-area' })}
                            className="w-full p-2 border rounded text-sm"
                        >
                            <option value="stereonet">Wulff Stereonet</option>
                            <option value="equal-area">Equal Area</option>
                        </select>
                    </div>

                    {/* Hemisphere */}
                    <div>
                        <label className="block text-sm font-medium mb-1">Hemisphere</label>
                        <select
                            value={currentState.settings.hemisphere}
                            onChange={(e) => updateSettings({ hemisphere: e.target.value as 'upper' | 'lower' })}
                            className="w-full p-2 border rounded text-sm"
                        >
                            <option value="upper">Upper Hemisphere</option>
                            <option value="lower">Lower Hemisphere</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Grid settings */}
            <div>
                <h5 className="font-medium text-gray-800 mb-3">Grid Settings</h5>
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

                    {currentState.settings.showGrid && (
                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Grid Spacing: {currentState.settings.gridSpacing}°
                            </label>
                            <input
                                type="range"
                                min="5"
                                max="30"
                                step="5"
                                value={currentState.settings.gridSpacing}
                                onChange={(e) => updateSettings({ gridSpacing: parseInt(e.target.value) })}
                                className="w-full"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Point settings */}
            <div>
                <h5 className="font-medium text-gray-800 mb-3">Point Settings</h5>
                <div className="space-y-3">
                    {/* Point size */}
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Point Size: {currentState.settings.pointSize}px
                        </label>
                        <input
                            type="range"
                            min="1"
                            max="10"
                            value={currentState.settings.pointSize}
                            onChange={(e) => updateSettings({ pointSize: parseInt(e.target.value) })}
                            className="w-full"
                        />
                    </div>

                    {/* Point color */}
                    <ColorInput
                        value={currentState.settings.pointColor}
                        onChange={(value) => updateSettings({ pointColor: value })}
                        label="Point Color"
                    />
                </div>
            </div>

            {/* Column info */}
            <ColumnInfo columnInfo={getSelectedColumnInfo()} />
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
                disabled={!stereonet}
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
            settingsPanelWidth={300}
            initialSettingsOpen={currentState.open}
            onSettingsToggle={(isOpen) => {
                // Handle settings panel toggle
                toggleSettingsPanel();

                // When settings panel opens/closes, adjust the plot dimensions
                setTimeout(() => {
                    if (containerRef.current) {
                        // Calculate available width for the plot
                        const containerWidth = containerRef.current.parentElement?.clientWidth || width || 500;
                        const settingsPanelWidth = isOpen ? 300 : 0;
                        const availableWidth = containerWidth - settingsPanelWidth - 40; // 40px for padding

                        const newDimensions = {
                            width: Math.max(availableWidth, 300), // Minimum width for plot
                            height: containerRef.current?.clientHeight || height || 500
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