// Test fixtures: example datasets parsed as the Data tab does, a seeded Math.random and helpers.

import { DataFile } from '../../components/DataFile';
import { processCSV } from '../../io/CSVParsing';
import { synthetic_faults } from '../../components/data/synthetic-faults';
import { synthetic_2 } from '../../components/data/synthetic-2';
import { fileRef } from '../blocks/datasetUtils';
import { Workflow, WorkflowEnvironment, WorkflowNode } from '../types';

export function exampleFiles(model: { examples: Record<string, { name: string; csv: string }> }, prefix: string): DataFile[] {
    return Object.entries(model.examples).map(([key, ex]) => {
        const r = processCSV(ex.csv);
        return { id: `${prefix}-${key}`, name: ex.name, headers: r.headers, content: r.data, layout: { x: 0, y: 0, w: 4, h: 2 } };
    });
}

export const faultFiles = () => exampleFiles(synthetic_faults as any, 'faults');
export const synthetic2Files = () => exampleFiles(synthetic_2 as any, 'syn2');

export function env(files: DataFile[]): WorkflowEnvironment {
    return { files, appVersion: 'test', stressLibVersion: 'test' };
}

/** Deterministic Math.random, so stochastic search methods give reproducible results */
export function seedRandom(seed: number): () => void {
    const original = Math.random;
    let s = seed >>> 0;
    Math.random = () => {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return () => { Math.random = original; };
}

/** Fast inversion settings for tests */
export const FAST_INVERSION = {
    method: 'Monte Carlo (Euler)',
    misfitCriterion: 'ANGLE',
    methodParams: { nbRandomTrials: 2000 },
};

export function node(id: string, type: string, scientificParams: Record<string, any> = {}, extra: Partial<WorkflowNode> = {}): WorkflowNode {
    return { id, type, typeVersion: 1, active: true, scientificParams, presentationParams: {}, position: { x: 0, y: 0 }, ...extra };
}

let edgeCounter = 0;
export function edge(source: string, sourcePort: string, target: string, targetPort = 'in') {
    return { id: `e${++edgeCounter}`, source, sourcePort, target, targetPort };
}

export function workflow(nodes: WorkflowNode[], edges: ReturnType<typeof edge>[]): Workflow {
    return { schemaVersion: 1, name: 'test', nodes, edges };
}

/** Data block reading the given files */
export const dataNode = (id: string, files: DataFile[]) => node(id, 'data', { files: files.map(fileRef) });

const QUARTER_TURN: Record<string, string> = { n: 'E', ne: 'SE', e: 'S', se: 'SW', s: 'W', sw: 'NW', w: 'N', nw: 'NE' };

/**
 * The same data rotated 90° clockwise about the vertical, as if produced by a stress state rotated
 * by 90°: a second "tectonic phase" for tests. Strike and directions turn, rake and sense stay.
 */
export function rotatedFiles(files: DataFile[], suffix = 'rotated'): DataFile[] {
    const turn = (d: unknown) => typeof d === 'string' && QUARTER_TURN[d.toLowerCase()] ? QUARTER_TURN[d.toLowerCase()] : d;
    return files.map(file => ({
        ...file,
        id: `${file.id}-${suffix}`,
        name: `${file.name} (${suffix})`,
        content: (file.content as any[]).map(row => {
            const r: any = { ...row, id: `${row.id}-${suffix}` };
            if (typeof r.strike === 'number') r.strike = (r.strike + 90) % 360;
            ['dip direction', 'dipDirection', 'strike direction', 'strikeDirection'].forEach(k => { if (k in r) r[k] = turn(r[k]); });
            ['striation trend', 'striationTrend'].forEach(k => { if (typeof r[k] === 'number') r[k] = (r[k] + 90) % 360; });
            return r;
        }),
    }));
}
