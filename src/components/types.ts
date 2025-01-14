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
    data?: any;
}

export interface SharedData {
    sourceFile?: File;
    columns?: string[];
    data?: number[][];
}
