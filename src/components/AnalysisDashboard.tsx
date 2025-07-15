import React, { useState, useCallback, useRef, useEffect } from 'react';
import { PlusCircle, X, Dribbble, BarChart, LineChart, PieChart, Table, GripHorizontal, Target } from 'lucide-react';
import { VisualizationComponent } from './VisualizationComponent';
import { SharedData, Visualization, VisualizationState } from './types';
import GridLayout, { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { DataFile } from './DataFile';

const visualizationTypes = [
    { id: 'table', title: 'Tableau', icon: Table },
    { id: 'rose', title: 'Rose diagram', icon: PieChart },
    { id: 'wulff', title: 'Wulff Stereonet', icon: Target },
    { id: 'histogram', title: 'Histo', icon: Target },
    { id: 'sphere', title: 'Sphere', icon: Dribbble },
    { id: 'line', title: 'Graphique en ligne', icon: LineChart },
    { id: 'three', title: 'Test 3D', icon: PieChart },
    { id: 'two', title: 'Test 2D', icon: PieChart },
];

// Simple default layout
const getDefaultLayoutForType = (type: string) => {
    const layouts = {
        table: { w: 12, h: 3 },
        rose: { w: 4, h: 4 },
        wulff: { w: 6, h: 4 },
        histogram: { w: 6, h: 4 },
        sphere: { w: 6, h: 4 },
        line: { w: 8, h: 3 },
        three: { w: 6, h: 4 },
        two: { w: 6, h: 3 },
        default: { w: 6, h: 3 }
    };

    return layouts[type] || layouts.default;
};

interface AnalysisDashboardProps {
    files: DataFile[];
    visualizations: Visualization[];
    onVisualizationAdded: (visualization: Visualization) => void;
    onVisualizationRemoved: (id: string) => void;
    onLayoutChanged: (visualizations: Visualization[]) => void;
    onVisualizationStateChanged: (id: string, state: VisualizationState) => void;
}

const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({
    files,
    visualizations,
    onVisualizationAdded,
    onVisualizationRemoved,
    onLayoutChanged,
    onVisualizationStateChanged
}) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [sharedData, setSharedData] = useState<SharedData>({});
    
    // Container ref to measure available width
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState<number>(1400);

    // Measure container width
    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                const newWidth = containerRef.current.clientWidth;
                setContainerWidth(newWidth);
            }
        };

        updateWidth();
        const resizeObserver = new ResizeObserver(updateWidth);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

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

        // Find the maximum Y position + height of all existing visualizations
        const maxY = Math.max(...visualizations.map(viz => viz.layout.y + viz.layout.h));
        
        // Place new visualization at the bottom, starting from x = 0
        return { x: 0, y: maxY };
    };

    const addVisualization = (type: string, title: string) => {
        const layout = getDefaultLayoutForType(type);
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

    // Handle dimension changes from child components - disabled to prevent parent resize
    const handleVisualizationDimensionChange = useCallback((vizId: string, newWidth: number, newHeight: number) => {
        // Do nothing - we want the parent panel to stay the same size
        // The child components will handle their internal resizing
        return;
    }, []);

    // Calculate dynamic dimensions based on layout and container width
    const calculateVisualizationDimensions = (viz: Visualization) => {
        const cellWidth = containerWidth / 12;
        const cellHeight = 120;
        const padding = 32;
        
        const width = Math.max(viz.layout.w * cellWidth - padding, 300);
        const height = Math.max(viz.layout.h * cellHeight - padding, 200);
        
        return { width, height };
    };

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
                                <div className="p-2 h-[calc(100%-2.5rem)] overflow-hidden">
                                    <VisualizationComponent
                                        type={viz.type}
                                        files={files}
                                        width={dimensions.width}
                                        height={dimensions.height}
                                        state={viz.state}
                                        onStateChange={(newState) => onVisualizationStateChanged(viz.id, newState)}
                                        onDimensionChange={(newWidth, newHeight) => 
                                            handleVisualizationDimensionChange(viz.id, newWidth, newHeight)
                                        }
                                    />
                                </div>
                            </div>
                        );
                    })}
                </GridLayout>
            </div>

            {/* Add Visualization Dialog */}
            {isDialogOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div
                        className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 transform scale-95 opacity-0 transition-all duration-200"
                        style={{
                            animation: 'dialogZoomIn 0.2s ease-out forwards',
                        }}
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">Ajouter une visualisation</h2>
                            <button
                                onClick={() => setIsDialogOpen(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            {visualizationTypes.map((type) => {
                                const Icon = type.icon;
                                const layout = getDefaultLayoutForType(type.id);
                                
                                return (
                                    <button
                                        key={type.id}
                                        onClick={() => addVisualization(type.id, type.title)}
                                        className="p-4 border rounded-md hover:bg-gray-50 flex flex-col items-center gap-2 transition-colors hover:border-blue-300"
                                    >
                                        <Icon size={32} className="text-gray-600" />
                                        <span className="font-medium">{type.title}</span>
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