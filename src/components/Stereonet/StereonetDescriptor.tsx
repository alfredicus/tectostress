// StereonetDescriptor.tsx
// Descripteur pour le Stereonet

import React from 'react';
import { 
    VisualizationDescriptor, 
    VisualizationContext 
} from '../VisualizationDescriptor';
import StereonetComponent from './StereonetComponent';
import { createStereonetSettings, StereonetCompState, StereonetIcon, StereonetSettings } from './StereonetParameters';

/**
 * Descripteur du Stereonet
 */
export const StereonetDescriptor: VisualizationDescriptor<StereonetSettings, StereonetCompState> = {
    // ========== IDENTIFICATION ==========
    id: 'wulff',
    title: 'Stereonet',
    description: 'Stereographic projection for structural geology analysis',
    
    // ========== CONTEXTES ==========
    contexts: [
        VisualizationContext.DATA_ANALYSIS,
        VisualizationContext.RUN_ANALYSIS
    ],
    
    // ========== UI ==========
    icon: StereonetIcon, // Utilisation d'une icône Lucide existante
    defaultLayout: { w: 6, h: 4 },
    
    // ========== STATE & SETTINGS ==========
    stateType: 'wulff',
    
    defaultSettings: createStereonetSettings(),
    
    createInitialState: (width = 400, height = 400): StereonetCompState => ({
        type: 'wulff',
        open: false,
        settings: createStereonetSettings(),
        selectedColumn: '',
        plotDimensions: { width, height }
    }),
    
    // ========== COMPOSANT ==========
    component: StereonetComponent,
    
    // ========== METADATA ==========
    version: '1.0.0',
    tags: ['stereonet', 'projection', 'structural', '3d-to-2d'],
    category: 'Structural Geology'
};