import React, { useState, useRef } from 'react';
import {
    Table, TableBody, TableCell, TableContainer, TableHead,
    TableRow, Paper, Button, Typography
} from '@mui/material';
import { Plus, X, GripHorizontal } from 'lucide-react';
import GridLayout, { Layout } from 'react-grid-layout';
import Papa from 'papaparse';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

interface DataFile {
    id: string;
    name: string;
    headers: string[];
    content: string[][];
    layout: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
}

const DataTab = () => {
    const [files, setFiles] = useState<DataFile[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                Papa.parse(e.target?.result as string, {
                    complete: (results) => {
                        const data = results.data as string[][];
                        const headers = data[0];
                        const contentWithoutHeader = data.slice(1);

                        const position = { x: 0, y: files.length * 2 };
                        const newFile: DataFile = {
                            id: `file-${Date.now()}`,
                            name: file.name,
                            headers,
                            content: contentWithoutHeader,
                            layout: { ...position, w: 4, h: 2 }
                        };
                        setFiles([...files, newFile]);
                    },
                    skipEmptyLines: true,
                    delimiter: ';'
                });
            };
            reader.readAsText(file);
        }
    };

    const handleLayoutChange = (layout: Layout[]) => {
        const updatedFiles = files.map(file => {
            const newLayout = layout.find(l => l.i === file.id);
            if (newLayout) {
                return {
                    ...file,
                    layout: {
                        x: newLayout.x,
                        y: newLayout.y,
                        w: newLayout.w,
                        h: newLayout.h
                    }
                };
            }
            return file;
        });
        setFiles(updatedFiles);
    };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <Typography variant="h5">Data</Typography>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".csv"
                />
                <Button
                    variant="contained"
                    startIcon={<Plus size={20} />}
                    onClick={() => fileInputRef.current?.click()}
                >
                    Add
                </Button>
            </div>

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
                        className="border rounded-md bg-white shadow-sm overflow-hidden"
                    >
                        <div className="flex items-center justify-between p-2 border-b bg-gray-50">
                            <div className="flex items-center gap-2">
                                <div className="drag-handle cursor-move p-1 hover:bg-gray-200 rounded">
                                    <GripHorizontal size={20} className="text-gray-400" />
                                </div>
                                <Typography variant="subtitle1">{file.name}</Typography>
                            </div>
                            <Button
                                onClick={() => setFiles(files.filter(f => f.id !== file.id))}
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

export default DataTab;