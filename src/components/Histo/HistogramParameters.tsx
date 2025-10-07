import { TCompState } from "../VisualizationStateSystem";

export interface HistogramCompState extends TCompState<HistogramSettings> {
    type: 'histogram';
}

export interface HistogramSettings {
    bins: number;
    fillColor: string;
    strokeColor: string;
    showGrid: boolean;
    showDensity: boolean;
    showLabels: boolean;
    xAxisLabel: string;
    yAxisLabel: string;
    zoomLevel: number;
}

export function createHistogramSettings(): HistogramSettings {
    return {
        bins: 20,
        fillColor: '#3498db',
        strokeColor: '#2c3e50',
        showGrid: true,
        showDensity: false,
        showLabels: true,
        xAxisLabel: 'Value',
        yAxisLabel: 'Frequency',
        zoomLevel: 1.0
    };
}