import React, { useState, useCallback } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { DataFile } from './DataFile';

interface DataPoint {
    id: string;
    type: string;
    [key: string]: any; // For custom fields
}

interface CustomField {
    id: string;
    name: string;
    value: string | number;
}

interface AddDataDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onAddData: (data: DataFile) => void;
}

export const AddDataDialog: React.FC<AddDataDialogProps> = ({
    isOpen,
    onClose,
    onAddData
}) => {
    const [dataPoints, setDataPoints] = useState<DataPoint[]>([
        {
            id: 'point-1',
            type: '',
        }
    ]);

    const [customFields, setCustomFields] = useState<CustomField[]>([]);
    const [fileName, setFileName] = useState('Manual Data Entry');

    const addDataPoint = useCallback(() => {
        const newPoint: DataPoint = {
            id: `point-${Date.now()}`,
            type: '',
        };

        // Add values for existing custom fields
        customFields.forEach(field => {
            newPoint[field.name] = '';
        });

        setDataPoints(prev => [...prev, newPoint]);
    }, [customFields]);

    const removeDataPoint = useCallback((pointId: string) => {
        setDataPoints(prev => prev.filter(p => p.id !== pointId));
    }, []);

    const updateDataPoint = useCallback((pointId: string, field: string, value: any) => {
        setDataPoints(prev => prev.map(point =>
            point.id === pointId ? { ...point, [field]: value } : point
        ));
    }, []);

    const addCustomField = useCallback(() => {
        const fieldName = prompt('Enter field name:');
        if (fieldName && fieldName.trim()) {
            const newField: CustomField = {
                id: `field-${Date.now()}`,
                name: fieldName.trim(),
                value: ''
            };

            setCustomFields(prev => [...prev, newField]);

            // Add this field to all existing data points
            setDataPoints(prev => prev.map(point => ({
                ...point,
                [fieldName.trim()]: ''
            })));
        }
    }, []);

    const removeCustomField = useCallback((fieldId: string) => {
        const field = customFields.find(f => f.id === fieldId);
        if (field) {
            setCustomFields(prev => prev.filter(f => f.id !== fieldId));

            // Remove this field from all data points
            setDataPoints(prev => prev.map(point => {
                const { [field.name]: removed, ...rest } = point;
                return rest;
            }));
        }
    }, [customFields]);

    const handleSave = useCallback(() => {
        if (dataPoints.length === 0) {
            alert('Please add at least one data point.');
            return;
        }

        // Validate required fields
        const invalidPoints = dataPoints.some(point =>
            !point.type.trim() || point.dip === null || point.dip === undefined
        );

        if (invalidPoints) {
            alert('Please fill in Type and Dip for all data points.');
            return;
        }

        // Create headers from the data point keys (excluding 'id')
        const headers = ['type', ...customFields.map(f => f.name)];

        // Convert data points to the format expected by DataFile
        const content = dataPoints.map(point => {
            const { id, ...data } = point;
            return data;
        });

        const newFile: DataFile = {
            id: `manual-${Date.now()}`,
            name: fileName || 'Manual Data Entry',
            headers,
            content,
            layout: { x: 0, y: 0, w: 4, h: 2 }
        };

        onAddData(newFile);
        onClose();

        // Reset form
        setDataPoints([{ id: 'point-1', type: ''}]);
        setCustomFields([]);
        setFileName('Manual Data Entry');
    }, [dataPoints, customFields, fileName, onAddData, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b">
                    <h2 className="text-xl font-bold text-gray-900">Add Data</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {/* File Name */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Dataset Name
                        </label>
                        <input
                            type="text"
                            value={fileName}
                            onChange={(e) => setFileName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter dataset name..."
                        />
                    </div>

                    {/* Custom Fields Management */}
                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-lg font-medium text-gray-900">Fields</h3>
                            <button
                                onClick={addCustomField}
                                className="flex items-center gap-2 px-3 py-1 text-sm bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
                            >
                                <Plus size={16} />
                                Add Field
                            </button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="px-3 py-2 bg-gray-100 rounded-md text-sm font-medium">
                                Type (required)
                            </div>
                           
                            <div></div>

                            {customFields.map(field => (
                                <div key={field.id} className="flex items-center gap-2">
                                    <div className="px-3 py-2 bg-blue-50 rounded-md text-sm font-medium flex-1">
                                        {field.name}
                                    </div>
                                    <button
                                        onClick={() => removeCustomField(field.id)}
                                        className="text-red-500 hover:text-red-700 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Data Points */}
                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-lg font-medium text-gray-900">Data Points</h3>
                            <button
                                onClick={addDataPoint}
                                className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                            >
                                <Plus size={16} />
                                Add Point
                            </button>
                        </div>

                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {dataPoints.map((point, index) => (
                                <div key={point.id} className="grid grid-cols-4 gap-3 items-center p-3 border rounded-lg bg-gray-50">
                                    <div className="text-sm font-medium text-gray-600">
                                        Point {index + 1}
                                    </div>

                                    {/* Type */}
                                    <input
                                        type="text"
                                        placeholder="Type"
                                        value={point.type}
                                        onChange={(e) => updateDataPoint(point.id, 'type', e.target.value)}
                                        className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                                    />

                                    {/* Custom Fields */}
                                    {customFields.map(field => (
                                        <input
                                            key={field.id}
                                            type="text"
                                            placeholder={field.name}
                                            value={point[field.name] || ''}
                                            onChange={(e) => updateDataPoint(point.id, field.name, e.target.value)}
                                            className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center p-6 border-t bg-gray-50">
                    <div className="text-sm text-gray-600">
                        {dataPoints.length} data point{dataPoints.length !== 1 ? 's' : ''} • {customFields.length + 3} fields
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        >
                            Add Data
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};