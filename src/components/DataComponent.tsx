import React, { useRef, useState } from 'react';
import {
    TableContainer, Table, TableHead, TableBody,
    TableRow, TableCell, Button, Typography
} from '@mui/material';
import { Plus, X, GripHorizontal, CheckSquare, Square, Upload } from 'lucide-react';
import GridLayout, { Layout } from 'react-grid-layout';
import Papa from 'papaparse';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { DataFile } from './DataFile';


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
    const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
    const [selectAll, setSelectAll] = useState(false);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = event.target.files;
        if (!fileList || fileList.length === 0) return;

        // Convert FileList to array to process multiple files
        const filesArray = Array.from(fileList);

        filesArray.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                Papa.parse(e.target?.result as string, {
                    complete: (results) => {
                        const data = results.data as string[][];
                        const headers = data[0];
                        const contentWithoutHeader = data.slice(1);

                        // Position files in a grid-like layout
                        const filesCount = files.length;
                        const row = Math.floor((filesCount + index) / 2);
                        const col = (filesCount + index) % 2;

                        const position = { x: col * 2, y: row * 2 };
                        const newFile: DataFile = {
                            id: `file-${Date.now()}-${index}`,
                            name: file.name,
                            headers,
                            content: contentWithoutHeader,
                            layout: { ...position, w: 4, h: 2 }
                        };
                        onFileLoaded(newFile);
                    },
                    skipEmptyLines: true,
                    delimiter: ';'
                });
            };
            reader.readAsText(file);
        });

        // Clear the input so the same files can be selected again if needed
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

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
            // If all are selected or selectAll is true, deselect all
            setSelectedFiles([]);
            setSelectAll(false);
        } else {
            // Select all files
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
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <Typography variant="h5">Data</Typography>
                <div className="flex items-center gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".csv;*.col"
                        multiple // Enable multiple file selection
                    />
                    <Button
                        variant="contained"
                        startIcon={<Upload size={20} />}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        Upload Files
                    </Button>
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
                width={1200}
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
                            <Button
                                onClick={() => onFileRemoved(file.id)}
                                className="text-gray-400 hover:text-red-500 p-1"
                                style={{ minWidth: 'auto', padding: '6px' }}
                            >
                                <X size={20} />
                            </Button>
                        </div>
                        <div className="p-4 h-[calc(100%-3rem)] overflow-auto">
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            {file.headers.map((header, index) => (
                                                <TableCell
                                                    key={index}
                                                    style={{ fontWeight: 'bold', whiteSpace: 'nowrap', backgroundColor: '#f5f5f5' }}
                                                >
                                                    {header}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {file.content.map((row, rowIndex) => (
                                            <TableRow key={rowIndex} hover>
                                                {row.map((cell, cellIndex) => (
                                                    <TableCell
                                                        key={cellIndex}
                                                        style={{ whiteSpace: 'nowrap' }}
                                                    >
                                                        {cell}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </div>
                    </div>
                ))}
            </GridLayout>
        </div>
    );
};

export default DataComponent;