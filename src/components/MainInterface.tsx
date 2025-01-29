import React, { useState } from 'react';
import { Play, HelpCircle } from 'lucide-react';
import HelpComponent from './HelpComponent';
import AnalysisDashboard from './AnalysisDashboard';
import RunComponent from './RunComponent';
import DataComponent from './DataComponent';
import DataFile from './DataFile';

const MainInterface = () => {
    const [activeTab, setActiveTab] = useState('data');
    // Store loaded files in state at the top level
    const [loadedFiles, setLoadedFiles] = useState<DataFile[]>([]);
    
    // Callback to handle new files being loaded
    const handleFileLoaded = (file: DataFile) => {
        setLoadedFiles(prevFiles => {
            // Check if file with same name exists
            const existingFileIndex = prevFiles.findIndex(f => f.name === file.name);
            if (existingFileIndex >= 0) {
                // Update existing file
                const newFiles = [...prevFiles];
                newFiles[existingFileIndex] = file;
                return newFiles;
            }
            // Add new file
            return [...prevFiles, file];
        });
    };

    // Callback to handle file removal
    const handleFileRemoved = (fileId: string) => {
        setLoadedFiles(prevFiles => prevFiles.filter(f => f.id !== fileId));
    };

    return (
        <div className="container mx-auto px-4 min-h-screen">
            <div className="max-w-[98%] w-full mx-auto">
                {/* Tabs */}
                <div className="border-b border-gray-200">
                    <nav className="flex -mb-px">
                        {['data', 'run', 'analyze', 'help'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`py-2 px-4 font-medium ${
                                    activeTab === tab
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
                <div className="bg-white rounded-lg shadow mt-4 w-full">
                    {activeTab === 'data' && (
                        <DataComponent 
                            files={loadedFiles}
                            onFileLoaded={handleFileLoaded}
                            onFileRemoved={handleFileRemoved}
                        />
                    )}

                    {activeTab === 'run' && (
                        <RunComponent 
                            files={loadedFiles}
                        />
                    )}

                    {activeTab === 'analyze' && (
                        <AnalysisDashboard 
                            files={loadedFiles}
                        />
                    )}

                    {activeTab === 'help' && (
                        <HelpComponent />
                    )}
                </div>
            </div>
        </div>
    );
};

export default MainInterface;