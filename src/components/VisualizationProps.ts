import { DataFile } from './DataFile';

export default interface VisualizationProps {
    type: string;
    files: DataFile[];
    width?: number;
    height?: number;
}