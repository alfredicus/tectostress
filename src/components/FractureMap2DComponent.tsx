import React, { useEffect, useRef, useState } from 'react';
import { Download, RotateCcw, MapPin, Ruler } from 'lucide-react';
import StablePlotWithSettings from './PlotWithSettings';
import {
    BaseVisualizationProps,
    useVisualizationState,
    DefaultSettingsFactory,
    DataExporter
} from './VisualizationStateSystem';
import * as d3 from 'd3';

// ============================================================================
// TYPES ET INTERFACES
// ============================================================================

interface FracturePoint {
    x: number;
    y: number;
    strike: number;
    dip?: number;
    predictedStrike?: number;
    id?: number | string;
}

interface FractureMap2DSettings {
    showMeasured: boolean;
    showPredicted: boolean;
    measuredColor: string;
    predictedColor: string;
    pointSize: number;
    lineLength: number;
    lineWidth: number;
    showGrid: boolean;
    gridColor: string;
    backgroundColor: string;
    showLabels: boolean;
    labelSize: number;
    xAxisLabel: string;
    yAxisLabel: string;
    zoomLevel: number;
}

export interface FractureMap2DCompState {
    selectedColumn: string | null;
    plotDimensions: {
        width: number;
        height: number;
    };
    settings: FractureMap2DSettings;
    open: boolean;
}

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================

(DefaultSettingsFactory as any).createFractureMap2DSettings = (): FractureMap2DSettings => ({
    showMeasured: true,
    showPredicted: true,
    measuredColor: '#ff0000',
    predictedColor: '#0066cc',
    pointSize: 4,
    lineLength: 20,
    lineWidth: 2,
    showGrid: true,
    gridColor: '#e0e0e0',
    backgroundColor: '#ffffff',
    showLabels: true,
    labelSize: 12,
    xAxisLabel: 'X (m)',
    yAxisLabel: 'Y (m)',
    zoomLevel: 1.0
});

// ============================================================================
// CLASSE DE VISUALISATION
// ============================================================================

class FractureMap2D {
    private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private g: d3.Selection<SVGGElement, unknown, null, undefined>;
    private width: number;
    private height: number;
    private margin = { top: 30, right: 30, bottom: 50, left: 60 };
    private xScale!: d3.ScaleLinear<number, number>;
    private yScale!: d3.ScaleLinear<number, number>;

    constructor(containerId: string, width: number, height: number, backgroundColor: string) {
        this.width = width;
        this.height = height;

        const container = d3.select(`#${containerId}`);
        container.selectAll('*').remove();

        this.svg = container
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('background-color', backgroundColor);

        this.g = this.svg.append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
    }

    public plot(
        data: FracturePoint[],
        settings: FractureMap2DSettings
    ): void {
        this.g.selectAll('*').remove();

        if (data.length === 0) return;

        // Calculer les domaines
        const xExtent = d3.extent(data, d => d.x) as [number, number];
        const yExtent = d3.extent(data, d => d.y) as [number, number];

        const xPadding = (xExtent[1] - xExtent[0]) * 0.1;
        const yPadding = (yExtent[1] - yExtent[0]) * 0.1;

        this.xScale = d3.scaleLinear()
            .domain([xExtent[0] - xPadding, xExtent[1] + xPadding])
            .range([0, this.width - this.margin.left - this.margin.right]);

        this.yScale = d3.scaleLinear()
            .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
            .range([this.height - this.margin.top - this.margin.bottom, 0]);

        // Grille
        if (settings.showGrid) {
            this.drawGrid(settings.gridColor);
        }

        // Axes
        this.drawAxes(settings.xAxisLabel, settings.yAxisLabel);

        // Tracer les données
        data.forEach(point => {
            const x = this.xScale(point.x);
            const y = this.yScale(point.y);

            // Point central
            this.g.append('circle')
                .attr('cx', x)
                .attr('cy', y)
                .attr('r', settings.pointSize)
                .attr('fill', '#333333')
                .attr('stroke', 'white')
                .attr('stroke-width', 1);

            // Orientation mesurée
            if (settings.showMeasured && point.strike !== undefined) {
                this.drawOrientationLine(
                    x, y,
                    point.strike,
                    settings.lineLength,
                    settings.measuredColor,
                    settings.lineWidth
                );
            }

            // Orientation prédite
            if (settings.showPredicted && point.predictedStrike !== undefined) {
                this.drawOrientationLine(
                    x, y,
                    point.predictedStrike,
                    settings.lineLength,
                    settings.predictedColor,
                    settings.lineWidth,
                    true // dashed
                );
            }

            // Label
            if (settings.showLabels && point.id !== undefined) {
                this.g.append('text')
                    .attr('x', x + settings.pointSize + 3)
                    .attr('y', y - settings.pointSize - 3)
                    .attr('font-size', `${settings.labelSize}px`)
                    .attr('fill', '#666666')
                    .text(point.id);
            }
        });

        // Légende
        this.drawLegend(settings);
    }

    private drawOrientationLine(
        cx: number,
        cy: number,
        strike: number,
        length: number,
        color: string,
        width: number,
        dashed: boolean = false
    ): void {
        // Convertir strike en angle pour SVG (0° = Nord, sens horaire)
        // En SVG: 0° = Est, sens anti-horaire
        const angleRad = (90 - strike) * Math.PI / 180;

        const halfLength = length / 2;
        const x1 = cx - halfLength * Math.cos(angleRad);
        const y1 = cy + halfLength * Math.sin(angleRad);
        const x2 = cx + halfLength * Math.cos(angleRad);
        const y2 = cy - halfLength * Math.sin(angleRad);

        const line = this.g.append('line')
            .attr('x1', x1)
            .attr('y1', y1)
            .attr('x2', x2)
            .attr('y2', y2)
            .attr('stroke', color)
            .attr('stroke-width', width)
            .attr('stroke-linecap', 'round');

        if (dashed) {
            line.attr('stroke-dasharray', '4,4');
        }
    }

    private drawGrid(color: string): void {
        const xAxis = d3.axisBottom(this.xScale).ticks(10);
        const yAxis = d3.axisLeft(this.yScale).ticks(10);

        // Lignes verticales
        this.g.append('g')
            .attr('class', 'grid')
            .attr('transform', `translate(0,${this.height - this.margin.top - this.margin.bottom})`)
            .call(xAxis.tickSize(-(this.height - this.margin.top - this.margin.bottom)).tickFormat(() => ''))
            .style('stroke', color)
            .style('stroke-opacity', 0.5);

        // Lignes horizontales
        this.g.append('g')
            .attr('class', 'grid')
            .call(yAxis.tickSize(-(this.width - this.margin.left - this.margin.right)).tickFormat(() => ''))
            .style('stroke', color)
            .style('stroke-opacity', 0.5);
    }

    private drawAxes(xLabel: string, yLabel: string): void {
        const xAxis = d3.axisBottom(this.xScale);
        const yAxis = d3.axisLeft(this.yScale);

        // Axe X
        this.g.append('g')
            .attr('transform', `translate(0,${this.height - this.margin.top - this.margin.bottom})`)
            .call(xAxis);

        this.g.append('text')
            .attr('x', (this.width - this.margin.left - this.margin.right) / 2)
            .attr('y', this.height - this.margin.top - this.margin.bottom + 40)
            .attr('text-anchor', 'middle')
            .attr('fill', '#333333')
            .text(xLabel);

        // Axe Y
        this.g.append('g')
            .call(yAxis);

        this.g.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -(this.height - this.margin.top - this.margin.bottom) / 2)
            .attr('y', -45)
            .attr('text-anchor', 'middle')
            .attr('fill', '#333333')
            .text(yLabel);
    }

    private drawLegend(settings: FractureMap2DSettings): void {
        const legendG = this.g.append('g')
            .attr('transform', `translate(${this.width - this.margin.left - this.margin.right - 150}, 10)`);

        let yOffset = 0;

        if (settings.showMeasured) {
            legendG.append('line')
                .attr('x1', 0)
                .attr('y1', yOffset)
                .attr('x2', 30)
                .attr('y2', yOffset)
                .attr('stroke', settings.measuredColor)
                .attr('stroke-width', settings.lineWidth);

            legendG.append('text')
                .attr('x', 35)
                .attr('y', yOffset + 4)
                .attr('font-size', '12px')
                .attr('fill', '#333333')
                .text('Measured');

            yOffset += 20;
        }

        if (settings.showPredicted) {
            legendG.append('line')
                .attr('x1', 0)
                .attr('y1', yOffset)
                .attr('x2', 30)
                .attr('y2', yOffset)
                .attr('stroke', settings.predictedColor)
                .attr('stroke-width', settings.lineWidth)
                .attr('stroke-dasharray', '4,4');

            legendG.append('text')
                .attr('x', 35)
                .attr('y', yOffset + 4)
                .attr('font-size', '12px')
                .attr('fill', '#333333')
                .text('Predicted');
        }
    }

    public exportSVG(): string {
        return new XMLSerializer().serializeToString(this.svg.node()!);
    }
}

// ============================================================================
// COMPOSANT REACT
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
        (DefaultSettingsFactory as any).createFractureMap2DSettings(),
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