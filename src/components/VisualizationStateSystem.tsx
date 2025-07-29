// ============================================================================
// BASE STATE INTERFACES
// ============================================================================

export interface CompState {
    type: string;
    open: boolean;
    settings: any;
}

export interface TCompState<T = any> extends CompState {
    settings: T;
    selectedColumn: string;
    plotDimensions: {
        width: number;
        height: number;
    };
}

// ============================================================================
// DATA COLUMN INTERFACE
// ============================================================================

export interface DataColumnInfo {
    fileName: string;
    fileId: string;
    columnName: string;
    columnIndex: number;
    dataType: 'number' | 'string';
    sampleValues: any[];
}

// ============================================================================
// SPECIFIC SETTINGS INTERFACES
// ============================================================================

export interface RoseSettings {
    binAngle: number;
    binColor: string;
    lineColor: string;
    showLines: boolean;
    is360: boolean;
    showLabels: boolean;
    showCardinals: boolean;
    showCircles: boolean;
    innerRadius: number;
}

export interface HistogramSettings {
    bins: number;
    fillColor: string;
    strokeColor: string;
    showGrid: boolean;
    showDensity: boolean;
    showLabels: boolean;
    xAxisLabel: string;
    yAxisLabel: string;
}

export interface WulffSettings {
    projection: 'stereonet' | 'equal-area';
    hemisphere: 'upper' | 'lower';
    showGrid: boolean;
    gridSpacing: number;
    pointSize: number;
    pointColor: string;
}

export interface MohrSettings {
    sigma1: number;
    sigma2: number;
    sigma3: number;
    n1: number;
    n2: number;
    n3: number;
    showGrid: boolean;
    showLabels: boolean;
    showColoredArea: boolean;
    showStressPoint: boolean;
    circle1Color: string;
    circle2Color: string;
    circle3Color: string;
    areaColor: string;
    stressPointColor: string;
    strokeWidth: number;
}

// ============================================================================
// COMPONENT STATE TYPES
// ============================================================================

export interface RoseCompState extends TCompState<RoseSettings> {
    type: 'rose';
}

export interface HistogramCompState extends TCompState<HistogramSettings> {
    type: 'histogram';
}

export interface WulffCompState extends TCompState<WulffSettings> {
    type: 'wulff';
}

export interface MohrCompState extends TCompState<MohrSettings> {
    type: 'mohr';
}

export type VisualizationCompState = RoseCompState | HistogramCompState | WulffCompState | MohrCompState;

// ============================================================================
// BASE VISUALIZATION COMPONENT INTERFACE
// ============================================================================

export interface BaseVisualizationProps<T extends TCompState> {
    files: DataFiles;
    width?: number;
    height?: number;
    title?: string;
    state?: T;
    onStateChange?: (state: T) => void;
    onDimensionChange?: (newWidth: number, newHeight: number) => void;
}

// ============================================================================
// STATE MANAGER CLASS
// ============================================================================

export class VisualizationStateManager {
    private states: Map<string, TCompState> = new Map();
    private stateChangeListeners: Map<string, (state: TCompState) => void> = new Map();

    // Register a state change listener for a component
    registerStateListener<T extends TCompState>(
        componentId: string,
        listener: (state: T) => void
    ): void {
        this.stateChangeListeners.set(componentId, listener as (state: TCompState) => void);
    }

    // Add or update a component state
    setState<T extends TCompState>(componentId: string, state: T): void {
        this.states.set(componentId, state);

        // Notify listener if registered
        const listener = this.stateChangeListeners.get(componentId);
        if (listener) {
            listener(state);
        }
    }

    // Get a component state
    getState<T extends TCompState>(componentId: string): T | undefined {
        return this.states.get(componentId) as T;
    }

    // Update settings for a component
    updateSettings<T>(componentId: string, newSettings: Partial<T>): void {
        const currentState = this.states.get(componentId);
        if (currentState) {
            const updatedState = {
                ...currentState,
                settings: { ...currentState.settings, ...newSettings }
            };
            this.setState(componentId, updatedState);
        }
    }

    // Update selected column
    updateSelectedColumn(componentId: string, selectedColumn: string): void {
        const currentState = this.states.get(componentId);
        if (currentState) {
            const updatedState = {
                ...currentState,
                selectedColumn
            };
            this.setState(componentId, updatedState);
        }
    }

    // Update plot dimensions
    updatePlotDimensions(componentId: string, dimensions: { width: number; height: number }): void {
        const currentState = this.states.get(componentId);
        if (currentState) {
            const updatedState = {
                ...currentState,
                plotDimensions: dimensions
            };
            this.setState(componentId, updatedState);
        }
    }

    // Toggle settings panel
    toggleSettingsPanel(componentId: string): void {
        const currentState = this.states.get(componentId);
        if (currentState) {
            const updatedState = {
                ...currentState,
                open: !currentState.open
            };
            this.setState(componentId, updatedState);
        }
    }

    // Get all states (for serialization)
    getAllStates(): Record<string, TCompState> {
        const result: Record<string, TCompState> = {};
        this.states.forEach((state, id) => {
            result[id] = state;
        });
        return result;
    }

    // Restore all states (from deserialization)
    restoreAllStates(states: Record<string, TCompState>): void {
        Object.entries(states).forEach(([id, state]) => {
            this.setState(id, state);
        });
    }

    // Clear all states
    clearAllStates(): void {
        this.states.clear();
        this.stateChangeListeners.clear();
    }

    // Export states as JSON
    exportStates(): string {
        return JSON.stringify(this.getAllStates(), null, 2);
    }

    // Import states from JSON
    importStates(jsonString: string): void {
        try {
            const states = JSON.parse(jsonString);
            this.restoreAllStates(states);
        } catch (error) {
            console.error('Failed to import states:', error);
        }
    }
}

// ============================================================================
// COLUMN EXTRACTION UTILITY
// ============================================================================

export class ColumnExtractor {
    static extractNumericColumns(files: DataFiles): DataColumnInfo[] {
        const columns: DataColumnInfo[] = [];

        files.forEach(file => {
            file.headers.forEach((header, index) => {
                if (index !== 0) { // Skip first column if it's an index
                    const sampleValues = file.content.slice(0, 10).map(row => {
                        if (Array.isArray(row)) {
                            return row[index];
                        } else {
                            return row[header];
                        }
                    }).filter(val => val !== undefined && val !== null);

                    const numericValues = sampleValues.filter(val => {
                        const num = Number(val);
                        return !isNaN(num) && isFinite(num);
                    });

                    // Consider column numeric if at least 70% of sample values are numeric
                    const isNumeric = numericValues.length / sampleValues.length >= 0.7;

                    if (isNumeric && sampleValues.length > 0) {
                        columns.push({
                            fileName: file.name,
                            fileId: file.id,
                            columnName: header,
                            columnIndex: index,
                            dataType: 'number',
                            sampleValues: numericValues
                        });
                    }
                }
            });
        });

        return columns;
    }

    static getColumnData(files: DataFiles, selectedColumn: string): number[] {
        if (!selectedColumn) return [];

        const [fileId, columnIndexStr] = selectedColumn.split('::');
        const columnIndex = parseInt(columnIndexStr);

        const file = files.find(f => f.id === fileId);
        if (!file) return [];

        const data: number[] = [];

        file.content.forEach(row => {
            let value;
            if (Array.isArray(row)) {
                value = row[columnIndex];
            } else {
                const header = file.headers[columnIndex];
                value = row[header];
            }

            const num = Number(value);
            if (!isNaN(num) && isFinite(num)) {
                data.push(num);
            }
        });

        return data;
    }
}

// ============================================================================
// BASE VISUALIZATION HOOK
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';

export function useVisualizationState<T extends TCompState>(
    componentId: string,
    defaultSettings: T['settings'],
    files: DataFiles,
    width: number = 400,
    height: number = 400,
    initialState?: T,
    onStateChange?: (state: T) => void
) {
    // State manager instance (could be injected via context)
    const stateManager = useRef(new VisualizationStateManager()).current;

    // Available columns
    const [availableColumns, setAvailableColumns] = useState<DataColumnInfo[]>([]);

    // Initialize state from props or defaults
    const [state, setState] = useState<T>(() => {
        if (initialState) {
            return initialState;
        }
        return {
            type: componentId.split('-')[0], // Extract type from ID
            open: false,
            settings: defaultSettings,
            selectedColumn: '',
            plotDimensions: { width, height }
        } as T;
    });

    // Extract columns when files change
    useEffect(() => {
        const columns = ColumnExtractor.extractNumericColumns(files);
        setAvailableColumns(columns);

        // Auto-select first column if none selected and no state was restored
        if (columns.length > 0 && !state.selectedColumn && !initialState?.selectedColumn) {
            const firstColumn = `${columns[0].fileId}::${columns[0].columnIndex}`;
            updateSelectedColumn(firstColumn);
        }
    }, [files, initialState?.selectedColumn]);

    // Notify parent and state manager of changes
    const notifyStateChange = useCallback((newState: T) => {
        stateManager.setState(componentId, newState);
        onStateChange?.(newState);
    }, [componentId, stateManager, onStateChange]);

    // Update functions
    const updateSettings = useCallback((newSettings: Partial<T['settings']>) => {
        const newState = {
            ...state,
            settings: { ...state.settings, ...newSettings }
        } as T;
        setState(newState);
        notifyStateChange(newState);
    }, [state, notifyStateChange]);

    const updateSelectedColumn = useCallback((selectedColumn: string) => {
        const newState = { ...state, selectedColumn } as T;
        setState(newState);
        notifyStateChange(newState);
    }, [state, notifyStateChange]);

    const updatePlotDimensions = useCallback((dimensions: { width: number; height: number }) => {
        const newState = { ...state, plotDimensions: dimensions } as T;
        setState(newState);
        notifyStateChange(newState);
    }, [state, notifyStateChange]);

    const toggleSettingsPanel = useCallback(() => {
        const newState = { ...state, open: !state.open } as T;
        setState(newState);
        notifyStateChange(newState);
    }, [state, notifyStateChange]);

    const resetToDefaults = useCallback(() => {
        const newState = {
            ...state,
            settings: defaultSettings,
            open: false
        } as T;
        setState(newState);
        notifyStateChange(newState);
    }, [state, defaultSettings, notifyStateChange]);

    // Get selected column data
    const getSelectedColumnData = useCallback(() => {
        return ColumnExtractor.getColumnData(files, state.selectedColumn);
    }, [files, state.selectedColumn]);

    // Get selected column info
    const getSelectedColumnInfo = useCallback(() => {
        return availableColumns.find(col =>
            `${col.fileId}::${col.columnIndex}` === state.selectedColumn
        );
    }, [availableColumns, state.selectedColumn]);

    return {
        state,
        availableColumns,
        updateSettings,
        updateSelectedColumn,
        updatePlotDimensions,
        toggleSettingsPanel,
        resetToDefaults,
        getSelectedColumnData,
        getSelectedColumnInfo,
        stateManager
    };
}

// ============================================================================
// DEFAULT SETTINGS FACTORY
// ============================================================================

export class DefaultSettingsFactory {
    static createRoseSettings(): RoseSettings {
        return {
            binAngle: 10,
            binColor: '#FF0000',
            lineColor: '#000000',
            showLines: true,
            is360: false,
            showLabels: false,
            showCardinals: true,
            showCircles: true,
            innerRadius: 5,
        };
    }

    static createHistogramSettings(): HistogramSettings {
        return {
            bins: 20,
            fillColor: '#3498db',
            strokeColor: '#2c3e50',
            showGrid: true,
            showDensity: false,
            showLabels: true,
            xAxisLabel: 'Value',
            yAxisLabel: 'Frequency',
        };
    }

    static createWulffSettings(): WulffSettings {
        return {
            projection: 'stereonet',
            hemisphere: 'upper',
            showGrid: true,
            gridSpacing: 10,
            pointSize: 3,
            pointColor: '#3498db',
        };
    }

    static createDefaultState<T extends TCompState>(
        type: string,
        settings: T['settings'],
        width: number = 400,
        height: number = 400
    ): T {
        return {
            type,
            open: false,
            settings,
            selectedColumn: '',
            plotDimensions: { width, height }
        } as T;
    }

    static createMohrSettings(): MohrSettings {
        return {
            sigma1: 100,
            sigma2: 60,
            sigma3: 20,
            n1: 1 / Math.sqrt(3),
            n2: 1 / Math.sqrt(3),
            n3: 1 / Math.sqrt(3),
            showGrid: true,
            showLabels: true,
            showColoredArea: true,
            showStressPoint: true,
            circle1Color: '#0066cc',
            circle2Color: '#ff6b35',
            circle3Color: '#28a745',
            areaColor: 'rgba(200, 200, 200, 0.3)',
            stressPointColor: '#8e44ad',
            strokeWidth: 2
        };
    }
}

// ============================================================================
// EXPORT DATA UTILITIES
// ============================================================================

export class DataExporter {
    static exportCSV(data: number[], filename: string = 'data.csv'): void {
        let csv = 'Value\n';
        data.forEach(value => {
            csv += `${value}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }

    static exportState<T extends TCompState>(state: T, filename: string = 'component-state.json'): void {
        const json = JSON.stringify(state, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }
}

// ============================================================================
// COMMON UI COMPONENTS
// ============================================================================

import React from 'react';

// Column Selector Component
export interface ColumnSelectorProps {
    availableColumns: DataColumnInfo[];
    selectedColumn: string;
    onColumnChange: (column: string) => void;
    label?: string;
}

export const ColumnSelector: React.FC<ColumnSelectorProps> = ({
    availableColumns,
    selectedColumn,
    onColumnChange,
    label = "Select Data Column"
}) => (
    <div className="mb-4 flex-shrink-0">
        <label className="block text-sm font-medium mb-2">{label}</label>
        <select
            value={selectedColumn}
            onChange={(e) => onColumnChange(e.target.value)}
            className="w-full p-2 border rounded bg-white text-sm"
        >
            <option value="">Choose a column...</option>
            {availableColumns.map(col => (
                <option
                    key={`${col.fileId}::${col.columnIndex}`}
                    value={`${col.fileId}::${col.columnIndex}`}
                >
                    {col.fileName} → {col.columnName}
                </option>
            ))}
        </select>
    </div>
);

// Color Input Component
export interface ColorInputProps {
    value: string;
    onChange: (value: string) => void;
    label: string;
    disabled?: boolean;
}

export const ColorInput: React.FC<ColorInputProps> = ({
    value,
    onChange,
    label,
    disabled = false
}) => (
    <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700 min-w-[80px]">{label}:</label>
        <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="w-8 h-6 border border-gray-300 rounded cursor-pointer disabled:opacity-50"
        />
        <span className="text-xs text-gray-500">{value}</span>
    </div>
);

// Number Input Component
export interface NumberInputProps {
    value: number;
    onChange: (value: number) => void;
    label: string;
    min?: number;
    max?: number;
    step?: number;
}

export const NumberInput: React.FC<NumberInputProps> = ({
    value,
    onChange,
    label,
    min = 0,
    max = 100,
    step = 1
}) => (
    <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700 min-w-[80px]">{label}:</label>
        <input
            type="number"
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            min={min}
            max={max}
            step={step}
            className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
    </div>
);

// Column Info Display Component
export interface ColumnInfoProps {
    columnInfo: DataColumnInfo | undefined;
}

export const ColumnInfo: React.FC<ColumnInfoProps> = ({ columnInfo }) => {
    if (!columnInfo) return null;

    return (
        <div className="border-t pt-4">
            <h5 className="font-medium text-gray-800 mb-2">Column Info</h5>
            <div className="p-3 bg-white rounded border">
                <div className="text-sm space-y-1">
                    <div><strong>File:</strong> {columnInfo.fileName}</div>
                    <div><strong>Column:</strong> {columnInfo.columnName}</div>
                    <div><strong>Sample values:</strong> {columnInfo.sampleValues.slice(0, 3).join(', ')}...</div>
                </div>
            </div>
        </div>
    );
};