// VisualizationRegistry.ts
// Registry singleton pour gérer toutes les visualisations

import {
    VisualizationDescriptor,
    VisualizationContext
} from './VisualizationDescriptor';

/**
 * Registry centralisé pour toutes les visualisations
 * Pattern Singleton
 */
export class VisualizationRegistry {
    
    /**
     * Obtenir l'instance unique
     */
    static getInstance(): VisualizationRegistry {
        if (!VisualizationRegistry.instance) {
            VisualizationRegistry.instance = new VisualizationRegistry();
        }
        return VisualizationRegistry.instance;
    }

    /**
     * Enregistrer une nouvelle visualisation
     * C'est la SEULE méthode à appeler pour ajouter une visualisation
     */
    register(descriptor: VisualizationDescriptor): void {
        const id = descriptor.id;

        // Vérifier qu'elle n'existe pas déjà
        if (this.descriptors.has(id)) {
            console.warn(`Visualization "${id}" is already registered. Skipping registration...`);
            return
        }

        // Enregistrer le descripteur
        this.descriptors.set(id, descriptor);

        // Mettre à jour les index de contexte
        descriptor.contexts.forEach(context => {
            if (!this.contextIndex.has(context)) {
                this.contextIndex.set(context, new Set());
            }
            this.contextIndex.get(context)!.add(id);
        });

        // Mettre à jour l'index de catégorie
        if (descriptor.category) {
            if (!this.categoryIndex.has(descriptor.category)) {
                this.categoryIndex.set(descriptor.category, new Set());
            }
            this.categoryIndex.get(descriptor.category)!.add(id);
        }

        console.log(`✓ Visualization "${id}" registered successfully`);
    }

    /**
     * Obtenir un descripteur par son id
     */
    get(id: string): VisualizationDescriptor | undefined {
        return this.descriptors.get(id);
    }

    /**
     * Vérifier si une visualisation existe
     */
    has(id: string): boolean {
        return this.descriptors.has(id);
    }

    /**
     * Obtenir toutes les visualisations
     */
    getAll(): VisualizationDescriptor[] {
        return Array.from(this.descriptors.values());
    }

    /**
     * Obtenir les visualisations pour un contexte donné
     */
    getByContext(context: VisualizationContext): VisualizationDescriptor[] {
        const ids = this.contextIndex.get(context);
        if (!ids) return [];

        return Array.from(ids)
            .map(id => this.descriptors.get(id))
            .filter(desc => desc !== undefined) as VisualizationDescriptor[];
    }

    /**
     * Obtenir les visualisations pour plusieurs contextes
     */
    getByContexts(contexts: VisualizationContext[]): VisualizationDescriptor[] {
        const uniqueIds = new Set<string>();

        contexts.forEach(context => {
            const ids = this.contextIndex.get(context);
            if (ids) {
                ids.forEach(id => uniqueIds.add(id));
            }
        });

        return Array.from(uniqueIds)
            .map(id => this.descriptors.get(id))
            .filter(desc => desc !== undefined) as VisualizationDescriptor[];
    }

    /**
     * Obtenir les visualisations par catégorie
     */
    getByCategory(category: string): VisualizationDescriptor[] {
        const ids = this.categoryIndex.get(category);
        if (!ids) return [];

        return Array.from(ids)
            .map(id => this.descriptors.get(id))
            .filter(desc => desc !== undefined) as VisualizationDescriptor[];
    }

    /**
     * Rechercher par tags
     */
    searchByTags(tags: string[]): VisualizationDescriptor[] {
        return this.getAll().filter(desc => {
            if (!desc.tags) return false;
            return tags.some(tag => desc.tags?.includes(tag));
        });
    }

    /**
     * Obtenir tous les contextes disponibles
     */
    getAllContexts(): VisualizationContext[] {
        return Array.from(this.contextIndex.keys());
    }

    /**
     * Obtenir toutes les catégories disponibles
     */
    getAllCategories(): string[] {
        return Array.from(this.categoryIndex.keys());
    }

    /**
     * Trouver dans quels contextes une visualisation apparaît
     */
    getContextsForVisualization(id: string): VisualizationContext[] {
        const descriptor = this.get(id);
        return descriptor ? descriptor.contexts : [];
    }

    /**
     * Désenregistrer une visualisation (utile pour hot reload en dev)
     */
    unregister(id: string): boolean {
        const descriptor = this.descriptors.get(id);
        if (!descriptor) return false;

        // Retirer des index
        descriptor.contexts.forEach(context => {
            this.contextIndex.get(context)?.delete(id);
        });

        if (descriptor.category) {
            this.categoryIndex.get(descriptor.category)?.delete(id);
        }

        // Retirer du registry principal
        return this.descriptors.delete(id);
    }

    /**
     * Clear complet (utile pour les tests)
     */
    clear(): void {
        this.descriptors.clear();
        this.contextIndex.forEach(set => set.clear());
        this.categoryIndex.clear();
    }

    /**
     * Stats pour debug
     */
    getStats(): {
        total: number;
        byContext: Record<string, number>;
        byCategory: Record<string, number>;
    } {
        const byContext: Record<string, number> = {};
        this.contextIndex.forEach((ids, context) => {
            byContext[context] = ids.size;
        });

        const byCategory: Record<string, number> = {};
        this.categoryIndex.forEach((ids, category) => {
            byCategory[category] = ids.size;
        });

        return {
            total: this.descriptors.size,
            byContext,
            byCategory
        };
    }

    private static instance: VisualizationRegistry;

    /** Map: id → descriptor */
    private descriptors: Map<string, VisualizationDescriptor> = new Map();

    /** Map inversée: context → ids[] pour performance */
    private contextIndex: Map<VisualizationContext, Set<string>> = new Map();

    /** Map inversée: category → ids[] */
    private categoryIndex: Map<string, Set<string>> = new Map();

    private constructor() {
        // Initialiser les index
        Object.values(VisualizationContext).forEach(context => {
            this.contextIndex.set(context as VisualizationContext, new Set());
        });
    }
}

/**
 * Helper pour obtenir l'instance du registry
 */
export const getVisualizationRegistry = () => VisualizationRegistry.getInstance();