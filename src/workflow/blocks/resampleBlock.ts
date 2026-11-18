// resampleBlock.ts
// Resample: keep a subset of the data, chosen at random (reproducible, from a seed) or evenly
// spaced, of a given number of data or a percentage. The data left out are a second output.

import { DataFile } from '../../components/DataFile';
import { BlockDefinition, Payload } from '../types';
import { countRows, rowsOf } from './datasetUtils';

export type ResampleMethod = 'random' | 'regular' | 'first';

/** Reproducible random numbers in [0, 1) from a seed (mulberry32) */
function seededRandom(seed: number): () => number {
    let s = (Math.floor(seed) >>> 0) || 1;
    return () => {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** How many of `total` data to keep: a number, or a percentage (rounded, at least one if > 0) */
export function sampleSize(total: number, size: number, unit: 'count' | 'percent'): number {
    if (!Number.isFinite(size) || size <= 0 || total === 0) return 0;
    const n = unit === 'percent' ? Math.max(1, Math.round(total * Math.min(size, 100) / 100)) : Math.floor(size);
    return Math.min(n, total);
}

/**
 * Positions (0 … total−1, increasing) of the `n` data kept:
 * - random: drawn without replacement, the same for the same seed;
 * - regular: evenly spaced over the whole set (every total/n-th);
 * - first: the first n.
 */
export function samplePositions(total: number, n: number, method: ResampleMethod, seed = 1): number[] {
    if (n >= total) return Array.from({ length: total }, (_, i) => i);
    if (n <= 0) return [];
    if (method === 'first') return Array.from({ length: n }, (_, i) => i);
    if (method === 'regular') {
        const step = total / n;
        return Array.from({ length: n }, (_, i) => Math.floor(i * step + step / 2));
    }
    // Partial Fisher–Yates: the first n of a random permutation
    const random = seededRandom(seed);
    const order = Array.from({ length: total }, (_, i) => i);
    for (let i = 0; i < n; i++) {
        const j = i + Math.floor(random() * (total - i));
        [order[i], order[j]] = [order[j], order[i]];
    }
    return order.slice(0, n).sort((a, b) => a - b);
}

export const ResampleBlock: BlockDefinition = {
    type: 'resample',
    version: 1,
    title: 'Resample',
    description: 'Keep a subset of the data: at random (reproducible from a seed), evenly spaced or the first ones; a number of data or a percentage',
    category: 'Processing',
    role: 'computation',
    inputs: [{
        id: 'in', label: 'Data', type: 'Dataset', meaning: {
            Dataset: 'Resampled; the outputs are measured data',
            InversionResult: 'Resampled; the outputs keep the solution of the inversion (re-invert the sample to get its own)',
        },
    }],
    outputs: [
        { id: 'out', label: 'Sample', type: 'Dataset', sameAs: 'in' },
        { id: 'rest', label: 'Left out', type: 'Dataset', sameAs: 'in' },
    ],
    bypass: { from: 'in', to: 'out' },
    params: [
        {
            key: 'method', label: 'Method', kind: 'select', scope: 'scientific', default: 'random',
            options: [
                { value: 'random', label: 'Random (without replacement)' },
                { value: 'regular', label: 'Evenly spaced' },
                { value: 'first', label: 'First data' },
            ],
        },
        {
            key: 'size', label: 'Sample size', kind: 'number', scope: 'scientific', default: 50, min: 0, step: 1,
            perIteration: true, help: 'A number of data, or a percentage: see “Size in”. More than available keeps everything',
        },
        {
            key: 'unit', label: 'Size in', kind: 'select', scope: 'scientific', default: 'percent',
            options: [{ value: 'percent', label: 'Percent of the data' }, { value: 'count', label: 'Number of data' }],
        },
        {
            key: 'seed', label: 'Random seed', kind: 'number', scope: 'scientific', default: 1, min: 1, step: 1,
            perIteration: true, help: 'Random method only: the same seed gives the same sample (another seed, another sample)',
        },
    ],

    async execute(ctx) {
        const input = ctx.inputs.in[0];
        const { method, size, unit, seed } = ctx.params;
        const total = countRows(input.files);
        const n = sampleSize(total, Number(size), unit);
        const kept = new Set(samplePositions(total, n, method, Number(seed)));

        // Positions run over all files in order; each output keeps the files and their row order
        let position = 0;
        const split = input.files.map((file): { sample: DataFile; rest: DataFile } => {
            const rows = rowsOf(file);
            const inSample = rows.map(() => kept.has(position++));
            return {
                sample: { ...file, content: rows.filter((_, i) => inSample[i]) },
                rest: { ...file, content: rows.filter((_, i) => !inSample[i]) },
            };
        });
        const how = method === 'random' ? `at random (seed ${seed})` : method === 'regular' ? 'evenly spaced' : 'the first ones';
        ctx.log('info', `Kept ${n} of ${total} data, ${how}; ${total - n} left out`);
        if (n === total && total > 0) ctx.log('warning', 'The sample size covers every datum: nothing was left out');

        const { provenance, ...body } = input;
        return {
            outputs: {
                out: { ...body, files: split.map(s => s.sample) } as Payload,
                rest: { ...body, files: split.map(s => s.rest) } as Payload,
            },
        };
    },
};
