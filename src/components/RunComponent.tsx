import React from 'react';
import { Play, Settings } from 'lucide-react';
import { DataFile } from './DataFile';
import { SearchMethodFactory, SearchMethod, InverseMethod, DataFactory, getTypeOfMovementFromString, mvts } from '@alfredo-taboada/stress';
import { Message } from '@mui/icons-material';
import ErrorModal from './ErrorModal';

// Hardcoded config based on the correct structure
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

// Define types for configuration
interface ParamConfig {
    name: string;
    display: string;
    value: number;
    min: number;
    max: number;
}

interface ISearchMethod {
    name: string;
    params: ParamConfig[];
}

interface ConfigData {
    search: {
        display: string;
        type: string;
        list: ISearchMethod[];
    };
}

interface RunState {
    selectedMethod: string;
    params: Record<string, number>;
    selectedFiles: string[];
    selectedFields: Record<string, string[]>; // Maps file ID to selected field names
    simulationStatus: { status: string; progress: number };
    config: ConfigData | null;
    loading: boolean;
    showSettings: boolean;
    allParams: Record<string, Record<string, number>>;
    errorMessage: string | null;
}

interface RunProps {
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

class RunComponent extends React.Component<RunProps, RunState> {
    private stateUpdateTimeoutId: NodeJS.Timeout | null = null;
    private isUpdatingParams: boolean = false;


    private setErrorMessage = (message: string | null) => {
        this.setState({ errorMessage: message });
    };

    constructor(props: RunProps) {
        super(props);

        this.state = {
            selectedMethod: props.persistentState?.selectedMethod || '',
            params: {},
            selectedFiles: props.persistentState?.selectedFiles || [],
            selectedFields: {},
            simulationStatus: { status: 'En attente', progress: 0 },
            config: null,
            loading: true,
            showSettings: props.persistentState?.showSettings !== undefined
                ? props.persistentState.showSettings
                : true,
            allParams: props.persistentState?.allParams || {},
            errorMessage: null
        };
    }

    componentDidMount() {
        this.loadConfig();
    }

    componentDidUpdate(prevProps: RunProps, prevState: RunState) {
        // Update parent component state when our state changes - with debounce
        if (
            this.props.onStateChange &&
            this.state.selectedMethod &&
            !this.isUpdatingParams &&
            (
                prevState.selectedMethod !== this.state.selectedMethod ||
                prevState.allParams !== this.state.allParams ||
                prevState.selectedFiles !== this.state.selectedFiles ||
                prevState.showSettings !== this.state.showSettings
            )
        ) {
            // Clear any existing timeout
            if (this.stateUpdateTimeoutId) {
                clearTimeout(this.stateUpdateTimeoutId);
            }

            // Set a new timeout to update parent state after a delay
            this.stateUpdateTimeoutId = setTimeout(() => {
                if (this.props.onStateChange) {
                    this.props.onStateChange({
                        selectedMethod: this.state.selectedMethod,
                        allParams: this.state.allParams,
                        selectedFiles: this.state.selectedFiles,
                        showSettings: this.state.showSettings
                    });
                }
                this.stateUpdateTimeoutId = null;
            }, 500); // 500ms debounce
        }
    }

    componentWillUnmount() {
        if (this.stateUpdateTimeoutId) {
            clearTimeout(this.stateUpdateTimeoutId);
        }
    }

    loadConfig = async () => {
        try {
            this.setState({ loading: true });

            // Initialize parameter state for all methods
            let initialAllParams: Record<string, Record<string, number>> = {};

            // If we have persisted parameters, use them
            if (this.props.persistentState?.allParams && Object.keys(this.props.persistentState.allParams).length > 0) {
                initialAllParams = this.props.persistentState.allParams;
            } else {
                // Otherwise initialize with defaults
                configData.search.list.forEach(method => {
                    initialAllParams[method.name] = {};
                    method.params.forEach(param => {
                        initialAllParams[method.name][param.name] = param.value;
                    });
                });
            }

            // Initialize with first method or persisted method
            const initialMethod = this.props.persistentState?.selectedMethod || configData.search.list[0].name;
            const methodConfig = configData.search.list.find(m => m.name === initialMethod);

            if (methodConfig) {
                const methodParams = initialAllParams[initialMethod] || {};

                this.setState({
                    config: configData,
                    allParams: initialAllParams,
                    selectedMethod: initialMethod,
                    params: methodParams,
                    selectedFiles: this.props.persistentState?.selectedFiles || [],
                    loading: false
                });
            } else {
                this.setState({
                    config: configData,
                    allParams: initialAllParams,
                    loading: false
                });
            }
        } catch (error) {
            console.error('Error loading configuration:', error);
            this.setState({ loading: false });
        }
    };

    handleMethodChange = (methodName: string) => {
        if (!this.state.config) return;

        // Get the saved parameters for this method
        const methodParams = this.state.allParams[methodName] || {};

        this.setState({
            selectedMethod: methodName,
            params: { ...methodParams }
        });
    };

    handleParamChange = (paramName: string, value: number) => {
        // Set flag to indicate we're updating params
        this.isUpdatingParams = true;

        // First update local state for immediate feedback
        this.setState(prevState => ({
            params: {
                ...prevState.params,
                [paramName]: value
            }
        }), () => {
            // Then update the allParams store for persistence
            this.setState(prevState => ({
                allParams: {
                    ...prevState.allParams,
                    [prevState.selectedMethod]: {
                        ...prevState.allParams[prevState.selectedMethod],
                        [paramName]: value
                    }
                }
            }));

            // Reset the flag after a brief timeout to avoid immediate state updates
            setTimeout(() => {
                this.isUpdatingParams = false;
            }, 50);
        });
    };

    toggleFileSelection = (fileId: string) => {
        this.setState(prevState => {
            const isSelected = prevState.selectedFiles.includes(fileId);
            const newSelectedFiles = isSelected
                ? prevState.selectedFiles.filter(id => id !== fileId)
                : [...prevState.selectedFiles, fileId];

            return {
                selectedFiles: newSelectedFiles
            };
        });
    };

    handleToggleSettings = () => {
        this.setState(prevState => ({ showSettings: !prevState.showSettings }), () => {
            // Update the parent state directly for this change to ensure immediate persistence
            if (this.props.onStateChange) {
                this.props.onStateChange({
                    selectedMethod: this.state.selectedMethod,
                    allParams: this.state.allParams,
                    selectedFiles: this.state.selectedFiles,
                    showSettings: this.state.showSettings
                });
            }
        });
    };

    update = (message: string) => {
        const progress = parseInt(message);

        this.setState(prevState => ({
            simulationStatus: {
                status: progress < 100 ? 'En cours' : 'Terminé',
                progress
            }
        }));
    };

    startSimulation = () => {
        if (this.state.selectedFiles.length === 0) {
            // No files selected
            return;
        }

        const selectedFiles = this.getSelectedFilesData()

        this.setState({
            simulationStatus: { status: 'Running...', progress: 0 }
        });

        // Simulate progress (in a real app, this would be your actual processing)
        // =======================================================================

        const inv = new InverseMethod();

        const searchMethod: SearchMethod = SearchMethodFactory.create('Monte Carlo', {});
        searchMethod.addObserver(this)
        inv.setSearchMethod(searchMethod)

        // Add the data
        selectedFiles.forEach( file => {
            console.log(file)
            
            /*
            Need to transform this into json for Data.initilize(params)
                ['Id', ' type', ' strike', ' dip', '           Dip       DiRecTioN      ', ' Rake ', ' Strike direction', ' Type of movement']
                ['0', ' Striated Plane', ' 115', ' 90', ' N', ' 0', ' E', ' Right Lateral']
                {
                    type: headers.indexOf('type')
                }
            */

            // Create the json data according to the headers
            file.content.forEach((dataParams: any) => {
                const data = DataFactory.create(dataParams['type'])                
                data.initialize(dataParams)
                inv.addData(data)
            })
        })

        // STRESS COMPUTE here <-------------------------------
        try {
            const sol = inv.run()

            const m = sol.stressTensorSolution
            // const { values, vectors } = math.eigen([m[0][0], m[0][1], m[0][2], m[1][1], m[1][2], m[2][2]])
            // console.log('Eigen values', values)
            // console.log('Eigen vectors', vectors)
            console.log('Stress ratio', sol.stressRatio)
            console.log('Fit', Math.round((1 - sol.misfit) * 100) + '%')
            console.log('Misfit', Math.trunc(sol.misfit * 100) / 100 * 180 / Math.PI, '°')
        }
        catch (e: unknown) {
            let message = "An unknown error occurred";

            if (e instanceof Error) {
                message = e.message;
            } else if (typeof e === 'string') {
                message = e;
            }

            this.setErrorMessage(message);
        }

        // Set to complete
        this.setState({
            simulationStatus: { status: 'Terminé', progress: 100 }
        });
    };

    getSelectedFilesData = () => {
        const result: DataFile[] = []

        this.state.selectedFiles.forEach((_, index) => {
            result.push(this.props.files[index])
        });

        return result;
    };

    render() {
        const { loading, config, showSettings } = this.state;
        const { errorMessage } = this.state;


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
                                value={this.state.selectedMethod}
                                onChange={(e) => this.handleMethodChange(e.target.value)}
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
                            onClick={this.handleToggleSettings}
                            className={`p-2 rounded-md transition-colors ${showSettings ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' : 'bg-gray-100 hover:bg-gray-200'}`}
                            title={showSettings ? "Hide parameters" : "Show parameters"}
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Parameter settings panel - always rendered but conditionally visible for smooth transitions */}
                <div
                    className={`mb-6 p-4 border rounded-md bg-gray-50 transition-all duration-300 ease-in-out ${showSettings ? 'opacity-100 max-h-[1000px]' : 'opacity-0 max-h-0 overflow-hidden p-0 m-0 border-0'
                        }`}
                >
                    <h3 className="text-lg font-medium mb-3">Paramètres de {this.state.selectedMethod}</h3>
                    <div className="grid grid-cols-2 gap-4">
                        {config?.search.list
                            .find(method => method.name === this.state.selectedMethod)?.params
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
                                                value={this.state.params[param.name] ?? param.value}
                                                onChange={(e) => this.handleParamChange(param.name, parseFloat(e.target.value))}
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
                                                value={this.state.params[param.name] ?? param.value}
                                                onChange={(e) => {
                                                    const value = e.target.value === '' ? param.value : parseFloat(e.target.value);
                                                    this.handleParamChange(param.name, Math.min(Math.max(value, param.min), param.max));
                                                }}
                                                className="px-2 py-1 w-24 text-right border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>

                {/* File selection and run section */}
                <div className="mb-4">
                    <h3 className="text-lg font-medium mb-2">Sélection des données</h3>
                    <div className="space-y-2">
                        {this.props.files.length === 0 ? (
                            <div className="text-gray-500 italic">Aucun fichier disponible</div>
                        ) : (
                            this.props.files.map((file) => (
                                <div key={file.id} className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id={`file-${file.id}`}
                                        checked={this.state.selectedFiles.includes(file.id)}
                                        onChange={() => this.toggleFileSelection(file.id)}
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
                            {this.state.selectedFiles.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-4 text-sm text-gray-500 text-center italic">
                                        Sélectionnez des fichiers pour lancer l'analyse
                                    </td>
                                </tr>
                            ) : (
                                <tr>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {this.state.selectedMethod} ({this.state.selectedFiles.length} fichier{this.state.selectedFiles.length > 1 ? 's' : ''} sélectionné{this.state.selectedFiles.length > 1 ? 's' : ''})
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {this.state.simulationStatus.status}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                                            <div
                                                className="bg-blue-600 h-2.5 rounded-full"
                                                style={{ width: `${this.state.simulationStatus.progress}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-xs text-gray-500 mt-1">{this.state.simulationStatus.progress}%</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <button
                                            onClick={this.startSimulation}
                                            disabled={this.state.simulationStatus.status === 'En cours'}
                                            className={`p-2 rounded-full ${this.state.simulationStatus.status === 'En cours'
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

                <ErrorModal
                    message={errorMessage || ''}
                    isOpen={errorMessage !== null}
                    onClose={() => this.setErrorMessage(null)}
                />
            </div>
        );
    }
}

export default RunComponent;