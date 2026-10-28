// aggregateBlock.ts
// Aggregate: merge several datasets into one (§11.1).

import { DataFile } from '../../components/DataFile';
import { BlockDefinition } from '../types';
import { countRows, stripInversionFields } from './datasetUtils';

const originKey = (row: Record<string, any>) =>
    row._origin ? `${row._origin.fileId}::${row._origin.rowIndex}` : undefined;

export const AggregateBlock: BlockDefinition = {
    type: 'aggregate',
    version: 1,
    title: 'Aggregate',
    description: 'Merge several datasets into one',
    category: 'Processing',
    role: 'computation',
    inputs: [{ id: 'in', label: 'Datasets', type: 'Dataset', multiple: true }],
    outputs: [{ id: 'out', label: 'Dataset', type: 'Dataset' }],
    params: [
        {
            key: 'mode', label: 'Rows received twice', kind: 'select', scope: 'scientific', default: 'unique',
            options: [{ value: 'unique', label: 'Keep once' }, { value: 'concatenate', label: 'Keep every copy' }],
            help: 'Rows are compared by the Data-tab file and row they come from',
        },
    ],

    async execute(ctx) {
        const inputs = ctx.inputs.in;
        const unique = ctx.params.mode === 'unique';
        const seen = new Set<string>();

        // Rows of the same Data-tab file go back into one file: views and predictions identify
        // rows by file id and position
        const byId = new Map<string, DataFile>();
        let dropped = 0;
        inputs.forEach(payload => {
            stripInversionFields(payload.files).forEach(file => {
                const rows = (file.content as any[]).filter(row => {
                    const key = originKey(row);
                    if (!unique || key === undefined) return true;
                    if (seen.has(key)) { dropped++; return false; }
                    seen.add(key);
                    return true;
                });
                const existing = byId.get(file.id);
                if (existing) existing.content = [...(existing.content as any[]), ...rows];
                else byId.set(file.id, { ...file, content: rows });
            });
        });

        const files = Array.from(byId.values());
        ctx.log('info', `${inputs.length} input(s) merged: ${countRows(files)} rows` +
            (dropped ? ` (${dropped} duplicate row(s) dropped)` : ''));
        return { outputs: { out: { type: 'Dataset', files } } };
    },
};
