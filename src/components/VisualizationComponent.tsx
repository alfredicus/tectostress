// VisualizationComponent.tsx (REFACTORISÉ)
// Ce composant ne connaît plus les visualisations individuelles
// Il les obtient dynamiquement via la Factory

import React from 'react';
import { VisualizationFactory } from './VisualizationFactory';
import {
    VisualizationCompState,
    DataFiles
} from './VisualizationStateSystem';

// ============================================================================
// PROPS
// ============================================================================

interface EnhancedVisualizationProps {
    type: string;
    files: DataFiles;
    width?: number;
    height?: number;
    state?: VisualizationCompState;
    onStateChange?: (state: VisualizationCompState) => void;
    onDimensionChange?: (newWidth: number, newHeight: number) => void;
}

// ============================================================================
// COMPOSANT PRINCIPAL - VERSION DYNAMIQUE
// ============================================================================

/**
 * Composant de visualisation refactorisé
 * 
 * ✅ Plus de switch/case géant
 * ✅ Plus besoin de connaître les visualisations
 * ✅ Tout est résolu dynamiquement via la Factory
 */
export const VisualizationComponent: React.FC<EnhancedVisualizationProps> = ({
    type,
    files,
    width,
    height,
    state,
    onStateChange,
    onDimensionChange
}) => {
    // Obtenir le composant dynamiquement via la Factory
    const VisualizationComponentClass = VisualizationFactory.getComponent(type);

    // Si le type n'existe pas
    if (!VisualizationComponentClass) {
        return (
            <div className="flex items-center justify-center h-full border-2 border-dashed border-gray-300 rounded-lg">
                <div className="text-center text-gray-500">
                    <p className="text-lg font-medium">Unknown visualization type: {type}</p>
                    <p className="text-sm">This visualization is not registered in the system.</p>
                    <p className="text-xs mt-2">Available types can be found in the registry.</p>
                </div>
            </div>
        );
    }

    // Rendre le composant dynamiquement
    return (
        <VisualizationComponentClass
            files={files}
            width={width}
            height={height}
            state={state}
            onStateChange={onStateChange}
            onDimensionChange={onDimensionChange}
        />
    );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default VisualizationComponent;