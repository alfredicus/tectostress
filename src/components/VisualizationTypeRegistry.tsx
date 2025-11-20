// VisualizationTypeRegistry.tsx - Centralized registry for visualization types

import { VisualizationType } from './VisualizationManager';
import { useVisualizationManager as useBaseVisualizationManager, UseVisualizationManagerProps } from './VisualizationManager';
import React, { ReactNode } from 'react';
import { DataFile } from './DataFile';
import { Visualization, VisualizationState } from './types';
import { AddVisualizationDialog, VisualizationGrid } from './VisualizationManager';
import { Eye } from 'lucide-react'; // Example icon, replace with actual icons as needed
import { RoseDiagramDescriptor } from './Rose/RoseDiagramDescriptor';
import { HistogramDescriptor } from './Histo/HistogramDescriptor';
import { WulffStereonetDescriptor } from './Wulff/WulffDescriptor';
import { MohrCircleDescriptor } from './Mohr/MohrCircleDescriptor';
import { FractureMap2DDescriptor } from './Map2D/FractureMap2DDescriptor';

// ============================================================================
// ICON COMPONENTS
// ============================================================================
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
        icon: RoseDiagramDescriptor.icon,
        defaultLayout: { w: 4, h: 4 }
    },
    {
        id: 'histogram',
        title: 'Histogram',
        icon: HistogramDescriptor.icon,
        defaultLayout: { w: 6, h: 4 }
    },
    {
        id: 'wulff',
        title: 'Wulff Stereonet',
        icon: WulffStereonetDescriptor.icon,
        defaultLayout: { w: 6, h: 4 }
    },
    {
        id: 'mohr',
        title: 'Mohr Circle',
        icon: MohrCircleDescriptor.icon,
        defaultLayout: { w: 6, h: 4 }
    },
    {
        id: 'fractureMap2D',
        title: 'Fracture Map 2D',
        icon: FractureMap2DDescriptor.icon,
        defaultLayout: { w: 8, h: 6 }
    },
    {
        id: 'fractureMap2D',
        title: 'Fracture Map 2D',
        icon: FractureMap2DDescriptor.icon,
        defaultLayout: { w: 4, h: 4 }
    }
];

/**
 * Context for stress inversion analysis and results
 */
export const RUN_ANALYSIS_VISUALIZATIONS: VisualizationType[] = [
    {
        id: 'histogram',
        title: 'Histogram',
        icon: HistogramDescriptor.icon,
        defaultLayout: { w: 6, h: 4 }
    },
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
        icon: MohrCircleDescriptor.icon,
        defaultLayout: { w: 6, h: 4 }
    },
    {
        id: 'wulff',
        title: 'Data Plot (Stereonet)',
        icon: WulffStereonetDescriptor.icon,
        defaultLayout: { w: 6, h: 4 }
    },
    {
        id: 'rose',
        title: 'Strike Distribution',
        icon: RoseDiagramDescriptor.icon,
        defaultLayout: { w: 4, h: 4 }
    },
    {
        id: 'fractureMap2D',
        title: 'Fracture Map 2D',
        icon: FractureMap2DDescriptor.icon,
        defaultLayout: { w: 4, h: 4 }
    }
];


// ============================================================================
// VISUALIZATION CONTEXT MANAGER
// ============================================================================

export enum VisualizationContext {
    DATA_ANALYSIS = 'data_analysis',
    RUN_ANALYSIS = 'stress_analysis'
}

export class VisualizationRegistry {
    private static contexts: Map<VisualizationContext, VisualizationType[]> = new Map([
        [VisualizationContext.DATA_ANALYSIS, DATA_ANALYSIS_VISUALIZATIONS],
        [VisualizationContext.RUN_ANALYSIS, RUN_ANALYSIS_VISUALIZATIONS]
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
        availableTypes: RUN_ANALYSIS_VISUALIZATIONS
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
        visualizationContext={VisualizationContext.RUN_ANALYSIS}
        dialogTitle="Add Stress Analysis Visualization"
        addButtonText="Add Analysis View"
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
export const RUN_VISUALIZATIONS = RUN_ANALYSIS_VISUALIZATIONS;
