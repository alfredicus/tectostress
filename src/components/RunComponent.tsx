import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Play, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { DataFile } from './DataFile';
import { SearchMethodFactory, SearchMethod, InverseMethod, DataFactory } from '@alfredo-taboada/stress';
import { decomposeStressTensor, eulerAnglesToDegrees, calculateStressRatio } from '../math/tensor_analysis';
import ErrorModal from './ErrorModal';
import LoadingOverlay from './LoadingOverlay';

// Configuration interfaces
interface ParamConfig {
    name: string;
    display: string;
    value: number;
    min: number;
    max: number;
}

interface SearchMethodConfig {
    name: string;
    active: boolean;
    params: ParamConfig[];
}

interface ConfigData {
    search: {
        display: string;
        type: string;
        list: SearchMethodConfig[];
    };
}

// Result interfaces
interface StressSolution {
    stressRatio: number;
    misfit: number;
    stressTensorSolution: number[][];
    analysis?: {
        eigenvalues: number[];
        eigenvectors: number[][];
        eulerAngles: { phi: number; theta: number; psi: number };
        eulerAnglesDegrees: { phi: number; theta: number; psi: number };
        principalStresses: {
            sigma1: { value: number; direction: number[] };
            sigma2: { value: number; direction: number[] };
            sigma3: { value: number; direction: number[] };
        };
        calculatedStressRatio: number;
    };
}

interface SimulationStatus {
    status: string;
    progress: number;
}

// Props interface
interface RunComponentProps {
    files: DataFile[];
    persistentState?: {
        selectedMethod: string;
        allParams: Record<string, Record<string, number>>;
        selectedFiles: string[];
        showSettings?: boolean;
    };
    onStateChange?: (state: {
        selectedMethod: string;
        allParams: Record<string, Record<string, number>>;
        selectedFiles: string[];
        showSettings?: boolean;
    }) => void;
}

// Configuration data
const CONFIG_DATA: ConfigData = {
    search: {
        display: "Search method",
        type: "combobox",
        list: [
            {
                name: "Monte Carlo",
                active: true,
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
                active: false,
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
                active: false,
                params: [
                    {
                        name: "n",
                        display: "Number on each axis",
                        value: 5,
                        min: 2,
                        max: 10000
                    }
                ]
            }
        ]
    }
};

// Observer class for simulation progress
class SimulationObserver {
    private updateCallback: (message: string) => void;

    constructor(updateCallback: (message: string) => void) {
        this.updateCallback = updateCallback;
    }

    update(message: string) {
        const progress = parseInt(message);
        this.updateCallback(message);
    }
}

const RunComponent: React.FC<RunComponentProps> = ({
    files,
    persistentState,
    onStateChange
}) => {
    // State management
    const [selectedMethod, setSelectedMethod] = useState<string>('');
    const [allParams, setAllParams] = useState<Record<string, Record<string, number>>>({});
    const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
    const [showSettings, setShowSettings] = useState<boolean>(true);
    const [simulationStatus, setSimulationStatus] = useState<SimulationStatus>({ 
        status: 'En attente', 
        progress: 0 
    });
    const [solution, setSolution] = useState<StressSolution | null>(null);
    const [showResultsPanel, setShowResultsPanel] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isComputing, setIsComputing] = useState<boolean>(false);
    const [computingMessage, setComputingMessage] = useState<string>('');
    const [computingProgress, setComputingProgress] = useState<number>(0);

    // Initialize configuration and state
    const initializeParams = useCallback(() => {
        const initialParams: Record<string, Record<string, number>> = {};
        
        CONFIG_DATA.search.list.forEach(method => {
            initialParams[method.name] = {};
            method.params.forEach(param => {
                initialParams[method.name][param.name] = param.value;
            });
        });

        return initialParams;
    }, []);

    const getFirstActiveMethod = useCallback(() => {
        const firstActive = CONFIG_DATA.search.list.find(m => m.active);
        return firstActive ? firstActive.name : CONFIG_DATA.search.list[0].name;
    }, []);

    // Initialize state from props or defaults
    useEffect(() => {
        const initialParams = persistentState?.allParams || initializeParams();
        setAllParams(initialParams);

        // Determine initial method
        let initialMethod = persistentState?.selectedMethod;
        if (initialMethod) {
            const method = CONFIG_DATA.search.list.find(m => m.name === initialMethod);
            if (!method || !method.active) {
                initialMethod = getFirstActiveMethod();
            }
        } else {
            initialMethod = getFirstActiveMethod();
        }

        setSelectedMethod(initialMethod);
        setSelectedFiles(persistentState?.selectedFiles || []);
        setShowSettings(persistentState?.showSettings ?? true);
    }, [persistentState, initializeParams, getFirstActiveMethod]);

    // Debounced state change notification
    useEffect(() => {
        if (!selectedMethod || !onStateChange) return;

        const timeoutId = setTimeout(() => {
            onStateChange({
                selectedMethod,
                allParams,
                selectedFiles,
                showSettings
            });
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [selectedMethod, allParams, selectedFiles, showSettings, onStateChange]);

    // Current method parameters
    const currentParams = useMemo(() => {
        return allParams[selectedMethod] || {};
    }, [allParams, selectedMethod]);

    const currentMethodConfig = useMemo(() => {
        return CONFIG_DATA.search.list.find(m => m.name === selectedMethod);
    }, [selectedMethod]);

    // Event handlers
    const handleMethodChange = useCallback((methodName: string) => {
        const method = CONFIG_DATA.search.list.find(m => m.name === methodName);
        if (!method || !method.active) return;

        setSelectedMethod(methodName);
    }, []);

    const handleParamChange = useCallback((paramName: string, value: number) => {
        setAllParams(prev => ({
            ...prev,
            [selectedMethod]: {
                ...prev[selectedMethod],
                [paramName]: value
            }
        }));
    }, [selectedMethod]);

    const toggleFileSelection = useCallback((fileId: string) => {
        setSelectedFiles(prev => 
            prev.includes(fileId) 
                ? prev.filter(id => id !== fileId)
                : [...prev, fileId]
        );
    }, []);

    const toggleSettings = useCallback(() => {
        setShowSettings(prev => !prev);
    }, []);

    const toggleResultsPanel = useCallback(() => {
        setShowResultsPanel(prev => !prev);
    }, []);

    // Simulation progress handler
    const handleSimulationProgress = useCallback((message: string) => {
        const progress = parseInt(message);
        setSimulationStatus({
            status: progress < 100 ? 'En cours' : 'Terminé',
            progress
        });
    }, []);

    // Utility functions
    const delay = (ms: number): Promise<void> => {
        return new Promise(resolve => setTimeout(resolve, ms));
    };

    const runInversionAsync = (inv: any): Promise<any> => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                try {
                    const result = inv.run();
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            }, 10);
        });
    };

    // Main simulation function
    const startSimulation = useCallback(async () => {
        if (selectedFiles.length === 0) return;

        const selectedFilesData = selectedFiles.map(fileId => 
            files.find(f => f.id === fileId)!
        ).filter(Boolean);

        try {
            // Initialize computing state
            setIsComputing(true);
            setComputingMessage('Initializing computation...');
            setComputingProgress(0);
            setSimulationStatus({ status: 'Computing...', progress: 0 });
            setSolution(null);
            setShowResultsPanel(false);

            await delay(50);

            // Setup inversion method
            setComputingMessage('Setting up inversion method...');
            setComputingProgress(10);
            await delay(50);

            const inv = new InverseMethod();
            const searchMethod: SearchMethod = SearchMethodFactory.create(
                selectedMethod,
                currentParams
            );

            const observer = new SimulationObserver(handleSimulationProgress);
            searchMethod.addObserver(observer);
            inv.setSearchMethod(searchMethod);

            // Process data
            setComputingMessage('Processing input data...');
            setComputingProgress(30);
            await delay(50);

            selectedFilesData.forEach(file => {
                file.content.forEach((dataParams: any) => {
                    const data = DataFactory.create(dataParams['type']);
                    data.initialize(dataParams);
                    inv.addData(data);
                });
            });

            // Run inversion
            setComputingMessage('Running stress inversion...');
            setComputingProgress(60);
            await delay(50);

            const sol = await runInversionAsync(inv);

            // Process results
            setComputingMessage('Processing results...');
            setComputingProgress(90);
            await delay(50);

            const stressTensor = sol.stressTensorSolution;
            const analysis = decomposeStressTensor(stressTensor);
            const eulerDegrees = eulerAnglesToDegrees(analysis.eulerAngles);
            const calculatedStressRatio = calculateStressRatio(analysis.eigenvalues);

            // Finalize
            setComputingMessage('Finalizing...');
            setComputingProgress(100);
            await delay(100);

            console.log('=== STRESS TENSOR ANALYSIS ===');
            console.log('Original stress ratio:', sol.stressRatio);
            console.log('Calculated stress ratio:', calculatedStressRatio);

            // Set final results
            setSolution({
                ...sol,
                analysis: {
                    ...analysis,
                    eulerAnglesDegrees: eulerDegrees,
                    calculatedStressRatio
                }
            });
            setSimulationStatus({ status: 'Completed', progress: 100 });
            setShowResultsPanel(true);

        } catch (error) {
            let message = "An unknown error occurred";
            if (error instanceof Error) {
                message = error.message;
            } else if (typeof error === 'string') {
                message = error;
            }

            setErrorMessage(message);
            setSimulationStatus({ status: 'Error', progress: 0 });
        } finally {
            setIsComputing(false);
            setComputingMessage('');
            setComputingProgress(0);
        }
    }, [selectedFiles, files, selectedMethod, currentParams, handleSimulationProgress]);

    // Results panel component
    const ResultsPanel = () => {
        if (!solution) return null;

        const stressRatio = solution.stressRatio.toFixed(2);
        const fitPercentage = (Math.round((1 - solution.misfit) * 1000) / 10).toFixed(1);
        const misfitDegrees = (Math.trunc(solution.misfit * 100) / 100 * 180 / Math.PI).toFixed(1);

        return (
            <div className="mt-6 bg-white border rounded-lg shadow-sm overflow-hidden">
                <div
                    className="flex justify-between items-center px-6 py-4 bg-blue-50 border-b cursor-pointer"
                    onClick={toggleResultsPanel}
                >
                    <h3 className="text-lg font-medium text-blue-800">Simulation Results</h3>
                    {showResultsPanel ?
                        <ChevronUp className="w-5 h-5 text-blue-600" /> :
                        <ChevronDown className="w-5 h-5 text-blue-600" />
                    }
                </div>

                {showResultsPanel && (
                    <div className="p-6 space-y-6">
                        {/* Key metrics */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-blue-50 p-4 rounded-lg">
                                <h4 className="text-sm font-medium text-blue-800 mb-2">Stress Ratio</h4>
                                <p className="text-2xl font-bold">{stressRatio}</p>
                                {solution.analysis && (
                                    <p className="text-sm text-gray-600">
                                        Calculated: {solution.analysis.calculatedStressRatio.toFixed(3)}
                                    </p>
                                )}
                            </div>
                            <div className="bg-green-50 p-4 rounded-lg">
                                <h4 className="text-sm font-medium text-green-800 mb-2">Fit</h4>
                                <p className="text-2xl font-bold">{fitPercentage}%</p>
                            </div>
                            <div className="bg-amber-50 p-4 rounded-lg">
                                <h4 className="text-sm font-medium text-amber-800 mb-2">Misfit</h4>
                                <p className="text-2xl font-bold">{misfitDegrees}°</p>
                            </div>
                        </div>

                        {/* Principal Stresses */}
                        {solution.analysis && (
                            <div>
                                <h4 className="text-base font-medium mb-3">Principal Stresses</h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-red-50 p-4 rounded-lg">
                                        <h5 className="text-sm font-medium text-red-800 mb-2">σ₁ (Maximum)</h5>
                                        <p className="text-lg font-bold">{solution.analysis.principalStresses.sigma1.value.toFixed(4)}</p>
                                        <p className="text-xs text-gray-600">
                                            Direction: [{solution.analysis.principalStresses.sigma1.direction.map(v => v.toFixed(3)).join(', ')}]
                                        </p>
                                    </div>
                                    <div className="bg-yellow-50 p-4 rounded-lg">
                                        <h5 className="text-sm font-medium text-yellow-800 mb-2">σ₂ (Intermediate)</h5>
                                        <p className="text-lg font-bold">{solution.analysis.principalStresses.sigma2.value.toFixed(4)}</p>
                                        <p className="text-xs text-gray-600">
                                            Direction: [{solution.analysis.principalStresses.sigma2.direction.map(v => v.toFixed(3)).join(', ')}]
                                        </p>
                                    </div>
                                    <div className="bg-blue-50 p-4 rounded-lg">
                                        <h5 className="text-sm font-medium text-blue-800 mb-2">σ₃ (Minimum)</h5>
                                        <p className="text-lg font-bold">{solution.analysis.principalStresses.sigma3.value.toFixed(4)}</p>
                                        <p className="text-xs text-gray-600">
                                            Direction: [{solution.analysis.principalStresses.sigma3.direction.map(v => v.toFixed(3)).join(', ')}]
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Euler Angles */}
                        {solution.analysis && (
                            <div>
                                <h4 className="text-base font-medium mb-3">Euler Angles (ZXZ Convention)</h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-purple-50 p-4 rounded-lg text-center">
                                        <h5 className="text-sm font-medium text-purple-800 mb-2">φ (Phi)</h5>
                                        <p className="text-xl font-bold">{solution.analysis.eulerAnglesDegrees.phi.toFixed(1)}°</p>
                                        <p className="text-xs text-gray-600">{solution.analysis.eulerAngles.phi.toFixed(4)} rad</p>
                                    </div>
                                    <div className="bg-purple-50 p-4 rounded-lg text-center">
                                        <h5 className="text-sm font-medium text-purple-800 mb-2">θ (Theta)</h5>
                                        <p className="text-xl font-bold">{solution.analysis.eulerAnglesDegrees.theta.toFixed(1)}°</p>
                                        <p className="text-xs text-gray-600">{solution.analysis.eulerAngles.theta.toFixed(4)} rad</p>
                                    </div>
                                    <div className="bg-purple-50 p-4 rounded-lg text-center">
                                        <h5 className="text-sm font-medium text-purple-800 mb-2">ψ (Psi)</h5>
                                        <p className="text-xl font-bold">{solution.analysis.eulerAnglesDegrees.psi.toFixed(1)}°</p>
                                        <p className="text-xs text-gray-600">{solution.analysis.eulerAngles.psi.toFixed(4)} rad</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Stress tensor matrix */}
                        <div>
                            <h4 className="text-base font-medium mb-3">Stress Tensor Solution</h4>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">X</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Y</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Z</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {solution.stressTensorSolution.map((row, rowIndex) => (
                                            <tr key={rowIndex}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {rowIndex === 0 ? 'X' : rowIndex === 1 ? 'Y' : 'Z'}
                                                </td>
                                                {row.map((value, colIndex) => (
                                                    <td key={colIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {value.toFixed(4)}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl">Run</h2>
                <div className="flex items-center">
                    <div className="mr-4">
                        <label htmlFor="search-method" className="block text-sm font-medium text-gray-700 mb-1">
                            {CONFIG_DATA.search.display}
                        </label>
                        <select
                            id="search-method"
                            value={selectedMethod}
                            onChange={(e) => handleMethodChange(e.target.value)}
                            className="block w-64 px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                            {CONFIG_DATA.search.list.map((method) => (
                                <option 
                                    key={method.name} 
                                    value={method.name}
                                    disabled={!method.active}
                                    style={{
                                        color: method.active ? 'inherit' : '#9CA3AF',
                                        backgroundColor: method.active ? 'inherit' : '#F3F4F6'
                                    }}
                                >
                                    {method.name}{!method.active ? ' (Inactive)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={toggleSettings}
                        className={`p-2 rounded-md transition-colors ${
                            showSettings 
                                ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' 
                                : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                        title={showSettings ? "Hide parameters" : "Show parameters"}
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Parameter settings panel */}
            <div
                className={`mb-6 p-4 border rounded-md bg-gray-50 transition-all duration-300 ease-in-out ${
                    showSettings 
                        ? 'opacity-100 max-h-[1000px]' 
                        : 'opacity-0 max-h-0 overflow-hidden p-0 m-0 border-0'
                }`}
            >
                <h3 className="text-lg font-medium mb-3">Paramètres de {selectedMethod}</h3>
                <div className="grid grid-cols-2 gap-4">
                    {currentMethodConfig?.params.map(param => (
                        <div key={param.name}>
                            <label htmlFor={param.name} className="block text-sm font-medium text-gray-700 mb-1">
                                {param.display}
                            </label>
                            <div className="flex flex-col gap-2">
                                <input
                                    type="range"
                                    id={`slider-${param.name}`}
                                    min={param.min}
                                    max={param.max}
                                    step={param.name.includes('RandomTrials') ? 100 : param.max < 10 ? 0.01 : 1}
                                    value={currentParams[param.name] ?? param.value}
                                    onChange={(e) => handleParamChange(param.name, parseFloat(e.target.value))}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                />
                                <input
                                    type="number"
                                    id={param.name}
                                    min={param.min}
                                    max={param.max}
                                    step={param.name.includes('RandomTrials') ? 100 : param.max < 10 ? 0.01 : 1}
                                    value={currentParams[param.name] ?? param.value}
                                    onChange={(e) => {
                                        const value = e.target.value === '' ? param.value : parseFloat(e.target.value);
                                        handleParamChange(param.name, Math.min(Math.max(value, param.min), param.max));
                                    }}
                                    className="px-2 py-1 w-24 text-right border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* File selection */}
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
                                    checked={selectedFiles.includes(file.id)}
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

            {/* Simulation table */}
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
                        {selectedFiles.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-4 text-sm text-gray-500 text-center italic">
                                    Sélectionnez des fichiers pour lancer l'analyse
                                </td>
                            </tr>
                        ) : (
                            <tr>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {selectedMethod} ({selectedFiles.length} fichier{selectedFiles.length > 1 ? 's' : ''} sélectionné{selectedFiles.length > 1 ? 's' : ''})
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {simulationStatus.status}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                                        <div
                                            className="bg-blue-600 h-2.5 rounded-full"
                                            style={{ width: `${simulationStatus.progress}%` }}
                                        ></div>
                                    </div>
                                    <span className="text-xs text-gray-500 mt-1">{simulationStatus.progress}%</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <button
                                        onClick={startSimulation}
                                        disabled={simulationStatus.status === 'En cours' || isComputing}
                                        className={`p-2 rounded-full ${
                                            simulationStatus.status === 'En cours' || isComputing
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

            {/* Results panel */}
            <ResultsPanel />

            {/* Error modal */}
            <ErrorModal
                message={errorMessage || ''}
                isOpen={errorMessage !== null}
                onClose={() => setErrorMessage(null)}
            />

            {/* Loading overlay */}
            <LoadingOverlay
                isVisible={isComputing}
                message={computingMessage}
                progress={computingProgress}
            />
        </div>
    );
};

export default RunComponent;