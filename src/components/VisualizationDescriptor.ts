// VisualizationDescriptor.ts
// Interface centrale qui définit tout ce qu'une visualisation doit fournir

import React from 'react';
import { DataFiles } from './VisualizationStateSystem';

/**
 * Contextes où une visualisation peut apparaître
 */
export enum VisualizationContext {
    DATA_ANALYSIS = 'data_analysis',
    STRESS_ANALYSIS = 'stress_analysis',
    GENERAL = 'general',
    SHOW_ANALYSIS = 'show_analysis'
}

/**
 * Layout par défaut pour une visualisation
 */
export interface VisualizationLayout {
    w: number;  // largeur en unités de grille
    h: number;  // hauteur en unités de grille
}

/**
 * Props de base pour toutes les visualisations
 */
export interface BaseVisualizationProps<TState = any> {
    files: DataFiles;
    width?: number;
    height?: number;
    title?: string;
    state?: TState;
    onStateChange?: (state: TState) => void;
    onDimensionChange?: (newWidth: number, newHeight: number) => void;
}

/**
 * Descripteur complet d'une visualisation
 * Chaque nouvelle visualisation doit implémenter ce descripteur
 */
export interface VisualizationDescriptor<TSettings = any, TState = any> {
    // ========== IDENTIFICATION ==========
    /** Identifiant unique de la visualisation */
    id: string;

    /** Nom d'affichage */
    title: string;

    /** Description courte (optionnelle) */
    description?: string;

    // ========== CONTEXTES ==========
    /** Dans quels contextes cette visualisation apparaît-elle */
    contexts: VisualizationContext[];

    // ========== UI ==========
    /** Composant d'icône React */
    icon: React.ComponentType<{ size?: number; className?: string }>;

    /** Layout par défaut dans la grille */
    defaultLayout: VisualizationLayout;

    // ========== STATE & SETTINGS ==========
    /** Type de l'état (utilisé pour le type checking) */
    stateType: string;

    /** Settings par défaut */
    defaultSettings: TSettings;

    /** Factory pour créer l'état initial complet */
    createInitialState: (width?: number, height?: number) => TState;

    // ========== COMPOSANT ==========
    /** Le composant React à rendre */
    component: React.ComponentType<BaseVisualizationProps<TState>>;

    // ========== METADATA (optionnel) ==========
    /** Version du descripteur (pour migrations futures) */
    version?: string;

    /** Tags pour recherche/filtrage */
    tags?: string[];

    /** Catégorie pour regroupement */
    category?: string;
}

/**
 * Type helper pour extraire le type de settings d'un descripteur
 */
export type ExtractSettings<T> = T extends VisualizationDescriptor<infer S, any> ? S : never;

/**
 * Type helper pour extraire le type de state d'un descripteur
 */
export type ExtractState<T> = T extends VisualizationDescriptor<any, infer S> ? S : never;