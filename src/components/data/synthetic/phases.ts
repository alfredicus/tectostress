// phases.ts
// The six synthetic datasets of the examples "Synthetic tectonic phases": three stress regimes,
// each (a) exact and (b) with misfits spread along a half-Gaussian. (a) and (b) of a regime share
// the same planes; only the striations (and fracture/stylolite orientations) differ.

import { axis, chooseFaults, generateDataset, halfGaussianAngles, StressState, SyntheticRow } from './generator';

export interface PhaseDefinition {
    key: string;
    name: string;
    /** Short id starting the example names: C-a, C-b… */
    letter: string;
    /** Written in the "Deformation phase" column: the true phase, for checking a separation */
    phase: number;
    state: StressState;
    description: string;
}

/** Trend and plunge in degrees */
export const PHASES: PhaseDefinition[] = [
    {
        key: 'compression', name: 'Compression', letter: 'C', phase: 1,
        state: { sigma1: axis(0, 0), sigma3: axis(0, -90), R: 0.5 },
        description: 'σ1 horizontal N–S, σ3 vertical, R = 0.5',
    },
    {
        key: 'extension', name: 'Extension', letter: 'E', phase: 2,
        state: { sigma1: axis(0, -90), sigma3: axis(90, 0), R: 0.5 },
        description: 'σ1 vertical, σ3 horizontal E–W, R = 0.5',
    },
    {
        key: 'strikeslip', name: 'Strike-slip', letter: 'S', phase: 3,
        state: { sigma1: axis(45, 0), sigma3: axis(135, 0), R: 0.5 },
        description: 'σ1 horizontal N045, σ3 horizontal N135, R = 0.5',
    },
];

/** Standard deviation of the half-Gaussian of misfits (b): 20 data then lie between 0 and 18° */
export const MISFIT_SIGMA = 8;

export interface SyntheticDataset {
    key: string;
    name: string;
    csv: string;
    rows: SyntheticRow[];
}

/** Ids: 101–120 compression (a), 201–220 (b), 301/401 extension, 501/601 strike-slip */
export function buildSyntheticPhases(): SyntheticDataset[] {
    return PHASES.flatMap((p, i) => {
        const faults = chooseFaults(p.state, 1000 + i);
        const exact = generateDataset({ firstId: 200 * i + 101, phase: p.phase, state: p.state, faults, seed: 2000 + i });

        // The 20 misfit angles, in a random order (reproducible)
        const angles = halfGaussianAngles(20, MISFIT_SIGMA);
        let s = 3000 + i;
        const order = angles.map((a, k) => ({ a, r: Math.sin(++s * 12.9898 + k) })).sort((x, y) => x.r - y.r).map(x => x.a);
        const noisy = generateDataset({ firstId: 200 * i + 201, phase: p.phase, state: p.state, faults, misfits: order, seed: 4000 + i });

        return [
            { key: `${p.key}-exact`, name: `${p.letter}-a ${p.name}, exact (${p.description})`, ...exact },
            { key: `${p.key}-misfit`, name: `${p.letter}-b ${p.name}, misfit 0–20° (${p.description})`, ...noisy },
        ];
    });
}
