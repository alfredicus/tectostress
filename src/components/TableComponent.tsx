import { DataFile, DataFiles } from "./DataFile";
import {
    TableContainer, Table, TableHead, TableBody,
    TableRow, TableCell, Button, Typography
} from '@mui/material';

// Sous-composant pour un tableau individuel
const SingleTable: React.FC<{ file: DataFile }> = ({ file }) => {

    return (
        <div className="mb-8 overflow-auto rounded-lg shadow">
            <div className="bg-gray-100 p-4 border-b">
                <h3 className="text-lg font-semibold">{file.name}</h3>
            </div>
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
            {/* <table className="min-w-full divide-y divide-gray-200">
                <thead>
                    <tr>
                        {data.headers.map((header, i) => (
                            <th 
                                key={i} 
                                className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead> 
                <tbody className="bg-white divide-y divide-gray-200">
                    {data.content.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                            {row.map((cell, cellIndex) => (
                                <td 
                                    key={cellIndex} 
                                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                                >
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table> */}
        </div>
    );
};

// Composant principal qui gère la liste des tableaux
const TableComponent: React.FC<{ files: DataFiles }> = ({ files }) => {
    if (!files || files.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500">
                No data available
            </div>
        );
    }

    return (
        <div className="overflow-auto h-full p-4">
            <div className="space-y-8">
                {files.map((file) => (
                    <SingleTable key={file.id} file={file} />
                ))}
            </div>
        </div>
    );
};

export default TableComponent;