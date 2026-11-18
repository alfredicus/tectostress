// Resample block: a subset of the data, at random (reproducible) or not, by number or percentage

import { createDefaultRegistry } from '../blocks';
import { samplePositions, sampleSize } from '../blocks/resampleBlock';
import { countRows, rowsOf } from '../blocks/datasetUtils';
import { runWorkflow } from '../executor';
import { DatasetPayload, InversionResultPayload } from '../types';
import { dataNode, edge, env, FAST_INVERSION, node, seedRandom, synthetic2Files, workflow } from './fixtures';

jest.setTimeout(60000);
const registry = createDefaultRegistry();

describe('how many and which', () => {
    test('size: a number or a percentage, never more than available', () => {
        expect(sampleSize(60, 25, 'percent')).toBe(15);
        expect(sampleSize(60, 0.5, 'percent')).toBe(1);   // at least one when > 0
        expect(sampleSize(60, 150, 'percent')).toBe(60);
        expect(sampleSize(60, 20, 'count')).toBe(20);
        expect(sampleSize(60, 100, 'count')).toBe(60);
        expect(sampleSize(60, 0, 'count')).toBe(0);
    });

    test('random: without replacement, the same for the same seed, another for another seed', () => {
        const a = samplePositions(100, 30, 'random', 7);
        expect(new Set(a).size).toBe(30);
        expect(a.every(p => p >= 0 && p < 100)).toBe(true);
        expect(samplePositions(100, 30, 'random', 7)).toEqual(a);
        expect(samplePositions(100, 30, 'random', 8)).not.toEqual(a);
    });

    test('evenly spaced and first', () => {
        expect(samplePositions(10, 5, 'regular')).toEqual([1, 3, 5, 7, 9]);
        expect(samplePositions(10, 3, 'first')).toEqual([0, 1, 2]);
        expect(samplePositions(10, 12, 'random', 1)).toHaveLength(10);
    });
});

describe('in a workflow', () => {
    test('sample and left out share the data, across files, in their order', async () => {
        const files = synthetic2Files();
        const total = countRows(files);
        const wf = workflow([dataNode('d', files), node('r', 'resample', { method: 'random', size: 40, unit: 'percent', seed: 3 })], [edge('d', 'out', 'r')]);
        const r = await runWorkflow(wf, registry, env(files));
        const sample = r.nodes.r.outputs.out as DatasetPayload;
        const rest = r.nodes.r.outputs.rest as DatasetPayload;
        expect(countRows(sample.files)).toBe(Math.round(total * 0.4));
        expect(countRows(sample.files) + countRows(rest.files)).toBe(total);
        // Nothing in both, nothing lost, original order kept
        const ids = (p: DatasetPayload) => p.files.flatMap(f => rowsOf(f).map(row => `${f.id}:${row.id}`));
        expect(new Set([...ids(sample), ...ids(rest)]).size).toBe(total);
        sample.files.forEach((f, k) => {
            const order = rowsOf(files[k]).map(row => row.id);
            const kept = rowsOf(f).map(row => order.indexOf(row.id));
            expect(kept).toEqual([...kept].sort((a, b) => a - b));
        });
        // Run again: the same sample
        const again = await runWorkflow(wf, registry, env(files));
        expect(ids(again.nodes.r.outputs.out as DatasetPayload)).toEqual(ids(sample));
    });

    test('an inversion result stays one (its solution), and can be inverted again', async () => {
        const restore = seedRandom(5);
        try {
            const files = synthetic2Files();
            const wf = workflow([
                dataNode('d', files), node('i', 'inversion', FAST_INVERSION),
                node('r', 'resample', { method: 'regular', size: 8, unit: 'count' }), node('i2', 'inversion', FAST_INVERSION),
            ], [edge('d', 'out', 'i'), edge('i', 'out', 'r'), edge('r', 'out', 'i2')]);
            const r = await runWorkflow(wf, registry, env(files));
            const sample = r.nodes.r.outputs.out as InversionResultPayload;
            expect(sample.type).toBe('InversionResult');
            expect(countRows(sample.files)).toBe(8);
            expect(r.nodes.i2.status).toBe('done');
        } finally { restore(); }
    });
});
