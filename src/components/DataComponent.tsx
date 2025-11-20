import React, { useState, useRef, useEffect, useCallback } from 'react';
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

import { matelles } from './data/matelles';
import { synthetic_1 } from './data/synthetic-1';
import { synthetic_2 } from './data/synthetic-2';
import { synthetic_faults } from './data/synthetic-faults';

interface DataComponentProps {
    files: DataFile[];
    onFileLoaded: (file: DataFile) => void;
    onFileRemoved: (fileId: string) => void;
}

const DataComponent: React.FC<DataComponentProps> = ({
    files,
    onFileLoaded,
    onFileRemoved
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
    const [selectAll, setSelectAll] = useState(false);
    const [containerWidth, setContainerWidth] = useState<number>(1400);
    const [selectedModel, setSelectedModel] = useState<string>('');

    // Add Data Dialog state
    const [isAddDataDialogOpen, setIsAddDataDialogOpen] = useState(false);

    // Console-related state
    const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
    const [isConsoleOpen, setIsConsoleOpen] = useState<boolean>(false);

    const [isChangingModel, setIsChangingModel] = useState(false);

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
        availableTypes: DATA_VISUALIZATIONS
    });

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
    }, [files.length, clearConsole, setSelectedModel]);

    // Model definitions with multiple examples each
    const MODELS = {
        // ----------------------------------------------------
        synthetic_1,
        synthetic_2,
        synthetic_faults,
        matelles
    }

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
        // Position the new file at the bottom of existing files
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

    // Clear all existing files (used when switching models)
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

        // Clear existing files first
        clearAllFiles();

        setConsoleMessages([]);

        // Load the selected model's examples
        const model = MODELS[modelKey as keyof typeof MODELS];
        if (!model) return;

        const exampleKeys = Object.keys(model.examples);

        // Add a small delay to ensure files are cleared before adding new ones
        setTimeout(() => {
            exampleKeys.forEach((exampleKey, index) => {
                const dataset = model.examples[exampleKey as keyof typeof model.examples];

                try {
                    const retType: ProcessCSVReturnType = processCSV(dataset.csv);

                    if (!retType || !retType.data || !Array.isArray(retType.data)) {
                        addConsoleMessage('error', `Invalid data structure from example: ${dataset.name}`);
                        return;
                    }

                    // Position examples in a grid
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

    return (
        <div ref={containerRef} className="p-6">
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
                        className="flex items-center gap-2 text-gray-700 hover:text-blue-600"
                    >
                        {selectAll || selectedFiles.length === files.length ? (
                            <CheckSquare className="w-5 h-5 text-blue-500" />
                        ) : (
                            <Square className="w-5 h-5" />
                        )}
                        <span>{selectAll ? "Deselect All" : "Select All"}</span>
                    </button>

                    <div className="text-sm text-gray-500">
                        {selectedFiles.length > 0
                            ? `${selectedFiles.length} of ${files.length} selected. Model loaded: ${selectedModel ? MODELS[selectedModel as keyof typeof MODELS]?.name : 'None'}`
                            : `${files.length} files total.`}
                    </div>

                    {selectedModel && (
                        <div className="text-sm text-blue-600 font-medium">
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
                                className={`border rounded-md shadow-sm overflow-hidden ${selectedFiles.includes(file.id) ? 'ring-2 ring-blue-500' : ''
                                    }`}
                            >
                                <div className="flex items-center justify-between p-2 border-b bg-gray-50">
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
                                        <div className="drag-handle cursor-move p-1 hover:bg-gray-200 rounded">
                                            <GripHorizontal size={20} className="text-gray-400" />
                                        </div>
                                        <Typography variant="subtitle1">{file.name}</Typography>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => openAddDialog(file.id)}
                                            className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                                            title="Create visualization from this file"
                                        >
                                            <BarChart3 size={16} />
                                        </button>
                                        <button
                                            onClick={() => onFileRemoved(file.id)}
                                            className="text-gray-400 hover:text-red-500 p-1"
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
                                                                backgroundColor: '#f5f5f5',
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
                                                    <TableRow key={rowIndex} hover>
                                                        {Object.entries(row).map(([name, value]) => (
                                                            <TableCell
                                                                key={name}
                                                                style={{ whiteSpace: 'nowrap' }}
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