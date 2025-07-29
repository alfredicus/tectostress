import { FileText } from "lucide-react";
import { StressSolution } from "./types";
import React, { useState, useEffect } from 'react';

// Export dialog interface
interface ExportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onExport: (filename: string, format: 'json' | 'csv' | 'txt') => void;
    solution: StressSolution | null;
}

// Export dialog component
export const ExportDialog: React.FC<ExportDialogProps> = ({ isOpen, onClose, onExport, solution }) => {
    const [filename, setFilename] = useState('stress_inversion_results');
    const [format, setFormat] = useState<'json' | 'csv' | 'txt'>('json');

    useEffect(() => {
        if (isOpen) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
            setFilename(`stress_inversion_results_${timestamp}`);
        }
    }, [isOpen]);

    const handleExport = () => {
        if (filename.trim()) {
            onExport(filename.trim(), format);
            onClose();
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleExport();
        }
        if (e.key === 'Escape') {
            onClose();
        }
    };

    if (!isOpen || !solution) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                        <FileText className="w-6 h-6 text-blue-600" />
                        <h3 className="text-lg font-semibold text-gray-900">Export Results</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        {/* <X className="w-5 h-5" /> */}
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label htmlFor="filename" className="block text-sm font-medium text-gray-700 mb-1">
                            Filename
                        </label>
                        <input
                            type="text"
                            id="filename"
                            value={filename}
                            onChange={(e) => setFilename(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter filename..."
                            autoFocus
                        />
                    </div>

                    <div>
                        <label htmlFor="format" className="block text-sm font-medium text-gray-700 mb-1">
                            Format
                        </label>
                        <select
                            id="format"
                            value={format}
                            onChange={(e) => setFormat(e.target.value as 'json' | 'csv' | 'txt')}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="json">JSON (.json)</option>
                            <option value="csv">CSV (.csv)</option>
                            <option value="txt">Text (.txt)</option>
                        </select>
                    </div>

                    <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                        <strong>Preview:</strong> {filename}.{format}
                    </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={!filename.trim()}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Export
                    </button>
                </div>
            </div>
        </div>
    );
};
