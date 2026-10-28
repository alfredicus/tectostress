// SphereDescriptor.tsx
// Descripteur pour la sphère des contraintes (3-D)

import {
    VisualizationDescriptor,
    VisualizationContext
} from '../VisualizationDescriptor';
import SphereComponent from './SphereComponent';
import { createSphereSettings, SphereCompState, SphereIcon, SphereSettings } from './SphereParameters';

/**
 * Descripteur de la sphère des contraintes
 */
export const StressSphereDescriptor: VisualizationDescriptor<SphereSettings, SphereCompState> = {
    // ========== IDENTIFICATION ==========
    id: 'sphere',
    title: 'Stress Sphere',
    description: 'Data normals, stress trajectories and equipotentials on the unit sphere',

    // ========== CONTEXTES ==========
    // Only meaningful once a solution exists: the curves and the principal frame both come
    // from the inverted tensor.
    contexts: [
        VisualizationContext.RUN_ANALYSIS
    ],

    // ========== UI ==========
    icon: SphereIcon,
    defaultLayout: { w: 6, h: 5 },

    // ========== STATE & SETTINGS ==========
    stateType: 'sphere',

    defaultSettings: createSphereSettings(),

    createInitialState: (width = 400, height = 400): SphereCompState => ({
        type: 'sphere',
        open: false,
        settings: createSphereSettings(),
        selectedColumn: '',
        plotDimensions: { width, height }
    }),

    // ========== COMPOSANT ==========
    component: SphereComponent,

    // ========== METADATA ==========
    version: '1.0.0',
    tags: ['sphere', '3d', 'stress', 'trajectories', 'structural'],
    category: 'Structural Geology'
};
