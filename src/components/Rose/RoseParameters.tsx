import { TCompState } from "../VisualizationStateSystem";

export interface RoseCompState extends TCompState<RoseSettings> {
    type: 'rose';
}

export interface RoseSettings {
    binAngle: number;
    binColor: string;
    lineColor: string;
    showLines: boolean;
    is360: boolean;
    showLabels: boolean;
    showCardinals: boolean;
    showCircles: boolean;
    innerRadius: number;
    zoomLevel: number;
}

export function createRoseSettings(): RoseSettings {
    return {
        binAngle: 10,
        binColor: '#FF0000',
        lineColor: '#000000',
        showLines: true,
        is360: false,
        showLabels: false,
        showCardinals: true,
        showCircles: true,
        innerRadius: 5,
        zoomLevel: 1.0
    };
}

/**
 * Icône du Rose Diagram
 */
export const RoseIcon: React.FC<{ size?: number; className?: string }> = ({
    size = 24,
    className = ""
}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
        <circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.6" />
        <g fill="currentColor" opacity="0.95">
            <path d="M 12 12 L 11.5 1 A 10.5 10.5 0 0 1 12.5 1 L 12 12 Z" />
            <path d="M 12 12 L 18.3 3.5 A 7 7 0 0 1 19 4.5 L 12 12 Z" />
            <path d="M 12 12 L 20.5 8 A 4 4 0 0 1 20.8 9 L 12 12 Z" />
            <path d="M 12 12 L 22.5 11.5 A 6 6 0 0 1 22.5 12.5 L 12 12 Z" />
            <path d="M 12 12 L 20.5 16 A 3.5 3.5 0 0 1 20 16.8 L 12 12 Z" />
            <path d="M 12 12 L 18.3 20.5 A 3 3 0 0 1 17.7 20.8 L 12 12 Z" />
            <path d="M 12 12 L 12.5 23 A 10 10 0 0 1 11.5 23 L 12 12 Z" />
            <path d="M 12 12 L 5.7 20.5 A 8 8 0 0 1 5 19.5 L 12 12 Z" />
            <path d="M 12 12 L 3.5 16 A 6 6 0 0 1 3.2 15 L 12 12 Z" />
            <path d="M 12 12 L 1.5 12.5 A 8.5 8.5 0 0 1 1.5 11.5 L 12 12 Z" />
            <path d="M 12 12 L 3.5 8 A 6.5 6.5 0 0 1 4.2 7 L 12 12 Z" />
            <path d="M 12 12 L 5.7 3.5 A 7.5 7.5 0 0 1 6.5 3 L 12 12 Z" />
        </g>
        <circle cx="12" cy="12" r="0.5" fill="currentColor" />
    </svg>
);