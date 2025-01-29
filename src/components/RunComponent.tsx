import React from 'react';
import { Play } from 'lucide-react';

interface RunProps {
    selectedData: string[];
}

const RunComponent = ({ selectedData }: RunProps) => {
    return (
        // <div className="p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl mx-auto">
            <h2 className="text-2xl">Run</h2>
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
                        {selectedData?.map((item, index) => (
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
    );
};

export default RunComponent;