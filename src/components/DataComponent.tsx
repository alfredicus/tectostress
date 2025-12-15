import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
    Table, TableHead, TableBody,
    TableRow, TableCell, Button, Typography, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { Plus, X, GripHorizontal, CheckSquare, Square, Upload, Eye, BarChart3 } from 'lucide-react';
import GridLayout, { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { DataFile } from './DataFile';
import { processCSV, ProcessCSVReturnType } from '../io/CSVParsing';
import {
    useVisualizationManager,
    AddVisualizationDialog,
    VisualizationGrid,
    DATA_VISUALIZATIONS
} from './VisualizationManager';
import { ConsoleComponent, ConsoleMessage } from './ConsoleComponent';
import { AddDataDialog } from './AddDataDialog';
import { useTheme, useThemeClasses } from './ThemeContext';

import { matelles } from './data/matelles';
import { synthetic_1 } from './data/synthetic-1';
import { synthetic_2 } from './data/synthetic-2';
import { synthetic_faults } from './data/synthetic-faults';

interface DataComponentProps {
    files: DataFile[];
    onFileLoaded: (file: DataFile) => void;
    onFileRemoved: (fileId: string) => void;
    persistedVisualizations?: any[];
    persistedSelectedFile?: string | null;
    persistedLayout?: { [key: string]: any };
    onVisualizationsChange?: (
        visualizations: any[],
        selectedFile: string | null,
        layout: { [key: string]: any }
    ) => void;
}

const DataComponent: React.FC<DataComponentProps> = ({
    files,
    onFileLoaded,
    onFileRemoved,
    persistedVisualizations = [],
    persistedSelectedFile = null,
    persistedLayout = {},
    onVisualizationsChange
}) => {
    // ============================================================================
    // ✅ STEP 1: ALL STATE HOOKS
    // ============================================================================
    const fileInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
    const [selectAll, setSelectAll] = useState(false);
    const [containerWidth, setContainerWidth] = useState<number>(1400);
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [isAddDataDialogOpen, setIsAddDataDialogOpen] = useState(false);
    const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
    const [isConsoleOpen, setIsConsoleOpen] = useState<boolean>(false);
    const [isChangingModel, setIsChangingModel] = useState(false);

    // ============================================================================
    // ✅ STEP 2: CONTEXT HOOKS
    // ============================================================================
    const { isDark } = useTheme();

    // ============================================================================
    // ✅ STEP 3: ALL useThemeClasses HOOKS - CALLED IN SAME ORDER EVERY RENDER
    // ============================================================================
    // Selection header button
    const selectAllButtonClasses = useThemeClasses({
        base: 'flex items-center gap-2 transition-colors',
        light: 'text-gray-700 hover:text-blue-600',
        dark: 'text-gray-300 hover:text-blue-400'
    });

    // Selection counter text
    const selectionCounterClasses = useThemeClasses({
        base: 'text-sm',
        light: 'text-gray-500',
        dark: 'text-gray-400'
    });

    // Current model display text
    const currentModelClasses = useThemeClasses({
        base: 'text-sm font-medium',
        light: 'text-blue-600',
        dark: 'text-blue-400'
    });

    // File card container
    const fileCardClasses = useThemeClasses({
        base: 'border rounded-md shadow-sm overflow-hidden',
        light: 'border-gray-200 bg-white',
        dark: 'border-gray-700 bg-gray-800'
    });

    // File card header
    const fileCardHeaderClasses = useThemeClasses({
        base: 'flex items-center justify-between p-2 border-b',
        light: 'bg-gray-50 border-gray-200',
        dark: 'bg-gray-700 border-gray-600'
    });

    // Drag handle
    const dragHandleClasses = useThemeClasses({
        base: 'drag-handle cursor-move p-1 rounded transition-colors',
        light: 'hover:bg-gray-200 text-gray-400',
        dark: 'hover:bg-gray-600 text-gray-500'
    });

    // Icon buttons (chart, remove)
    const fileIconButtonClasses = useThemeClasses({
        base: 'p-1 transition-colors',
        light: 'text-gray-400 hover:text-blue-500',
        dark: 'text-gray-500 hover:text-blue-400'
    });

    const fileRemoveButtonClasses = useThemeClasses({
        base: 'p-1 transition-colors',
        light: 'text-gray-400 hover:text-red-500',
        dark: 'text-gray-500 hover:text-red-400'
    });

    // Table styles
    const tableHeaderCellClasses = useThemeClasses({
        base: 'font-bold whitespace-nowrap sticky top-0 z-1',
        light: 'bg-gray-100 text-gray-900 border-gray-200',
        dark: 'bg-gray-700 text-gray-100 border-gray-600'
    });

    const tableBodyCellClasses = useThemeClasses({
        base: 'whitespace-nowrap',
        light: 'text-gray-900 bg-white border-gray-200',
        dark: 'text-gray-100 bg-gray-800 border-gray-700'
    });

    const tableRowHoverClasses = isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50';

    // Container
    const containerClasses = useThemeClasses({
        base: 'p-6',
        light: 'bg-gray-50',
        dark: 'bg-gray-900'
    });

    // ============================================================================
    // ✅ STEP 4: OTHER HOOKS AND CALLBACKS
    // ============================================================================
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

    // Use the visualization manager hook with DATA_VISUALIZATIONS
    const vizManagerKey = useMemo(() =>
        `dataViz-${persistedVisualizations?.length || 0}-${persistedSelectedFile || 'none'}`,
        [persistedVisualizations?.length, persistedSelectedFile]
    );

    const {
        visualizations,
        isDialogOpen,
        selectedFileForView,
        openAddDialog,
        closeAddDialog,
        createVisualization,
        setSelectedFileForView,
        handleVisualizationRemoved,
        handleVisualizationLayoutChanged,
        handleVisualizationStateChanged
    } = useVisualizationManager({
        files,
        availableTypes: DATA_VISUALIZATIONS,
        initialVisualizations: persistedVisualizations,
        initialSelectedFile: persistedSelectedFile,
        initialLayout: persistedLayout,
        _reinitKey: vizManagerKey
    });

    // ============================================================================
    // ✅ STEP 5: EFFECT HOOKS
    // ============================================================================
    // Synchronize persisted visualizations when they change (e.g., when switching tabs)
    useEffect(() => {
        if (persistedVisualizations && persistedVisualizations.length > 0) {
            const currentVizsString = JSON.stringify(visualizations.map(v => v.id));
            const persistedVizsString = JSON.stringify(persistedVisualizations.map((v: any) => v.id));

            if (currentVizsString !== persistedVizsString) {
                console.log('Restoring persisted visualizations:', persistedVisualizations.length);
            }
        }
    }, [persistedVisualizations?.length]);

    useEffect(() => {
        if (onVisualizationsChange) {
            const layoutData = visualizations.reduce((acc, viz) => {
                if (viz.id && viz.layout) {
                    acc[viz.id] = viz.layout;
                }
                return acc;
            }, {} as { [key: string]: any });
        }
    }, [visualizations, selectedFileForView, onVisualizationsChange]);

    useEffect(() => {
        const validFileIds = new Set(files.map(f => f.id));

        if (selectedFileForView && !validFileIds.has(selectedFileForView)) {
            console.warn('Persisted file not found, resetting:', selectedFileForView);
            setSelectedFileForView(null);
        }

        const hasInvalidVisualizations = visualizations.some(
            viz => viz.fileId && !validFileIds.has(viz.fileId)
        );

        if (hasInvalidVisualizations) {
            console.warn('Found visualizations with invalid files');
        }
    }, [files, visualizations, selectedFileForView, setSelectedFileForView]);

    useEffect(() => {
        if (files.length === 0 && visualizations.length > 0) {
            console.log('Files cleared, resetting visualizations');
            if (onVisualizationsChange) {
                onVisualizationsChange([], null, {});
            }
        }
    }, [files.length, visualizations.length, onVisualizationsChange]);

    // Measure container width for responsive grid
    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                const newWidth = containerRef.current.clientWidth;
                setContainerWidth(newWidth);
            }
        };

        updateWidth();

        const resizeObserver = new ResizeObserver(updateWidth);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    // Clear console when no files remain
    useEffect(() => {
        if (files.length === 0 && !isChangingModel) {
            setSelectedModel('');
        }
        if (files.length === 0) {
            clearConsole();
            setIsConsoleOpen(false);
        }
    }, [files.length, clearConsole]);

    // ============================================================================
    // ✅ STEP 6: EVENT HANDLERS AND FUNCTIONS
    // ============================================================================
    // Model definitions with multiple examples each
    const MODELS = {
        synthetic_1,
        synthetic_2,
        synthetic_faults,
        matelles
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = event.target.files;
        if (!fileList || fileList.length === 0) return;

        const filesArray = Array.from(fileList);

        filesArray.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const retType: ProcessCSVReturnType = processCSV(e.target?.result as string);

                    if (!retType || !retType.data || !Array.isArray(retType.data)) {
                        addConsoleMessage('error', `Invalid data structure from file: ${file.name}`);
                        return;
                    }

                    const filesCount = files.length;
                    const row = Math.floor((filesCount + index) / 2);
                    const col = (filesCount + index) % 2;
                    const position = { x: col * 2, y: row * 2 };

                    const newFile: DataFile = {
                        id: `file-${Date.now()}-${index}`,
                        name: file.name,
                        headers: retType.headers || [],
                        content: retType.data || [],
                        layout: { ...position, w: 4, h: 2 }
                    };

                    onFileLoaded(newFile);
                    addConsoleMessage('info', `File ${file.name} uploaded successfully with ${retType.data.length} rows.`);
                } catch (error) {
                    addConsoleMessage('error', `Error processing file ${file.name}`, error instanceof Error ? error.message : String(error));
                }
            };

            reader.onerror = (error) => {
                addConsoleMessage('error', `Error reading file ${file.name}`, error instanceof Error ? error.message : String(error));
            };

            reader.readAsText(file);
        });

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleAddDataFromDialog = useCallback((newFile: DataFile) => {
        const filesCount = files.length;
        const row = Math.floor(filesCount / 2);
        const col = filesCount % 2;
        const position = { x: col * 2, y: row * 2 };

        const positionedFile: DataFile = {
            ...newFile,
            layout: { ...position, w: 4, h: 2 }
        };

        onFileLoaded(positionedFile);
        addConsoleMessage('info', `Manual data "${newFile.name}" added successfully.`);
    }, [files.length, onFileLoaded, addConsoleMessage]);

    const handleLayoutChange = (layout: Layout[]) => {
        layout.forEach(newLayout => {
            const file = files.find(f => f.id === newLayout.i);
            if (file) {
                const updatedFile = {
                    ...file,
                    layout: {
                        x: newLayout.x,
                        y: newLayout.y,
                        w: newLayout.w,
                        h: newLayout.h
                    }
                };
                onFileLoaded(updatedFile);
            }
        });
    };

    const toggleSelectFile = (fileId: string) => {
        setSelectedFiles(prev => {
            if (prev.includes(fileId)) {
                return prev.filter(id => id !== fileId);
            } else {
                return [...prev, fileId];
            }
        });
    };

    const toggleSelectAll = () => {
        if (selectAll || selectedFiles.length === files.length) {
            setSelectedFiles([]);
            setSelectAll(false);
        } else {
            setSelectedFiles(files.map(file => file.id));
            setSelectAll(true);
        }
    };

    const deleteSelectedFiles = () => {
        selectedFiles.forEach(fileId => onFileRemoved(fileId));
        setSelectedFiles([]);
        setSelectAll(false);
    };

    const clearAllFiles = () => {
        files.forEach(file => onFileRemoved(file.id));
        setSelectedFiles([]);
        setSelectAll(false);
        clearConsole();
    };

    const handleModelChange = (event: any) => {
        const modelKey = event.target.value;
        setSelectedModel(modelKey);
        setIsChangingModel(true);

        if (!modelKey) return;

        clearAllFiles();
        setConsoleMessages([]);

        const model = MODELS[modelKey as keyof typeof MODELS];
        if (!model) return;

        const exampleKeys = Object.keys(model.examples);

        setTimeout(() => {
            exampleKeys.forEach((exampleKey, index) => {
                const dataset = model.examples[exampleKey as keyof typeof model.examples];

                try {
                    const retType: ProcessCSVReturnType = processCSV(dataset.csv);

                    if (!retType || !retType.data || !Array.isArray(retType.data)) {
                        addConsoleMessage('error', `Invalid data structure from example: ${dataset.name}`);
                        return;
                    }

                    const row = Math.floor(index / 2);
                    const col = index % 2;
                    const position = { x: col * 2, y: row * 2 };

                    const newFile: DataFile = {
                        id: `${modelKey}-${exampleKey}-${Date.now()}`,
                        name: dataset.name,
                        headers: retType.headers || [],
                        content: retType.data || [],
                        layout: { ...position, w: 4, h: 2 }
                    };

                    addConsoleMessage('info', `Successfully loaded "${dataset.name}" with ${retType.data.length} data from model "${model.name}".`);

                    onFileLoaded(newFile);
                } catch (error) {
                    addConsoleMessage('error', `Error processing example ${dataset.name}`, error instanceof Error ? error.message : String(error));
                }
            });

            setIsChangingModel(false);
        }, 100);
    };

    // ============================================================================
    // ✅ STEP 7: JSX RENDERING
    // ============================================================================
    return (
        <div ref={containerRef} className={containerClasses}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".csv,.col"
                        multiple
                    />

                    {/* Upload Files button */}
                    <Button
                        variant="contained"
                        startIcon={<Upload size={20} />}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        UPLOAD FILES
                    </Button>

                    {/* Create button */}
                    <Button
                        disabled
                        variant="outlined"
                        startIcon={<Plus size={20} />}
                        onClick={() => setIsAddDataDialogOpen(true)}
                    >
                        CREATE...
                    </Button>

                    {/* Model Selection Dropdown */}
                    <FormControl variant="outlined" size="small" style={{ minWidth: 120 }}>
                        <InputLabel id="model-select-label">Examples</InputLabel>
                        <Select
                            labelId="model-select-label"
                            value={selectedModel}
                            onChange={handleModelChange}
                            label="Examples"
                        >
                            <MenuItem value="">
                                <em>None</em>
                            </MenuItem>
                            {Object.entries(MODELS).map(([key, model]) => (
                                <MenuItem key={key} value={key}>
                                    {model.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </div>

                <div className="flex items-center gap-2">
                    {/* Add View button */}
                    {files.length > 0 && (
                        <Button
                            variant="outlined"
                            startIcon={<Eye size={20} />}
                            onClick={() => openAddDialog()}
                        >
                            Add View
                        </Button>
                    )}

                    {/* Delete Selected button */}
                    {selectedFiles.length > 0 && (
                        <Button
                            variant="outlined"
                            color="error"
                            onClick={deleteSelectedFiles}
                        >
                            Delete Selected ({selectedFiles.length})
                        </Button>
                    )}
                </div>
            </div>

            {/* Selection header */}
            {files.length > 0 && (
                <div className="flex items-center mb-4 gap-4">
                    <button
                        onClick={toggleSelectAll}
                        className={selectAllButtonClasses}
                    >
                        {selectAll || selectedFiles.length === files.length ? (
                            <CheckSquare className="w-5 h-5 text-blue-500" />
                        ) : (
                            <Square className="w-5 h-5" />
                        )}
                        <span>{selectAll ? "Deselect All" : "Select All"}</span>
                    </button>

                    <div className={selectionCounterClasses}>
                        {selectedFiles.length > 0
                            ? `${selectedFiles.length} of ${files.length} selected. Model loaded: ${selectedModel ? MODELS[selectedModel as keyof typeof MODELS]?.name : 'None'}`
                            : `${files.length} files total.`}
                    </div>

                    {selectedModel && (
                        <div className={currentModelClasses}>
                            Current Model: {MODELS[selectedModel as keyof typeof MODELS]?.name}
                        </div>
                    )}
                </div>
            )}

            {/* Data Files Grid */}
            {files.length > 0 && (
                <div className="mb-8">
                    <GridLayout
                        className="layout"
                        layout={files.map(file => ({
                            i: file.id,
                            x: file.layout.x,
                            y: file.layout.y,
                            w: file.layout.w,
                            h: file.layout.h,
                            isDraggable: true
                        }))}
                        cols={4}
                        rowHeight={150}
                        width={containerWidth}
                        onLayoutChange={handleLayoutChange}
                        draggableHandle=".drag-handle"
                        isResizable={false}
                    >
                        {files.map((file) => (
                            <div
                                key={file.id}
                                className={`${fileCardClasses} ${selectedFiles.includes(file.id) ? 'ring-2 ring-blue-500' : ''}`}
                            >
                                <div className={fileCardHeaderClasses}>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => toggleSelectFile(file.id)}
                                            className="flex items-center justify-center w-5 h-5"
                                        >
                                            {selectedFiles.includes(file.id) ? (
                                                <CheckSquare className="w-5 h-5 text-blue-500" />
                                            ) : (
                                                <Square className="w-5 h-5 text-gray-400" />
                                            )}
                                        </button>
                                        <div className={dragHandleClasses}>
                                            <GripHorizontal size={20} />
                                        </div>
                                        <Typography variant="subtitle1">{file.name}</Typography>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => openAddDialog(file.id)}
                                            className={fileIconButtonClasses}
                                            title="Create visualization from this file"
                                        >
                                            <BarChart3 size={16} />
                                        </button>
                                        <button
                                            onClick={() => onFileRemoved(file.id)}
                                            className={fileRemoveButtonClasses}
                                            title="Remove file"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div className="p-4 h-[calc(100%-3rem)] flex flex-col overflow-hidden">
                                    <div className="overflow-auto flex-1">
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    {file.headers.map((header, index) => (
                                                        <TableCell
                                                            key={index}
                                                            style={{
                                                                fontWeight: 'bold',
                                                                whiteSpace: 'nowrap',
                                                                backgroundColor: isDark ? '#374151' : '#f3f4f6',
                                                                color: isDark ? '#f1f5f9' : '#1f2937',
                                                                position: 'sticky',
                                                                top: 0,
                                                                zIndex: 1
                                                            }}
                                                        >
                                                            {header}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {file.content.map((row: any, rowIndex: number) => (
                                                    <TableRow
                                                        key={rowIndex}
                                                        hover
                                                        style={{
                                                            backgroundColor: isDark ? '#1f2937' : '#ffffff'
                                                        }}
                                                    >
                                                        {Object.entries(row).map(([name, value]) => (
                                                            <TableCell
                                                                key={name}
                                                                style={{
                                                                    whiteSpace: 'nowrap',
                                                                    color: isDark ? '#e2e8f0' : '#1f2937',
                                                                    backgroundColor: isDark ? '#1f2937' : '#ffffff'
                                                                }}
                                                            >
                                                                {String(value)}
                                                            </TableCell>
                                                        ))}
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </GridLayout>
                </div>
            )}

            {/* Console Component */}
            <ConsoleComponent
                messages={consoleMessages}
                onClear={clearConsole}
                isOpen={isConsoleOpen}
                onToggle={toggleConsole}
                maxHeight="350px"
            />

            {/* Integrated Visualizations Grid */}
            <VisualizationGrid
                visualizations={visualizations}
                files={files}
                onVisualizationRemoved={handleVisualizationRemoved}
                onLayoutChanged={handleVisualizationLayoutChanged}
                onVisualizationStateChanged={handleVisualizationStateChanged}
                containerWidth={containerWidth}
                gridCols={12}
                rowHeight={120}
            />

            {/* Add Data Dialog */}
            <AddDataDialog
                isOpen={isAddDataDialogOpen}
                onClose={() => setIsAddDataDialogOpen(false)}
                onAddData={handleAddDataFromDialog}
            />

            {/* Add Visualization Dialog */}
            <AddVisualizationDialog
                isOpen={isDialogOpen}
                onClose={closeAddDialog}
                onCreateVisualization={createVisualization}
                availableTypes={DATA_VISUALIZATIONS}
                files={files}
                selectedFileForView={selectedFileForView}
                onSelectedFileChange={setSelectedFileForView}
                showFileSelector={true}
                dialogTitle="Add Data Visualization"
            />
        </div>
    );
};

export default DataComponent;