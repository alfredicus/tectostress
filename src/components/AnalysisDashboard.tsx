import React, { useState } from 'react';
import { PlusCircle, X, Dribbble, BarChart, LineChart, PieChart, Table, GripHorizontal } from 'lucide-react';
import { VisualizationComponent } from './VisualizationComponent';
import { SharedData, Visualization, VisualizationState } from './types';
import GridLayout, { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { DataFile } from './DataFile';

const visualizationTypes = [
    { id: 'table', title: 'Tableau', icon: Table },
    { id: 'rose', title: 'Rose diagram', icon: PieChart },
    { id: 'sphere', title: 'Sphere', icon: Dribbble },
    { id: 'line', title: 'Graphique en ligne', icon: LineChart },
    { id: 'three', title: 'Test 3D', icon: PieChart },
    { id: 'two', title: 'Test 2D', icon: PieChart },
];

const defaultLayout = {
    table: { w: 4, h: 2 },
    rose: { w: 2, h: 2 },
    line: { w: 2, h: 1 },
    sphere: { w: 2, h: 2 },
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

    return (
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl mx-auto">
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
                                <GripHorizontal
                                    size={16}
                                    className="text-gray-400 cursor-move drag-handle hover:text-gray-600"
                                />
                                <span className="font-medium">{viz.title}</span>
                            </div>
                            <button
                                onClick={() => onVisualizationRemoved(viz.id)}
                                className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                                <X size={16} />
                            </button>

                        </div>
                        <div className="p-4 h-[calc(100%-3rem)]">
                            <VisualizationComponent
                                type={viz.type}
                                files={files}
                                width={viz.layout.w * 300 - 32}
                                height={viz.layout.h * 150 - 32}
                                state={viz.state}
                                onStateChange={(newState) => onVisualizationStateChanged(viz.id, newState)}
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

// import React, { useState } from 'react';
// import { PlusCircle, X, Dribbble, BarChart, LineChart, PieChart, Table, GripHorizontal } from 'lucide-react';
// import { VisualizationComponent } from './VisualizationComponent';
// import { Visualization, SharedData } from './types';
// import GridLayout, { Layout } from 'react-grid-layout';
// import 'react-grid-layout/css/styles.css';
// import 'react-resizable/css/styles.css';
// import DataFile from './DataFile';

// const visualizationTypes = [
//     { id: 'table', title: 'Tableau', icon: Table },
//     { id: 'rose', title: 'Rose diagram', icon: PieChart },
//     { id: 'sphere', title: 'Sphere', icon: Dribbble },
//     { id: 'line', title: 'Graphique en ligne', icon: LineChart },
//     { id: 'three', title: 'Test 3D', icon: PieChart },
//     { id: 'two', title: 'Test 2D', icon: PieChart },
// ];

// const defaultLayout = {
//     table: { w: 4, h: 2 },
//     rose: { w: 2, h: 2 },
//     line: { w: 2, h: 1 },
//     sphere: { w: 2, h: 2 },
// };

// interface AnalysisDashboardProps {
//     files: DataFile[];
// }

// interface Visualization {
//     id: string;
//     type: string;
//     title: string;
//     layout: {
//         x: number;
//         y: number;
//         w: number;
//         h: number;
//     };
// }

// const AnalysisDashboard: React.FC<{ files: DataFile[] }> = ({ files }) => {
//     const [visualizations, setVisualizations] = useState<Visualization[]>([]);
//     const [isDialogOpen, setIsDialogOpen] = useState(false);
//     const [sharedData, setSharedData] = useState<SharedData>({});

//     const getLayoutFromVisualizations = (): Layout[] => {
//         return visualizations.map(viz => ({
//             i: viz.id,
//             x: viz.layout.x,
//             y: viz.layout.y,
//             w: viz.layout.w,
//             h: viz.layout.h,
//             isDraggable: true,
//         }));
//     };

//     const findAvailablePosition = (w: number, h: number) => {
//         const occupied = getLayoutFromVisualizations();
//         let maxY = 0;

//         occupied.forEach(item => {
//             maxY = Math.max(maxY, item.y + item.h);
//         });

//         return { x: 0, y: maxY };
//     };

//     const addVisualization = (type: string, title: string) => {
//         const layout = defaultLayout[type as keyof typeof defaultLayout] || { w: 2, h: 1 };
//         const position = findAvailablePosition(layout.w, layout.h);

//         const newVisualization: Visualization = {
//             id: `viz-${Date.now()}`,
//             type,
//             title,
//             layout: {
//                 ...position,
//                 ...layout
//             }
//         };

//         setVisualizations([...visualizations, newVisualization]);
//         setIsDialogOpen(false);
//     };

//     const removeVisualization = (id: string) => {
//         setVisualizations(visualizations.filter(viz => viz.id !== id));
//     };

//     const handleLayoutChange = (layout: Layout[]) => {
//         const updatedVisualizations = visualizations.map(viz => {
//             const newLayout = layout.find(l => l.i === viz.id);
//             if (newLayout) {
//                 return {
//                     ...viz,
//                     layout: {
//                         x: newLayout.x,
//                         y: newLayout.y,
//                         w: newLayout.w,
//                         h: newLayout.h
//                     }
//                 };
//             }
//             return viz;
//         });
//         setVisualizations(updatedVisualizations);
//     };

//     const handleDataUpdate = (data: any) => {
//         setSharedData(prev => ({ ...prev, ...data }));
//     };

//     return (
//         <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl mx-auto">
//             {/* Header */}
//             <div className="flex items-center justify-between mb-6 border-b pb-4">
//                 <h1 className="text-2xl">Analyse</h1>
//                 <button
//                     onClick={() => setIsDialogOpen(true)}
//                     className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
//                 >
//                     <PlusCircle size={20} />
//                     Add
//                 </button>
//             </div>

//             {/* Grid Layout */}
//             <GridLayout
//                 className="layout"
//                 layout={getLayoutFromVisualizations()}
//                 cols={4}
//                 rowHeight={150}
//                 width={1200}
//                 onLayoutChange={handleLayoutChange}
//                 draggableHandle=".drag-handle"
//             >
//                 {visualizations.map((viz) => (
//                     <div
//                         key={viz.id}
//                         className="border rounded-md bg-white shadow-sm overflow-hidden"
//                     >
//                         <div className="flex items-center justify-between p-2 border-b bg-gray-50">
//                             <div className="flex items-center gap-2">
//                                 <GripHorizontal
//                                     size={16}
//                                     className="text-gray-400 cursor-move drag-handle hover:text-gray-600"
//                                 />
//                                 <span className="font-medium">{viz.title}</span>
//                             </div>
//                             <button
//                                 onClick={() => removeVisualization(viz.id)}
//                                 className="text-gray-400 hover:text-red-500 transition-colors"
//                             >
//                                 <X size={16} />
//                             </button>
//                         </div>
//                         <div className="p-4 h-[calc(100%-3rem)]">
//                             <VisualizationComponent
//                                 type={viz.type}
//                                 files={files}
//                                 width={viz.layout.w * 300 - 32}
//                                 height={viz.layout.h * 150 - 32}
//                             />
//                         </div>
//                     </div>
//                 ))}
//             </GridLayout>

//             {/* Add Visualization Dialog */}
//             {isDialogOpen && (
//                 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//                     <div
//                         className="bg-white rounded-lg p-6 max-w-md w-full transform scale-95 opacity-0 transition-all duration-200"
//                         style={{
//                             animation: 'dialogZoomIn 0.2s ease-out forwards',
//                         }}
//                     >
//                         <div className="flex justify-between items-center mb-4">
//                             <h2 className="text-xl font-bold">Ajouter une visualisation</h2>
//                             <button
//                                 onClick={() => setIsDialogOpen(false)}
//                                 className="text-gray-400 hover:text-gray-600"
//                             >
//                                 <X size={20} />
//                             </button>
//                         </div>
//                         <div className="grid grid-cols-2 gap-4">
//                             {visualizationTypes.map((type) => {
//                                 const Icon = type.icon;
//                                 return (
//                                     <button
//                                         key={type.id}
//                                         onClick={() => addVisualization(type.id, type.title)}
//                                         className="p-4 border rounded-md hover:bg-gray-50 flex flex-col items-center gap-2 transition-colors"
//                                     >
//                                         <Icon size={24} />
//                                         <span>{type.title}</span>
//                                     </button>
//                                 );
//                             })}
//                         </div>
//                     </div>
//                 </div>
//             )}

//             <style>{`
//                 @keyframes dialogZoomIn {
//                     from {
//                         transform: scale(0.95);
//                         opacity: 0;
//                     }
//                     to {
//                         transform: scale(1);
//                         opacity: 1;
//                     }
//                 }
//             `}</style>
//         </div>
//     );
// };

// export default AnalysisDashboard;
