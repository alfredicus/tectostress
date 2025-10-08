// WulffDescriptor.ts
// Descripteur pour le Wulff Stereonet

import React from 'react';
import { Target } from 'lucide-react';
import { 
    VisualizationDescriptor, 
    VisualizationContext 
} from '../VisualizationDescriptor';
import WulffStereonetComponent from './WulffStereonetComponent';
import { WulffCompState, WulffIcon, WulffSettings } from './WulffParameters';

/**
 * Descripteur du Wulff Stereonet
 */
export const WulffStereonetDescriptor: VisualizationDescriptor<WulffSettings, WulffCompState> = {
    // ========== IDENTIFICATION ==========
    id: 'wulff',
    title: 'Wulff Stereonet',
    description: 'Stereographic projection for structural geology analysis',
    
    // ========== CONTEXTES ==========
    contexts: [
        VisualizationContext.DATA_ANALYSIS,
        VisualizationContext.RUN_ANALYSIS
    ],
    
    // ========== UI ==========
    icon: WulffIcon, // Utilisation d'une icône Lucide existante
    defaultLayout: { w: 6, h: 4 },
    
    // ========== STATE & SETTINGS ==========
    stateType: 'wulff',
    
    defaultSettings: {
        projection: 'stereonet',
        hemisphere: 'upper',
        showGrid: true,
        gridSpacing: 10,
        pointSize: 3,
        pointColor: '#3498db',
        zoomLevel: 1.0
    },
    
    createInitialState: (width = 400, height = 400): WulffCompState => ({
        type: 'wulff',
        open: false,
        settings: {
            projection: 'stereonet',
            hemisphere: 'upper',
            showGrid: true,
            gridSpacing: 10,
            pointSize: 3,
            pointColor: '#3498db',
            zoomLevel: 1.0
        },
        selectedColumn: '',
        plotDimensions: { width, height }
    }),
    
    // ========== COMPOSANT ==========
    component: WulffStereonetComponent,
    
    // ========== METADATA ==========
    version: '1.0.0',
    tags: ['stereonet', 'projection', 'structural', '3d-to-2d'],
    category: 'Structural Geology'
};