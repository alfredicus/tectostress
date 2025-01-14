import React, { useState } from 'react';
import { Play, HelpCircle } from 'lucide-react';
import Help from './Help'
import AnalysisDashboard from './AnalysisDashboard';

const MainInterface = () => {
    const [dataItems, setDataItems] = useState<string[]>(['d1', 'd2']);
    const [selectedData, setSelectedData] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState('construction');

    const handleAddData = () => {
        const newItem = `d${dataItems.length + 1}`;
        setDataItems([...dataItems, newItem]);
    };

    const handleDataSelection = (item: string) => {
        if (selectedData.includes(item)) {
            setSelectedData(selectedData.filter(i => i !== item));
        } else {
            setSelectedData([...selectedData, item]);
        }
    };

    return (
        <div className="w-full max-w-4xl p-4 space-y-4">
            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="flex -mb-px">
                    {['construction', 'run', 'analyze', 'help'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`py-2 px-4 font-medium ${activeTab === tab
                                ? 'border-b-2 border-blue-500 text-blue-600'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                {tab === 'run' && <Play className="w-4 h-4" />}
                                {tab === 'help' && <HelpCircle className="w-4 h-4" />}
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </div>
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content */}
            <div className="bg-white rounded-lg shadow">
                {activeTab === 'construction' && (
                    <div className="p-4">
                        <h2 className="text-xl font-semibold mb-4">Construction des données</h2>
                        <div className="space-y-4">
                            <div className="flex flex-col space-y-2">
                                {dataItems.map((item, index) => (
                                    <div key={index} className="flex items-center space-x-2">
                                        <input
                                            type="text"
                                            value={item}
                                            readOnly
                                            className="w-32 px-3 py-2 border rounded"
                                        />
                                        <button
                                            onClick={() => handleDataSelection(item)}
                                            className={`px-4 py-2 rounded border ${selectedData.includes(item)
                                                ? 'bg-blue-100 border-blue-300'
                                                : 'border-gray-300 hover:bg-gray-50'
                                                }`}
                                        >
                                            Sélectionner
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex space-x-2">
                                <button
                                    onClick={handleAddData}
                                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                                >
                                    Ajouter une donnée
                                </button>
                                <button className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
                                    Charger
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'run' && (
                    <div className="p-4">
                        <h2 className="text-xl font-semibold mb-4">Exécution</h2>
                        <div className="w-full overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b">
                                        <th className="px-4 py-2 text-left">Données</th>
                                        <th className="px-4 py-2 text-left">Status</th>
                                        <th className="px-4 py-2 text-left">Progression</th>
                                        <th className="px-4 py-2 text-left">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedData.map((item, index) => (
                                        <tr key={index} className="border-b">
                                            <td className="px-4 py-2">{item}</td>
                                            <td className="px-4 py-2">En attente</td>
                                            <td className="px-4 py-2">0%</td>
                                            <td className="px-4 py-2">
                                                <button className="p-1 hover:bg-gray-100 rounded">
                                                    <Play className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'analyze' && (
                    <AnalysisDashboard />
                )}

                {activeTab === 'help' && (
                    <Help />
                )}
            </div>
        </div>
    );
};

export default MainInterface;