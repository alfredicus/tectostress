// HistogramDescriptor.ts
// Exemple complet pour l'Histogram

import React from 'react';
import {
    VisualizationDescriptor,
    VisualizationContext
} from '../VisualizationDescriptor';
import HistogramComponent from './HistogramComponent';
import { HistogramCompState, HistogramSettings } from './HistogramParameters';

/**
 * Icône de l'Histogram
 */
const HistogramIcon: React.FC<{ size?: number; className?: string }> = ({
    size = 24,
    className = ""
}) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
    >
        <rect x="3" y="3" width="18" height="16" fill="none" stroke="currentColor" strokeWidth="0.3" opacity="0.2" />
        <g fill="currentColor" opacity="0.8">
            <rect x="4" y="16" width="2.5" height="3" />
            <rect x="6.5" y="15" width="2.5" height="4" />
            <rect x="9" y="11" width="2.5" height="8" />
            <rect x="11.5" y="9" width="2.5" height="10" />
            <rect x="14" y="13" width="2.5" height="6" />
            <rect x="16.5" y="17" width="2.5" height="2" />
        </g>
    </svg>
);

/**
 * Descripteur de l'Histogram
 */
export const HistogramDescriptor: VisualizationDescriptor<HistogramSettings, HistogramCompState> = {
    // ========== IDENTIFICATION ==========
    id: 'histogram',
    title: 'Histogram',
    description: 'Statistical distribution visualization',

    // ========== CONTEXTES ==========
    contexts: [
        VisualizationContext.DATA_ANALYSIS,
        VisualizationContext.GENERAL
    ],

    // ========== UI ==========
    icon: HistogramIcon,
    defaultLayout: { w: 6, h: 4 },

    // ========== STATE & SETTINGS ==========
    stateType: 'histogram',

    defaultSettings: {
        bins: 20,
        fillColor: '#3498db',
        strokeColor: '#2c3e50',
        showGrid: true,
        showDensity: false,
        showLabels: true,
        xAxisLabel: 'Value',
        yAxisLabel: 'Frequency',
        zoomLevel: 1.0
    },

    createInitialState: (width = 400, height = 400): HistogramCompState => ({
        type: 'histogram',
        open: false,
        settings: {
            bins: 20,
            fillColor: '#3498db',
            strokeColor: '#2c3e50',
            showGrid: true,
            showDensity: false,
            showLabels: true,
            xAxisLabel: 'Value',
            yAxisLabel: 'Frequency',
            zoomLevel: 1.0
        },
        selectedColumn: '',
        plotDimensions: { width, height }
    }),

    // ========== COMPOSANT ==========
    component: HistogramComponent,

    // ========== METADATA ==========
    version: '1.0.0',
    tags: ['statistics', 'distribution', 'frequency'],
    category: 'Statistics'
};