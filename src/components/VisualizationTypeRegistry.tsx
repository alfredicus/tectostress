// VisualizationTypeRegistry.tsx - Centralized registry for visualization types

import { VisualizationType } from './VisualizationManager';
import { useVisualizationManager as useBaseVisualizationManager, UseVisualizationManagerProps } from './VisualizationManager';
import React, { ReactNode } from 'react';
import { DataFile } from './DataFile';
import { Visualization, VisualizationState } from './types';
import { AddVisualizationDialog, VisualizationGrid } from './VisualizationManager';
import { Eye } from 'lucide-react'; // Example icon, replace with actual icons as needed

// ============================================================================
// ICON COMPONENTS
// ============================================================================

const RoseIcon: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
        <circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.6" />
        <g fill="currentColor" opacity="0.95">
            <path d="M 12 12 L 11.5 1 A 10.5 10.5 0 0 1 12.5 1 L 12 12 Z" />
            <path d="M 12 12 L 18.3 3.5 A 7 7 0 0 1 19 4.5 L 12 12 Z" />
            <path d="M 12 12 L 20.5 8 A 4 4 0 0 1 20.8 9 L 12 12 Z" />
            <path d="M 12 12 L 22.5 11.5 A 6 6 0 0 1 22.5 12.5 L 12 12 Z" />
            <path d="M 12 12 L 20.5 16 A 3.5 3.5 0 0 1 20 16.8 L 12 12 Z" />
            <path d="M 12 12 L 18.3 20.5 A 3 3 0 0 1 17.7 20.8 L 12 12 Z" />
            <path d="M 12 12 L 12.5 23 A 10 10 0 0 1 11.5 23 L 12 12 Z" />
            <path d="M 12 12 L 5.7 20.5 A 8 8 0 0 1 5 19.5 L 12 12 Z" />
            <path d="M 12 12 L 3.5 16 A 6 6 0 0 1 3.2 15 L 12 12 Z" />
            <path d="M 12 12 L 1.5 12.5 A 8.5 8.5 0 0 1 1.5 11.5 L 12 12 Z" />
            <path d="M 12 12 L 3.5 8 A 6.5 6.5 0 0 1 4.2 7 L 12 12 Z" />
            <path d="M 12 12 L 5.7 3.5 A 7.5 7.5 0 0 1 6.5 3 L 12 12 Z" />
        </g>
        <circle cx="12" cy="12" r="0.5" fill="currentColor" />
    </svg>
);

const HistogramIcon: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
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

const WulffIcon: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.5" />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.3" />
        <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="0.5" />
        <line x1="12" y1="2" x2="12" y2="22" stroke="currentColor" strokeWidth="0.5" />
    </svg>
);

const MohrIcon: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <circle cx="8" cy="12" r="3" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.7" />
        <circle cx="14" cy="12" r="2" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.7" />
        <circle cx="11" cy="12" r="1.5" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.7" />
        <circle cx="6" cy="12" r="1.5" fill="currentColor" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        <circle cx="16" cy="12" r="1.5" fill="currentColor" />
        <circle cx="10" cy="8" r="1" fill="purple" />
        <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="0.5" />
        <line x1="12" y1="2" x2="12" y2="22" stroke="currentColor" strokeWidth="0.5" />
    </svg>
);

const ResultsIcon: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="8" cy="8" r="2" fill="currentColor" />
        <circle cx="16" cy="8" r="2" fill="currentColor" />
        <circle cx="12" cy="16" r="2" fill="currentColor" />
        <line x1="8" y1="8" x2="12" y2="16" stroke="currentColor" strokeWidth="2" />
        <line x1="16" y1="8" x2="12" y2="16" stroke="currentColor" strokeWidth="2" />
        <line x1="8" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth="2" />
    </svg>
);

const SolutionIcon: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M8 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="6" r="1" fill="currentColor" />
        <circle cx="18" cy="12" r="1" fill="currentColor" />
        <circle cx="12" cy="18" r="1" fill="currentColor" />
        <circle cx="6" cy="12" r="1" fill="currentColor" />
    </svg>
);

const TableIcon: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
        <line x1="9" y1="3" x2="9" y2="21" stroke="currentColor" strokeWidth="2" />
        <line x1="15" y1="3" x2="15" y2="21" stroke="currentColor" strokeWidth="2" />
        <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="2" />
        <line x1="3" y1="15" x2="21" y2="15" stroke="currentColor" strokeWidth="2" />
    </svg>
);

const ChartIcon: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M3 3v18h18" stroke="currentColor" strokeWidth="2" />
        <path d="M7 12l3-3 4 4 5-5" stroke="currentColor" strokeWidth="2" />
        <circle cx="7" cy="12" r="1" fill="currentColor" />
        <circle cx="10" cy="9" r="1" fill="currentColor" />
        <circle cx="14" cy="13" r="1" fill="currentColor" />
        <circle cx="19" cy="8" r="1" fill="currentColor" />
    </svg>
);

const AnalysisIcon: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0" stroke="currentColor" strokeWidth="2" />
        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="3" r="1" fill="currentColor" />
        <circle cx="21" cy="12" r="1" fill="currentColor" />
        <circle cx="12" cy="21" r="1" fill="currentColor" />
        <circle cx="3" cy="12" r="1" fill="currentColor" />
    </svg>
);

// ============================================================================
// VISUALIZATION TYPE REGISTRY
// ============================================================================

/**
 * Context for geological/structural data analysis
 */
export const DATA_ANALYSIS_VISUALIZATIONS: VisualizationType[] = [
    {
        id: 'rose',
        title: 'Rose Diagram',
        icon: RoseIcon,
        defaultLayout: { w: 4, h: 4 }
    },
    {
        id: 'histogram',
        title: 'Histogram',
        icon: HistogramIcon,
        defaultLayout: { w: 6, h: 4 }
    },
    {
        id: 'wulff',
        title: 'Wulff Stereonet',
        icon: WulffIcon,
        defaultLayout: { w: 6, h: 4 }
    },
    {
        id: 'mohr',
        title: 'Mohr Circle',
        icon: MohrIcon,
        defaultLayout: { w: 6, h: 4 }
    }
];

/**
 * Context for stress inversion analysis and results
 */
export const STRESS_ANALYSIS_VISUALIZATIONS: VisualizationType[] = [
    {
        id: 'results',
        title: 'Results Summary',
        icon: ResultsIcon,
        defaultLayout: { w: 8, h: 6 }
    },
    {
        id: 'solution',
        title: 'Solution Analysis',
        icon: SolutionIcon,
        defaultLayout: { w: 6, h: 5 }
    },
    {
        id: 'mohr',
        title: 'Stress State (Mohr)',
        icon: MohrIcon,
        defaultLayout: { w: 6, h: 4 }
    },
    {
        id: 'wulff',
        title: 'Data Plot (Stereonet)',
        icon: WulffIcon,
        defaultLayout: { w: 6, h: 4 }
    },
    {
        id: 'rose',
        title: 'Strike Distribution',
        icon: RoseIcon,
        defaultLayout: { w: 4, h: 4 }
    }
];

/**
 * Context for general data visualization and exploration
 */
export const GENERAL_VISUALIZATIONS: VisualizationType[] = [
    {
        id: 'table',
        title: 'Data Table',
        icon: TableIcon,
        defaultLayout: { w: 12, h: 3 }
    },
    {
        id: 'histogram',
        title: 'Histogram',
        icon: HistogramIcon,
        defaultLayout: { w: 6, h: 4 }
    },
    {
        id: 'chart',
        title: 'Line Chart',
        icon: ChartIcon,
        defaultLayout: { w: 8, h: 4 }
    }
];

/**
 * Context for comprehensive analysis (combines multiple contexts)
 */
export const COMPREHENSIVE_ANALYSIS_VISUALIZATIONS: VisualizationType[] = [
    ...DATA_ANALYSIS_VISUALIZATIONS,
    {
        id: 'analysis',
        title: 'Analysis Summary',
        icon: AnalysisIcon,
        defaultLayout: { w: 10, h: 6 }
    }
];

// ============================================================================
// VISUALIZATION CONTEXT MANAGER
// ============================================================================

export enum VisualizationContext {
    DATA_ANALYSIS = 'data_analysis',
    STRESS_ANALYSIS = 'stress_analysis',
    GENERAL = 'general',
    COMPREHENSIVE = 'comprehensive',
    CUSTOM = 'custom'
}

export class VisualizationRegistry {
    private static contexts: Map<VisualizationContext, VisualizationType[]> = new Map([
        [VisualizationContext.DATA_ANALYSIS, DATA_ANALYSIS_VISUALIZATIONS],
        [VisualizationContext.STRESS_ANALYSIS, STRESS_ANALYSIS_VISUALIZATIONS],
        [VisualizationContext.GENERAL, GENERAL_VISUALIZATIONS],
        [VisualizationContext.COMPREHENSIVE, COMPREHENSIVE_ANALYSIS_VISUALIZATIONS]
    ]);

    private static customContexts: Map<string, VisualizationType[]> = new Map();

    /**
     * Get visualization types for a specific context
     */
    static getVisualizationTypes(context: VisualizationContext | string): VisualizationType[] {
        if (typeof context === 'string' && !Object.values(VisualizationContext).includes(context as VisualizationContext)) {
            // Handle custom context
            return this.customContexts.get(context) || [];
        }

        return this.contexts.get(context as VisualizationContext) || [];
    }

    /**
     * Register a custom visualization context
     */
    static registerCustomContext(contextName: string, visualizations: VisualizationType[]): void {
        this.customContexts.set(contextName, visualizations);
    }

    /**
     * Add visualization types to an existing context
     */
    static extendContext(context: VisualizationContext | string, additionalTypes: VisualizationType[]): void {
        if (typeof context === 'string') {
            // Extend custom context
            const existing = this.customContexts.get(context) || [];
            this.customContexts.set(context, [...existing, ...additionalTypes]);
        } else {
            // Extend predefined context
            const existing = this.contexts.get(context) || [];
            this.contexts.set(context, [...existing, ...additionalTypes]);
        }
    }

    /**
     * Get all available contexts
     */
    static getAllContexts(): string[] {
        return [
            ...Object.values(VisualizationContext),
            ...Array.from(this.customContexts.keys())
        ];
    }

    /**
     * Check if a visualization type exists in any context
     */
    static hasVisualizationType(typeId: string): boolean {
        const allContexts = [
            ...this.contexts.values(),
            ...this.customContexts.values()
        ];

        return allContexts.some(types =>
            types.some(type => type.id === typeId)
        );
    }

    /**
     * Find which contexts contain a specific visualization type
     */
    static findContextsForType(typeId: string): string[] {
        const contexts: string[] = [];

        // Check predefined contexts
        for (const [context, types] of this.contexts.entries()) {
            if (types.some(type => type.id === typeId)) {
                contexts.push(context);
            }
        }

        // Check custom contexts
        for (const [context, types] of this.customContexts.entries()) {
            if (types.some(type => type.id === typeId)) {
                contexts.push(context);
            }
        }

        return contexts;
    }
}

// ============================================================================
// ENHANCED VISUALIZATION MANAGER HOOK
// ============================================================================

// import { useVisualizationManager as useBaseVisualizationManager, UseVisualizationManagerProps } from './VisualizationManager';

export interface UseParameterizedVisualizationManagerProps extends Omit<UseVisualizationManagerProps, 'availableTypes'> {
    context: VisualizationContext | string;
    customTypes?: VisualizationType[];
}

/**
 * Enhanced hook that automatically provides visualization types based on context
 */
export const useParameterizedVisualizationManager = ({
    context,
    customTypes,
    ...baseProps
}: UseParameterizedVisualizationManagerProps) => {
    const availableTypes = customTypes || VisualizationRegistry.getVisualizationTypes(context);

    return useBaseVisualizationManager({
        ...baseProps,
        availableTypes
    });
};

// ============================================================================
// COMPONENT-SPECIFIC VISUALIZATION MANAGERS
// ============================================================================

/**
 * Hook specifically for data analysis components
 */
export const useDataVisualizationManager = (props: Omit<UseVisualizationManagerProps, 'availableTypes'>) => {
    return useBaseVisualizationManager({
        ...props,
        availableTypes: DATA_ANALYSIS_VISUALIZATIONS
    });
};

/**
 * Hook specifically for stress analysis components
 */
export const useStressVisualizationManager = (props: Omit<UseVisualizationManagerProps, 'availableTypes'>) => {
    return useBaseVisualizationManager({
        ...props,
        availableTypes: STRESS_ANALYSIS_VISUALIZATIONS
    });
};

/**
 * Hook for general-purpose visualizations
 */
export const useGeneralVisualizationManager = (props: Omit<UseVisualizationManagerProps, 'availableTypes'>) => {
    return useBaseVisualizationManager({
        ...props,
        availableTypes: GENERAL_VISUALIZATIONS
    });
};

// ============================================================================
// VISUALIZATION-ENABLED COMPONENT WRAPPER
// ============================================================================

export interface VisualizationEnabledComponentProps {
    // Core data
    files: DataFile[];

    // Visualization context
    visualizationContext: VisualizationContext | string;
    customVisualizationTypes?: VisualizationType[];

    // Layout configuration
    containerWidth?: number;
    gridCols?: number;
    rowHeight?: number;

    // External state management (optional)
    externalVisualizations?: Visualization[];
    onVisualizationAdded?: (visualization: Visualization) => void;
    onVisualizationRemoved?: (id: string) => void;
    onVisualizationLayoutChanged?: (updatedVisualizations: Visualization[]) => void;
    onVisualizationStateChanged?: (id: string, state: VisualizationState) => void;

    // UI customization
    addButtonText?: string;
    addButtonIcon?: ReactNode;
    dialogTitle?: string;
    showFileSelector?: boolean;

    // Children (main component content)
    children: ReactNode;
}

export const VisualizationEnabledComponent: React.FC<VisualizationEnabledComponentProps> = ({
    files,
    visualizationContext,
    customVisualizationTypes,
    containerWidth = 1400,
    gridCols = 12,
    rowHeight = 120,
    externalVisualizations,
    onVisualizationAdded,
    onVisualizationRemoved,
    onVisualizationLayoutChanged,
    onVisualizationStateChanged,
    addButtonText = "Add Visualization",
    addButtonIcon = <Eye size={20} />,
    dialogTitle = "Add Visualization",
    showFileSelector = true,
    children
}) => {
    const {
        visualizations,
        isDialogOpen,
        selectedFileForView,
        openAddDialog,
        closeAddDialog,
        createVisualization,
        setSelectedFileForView,
        handleVisualizationRemoved,
        handleVisualizationLayoutChanged,
        handleVisualizationStateChanged
    } = useParameterizedVisualizationManager({
        files,
        context: visualizationContext,
        customTypes: customVisualizationTypes,
        externalVisualizations,
        onVisualizationAdded,
        onVisualizationRemoved,
        onVisualizationLayoutChanged,
        onVisualizationStateChanged
    });

    const availableTypes = customVisualizationTypes || VisualizationRegistry.getVisualizationTypes(visualizationContext);

    return (
        <div className="w-full">
            {/* Main component content */}
            <div className="mb-6">
                {children}
            </div>

            {/* Add visualization button */}
            {files.length > 0 && (
                <div className="flex justify-center mb-6">
                    <button
                        onClick={() => openAddDialog()}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                    >
                        {addButtonIcon}
                        {addButtonText}
                    </button>
                </div>
            )}

            {/* Visualizations Grid */}
            <VisualizationGrid
                visualizations={visualizations}
                files={files}
                onVisualizationRemoved={handleVisualizationRemoved}
                onLayoutChanged={handleVisualizationLayoutChanged}
                onVisualizationStateChanged={handleVisualizationStateChanged}
                containerWidth={containerWidth}
                gridCols={gridCols}
                rowHeight={rowHeight}
            />

            {/* Add Visualization Dialog */}
            <AddVisualizationDialog
                isOpen={isDialogOpen}
                onClose={closeAddDialog}
                onCreateVisualization={createVisualization}
                availableTypes={availableTypes}
                files={files}
                selectedFileForView={selectedFileForView}
                onSelectedFileChange={setSelectedFileForView}
                showFileSelector={showFileSelector}
                dialogTitle={dialogTitle}
            />
        </div>
    );
};

// ============================================================================
// CONVENIENCE COMPONENTS FOR SPECIFIC CONTEXTS
// ============================================================================

/**
 * Data Analysis Component with integrated visualizations
 */
export const DataAnalysisComponent: React.FC<Omit<VisualizationEnabledComponentProps, 'visualizationContext'>> = (props) => (
    <VisualizationEnabledComponent
        {...props}
        visualizationContext={VisualizationContext.DATA_ANALYSIS}
        dialogTitle="Add Data Visualization"
        addButtonText="Add Data View"
    />
);

/**
 * Stress Analysis Component with integrated visualizations
 */
export const StressAnalysisComponent: React.FC<Omit<VisualizationEnabledComponentProps, 'visualizationContext'>> = (props) => (
    <VisualizationEnabledComponent
        {...props}
        visualizationContext={VisualizationContext.STRESS_ANALYSIS}
        dialogTitle="Add Stress Analysis Visualization"
        addButtonText="Add Analysis View"
    />
);

/**
 * General Purpose Component with integrated visualizations
 */
export const GeneralVisualizationComponent: React.FC<Omit<VisualizationEnabledComponentProps, 'visualizationContext'>> = (props) => (
    <VisualizationEnabledComponent
        {...props}
        visualizationContext={VisualizationContext.GENERAL}
        dialogTitle="Add Visualization"
        addButtonText="Add View"
    />
);

// ============================================================================
// USAGE EXAMPLES AND MIGRATION UTILITIES
// ============================================================================

/**
 * Migration utility to convert existing components to use the parameterized system
 */
export class VisualizationMigrationHelper {
    /**
     * Convert legacy visualization arrays to registry contexts
     */
    static migrateToRegistry(
        contextName: string,
        legacyTypes: VisualizationType[]
    ): void {
        VisualizationRegistry.registerCustomContext(contextName, legacyTypes);
    }

    /**
     * Create a custom context by combining existing contexts
     */
    static createCombinedContext(
        contextName: string,
        contexts: (VisualizationContext | string)[]
    ): void {
        const combinedTypes: VisualizationType[] = [];
        const seenIds = new Set<string>();

        contexts.forEach(context => {
            const types = VisualizationRegistry.getVisualizationTypes(context);
            types.forEach(type => {
                if (!seenIds.has(type.id)) {
                    combinedTypes.push(type);
                    seenIds.add(type.id);
                }
            });
        });

        VisualizationRegistry.registerCustomContext(contextName, combinedTypes);
    }
}

// ============================================================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================================================

// Export commonly used visualization sets for backward compatibility
export const DATA_VISUALIZATIONS = DATA_ANALYSIS_VISUALIZATIONS;
export const RUN_VISUALIZATIONS = STRESS_ANALYSIS_VISUALIZATIONS;

// Export the main registry and hooks
// export {
//     VisualizationRegistry,
//     VisualizationContext,
//     useParameterizedVisualizationManager,
//     useDataVisualizationManager,
//     useStressVisualizationManager,
//     useGeneralVisualizationManager
// };