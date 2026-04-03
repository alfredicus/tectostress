import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Play, Settings, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { DataFile } from './DataFile';
import { SearchMethodFactory, SearchMethod, InverseMethod, DataFactory, Data } from '@alfredo-taboada/stress';
import { decomposeStressTensor, eulerAnglesToDegrees, calculateStressRatio } from '../math/tensor_analysis';
import ErrorModal from './ErrorModal';
import LoadingOverlay from './LoadingOverlay';
import { Download, FileText } from 'lucide-react';
import { ConsoleComponent, ConsoleMessage } from './ConsoleComponent';
import { StressSolution } from './types';
import { ExportDialog } from './ExportDialog';
import {
    StressAnalysisComponent,
    VisualizationContext,
    VisualizationRegistry
} from './VisualizationTypeRegistry';
import { Button, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import MCMCStatsComponent from './MCMCStats/MCMCStatsComponent';
import ParameterSpaceLandscapeComponent from './ParameterSpace/ParameterSpaceLandscapeComponent';

// Configuration interfaces (same as before)
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
    persistedSolution?: any; // StressSolution
    persistedVisualizations?: any[];
    persistedSelectedFile?: string | null;
    persistedLayout?: { [key: string]: any };
    onSolutionChange?: (
        solution: any | null,
        visualizations: any[],
        selectedFile: string | null,
        layout: { [key: string]: any }
    ) => void;
    onNavigateToHelp?: (docPath: string) => void;
}

// Configuration data (same as before)
const CONFIG_DATA: ConfigData = {
    search: {
        display: "Search method",
        type: "combobox",
        list: [
            {
                name: "Monte Carlo (Euler)",
                active: true,
                params: [
                    {
                        name: "rotAngleHalfInterval",
                        display: "Rotation angle interval",
                        value: 90,
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
                        value: 1,
                        min: 0,
                        max: 1
                    }
                ]
            },
            {
                name: "Monte Carlo (Quaternion)",
                active: true,
                params: [
                    {
                        name: "nbRandomTrials",
                        display: "Nb simulations",
                        value: 20000,
                        min: 10,
                        max: 1e6
                    },
                    {
                        name: "topFraction",
                        display: "Top fraction kept",
                        value: 0.05,
                        min: 0.001,
                        max: 0.5
                    }
                ]
            },
            {
                name: "MCMC (Euler)",
                active: true,
                params: [
                    {
                        name: "nbIterations",
                        display: "Nb iterations",
                        value: 50000,
                        min: 1000,
                        max: 85000
                    },
                    {
                        name: "burnIn",
                        display: "Burn-in fraction",
                        value: 0.2,
                        min: 0,
                        max: 0.5
                    },
                    {
                        name: "temperature",
                        display: "Temperature",
                        value: 0.05,
                        min: 0.001,
                        max: 1
                    },
                    {
                        name: "rotAngleStepSize",
                        display: "Rotation step (deg)",
                        value: 5,
                        min: 0.1,
                        max: 45
                    },
                    {
                        name: "stressRatioStepSize",
                        display: "Stress ratio step",
                        value: 0.05,
                        min: 0.001,
                        max: 0.5
                    },
                    {
                        name: "stressRatio",
                        display: "Stress ratio",
                        value: 0.5,
                        min: 0,
                        max: 1
                    }
                ]
            },
            {
                name: "MCMC (Quaternion)",
                active: true,
                params: [
                    {
                        name: "nbIterations",
                        display: "Nb iterations",
                        value: 50000,
                        min: 1000,
                        max: 500000
                    },
                    {
                        name: "burnIn",
                        display: "Burn-in fraction",
                        value: 0.2,
                        min: 0,
                        max: 0.5
                    },
                    {
                        name: "sigmaNoise",
                        display: "σ noise (rad)",
                        value: parseFloat((Math.PI / 18).toFixed(4)),
                        min: 0.01,
                        max: 0.5
                    },
                    {
                        name: "sigmaRot",
                        display: "σ rot (rad)",
                        value: 0.1,
                        min: 0.01,
                        max: 0.5
                    },
                    {
                        name: "sigmaR",
                        display: "σ R",
                        value: 0.05,
                        min: 0.001,
                        max: 0.5
                    },
                    {
                        name: "stressRatio",
                        display: "Stress ratio",
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
                        name: "dimension",
                        display: "Dimension (2/3/4)",
                        value: 4,
                        min: 2,
                        max: 4
                    },
                    {
                        name: "deltaGridAngle",
                        display: "Grid angle delta (°)",
                        value: 2,
                        min: 0.01,
                        max: 90
                    },
                    {
                        name: "GridAngleHalfIntervalS",
                        display: "Angle half-interval (°)",
                        value: 30,
                        min: 1,
                        max: 180
                    },
                    {
                        name: "deltaStressRatio",
                        display: "Stress ratio delta",
                        value: 0.01,
                        min: 0.001,
                        max: 0.5
                    },
                    {
                        name: "stressRatioHalfInterval",
                        display: "Stress ratio half-interval",
                        value: 0.2,
                        min: 0,
                        max: 1
                    },
                    {
                        name: "sweepPhi",
                        display: "Sweep φ (0=fix, 1=free)",
                        value: 1,
                        min: 0,
                        max: 1
                    },
                    {
                        name: "sweepTheta",
                        display: "Sweep θ (0=fix, 1=free)",
                        value: 1,
                        min: 0,
                        max: 1
                    },
                    {
                        name: "sweepAlpha",
                        display: "Sweep α (0=fix, 1=free)",
                        value: 1,
                        min: 0,
                        max: 1
                    },
                    {
                        name: "sweepR",
                        display: "Sweep R (0=fix, 1=free)",
                        value: 1,
                        min: 0,
                        max: 1
                    }
                ]
            },
            {
                name: "Manually",
                active: false,
                params: []
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
    onStateChange,
    persistedSolution,
    persistedVisualizations = [],
    persistedSelectedFile = null,
    persistedLayout = {},
    onSolutionChange,
    onNavigateToHelp
}) => {
    // State management (same as before, but simplified for key parts)
    const [selectedMethod, setSelectedMethod] = useState<string>('');
    const [allParams, setAllParams] = useState<Record<string, Record<string, number>>>({});
    const [selectedFiles, setSelectedFiles] = useState<string[]>(files.map(file => file.id));
    const [showSettings, setShowSettings] = useState<boolean>(false);
    const [simulationStatus, setSimulationStatus] = useState<SimulationStatus>({
        status: 'En attente',
        progress: 0
    });
    const [solution, setSolution] = useState<StressSolution | null>(persistedSolution || null);
    // const [solution, setSolution] = useState<StressSolution | null>(null);
    const [processedData, setProcessedData] = useState<{ data: Data[]; engine: any } | null>(null);
    const [showResultsPanel, setShowResultsPanel] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isComputing, setIsComputing] = useState<boolean>(false);
    const [computingMessage, setComputingMessage] = useState<string>('');
    const [computingProgress, setComputingProgress] = useState<number>(0);
    const [showExportDialog, setShowExportDialog] = useState<boolean>(false);
    // Console-related state
    const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
    const [isConsoleOpen, setIsConsoleOpen] = useState<boolean>(false);

    // Helper function to add messages to console
    const addConsoleMessage = useCallback((
        type: ConsoleMessage['type'],
        message: string,
        details?: string
    ) => {
        const newMessage: ConsoleMessage = {
            id: `msg-${Date.now()}-${Math.random()}`,
            timestamp: new Date(),
            type,
            message,
            details
        };

        setConsoleMessages(prev => [...prev, newMessage]);

        // Auto-open console for errors
        if (type === 'error') {
            setIsConsoleOpen(true);
        }
    }, []);

    const clearConsole = useCallback(() => {
        setConsoleMessages([]);
    }, []);

    const toggleConsole = useCallback(() => {
        setIsConsoleOpen(prev => !prev);
    }, []);

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

    useEffect(() => {
        // Auto-select all files when files list changes
        setSelectedFiles(files.map(file => file.id));
        // setSelectAll(true);
    }, [files]);

    // Initialize state from props or defaults
    useEffect(() => {
        const initialParams = persistentState?.allParams || initializeParams();
        setAllParams(initialParams);

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
        // console.log('Persistent state for showSettings:', persistentState);
        setShowSettings(persistentState?.showSettings ?? false);
    }, [persistentState, initializeParams, getFirstActiveMethod]);

    useEffect(() => {
        if (persistedSolution) {
            setSolution(persistedSolution);
            setShowResultsPanel(true);
            addConsoleMessage(
                'info',
                'Loaded previous stress inversion results',
                `Solution with stress ratio: ${persistedSolution.stressRatio?.toFixed(2)}`
            );
        }
    }, []); // Tableau de dépendance vide: exécuter UNE SEULE FOIS au montage

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

    // Main simulation function (same as before, but with additional visualization data preparation)
    const startSimulation = useCallback(async () => {
        if (selectedFiles.length === 0) return;

        const selectedFilesData = selectedFiles.map(fileId =>
            files.find(f => f.id === fileId)!
        ).filter(Boolean);

        try {
            setConsoleMessages([]);
            setIsComputing(true);
            setComputingMessage('Initializing computation...');
            setComputingProgress(0);
            setSimulationStatus({ status: 'Computing...', progress: 0 });
            setSolution(null);
            setShowResultsPanel(false);

            addConsoleMessage('info', 'Starting stress inversion simulation...');
            addConsoleMessage('info', `Selected method: ${selectedMethod}`);
            addConsoleMessage('info', `Processing ${selectedFilesData.length} file(s): ${selectedFilesData.map(f => f.name).join(', ')}`);

            await delay(50);

            // Setup inversion method
            setComputingMessage('Setting up inversion method...');
            setComputingProgress(10);
            addConsoleMessage('info', 'Setting up inversion method...');
            await delay(50);

            const inv = new InverseMethod();
            // For Grid Search, convert 0/1 slider values to booleans for sweep flags
            let methodParams: Record<string, any> = { ...currentParams };
            if (selectedMethod === 'Grid Search') {
                for (const key of ['sweepPhi', 'sweepTheta', 'sweepAlpha', 'sweepR']) {
                    if (key in methodParams) methodParams[key] = methodParams[key] !== 0;
                }
                if ('dimension' in methodParams) methodParams.dimension = Math.round(methodParams.dimension) as 2 | 3 | 4;
            }
            const searchMethod: SearchMethod = SearchMethodFactory.create(
                selectedMethod,
                methodParams
            );

            if (!searchMethod) {
                throw new Error(`Unknown search method: "${selectedMethod}". Check that the stress library is up to date.`);
            }

            const paramDetails = Object.entries(currentParams)
                .map(([key, value]) => `${key}: ${value}`)
                .join('\n');
            addConsoleMessage('info', 'Using parameters:', paramDetails);

            const observer = new SimulationObserver(handleSimulationProgress);
            searchMethod.addObserver(observer);
            inv.setSearchMethod(searchMethod);

            // Process data
            setComputingMessage('Processing input data...');
            setComputingProgress(30);
            addConsoleMessage('info', 'Processing input data...');
            await delay(50);

            const processingStats = {
                total: 0,
                processed: 0,
                errors: [] as string[],
                unsupportedTypes: new Set<string>()
            };

            selectedFilesData.forEach(file => {
                file.content.forEach((dataParams: any, index: number) => {
                    processingStats.total++;

                    try {
                        const dataType = dataParams['type'];
                        const data = DataFactory.create(dataType);

                        if (!data) {
                            processingStats.unsupportedTypes.add(dataType);
                            processingStats.errors.push(
                                `File "${file.name}", row ${index + 1}: Unsupported data type "${dataType}"`
                            );
                            addConsoleMessage('warning', `Unsupported data type: ${dataType}`, `File: ${file.name}, Row: ${index + 1}`);
                            return;
                        }

                        data.initialize(dataParams);

                        console.warn(data, dataParams)
                        
                        inv.addData(data);
                        processingStats.processed++;

                    } catch (error) {
                        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                        processingStats.errors.push(
                            `File "${file.name}", row ${index + 1}: ${errorMsg}`
                        );
                        addConsoleMessage('error', `Data processing error in ${file.name}`, `Row ${index + 1}: ${errorMsg}`);
                    }
                });
            });

            addConsoleMessage('info', `Data processing completed: ${processingStats.processed}/${processingStats.total} items processed successfully`);

            if (processingStats.errors.length > 0) {
                addConsoleMessage('warning', `${processingStats.errors.length} items were skipped due to errors`);

                if (processingStats.unsupportedTypes.size > 0) {
                    addConsoleMessage('warning', `Unsupported data types found: ${Array.from(processingStats.unsupportedTypes).join(', ')}`);
                }
            }

            if (processingStats.processed === 0) {
                const errorMsg = `No valid data could be processed. Found unsupported types: ${Array.from(processingStats.unsupportedTypes).join(', ')}`;
                addConsoleMessage('error', 'No valid data to process', errorMsg);
                throw new Error(errorMsg);
            }

            if (processingStats.processed < 3) {
                addConsoleMessage('warning', `Only ${processingStats.processed} data items were processed. Results may not be reliable.`);
            }

            // Run inversion
            setComputingMessage('Running stress inversion...');
            setComputingProgress(60);
            addConsoleMessage('info', 'Running stress inversion algorithm...');
            await delay(50);

            const t0 = performance.now();
            const sol = await runInversionAsync(inv);
            const elapsedMs = performance.now() - t0;

            // Process results
            setComputingMessage('Processing results...');
            setComputingProgress(90);
            addConsoleMessage('info', 'Processing inversion results...');
            await delay(50);

            const stressTensor = sol.stressTensorSolution;
            const analysis = decomposeStressTensor(stressTensor);
            const eulerDegrees = eulerAnglesToDegrees(analysis.eulerAngles);
            const calculatedStressRatio = calculateStressRatio(analysis.eigenvalues);

            // Log key results
            addConsoleMessage('success', 'Stress inversion completed successfully!');
            const elapsedStr = elapsedMs < 1000
                ? `${Math.round(elapsedMs)} ms`
                : `${(elapsedMs / 1000).toFixed(2)} s`;
            addConsoleMessage('info', `Running time: ${elapsedStr}`);
            addConsoleMessage('info', `Stress ratio: ${sol.stressRatio.toFixed(3)}`);
            addConsoleMessage('info', `Fit: ${((1 - sol.misfit) * 100).toFixed(1)}%`);
            addConsoleMessage('info', `Misfit: ${(sol.misfit * 180 / Math.PI).toFixed(1)}°`);

            // Extract MCMC posterior stats if applicable
            let mcmcStats: StressSolution['mcmcStats'] = undefined;
            const isMCMCMethod = selectedMethod === 'MCMC' || selectedMethod === 'MCMC Quaternion';
            const isMCMethod   = selectedMethod === 'Monte Carlo' || selectedMethod === 'Monte Carlo Quaternion';
            if (isMCMCMethod || isMCMethod) {
                const sm = inv.searchMethod;
                const stats = (sm as any).getStats?.();
                if (stats) {
                    mcmcStats = stats;
                    const label = isMCMethod ? `${selectedMethod} top-5%` : selectedMethod;
                    addConsoleMessage('info', `${label} acceptance rate: ${stats.acceptanceRate.toFixed(1)}%`);
                    addConsoleMessage('info', `${label} chain length: ${stats.chainLength} samples`);
                    addConsoleMessage('info',
                        `Stress ratio posterior: ${stats.stressRatio.mean.toFixed(3)} ± ${stats.stressRatio.std.toFixed(3)} ` +
                        `[${stats.stressRatio.q05.toFixed(3)}, ${stats.stressRatio.q95.toFixed(3)}]`
                    );
                }
            }

            // Finalize
            setComputingMessage('Finalizing...');
            setComputingProgress(100);
            await delay(100);

            // Set final results with enhanced data for visualizations
            const enhancedSolution: StressSolution = {
                ...sol,
                elapsedMs,
                mcmcStats,
                analysis: {
                    ...analysis,
                    eulerAnglesDegrees: eulerDegrees,
                    calculatedStressRatio
                },
                // Add visualization-ready data
                visualizationData: {
                    inputData: selectedFilesData,
                    processedDataCount: processingStats.processed,
                    methodParameters: currentParams,
                    processingStatistics: processingStats
                }
            };

            setSolution(enhancedSolution);
            setProcessedData({ data: [...inv.data], engine: inv.engine });
            setSimulationStatus({ status: 'Completed', progress: 100 });
            setShowResultsPanel(true);

            if (onSolutionChange) {
                // Strip large distribution arrays before persisting to localStorage
                const persistableSolution = { ...enhancedSolution };
                if (persistableSolution.mcmcStats?.distributions) {
                    persistableSolution.mcmcStats = {
                        ...persistableSolution.mcmcStats,
                        distributions: undefined as any
                    };
                }
                onSolutionChange(
                    persistableSolution,
                    persistedVisualizations || [],
                    persistedSelectedFile || null,
                    persistedLayout || {}
                );
            }

        } catch (error) {
            let message = "An unknown error occurred";
            if (error instanceof Error) {
                message = error.message;
            } else if (typeof error === 'string') {
                message = error;
            }

            addConsoleMessage('error', 'Simulation failed', message);
            setErrorMessage(message);
            setSimulationStatus({ status: 'Error', progress: 0 });
        } finally {
            setIsComputing(false);
            setComputingMessage('');
            setComputingProgress(0);
        }
    }, [selectedFiles, files, selectedMethod, currentParams, handleSimulationProgress, addConsoleMessage, persistedVisualizations, persistedSelectedFile, persistedLayout]);

    // Cet effet s'assure que si les fichiers changent drastiquement 
    // (ex: changement de modèle), la solution basée sur les anciens fichiers
    // est supprimée car elle n'est plus valide
    useEffect(() => {
        // Si on a une solution mais que les fichiers ont changé
        if (solution && solution.visualizationData?.inputData) {
            const currentFileIds = new Set(files.map(f => f.id));
            const solutionInputFileIds = new Set(
                solution.visualizationData.inputData.map((f: DataFile) => f.id)
            );

            // Vérifier si des fichiers de la solution ont disparu
            let hasInvalidFiles = false;
            for (const fileId of solutionInputFileIds) {
                if (!currentFileIds.has(fileId)) {
                    hasInvalidFiles = true;
                    break;
                }
            }

            if (hasInvalidFiles) {
                console.warn('Solution is based on files that no longer exist, clearing');
                setSolution(null);
                setShowResultsPanel(false);
                if (onSolutionChange) {
                    onSolutionChange(null, [], null, {});
                }
            }
        }
    }, [files, solution, onSolutionChange]);

    // Export functionality (same as before)
    const exportResults = useCallback((filename: string, format: 'json' | 'csv' | 'txt') => {
        if (!solution) return;

        let content: string;
        let mimeType: string;
        let fileExtension: string;

        const timestamp = new Date().toISOString();
        const selectedFileNames = selectedFiles.map(id =>
            files.find(f => f.id === id)?.name || 'unknown'
        ).join(', ');

        // Export logic remains the same as before...
        switch (format) {
            case 'json':
                content = JSON.stringify({
                    metadata: {
                        timestamp,
                        method: selectedMethod,
                        parameters: currentParams,
                        files: selectedFileNames,
                        version: '1.0'
                    },
                    results: {
                        stressRatio: solution.stressRatio,
                        misfit: solution.misfit,
                        fitPercentage: (1 - solution.misfit) * 100,
                        misfitDegrees: solution.misfit * 180 / Math.PI,
                        stressTensorSolution: solution.stressTensorSolution,
                        analysis: solution.analysis
                    }
                }, null, 2);
                mimeType = 'application/json';
                fileExtension = 'json';
                break;

            case 'csv':
                const csvLines = [
                    'Parameter,Value,Unit',
                    `Timestamp,${timestamp},`,
                    `Method,${selectedMethod},`,
                    `Files,"${selectedFileNames}",`,
                    `Stress Ratio,${solution.stressRatio},`,
                    `Misfit,${solution.misfit},radians`,
                    `Misfit,${(solution.misfit * 180 / Math.PI).toFixed(2)},degrees`,
                    `Fit,${((1 - solution.misfit) * 100).toFixed(2)},%`,
                    '',
                    'Stress Tensor Solution',
                    'Row,X,Y,Z',
                    ...solution.stressTensorSolution.map((row, i) =>
                        `${i + 1},${row.map(val => val.toFixed(6)).join(',')}`
                    )
                ];

                if (solution.analysis) {
                    csvLines.push(
                        '',
                        'Principal Stresses',
                        'Component,Value,Direction_X,Direction_Y,Direction_Z',
                        `Sigma1,${solution.analysis.principalStresses.sigma1.value.toFixed(6)},${solution.analysis.principalStresses.sigma1.direction.map(v => v.toFixed(6)).join(',')}`,
                        `Sigma2,${solution.analysis.principalStresses.sigma2.value.toFixed(6)},${solution.analysis.principalStresses.sigma2.direction.map(v => v.toFixed(6)).join(',')}`,
                        `Sigma3,${solution.analysis.principalStresses.sigma3.value.toFixed(6)},${solution.analysis.principalStresses.sigma3.direction.map(v => v.toFixed(6)).join(',')}`,
                        '',
                        'Euler Angles',
                        'Angle,Radians,Degrees',
                        `Phi,${solution.analysis.eulerAngles.phi.toFixed(6)},${solution.analysis.eulerAnglesDegrees.phi.toFixed(2)}`,
                        `Theta,${solution.analysis.eulerAngles.theta.toFixed(6)},${solution.analysis.eulerAnglesDegrees.theta.toFixed(2)}`,
                        `Psi,${solution.analysis.eulerAngles.psi.toFixed(6)},${solution.analysis.eulerAnglesDegrees.psi.toFixed(2)}`
                    );
                }

                content = csvLines.join('\n');
                mimeType = 'text/csv';
                fileExtension = 'csv';
                break;

            case 'txt':
                const txtLines = [
                    '=== STRESS INVERSION RESULTS ===',
                    '',
                    `Timestamp: ${timestamp}`,
                    `Method: ${selectedMethod}`,
                    `Files: ${selectedFileNames}`,
                    '',
                    '=== SUMMARY ===',
                    `Stress Ratio: ${solution.stressRatio}`,
                    `Fit: ${((1 - solution.misfit) * 100).toFixed(2)}%`,
                    `Misfit: ${(solution.misfit * 180 / Math.PI).toFixed(2)}° (${solution.misfit.toFixed(6)} rad)`,
                    '',
                    '=== PARAMETERS ===',
                    ...Object.entries(currentParams).map(([key, value]) => `${key}: ${value}`),
                    '',
                    '=== STRESS TENSOR SOLUTION ===',
                    ...solution.stressTensorSolution.map((row, i) =>
                        `Row ${i + 1}: [${row.map(val => val.toFixed(6)).join(', ')}]`
                    )
                ];

                if (solution.analysis) {
                    txtLines.push(
                        '',
                        '=== PRINCIPAL STRESSES ===',
                        `σ₁ (Maximum): ${solution.analysis.principalStresses.sigma1.value.toFixed(6)}`,
                        `    Direction: [${solution.analysis.principalStresses.sigma1.direction.map(v => v.toFixed(6)).join(', ')}]`,
                        `σ₂ (Intermediate): ${solution.analysis.principalStresses.sigma2.value.toFixed(6)}`,
                        `    Direction: [${solution.analysis.principalStresses.sigma2.direction.map(v => v.toFixed(6)).join(', ')}]`,
                        `σ₃ (Minimum): ${solution.analysis.principalStresses.sigma3.value.toFixed(6)}`,
                        `    Direction: [${solution.analysis.principalStresses.sigma3.direction.map(v => v.toFixed(6)).join(', ')}]`,
                        '',
                        '=== EULER ANGLES (ZXZ Convention) ===',
                        `φ (Phi): ${solution.analysis.eulerAnglesDegrees.phi.toFixed(2)}° (${solution.analysis.eulerAngles.phi.toFixed(6)} rad)`,
                        `θ (Theta): ${solution.analysis.eulerAnglesDegrees.theta.toFixed(2)}° (${solution.analysis.eulerAngles.theta.toFixed(6)} rad)`,
                        `ψ (Psi): ${solution.analysis.eulerAnglesDegrees.psi.toFixed(2)}° (${solution.analysis.eulerAngles.psi.toFixed(6)} rad)`,
                        '',
                        '=== EIGENVECTORS ===',
                        `v₁ (σ₁ direction): [${solution.analysis.eigenvectors[0].map(v => v.toFixed(6)).join(', ')}]`,
                        `v₂ (σ₂ direction): [${solution.analysis.eigenvectors[1].map(v => v.toFixed(6)).join(', ')}]`,
                        `v₃ (σ₃ direction): [${solution.analysis.eigenvectors[2].map(v => v.toFixed(6)).join(', ')}]`
                    );
                }

                content = txtLines.join('\n');
                mimeType = 'text/plain';
                fileExtension = 'txt';
                break;

            default:
                return;
        }

        // Create and download file
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.${fileExtension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        addConsoleMessage('success', `Results exported to ${filename}.${fileExtension}`);
    }, [solution, selectedMethod, currentParams, selectedFiles, files, addConsoleMessage]);

    const selectAllFiles = () => {
        setSelectedFiles(files.map(file => file.id));
    };

    const deselectAllFiles = () => {
        setSelectedFiles([]);
    };

    // Create enhanced files with solution data for visualizations
    const enhancedFiles = useMemo(() => {
        if (!solution) return files;

        // Create a virtual "results" file with the solution data
        const resultsFile: DataFile = {
            id: 'stress-inversion-results',
            name: 'Stress Inversion Results',
            headers: ['parameter', 'value', 'unit'],
            content: [
                { parameter: 'stress_ratio', value: solution.stressRatio, unit: '' },
                { parameter: 'fit_percentage', value: (1 - solution.misfit) * 100, unit: '%' },
                { parameter: 'misfit_degrees', value: solution.misfit * 180 / Math.PI, unit: 'degrees' },
                ...(solution.analysis ? [
                    { parameter: 'sigma1', value: solution.analysis.principalStresses.sigma1.value, unit: '' },
                    { parameter: 'sigma2', value: solution.analysis.principalStresses.sigma2.value, unit: '' },
                    { parameter: 'sigma3', value: solution.analysis.principalStresses.sigma3.value, unit: '' },
                    { parameter: 'phi_degrees', value: solution.analysis.eulerAnglesDegrees.phi, unit: 'degrees' },
                    { parameter: 'theta_degrees', value: solution.analysis.eulerAnglesDegrees.theta, unit: 'degrees' },
                    { parameter: 'psi_degrees', value: solution.analysis.eulerAnglesDegrees.psi, unit: 'degrees' }
                ] : []),
                ...(solution.elapsedMs != null ? [
                    { parameter: 'elapsed_ms', value: solution.elapsedMs, unit: 'ms' }
                ] : []),
                ...(solution.mcmcStats ? [
                    { parameter: 'mcmc_acceptance_rate', value: solution.mcmcStats.acceptanceRate, unit: '%' },
                    { parameter: 'mcmc_chain_length', value: solution.mcmcStats.chainLength, unit: 'samples' },
                    { parameter: 'mcmc_stress_ratio_mean', value: solution.mcmcStats.stressRatio.mean, unit: '' },
                    { parameter: 'mcmc_stress_ratio_std', value: solution.mcmcStats.stressRatio.std, unit: '' },
                    { parameter: 'mcmc_stress_ratio_q05', value: solution.mcmcStats.stressRatio.q05, unit: '' },
                    { parameter: 'mcmc_stress_ratio_q95', value: solution.mcmcStats.stressRatio.q95, unit: '' },
                    { parameter: 'mcmc_misfit_mean', value: solution.mcmcStats.misfit.mean, unit: '' },
                    { parameter: 'mcmc_misfit_std', value: solution.mcmcStats.misfit.std, unit: '' },
                    { parameter: 'mcmc_misfit_min', value: solution.mcmcStats.misfit.min, unit: '' },
                    // Euler angle posterior stats (degrees) — guarded for old persisted solutions
                    ...(solution.mcmcStats.eulerAngles ? [
                        { parameter: 'mcmc_phi_mean', value: solution.mcmcStats.eulerAngles.phi.mean, unit: 'degrees' },
                        { parameter: 'mcmc_phi_std', value: solution.mcmcStats.eulerAngles.phi.std, unit: 'degrees' },
                        { parameter: 'mcmc_phi_q05', value: solution.mcmcStats.eulerAngles.phi.q05, unit: 'degrees' },
                        { parameter: 'mcmc_phi_q95', value: solution.mcmcStats.eulerAngles.phi.q95, unit: 'degrees' },
                        { parameter: 'mcmc_theta_mean', value: solution.mcmcStats.eulerAngles.theta.mean, unit: 'degrees' },
                        { parameter: 'mcmc_theta_std', value: solution.mcmcStats.eulerAngles.theta.std, unit: 'degrees' },
                        { parameter: 'mcmc_theta_q05', value: solution.mcmcStats.eulerAngles.theta.q05, unit: 'degrees' },
                        { parameter: 'mcmc_theta_q95', value: solution.mcmcStats.eulerAngles.theta.q95, unit: 'degrees' },
                        { parameter: 'mcmc_psi_mean', value: solution.mcmcStats.eulerAngles.psi.mean, unit: 'degrees' },
                        { parameter: 'mcmc_psi_std', value: solution.mcmcStats.eulerAngles.psi.std, unit: 'degrees' },
                        { parameter: 'mcmc_psi_q05', value: solution.mcmcStats.eulerAngles.psi.q05, unit: 'degrees' },
                        { parameter: 'mcmc_psi_q95', value: solution.mcmcStats.eulerAngles.psi.q95, unit: 'degrees' },
                    ] : []),
                    // Distribution arrays (JSON-encoded) — guarded for old persisted solutions
                    ...(solution.mcmcStats.distributions ? (() => {
                        const dist = solution.mcmcStats!.distributions!;
                        const quantile = (sorted: number[], q: number) => {
                            const pos = q * (sorted.length - 1);
                            const lo = Math.floor(pos);
                            const hi = Math.ceil(pos);
                            return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
                        };
                        const q25 = (arr: number[]) => quantile([...arr].sort((a, b) => a - b), 0.25);
                        const q75 = (arr: number[]) => quantile([...arr].sort((a, b) => a - b), 0.75);
                        return [
                            { parameter: 'mcmc_dist_stress_ratio', value: JSON.stringify(dist.stressRatio), unit: 'json' },
                            { parameter: 'mcmc_dist_phi', value: JSON.stringify(dist.phi), unit: 'json' },
                            { parameter: 'mcmc_dist_theta', value: JSON.stringify(dist.theta), unit: 'json' },
                            { parameter: 'mcmc_dist_psi', value: JSON.stringify(dist.psi), unit: 'json' },
                            // Q25/Q75 for 50% credible intervals
                            { parameter: 'mcmc_stress_ratio_q25', value: q25(dist.stressRatio), unit: '' },
                            { parameter: 'mcmc_stress_ratio_q75', value: q75(dist.stressRatio), unit: '' },
                            { parameter: 'mcmc_phi_q25', value: q25(dist.phi), unit: 'degrees' },
                            { parameter: 'mcmc_phi_q75', value: q75(dist.phi), unit: 'degrees' },
                            { parameter: 'mcmc_theta_q25', value: q25(dist.theta), unit: 'degrees' },
                            { parameter: 'mcmc_theta_q75', value: q75(dist.theta), unit: 'degrees' },
                            { parameter: 'mcmc_psi_q25', value: q25(dist.psi), unit: 'degrees' },
                            { parameter: 'mcmc_psi_q75', value: q75(dist.psi), unit: 'degrees' },
                        ];
                    })() : []),
                    // Monte Carlo specific info
                    ...((selectedMethod === 'Monte Carlo' || selectedMethod === 'Monte Carlo Quaternion') ? [
                        { parameter: 'mc_total_samples', value: currentParams.nbRandomTrials ?? Math.round(solution.mcmcStats.chainLength / (currentParams.topFraction ?? 0.05)), unit: '' },
                        { parameter: 'mc_accepted_count', value: solution.mcmcStats.chainLength, unit: '' },
                        { parameter: 'mc_acceptance_threshold', value: (currentParams.topFraction ?? 0.05) * 100, unit: '%' },
                        { parameter: 'mc_threshold_type', value: 'top_pct', unit: '' },
                    ] : []),
                    // MCMC tuning parameters (derived from run params)
                    ...(selectedMethod === 'MCMC' && Object.keys(currentParams).length > 0 ? [
                        { parameter: 'mcmc_n_burn', value: Math.floor((currentParams.nbIterations ?? 50000) * (currentParams.burnIn ?? 0.2)), unit: 'samples' },
                        { parameter: 'mcmc_sigma_rot', value: (currentParams.rotAngleStepSize ?? 5) * Math.PI / 180, unit: 'radians' },
                        { parameter: 'mcmc_sigma_R', value: currentParams.stressRatioStepSize ?? 0.05, unit: '' },
                    ] : []),
                    // MCMC Quaternion tuning parameters
                    ...(selectedMethod === 'MCMC Quaternion' && Object.keys(currentParams).length > 0 ? [
                        { parameter: 'mcmc_n_burn', value: Math.floor((currentParams.nbIterations ?? 50000) * (currentParams.burnIn ?? 0.2)), unit: 'samples' },
                        { parameter: 'mcmc_sigma_rot', value: currentParams.sigmaRot ?? 0.1, unit: 'radians' },
                        { parameter: 'mcmc_sigma_R', value: currentParams.sigmaR ?? 0.05, unit: '' },
                        { parameter: 'mcmc_sigma_noise', value: currentParams.sigmaNoise ?? (Math.PI / 18), unit: 'radians' },
                    ] : []),
                    // Stress axis orientation statistics (sigma1, sigma2, sigma3)
                    ...(solution.mcmcStats.axesStats ? (() => {
                        const ax = solution.mcmcStats.axesStats!;
                        const axisKeys = (name: string, s: typeof ax.sigma1) => [
                            { parameter: `mcmc_${name}_trend`, value: s.trend, unit: 'degrees' },
                            { parameter: `mcmc_${name}_plunge`, value: s.plunge, unit: 'degrees' },
                            { parameter: `mcmc_${name}_mean_resultant_length`, value: s.meanResultantLength, unit: '' },
                            { parameter: `mcmc_${name}_fisher95`, value: s.fisherCone95, unit: 'degrees' },
                            { parameter: `mcmc_${name}_fisher68`, value: s.fisherCone68, unit: 'degrees' },
                        ];
                        return [
                            ...axisKeys('sigma1', ax.sigma1),
                            ...axisKeys('sigma2', ax.sigma2),
                            ...axisKeys('sigma3', ax.sigma3),
                            { parameter: 'mcmc_rotation_angle_mean', value: ax.rotationAngle.mean, unit: 'degrees' },
                            { parameter: 'mcmc_rotation_angle_std', value: ax.rotationAngle.std, unit: 'degrees' },
                            { parameter: 'mcmc_rotation_angle_q05', value: ax.rotationAngle.q05, unit: 'degrees' },
                            { parameter: 'mcmc_rotation_angle_q95', value: ax.rotationAngle.q95, unit: 'degrees' },
                        ];
                    })() : []),
                ] : [])
            ],
            layout: { x: 0, y: 0, w: 6, h: 3 }
        };

        return [...files, resultsFile];
    }, [files, solution, selectedMethod, currentParams]);

    // Results panel — inline JSX (not a nested component, to avoid remount flicker)
    const resultsPanelContent = (() => {
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
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowExportDialog(true);
                            }}
                            className="p-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors"
                            title="Export Results"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                        {showResultsPanel ?
                            <ChevronUp className="w-5 h-5 text-blue-600" /> :
                            <ChevronDown className="w-5 h-5 text-blue-600" />
                        }
                    </div>
                </div>


                {showResultsPanel && (
                    <div className="p-6 space-y-6">
                        {/* Key metrics */}

                        <h4 className="text-xl font-semibold text-indigo-800">Summary</h4>
                        <div className="grid grid-cols-4 gap-4">
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
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Running Time</h4>
                                <p className="text-2xl font-bold">
                                    {solution.elapsedMs != null
                                        ? solution.elapsedMs < 1000
                                            ? `${Math.round(solution.elapsedMs)} ms`
                                            : `${(solution.elapsedMs / 1000).toFixed(2)} s`
                                        : '—'}
                                </p>
                            </div>
                        </div>

                        {/* Principal stress axis orientations (σ1, σ2, σ3) */}
                        {solution.mcmcStats?.axesStats && (() => {
                            const ax = solution.mcmcStats!.axesStats!;
                            const axes = [
                                { label: 'σ₁ (max)', data: ax.sigma1, bg: 'bg-red-50',   hdr: 'text-red-800'   },
                                { label: 'σ₂ (int)', data: ax.sigma2, bg: 'bg-green-50', hdr: 'text-green-800' },
                                { label: 'σ₃ (min)', data: ax.sigma3, bg: 'bg-blue-50',  hdr: 'text-blue-800'  },
                            ];
                            return (
                                <div className="space-y-2">
                                    {axes.map(({ label, data, bg, hdr }) => (
                                        <div key={label} className="grid grid-cols-3 gap-4">
                                            <div className={`${bg} p-4 rounded-lg`}>
                                                <h4 className={`text-sm font-medium ${hdr} mb-2`}>Axis</h4>
                                                <p className="text-2xl font-bold">{label}</p>
                                            </div>
                                            <div className="bg-green-50 p-4 rounded-lg">
                                                <h4 className="text-sm font-medium text-green-800 mb-2">Trend</h4>
                                                <p className="text-2xl font-bold">{data.trend.toFixed(1)}°</p>
                                                <p className="text-sm text-gray-600">azimuth from N</p>
                                            </div>
                                            <div className="bg-amber-50 p-4 rounded-lg">
                                                <h4 className="text-sm font-medium text-amber-800 mb-2">Plunge</h4>
                                                <p className="text-2xl font-bold">{data.plunge.toFixed(1)}°</p>
                                                {/* <p className="text-sm text-gray-600">Fisher 95°: {data.fisherCone95.toFixed(1)}°</p> */}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}

                        {/* MCMC / Monte Carlo Posterior Statistics */}
                        <MCMCStatsComponent files={enhancedFiles} inline={true} />

                        {/* 4D Parameter Space Landscape */}
                        {processedData && (
                            <ParameterSpaceLandscapeComponent
                                data={processedData.data}
                                engine={processedData.engine}
                                solution={solution}
                            />
                        )}

                        {/* Integration notice */}
                        {/* <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-lg border border-purple-200">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-purple-600">🎯</span>
                                <h4 className="text-sm font-medium text-purple-800">Results Available for Visualization</h4>
                            </div>
                            <p className="text-sm text-purple-700">
                                Your stress inversion results are now available. Use the visualizations below to explore
                                the stress state, view Mohr circles, plot data on stereonets, and analyze the solution.
                            </p>
                        </div> */}

                        {/* Euler Angles and other results - same as before but condensed for space */}
                        {solution.analysis && (
                            <>
                                <div>
                                    <h4 className="text-xl font-semibold text-indigo-800">Eigenvectors</h4>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-red-50 p-4 rounded-lg">
                                            <h5 className="text-sm font-medium text-red-800 mb-2">v₁ (σ₁ direction)</h5>
                                            <div className="space-y-1 text-sm">
                                                <p><span className="font-medium">X:</span> {solution.analysis.eigenvectors[0][0].toFixed(4)}</p>
                                                <p><span className="font-medium">Y:</span> {solution.analysis.eigenvectors[0][1].toFixed(4)}</p>
                                                <p><span className="font-medium">Z:</span> {solution.analysis.eigenvectors[0][2].toFixed(4)}</p>
                                            </div>
                                        </div>
                                        <div className="bg-yellow-50 p-4 rounded-lg">
                                            <h5 className="text-sm font-medium text-yellow-800 mb-2">v₂ (σ₂ direction)</h5>
                                            <div className="space-y-1 text-sm">
                                                <p><span className="font-medium">X:</span> {solution.analysis.eigenvectors[1][0].toFixed(4)}</p>
                                                <p><span className="font-medium">Y:</span> {solution.analysis.eigenvectors[1][1].toFixed(4)}</p>
                                                <p><span className="font-medium">Z:</span> {solution.analysis.eigenvectors[1][2].toFixed(4)}</p>
                                            </div>
                                        </div>
                                        <div className="bg-blue-50 p-4 rounded-lg">
                                            <h5 className="text-sm font-medium text-blue-800 mb-2">v₃ (σ₃ direction)</h5>
                                            <div className="space-y-1 text-sm">
                                                <p><span className="font-medium">X:</span> {solution.analysis.eigenvectors[2][0].toFixed(4)}</p>
                                                <p><span className="font-medium">Y:</span> {solution.analysis.eigenvectors[2][1].toFixed(4)}</p>
                                                <p><span className="font-medium">Z:</span> {solution.analysis.eigenvectors[2][2].toFixed(4)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-xl font-semibold text-indigo-800">Euler Angles (ZXZ Convention)</h4>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-purple-50 p-4 rounded-lg text-center">
                                            <h5 className="text-sm font-medium text-purple-800 mb-2">φ (Phi)</h5>
                                            <p className="text-xl font-bold">{solution.analysis.eulerAnglesDegrees.phi.toFixed(1)}°</p>
                                        </div>
                                        <div className="bg-purple-50 p-4 rounded-lg text-center">
                                            <h5 className="text-sm font-medium text-purple-800 mb-2">θ (Theta)</h5>
                                            <p className="text-xl font-bold">{solution.analysis.eulerAnglesDegrees.theta.toFixed(1)}°</p>
                                        </div>
                                        <div className="bg-purple-50 p-4 rounded-lg text-center">
                                            <h5 className="text-sm font-medium text-purple-800 mb-2">ψ (Psi)</h5>
                                            <p className="text-xl font-bold">{solution.analysis.eulerAnglesDegrees.psi.toFixed(1)}°</p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-xl font-semibold text-indigo-800">Principal Stresses</h4>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-red-50 p-4 rounded-lg">
                                            <h5 className="text-sm font-medium text-red-800 mb-2">σ₁ (Maximum)</h5>
                                            <p className="text-lg font-bold">{solution.analysis.principalStresses.sigma1.value.toFixed(4)}</p>
                                        </div>
                                        <div className="bg-yellow-50 p-4 rounded-lg">
                                            <h5 className="text-sm font-medium text-yellow-800 mb-2">σ₂ (Intermediate)</h5>
                                            <p className="text-lg font-bold">{solution.analysis.principalStresses.sigma2.value.toFixed(4)}</p>
                                        </div>
                                        <div className="bg-blue-50 p-4 rounded-lg">
                                            <h5 className="text-sm font-medium text-blue-800 mb-2">σ₃ (Minimum)</h5>
                                            <p className="text-lg font-bold">{solution.analysis.principalStresses.sigma3.value.toFixed(4)}</p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        );
    })();

    return (
        <div >
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">


                    <FormControl variant="outlined" size="small" style={{ minWidth: 200 }}>
                        <InputLabel id="search-method-label">{CONFIG_DATA.search.display}</InputLabel>
                        <Select
                            labelId="search-method-label"
                            value={selectedMethod}
                            onChange={(e) => handleMethodChange(e.target.value as string)}
                            label={CONFIG_DATA.search.display}
                        >
                            {CONFIG_DATA.search.list.map((method) => (
                                <MenuItem
                                    key={method.name}
                                    value={method.name}
                                    disabled={!method.active}
                                >
                                    {method.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Settings button aligned with combo */}
                    <button
                        onClick={toggleSettings}
                        className={`p-2 rounded-md transition-colors ${showSettings
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
                className={`border rounded-md bg-gray-50 transition-all duration-300 ease-in-out ${showSettings
                    ? 'opacity-100 max-h-[1000px] mb-6 p-4'
                    : 'opacity-0 max-h-0 overflow-hidden p-0 m-0 border-0 mb-0'
                    }`}
            >
                <h3 className="text-lg font-medium mb-3">{selectedMethod} parameters</h3>
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
                <h3 className="text-lg font-medium mb-2">Selected data</h3>
                <div className="flex gap-2 mb-4">
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={selectAllFiles}
                        disabled={selectedFiles.length === files.length}
                    >
                        Select All
                    </Button>
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={deselectAllFiles}
                        disabled={selectedFiles.length === 0}
                    >
                        Deselect All
                    </Button>
                </div>
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

            {/* Run section */}
            <div className="mt-6 flex flex-col items-center gap-4">
                <button
                    onClick={startSimulation}
                    disabled={selectedFiles.length === 0 || isComputing}
                    className={`px-10 py-4 rounded-xl text-lg font-bold shadow-lg transition-all duration-200 flex items-center gap-3 ${
                        selectedFiles.length === 0 || isComputing
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:scale-105 active:scale-95'
                    }`}
                >
                    <Play className="w-6 h-6" />
                    {isComputing ? 'Computing...' : 'Run Inversion'}
                </button>

                {/* Info line */}
                <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="font-medium">{selectedMethod}</span>
                    <span className="text-gray-300">|</span>
                    <span>{selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected</span>
                    {simulationStatus.progress > 0 && (
                        <>
                            <span className="text-gray-300">|</span>
                            <span>{simulationStatus.status}</span>
                        </>
                    )}
                </div>

                {/* Progress bar (only visible during/after computation) */}
                {simulationStatus.progress > 0 && (
                    <div className="w-full max-w-md">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${simulationStatus.progress}%` }}
                            />
                        </div>
                        <p className="text-xs text-gray-500 text-center mt-1">{simulationStatus.progress}%</p>
                    </div>
                )}
            </div>

            {/* Results panel */}
            {resultsPanelContent}

            {/* ========== MODIFICATION 3 - PASSER LES PROPS AU StressAnalysisComponent ========== */}
            {/* Integrated Stress Analysis Visualizations */}
            {solution && (
                <StressAnalysisComponent
                    files={enhancedFiles}
                    containerWidth={1200}
                    gridCols={12}
                    rowHeight={120}
                    addButtonText="Add Analysis View"
                    dialogTitle="Add Stress Analysis Visualization"
                    showFileSelector={true}
                    // ========== NOUVEAU ==========
                    initialVisualizations={persistedVisualizations}
                    initialSelectedFile={persistedSelectedFile}
                    initialLayout={persistedLayout}
                    onVisualizationsChange={(visualizations, selectedFile, layout) => {
                        if (onSolutionChange && solution) {
                            onSolutionChange(solution, visualizations, selectedFile, layout);
                        }
                    }}
                    // ========== FIN NOUVEAU ==========
                >
                    <div className="mt-8 mb-4">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">📊</span>
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold text-gray-800">Stress Analysis Visualizations</h3>
                                <p className="text-sm text-gray-600">
                                    Explore your stress inversion results with interactive visualizations
                                </p>
                            </div>
                        </div>
                    </div>
                </StressAnalysisComponent>
            )}

            {/* Console Component */}
            <ConsoleComponent
                messages={consoleMessages}
                onClear={clearConsole}
                isOpen={isConsoleOpen}
                onToggle={toggleConsole}
                maxHeight="350px"
            />

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

            {/* Export Dialog */}
            <ExportDialog
                isOpen={showExportDialog}
                onClose={() => setShowExportDialog(false)}
                onExport={exportResults}
                solution={solution}
            />
        </div>
    );
};

export default RunComponent;