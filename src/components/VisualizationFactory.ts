// VisualizationFactory.ts
// Factory pour créer dynamiquement les états de visualisation

import { getVisualizationRegistry } from './VisualizationRegistry';
import { VisualizationCompState } from './VisualizationStateSystem';

/**
 * Factory pour créer des états de visualisation
 */
export class VisualizationFactory {
    /**
     * Créer un état initial pour une visualisation donnée
     */
    static createInitialState(
        visualizationId: string,
        width: number = 400,
        height: number = 400
    ): VisualizationCompState | null {
        const registry = getVisualizationRegistry();
        const descriptor = registry.get(visualizationId);

        if (!descriptor) {
            console.error(`Visualization "${visualizationId}" not found in registry`);
            return null;
        }

        // Utiliser la factory du descripteur pour créer l'état
        return descriptor.createInitialState(width, height) as VisualizationCompState;
    }

    /**
     * Obtenir les settings par défaut pour une visualisation
     */
    static getDefaultSettings(visualizationId: string): any {
        const registry = getVisualizationRegistry();
        const descriptor = registry.get(visualizationId);

        if (!descriptor) {
            console.error(`Visualization "${visualizationId}" not found in registry`);
            return {};
        }

        return descriptor.defaultSettings;
    }

    /**
     * Obtenir le composant React pour une visualisation
     */
    static getComponent(visualizationId: string): React.ComponentType<any> | null {
        const registry = getVisualizationRegistry();
        const descriptor = registry.get(visualizationId);

        if (!descriptor) {
            console.error(`Visualization "${visualizationId}" not found in registry`);
            return null;
        }

        return descriptor.component;
    }

    /**
     * Obtenir l'icône pour une visualisation
     */
    static getIcon(visualizationId: string): React.ComponentType<any> | null {
        const registry = getVisualizationRegistry();
        const descriptor = registry.get(visualizationId);

        if (!descriptor) {
            return null;
        }

        return descriptor.icon;
    }

    /**
     * Obtenir le layout par défaut pour une visualisation
     */
    static getDefaultLayout(visualizationId: string): { w: number; h: number } {
        const registry = getVisualizationRegistry();
        const descriptor = registry.get(visualizationId);

        if (!descriptor) {
            return { w: 6, h: 4 }; // fallback
        }

        return descriptor.defaultLayout;
    }

    /**
     * Valider qu'un état correspond bien au type attendu
     */
    static validateState(
        visualizationId: string,
        state: any
    ): boolean {
        const registry = getVisualizationRegistry();
        const descriptor = registry.get(visualizationId);

        if (!descriptor) {
            return false;
        }

        // Vérification basique : le type doit correspondre
        return state && state.type === descriptor.stateType;
    }

    /**
     * Créer un état avec des settings personnalisés
     */
    static createStateWithSettings(
        visualizationId: string,
        customSettings: any,
        width: number = 400,
        height: number = 400
    ): VisualizationCompState | null {
        const initialState = this.createInitialState(visualizationId, width, height);

        if (!initialState) {
            return null;
        }

        return {
            ...initialState,
            settings: {
                ...initialState.settings,
                ...customSettings
            }
        };
    }
}