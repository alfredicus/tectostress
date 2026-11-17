// filterBlocks.ts
// Filter (data type / column condition) and Misfit filter (after an inversion).

import { beautifyName, TypeSynonyms } from '../../utils/TypeSynonyms';
import { BlockDefinition, InversionResultPayload, Payload } from '../types';
import { countRows, filterRows } from './datasetUtils';

export const DATA_TYPE_OPTIONS = ['joint', 'fault', 'stylolite', 'dilation band', 'compaction band']
    .map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }));

const OPERATORS = ['none', '=', '≠', '<', '≤', '>', '≥', 'contains'] as const;
type Operator = typeof OPERATORS[number];

function matchesType(rowType: unknown, types: string[]): boolean {
    if (types.length === 0) return true;
    if (rowType == null) return false;
    return types.some(t => TypeSynonyms.typeExists(t)
        ? TypeSynonyms.isSameType(t, String(rowType))
        : beautifyName(String(rowType)) === beautifyName(t));
}

/** Rows missing the column, or with a value that cannot be compared, do not match */
function matchesCondition(row: Record<string, any>, column: string, op: Operator, value: string): boolean {
    if (op === 'none' || !column.trim()) return true;
    const cell = row[beautifyName(column)] ?? row[column];
    if (cell == null || cell === '') return false;

    if (op === 'contains') return String(cell).toLowerCase().includes(value.toLowerCase());

    const a = Number(cell), b = Number(value);
    const numeric = value.trim() !== '' && Number.isFinite(a) && Number.isFinite(b);
    const x: any = numeric ? a : String(cell).toLowerCase();
    const y: any = numeric ? b : value.toLowerCase();
    switch (op) {
        case '=': return x === y;
        case '≠': return x !== y;
        case '<': return x < y;
        case '≤': return x <= y;
        case '>': return x > y;
        case '≥': return x >= y;
    }
    return false;
}

export const FilterBlock: BlockDefinition = {
    type: 'filter',
    version: 1,
    title: 'Filter',
    description: 'Keep the rows of some data types, and/or matching a column condition',
    category: 'Processing',
    role: 'computation',
    inputs: [{
        id: 'in', label: 'Data', type: 'Dataset', meaning: {
            Dataset: 'Filtered; the output is measured data',
            InversionResult: 'Filtered; the output is an inversion result',
        },
    }],
    // Filtering an inversion result keeps it an inversion result (fewer rows, same solution)
    outputs: [{ id: 'out', label: 'Filtered', type: 'Dataset', sameAs: 'in' }],
    bypass: { from: 'in', to: 'out' },
    params: [
        {
            key: 'dataTypes', label: 'Data types', kind: 'multiselect', scope: 'scientific', default: [],
            options: DATA_TYPE_OPTIONS, help: 'None selected keeps every type'
        },
        { key: 'column', label: 'Column', kind: 'string', scope: 'scientific', default: '' },
        {
            key: 'operator', label: 'Condition', kind: 'select', scope: 'scientific', default: 'none',
            options: OPERATORS.map(o => ({ value: o, label: o === 'none' ? 'No condition' : o }))
        },
        { key: 'value', label: 'Value', kind: 'string', scope: 'scientific', default: '' },
    ],

    async execute(ctx) {
        const input = ctx.inputs.in[0];
        const { dataTypes, column, operator, value } = ctx.params;
        const files = filterRows(input.files, row =>
            matchesType(row.type, dataTypes) && matchesCondition(row, column, operator, String(value)));
        ctx.log('info', `Kept ${countRows(files)} of ${countRows(input.files)} rows`);
        const { provenance, ...body } = input;
        return { outputs: { out: { ...body, files } as Payload } };
    },
};

export const MisfitFilterBlock: BlockDefinition = {
    type: 'misfit-filter',
    // v2 (§14.4): Kept is an inversion result too, and All (marked) gives both populations
    version: 2,
    title: 'Misfit filter',
    description: 'Split an inversion result by the angular misfit of each datum',
    category: 'Processing',
    role: 'computation',
    inputs: [{ id: 'in', label: 'Inversion result', type: 'InversionResult' }],
    // All three keep the inversion's solution, predictions and misfits, so every view can show
    // them; each datum is classified (misfit_class, misfit_threshold). Re-inverting Kept is
    // unaffected: the Inversion ignores earlier predictions.
    outputs: [
        { id: 'kept', label: 'Kept', type: 'InversionResult' },
        { id: 'rejected', label: 'Rejected', type: 'InversionResult' },
        { id: 'all', label: 'All (marked)', type: 'InversionResult' },
    ],
    bypass: { from: 'in', to: 'kept' },
    params: [
        {
            key: 'threshold', label: 'Maximum misfit', kind: 'number', scope: 'scientific', default: 30,
            min: 0, max: 180, step: 1, unit: '°', help: 'Data with a larger misfit are rejected',
            perIteration: true,
        },
        {
            key: 'unpredicted', label: 'Data without prediction', kind: 'select', scope: 'scientific', default: 'kept',
            options: [{ value: 'kept', label: 'Keep' }, { value: 'rejected', label: 'Reject' }],
            help: 'Data the inversion could not predict (unsupported type, zero shear stress)'
        },
    ],

    async execute(ctx) {
        const input = ctx.inputs.in[0] as InversionResultPayload;
        const threshold = Number(ctx.params.threshold);
        const rejectUnpredicted = ctx.params.unpredicted === 'rejected';
        const isRejected = (row: Record<string, any>) => row.misfit_angle == null
            ? rejectUnpredicted
            : row.misfit_angle > threshold;

        // Every datum says which population it belongs to, and by which threshold
        const all = input.files.map(file => ({
            ...file,
            content: ((file.content as any[]) ?? []).map(row => ({
                ...row,
                misfit_class: isRejected(row) ? 'rejected' : 'kept',
                misfit_threshold: threshold,
            })),
        }));
        const kept = filterRows(all, row => row.misfit_class === 'kept');
        const rejected = filterRows(all, row => row.misfit_class === 'rejected');
        ctx.log('info', `Kept ${countRows(kept)}, rejected ${countRows(rejected)} (misfit > ${threshold}°)`);

        const { provenance, ...body } = input;
        return {
            outputs: {
                kept: { ...body, files: kept },
                rejected: { ...body, files: rejected },
                all: { ...body, files: all },
            },
        };
    },
};
