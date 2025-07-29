// Enhanced CSV processor with better error handling - data-processor.ts

import Papa from 'papaparse';

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
    console.log('🔄 Starting CSV processing...');

    // Debug the raw CSV content
    console.log('📄 Raw CSV preview:', csvData.substring(0, 200));

    try {
        // Detect delimiter
        const delimiter = detectDelimiter(csvData);
        console.log(`🔍 Detected delimiter: "${delimiter}"`);

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

        console.log('📊 Papa Parse result:', {
            fields: result.meta.fields,
            dataLength: result.data.length,
            errors: result.errors,
            delimiter: result.meta.delimiter
        });

        const rawData = result.data as Record<string, any>[];
        const originalHeaders = result.meta.fields || [];
        const issues: { row: number; messages: string[] }[] = [];

        // Handle parsing errors
        if (result.errors && result.errors.length > 0) {
            console.warn('⚠️ Papa Parse errors:', result.errors);
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
            console.log('🔧 Detected combined header, attempting to split...');
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

                console.log('✅ Successfully re-parsed with semicolon delimiter');
                console.log('📊 New structure:', {
                    headers: processedHeaders,
                    dataRows: processedData.length,
                    sampleRow: processedData[0]
                });
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

        console.log('🗺️ Header mapping:', headerMap);

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

        console.log('✅ CSV processing complete:', {
            originalHeaders: processedHeaders.length,
            normalizedHeaders: normalizedHeaders.length,
            dataRows: processedRowData.length,
            issues: issues.length
        });

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




// -------------------------- PRIVATE ----------------------------

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

// Rest of the helper functions remain the same...

function normalizeName(columnName: string): string {
    // console.log(columnName);
    return columnName
        .toLowerCase()
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function mapColumnName(normalizedName: string): string {
    const columnMappings: { [key: string]: string } = {
        'id': 'id',
        'active': 'active',
        'type': 'type',
        'deformation phase': 'deformation phase',
        'relative weight': 'relative weight',
        'scale': 'scale',
        'x': 'x',
        'y': 'y',
        'z': 'z',
        'strike': 'strike',
        'strike [0 360)': 'strike',
        'dip': 'dip',
        'dip [0 90]': 'dip',
        'dip direction': 'dip direction',
        'rake': 'rake',
        'rake [0 90]': 'rake',
        'strike direction': 'strike direction',
        'striation trend': 'striation trend',
        'striation trend [0 360)': 'striation trend',
        'type of mouvement': 'type of movement',
        'type of movement': 'type of movement',
        'line trend': 'line trend',
        'line trend [0 360)': 'line trend',
        'line plunge': 'line plunge',
        'line plunge [0 90]': 'line plunge',
        'min friction angle': 'min friction angle',
        'max friction angle': 'max friction angle',
        'min angle s1 n': 'min angle <s1-n>',
        'min angle <s1 n>': 'min angle <s1-n>',
        'max angle s1 n': 'max angle <s1-n>',
        'max angle <s1 n>': 'max angle <s1-n>',
        'bedding plane strike': 'bedding plane strike',
        'bedding plane dip': 'bedding plane dip',
        'bedding plane dip direction': 'bedding plane dip direction'
    };

    return columnMappings[normalizedName] || normalizedName;
}

function validateGeologicalData(
    dataType: string | undefined,
    data: Record<string, any>
): string[] {
    const errors: string[] = [];

    if (!dataType) {
        errors.push('Missing data type');
        return errors;
    }

    // console.log(`🔍 Validating geological data for type: "${dataType}"`);
    const normalizedType = dataType.toLowerCase().trim();

    // List of data types requiring specific information
    const planeDataTypes = [
        'striated plane',
        'extension fracture',
        'stylolite interface',
        'dilation band',
        'compaction band',
        'neoformed striated plane',
        'striated compactional shear band',
        'striated dilatant shear band'
    ];

    const striatedDataTypes = [
        'striated plane',
        'neoformed striated plane',
        'striated compactional shear band',
        'striated dilatant shear band',
        'conjugate fault planes'
    ];

    const axisDataTypes = [
        'stylolite teeth',
        'crystal fibers in vein'
    ];

    // For stylolites, check if we have the necessary data
    if (normalizedType.includes('stylolite')) {
        // Stylolites can have various data requirements
        // For interface, we might need strike/dip
        // For teeth, we might need trend/plunge

        if (normalizedType.includes('interface') && planeDataTypes.includes(normalizedType)) {
            if (data['strike'] === undefined) errors.push('Missing strike for stylolite interface');
            if (data['dip'] === undefined) errors.push('Missing dip for stylolite interface');
        }

        if (normalizedType.includes('teeth') && axisDataTypes.includes(normalizedType)) {
            if (data['line trend'] === undefined) errors.push('Missing line trend for stylolite teeth');
            if (data['line plunge'] === undefined) errors.push('Missing line plunge for stylolite teeth');
        }
    }

    // Check for required plane information
    if (planeDataTypes.includes(normalizedType)) {
        if (data['strike'] === undefined) errors.push('Missing strike');
        if (data['dip'] === undefined) errors.push('Missing dip');
        if (!data['dip direction']) errors.push('Missing dip direction');

        if (striatedDataTypes.includes(normalizedType)) {
            const hasRakeInfo = data['rake'] !== undefined && data['strike direction'] !== undefined;
            const hasTrendInfo = data['striation trend'] !== undefined;

            if (!hasRakeInfo && !hasTrendInfo) {
                errors.push('Missing striation data (need either rake+strike direction or striation trend)');
            }

            if (!data['type of movement']) {
                errors.push('Missing type of movement');
            }
        }
    }

    if (axisDataTypes.includes(normalizedType)) {
        if (data['line trend'] === undefined) errors.push('Missing line trend');
        if (data['line plunge'] === undefined) errors.push('Missing line plunge');
    }

    if (normalizedType.startsWith('conjugate')) {
        if (normalizedType.includes('fault') && !data['type of movement']) {
            errors.push('Conjugate fault planes require type of movement');
        }
    }

    return errors;
}