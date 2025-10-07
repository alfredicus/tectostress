// AnalysisDashboard.tsx (REFACTORISÉ)
// Plus de duplication d'icônes, de layouts, etc.
// Tout vient du Registry

import React, { useState, useEffect, useRef, useCallback } from 'react';
import GridLayout, { Layout } from 'react-grid-layout';
import { X, GripHorizontal, PlusCircle } from 'lucide-react';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import { VisualizationComponent } from './VisualizationComponent';
import { getVisualizationRegistry } from './VisualizationRegistry';
import { VisualizationFactory } from './VisualizationFactory';
import { VisualizationContext } from './VisualizationDescriptor';
import { DataFile, Visualization, VisualizationState } from './types';

// ============================================================================
// PROPS
// ============================================================================

interface AnalysisDashboardProps {
    files: DataFile[];
    visualizations: Visualization[];
    onVisualizationAdded: (visualization: Visualization) => void;
    onVisualizationRemoved: (id: string) => void;
    onLayoutChanged: (visualizations: Visualization[]) => void;
    onVisualizationStateChanged: (id: string, state: VisualizationState) => void;

    // NOUVEAU : Contexte optionnel pour filtrer les visualisations disponibles
    context?: VisualizationContext;
}

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({
    files,
    visualizations,
    onVisualizationAdded,
    onVisualizationRemoved,
    onLayoutChanged,
    onVisualizationStateChanged,
    context = VisualizationContext.DATA_ANALYSIS // Par défaut
}) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState<number>(1400);

    // ========== OBTENIR LES TYPES DE VISUALISATIONS DISPONIBLES ==========
    // Plus de liste hardcodée ! Tout vient du Registry
    const registry = getVisualizationRegistry();
    const availableVisualizationTypes = registry.getByContext(context);

    // ========== MESURE DU CONTENEUR ==========
    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.clientWidth);
            }
        };

        updateWidth();
        const resizeObserver = new ResizeObserver(updateWidth);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => resizeObserver.disconnect();
    }, []);

    // ========== GESTION DU LAYOUT ==========
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

    const findBottomPosition = (w: number, h: number) => {
        if (visualizations.length === 0) {
            return { x: 0, y: 0 };
        }

        const maxY = Math.max(...visualizations.map(viz => viz.layout.y + viz.layout.h));
        return { x: 0, y: maxY };
    };

    // ========== AJOUTER UNE VISUALISATION ==========
    const addVisualization = (type: string, title: string) => {
        // Obtenir le layout par défaut via la Factory (pas de duplication !)
        const layout = VisualizationFactory.getDefaultLayout(type);
        const position = findBottomPosition(layout.w, layout.h);

        const newVisualization: Visualization = {
            id: `viz-${Date.now()}`,
            type,
            title,
            layout: {
                ...position,
                w: layout.w,
                h: layout.h
            }
        };

        onVisualizationAdded(newVisualization);
        setIsDialogOpen(false);
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

    const handleVisualizationDimensionChange = useCallback(
        (vizId: string, newWidth: number, newHeight: number) => {
            // Les enfants gèrent leur propre redimensionnement interne
            return;
        },
        []
    );

    const calculateVisualizationDimensions = (viz: Visualization) => {
        const cellWidth = containerWidth / 12;
        const cellHeight = 120;
        const padding = 32;

        const width = Math.max(viz.layout.w * cellWidth - padding, 300);
        const height = Math.max(viz.layout.h * cellHeight - padding, 200);

        return { width, height };
    };

    // ========== RENDER ==========
    return (
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-full mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 border-b pb-4">
                <h1 className="text-2xl">Analyse</h1>
                <button
                    onClick={() => setIsDialogOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                >
                    <PlusCircle size={20} />
                    Add
                </button>
            </div>

            {/* Grid Layout */}
            <div ref={containerRef} className="w-full">
                <GridLayout
                    className="layout"
                    layout={getLayoutFromVisualizations()}
                    cols={12}
                    rowHeight={120}
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

                                <div className="p-2 h-[calc(100%-40px)]">
                                    <VisualizationComponent
                                        type={viz.type}
                                        files={files}
                                        width={dimensions.width}
                                        height={dimensions.height}
                                        state={viz.state}
                                        onStateChange={(state) =>
                                            onVisualizationStateChanged(viz.id, state)
                                        }
                                        onDimensionChange={(w, h) =>
                                            handleVisualizationDimensionChange(viz.id, w, h)
                                        }
                                    />
                                </div>
                            </div>
                        );
                    })}
                </GridLayout>
            </div>

            {/* Dialog pour ajouter une visualisation */}
            {isDialogOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold">Add Visualization</h2>
                            <button
                                onClick={() => setIsDialogOpen(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Grille des visualisations disponibles - DYNAMIQUE */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {availableVisualizationTypes.map((descriptor) => {
                                const Icon = descriptor.icon;
                                const layout = descriptor.defaultLayout;

                                return (
                                    <button
                                        key={descriptor.id}
                                        onClick={() => addVisualization(descriptor.id, descriptor.title)}
                                        className="p-4 border rounded-md hover:bg-gray-50 flex flex-col items-center gap-2 transition-colors hover:border-blue-300"
                                    >
                                        <Icon size={42} className="text-gray-600" />
                                        <span className="font-medium">{descriptor.title}</span>
                                        {descriptor.description && (
                                            <span className="text-xs text-gray-400 text-center">
                                                {descriptor.description}
                                            </span>
                                        )}
                                        <span className="text-xs text-gray-500">
                                            {layout.w}×{layout.h} grid units
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

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
                
                .react-grid-item.react-resizable .react-resizable-handle {
                    background-color: #e5e7eb;
                    border: 1px solid #d1d5db;
                    transition: background-color 0.2s ease;
                }
                
                .react-grid-item.react-resizable .react-resizable-handle:hover {
                    background-color: #3b82f6;
                }
                
                .react-grid-item {
                    transition: transform 0.2s ease;
                }
                
                .react-grid-item.react-grid-item-resizing {
                    transition: none;
                }
            `}</style>
        </div>
    );
};

export default AnalysisDashboard;