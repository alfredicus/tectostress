import React, { useState, useEffect, useCallback } from 'react';
import { Play, Settings } from 'lucide-react';
import { DataFile } from './DataFile';

// Define types for our configuration
interface ParamConfig {
    name: string;
    display: string;
    value: number;
    min: number;
    max: number;
}

interface SearchMethod {
    name: string;
    params: ParamConfig[];
}

interface ConfigData {
    search: {
        display: string;
        type: string;
        list: SearchMethod[];
    };
}

interface RunState {
    selectedMethod: string;
    params: Record<string, number>;
    selectedFiles: string[];
    simulationStatus: { status: string; progress: number };
}

interface RunProps {
    files: DataFile[];
}

const RunComponent: React.FC<RunProps> = ({ files }) => {
    const [config, setConfig] = useState<ConfigData | null>(null);
    const [runState, setRunState] = useState<RunState>({
        selectedMethod: '',
        params: {},
        selectedFiles: [],
        simulationStatus: { status: 'En attente', progress: 0 }
    });
    const [loading, setLoading] = useState(true);
    const [showSettings, setShowSettings] = useState(false);

    // Store all parameter values in a single object to maintain them between method changes
    const [allParams, setAllParams] = useState<Record<string, Record<string, number>>>({});

    // Initialize configuration and parameters
    useEffect(() => {
        const loadConfig = async () => {
            try {
                setLoading(true);
                // Use hardcoded config based on the correct structure
                const configData: ConfigData = {
                    search: {
                        display: "Search method",
                        type: "combobox",
                        list: [
                            {
                                name: "Monte Carlo",
                                params: [
                                    {
                                        name: "rotAngleHalfInterval",
                                        display: "Rotation angle interval",
                                        value: 60,
                                        min: 0,
                                        max: 90
                                    },
                                    {
                                        name: "nbRandomTrials",
                                        display: "Nb simulations",
                                        value: 20000,
                                        min: 10,
                                        max: 1e6
                                    },
                                    {
                                        name: "stressRatio",
                                        display: "Stress ratio",
                                        value: 0.5,
                                        min: 0,
                                        max: 1
                                    },
                                    {
                                        name: "stressRatioHalfInterval",
                                        display: "Stress ratio interval",
                                        value: 0.5,
                                        min: 0,
                                        max: 1
                                    }
                                ]
                            },
                            {
                                name: "Grid Search",
                                params: [
                                    {
                                        name: "deltaGridAngle",
                                        display: "Grid angle delta",
                                        value: 2,
                                        min: 0.01,
                                        max: 90
                                    },
                                    {
                                        name: "stressRatio",
                                        display: "Stress ratio",
                                        value: 0.5,
                                        min: 0,
                                        max: 1
                                    },
                                    {
                                        name: "stressRatioHalfInterval",
                                        display: "Stress ratio interval",
                                        value: 0.5,
                                        min: 0,
                                        max: 1
                                    }
                                ]
                            },
                            {
                                name: "Debug Search",
                                params: []
                            }
                        ]
                    }
                };

                setConfig(configData);

                // Initialize parameter state for all methods
                const initialAllParams: Record<string, Record<string, number>> = {};

                configData.search.list.forEach(method => {
                    initialAllParams[method.name] = {};
                    method.params.forEach(param => {
                        initialAllParams[method.name][param.name] = param.value;
                    });
                });

                setAllParams(initialAllParams);

                // Initialize with first method if available
                if (configData.search.list.length > 0) {
                    const firstMethod = configData.search.list[0];
                    const firstMethodParams = initialAllParams[firstMethod.name] || {};

                    setRunState(prevState => ({
                        ...prevState,
                        selectedMethod: firstMethod.name,
                        params: firstMethodParams
                    }));
                }

                setLoading(false);
            } catch (error) {
                console.error('Error loading configuration:', error);
                setLoading(false);
            }
        };

        loadConfig();
    }, []);

    // Update parameters when method changes, preserving parameter values
    const handleMethodChange = useCallback((methodName: string) => {
        if (!config) return;

        // Get the saved parameters for this method
        const methodParams = allParams[methodName] || {};

        setRunState(prevState => ({
            ...prevState,
            selectedMethod: methodName,
            params: { ...methodParams }
        }));
    }, [config, allParams]);

    // Handle parameter changes
    const handleParamChange = useCallback((paramName: string, value: number) => {
        // Update the current params in runState
        setRunState(prevState => ({
            ...prevState,
            params: {
                ...prevState.params,
                [paramName]: value
            }
        }));

        // Also update the saved params for this method
        setAllParams(prevAllParams => ({
            ...prevAllParams,
            [runState.selectedMethod]: {
                ...prevAllParams[runState.selectedMethod],
                [paramName]: value
            }
        }));
    }, [runState.selectedMethod]);

    // Toggle file selection
    const toggleFileSelection = useCallback((fileId: string) => {
        setRunState(prevState => {
            const isSelected = prevState.selectedFiles.includes(fileId);
            const newSelectedFiles = isSelected
                ? prevState.selectedFiles.filter(id => id !== fileId)
                : [...prevState.selectedFiles, fileId];

            return {
                ...prevState,
                selectedFiles: newSelectedFiles
            };
        });
    }, []);

    // Start running simulation
    const startSimulation = useCallback(() => {
        if (runState.selectedFiles.length === 0) {
            // No files selected
            return;
        }

        setRunState(prevState => ({
            ...prevState,
            simulationStatus: { status: 'En cours', progress: 0 }
        }));

        // Simulate progress (in a real app, this would be your actual processing)
        let progress = 0;
        const interval = setInterval(() => {
            progress += 5;

            if (progress <= 100) {
                setRunState(prevState => ({
                    ...prevState,
                    simulationStatus: {
                        status: progress < 100 ? 'En cours' : 'Terminé',
                        progress
                    }
                }));
            } else {
                clearInterval(interval);
            }
        }, 300);
    }, [runState.selectedFiles.length]);

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl mx-auto">
                <h2 className="text-2xl mb-4">Run</h2>
                <div className="flex justify-center items-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <span className="ml-2">Chargement de la configuration...</span>
                </div>
            </div>
        );
    }

    if (!config) {
        return (
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl mx-auto">
                <h2 className="text-2xl mb-4">Run</h2>
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    Erreur: Impossible de charger la configuration.
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl">Run</h2>
                <div className="flex items-center">
                    <div className="mr-4">
                        <label htmlFor="search-method" className="block text-sm font-medium text-gray-700 mb-1">
                            {config.search.display}
                        </label>
                        <select
                            id="search-method"
                            value={runState.selectedMethod}
                            onChange={(e) => handleMethodChange(e.target.value)}
                            className="block w-64 px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                            {config.search.list.map((method) => (
                                <option key={method.name} value={method.name}>
                                    {method.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="p-2 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                        title="Paramètres"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Parameter settings panel */}
            {showSettings && (
                <div className="mb-6 p-4 border rounded-md bg-gray-50">
                    <h3 className="text-lg font-medium mb-3">Paramètres de {runState.selectedMethod}</h3>
                    <div className="grid grid-cols-2 gap-4">
                        {config?.search.list
                            .find(method => method.name === runState.selectedMethod)?.params
                            .map(param => (
                                <div key={param.name}>
                                    <label htmlFor={param.name} className="block text-sm font-medium text-gray-700 mb-1">
                                        {param.display}
                                    </label>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center">
                                            <input
                                                type="range"
                                                id={`slider-${param.name}`}
                                                min={param.min}
                                                max={param.max}
                                                step={param.name.includes('RandomTrials') ? 100 : param.max < 10 ? 0.01 : 1}
                                                value={runState.params[param.name] ?? param.value}
                                                onChange={(e) => handleParamChange(param.name, parseFloat(e.target.value))}
                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                            />
                                        </div>
                                        <div className="flex items-center">
                                            <input
                                                type="number"
                                                id={param.name}
                                                min={param.min}
                                                max={param.max}
                                                step={param.name.includes('RandomTrials') ? 100 : param.max < 10 ? 0.01 : 1}
                                                value={runState.params[param.name] ?? param.value}
                                                onChange={(e) => {
                                                    const value = e.target.value === '' ? param.value : parseFloat(e.target.value);
                                                    handleParamChange(param.name, Math.min(Math.max(value, param.min), param.max));
                                                }}
                                                className="px-2 py-1 w-24 text-right border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {/* File selection and run section */}
            <div className="mb-4">
                <h3 className="text-lg font-medium mb-2">Sélection des données</h3>
                <div className="space-y-2">
                    {files.length === 0 ? (
                        <div className="text-gray-500 italic">Aucun fichier disponible</div>
                    ) : (
                        files.map((file) => (
                            <div key={file.id} className="flex items-center">
                                <input
                                    type="checkbox"
                                    id={`file-${file.id}`}
                                    checked={runState.selectedFiles.includes(file.id)}
                                    onChange={() => toggleFileSelection(file.id)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor={`file-${file.id}`} className="ml-2 block text-sm text-gray-900">
                                    {file.name}
                                </label>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Run table */}
            <div className="w-full overflow-x-auto mt-6">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Simulation
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Progression
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {runState.selectedFiles.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-4 text-sm text-gray-500 text-center italic">
                                    Sélectionnez des fichiers pour lancer l'analyse
                                </td>
                            </tr>
                        ) : (
                            <tr>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {runState.selectedMethod} ({runState.selectedFiles.length} fichier{runState.selectedFiles.length > 1 ? 's' : ''} sélectionné{runState.selectedFiles.length > 1 ? 's' : ''})
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {runState.simulationStatus.status}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                                        <div
                                            className="bg-blue-600 h-2.5 rounded-full"
                                            style={{ width: `${runState.simulationStatus.progress}%` }}
                                        ></div>
                                    </div>
                                    <span className="text-xs text-gray-500 mt-1">{runState.simulationStatus.progress}%</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <button
                                        onClick={startSimulation}
                                        disabled={runState.simulationStatus.status === 'En cours'}
                                        className={`p-2 rounded-full ${runState.simulationStatus.status === 'En cours'
                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                                            }`}
                                    >
                                        <Play className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default RunComponent;