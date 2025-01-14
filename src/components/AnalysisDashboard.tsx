import React, { useState } from 'react';
import { PlusCircle, X, BarChart, LineChart, PieChart, Table } from 'lucide-react';

interface Visualization {
    id: string;
    type: string;
    title: string;
}

// Types de visualisations disponibles
const visualizationTypes = [
    { id: 'table', title: 'Tableau', icon: Table },
    { id: 'bar', title: 'Graphique en barres', icon: BarChart },
    { id: 'line', title: 'Graphique en ligne', icon: LineChart },
    { id: 'pie', title: 'Graphique circulaire', icon: PieChart },
];

const AnalysisDashboard = () => {
    const [visualizations, setVisualizations] = useState<Visualization[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const addVisualization = (type: string, title: string) => {
        const newVisualization: Visualization = {
            id: `viz-${Date.now()}`,
            type,
            title,
        };
        setVisualizations([...visualizations, newVisualization]);
        setIsDialogOpen(false);
    };

    return (
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
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

            {/* Results Section - Always visible */}
            <div className="mb-6">
                <h2 className="text-lg font-semibold mb-3">Results :</h2>
                <div className="bg-gray-50 p-4 rounded-md min-h-[100px]">
                    {/* Placeholder for default results */}
                    <div className="text-gray-500">Résultats par défaut</div>
                </div>
            </div>

            {/* Visualizations List */}
            <div className="space-y-4">
                {visualizations.map((viz) => (
                    <div
                        key={viz.id}
                        className="border rounded-md p-4 bg-white shadow-sm"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-medium">{viz.title}</h3>
                            <button
                                onClick={() => setVisualizations(
                                    visualizations.filter((v) => v.id !== viz.id)
                                )}
                                className="text-gray-400 hover:text-red-500"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="h-48 bg-gray-50 rounded flex items-center justify-center">
                            {/* Placeholder pour le contenu de la visualisation */}
                            <span className="text-gray-400">Visualisation {viz.type}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Dialog for adding new visualization */}
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