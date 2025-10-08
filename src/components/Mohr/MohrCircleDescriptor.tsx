// MohrCircleDescriptor.ts
// Descripteur pour le Mohr Circle (contexte stress analysis)

import React from 'react';
import {
    VisualizationDescriptor,
    VisualizationContext
} from '../VisualizationDescriptor';
import MohrCircleComponent from './MohrCircleComponent';
import { createMohrSettings, MohrCompState, MohrIcon, MohrSettings } from './MohrCircleParameters';



/**
 * Descripteur du Mohr Circle
 */
export const MohrCircleDescriptor: VisualizationDescriptor<MohrSettings, MohrCompState> = {
    // ========== IDENTIFICATION ==========
    id: 'mohr',
    title: 'Mohr Circle',
    description: 'Stress state visualization using Mohr circle representation',

    // ========== CONTEXTES ==========
    // Le Mohr Circle est spécifique au stress analysis
    contexts: [
        VisualizationContext.RUN_ANALYSIS
    ],

    // ========== UI ==========
    icon: MohrIcon,
    defaultLayout: { w: 6, h: 4 },

    // ========== STATE & SETTINGS ==========
    stateType: 'mohr',

    defaultSettings: createMohrSettings(),

    createInitialState: (width = 400, height = 400): MohrCompState => ({
        type: 'mohr',
        open: false,
        settings: createMohrSettings(),
        selectedColumn: '',
        plotDimensions: { width, height }
    }),

    // ========== COMPOSANT ==========
    component: MohrCircleComponent,

    // ========== METADATA ==========
    version: '1.0.0',
    tags: ['stress', 'mechanics', 'mohr', 'principal-stresses'],
    category: 'Stress Analysis'
};