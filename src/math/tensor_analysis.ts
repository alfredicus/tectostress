import * as math from 'mathjs';

interface StressTensorAnalysis {
    eigenvalues: number[];           // Principal stresses [σ1, σ2, σ3]
    eigenvectors: number[][];        // Principal stress directions
    eulerAngles: {
        phi: number;     // Rotation around Z-axis (azimuth)
        theta: number;   // Rotation around X-axis (inclination)  
        psi: number;     // Rotation around Z-axis again
    };
    principalStresses: {
        sigma1: { value: number; direction: number[] };
        sigma2: { value: number; direction: number[] };
        sigma3: { value: number; direction: number[] };
    };
}

/**
 * Helper function to convert mathjs Matrix to JavaScript array
 * Examples of usage:
 * - For 1D vector: matrixToArray(vector) returns number[]
 * - For 2D matrix: matrixToArray(matrix) returns number[][]
 */
export function matrixToArray(matrix: math.Matrix): number[] | number[][] {
    return matrix.toArray() as number[] | number[][];
}

/**
 * Helper function specifically for extracting column vectors from mathjs Matrix
 */
export function extractColumnVectors(matrix: any[]): number[][] {    
    const columns: number[][] = []
    for (let col = 0; col < 3; col++) {
        const a = matrix[col].vector.toArray()
        columns[col] = [];
        for (let row = 0; row < 3; row++) {
            columns[col][row] = a[row];
        }
    }
    return columns;
}

/**
 * Decompose a 3x3 stress tensor into eigenvalues, eigenvectors, and Euler angles
 * @param stressTensor 3x3 stress tensor matrix
 * @returns Analysis results including principal stresses and orientations
 */
export function decomposeStressTensor(stressTensor: number[][]): StressTensorAnalysis {
    // Ensure we have a proper 3x3 matrix
    if (stressTensor.length !== 3 || stressTensor.some(row => row.length !== 3)) {
        throw new Error('Stress tensor must be a 3x3 matrix');
    }

    // Convert to mathjs matrix for eigenvalue decomposition
    const matrix = math.matrix(stressTensor);
    
    // Calculate eigenvalues and eigenvectors
    const eigenResult = math.eigs(matrix);
    
    // Extract eigenvalues from Matrix object to plain JavaScript array
    const eigenvalues: number[] = (eigenResult.values as math.Matrix).toArray() as number[];
    
    // Handle complex eigenvalues (should be real for symmetric stress tensor)
    const realEigenvalues = eigenvalues.map(val => {
        if (math.typeOf(val) === 'Complex') {
            return (val as any).re;
        }
        return val;
    });

    // Extract eigenvectors from Matrix object and get column vectors
    const eigenvectors = extractColumnVectors(eigenResult.eigenvectors as math.Matrix);

    // Ensure we have the right number of eigenvalues and eigenvectors
    if (realEigenvalues.length !== 3 || eigenvectors.length !== 3) {
        throw new Error(`Expected 3 eigenvalues and eigenvectors, got ${realEigenvalues.length} and ${eigenvectors.length}`);
    }

    // Sort eigenvalues and eigenvectors by magnitude (σ1 ≥ σ2 ≥ σ3)
    const combined = realEigenvalues.map((val, idx) => ({
        value: val,
        vector: eigenvectors[idx]
    }));
    
    combined.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    
    const sortedEigenvalues = combined.map(item => item.value);
    const sortedEigenvectors = combined.map(item => item.vector);

    // Create rotation matrix from eigenvectors
    const rotationMatrix = [
        sortedEigenvectors[0],
        sortedEigenvectors[1], 
        sortedEigenvectors[2]
    ];

    // Calculate Euler angles (ZXZ convention)
    const eulerAngles = extractEulerAngles(rotationMatrix);

    return {
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
        }
    };
}

/**
 * Extract Euler angles from rotation matrix using ZXZ convention
 * @param rotationMatrix 3x3 rotation matrix
 * @returns Euler angles in radians
 */
function extractEulerAngles(rotationMatrix: number[][]): { phi: number; theta: number; psi: number } {
    const r = rotationMatrix;
    
    // ZXZ Euler angle extraction
    const theta = Math.acos(Math.max(-1, Math.min(1, r[2][2])));
    
    let phi, psi;
    
    if (Math.abs(Math.sin(theta)) < 1e-6) {
        // Gimbal lock case
        phi = 0;
        psi = Math.atan2(-r[0][1], r[0][0]);
    } else {
        phi = Math.atan2(r[0][2], -r[1][2]);
        psi = Math.atan2(r[2][0], r[2][1]);
    }
    
    return { phi, theta, psi };
}

/**
 * Convert Euler angles from radians to degrees
 */
export function eulerAnglesToDegrees(eulerAngles: { phi: number; theta: number; psi: number }) {
    return {
        phi: eulerAngles.phi * 180 / Math.PI,
        theta: eulerAngles.theta * 180 / Math.PI,
        psi: eulerAngles.psi * 180 / Math.PI
    };
}

/**
 * Calculate stress ratio R = (σ2 - σ3) / (σ1 - σ3)
 */
export function calculateStressRatio(eigenvalues: number[]): number {
    const [sigma1, sigma2, sigma3] = eigenvalues;
    if (Math.abs(sigma1 - sigma3) < 1e-10) {
        return 0; // Avoid division by zero
    }
    return (sigma2 - sigma3) / (sigma1 - sigma3);
}