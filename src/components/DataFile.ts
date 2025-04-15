export interface DataFile {
    id: string;
    name: string;
    headers: string[];
    content: Record<string, any>;//string[][];
    layout: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
}

export type DataFiles = DataFile[];