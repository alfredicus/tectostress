// StereonetParameters.tsx
// Définitions des types et configurations pour le Stereonet

import { TCompState } from "../VisualizationStateSystem";

import { ProjectionType } from "./Stereonet";

// ============================================================================
// CONFIGURATION DES TYPES DE DONNÉES GÉOLOGIQUES
// ============================================================================

/**
 * State complet pour le Stereonet
 */
export interface StereonetCompState extends TCompState<StereonetSettings> {
    type: 'wulff';
}

export const StereonetIcon: React.FC<{ size?: number; className?: string }> = ({
    size = 24,
    className = ""
}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.5" />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.3" />
        <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="0.5" />
        <line x1="12" y1="2" x2="12" y2="22" stroke="currentColor" strokeWidth="0.5" />
    </svg>
);

export interface ColumnConfig {
    required: string[];
}

export interface RepresentationConfig {
    name: string;
    displayName: string;
    symbol: string;
    defaultColor: string;
}

export interface DataTypeConfig {
    displayName: string;
    columns: ColumnConfig[];
    representations: RepresentationConfig[];
}

export const DATA_TYPE_CONFIGS: Record<string, DataTypeConfig> = {
    stylolite: {
        displayName: 'Stylolite',
        columns: [
            { required: ['trend', 'plunge'] },
            { required: ['strike', 'dip'] },
            { required: ['dip', 'strike', 'dip direction'] },
        ],
        representations: [
            {
                name: 'poles',
                displayName: 'Stylolite Poles',
                symbol: '✕',
                defaultColor: '#00ff00'
            },
            {
                name: 'planes',
                displayName: 'Stylolite Planes',
                symbol: '──',
                defaultColor: '#008800'
            }
        ]
    },
    joint: {
        displayName: 'Joint',
        columns: [
            { required: ['trend', 'plunge'] },
            { required: ['strike', 'dip'] },
            { required: ['dip', 'strike', 'dip direction'] },
        ],
        representations: [
            {
                name: 'poles',
                displayName: 'Joint Poles',
                symbol: '●',
                defaultColor: '#ff0000'
            },
            {
                name: 'planes',
                displayName: 'Joint Planes',
                symbol: '──',
                defaultColor: '#cc0000'
            }
        ]
    },
    'dilation band': {
        displayName: 'Dilation Band',
        columns: [
            { required: ['trend', 'plunge'] },
            { required: ['strike', 'dip'] },
            { required: ['dip', 'strike', 'dip direction'] },
        ],
        representations: [
            {
                name: 'poles',
                displayName: 'Dilation Band Poles',
                symbol: '●',
                defaultColor: '#8e44ad'
            },
            {
                name: 'planes',
                displayName: 'Dilation Band Planes',
                symbol: '──',
                defaultColor: '#6c3483'
            }
        ]
    },
    'compaction band': {
        displayName: 'Compaction Band',
        columns: [
            { required: ['trend', 'plunge'] },
            { required: ['strike', 'dip'] },
            { required: ['dip', 'strike', 'dip direction'] },
        ],
        representations: [
            {
                name: 'poles',
                displayName: 'Compaction Band Poles',
                symbol: '●',
                defaultColor: '#0097a7'
            },
            {
                name: 'planes',
                displayName: 'Compaction Band Planes',
                symbol: '──',
                defaultColor: '#00695c'
            }
        ]
    },
    fault: {
        displayName: 'Fault',
        columns: [
            { required: ['strike', 'dip', 'rake'] },
            { required: ['dip', 'strike', 'dip direction', 'rake'] },
        ],
        representations: [
            {
                name: 'poles',
                displayName: 'Fault Poles',
                symbol: '●',
                defaultColor: '#ff0000'
            },
            {
                name: 'striated_planes',
                displayName: 'Fault Planes',
                symbol: '→',
                defaultColor: '#ff6600'
            }
        ]
    }
};

// ============================================================================
// REPRÉSENTATIONS DISPONIBLES
// ============================================================================

export interface AvailableRepresentation {
    key: string;
    dataType: string;
    representation: RepresentationConfig;
    availableInFiles: string[];
    enabled: boolean;
    color: string;
    opacity: number;
}

// ============================================================================
// SETTINGS ET STATE (VERSION COMPLÈTE - UTILISÉE PAR LE COMPOSANT)
// ============================================================================

/**
 * Settings complets pour le Stereonet
 * C'est la version RÉELLE utilisée par le composant
 */
export interface StereonetSettings {
    /** Wulff (equal-angle) or Schmidt (equal-area) net */
    projection: ProjectionType;
    showGrid: boolean;
    showDirections: boolean;
    showLabels: boolean;
    gridInterval: number;
    gridColor: string;
    gridWidth: number;
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
    selectedFiles: string[];
    availableRepresentations: AvailableRepresentation[];
    zoomLevel: number;
    // Predicted (computed) data overlay — populated after a stress inversion run
    showPredicted: boolean;
    predictedColor: string;
    // Principal stress axes (σ1, σ2, σ3) overlay — populated after a stress inversion run
    showStressAxes: boolean;
    // Marker size (poles, stars) and striation arrow length, in pixels
    symbolSize: number;
    arrowLength: number;
    // Pole density contours: data types to contour (keys of DATA_TYPE_CONFIGS) and/or
    // DENSITY_ALL for every pole together; each target is contoured separately
    densityTargets: string[];
    densityLevels: number;
    densitySigma: number;
    densityFill: boolean;
}

/** Density target meaning "the poles of every data type together" */
export const DENSITY_ALL = '__all__';
export const DENSITY_ALL_COLOR = '#374151';

// ============================================================================
// FACTORY POUR CRÉER LES SETTINGS PAR DÉFAUT
// ============================================================================

/**
 * Créer les settings par défaut pour le Stereonet.
 * `overrides` permet d'adapter les valeurs initiales au contexte (par exemple afficher
 * d'emblée les données prédites dans le panneau de résultats d'une inversion).
 */
export function createStereonetSettings(overrides: Partial<StereonetSettings> = {}): StereonetSettings {
    return {
        projection: 'wulff',
        showGrid: true,
        showDirections: true,
        showLabels: true,
        gridInterval: 10,
        gridColor: '#cccccc',
        gridWidth: 1,
        backgroundColor: '#ffffff',
        borderColor: '#000000',
        borderWidth: 2,
        selectedFiles: [],
        availableRepresentations: [],
        zoomLevel: 1.0,
        showPredicted: false,
        predictedColor: '#0066cc',
        showStressAxes: true,
        symbolSize: 4,
        arrowLength: 15,
        densityTargets: [],
        densityLevels: 5,
        densitySigma: 3,
        densityFill: true,
        ...overrides
    };
}