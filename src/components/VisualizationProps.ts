import { DataFile } from './DataFile';
import { VisualizationState } from './types';

export default interface VisualizationProps {
    type: string;
    files: DataFile[];
    width?: number;
    height?: number;
    state?: VisualizationState;
    onStateChange?: (state: VisualizationState) => void;
}