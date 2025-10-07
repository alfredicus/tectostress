import React, { useState, useCallback, useRef, useEffect } from 'react';
import { PlusCircle, X, Dribbble, BarChart, LineChart, PieChart, Table, GripHorizontal, Target } from 'lucide-react';
import { VisualizationComponent } from './VisualizationComponent';
import { SharedData, Visualization, VisualizationState } from './types';
import GridLayout, { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { DataFile } from './DataFile';

const RoseIcon: React.FC<{ size?: number; className?: string }> = ({
    size = 24,
    className = ""
}) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
    >
        {/* Outer circle */}
        <circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.6" />

        {/* Rose diagram sectors */}
        <g fill="currentColor" opacity="0.95">
            {/* Large sector at North (0°) - tallest */}
            <path d="M 12 12 L 11.5 1 A 10.5 10.5 0 0 1 12.5 1 L 12 12 Z" />

            {/* Medium sector at NNE (30°) */}
            <path d="M 12 12 L 18.3 3.5 A 7 7 0 0 1 19 4.5 L 12 12 Z" />

            {/* Small sector at NE (60°) */}
            <path d="M 12 12 L 20.5 8 A 4 4 0 0 1 20.8 9 L 12 12 Z" />

            {/* Medium sector at ENE (90°) */}
            <path d="M 12 12 L 22.5 11.5 A 6 6 0 0 1 22.5 12.5 L 12 12 Z" />

            {/* Small sector at SE (120°) */}
            <path d="M 12 12 L 20.5 16 A 3.5 3.5 0 0 1 20 16.8 L 12 12 Z" />

            {/* Small sector at SSE (150°) */}
            <path d="M 12 12 L 18.3 20.5 A 3 3 0 0 1 17.7 20.8 L 12 12 Z" />

            {/* Very large sector at South (180°) - second tallest */}
            <path d="M 12 12 L 12.5 23 A 10 10 0 0 1 11.5 23 L 12 12 Z" />

            {/* Large sector at SSW (210°) */}
            <path d="M 12 12 L 5.7 20.5 A 8 8 0 0 1 5 19.5 L 12 12 Z" />

            {/* Medium sector at SW (240°) */}
            <path d="M 12 12 L 3.5 16 A 6 6 0 0 1 3.2 15 L 12 12 Z" />

            {/* Large sector at WSW (270°) */}
            <path d="M 12 12 L 1.5 12.5 A 8.5 8.5 0 0 1 1.5 11.5 L 12 12 Z" />

            {/* Medium sector at NW (300°) */}
            <path d="M 12 12 L 3.5 8 A 6.5 6.5 0 0 1 4.2 7 L 12 12 Z" />

            {/* Medium sector at NNW (330°) */}
            <path d="M 12 12 L 5.7 3.5 A 7.5 7.5 0 0 1 6.5 3 L 12 12 Z" />
        </g>

        {/* Center point */}
        <circle cx="12" cy="12" r="0.5" fill="currentColor" />
    </svg>
);

const MohrIcon: React.FC<{ size?: number; className?: string }> = ({
    size = 24,
    className = ""
}) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={className}
    >
        {/* Outer circle */}
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none" />

        {/* Inner circles representing Mohr circles */}
        <circle cx="8" cy="12" r="3" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.7" />
        <circle cx="14" cy="12" r="2" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.7" />
        <circle cx="11" cy="12" r="1.5" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.7" />

        {/* Principal stress points */}
        <circle cx="6" cy="12" r="1.5" fill="currentColor" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        <circle cx="16" cy="12" r="1.5" fill="currentColor" />

        {/* Stress point */}
        <circle cx="10" cy="8" r="1" fill="purple" />

        {/* Axes */}
        <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="0.5" />
        <line x1="12" y1="2" x2="12" y2="22" stroke="currentColor" strokeWidth="0.5" />
    </svg>
);

const HistogramIcon: React.FC<{ size?: number; className?: string }> = ({
    size = 40,
    className = ""
}) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
    >
        {/* Chart area background */}
        <rect x="3" y="3" width="18" height="16" fill="none" stroke="currentColor" strokeWidth="0.3" opacity="0.2" />

        {/* Grid lines */}
        {/* <g stroke="currentColor" strokeWidth="0.2" opacity="0.15">
            <line x1="3" y1="15" x2="21" y2="15" />
            <line x1="3" y1="11" x2="21" y2="11" />
            <line x1="3" y1="7" x2="21" y2="7" />
        </g> */}

        {/* Histogram bars */}
        <g fill="currentColor" opacity="0.8">
            <rect x="4" y="16" width="2.5" height="3" />
            <rect x="6.5" y="15" width="2.5" height="4" />
            <rect x="9" y="11" width="2.5" height="8" />
            <rect x="11.5" y="9" width="2.5" height="10" />
            <rect x="14" y="13" width="2.5" height="6" />
            <rect x="16.5" y="17" width="2.5" height="2" />
        </g>

        {/* Axes */}
        {/* <g stroke="currentColor" strokeWidth="0.8" opacity="0.7">
            <line x1="3" y1="3" x2="3" y2="19" />
            <line x1="3" y1="19" x2="21" y2="19" />
        </g> */}
    </svg>
);

const visualizationTypes = [
    // { id: 'table', title: 'Tableau', icon: Table },
    { id: 'rose', title: 'Rose diagram', icon: RoseIcon },
    { id: 'wulff', title: 'Wulff Stereonet', icon: Target },
    { id: 'histogram', title: 'Histo', icon: HistogramIcon },
    { id: 'mohr', title: 'Mohr Circle', icon: MohrIcon },
    { id: 'fractureMap2D', title: 'Fracture Map', icon: FractureMapIcon },
    // { id: 'sphere', title: 'Sphere', icon: Dribbble },
    // { id: 'line', title: 'Graphique en ligne', icon: LineChart },
    // { id: 'three', title: 'Test 3D', icon: PieChart },
    // { id: 'two', title: 'Test 2D', icon: PieChart },
];

// Simple default layout
const getDefaultLayoutForType = (type: string) => {
    const layouts = {
        // table: { w: 12, h: 3 },
        rose: { w: 4, h: 4 },
        wulff: { w: 6, h: 4 },
        histogram: { w: 6, h: 4 },
        mohr: { w: 6, h: 4 },
        // sphere: { w: 6, h: 4 },
        // line: { w: 8, h: 3 },
        // three: { w: 6, h: 4 },
        // two: { w: 6, h: 3 },
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
                                        <Icon size={42} className="text-gray-600" />
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