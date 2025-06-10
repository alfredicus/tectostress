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
                {/* Title */}
                <div className="text-center py-6">
                    <div className="flex gap-4 mb-2"> {/* items-center justify-center */}
                        {/* Logo */}
                        <svg width="48" height="48" viewBox="0 0 48 48" className="text-blue-600">
                            <defs>
                                <linearGradient id="stressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#3B82F6" />
                                    <stop offset="100%" stopColor="#1D4ED8" />
                                </linearGradient>
                            </defs>
                            {/* Stress field representation - overlapping circles with tension lines */}
                            <circle cx="24" cy="24" r="18" fill="none" stroke="url(#stressGradient)" strokeWidth="2" opacity="0.3" />
                            <circle cx="24" cy="24" r="12" fill="none" stroke="url(#stressGradient)" strokeWidth="2" opacity="0.5" />
                            <circle cx="24" cy="24" r="6" fill="url(#stressGradient)" opacity="0.8" />

                            {/* Stress direction arrows */}
                            <g stroke="url(#stressGradient)" strokeWidth="2.5" strokeLinecap="round">
                                {/* Horizontal stress arrows */}
                                <line x1="6" y1="24" x2="14" y2="24" markerEnd="url(#arrowhead)" />
                                <line x1="42" y1="24" x2="34" y2="24" markerEnd="url(#arrowhead)" />

                                {/* Vertical stress arrows */}
                                <line x1="24" y1="6" x2="24" y2="14" markerEnd="url(#arrowhead)" />
                                <line x1="24" y1="42" x2="24" y2="34" markerEnd="url(#arrowhead)" />
                            </g>

                            {/* Arrow marker definition */}
                            <defs>
                                <marker id="arrowhead" markerWidth="10" markerHeight="7"
                                    refX="9" refY="3.5" orient="auto">
                                    <polygon points="0 0, 10 3.5, 0 7" fill="url(#stressGradient)" />
                                </marker>
                            </defs>
                        </svg>

                        <h1 className="text-4xl font-bold text-gray-800">
                            <a href="https://github.com/alfredicus/tectostress" target="_blank" rel="noopener noreferrer" className="hover:text-blue-800 hover:underline">Tectostress</a>
                            <span className="text-2xl font-normal text-gray-600"> v1.0 (<a href="https://www.gm.umontpellier.fr/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline">Geosciences Montpellier</a>)</span>
                        </h1>
                    </div>
                </div>
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