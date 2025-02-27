import React, { useState } from 'react';
import { Play, HelpCircle } from 'lucide-react';
import HelpComponent from './HelpComponent';
import AnalysisDashboard from './AnalysisDashboard';
import RunComponent from './RunComponent';
import DataComponent from './DataComponent';
import { DataFile } from './DataFile';
import { Visualization, VisualizationState } from './types';

// Define types for run state persistence
interface SearchMethodParams {
    [methodName: string]: {
        [paramName: string]: number;
    };
}

interface RunPersistentState {
    selectedMethod: string;
    allParams: SearchMethodParams;
    selectedFiles: string[];
    showSettings?: boolean; // Added for parameters panel persistence
}

const MainInterface = () => {
    const [activeTab, setActiveTab] = useState('data');
    const [loadedFiles, setLoadedFiles] = useState<DataFile[]>([]);
    const [visualizations, setVisualizations] = useState<Visualization[]>([]);

    // Add state for persisting run component state with showSettings property
    const [runState, setRunState] = useState<RunPersistentState>({
        selectedMethod: '',
        allParams: {},
        selectedFiles: [],
        showSettings: true // Default to showing settings panel
    });

    const handleFileLoaded = (file: DataFile) => {
        setLoadedFiles(prevFiles => {
            const existingFileIndex = prevFiles.findIndex(f => f.name === file.name);
            if (existingFileIndex >= 0) {
                const newFiles = [...prevFiles];
                newFiles[existingFileIndex] = file;
                return newFiles;
            }
            return [...prevFiles, file];
        });
    };

    const handleFileRemoved = (fileId: string) => {
        setLoadedFiles(prevFiles => prevFiles.filter(f => f.id !== fileId));
    };

    // Add handlers for visualizations
    const handleVisualizationAdded = (visualization: Visualization) => {
        setVisualizations(prev => [...prev, visualization]);
    };

    const handleVisualizationRemoved = (id: string) => {
        setVisualizations(prev => prev.filter(v => v.id !== id));
    };

    const handleVisualizationsLayoutChanged = (updatedVisualizations: Visualization[]) => {
        setVisualizations(updatedVisualizations);
    };

    const handleVisualizationStateChanged = (id: string, newState: VisualizationState) => {
        setVisualizations(prev => prev.map(viz =>
            viz.id === id ? { ...viz, state: newState } : viz
        ));
    };

    // Handle Run component state persistence
    const handleRunStateChange = (newState: RunPersistentState) => {
        setRunState(newState);
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
                            persistentState={runState}
                            onStateChange={handleRunStateChange}
                        />
                    )}

                    {activeTab === 'analyze' && (
                        <AnalysisDashboard
                            files={loadedFiles}
                            visualizations={visualizations}
                            onVisualizationAdded={handleVisualizationAdded}
                            onVisualizationRemoved={handleVisualizationRemoved}
                            onLayoutChanged={handleVisualizationsLayoutChanged}
                            onVisualizationStateChanged={handleVisualizationStateChanged}
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