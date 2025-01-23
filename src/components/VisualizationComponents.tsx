import React from 'react';
import RoseDiagramComponent from './RoseDiagramComponent';
import { SharedData } from './types';
import StressSphereViewer from './StressSphereViewer';

interface VisualizationProps {
    type: string;
    sharedData?: SharedData;
    onDataUpdate?: (data: any) => void;
    width?: number;
    height?: number;
}

const TableComponent: React.FC<VisualizationProps> = ({ sharedData }) => {
    if (!sharedData?.data || !sharedData?.columns) {
        return <div>No data available</div>;
    }

    return (
        <div className="overflow-auto h-full">
            <table className="min-w-full divide-y divide-gray-200">
                <thead>
                    <tr>
                        {sharedData.columns.map((col, i) => (
                            <th key={i} className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {col}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {sharedData.data[0]?.map((_, rowIndex) => (
                        <tr key={rowIndex}>
                            {sharedData.data.map((column, colIndex) => (
                                <td key={colIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {column[rowIndex]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const PlaceholderComponent: React.FC<{ type: string }> = ({ type }) => (
    <div className="flex items-center justify-center h-full">
        <span className="text-gray-400">
            {type} visualization (not implemented yet)
        </span>
    </div>
);

export const VisualizationComponent: React.FC<VisualizationProps> = (props) => {
    const { type } = props;

    switch (type) {
        case 'rose':
            return <RoseDiagramComponent {...props} />;
        case 'table':
            return <TableComponent {...props} />;
        case 'line':
        case 'sphere':
            return <StressSphereViewer />;
        default:
            return <div>Unknown visualization type</div>;
    }
};