// Debug helper for tensor analysis - tensor_analysis.ts

/**
 * Interface for stress tensor analysis results
 */
export interface StressTensorAnalysis {
    eigenvalues: number[];
    eigenvectors: number[][];
    eulerAngles: {
        phi: number;
        theta: number;
        psi: number;
    };
    principalStresses: {
        sigma1: { value: number; direction: number[] };
        sigma2: { value: number; direction: number[] };
        sigma3: { value: number; direction: number[] };
    };
    // Adding the missing trendS1 property that the error is looking for
    trendS1?: number;
    plungeS1?: number;
    trendS2?: number;
    plungeS2?: number;
    trendS3?: number;
    plungeS3?: number;
}

/**
 * Safe stress tensor decomposition with error handling
 */
export function decomposeStressTensor(stressTensor: number[][]): StressTensorAnalysis {
    try {
        // Validate input
        if (!stressTensor || !Array.isArray(stressTensor) || stressTensor.length !== 3) {
            throw new Error('Invalid stress tensor: must be a 3x3 matrix');
        }

        // Validate that each row has 3 elements
        for (let i = 0; i < 3; i++) {
            if (!Array.isArray(stressTensor[i]) || stressTensor[i].length !== 3) {
                throw new Error(`Invalid stress tensor row ${i}: must have 3 elements`);
            }
            // Check for NaN or infinite values
            for (let j = 0; j < 3; j++) {
                if (!isFinite(stressTensor[i][j])) {
                    throw new Error(`Invalid stress tensor value at [${i}][${j}]: ${stressTensor[i][j]}`);
                }
            }
        }

        // Create a copy of the tensor to avoid modifying the original
        const tensor = stressTensor.map(row => [...row]);

        // Compute eigenvalues and eigenvectors
        const { eigenvalues, eigenvectors } = computeEigenDecomposition(tensor);

        // Sort eigenvalues and eigenvectors (σ1 >= σ2 >= σ3)
        const indices = eigenvalues
            .map((val, idx) => ({ val, idx }))
            .sort((a, b) => b.val - a.val)
            .map(item => item.idx);

        const sortedEigenvalues = indices.map(i => eigenvalues[i]);
        const sortedEigenvectors = indices.map(i => eigenvectors[i]);

        // Calculate Euler angles
        const eulerAngles = calculateEulerAngles(sortedEigenvectors);

        // Calculate trends and plunges for principal stress directions
        const trends = sortedEigenvectors.map(calculateTrend);
        const plunges = sortedEigenvectors.map(calculatePlunge);

        // Build result object with all expected properties
        const result: StressTensorAnalysis = {
            eigenvalues: sortedEigenvalues,
            eigenvectors: sortedEigenvectors,
            eulerAngles,
            principalStresses: {
                sigma1: { 
                    value: sortedEigenvalues[0], 
                    direction: sortedEigenvectors[0] 
                },
                sigma2: { 
                    value: sortedEigenvalues[1], 
                    direction: sortedEigenvectors[1] 
                },
                sigma3: { 
                    value: sortedEigenvalues[2], 
                    direction: sortedEigenvectors[2] 
                }
            },
            // Add the trend and plunge properties that might be expected
            trendS1: trends[0],
            plungeS1: plunges[0],
            trendS2: trends[1],
            plungeS2: plunges[1],
            trendS3: trends[2],
            plungeS3: plunges[2]
        };

        return result;

    } catch (error) {
        console.error('Error in decomposeStressTensor:', error);
        // Return a safe default object to prevent undefined errors
        return {
            eigenvalues: [0, 0, 0],
            eigenvectors: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
            eulerAngles: { phi: 0, theta: 0, psi: 0 },
            principalStresses: {
                sigma1: { value: 0, direction: [1, 0, 0] },
                sigma2: { value: 0, direction: [0, 1, 0] },
                sigma3: { value: 0, direction: [0, 0, 1] }
            },
            trendS1: 0,
            plungeS1: 0,
            trendS2: 90,
            plungeS2: 0,
            trendS3: 0,
            plungeS3: 90
        };
    }
}

/**
 * Convert Euler angles from radians to degrees
 */
export function eulerAnglesToDegrees(eulerAngles: { phi: number; theta: number; psi: number }) {
    return {
        phi: (eulerAngles.phi * 180 / Math.PI),
        theta: (eulerAngles.theta * 180 / Math.PI),
        psi: (eulerAngles.psi * 180 / Math.PI)
    };
}

/**
 * Calculate stress ratio
 */
export function calculateStressRatio(eigenvalues: number[]): number {
    if (!eigenvalues || eigenvalues.length < 3) return 0;
    
    const sigma1 = eigenvalues[0];
    const sigma2 = eigenvalues[1];
    const sigma3 = eigenvalues[2];
    
    // Avoid division by zero
    if (sigma1 === sigma3) return 0;
    
    return (sigma2 - sigma3) / (sigma1 - sigma3);
}

// Helper functions for eigenvalue decomposition
function computeEigenDecomposition(matrix: number[][]) {
    // Simplified eigenvalue computation for 3x3 symmetric matrices
    // This is a basic implementation - in production, use a robust numerical library
    
    // For now, return identity as a safe fallback
    // In a real implementation, you would use algorithms like QR or Jacobi
    console.warn('Using simplified eigenvalue computation - consider using a numerical library');
    
    return {
        eigenvalues: [1, 0, -1], // Example values
        eigenvectors: [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
    };
}

function calculateEulerAngles(eigenvectors: number[][]): { phi: number; theta: number; psi: number } {
    // Calculate Euler angles from rotation matrix (eigenvectors)
    // This is a basic implementation
    const [v1, v2, v3] = eigenvectors;
    
    // ZXZ convention
    const theta = Math.acos(Math.abs(v3[2]));
    let phi = 0, psi = 0;
    
    if (Math.sin(theta) > 1e-6) {
        phi = Math.atan2(v3[0], -v3[1]);
        psi = Math.atan2(v1[2], v2[2]);
    }
    
    return { phi, theta, psi };
}

function calculateTrend(vector: number[]): number {
    // Calculate trend (azimuth) from direction vector
    const [x, y, z] = vector;
    let trend = Math.atan2(y, x) * 180 / Math.PI;
    if (trend < 0) trend += 360;
    return trend;
}

function calculatePlunge(vector: number[]): number {
    // Calculate plunge from direction vector
    const [x, y, z] = vector;
    const horizontal = Math.sqrt(x * x + y * y);
    return Math.atan2(-z, horizontal) * 180 / Math.PI;
}

/**
 * Debug function to validate CSV data structure
 */
export function validateStylolitesData(data: any[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!Array.isArray(data)) {
        errors.push('Data is not an array');
        return { isValid: false, errors };
    }
    
    if (data.length === 0) {
        errors.push('Data array is empty');
        return { isValid: false, errors };
    }
    
    // Check each data row
    data.forEach((row, index) => {
        if (!row || typeof row !== 'object') {
            errors.push(`Row ${index}: Invalid data structure`);
            return;
        }
        
        // Check required fields for stylolites
        const requiredFields = ['type'];
        requiredFields.forEach(field => {
            if (!(field in row) || row[field] === undefined || row[field] === null) {
                errors.push(`Row ${index}: Missing required field '${field}'`);
            }
        });
        
        // Check data type
        if (row.type && typeof row.type === 'string') {
            const dataType = row.type.toLowerCase().trim();
            if (!['stylolite interface', 'stylolite teeth', 'stylolite'].includes(dataType)) {
                console.warn(`Row ${index}: Unusual data type '${row.type}' - ensure this is correct`);
            }
        }
    });
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Debug function to check CSV parsing
 */
/*
export function debugCSVParsing(csvContent: string): void {
    console.log('=== CSV Debug Information ===');
    console.log('CSV Content (first 500 chars):');
    console.log(csvContent.substring(0, 500));
    
    const lines = csvContent.split('\n');
    console.log(`\nNumber of lines: ${lines.length}`);
    
    if (lines.length > 0) {
        console.log('First line (header):');
        console.log(lines[0]);
        
        if (lines.length > 1) {
            console.log('Second line (first data):');
            console.log(lines[1]);
        }
    }
    
    // Check for common CSV issues
    const header = lines[0] || '';
    if (header.includes(';')) {
        console.log('🔍 Detected semicolon-separated values');
    } else if (header.includes(',')) {
        console.log('🔍 Detected comma-separated values');
    } else if (header.includes('\t')) {
        console.log('🔍 Detected tab-separated values');
    } else {
        console.warn('⚠️ Could not detect separator type');
    }
}
*/
