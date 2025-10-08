// WulffDescriptor.ts
// Descripteur pour le Wulff Stereonet

import React from 'react';
import { 
    VisualizationDescriptor, 
    VisualizationContext 
} from '../VisualizationDescriptor';
import WulffComponent from './WulffComponent';
import { createWulffSettings, WulffCompState, WulffIcon, WulffSettings } from './WulffParameters';

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
    
    defaultSettings: createWulffSettings(),
    
    createInitialState: (width = 400, height = 400): WulffCompState => ({
        type: 'wulff',
        open: false,
        settings: createWulffSettings(),
        selectedColumn: '',
        plotDimensions: { width, height }
    }),
    
    // ========== COMPOSANT ==========
    component: WulffComponent,
    
    // ========== METADATA ==========
    version: '1.0.0',
    tags: ['stereonet', 'projection', 'structural', '3d-to-2d'],
    category: 'Structural Geology'
};