// RoseDiagramDescriptor.ts
// Descripteur pour le Rose Diagram

import React from 'react';
import { 
    VisualizationDescriptor, 
    VisualizationContext 
} from '../VisualizationDescriptor';

import RoseDiagramComponent from './RoseDiagramComponent';
import { createRoseSettings, RoseCompState, RoseIcon, RoseSettings } from './RoseParameters';

/**
 * Descripteur du Rose Diagram
 * C'est ici que TOUT est défini pour cette visualisation
 */
export const RoseDiagramDescriptor: VisualizationDescriptor<RoseSettings, RoseCompState> = {
    // ========== IDENTIFICATION ==========
    id: 'rose',
    title: 'Rose Diagram',
    description: 'Circular histogram for directional data (strike, dip direction, etc.)',
    
    // ========== CONTEXTES ==========
    // Le Rose Diagram apparaît dans Data Analysis et Show Analysis
    contexts: [
        VisualizationContext.DATA_ANALYSIS,
        VisualizationContext.SHOW_ANALYSIS
    ],
    
    // ========== UI ==========
    icon: RoseIcon,
    defaultLayout: { w: 4, h: 4 },
    
    // ========== STATE & SETTINGS ==========
    stateType: 'rose',
    
    defaultSettings: createRoseSettings(),
    
    createInitialState: (width = 400, height = 400): RoseCompState => ({
        type: 'rose',
        open: false,
        settings: createRoseSettings(),
        selectedColumn: '',
        plotDimensions: { width, height }
    }),
    
    // ========== COMPOSANT ==========
    component: RoseDiagramComponent,
    
    // ========== METADATA ==========
    version: '1.0.0',
    tags: ['directional', 'circular', 'strike', 'dip'],
    category: 'Structural Geology'
};