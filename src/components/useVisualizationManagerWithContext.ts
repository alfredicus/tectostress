// useVisualizationManagerWithContext.ts
// Smart hook that automatically provides visualization types based on context
// This is the RECOMMENDED way to use the visualization system

import { useVisualizationManager, UseVisualizationManagerProps } from './VisualizationManager';
import { getVisualizationTypesForContext } from './VisualizationTypeRegistry';
import { VisualizationContext } from './VisualizationDescriptor';

// ============================================================================
// SMART CONTEXT-AWARE HOOK
// ============================================================================

interface UseVisualizationManagerWithContextProps extends Omit<UseVisualizationManagerProps, 'availableTypes'> {
    context: VisualizationContext;
}

/**
 * Hook that automatically gets visualization types from the registry based on context
 * 
 * @example
 * ```tsx
 * const {
 *   visualizations,
 *   openAddDialog,
 *   // ... other methods
 * } = useVisualizationManagerWithContext({
 *   files,
 *   context: VisualizationContext.DATA_ANALYSIS
 * });
 * ```
 */
export const useVisualizationManagerWithContext = ({
    context,
    ...props
}: UseVisualizationManagerWithContextProps) => {
    // Dynamically get types from registry based on context
    const availableTypes = getVisualizationTypesForContext(context);

    return useVisualizationManager({
        ...props,
        availableTypes
    });
};

// ============================================================================
// CONVENIENCE HOOKS FOR SPECIFIC CONTEXTS
// ============================================================================

/**
 * Hook specifically for DATA_ANALYSIS context
 * Use this in DataComponent
 */
export const useDataVisualizationManager = (
    props: Omit<UseVisualizationManagerProps, 'availableTypes'>
) => {
    return useVisualizationManagerWithContext({
        ...props,
        context: VisualizationContext.DATA_ANALYSIS
    });
};

/**
 * Hook specifically for RUN_ANALYSIS context
 * Use this in RunComponent
 */
export const useRunVisualizationManager = (
    props: Omit<UseVisualizationManagerProps, 'availableTypes'>
) => {
    return useVisualizationManagerWithContext({
        ...props,
        context: VisualizationContext.RUN_ANALYSIS
    });
};