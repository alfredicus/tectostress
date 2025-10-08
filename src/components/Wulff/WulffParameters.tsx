// WulffParameters.tsx
// Définitions des types et configurations pour le Wulff Stereonet

import { TCompState } from "../VisualizationStateSystem";

// ============================================================================
// CONFIGURATION DES TYPES DE DONNÉES GÉOLOGIQUES
// ============================================================================

/**
 * State complet pour le Wulff Stereonet
 */
export interface WulffStereonetCompState extends TCompState<WulffStereonetSettings> {
    type: 'wulff';
}

export const WulffIcon: React.FC<{ size?: number; className?: string }> = ({
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
            { required: ['dip', 'strike', 'dip_direction'] },
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
            { required: ['dip', 'strike', 'dip_direction'] },
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
    fault: {
        displayName: 'Fault',
        columns: [
            { required: ['strike', 'dip', 'rake'] },
            { required: ['dip', 'strike', 'dip_direction', 'rake'] },
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
 * Settings complets pour le Wulff Stereonet
 * C'est la version RÉELLE utilisée par le composant
 */
export interface WulffStereonetSettings {
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
}

// ============================================================================
// FACTORY POUR CRÉER LES SETTINGS PAR DÉFAUT
// ============================================================================

/**
 * Créer les settings par défaut pour le Wulff Stereonet
 */
export function createWulffStereonetSettings(): WulffStereonetSettings {
    return {
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
        zoomLevel: 1.0
    };
}