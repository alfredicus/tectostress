import { DataFile, DataFiles } from "./DataFile";
import {
    TableContainer, Table, TableHead, TableBody,
    TableRow, TableCell, Button, Typography
} from '@mui/material';
import { useTheme } from "./ThemeContext";  // ✅ ADD THIS

// Sous-composant pour un tableau individuel
const SingleTable: React.FC<{ file: DataFile }> = ({ file }) => {
    const { isDark } = useTheme();  // ✅ ADD THIS

    return (
        <div className="mb-8 overflow-auto rounded-lg shadow">
            <div
                className="p-4 border-b"
                style={{
                    backgroundColor: isDark ? '#1e293b' : '#f3f4f6',  // ✅ CHANGE THIS
                }}
            >
                <h3
                    className="text-lg font-semibold"
                    style={{
                        color: isDark ? '#f1f5f9' : '#1f2937'  // ✅ ADD THIS
                    }}
                >
                    {file.name}
                </h3>
            </div>
            <TableContainer
                style={{
                    backgroundColor: isDark ? '#0f172a' : '#ffffff'  // ✅ ADD THIS
                }}
            >
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            {file.headers.map((header, index) => (
                                <TableCell
                                    key={index}
                                    style={{
                                        fontWeight: 'bold',
                                        whiteSpace: 'nowrap',
                                        backgroundColor: isDark ? '#1e293b' : '#f5f5f5',  // ✅ CHANGE THIS
                                        position: 'sticky',
                                        top: 0,
                                        zIndex: 1,
                                        color: isDark ? '#f1f5f9' : '#1e293b'  // ✅ KEEP THIS
                                    }}
                                >
                                    {header}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {file.content.map((row, rowIndex) => (
                            <TableRow
                                key={rowIndex}
                                hover
                                style={{
                                    backgroundColor: isDark ? '#334155' : '#ffffff'  // ✅ ADD THIS
                                }}
                            >
                                {row.map((cell, cellIndex) => (
                                    <TableCell
                                        key={cellIndex}
                                        style={{
                                            whiteSpace: 'nowrap',
                                            color: isDark ? '#e2e8f0' : '#1f2937'  // ✅ ADD THIS
                                        }}
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
    );
};

// Composant principal qui gère la liste des tableaux
const TableComponent: React.FC<{ files: DataFiles }> = ({ files }) => {
    const { isDark } = useTheme();  // ✅ ADD THIS

    if (!files || files.length === 0) {
        return (
            <div
                className="flex items-center justify-center h-full"
                style={{
                    color: isDark ? '#cbd5e1' : '#6b7280'  // ✅ ADD THIS
                }}
            >
                No data available
            </div>
        );
    }

    return (
        <div
            className="overflow-auto h-full p-4"
            style={{
                backgroundColor: isDark ? '#0f172a' : '#ffffff'  // ✅ ADD THIS
            }}
        >
            <div className="space-y-8">
                {files.map((file) => (
                    <SingleTable key={file.id} file={file} />
                ))}
            </div>
        </div>
    );
};

export default TableComponent;