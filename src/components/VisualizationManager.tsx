// VisualizationManager.tsx - Reusable visualization management system

import React, { useState } from 'react';
import { X, GripHorizontal } from 'lucide-react';
import GridLayout, { Layout } from 'react-grid-layout';
import { Visualization, VisualizationState } from './types';
import { VisualizationComponent } from './VisualizationComponent';
import { DataFile } from './DataFile';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { RoseIcon } from './Rose/RoseParameters';
import { HistogramDescriptor, HistogramIcon } from './Histo/HistogramDescriptor';
import { WulffStereonetDescriptor } from './Wulff/WulffDescriptor';
import { RoseDiagramDescriptor } from './Rose/RoseDiagramDescriptor';
import { MohrCircleDescriptor } from './Mohr/MohrCircleDescriptor';

// ============================================================================
// VISUALIZATION TYPE DEFINITIONS
// ============================================================================

export interface VisualizationType {
    id: string;
    title: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    defaultLayout: { w: number; h: number };
}

const ResultsIcon: React.FC<{ size?: number; className?: string }> = ({
    size = 24,
    className = ""
}) => (
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

const SolutionIcon: React.FC<{ size?: number; className?: string }> = ({
    size = 24,
    className = ""
}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M8 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="6" r="1" fill="currentColor" />
        <circle cx="18" cy="12" r="1" fill="currentColor" />
        <circle cx="12" cy="18" r="1" fill="currentColor" />
        <circle cx="6" cy="12" r="1" fill="currentColor" />
    </svg>
);

// ============================================================================
// VISUALIZATION TYPE PRESETS
// ============================================================================

export const DATA_VISUALIZATIONS: VisualizationType[] = [
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
    }
];

export const RUN_VISUALIZATIONS: VisualizationType[] = [
    {
        id: 'results',
        title: 'Results Summary',
        icon: ResultsIcon,
        defaultLayout: { w: 8, h: 6 }
    },
    {
        id: 'solution',
        title: 'Solution Visualization',
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
    }
];

// ============================================================================
// ADD VISUALIZATION DIALOG
// ============================================================================

interface AddVisualizationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateVisualization: (type: string, title: string) => void;
    availableTypes: VisualizationType[];
    files: DataFile[];
    selectedFileForView: string;
    onSelectedFileChange: (fileId: string) => void;
    showFileSelector?: boolean;
    dialogTitle?: string;
}

export const AddVisualizationDialog: React.FC<AddVisualizationDialogProps> = ({
    isOpen,
    onClose,
    onCreateVisualization,
    availableTypes,
    files,
    selectedFileForView,
    onSelectedFileChange,
    showFileSelector = true,
    dialogTitle = "Add Visualization"
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div
                className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 transform scale-95 opacity-0 transition-all duration-200"
                style={{
                    animation: 'dialogZoomIn 0.2s ease-out forwards',
                }}
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">
                        {dialogTitle}
                        {selectedFileForView && (
                            <span className="text-sm font-normal text-gray-600 ml-2">
                                for {files.find(f => f.id === selectedFileForView)?.name}
                            </span>
                        )}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* File selector if enabled and no specific file was selected */}
                {showFileSelector && !selectedFileForView && files.length > 0 && (
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-2">Select Data Source:</label>
                        <select
                            value={selectedFileForView}
                            onChange={(e) => onSelectedFileChange(e.target.value)}
                            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All loaded files</option>
                            {files.map(file => (
                                <option key={file.id} value={file.id}>
                                    {file.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className={`grid gap-4 ${availableTypes.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                    {availableTypes.map((type) => {
                        const Icon = type.icon;

                        return (
                            <button
                                key={type.id}
                                onClick={() => onCreateVisualization(type.id, type.title)}
                                className="p-4 border rounded-md hover:bg-gray-50 flex flex-col items-center gap-2 transition-colors hover:border-blue-300"
                            >
                                <Icon size={42} className="text-gray-600" />
                                <span className="font-medium">{type.title}</span>
                                <span className="text-xs text-gray-500">
                                    {type.defaultLayout.w}×{type.defaultLayout.h} grid units
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="mt-6 p-4 bg-blue-50 rounded-md">
                    <p className="text-sm text-blue-800">
                        <strong>Tip:</strong> Visualizations will be added below your data tables. You can drag and resize them as needed.
                    </p>
                </div>
            </div>

            <style>{`
                @keyframes dialogZoomIn {
                    from {
                        transform: scale(0.95);
                        opacity: 0;
                    }
                    to {
                        transform: scale(1);
                        opacity: 1;
                    }
                }
            `}</style>
        </div>
    );
};

// ============================================================================
// VISUALIZATION GRID MANAGER
// ============================================================================

interface VisualizationGridProps {
    visualizations: Visualization[];
    files: DataFile[];
    onVisualizationRemoved: (id: string) => void;
    onLayoutChanged: (updatedVisualizations: Visualization[]) => void;
    onVisualizationStateChanged: (id: string, state: VisualizationState) => void;
    containerWidth?: number;
    gridCols?: number;
    rowHeight?: number;
}

export const VisualizationGrid: React.FC<VisualizationGridProps> = ({
    visualizations,
    files,
    onVisualizationRemoved,
    onLayoutChanged,
    onVisualizationStateChanged,
    containerWidth = 1200,
    gridCols = 12,
    rowHeight = 120
}) => {
    const getLayoutFromVisualizations = (): Layout[] => {
        return visualizations.map(viz => ({
            i: viz.id,
            x: viz.layout.x,
            y: viz.layout.y,
            w: viz.layout.w,
            h: viz.layout.h,
            isDraggable: true,
            isResizable: true,
        }));
    };

    const handleLayoutChange = (layout: Layout[]) => {
        const updatedVisualizations = visualizations.map(viz => {
            const newLayout = layout.find(l => l.i === viz.id);
            if (newLayout) {
                return {
                    ...viz,
                    layout: {
                        x: newLayout.x,
                        y: newLayout.y,
                        w: newLayout.w,
                        h: newLayout.h
                    }
                };
            }
            return viz;
        });
        onLayoutChanged(updatedVisualizations);
    };

    // Calculate dynamic dimensions based on layout and container width
    const calculateVisualizationDimensions = (viz: Visualization) => {
        const cellWidth = containerWidth / gridCols;
        const cellHeight = rowHeight;
        const padding = 32;

        const width = Math.max(viz.layout.w * cellWidth - padding, 300);
        const height = Math.max(viz.layout.h * cellHeight - padding, 200);

        return { width, height };
    };

    if (visualizations.length === 0) {
        return null;
    }

    return (
        <div className="mt-8">
            <div className="flex items-center justify-between mb-4 border-b pb-2">
                <h3 className="text-lg font-semibold">Visualizations</h3>
                <span className="text-sm text-gray-500">
                    {visualizations.length} visualization{visualizations.length !== 1 ? 's' : ''}
                </span>
            </div>

            <GridLayout
                className="layout"
                layout={getLayoutFromVisualizations()}
                cols={gridCols}
                rowHeight={rowHeight}
                width={containerWidth}
                onLayoutChange={handleLayoutChange}
                draggableHandle=".drag-handle"
                margin={[16, 16]}
                containerPadding={[0, 0]}
                compactType="vertical"
                preventCollision={false}
                autoSize={true}
            >
                {visualizations.map((viz) => {
                    const dimensions = calculateVisualizationDimensions(viz);

                    return (
                        <div
                            key={viz.id}
                            className="border rounded-md bg-white shadow-sm overflow-hidden"
                        >
                            <div className="flex items-center justify-between p-2 border-b bg-gray-50">
                                <div className="flex items-center gap-2">
                                    <GripHorizontal
                                        size={16}
                                        className="text-gray-400 cursor-move drag-handle hover:text-gray-600"
                                    />
                                    <span className="font-medium text-sm">{viz.title}</span>
                                    <span className="text-xs text-gray-500">
                                        ({viz.layout.w}x{viz.layout.h})
                                    </span>
                                </div>
                                <button
                                    onClick={() => onVisualizationRemoved(viz.id)}
                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="p-2 h-[calc(100%-2.5rem)] overflow-hidden">
                                <VisualizationComponent
                                    type={viz.type}
                                    files={files}
                                    width={dimensions.width}
                                    height={dimensions.height}
                                    state={viz.state}
                                    onStateChange={(newState) => onVisualizationStateChanged(viz.id, newState)}
                                    onDimensionChange={(newWidth, newHeight) => {
                                        // Handle dimension changes if needed
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </GridLayout>
        </div>
    );
};

// ============================================================================
// VISUALIZATION MANAGER HOOK
// ============================================================================

export interface UseVisualizationManagerProps {
    files: DataFile[];
    availableTypes: VisualizationType[];
    externalVisualizations?: Visualization[];
    onVisualizationAdded?: (visualization: Visualization) => void;
    onVisualizationRemoved?: (id: string) => void;
    onVisualizationLayoutChanged?: (updatedVisualizations: Visualization[]) => void;
    onVisualizationStateChanged?: (id: string, state: VisualizationState) => void;
}

export const useVisualizationManager = ({
    files,
    availableTypes,
    externalVisualizations,
    onVisualizationAdded: externalOnVisualizationAdded,
    onVisualizationRemoved: externalOnVisualizationRemoved,
    onVisualizationLayoutChanged: externalOnVisualizationLayoutChanged,
    onVisualizationStateChanged: externalOnVisualizationStateChanged
}: UseVisualizationManagerProps) => {
    // Internal visualization state (if not managed externally)
    const [internalVisualizations, setInternalVisualizations] = useState<Visualization[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedFileForView, setSelectedFileForView] = useState<string>('');

    // Use external visualizations if provided, otherwise use internal state
    const visualizations = externalVisualizations || internalVisualizations;

    const handleVisualizationAdded = externalOnVisualizationAdded || ((viz: Visualization) => {
        setInternalVisualizations(prev => [...prev, viz]);
    });

    const handleVisualizationRemoved = externalOnVisualizationRemoved || ((id: string) => {
        setInternalVisualizations(prev => prev.filter(v => v.id !== id));
    });

    const handleVisualizationLayoutChanged = externalOnVisualizationLayoutChanged || ((updatedViz: Visualization[]) => {
        setInternalVisualizations(updatedViz);
    });

    const handleVisualizationStateChanged = externalOnVisualizationStateChanged || ((id: string, state: VisualizationState) => {
        setInternalVisualizations(prev => prev.map(viz =>
            viz.id === id ? { ...viz, state } : viz
        ));
    });

    const openAddDialog = (fileId?: string) => {
        if (fileId) {
            setSelectedFileForView(fileId);
        } else {
            setSelectedFileForView('');
        }
        setIsDialogOpen(true);
    };

    const closeAddDialog = () => {
        setIsDialogOpen(false);
        setSelectedFileForView('');
    };

    const createVisualization = (type: string, title: string) => {
        const vizType = availableTypes.find(t => t.id === type);
        if (!vizType) return;

        // Find the bottom position for the new visualization
        const findBottomPosition = (w: number, h: number) => {
            if (visualizations.length === 0) {
                return { x: 0, y: 0 };
            }

            const maxY = Math.max(...visualizations.map(viz => viz.layout.y + viz.layout.h));
            return { x: 0, y: maxY };
        };

        const position = findBottomPosition(vizType.defaultLayout.w, vizType.defaultLayout.h);

        const newVisualization: Visualization = {
            id: `viz-${Date.now()}`,
            type,
            title: selectedFileForView ?
                `${title} - ${files.find(f => f.id === selectedFileForView)?.name || 'Data'}` :
                title,
            layout: {
                ...position,
                w: vizType.defaultLayout.w,
                h: vizType.defaultLayout.h
            }
        };

        handleVisualizationAdded(newVisualization);
        closeAddDialog();
    };

    return {
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
    };
};