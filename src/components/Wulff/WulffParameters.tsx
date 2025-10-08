// WulffParameters.tsx
// Définitions des types et configurations pour le Wulff Stereonet

import { TCompState } from "../VisualizationStateSystem";

// ============================================================================
// CONFIGURATION DES TYPES DE DONNÉES GÉOLOGIQUES
// ============================================================================

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
export interface WulffSettings {
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

/**
 * State complet pour le Wulff Stereonet
 */
export interface WulffCompState extends TCompState<WulffSettings> {
    type: 'wulff';
}

// ============================================================================
// FACTORY POUR CRÉER LES SETTINGS PAR DÉFAUT
// ============================================================================

/**
 * Créer les settings par défaut pour le Wulff Stereonet
 */
export function createWulffSettings(): WulffSettings {
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