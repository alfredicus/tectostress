import React, { useState } from 'react';
import { Play, HelpCircle } from 'lucide-react';
import Help from './Help'
import AnalysisDashboard from './AnalysisDashboard';
import Run from './Run';
import Construction from './Construction';
import DataComponent from './DataComponent';

const MainInterface = () => {
    const [dataItems, setDataItems] = useState<string[]>(['d1', 'd2']);
    const [selectedData, setSelectedData] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState('data'); 

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
                    {['data', 'run', 'analyze', 'help'].map((tab) => (
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

                {activeTab === 'data' && (
                    <DataComponent />
                )}

                {activeTab === 'run' && (
                    <Run selectedData={selectedData} />
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