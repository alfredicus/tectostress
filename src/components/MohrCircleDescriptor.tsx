// MohrCircleDescriptor.ts
// Descripteur pour le Mohr Circle (contexte stress analysis)

import React from 'react';
import {
    VisualizationDescriptor,
    VisualizationContext
} from './VisualizationDescriptor';
import { MohrSettings, MohrCompState } from './VisualizationStateSystem';
import MohrCircleComponent from './MohrCircleComponent';

/**
 * Icône du Mohr Circle
 */
const MohrIcon: React.FC<{ size?: number; className?: string }> = ({
    size = 24,
    className = ""
}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
        <circle cx="8" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <circle cx="16" cy="12" r="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1" opacity="0.6" />
        <line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" strokeWidth="1" opacity="0.6" />
        <circle cx="10" cy="8" r="1.5" fill="currentColor" />
    </svg>
);

export interface MohrSettings {
    sigma1: number;
    sigma2: number;
    sigma3: number;
    n1: number;
    n2: number;
    n3: number;
    showGrid: boolean;
    showLabels: boolean;
    showColoredArea: boolean;
    showStressPoint: boolean;
    circle1Color: string;
    circle2Color: string;
    circle3Color: string;
    areaColor: string;
    stressPointColor: string;
    strokeWidth: number;
    zoomLevel: number;
}

export interface MohrCompState extends TCompState<MohrSettings> {
    type: 'mohr';
}

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
        VisualizationContext.STRESS_ANALYSIS
    ],

    // ========== UI ==========
    icon: MohrIcon,
    defaultLayout: { w: 6, h: 4 },

    // ========== STATE & SETTINGS ==========
    stateType: 'mohr',

    defaultSettings: {
        sigma1: 100,
        sigma2: 60,
        sigma3: 20,
        n1: 1 / Math.sqrt(3),
        n2: 1 / Math.sqrt(3),
        n3: 1 / Math.sqrt(3),
        showGrid: true,
        showLabels: true,
        showColoredArea: true,
        showStressPoint: true,
        circle1Color: '#0066cc',
        circle2Color: '#ff6b35',
        circle3Color: '#28a745',
        areaColor: 'rgba(200, 200, 200, 0.3)',
        stressPointColor: '#8e44ad',
        strokeWidth: 2
    },

    createInitialState: (width = 400, height = 400): MohrCompState => ({
        type: 'mohr',
        open: false,
        settings: {
            sigma1: 100,
            sigma2: 60,
            sigma3: 20,
            n1: 1 / Math.sqrt(3),
            n2: 1 / Math.sqrt(3),
            n3: 1 / Math.sqrt(3),
            showGrid: true,
            showLabels: true,
            showColoredArea: true,
            showStressPoint: true,
            circle1Color: '#0066cc',
            circle2Color: '#ff6b35',
            circle3Color: '#28a745',
            areaColor: 'rgba(200, 200, 200, 0.3)',
            stressPointColor: '#8e44ad',
            strokeWidth: 2
        },
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