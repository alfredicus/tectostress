
export type Vector3 = [number, number, number];

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

export interface SharedData {
    sourceFile?: File;
    columns?: string[];
    data?: number[][];
}
