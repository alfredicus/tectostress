import React from 'react';
import RoseDiagramComponent from './RoseDiagramComponent';
import HistogramComponent from './HistogramComponent';
import WulffStereonetComponent from './WulffStereonetComponent';
import TableComponent from './TableComponent';
import {
    VisualizationCompState,
    RoseCompState,
    HistogramCompState,
    WulffCompState,
    DataFiles
} from './VisualizationStateSystem';

import MohrCircleComponent from './MohrCircleComponent';
import { MohrCompState } from './VisualizationStateSystem';

// ============================================================================
// ENHANCED VISUALIZATION PROPS
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
// MAIN VISUALIZATION COMPONENT
// ============================================================================

export const VisualizationComponent: React.FC<EnhancedVisualizationProps> = ({
    type,
    files,
    width,
    height,
    state,
    onStateChange,
    onDimensionChange
}) => {
    // Type-safe state casting helpers
    const castState = <T extends VisualizationCompState>(
        expectedType: string
    ): T | undefined => {
        if (state && state.type === expectedType) {
            return state as T;
        }
        return undefined;
    };

    // Type-safe state change handler
    const handleStateChange = <T extends VisualizationCompState>(newState: T) => {
        onStateChange?.(newState);
    };

    switch (type) {
        case 'rose':
            return (
                <RoseDiagramComponent
                    files={files}
                    width={width}
                    height={height}
                    state={castState<RoseCompState>('rose')}
                    onStateChange={handleStateChange}
                    onDimensionChange={onDimensionChange}
                />
            );

        case 'histogram':
            return (
                <HistogramComponent
                    files={files}
                    width={width}
                    height={height}
                    state={castState<HistogramCompState>('histogram')}
                    onStateChange={handleStateChange}
                    onDimensionChange={onDimensionChange}
                />
            );

        case 'wulff':
            return (
                <WulffStereonetComponent
                    files={files}
                    width={width}
                    height={height}
                    state={castState<WulffCompState>('wulff')}
                    onStateChange={handleStateChange}
                    onDimensionChange={onDimensionChange}
                />
            );

        case 'mohr':
            return (
                <MohrCircleComponent
                    files={files}
                    width={width}
                    height={height}
                    state={castState<MohrCompState>('mohr')}
                    onStateChange={handleStateChange}
                    onDimensionChange={onDimensionChange}
                />
            );

        case 'table':
            return (
                <TableComponent
                    files={files}
                    width={width}
                    height={height}
                    onDimensionChange={onDimensionChange}
                />
            );

        default:
            return (
                <div className="flex items-center justify-center h-full border-2 border-dashed border-gray-300 rounded-lg">
                    <div className="text-center text-gray-500">
                        <p className="text-lg font-medium">Unknown visualization type: {type}</p>
                        <p className="text-sm">Please select a supported visualization type.</p>
                    </div>
                </div>
            );
    }
};

// ============================================================================
// VISUALIZATION FACTORY
// ============================================================================

export class VisualizationFactory {
    static createDefaultState(
        type: string,
        width: number = 400,
        height: number = 400
    ): VisualizationCompState | null {
        switch (type) {
            case 'rose':
                return {
                    type: 'rose',
                    open: false,
                    settings: {
                        binAngle: 10,
                        binColor: '#FF0000',
                        lineColor: '#000000',
                        showLines: true,
                        is360: false,
                        showLabels: false,
                        showCardinals: true,
                        showCircles: true,
                        innerRadius: 5,
                    },
                    selectedColumn: '',
                    plotDimensions: { width, height }
                } as RoseCompState;

            case 'histogram':
                return {
                    type: 'histogram',
                    open: false,
                    settings: {
                        bins: 20,
                        fillColor: '#3498db',
                        strokeColor: '#2c3e50',
                        showGrid: true,
                        showDensity: false,
                        showLabels: true,
                        xAxisLabel: 'Value',
                        yAxisLabel: 'Frequency',
                    },
                    selectedColumn: '',
                    plotDimensions: { width, height }
                } as HistogramCompState;

            case 'wulff':
                return {
                    type: 'wulff',
                    open: false,
                    settings: {
                        projection: 'stereonet',
                        hemisphere: 'upper',
                        showGrid: true,
                        gridSpacing: 10,
                        pointSize: 3,
                        pointColor: '#3498db',
                    },
                    selectedColumn: '',
                    plotDimensions: { width, height }
                } as WulffCompState;

            case 'mohr':
                return {
                    type: 'mohr',
                    open: false,
                    settings: {
                        sigma1: 100,
                        sigma2: 60,
                        sigma3: 20,
                        n1: 1 / Math.sqrt(3),
                        n2: 1 / Math.sqrt(3),
                        n3: 1 / Math.sqrt(3),
                        showGrid: true,
                        showLabels: true,
                        showColoredArea: true,
                        showStressPoint: true,
                        circle1Color: '#0066cc',
                        circle2Color: '#ff6b35',
                        circle3Color: '#28a745',
                        areaColor: 'rgba(200, 200, 200, 0.3)',
                        stressPointColor: '#8e44ad',
                        strokeWidth: 2
                    },
                    selectedColumn: '',
                    plotDimensions: { width, height }
                } as MohrCompState;

            default:
                return null;
        }
    }

    static getSupportedTypes(): Array<{
        id: string;
        title: string;
        description: string;
        defaultSize: { w: number; h: number };
    }> {
        return [
            {
                id: 'rose',
                title: 'Rose Diagram',
                description: 'Circular histogram for directional data',
                defaultSize: { w: 4, h: 4 }
            },
            {
                id: 'histogram',
                title: 'Histogram',
                description: 'Distribution visualization for numeric data',
                defaultSize: { w: 6, h: 4 }
            },
            {
                id: 'wulff',
                title: 'Wulff Stereonet',
                description: 'Stereographic projection for orientation data',
                defaultSize: { w: 5, h: 5 }
            },
            {
                id: 'mohr',
                title: 'Mohr Circle',
                description: 'Stress state visualization for structural analysis',
                defaultSize: { w: 6, h: 4 }
            },
            {
                id: 'table',
                title: 'Data Table',
                description: 'Tabular view of raw data',
                defaultSize: { w: 12, h: 3 }
            }
        ];
    }
}

// ============================================================================
// GLOBAL STATE MANAGER INSTANCE
// ============================================================================

import { VisualizationStateManager } from './VisualizationStateSystem';

// Create a singleton instance for global state management
export const globalStateManager = new VisualizationStateManager();

// ============================================================================
// ENHANCED DASHBOARD INTEGRATION HELPERS
// ============================================================================

export interface DashboardVisualization {
    id: string;
    type: string;
    title: string;
    layout: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    state?: VisualizationCompState;
}

export class DashboardStateManager {
    private static instance: DashboardStateManager;
    private visualizations: Map<string, DashboardVisualization> = new Map();
    private stateChangeListeners: Set<(visualizations: DashboardVisualization[]) => void> = new Set();

    static getInstance(): DashboardStateManager {
        if (!DashboardStateManager.instance) {
            DashboardStateManager.instance = new DashboardStateManager();
        }
        return DashboardStateManager.instance;
    }

    // Add or update a visualization
    setVisualization(viz: DashboardVisualization): void {
        this.visualizations.set(viz.id, viz);
        this.notifyListeners();
    }

    // Remove a visualization
    removeVisualization(id: string): void {
        this.visualizations.delete(id);
        globalStateManager.getState(id) && globalStateManager.setState(id, null as any);
        this.notifyListeners();
    }

    // Get a visualization
    getVisualization(id: string): DashboardVisualization | undefined {
        return this.visualizations.get(id);
    }

    // Get all visualizations
    getAllVisualizations(): DashboardVisualization[] {
        return Array.from(this.visualizations.values());
    }

    // Update visualization state
    updateVisualizationState(id: string, state: VisualizationCompState): void {
        const viz = this.visualizations.get(id);
        if (viz) {
            viz.state = state;
            this.visualizations.set(id, viz);
            globalStateManager.setState(id, state);
            this.notifyListeners();
        }
    }

    // Update visualization layout
    updateVisualizationLayout(id: string, layout: DashboardVisualization['layout']): void {
        const viz = this.visualizations.get(id);
        if (viz) {
            viz.layout = layout;
            this.visualizations.set(id, viz);
            this.notifyListeners();
        }
    }

    // Subscribe to changes
    subscribe(listener: (visualizations: DashboardVisualization[]) => void): () => void {
        this.stateChangeListeners.add(listener);
        return () => {
            this.stateChangeListeners.delete(listener);
        };
    }

    // Notify all listeners
    private notifyListeners(): void {
        const visualizations = this.getAllVisualizations();
        this.stateChangeListeners.forEach(listener => listener(visualizations));
    }

    // Export entire dashboard state
    exportDashboardState(): string {
        const dashboardState = {
            visualizations: this.getAllVisualizations(),
            globalStates: globalStateManager.getAllStates(),
            timestamp: new Date().toISOString(),
            version: '1.0'
        };
        return JSON.stringify(dashboardState, null, 2);
    }

    // Import entire dashboard state
    importDashboardState(jsonString: string): boolean {
        try {
            const dashboardState = JSON.parse(jsonString);

            // Clear current state
            this.visualizations.clear();
            globalStateManager.clearAllStates();

            // Restore visualizations
            if (dashboardState.visualizations) {
                dashboardState.visualizations.forEach((viz: DashboardVisualization) => {
                    this.visualizations.set(viz.id, viz);
                });
            }

            // Restore global states
            if (dashboardState.globalStates) {
                globalStateManager.restoreAllStates(dashboardState.globalStates);
            }

            this.notifyListeners();
            return true;
        } catch (error) {
            console.error('Failed to import dashboard state:', error);
            return false;
        }
    }

    // Clear all data
    clearAll(): void {
        this.visualizations.clear();
        globalStateManager.clearAllStates();
        this.notifyListeners();
    }
}

// ============================================================================
// HOOKS FOR DASHBOARD INTEGRATION
// ============================================================================

import { useState, useEffect } from 'react';

export function useDashboardState() {
    const [visualizations, setVisualizations] = useState<DashboardVisualization[]>([]);
    const dashboardManager = DashboardStateManager.getInstance();

    useEffect(() => {
        // Initial load
        setVisualizations(dashboardManager.getAllVisualizations());

        // Subscribe to changes
        const unsubscribe = dashboardManager.subscribe(setVisualizations);

        return unsubscribe;
    }, [dashboardManager]);

    const addVisualization = (viz: Omit<DashboardVisualization, 'state'>) => {
        const defaultState = VisualizationFactory.createDefaultState(
            viz.type,
            viz.layout.w * 100, // Convert grid units to pixels
            viz.layout.h * 100
        );

        const fullViz: DashboardVisualization = {
            ...viz,
            state: defaultState || undefined
        };

        dashboardManager.setVisualization(fullViz);
    };

    const removeVisualization = (id: string) => {
        dashboardManager.removeVisualization(id);
    };

    const updateVisualizationState = (id: string, state: VisualizationCompState) => {
        dashboardManager.updateVisualizationState(id, state);
    };

    const updateVisualizationLayout = (id: string, layout: DashboardVisualization['layout']) => {
        dashboardManager.updateVisualizationLayout(id, layout);
    };

    const exportDashboard = () => {
        return dashboardManager.exportDashboardState();
    };

    const importDashboard = (jsonString: string) => {
        return dashboardManager.importDashboardState(jsonString);
    };

    const clearDashboard = () => {
        dashboardManager.clearAll();
    };

    return {
        visualizations,
        addVisualization,
        removeVisualization,
        updateVisualizationState,
        updateVisualizationLayout,
        exportDashboard,
        importDashboard,
        clearDashboard
    };
}

// ============================================================================
// USAGE EXAMPLE
// ============================================================================

/*
// Example usage in a dashboard component:

const DashboardExample: React.FC = () => {
  const {
    visualizations,
    addVisualization,
    removeVisualization,
    updateVisualizationState,
    updateVisualizationLayout
  } = useDashboardState();

  const handleAddRoseDiagram = () => {
    addVisualization({
      id: `rose-${Date.now()}`,
      type: 'rose',
      title: 'Rose Diagram',
      layout: { x: 0, y: 0, w: 4, h: 4 }
    });
  };

  const handleStateChange = (vizId: string) => (state: VisualizationCompState) => {
    updateVisualizationState(vizId, state);
  };

  return (
    <div>
      <button onClick={handleAddRoseDiagram}>Add Rose Diagram</button>
      
      {visualizations.map(viz => (
        <div key={viz.id}>
          <h3>{viz.title}</h3>
          <VisualizationComponent
            type={viz.type}
            files={files} // Your data files
            width={viz.layout.w * 100}
            height={viz.layout.h * 100}
            state={viz.state}
            onStateChange={handleStateChange(viz.id)}
          />
        </div>
      ))}
    </div>
  );
};
*/