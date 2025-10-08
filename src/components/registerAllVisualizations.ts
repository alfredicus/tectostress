// registerAllVisualizations.ts
// Point d'entrée unique pour enregistrer TOUTES les visualisations
// C'EST LE SEUL FICHIER À MODIFIER pour ajouter une nouvelle visualisation

import { getVisualizationRegistry } from './VisualizationRegistry';



// Import des descripteurs
import { RoseDiagramDescriptor } from './Rose/RoseDiagramDescriptor';
import { WulffStereonetDescriptor } from './Wulff/WulffDescriptor';
import { HistogramDescriptor } from './Histo/HistogramDescriptor';
import { MohrCircleDescriptor } from './Mohr/MohrCircleDescriptor';
import { RoseCompState } from './Rose/RoseParameters';
import { WulffCompState } from './Wulff/WulffParameters';
import { HistogramCompState } from './Histo/HistogramParameters';
import { MohrCompState } from './Mohr/MohrCircleParameters';
import { FractureMap2DDescriptor } from './Map2D/FractureMap2DDescriptor';
import { FractureMap2DCompState } from './Map2D/FractureMap2DParameters';

/**
 * Enregistrer toutes les visualisations de l'application
 * 
 * ⚠️ IMPORTANT
 */
export type VisualizationCompState = RoseCompState | WulffCompState | HistogramCompState | MohrCompState | FractureMap2DCompState;

/**
 * Enregistrer toutes les visualisations de l'application
 * 
 * ⚠️ IMPORTANT
 * 
 * Pour ajouter une nouvelle visualisation :
 * 1. Créer son descripteur (ex: MyNewVisuDescriptor.ts)
 * 2. L'importer ici
 * 3. L'enregistrer dans la fonction ci-dessous
 * 
 * NE PAS modifier d'autres fichiers !
 */
export function registerAllVisualizations(): void {
    const registry = getVisualizationRegistry();
    
    console.log('📊 Registering visualizations...');
    
    // ========== VISUALISATIONS STRUCTURALES ==========
    registry.register(RoseDiagramDescriptor);
    registry.register(WulffStereonetDescriptor);
    registry.register(FractureMap2DDescriptor);
    
    // ========== VISUALISATIONS STATISTIQUES ==========
    registry.register(HistogramDescriptor);
    
    // ========== VISUALISATIONS DE CONTRAINTES ==========
    registry.register(MohrCircleDescriptor);
    
    // ========== NOUVELLES VISUALISATIONS ==========
    // Pour ajouter une nouvelle visualisation, décommenter et adapter :
    // registry.register(MyNewVisualizationDescriptor);
    
    // Afficher les stats
    const stats = registry.getStats();
    console.log(`✓ ${stats.total} visualizations registered`);
    console.log('  By context:', stats.byContext);
    console.log('  By category:', stats.byCategory);
}

/**
 * Helper pour un enregistrement lazy (à la demande)
 * Utile pour le code splitting
 */
export async function registerVisualizationLazy(
    descriptorLoader: () => Promise<{ default: any }>
): Promise<void> {
    const module = await descriptorLoader();
    const descriptor = module.default;
    
    const registry = getVisualizationRegistry();
    registry.register(descriptor);
}

/**
 * Helper pour enregistrer une visualisation custom au runtime
 * (pour des plugins tiers par exemple)
 */
export function registerCustomVisualization(descriptor: any): void {
    const registry = getVisualizationRegistry();
    registry.register(descriptor);
}