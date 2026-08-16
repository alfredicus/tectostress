// SphereParameters.tsx
// Types et configuration par défaut pour la sphère des contraintes (3-D)
//
// Le jeu d'options reprend celui de l'application `slip-lines` (lignes de glissement,
// équipotentielles, axes principaux), auquel s'ajoutent ici les stries mesurées et prédites.

import React from 'react';
import { TCompState } from '../VisualizationStateSystem';

/**
 * State complet pour la sphère des contraintes
 */
export interface SphereCompState extends TCompState<SphereSettings> {
    type: 'sphere';
}

export const SphereIcon: React.FC<{ size?: number; className?: string }> = ({
    size = 24,
    className = ""
}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" fill="none" />
        {/* meridian + parallel to read as a sphere rather than a disc */}
        <ellipse cx="12" cy="12" rx="4" ry="9" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.6" />
        <ellipse cx="12" cy="12" rx="9" ry="4" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.6" />
        <circle cx="15.5" cy="8" r="1.3" fill="currentColor" />
    </svg>
);

// ============================================================================
// TYPES DE DONNÉES
// ============================================================================

/**
 * Canonical data-type groups the sphere knows how to colour. Raw type strings coming from the
 * files ("striated plane", "extension fracture", …) are mapped onto these through TypeSynonyms;
 * anything unmatched keeps its own name and takes a colour from the fallback palette.
 */
export const SPHERE_DATA_TYPES = ['fault', 'joint', 'stylolite', 'dilation band', 'compaction band'];

export const SPHERE_TYPE_COLORS: Record<string, string> = {
    fault:              '#e74c3c',
    joint:              '#3498db',
    stylolite:          '#27ae60',
    'dilation band':    '#8e44ad',
    'compaction band':  '#0097a7',
};

export const SPHERE_TYPE_LABELS: Record<string, string> = {
    fault:              'Faults',
    joint:              'Joints',
    stylolite:          'Stylolites',
    'dilation band':    'Dilation bands',
    'compaction band':  'Compaction bands',
};

export const SPHERE_FALLBACK_COLORS = ['#f39c12', '#16a085', '#d35400', '#7f8c8d', '#c0392b'];

// ============================================================================
// SETTINGS
// ============================================================================

/**
 * Settings complets pour la sphère des contraintes
 */
export interface SphereSettings {
    // ── Données ──────────────────────────────────────────────────────────────
    selectedFiles: string[];
    /** Data-type groups the user has switched off (all shown when absent). */
    hiddenTypes: Record<string, boolean>;
    /** Per-type colour overrides on top of SPHERE_TYPE_COLORS. */
    typeColors: Record<string, string>;
    /** Pole of each measured plane, coloured by data type. */
    showPoles: boolean;
    poleSize: number;

    // ── Stries ───────────────────────────────────────────────────────────────
    // Drawn as short great-circle arcs tangent to the sphere at the plane's pole: the
    // theoretical slip lines are exactly the curves a striation should follow.
    showMeasuredStriations: boolean;
    measuredStriationColor: string;
    showPredictedStriations: boolean;
    predictedStriationColor: string;
    /** Arc length of a striation tick, in degrees. */
    striationLength: number;
    striationWidth: number;

    // ── Lignes de glissement / équipotentielles (comme dans slip-lines) ──────
    showSlipLines: boolean;
    slipLineColor: string;
    nCurves: number;
    showEquipotential: boolean;
    equipotentialColor: string;
    nIsoCurves: number;
    /** Parametric (Mohr-circle) construction vs. binary search on the normal stress. */
    useParametricEquipotentials: boolean;
    showSpecialEquipotential: boolean;
    specialEquipotentialColor: string;
    curveLineWidth: number;

    // ── Champ de contrainte normale (iso-contours remplis) ───────────────────
    /** Colour the sphere surface by σn, in filled iso-contour bands. */
    showNormalStressField: boolean;
    /** Colour map name, from keplerlit's colorMapNames(). */
    colorTableName: string;
    /** Black iso-lines of σn traced on the surface (marching triangles). */
    showNormalStressIsoLines: boolean;

    // ── Axes et apparence ────────────────────────────────────────────────────
    showStressAxes: boolean;
    sphereColor: string;
    backgroundColor: string;
    autoRotate: boolean;
}

// ============================================================================
// FACTORY POUR CRÉER LES SETTINGS PAR DÉFAUT
// ============================================================================

/**
 * Créer les settings par défaut pour la sphère des contraintes.
 * `overrides` permet d'adapter les valeurs initiales au contexte (par exemple afficher d'emblée
 * les stries prédites dans le panneau de résultats d'une inversion).
 */
export function createSphereSettings(overrides: Partial<SphereSettings> = {}): SphereSettings {
    return {
        selectedFiles: [],
        hiddenTypes: {},
        typeColors: {},
        showPoles: true,
        poleSize: 0.025,

        showMeasuredStriations: true,
        measuredStriationColor: '#111111',
        showPredictedStriations: false,
        predictedStriationColor: '#0066cc',
        striationLength: 12,
        striationWidth: 3,

        showSlipLines: true,
        slipLineColor: '#d62728',
        nCurves: 12,
        showEquipotential: true,
        equipotentialColor: '#000000',
        nIsoCurves: 8,
        useParametricEquipotentials: true,
        showSpecialEquipotential: false,
        specialEquipotentialColor: '#ff00ff',
        curveLineWidth: 2,

        showNormalStressField: true,
        colorTableName: 'Rainbow',
        showNormalStressIsoLines: false,

        showStressAxes: true,
        sphereColor: '#dddddd',
        backgroundColor: '#f0f0f0',
        autoRotate: false,

        ...overrides
    };
}
