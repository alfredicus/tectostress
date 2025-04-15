
import Papa from 'papaparse';

export type ProcessCSVReturnType = {
    headers: string[];
    normalizedHeaders: string[];
    data: Record<string, any>[];
    issues: { row: number; messages: string[] }[];
}

// Process CSV data for geological information
export function processCSV(csvData: string): ProcessCSVReturnType {
    const result = Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true // Automatically convert numeric values
    });

    const rawData = result.data as Record<string, any>[];
    const originalHeaders = result.meta.fields || [];
    const issues: { row: number; messages: string[] }[] = [];

    // Create mapping from original headers to normalized headers
    const headerMap: Record<string, string> = {};
    const normalizedHeaders: string[] = [];

    originalHeaders.forEach(header => {
        const normalizedName = normalizeName(header);
        const mappedName = mapColumnName(normalizedName);
        headerMap[header] = mappedName;
        normalizedHeaders.push(mappedName);
    });

    // Process each row
    const processedData = rawData.map((row, rowIndex) => {
        const normalizedRow: Record<string, any> = {};

        // Convert keys to normalized form
        Object.entries(row).forEach(([key, value]) => {
            const normalizedKey = headerMap[key];
            if (typeof value === 'string') {
                normalizedRow[normalizedKey] = normalizeName(value)
            }
            else {
                normalizedRow[normalizedKey] = value
            }
        });

        // Validate the row
        const dataType = normalizedRow['type'].trim();
        const rowIssues = validateGeologicalData(dataType, normalizedRow);

        if (rowIssues.length > 0) {
            issues.push({
                row: rowIndex + 2, // +2 to account for 0-indexing and header row
                messages: rowIssues
            });
        }

        return normalizedRow;
    });

    return {
        headers: originalHeaders,
        normalizedHeaders,
        data: processedData,
        issues
    };
}




// --------------- PRIVATE ------------------------

// Define the interface for geological data
interface GeologicalData {
    // Common fields (all optional)
    number?: number;
    active?: boolean;
    dataType?: string;
    deformationPhase?: number;
    relativeWeight?: number;
    scale?: number;
    x?: number;
    y?: number;
    z?: number;

    // Plane-related fields
    strike?: number;
    dip?: number;
    dipDirection?: string;

    // Striation-related fields
    rake?: number;
    strikeDirection?: string;
    striationTrend?: number;
    typeOfMovement?: string;

    // Line-related fields
    lineTrend?: number;
    linePlunge?: number;

    // Angle-related fields
    minFrictionAngle?: number;
    maxFrictionAngle?: number;
    minAngleS1n?: number;
    maxAngleS1n?: number;

    // Bedding plane fields
    beddingPlaneStrike?: number;
    beddingPlaneDip?: number;
    beddingPlaneDipDirection?: string;

    // Additional metadata
    isConjugatePair?: boolean;
    conjugatePairId?: number;

    // Any other fields that might be present
    [key: string]: any;
}

// Function to normalize column names from CSV headers
function normalizeName(columnName: string): string {
    return columnName
        .toLowerCase()
        .replace(/[-_]/g, ' ')  // Replace hyphens and underscores with spaces
        .replace(/\s+/g, ' ')   // Replace multiple spaces with a single space
        .trim();                // Remove leading and trailing spaces
}

// Map normalized column names to standard names
function mapColumnName(normalizedName: string): string {
    const columnMappings: { [key: string]: string } = {
        // Common columns
        'id': 'id',
        'active': 'active',
        'type': 'type',
        'deformation phase': 'deformation phase',
        'relative weight': 'relative weight',
        'scale': 'scale',
        'x': 'x',
        'y': 'y',
        'z': 'z',

        // Plane columns
        'strike': 'strike',
        'strike [0 360)': 'strike',
        'dip': 'dip',
        'dip [0 90]': 'dip',
        'dip direction': 'dip direction',

        // Striation columns
        'rake': 'rake',
        'rake [0 90]': 'rake',
        'strike direction': 'strike direction',
        'striation trend': 'striation trend',
        'striation trend [0 360)': 'striation trend',
        'type of mouvement': 'type of movement',
        'type of movement': 'type of movement',

        // Line columns
        'line trend': 'line trend',
        'line trend [0 360)': 'line trend',
        'line plunge': 'line plunge',
        'line plunge [0 90]': 'line plunge',

        // Angle columns
        'min friction angle': 'min friction angle',
        'max friction angle': 'max friction angle',
        'min angle s1 n': 'min angle <s1-n>',
        'min angle <s1 n>': 'min angle <s1-n>',
        'max angle s1 n': 'max angle <s1-n>',
        'max angle <s1 n>': 'max angle <s1-n>',

        // Bedding plane columns
        'bedding plane strike': 'bedding plane strike',
        'bedding plane dip': 'bedding plane dip',
        'bedding plane dip direction': 'bedding plane dip direction'
    };

    return columnMappings[normalizedName] || normalizedName;
}

// Validate data based on data type requirements
function validateGeologicalData(
    dataType: string | undefined,
    data: Record<string, any>
): string[] {
    const errors: string[] = [];

    if (!dataType) {
        errors.push('Missing data type');
        return errors;
    }

    // List of data types requiring plane information
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

    // List of data types requiring striation information
    const striatedDataTypes = [
        'striated plane',
        'neoformed striated plane',
        'striated compactional shear band',
        'striated dilatant shear band',
        'conjugate fault planes'
    ];

    // List of data types requiring axis information
    const axisDataTypes = [
        'stylolite teeth',
        'crystal fibers in vein'
    ];

    // Check for required plane information
    if (planeDataTypes.includes(dataType.toLowerCase())) {
        if (data['strike'] === undefined) errors.push('Missing strike');
        if (data['dip'] === undefined) errors.push('Missing dip');
        if (!data['dip direction']) errors.push('Missing dip direction');

        // Check for required striation information
        if (striatedDataTypes.includes(dataType.toLowerCase())) {
            // Check if we have either rake+strikeDirection OR striationTrend
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

    // Check for required axis information
    if (axisDataTypes.includes(dataType.toLowerCase())) {
        if (data['line trend'] === undefined) errors.push('Missing line trend');
        if (data['line plunge'] === undefined) errors.push('Missing line plunge');
    }

    // Special handling for conjugate data types
    if (dataType.toLowerCase().startsWith('conjugate')) {
        // Here we can only check that the data type is valid
        // Actual pairing validation would need to be done at a higher level with multiple rows
        if (dataType.toLowerCase().includes('fault') &&
            !data['type of movement']) {
            errors.push('Conjugate fault planes require type of movement');
        }
    }

    return errors;
}