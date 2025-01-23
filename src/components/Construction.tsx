import React from 'react';

interface ConstructionProps {
    dataItems: string[];
    selectedData: string[];
    onAddData: () => void;
    onDataSelection: (item: string) => void;
}

const Construction = ({ dataItems, selectedData, onAddData, onDataSelection }: ConstructionProps) => {
    return (
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
                                onClick={() => onDataSelection(item)}
                                className={`px-4 py-2 rounded border ${
                                    selectedData.includes(item)
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
                        onClick={onAddData}
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
    );
};

export default Construction;