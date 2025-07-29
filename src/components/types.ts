
export type Vector3 = [number, number, number];

export interface SharedData {
    sourceFile?: File;
    columns?: string[];
    data?: number[][];
}

// ----------------------------------------------------

/**
 * Represents the state of a visualization.
 * This interface can be extended for specific visualization types.
 */
export interface VisualizationState {
    type: string;
}

export interface Visualization {
    id: string;
    type: string;
    title: string;
    layout: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    state?: VisualizationState;
    data?: any;
}

// ----------------------------------------------------

// Result interfaces
export interface StressSolution {
    stressRatio: number;
    misfit: number;
    stressTensorSolution: number[][];
    analysis?: {
        eigenvalues: number[];
        eigenvectors: number[][];
        eulerAngles: { phi: number; theta: number; psi: number };
        eulerAnglesDegrees: { phi: number; theta: number; psi: number };
        principalStresses: {
            sigma1: { value: number; direction: number[] };
            sigma2: { value: number; direction: number[] };
            sigma3: { value: number; direction: number[] };
        };
        calculatedStressRatio: number;
    };
}

























/*
export interface BaseVisualizationState {
    type: string;
}

export interface StressSphereState extends BaseVisualizationState {
    type: 'sphere';
    cameraPosition: {
        x: number;
        y: number;
        z: number;
    };
    cameraTarget: {
        x: number;
        y: number;
        z: number;
    };
    rotation: {
        x: number;
        y: number;
        z: number;
    };
    displayedFiles: string[]; // Array of file IDs
}

export interface RoseDiagramState extends BaseVisualizationState {
    type: 'rose';
    // Add rose-specific state here
    scale?: number;
    rotation?: number;
}

// Union type for all possible visualization states
export type VisualizationState = StressSphereState | RoseDiagramState;

*/
