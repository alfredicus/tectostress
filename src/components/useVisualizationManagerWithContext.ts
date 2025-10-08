// useVisualizationManagerWithContext.ts
// Smart hook that automatically provides visualization types based on context
// This is the RECOMMENDED way to use the visualization system

import { useVisualizationManager, UseVisualizationManagerProps, VisualizationType } from './VisualizationManager';
import { getVisualizationTypesForContext } from './VisualizationTypeRegistry';
import { VisualizationContext } from './VisualizationDescriptor';
import { getVisualizationRegistry } from './VisualizationRegistry';

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

/**
 * Convert VisualizationDescriptor to VisualizationType format
 * This bridges the new descriptor system with the old manager interface
 */
function convertDescriptorToType(descriptor: any): VisualizationType {
    return {
        id: descriptor.id,
        title: descriptor.title,
        icon: descriptor.icon,
        defaultLayout: descriptor.defaultLayout
    };
}

/**
 * Get visualization types dynamically from the registry
 */
export const getVisualizationTypesForContext = (context: VisualizationContext):  VisualizationType[] => {
    const registry = getVisualizationRegistry();
    const descriptors = registry.getByContext(context);
    return descriptors.map(convertDescriptorToType);
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