import Papa from 'papaparse';
import { normalizeName, mapColumnName } from '@alfredo-taboada/stress';

export type ProcessCSVReturnType = {
    headers: string[];
    normalizedHeaders: string[];
    data: Record<string, any>[];
    issues: { row: number; messages: string[] }[];
    rawData?: any[]; // Add raw data for debugging
    parsingInfo?: {
        delimiter: string;
        totalRows: number;
        emptyRows: number;
        errorRows: number;
    };
}

/**
 * Enhanced CSV processor with better error handling and delimiter detection
 */
export function processCSV(csvData: string): ProcessCSVReturnType {
    // console.log('🔄 Starting CSV processing...');

    // Debug the raw CSV content
    // console.log('📄 Raw CSV preview:', csvData.substring(0, 200));

    try {
        // Detect delimiter
        const delimiter = detectDelimiter(csvData);
        // console.log(`🔍 Detected delimiter: "${delimiter}"`);

        // Parse with Papa Parse
        const result = Papa.parse(csvData, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            delimiter: delimiter,
            trimHeaders: true,
            transform: (value, header) => {
                // Trim whitespace from all values
                return typeof value === 'string' ? value.trim() : value;
            }
        });

        // console.log('📊 Papa Parse result:', {
        //     fields: result.meta.fields,
        //     dataLength: result.data.length,
        //     errors: result.errors,
        //     delimiter: result.meta.delimiter
        // });

        const rawData = result.data as Record<string, any>[];
        const originalHeaders = result.meta.fields || [];
        const issues: { row: number; messages: string[] }[] = [];

        // Handle parsing errors
        if (result.errors && result.errors.length > 0) {
            // console.warn('⚠️ Papa Parse errors:', result.errors);
            result.errors.forEach((error, index) => {
                issues.push({
                    row: error.row || index,
                    messages: [`Parsing error: ${error.message}`]
                });
            });
        }

        // If no headers detected or only one combined header, try to split
        let processedHeaders = originalHeaders;
        let processedData = rawData;

        if (originalHeaders.length === 1 && originalHeaders[0].includes(';')) {
            // console.log('🔧 Detected combined header, attempting to split...');
            const splitHeaders = originalHeaders[0].split(';').map(h => h.trim());

            // Re-parse with semicolon delimiter
            const reResult = Papa.parse(csvData, {
                header: false,
                skipEmptyLines: true,
                dynamicTyping: true,
                delimiter: ';'
            });

            if (reResult.data.length > 0) {
                const reDataArray = reResult.data as string[][];
                processedHeaders = splitHeaders;

                // Convert array data to object data
                processedData = reDataArray.slice(1).map((row, rowIndex) => {
                    const obj: Record<string, any> = {};
                    splitHeaders.forEach((header, headerIndex) => {
                        const value = row[headerIndex];
                        obj[header] = value;
                    });
                    return obj;
                });

                // console.log('✅ Successfully re-parsed with semicolon delimiter');
                // console.log('📊 New structure:', {
                //     headers: processedHeaders,
                //     dataRows: processedData.length,
                //     sampleRow: processedData[0]
                // });
            }
        }

        // Create mapping from original headers to normalized headers
        const headerMap: Record<string, string> = {};
        const normalizedHeaders: string[] = [];

        processedHeaders.forEach(header => {
            const normalizedName = normalizeName(header);
            const mappedName = mapColumnName(normalizedName);
            headerMap[header] = mappedName;
            normalizedHeaders.push(mappedName);
        });

        // console.log('🗺️ Header mapping:', headerMap);

        // Process each row
        let emptyRows = 0;
        let errorRows = 0;

        const processedRowData = processedData.map((row, rowIndex) => {
            const normalizedRow: Record<string, any> = {};

            // Check if row is empty
            const hasData = Object.values(row).some(value =>
                value !== null && value !== undefined && value !== ''
            );

            if (!hasData) {
                emptyRows++;
                return null;
            }

            // Convert keys to normalized form
            Object.entries(row).forEach(([key, value]) => {
                const normalizedKey = headerMap[key] || key;
                if (typeof value === 'string') {
                    normalizedRow[normalizedKey] = normalizeName(value);
                } else {
                    normalizedRow[normalizedKey] = value;
                }
            });

            // Validate the row if it has a type field
            if (normalizedRow['type']) {
                try {
                    const dataType = String(normalizedRow['type']).trim();
                    const rowIssues = validateGeologicalData(dataType, normalizedRow);

                    if (rowIssues.length > 0) {
                        issues.push({
                            row: rowIndex + 2, // +2 to account for 0-indexing and header row
                            messages: rowIssues
                        });
                    }
                } catch (error) {
                    errorRows++;
                    issues.push({
                        row: rowIndex + 2,
                        messages: [`Error validating row: ${error.message}`]
                    });
                }
            }

            return normalizedRow;
        }).filter(row => row !== null); // Remove empty rows

        const finalResult: ProcessCSVReturnType = {
            headers: processedHeaders,
            normalizedHeaders,
            data: processedRowData,
            issues,
            rawData: rawData,
            parsingInfo: {
                delimiter: result.meta.delimiter || delimiter,
                totalRows: rawData.length,
                emptyRows,
                errorRows
            }
        };

        // console.log('✅ CSV processing complete:', {
        //     originalHeaders: processedHeaders.length,
        //     normalizedHeaders: normalizedHeaders.length,
        //     dataRows: processedRowData.length,
        //     issues: issues.length
        // });

        return finalResult;

    } catch (error) {
        console.error('❌ Error processing CSV:', error);

        // Return a safe fallback structure
        return {
            headers: [],
            normalizedHeaders: [],
            data: [],
            issues: [{
                row: 0,
                messages: [`Critical parsing error: ${error.message}`]
            }],
            rawData: [],
            parsingInfo: {
                delimiter: ',',
                totalRows: 0,
                emptyRows: 0,
                errorRows: 1
            }
        };
    }
}

/**
 * Detect the most likely delimiter in CSV content
 */
function detectDelimiter(csvData: string): string {
    const delimiters = [',', ';', '\t', '|'];
    const sampleLines = csvData.split('\n').slice(0, 5); // Check first 5 lines

    let bestDelimiter = ',';
    let maxScore = 0;

    for (const delimiter of delimiters) {
        let score = 0;
        let consistency = 0;
        let prevCount = -1;

        for (const line of sampleLines) {
            if (line.trim()) {
                const count = (line.match(new RegExp('\\' + delimiter, 'g')) || []).length;
                score += count;

                if (prevCount >= 0 && count === prevCount) {
                    consistency++;
                } else if (prevCount >= 0) {
                    consistency--;
                }
                prevCount = count;
            }
        }

        // Bonus for consistency across lines
        const finalScore = score + (consistency * 2);

        if (finalScore > maxScore) {
            maxScore = finalScore;
            bestDelimiter = delimiter;
        }
    }

    return bestDelimiter;
}
