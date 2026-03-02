import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Play, Settings, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { DataFile } from './DataFile';
import { SearchMethodFactory, SearchMethod, InverseMethod, DataFactory } from '@alfredo-taboada/stress';
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
                name: "Monte Carlo",
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
                name: "MCMC",
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
    const [showResultsPanel, setShowResultsPanel] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isComputing, setIsComputing] = useState<boolean>(false);
    const [computingMessage, setComputingMessage] = useState<string>('');
    const [computingProgress, setComputingProgress] = useState<number>(0);
    const [showExportDialog, setShowExportDialog] = useState<boolean>(false);
    const [ciLevel, setCiLevel] = useState<number>(90);

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
            const searchMethod: SearchMethod = SearchMethodFactory.create(
                selectedMethod,
                currentParams
            );

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
            console.log('[RunComponent] selectedMethod:', selectedMethod, 'is MCMC:', selectedMethod === 'MCMC');
            if (selectedMethod === 'MCMC' || selectedMethod === 'Monte Carlo') {
                const sm = inv.searchMethod;
                console.log('[RunComponent] searchMethod:', sm);
                console.log('[RunComponent] getStats exists:', typeof (sm as any).getStats);
                console.log('[RunComponent] chain length:', (sm as any).getChain?.()?.length);
                const stats = (sm as any).getStats?.();
                console.log('[RunComponent] getStats() returned:', stats);
                if (stats) {
                    mcmcStats = stats;
                    const label = selectedMethod === 'MCMC' ? 'MCMC' : 'MC top-5%';
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

                        {/* MCMC Posterior Statistics */}
                        {solution.mcmcStats && (
                            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-medium text-indigo-800">
                                        {selectedMethod === 'Monte Carlo' ? 'Monte Carlo Top-5% Statistics' : 'MCMC Posterior Statistics'}
                                    </h4>
                                    {onNavigateToHelp && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onNavigateToHelp('gui/MCMC-analysis.md');
                                            }}
                                            className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-indigo-600 bg-indigo-100 hover:bg-indigo-200 rounded transition-colors"
                                            title="Open MCMC documentation"
                                        >
                                            <HelpCircle className="w-3.5 h-3.5" />
                                            Help
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-gray-600">Acceptance Rate</p>
                                        <p className="text-lg font-semibold">{solution.mcmcStats.acceptanceRate.toFixed(1)}%</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Chain Length</p>
                                        <p className="text-lg font-semibold">{solution.mcmcStats.chainLength.toLocaleString()} samples</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Stress Ratio (posterior)</p>
                                        <p className="text-lg font-semibold">
                                            {solution.mcmcStats.stressRatio.mean.toFixed(3)} ± {solution.mcmcStats.stressRatio.std.toFixed(3)}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            90% CI: [{solution.mcmcStats.stressRatio.q05.toFixed(3)}, {solution.mcmcStats.stressRatio.q95.toFixed(3)}]
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Misfit (posterior)</p>
                                        <p className="text-lg font-semibold">
                                            {solution.mcmcStats.misfit.mean.toFixed(4)} ± {solution.mcmcStats.misfit.std.toFixed(4)}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            Min: {solution.mcmcStats.misfit.min.toFixed(4)}
                                        </p>
                                    </div>
                                </div>

                                {/* Euler angle posterior stats + CI slider + histograms */}
                                {(() => {
                                    const mcmc = solution.mcmcStats!;
                                    const dist = mcmc.distributions;
                                    const bestFitAngles = solution.analysis?.eulerAnglesDegrees;

                                    // Quantile helper: computes from raw sorted array
                                    const quantile = (sorted: number[], q: number) => {
                                        const pos = q * (sorted.length - 1);
                                        const lo = Math.floor(pos);
                                        const hi = Math.ceil(pos);
                                        return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
                                    };

                                    // Pre-sort distributions once for dynamic quantile computation
                                    const sortedDists = dist ? {
                                        stressRatio: [...dist.stressRatio].sort((a, b) => a - b),
                                        phi: [...dist.phi].sort((a, b) => a - b),
                                        theta: [...dist.theta].sort((a, b) => a - b),
                                        psi: [...dist.psi].sort((a, b) => a - b),
                                    } : undefined;

                                    const qLo = (100 - ciLevel) / 200;  // e.g. 90% -> 0.05
                                    const qHi = 1 - qLo;               // e.g. 90% -> 0.95

                                    // Dynamic CI for angles
                                    const angleDynCI = (key: 'phi' | 'theta' | 'psi') => {
                                        if (!sortedDists) {
                                            const s = mcmc.eulerAngles?.[key];
                                            return s ? { lo: s.q05, hi: s.q95 } : { lo: 0, hi: 0 };
                                        }
                                        return { lo: quantile(sortedDists[key], qLo), hi: quantile(sortedDists[key], qHi) };
                                    };

                                    // Dynamic CI for stress ratio
                                    const srCI = sortedDists
                                        ? { lo: quantile(sortedDists.stressRatio, qLo), hi: quantile(sortedDists.stressRatio, qHi) }
                                        : { lo: mcmc.stressRatio.q05, hi: mcmc.stressRatio.q95 };

                                    return (
                                        <>
                                            {/* CI slider */}
                                            <div className="mt-4 mb-2 flex items-center gap-3">
                                                <label className="text-sm font-medium text-indigo-700 whitespace-nowrap">
                                                    Credible Interval:
                                                </label>
                                                <input
                                                    type="range"
                                                    min={50}
                                                    max={99}
                                                    step={1}
                                                    value={ciLevel}
                                                    onChange={(e) => setCiLevel(parseInt(e.target.value))}
                                                    className="flex-1 h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer"
                                                />
                                                <span className="text-sm font-bold text-indigo-800 w-12 text-right">{ciLevel}%</span>
                                            </div>

                                            {/* Stress ratio CI update */}
                                            <div className="bg-blue-50 p-3 rounded-lg mb-2">
                                                <p className="text-xs font-medium text-blue-700 mb-1">Stress Ratio (posterior)</p>
                                                <p className="text-lg font-bold text-blue-900">
                                                    {mcmc.stressRatio.mean.toFixed(3)} ± {mcmc.stressRatio.std.toFixed(3)}
                                                </p>
                                                <p className="text-xs text-blue-600">
                                                    {ciLevel}% CI: [{srCI.lo.toFixed(3)}, {srCI.hi.toFixed(3)}]
                                                </p>
                                            </div>

                                            {/* Euler angle stat cards with dynamic CI */}
                                            {mcmc.eulerAngles && (
                                                <>
                                                    <h5 className="text-sm font-medium text-indigo-700 mt-3 mb-2">Euler Angles (posterior, ZXZ)</h5>
                                                    <div className="grid grid-cols-3 gap-3">
                                                        {(['phi', 'theta', 'psi'] as const).map((angle) => {
                                                            const sym = { phi: 'φ', theta: 'θ', psi: 'ψ' }[angle];
                                                            const lbl = { phi: 'Phi', theta: 'Theta', psi: 'Psi' }[angle];
                                                            const s = mcmc.eulerAngles[angle];
                                                            const ci = angleDynCI(angle);
                                                            return (
                                                                <div key={angle} className="bg-purple-50 p-3 rounded-lg">
                                                                    <p className="text-xs font-medium text-purple-700 mb-1">{sym} ({lbl})</p>
                                                                    <p className="text-lg font-bold text-purple-900">
                                                                        {s.mean.toFixed(1)}° ± {s.std.toFixed(1)}°
                                                                    </p>
                                                                    <p className="text-xs text-purple-600">
                                                                        {ciLevel}% CI: [{ci.lo.toFixed(1)}°, {ci.hi.toFixed(1)}°]
                                                                    </p>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </>
                                            )}

                                            {/* Posterior distribution histograms */}
                                            {dist && (() => {
                                                // Circular shift helper for periodic angles (period = 360°)
                                                // Computes circular mean, shifts data so the peak is centered,
                                                // and returns shifted data + offset to map back to true angles.
                                                const circularShift = (arr: number[], period = 360): { shifted: number[], offset: number } => {
                                                    const k = 2 * Math.PI / period;
                                                    const sinSum = arr.reduce((s, v) => s + Math.sin(v * k), 0);
                                                    const cosSum = arr.reduce((s, v) => s + Math.cos(v * k), 0);
                                                    const circMean = Math.atan2(sinSum, cosSum) / k; // in same units as data
                                                    // Shift so circMean maps to 0, then remap to [-period/2, period/2)
                                                    const half = period / 2;
                                                    const shifted = arr.map(v => {
                                                        let s = v - circMean;
                                                        while (s < -half) s += period;
                                                        while (s >= half) s -= period;
                                                        return s;
                                                    });
                                                    return { shifted, offset: circMean };
                                                };

                                                const histos: { data: number[]; sorted: number[]; label: string; unit: string; color: string; mean: number; bestFit?: number; periodic?: boolean }[] = [
                                                    { data: dist.stressRatio, sorted: sortedDists!.stressRatio, label: 'Stress Ratio', unit: '', color: '#3b82f6',
                                                      mean: mcmc.stressRatio.mean, bestFit: solution.stressRatio },
                                                    { data: dist.phi, sorted: sortedDists!.phi, label: 'φ (Phi)', unit: '°', color: '#8b5cf6',
                                                      mean: mcmc.eulerAngles?.phi.mean ?? 0, bestFit: bestFitAngles?.phi, periodic: true },
                                                    { data: dist.theta, sorted: sortedDists!.theta, label: 'θ (Theta)', unit: '°', color: '#a855f7',
                                                      mean: mcmc.eulerAngles?.theta.mean ?? 0, bestFit: bestFitAngles?.theta },
                                                    { data: dist.psi, sorted: sortedDists!.psi, label: 'ψ (Psi)', unit: '°', color: '#7c3aed',
                                                      mean: mcmc.eulerAngles?.psi.mean ?? 0, bestFit: bestFitAngles?.psi, periodic: true },
                                                ];
                                                return (
                                                    <div className="mt-4">
                                                        <h5 className="text-sm font-medium text-indigo-700 mb-2">Posterior Distributions</h5>
                                                        <div className="flex flex-wrap gap-4 justify-center">
                                                            {histos.map(({ data, sorted, label, unit, color, mean, bestFit, periodic }) => {
                                                                if (!data || data.length === 0) return null;

                                                                // For periodic angles, shift data so the cluster is centered
                                                                let plotData = data;
                                                                let plotMean = mean;
                                                                let plotBestFit = bestFit;
                                                                let plotCiLo = quantile(sorted, qLo);
                                                                let plotCiHi = quantile(sorted, qHi);
                                                                let shiftOffset = 0; // added back to x-axis labels

                                                                if (periodic) {
                                                                    const { shifted, offset } = circularShift(data);
                                                                    plotData = shifted;
                                                                    shiftOffset = offset;
                                                                    // Shift mean, bestFit, CI into the shifted domain
                                                                    const wrap = (v: number) => {
                                                                        let s = v - offset;
                                                                        while (s < -180) s += 360;
                                                                        while (s >= 180) s -= 360;
                                                                        return s;
                                                                    };
                                                                    plotMean = wrap(mean);
                                                                    if (plotBestFit != null) plotBestFit = wrap(plotBestFit);
                                                                    // Recompute CI from shifted+sorted data
                                                                    const shiftedSorted = [...shifted].sort((a, b) => a - b);
                                                                    plotCiLo = quantile(shiftedSorted, qLo);
                                                                    plotCiHi = quantile(shiftedSorted, qHi);
                                                                }

                                                                const W = 440, H = 240, numBins = 45;
                                                                const mn = Math.min(...plotData), mx = Math.max(...plotData);
                                                                const range = mx - mn || 1;
                                                                const bw = range / numBins;
                                                                const bins = new Array(numBins).fill(0);
                                                                for (const v of plotData) bins[Math.min(Math.floor((v - mn) / bw), numBins - 1)]++;
                                                                const maxC = Math.max(...bins);
                                                                const total = plotData.length;
                                                                const pad = { top: 22, bottom: 38, left: 44, right: 12 };
                                                                const cW = W - pad.left - pad.right, cH = H - pad.top - pad.bottom;
                                                                const barW = cW / numBins;
                                                                const yTicks = [0, Math.round(maxC / 2), maxC];
                                                                const xMid = (mn + mx) / 2;
                                                                // Format: display true angle (shifted back) for periodic, raw value otherwise
                                                                const fmtRaw = (v: number) => Math.abs(v) < 1 ? v.toFixed(3) : v.toFixed(1);
                                                                const fmt = (v: number) => {
                                                                    if (!periodic) return fmtRaw(v);
                                                                    let trueVal = v + shiftOffset;
                                                                    while (trueVal < -180) trueVal += 360;
                                                                    while (trueVal >= 180) trueVal -= 360;
                                                                    return fmtRaw(trueVal);
                                                                };
                                                                const valToX = (v: number) => pad.left + ((v - mn) / range) * cW;
                                                                const inBounds = (x: number) => x >= pad.left && x <= pad.left + cW;
                                                                const meanX = valToX(plotMean);
                                                                const ciLoX = valToX(plotCiLo);
                                                                const ciHiX = valToX(plotCiHi);
                                                                const bestX = plotBestFit != null ? valToX(plotBestFit) : undefined;
                                                                // Mode: center of the tallest bin
                                                                const modeIdx = bins.indexOf(maxC);
                                                                const modeVal = mn + (modeIdx + 0.5) * bw;
                                                                const modeX = valToX(modeVal);
                                                                return (
                                                                    <svg key={label} width={W} height={H} className="bg-white rounded-lg border border-indigo-100 shadow-sm">
                                                                        <text x={W / 2} y={15} textAnchor="middle" fontSize={13} fontWeight={700} fill="#1f2937">
                                                                            {label}{unit && ` (${unit})`}
                                                                        </text>
                                                                        {/* Y-axis */}
                                                                        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + cH} stroke="#d1d5db" strokeWidth={0.5} />
                                                                        {yTicks.map((t) => {
                                                                            const y = pad.top + cH - (maxC > 0 ? (t / maxC) * cH : 0);
                                                                            return (
                                                                                <g key={t}>
                                                                                    <line x1={pad.left - 4} y1={y} x2={pad.left} y2={y} stroke="#9ca3af" strokeWidth={0.5} />
                                                                                    <text x={pad.left - 6} y={y + 3.5} textAnchor="end" fontSize={9} fill="#6b7280">{t}</text>
                                                                                </g>
                                                                            );
                                                                        })}
                                                                        <text x={8} y={pad.top + cH / 2} textAnchor="middle" fontSize={9} fill="#9ca3af"
                                                                            transform={`rotate(-90, 8, ${pad.top + cH / 2})`}>count</text>
                                                                        {/* X-axis */}
                                                                        <line x1={pad.left} y1={pad.top + cH} x2={pad.left + cW} y2={pad.top + cH} stroke="#d1d5db" strokeWidth={0.5} />
                                                                        {/* CI shaded band */}
                                                                        {inBounds(ciLoX) && inBounds(ciHiX) && (
                                                                            <rect x={ciLoX} y={pad.top} width={ciHiX - ciLoX} height={cH}
                                                                                fill={color} opacity={0.08}>
                                                                                <title>{`${ciLevel}% CI: [${fmt(plotCiLo)}, ${fmt(plotCiHi)}]${unit}`}</title>
                                                                            </rect>
                                                                        )}
                                                                        {/* Bars */}
                                                                        {bins.map((c, i) => {
                                                                            const bH = maxC > 0 ? (c / maxC) * cH : 0;
                                                                            const binLo = mn + i * bw;
                                                                            const binHi = binLo + bw;
                                                                            const pct = total > 0 ? ((c / total) * 100).toFixed(1) : '0';
                                                                            return (
                                                                                <rect key={i}
                                                                                    x={pad.left + i * barW} y={pad.top + cH - bH}
                                                                                    width={Math.max(barW - 0.5, 0.5)} height={bH}
                                                                                    fill={color} opacity={0.7}>
                                                                                    <title>{`${fmt(binLo)} – ${fmt(binHi)}${unit}\n${c} samples (${pct}%)`}</title>
                                                                                </rect>
                                                                            );
                                                                        })}
                                                                        {/* CI boundary lines */}
                                                                        {inBounds(ciLoX) && (
                                                                            <line x1={ciLoX} y1={pad.top} x2={ciLoX} y2={pad.top + cH}
                                                                                stroke={color} strokeWidth={1} strokeDasharray="4,3" opacity={0.6} />
                                                                        )}
                                                                        {inBounds(ciHiX) && (
                                                                            <line x1={ciHiX} y1={pad.top} x2={ciHiX} y2={pad.top + cH}
                                                                                stroke={color} strokeWidth={1} strokeDasharray="4,3" opacity={0.6} />
                                                                        )}
                                                                        {/* Mean line */}
                                                                        {inBounds(meanX) && (
                                                                            <>
                                                                                <line x1={meanX} y1={pad.top} x2={meanX} y2={pad.top + cH}
                                                                                    stroke="#ef4444" strokeWidth={2} strokeDasharray="5,3" />
                                                                                <text x={meanX} y={pad.top - 4} textAnchor="middle" fontSize={9} fill="#ef4444" fontWeight={700}>
                                                                                    μ={fmtRaw(mean)}{unit}
                                                                                </text>
                                                                            </>
                                                                        )}
                                                                        {/* Best-fit marker */}
                                                                        {bestX != null && inBounds(bestX) && (
                                                                            <>
                                                                                <line x1={bestX} y1={pad.top} x2={bestX} y2={pad.top + cH}
                                                                                    stroke="#16a34a" strokeWidth={2} />
                                                                                <polygon
                                                                                    points={`${bestX - 5},${pad.top} ${bestX + 5},${pad.top} ${bestX},${pad.top + 8}`}
                                                                                    fill="#16a34a" />
                                                                            </>
                                                                        )}
                                                                        {/* Mode marker (orange diamond at top of tallest bin) */}
                                                                        {inBounds(modeX) && (
                                                                            <>
                                                                                <polygon
                                                                                    points={`${modeX},${pad.top + 2} ${modeX + 5},${pad.top + 8} ${modeX},${pad.top + 14} ${modeX - 5},${pad.top + 8}`}
                                                                                    fill="#f59e0b" stroke="#d97706" strokeWidth={0.5} />
                                                                                <line x1={modeX} y1={pad.top + 14} x2={modeX} y2={pad.top + cH}
                                                                                    stroke="#f59e0b" strokeWidth={1} strokeDasharray="2,3" opacity={0.5} />
                                                                            </>
                                                                        )}
                                                                        {/* X-axis labels */}
                                                                        <text x={pad.left} y={H - 18} textAnchor="start" fontSize={9} fill="#6b7280">{fmt(mn)}</text>
                                                                        <text x={pad.left + cW / 2} y={H - 18} textAnchor="middle" fontSize={9} fill="#6b7280">{fmt(xMid)}</text>
                                                                        <text x={pad.left + cW} y={H - 18} textAnchor="end" fontSize={9} fill="#6b7280">{fmt(mx)}</text>
                                                                        <text x={pad.left + cW / 2} y={H - 4} textAnchor="middle" fontSize={10} fill="#6b7280">
                                                                            {label}{unit && ` (${unit})`}
                                                                        </text>
                                                                        {/* Legend */}
                                                                        <g transform={`translate(${pad.left + cW - 130}, ${pad.top + 4})`}>
                                                                            <line x1={0} y1={4} x2={14} y2={4} stroke="#16a34a" strokeWidth={2} />
                                                                            <text x={18} y={7} fontSize={8} fill="#374151">Best fit</text>
                                                                            <line x1={0} y1={16} x2={14} y2={16} stroke="#ef4444" strokeWidth={2} strokeDasharray="4,2" />
                                                                            <text x={18} y={19} fontSize={8} fill="#374151">Mean (μ)</text>
                                                                            <polygon points="7,24 12,28 7,32 2,28" fill="#f59e0b" stroke="#d97706" strokeWidth={0.5} />
                                                                            <text x={18} y={31} fontSize={8} fill="#374151">Mode (peak)</text>
                                                                            <rect x={0} y={36} width={14} height={8} fill={color} opacity={0.15} stroke={color} strokeWidth={0.5} strokeDasharray="3,2" />
                                                                            <text x={18} y={43} fontSize={8} fill="#374151">{ciLevel}% CI</text>
                                                                        </g>
                                                                    </svg>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </>
                                    );
                                })()}
                            </div>
                        )}

                        {/* Integration notice */}
                        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-lg border border-purple-200">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-purple-600">🎯</span>
                                <h4 className="text-sm font-medium text-purple-800">Results Available for Visualization</h4>
                            </div>
                            <p className="text-sm text-purple-700">
                                Your stress inversion results are now available. Use the visualizations below to explore
                                the stress state, view Mohr circles, plot data on stereonets, and analyze the solution.
                            </p>
                        </div>

                        {/* Euler Angles and other results - same as before but condensed for space */}
                        {solution.analysis && (
                            <>
                                <div>
                                    <h4 className="text-base font-medium mb-3">Eigenvectors</h4>
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
                                    <h4 className="text-base font-medium mb-3">Euler Angles (ZXZ Convention)</h4>
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
                                    <h4 className="text-base font-medium mb-3">Principal Stresses</h4>
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
                    ...(solution.mcmcStats.distributions ? [
                        { parameter: 'mcmc_dist_stress_ratio', value: JSON.stringify(solution.mcmcStats.distributions.stressRatio), unit: 'json' },
                        { parameter: 'mcmc_dist_phi', value: JSON.stringify(solution.mcmcStats.distributions.phi), unit: 'json' },
                        { parameter: 'mcmc_dist_theta', value: JSON.stringify(solution.mcmcStats.distributions.theta), unit: 'json' },
                        { parameter: 'mcmc_dist_psi', value: JSON.stringify(solution.mcmcStats.distributions.psi), unit: 'json' },
                    ] : [])
                ] : [])
            ],
            layout: { x: 0, y: 0, w: 6, h: 3 }
        };

        return [...files, resultsFile];
    }, [files, solution]);

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