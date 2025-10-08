// FractureMap2DDescriptor.ts
// Descripteur pour la Fracture Map 2D

import React from 'react';
import {
    VisualizationDescriptor,
    VisualizationContext
} from '../VisualizationDescriptor';
import { createFractureMap2DSettings, FractureMap2DCompState, FractureMap2DSettings, FractureMapIcon } from './FractureMap2DParameters';
import FractureMap2DComponent from './FractureMap2DComponent';

export const FractureMap2DDescriptor: VisualizationDescriptor<FractureMap2DSettings, FractureMap2DCompState> = {
    // ========== IDENTIFICATION ==========
    id: 'fractureMap2D',
    title: 'Fracture Map 2D',
    description: '2D spatial distribution of fractures with strike visualization',

    // ========== CONTEXTES ==========
    contexts: [
        VisualizationContext.DATA_ANALYSIS,
        VisualizationContext.RUN_ANALYSIS
    ],

    // ========== UI ==========
    icon: FractureMapIcon,
    defaultLayout: { w: 8, h: 6 }, // Plus large pour une carte

    // ========== STATE & SETTINGS ==========
    stateType: 'fractureMap2D',

    defaultSettings: createFractureMap2DSettings(),

    createInitialState: (width = 400, height = 400): FractureMap2DCompState => ({
        selectedColumn: "",
        open: false,
        plotDimensions: { width, height },
        settings: createFractureMap2DSettings(),
        type: 'fractureMap2D'
    }),

    // ========== COMPOSANT ==========
    component: FractureMap2DComponent,

    // ========== METADATA ==========
    version: '1.0.0',
    tags: ['spatial', 'map', 'fracture', '2d', 'strike'],
    category: 'Spatial Analysis'
};