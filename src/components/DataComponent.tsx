import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    TableContainer, Table, TableHead, TableBody,
    TableRow, TableCell, Button, Typography
} from '@mui/material';
import { Plus, X, GripHorizontal, CheckSquare, Square, Upload, Eye, BarChart3 } from 'lucide-react';
import GridLayout, { Layout } from 'react-grid-layout';
import Papa from 'papaparse';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { DataFile } from './DataFile';
import { processCSV, ProcessCSVReturnType } from '../io/CSVParsing';
import { Visualization, VisualizationState } from './types';
import { VisualizationComponent } from './VisualizationComponent';
import {
    useVisualizationManager,
    AddVisualizationDialog,
    VisualizationGrid,
    DATA_VISUALIZATIONS
} from './VisualizationManager';
import { ConsoleComponent, ConsoleMessage } from './ConsoleComponent';
import { AddDataDialog } from './AddDataDialog';
import { add } from 'mathjs';

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

    // Add Data Dialog state
    const [isAddDataDialogOpen, setIsAddDataDialogOpen] = useState(false);

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
                    addConsoleMessage('info', `File ${file.name} uploaded successfully.`);
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

    return (
        <div ref={containerRef} className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <Typography variant="h5">Data</Typography>
                <div className="flex items-center gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".csv,.col"
                        multiple
                    />
                    
                    {/* Add Data button */}
                    <Button
                        variant="outlined"
                        startIcon={<Plus size={20} />}
                        onClick={() => setIsAddDataDialogOpen(true)}
                        className="mr-2"
                    >
                        Add Data
                    </Button>

                    {/* Upload Files button */}
                    <Button
                        variant="contained"
                        startIcon={<Upload size={20} />}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        Upload Files
                    </Button>

                    {/* Add View button */}
                    {files.length > 0 && (
                        <Button
                            variant="outlined"
                            startIcon={<Eye size={20} />}
                            onClick={() => openAddDialog()}
                            className="ml-2"
                        >
                            Add View
                        </Button>
                    )}

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
                            ? `${selectedFiles.length} of ${files.length} selected`
                            : `${files.length} files total`}
                    </div>
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
                                <div className="p-4 h-[calc(100%-3rem)] overflow-auto">
                                    <TableContainer>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    {file.headers.map((header, index) => (
                                                        <TableCell
                                                            key={index}
                                                            style={{
                                                                fontWeight: 'bold',
                                                                whiteSpace: 'nowrap',
                                                                backgroundColor: '#f5f5f5'
                                                            }}
                                                        >
                                                            {header}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {file.content.slice(0, 10).map((row: any, rowIndex: number) => (
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
                                                {file.content.length > 10 && (
                                                    <TableRow>
                                                        <TableCell
                                                            colSpan={file.headers.length}
                                                            style={{
                                                                textAlign: 'center',
                                                                fontStyle: 'italic',
                                                                color: '#666'
                                                            }}
                                                        >
                                                            ... and {file.content.length - 10} more rows
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
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