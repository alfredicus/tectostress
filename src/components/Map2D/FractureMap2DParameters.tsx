import { TCompState } from "../VisualizationStateSystem";

export interface FractureMap2DCompState extends TCompState<FractureMap2DSettings> {
    type: 'fractureMap2D';
}

export const FractureMapIcon: React.FC<{ size?: number; className?: string }> = ({
    size = 24,
    className = ""
}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="3" y="3" width="18" height="18" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.3" />
        <line x1="5" y1="7" x2="10" y2="7" stroke="currentColor" strokeWidth="2" />
        <line x1="14" y1="10" x2="19" y2="10" stroke="currentColor" strokeWidth="2" />
        <line x1="6" y1="14" x2="12" y2="14" stroke="currentColor" strokeWidth="2" />
        <line x1="15" y1="17" x2="19" y2="17" stroke="currentColor" strokeWidth="2" />
        <circle cx="7.5" cy="7" r="1.5" fill="currentColor" />
        <circle cx="16.5" cy="10" r="1.5" fill="currentColor" />
        <circle cx="9" cy="14" r="1.5" fill="currentColor" />
        <circle cx="17" cy="17" r="1.5" fill="currentColor" />
    </svg>
);

export interface FractureMap2DSettings {
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

    selectedColumn: string | null;
    plotDimensions: {
        width: number;
        height: number;
    };
    settings: FractureMap2DSettings;
    open: boolean;
}

export interface FracturePoint {
    x: number;
    y: number;
    strike: number;
    dip?: number;
    predictedStrike?: number;
    id?: number | string;
}

export function createFractureMap2DSettings(): FractureMap2DSettings {
    return {
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
    };
}