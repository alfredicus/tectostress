import React, { useState } from 'react';
import { Play, HelpCircle, Settings } from 'lucide-react';
import HelpComponent from './HelpComponent';
import RunComponent from './RunComponent';
import DataComponent from './DataComponent';
import { DataFile } from './DataFile';
import { 
    VisualizationRegistry, 
    VisualizationContext,
    VisualizationMigrationHelper 
} from './VisualizationTypeRegistry';
import { 
    ThemeProvider, 
    useTheme, 
    ThemeToggle, 
    QuickThemeToggle,
    useThemeClasses 
} from './ThemeContext';

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
    showSettings?: boolean;
}

// Main Interface Component (wrapped with theme)
const MainInterfaceContent = () => {
    const [activeTab, setActiveTab] = useState('data');
    const [loadedFiles, setLoadedFiles] = useState<DataFile[]>([]);
    const [showThemeSettings, setShowThemeSettings] = useState(false);
    
    // Theme integration
    const { theme, isDark, isLight } = useTheme();

    // Add state for persisting run component state
    const [runState, setRunState] = useState<RunPersistentState>({
        selectedMethod: '',
        allParams: {},
        selectedFiles: [],
        showSettings: true
    });

    // Theme-aware classes
    const containerClasses = useThemeClasses({
        base: 'min-h-screen transition-colors duration-200',
        light: 'bg-gray-50',
        dark: 'bg-gray-900'
    });

    const headerClasses = useThemeClasses({
        base: 'text-center py-6 transition-colors duration-200',
        light: 'text-gray-800',
        dark: 'text-gray-100'
    });

    const cardClasses = useThemeClasses({
        base: 'rounded-lg shadow-lg mt-4 w-full transition-colors duration-200',
        light: 'bg-white border border-gray-200',
        dark: 'bg-gray-800 border border-gray-700'
    });

    const tabClasses = useThemeClasses({
        base: 'border-b transition-colors duration-200',
        light: 'border-gray-200 bg-white',
        dark: 'border-gray-700 bg-gray-800'
    });

    // Initialize custom visualization contexts for the application
    React.useEffect(() => {
        // Example: Create a custom context for advanced geological analysis
        VisualizationMigrationHelper.createCombinedContext(
            'geological_analysis',
            [VisualizationContext.DATA_ANALYSIS, VisualizationContext.STRESS_ANALYSIS]
        );

        // Example: Register a custom context for specific workflow
        const customWorkflowTypes = [
            ...VisualizationRegistry.getVisualizationTypes(VisualizationContext.DATA_ANALYSIS),
            {
                id: 'custom_analysis',
                title: 'Custom Analysis',
                icon: ({ size = 24, className = "" }) => (
                    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                        <path d="M8 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="1" opacity="0.5" />
                    </svg>
                ),
                defaultLayout: { w: 8, h: 6 }
            }
        ];

        VisualizationRegistry.registerCustomContext('custom_workflow', customWorkflowTypes);
    }, []);

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

    // Handle Run component state persistence
    const handleRunStateChange = (newState: RunPersistentState) => {
        setRunState(newState);
    };

    const doc_name = "documentation";

    return (
        <div className={containerClasses}>
            <div className="container mx-auto px-4">
                <div className="max-w-[98%] w-full mx-auto">
                    {/* Enhanced Header with Theme Controls */}
                    <div className={headerClasses}>
                        <div className="flex justify-between items-start mb-4">
                            {/* Logo and Title */}
                            <div className="flex gap-4">
                                {/* Dynamic Logo based on theme */}
                                <svg width="48" height="48" viewBox="0 0 48 48" className="text-blue-600 dark:text-blue-400">
                                    <defs>
                                        <linearGradient id="stressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor={isDark ? "#60a5fa" : "#3B82F6"} />
                                            <stop offset="100%" stopColor={isDark ? "#3b82f6" : "#1D4ED8"} />
                                        </linearGradient>
                                    </defs>
                                    {/* Stress field representation */}
                                    <circle cx="24" cy="24" r="18" fill="none" stroke="url(#stressGradient)" strokeWidth="2" opacity="0.3" />
                                    <circle cx="24" cy="24" r="12" fill="none" stroke="url(#stressGradient)" strokeWidth="2" opacity="0.5" />
                                    <circle cx="24" cy="24" r="6" fill="url(#stressGradient)" opacity="0.8" />

                                    {/* Stress direction arrows */}
                                    <g stroke="url(#stressGradient)" strokeWidth="2.5" strokeLinecap="round">
                                        <line x1="6" y1="24" x2="14" y2="24" markerEnd="url(#arrowhead)" />
                                        <line x1="42" y1="24" x2="34" y2="24" markerEnd="url(#arrowhead)" />
                                        <line x1="24" y1="6" x2="24" y2="14" markerEnd="url(#arrowhead)" />
                                        <line x1="24" y1="42" x2="24" y2="34" markerEnd="url(#arrowhead)" />
                                    </g>

                                    <defs>
                                        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                            <polygon points="0 0, 10 3.5, 0 7" fill="url(#stressGradient)" />
                                        </marker>
                                    </defs>
                                </svg>

                                <div>
                                    <h1 className="text-4xl font-bold">
                                        <a 
                                            href="https://github.com/alfredicus/tectostress" 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors"
                                        >
                                            Tectostress
                                        </a>
                                        <span className={useThemeClasses({
                                            base: "text-2xl font-normal ml-2",
                                            light: "text-gray-600",
                                            dark: "text-gray-400"
                                        })}>
                                            v2.0 (
                                            <a 
                                                href="https://www.gm.umontpellier.fr/" 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline transition-colors"
                                            >
                                                Geosciences Montpellier
                                            </a>
                                            )
                                        </span>
                                    </h1>
                                </div>
                            </div>

                            {/* Theme Controls */}
                            <div className="flex items-center gap-2">
                                {/* Quick Theme Toggle */}
                                <QuickThemeToggle />
                                
                                {/* Theme Settings Button */}
                                <button
                                    onClick={() => setShowThemeSettings(!showThemeSettings)}
                                    className={useThemeClasses({
                                        base: "p-2 rounded-lg transition-all duration-200",
                                        light: "bg-gray-100 text-gray-600 hover:text-gray-900 hover:bg-gray-200",
                                        dark: "bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                                    })}
                                    title="Theme Settings"
                                >
                                    <Settings size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Theme Settings Panel */}
                        {showThemeSettings && (
                            <div className={useThemeClasses({
                                base: "mb-4 p-4 rounded-lg border transition-all duration-200",
                                light: "bg-gray-50 border-gray-200",
                                dark: "bg-gray-800 border-gray-700"
                            })}>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className={useThemeClasses({
                                        base: "text-lg font-semibold",
                                        light: "text-gray-800",
                                        dark: "text-gray-200"
                                    })}>
                                        Theme Settings
                                    </h3>
                                    <button
                                        onClick={() => setShowThemeSettings(false)}
                                        className={useThemeClasses({
                                            base: "text-sm px-3 py-1 rounded transition-colors",
                                            light: "text-gray-600 hover:text-gray-800",
                                            dark: "text-gray-400 hover:text-gray-200"
                                        })}
                                    >
                                        Close
                                    </button>
                                </div>
                                
                                <div className="flex flex-col items-center gap-4">
                                    <ThemeToggle />
                                    <div className={useThemeClasses({
                                        base: "text-sm",
                                        light: "text-gray-600",
                                        dark: "text-gray-400"
                                    })}>
                                        Choose your preferred color scheme. System will automatically match your OS preference.
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Subtitle */}
                        <div className={useThemeClasses({
                            base: "text-sm mt-2",
                            light: "text-gray-500",
                            dark: "text-gray-400"
                        })}>
                            Enhanced with integrated visualizations and parameterized analysis workflows
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className={tabClasses}>
                        <nav className="flex -mb-px">
                            {['data', 'run', doc_name].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`py-2 px-4 font-medium transition-colors duration-200 ${
                                        activeTab === tab
                                            ? `border-b-2 border-blue-500 ${isDark ? 'text-blue-400' : 'text-blue-600'}`
                                            : `${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        {tab === 'run' && <Play className="w-4 h-4" />}
                                        {tab === doc_name && <HelpCircle className="w-4 h-4" />}
                                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                    </div>
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Enhanced status indicator */}
                    <div className="mt-2 mb-4 flex items-center justify-between">
                        <div className={useThemeClasses({
                            base: "flex items-center gap-4 text-sm",
                            light: "text-gray-600",
                            dark: "text-gray-400"
                        })}>
                            <span>Files: {loadedFiles.length}</span>
                            {activeTab === 'data' && (
                                <span>Available visualizations: {VisualizationRegistry.getVisualizationTypes(VisualizationContext.DATA_ANALYSIS).length}</span>
                            )}
                            {activeTab === 'run' && (
                                <span>Analysis visualizations: {VisualizationRegistry.getVisualizationTypes(VisualizationContext.STRESS_ANALYSIS).length}</span>
                            )}
                            <span className="flex items-center gap-1">
                                Theme: <span className={`w-2 h-2 rounded-full ${isDark ? 'bg-blue-400' : 'bg-yellow-400'}`}></span> {isDark ? 'Dark' : 'Light'}
                            </span>
                        </div>
                        
                        {/* Quick info about available contexts */}
                        <div className={useThemeClasses({
                            base: "text-xs",
                            light: "text-gray-400",
                            dark: "text-gray-500"
                        })}>
                            Contexts: {VisualizationRegistry.getAllContexts().length} available
                        </div>
                    </div>

                    {/* Content */}
                    <div className={cardClasses}>
                        {activeTab === 'data' && (
                            <div className="p-6">
                                <div className={useThemeClasses({
                                    base: "mb-4 p-4 rounded-lg border transition-colors duration-200",
                                    light: "bg-blue-50 border-blue-200",
                                    dark: "bg-blue-900/20 border-blue-800/50"
                                })}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={isDark ? 'text-blue-400' : 'text-blue-600'}>📊</span>
                                        <h3 className={useThemeClasses({
                                            base: "font-semibold",
                                            light: "text-blue-800",
                                            dark: "text-blue-300"
                                        })}>
                                            Enhanced Data Analysis
                                        </h3>
                                    </div>
                                    <p className={useThemeClasses({
                                        base: "text-sm",
                                        light: "text-blue-700",
                                        dark: "text-blue-200"
                                    })}>
                                        Upload your geological data files and create interactive visualizations directly in this tab. 
                                        Rose diagrams, histograms, stereonets, and Mohr circles are automatically integrated below your data tables.
                                    </p>
                                </div>

                                <DataComponent
                                    files={loadedFiles}
                                    onFileLoaded={handleFileLoaded}
                                    onFileRemoved={handleFileRemoved}
                                />
                            </div>
                        )}

                        {activeTab === 'run' && (
                            <div className="p-6">
                                <div className={useThemeClasses({
                                    base: "mb-4 p-4 rounded-lg border transition-colors duration-200",
                                    light: "bg-purple-50 border-purple-200",
                                    dark: "bg-purple-900/20 border-purple-800/50"
                                })}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={isDark ? 'text-purple-400' : 'text-purple-600'}>⚡</span>
                                        <h3 className={useThemeClasses({
                                            base: "font-semibold",
                                            light: "text-purple-800",
                                            dark: "text-purple-300"
                                        })}>
                                            Integrated Stress Inversion
                                        </h3>
                                    </div>
                                    <p className={useThemeClasses({
                                        base: "text-sm",
                                        light: "text-purple-700",
                                        dark: "text-purple-200"
                                    })}>
                                        Run stress inversion analysis and immediately visualize results with specialized tools. 
                                        Mohr circles, solution plots, and data stereonets are automatically available after computation.
                                    </p>
                                </div>

                                <RunComponent
                                    files={loadedFiles}
                                    persistentState={runState}
                                    onStateChange={handleRunStateChange}
                                />
                            </div>
                        )}

                        {activeTab === doc_name && (
                            <HelpComponent />
                        )}
                    </div>

                    {/* Enhanced footer with system information */}
                    <div className={useThemeClasses({
                        base: "mt-8 pb-6 text-center text-xs border-t pt-4 transition-colors duration-200",
                        light: "text-gray-400 border-gray-200",
                        dark: "text-gray-500 border-gray-700"
                    })}>
                        <div className="flex items-center justify-center gap-6">
                            <span>Tectostress v2.0 - Enhanced Visualization System</span>
                            <span>•</span>
                            <span>Parameterized Analysis Workflows</span>
                            <span>•</span>
                            <span>Integrated Data Exploration</span>
                            <span>•</span>
                            <span>Dark/Light Theme Support</span>
                        </div>
                        <div className="mt-2">
                            <span>Available visualization contexts: </span>
                            {VisualizationRegistry.getAllContexts().map((context, index) => (
                                <span key={context} className={isDark ? 'text-blue-400' : 'text-blue-500'}>
                                    {context}
                                    {index < VisualizationRegistry.getAllContexts().length - 1 ? ', ' : ''}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Main Interface with Theme Provider
const MainInterface = () => {
    return (
        <ThemeProvider defaultMode="system" storageKey="tectostress-theme">
            <MainInterfaceContent />
        </ThemeProvider>
    );
};

export default MainInterface;