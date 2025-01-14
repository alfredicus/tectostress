import React, { useState } from 'react';
import { PlusCircle, X, BarChart, LineChart, PieChart, Table, GripHorizontal } from 'lucide-react';
import { VisualizationComponent } from './VisualizationComponents';
import { Visualization, SharedData } from './types';
import GridLayout, { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const visualizationTypes = [
    { id: 'table', title: 'Tableau', icon: Table },
    { id: 'rose', title: 'Rose diagram', icon: PieChart },
    { id: 'line', title: 'Graphique en ligne', icon: LineChart },
    { id: 'pie', title: 'Graphique circulaire', icon: PieChart },
];

const defaultLayout = {
    table: { w: 4, h: 2 },
    rose: { w: 2, h: 2 },
    line: { w: 2, h: 1 },
    pie: { w: 2, h: 2 },
};

const AnalysisDashboard: React.FC = () => {
    const [visualizations, setVisualizations] = useState<Visualization[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [sharedData, setSharedData] = useState<SharedData>({});

    const getLayoutFromVisualizations = (): Layout[] => {
        return visualizations.map(viz => ({
            i: viz.id,
            x: viz.layout.x,
            y: viz.layout.y,
            w: viz.layout.w,
            h: viz.layout.h,
            isDraggable: true,
        }));
    };

    const findAvailablePosition = (w: number, h: number) => {
        const occupied = getLayoutFromVisualizations();
        let maxY = 0;

        occupied.forEach(item => {
            maxY = Math.max(maxY, item.y + item.h);
        });

        return { x: 0, y: maxY };
    };

    const addVisualization = (type: string, title: string) => {
        const layout = defaultLayout[type as keyof typeof defaultLayout] || { w: 2, h: 1 };
        const position = findAvailablePosition(layout.w, layout.h);
        
        const newVisualization: Visualization = {
            id: `viz-${Date.now()}`,
            type,
            title,
            layout: {
                ...position,
                ...layout
            }
        };
        
        setVisualizations([...visualizations, newVisualization]);
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
        setVisualizations(updatedVisualizations);
    };

    const handleDataUpdate = (data: any) => {
        setSharedData(prev => ({ ...prev, ...data }));
    };

    return (
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 border-b pb-4">
                <h1 className="text-2xl font-bold">Analyse</h1>
                <button
                    onClick={() => setIsDialogOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                >
                    <PlusCircle size={20} />
                    Add
                </button>
            </div>

            {/* Grid Layout */}
            <GridLayout
                className="layout"
                layout={getLayoutFromVisualizations()}
                cols={4}
                rowHeight={150}
                width={1200}
                onLayoutChange={handleLayoutChange}
                draggableHandle=".drag-handle"
            >
                {visualizations.map((viz) => (
                    <div
                        key={viz.id}
                        className="border rounded-md bg-white shadow-sm overflow-hidden"
                    >
                        <div className="flex items-center justify-between p-2 border-b bg-gray-50">
                            <div className="flex items-center gap-2">
                                <div className="drag-handle cursor-move p-1 hover:bg-gray-200 rounded">
                                    <GripHorizontal size={20} className="text-gray-400" />
                                </div>
                                <h3 className="font-medium">{viz.title}</h3>
                            </div>
                            <button
                                onClick={() => setVisualizations(
                                    visualizations.filter((v) => v.id !== viz.id)
                                )}
                                className="text-gray-400 hover:text-red-500 p-1"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 h-[calc(100%-3rem)]">
                            <VisualizationComponent
                                type={viz.type}
                                sharedData={sharedData}
                                onDataUpdate={handleDataUpdate}
                                width={viz.layout.w * 300 - 32}
                                height={viz.layout.h * 150 - 32}
                            />
                        </div>
                    </div>
                ))}
            </GridLayout>

            {/* Add Visualization Dialog */}
            {isDialogOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div
                        className="bg-white rounded-lg p-6 max-w-md w-full transform scale-95 opacity-0 transition-all duration-200"
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
                        <div className="grid grid-cols-2 gap-4">
                            {visualizationTypes.map((type) => {
                                const Icon = type.icon;
                                return (
                                    <button
                                        key={type.id}
                                        onClick={() => addVisualization(type.id, type.title)}
                                        className="p-4 border rounded-md hover:bg-gray-50 flex flex-col items-center gap-2 transition-colors"
                                    >
                                        <Icon size={24} />
                                        <span>{type.title}</span>
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
            `}</style>
        </div>
    );
};

export default AnalysisDashboard;