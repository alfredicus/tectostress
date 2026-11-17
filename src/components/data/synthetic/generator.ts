// generator.ts
// Synthetic datasets of striated faults, tension fractures and stylolites produced by a known
// stress state, for testing inversions and workflows.
//
// Every row is encoded through the stress library itself (DataFactory + initialize), and its
// misfit is measured with the imposed tensor, so the examples agree with the inversion's own
// conventions (geographic frame East-North-Up, compression negative).
//
// Regenerate the examples with:  WRITE_SYNTHETIC=1 npx jest src/components/data/synthetic

import * as stressLib from '@alfredo-taboada/stress';
import { DataFactory } from '@alfredo-taboada/stress';
import { processCSV } from '../../../io/CSVParsing';

type V3 = [number, number, number];

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const norm = (a: V3): V3 => scale(a, 1 / Math.hypot(...a));
const rad = (d: number) => d * Math.PI / 180;
const deg = (r: number) => r * 180 / Math.PI;
const angle = (a: V3, b: V3) => deg(Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(b))))));
const axisAngle = (a: V3, b: V3) => deg(Math.acos(Math.min(1, Math.abs(dot(norm(a), norm(b))))));

/** Horizontal or plunging axis from trend and plunge (degrees), East-North-Up */
export const axis = (trend: number, plunge: number): V3 =>
    [Math.cos(rad(plunge)) * Math.sin(rad(trend)), Math.cos(rad(plunge)) * Math.cos(rad(trend)), -Math.sin(rad(plunge))];

/** Upward normal of a plane from dip azimuth and dip */
const planeNormal = (dipAzimuth: number, dip: number): V3 =>
    [Math.sin(rad(dip)) * Math.sin(rad(dipAzimuth)), Math.sin(rad(dip)) * Math.cos(rad(dipAzimuth)), Math.cos(rad(dip))];

/** Dip azimuth and dip of the plane normal to `n` */
function planeOf(n: V3): { dipAzimuth: number; dip: number } {
    const u = n[2] < 0 ? scale(n, -1) : n;
    return { dipAzimuth: (deg(Math.atan2(u[0], u[1])) + 360) % 360, dip: deg(Math.acos(Math.min(1, u[2]))) };
}

/** Rotation of `v` by `a` degrees about the unit axis `k` (Rodrigues) */
const rotate = (v: V3, k: V3, a: number): V3 =>
    add(add(scale(v, Math.cos(rad(a))), scale(cross(k, v), Math.sin(rad(a)))), scale(k, dot(k, v) * (1 - Math.cos(rad(a)))));

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const compass = (azimuth: number) => COMPASS[Math.round(((azimuth % 360) + 360) % 360 / 45) % 8];

const MOVEMENTS = [
    'Normal', 'Inverse', 'Right-lateral', 'Left-lateral',
    'Normal right-lateral', 'Normal left-lateral', 'Inverse right-lateral', 'Inverse left-lateral',
];

// ---- Random numbers, reproducible -------------------------------------------------------------

function mulberry32(seed: number) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Inverse of the standard normal distribution (Acklam's approximation, |error| < 1.2e-9) */
function normalQuantile(p: number): number {
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549671010173069e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const lo = 0.02425;
    if (p < lo) {
        const q = Math.sqrt(-2 * Math.log(p));
        return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p > 1 - lo) return -normalQuantile(1 - p);
    const q = p - 0.5, r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/**
 * `n` misfit angles following a half-Gaussian of standard deviation `sigma` (most data well
 * fitted, fewer and fewer up to the maximum): the quantiles at (i - ½)/n, so the histogram has
 * the shape of the curve whatever the number of data.
 */
export function halfGaussianAngles(n: number, sigma: number): number[] {
    return Array.from({ length: n }, (_, i) => sigma * normalQuantile(0.5 + 0.5 * (i + 0.5) / n));
}

// ---- Stress state ------------------------------------------------------------------------------

export interface StressState {
    /** σ1 and σ3 axes (unit, East-North-Up); σ2 completes the right-handed frame */
    sigma1: V3;
    sigma3: V3;
    /** R = (σ2 − σ3) / (σ1 − σ3) */
    R: number;
}

// The engine is in the built library but its module (geomeca) is missing from the type entry point
const HomogeneousEngine = (stressLib as any).HomogeneousEngine;

/** The library's engine for this stress state (rows of Hrot: σ1, σ3, σ2) */
export function engineOf(state: StressState) {
    return new HomogeneousEngine([state.sigma1, state.sigma3, cross(state.sigma1, state.sigma3)] as any, state.R);
}

/** Stress tensor as the library builds it (compression negative: σ1 = −1, σ2 = −R, σ3 = 0) */
export const stressOf = (state: StressState) => engineOf(state).stress([0, 0, 0]);

/** Normal and shear stress on a plane, compression positive, normalised (σ1 = 1, σ3 = 0) */
export function mohrPoint(state: StressState, n: V3): { normal: number; shear: number } {
    const S: number[][] = stressOf(state).S;
    const t: V3 = [0, 1, 2].map(i => -(S[i][0] * n[0] + S[i][1] * n[1] + S[i][2] * n[2])) as V3;
    const normal = dot(t, n);
    return { normal, shear: Math.hypot(...add(t, scale(n, -normal))) };
}

/** Direction of the shear stress on a plane: the striation the stress state predicts */
function shearDirection(state: StressState, n: V3): V3 {
    const S: number[][] = stressOf(state).S;
    const t: V3 = [0, 1, 2].map(i => S[i][0] * n[0] + S[i][1] * n[1] + S[i][2] * n[2]) as V3;
    return norm(add(t, scale(n, -dot(t, n))));
}

// ---- Rows, encoded and checked by the library ----------------------------------------------------

const HEADER = 'id;type;strike;dip;Dip direction;Rake;Strike direction;Striation trend;Type of movement;Deformation phase';

interface Row {
    id: number;
    type: 'Striated Plane' | 'Extension Fracture' | 'Stylolite Interface';
    strike: number;
    dip: number;
    dipDirection: string;
    rake?: number;
    strikeDirection?: string;
    movement?: string;
}

const line = (r: Row, phase: number) =>
    [r.id, r.type, r.strike, r.dip, r.dipDirection, r.rake ?? '', r.strikeDirection ?? '', '', r.movement ?? '', phase].join(';');

/** The library's reading of a row, as the Data tab and the inversion read it */
function readRow(r: Row): any {
    const parsed = processCSV(`${HEADER}\n${line(r, 1)}`).data[0];
    const datum: any = DataFactory.create(parsed.type);
    datum.initialize(parsed);
    return datum;
}

/** A plane given by integers, as measured in the field */
function planeRow(id: number, type: Row['type'], dipAzimuth: number, dip: number): Row {
    return { id, type, strike: (dipAzimuth + 270) % 360, dip, dipDirection: compass(dipAzimuth) };
}

/**
 * How a geologist would write it, among encodings the library reads the same: pure dip-slip at
 * rake 90, pure strike-slip at rake 0, both components otherwise; the compass letter nearest the
 * end of the strike the rake is measured from.
 */
function writingCost(row: Row): number {
    const combined = row.movement!.includes(' ');
    const naturalSense = row.rake === 0 || row.rake === 90 ? !combined : combined;
    const letter = COMPASS.indexOf(row.strikeDirection!) * 45;
    const gap = Math.min(...[row.strike, row.strike + 180].map(s => Math.abs((((letter - s) % 360) + 540) % 360 - 180)));
    return (naturalSense ? 0 : 1000) + gap;
}

/** The fault row (integer rake) whose striation is closest to `target` on the plane of `row` */
function encodeStriation(row: Row, target: V3): { row: Row; striation: V3; normal: V3 } {
    const n = planeNormal((row.strike + 90) % 360, row.dip);
    const strikeVector: V3 = [Math.sin(rad(row.strike)), Math.cos(rad(row.strike)), 0];
    const rake0 = Math.round(deg(Math.acos(Math.min(1, Math.abs(dot(target, strikeVector))))));
    let best: { row: Row; striation: V3; normal: V3; error: number } | null = null;
    for (const rake of [rake0 - 1, rake0, rake0 + 1].filter(r => r >= 0 && r <= 90)) {
        for (const strikeDirection of COMPASS) {
            for (const movement of MOVEMENTS) {
                const candidate: Row = { ...row, rake, strikeDirection, movement };
                let datum: any;
                try { datum = readRow(candidate); } catch { continue; }
                const error = angle(datum.nStriation, target);
                if (axisAngle(datum.nPlane, n) > 0.01) throw new Error(`Plane of row ${row.id} read differently by the library`);
                const better = !best || error < best.error - 1e-6
                    || (error < best.error + 1e-6 && writingCost(candidate) < writingCost(best.row));
                if (better) best = { row: candidate, striation: datum.nStriation, normal: datum.nPlane, error };
            }
        }
    }
    if (!best || best.error > 1) throw new Error(`No rake encodes the striation of row ${row.id}`);
    return best;
}

// ---- Choice of the fault planes ------------------------------------------------------------------

export const FRICTION = 0.6;   // Byerlee, φ ≈ 31°

export interface FaultChoice {
    dipAzimuth: number;
    dip: number;
    /** τ / σn in the normalised Mohr circle */
    ratio: number;
}

/**
 * 16 fault planes with dip directions spread around the compass (two per 45° sector), most in the
 * reactivation zone of the Mohr circle (τ ≥ μ σn) and a few just below its limit, all with enough
 * shear stress for the striation to be well defined.
 */
export function chooseFaults(state: StressState, seed: number, count = 16, nearLimit = 4): FaultChoice[] {
    const random = mulberry32(seed);
    const faults: FaultChoice[] = [];
    for (let i = 0; i < count; i++) {
        const sector = i % 8;
        const wantNear = i >= count - nearLimit;
        for (let attempt = 0; ; attempt++) {
            if (attempt > 200000) throw new Error('No fault plane found for the constraints');
            const dipAzimuth = Math.floor(sector * 45 + random() * 45);
            const dip = 15 + Math.floor(random() * 75);
            const { normal, shear } = mohrPoint(state, planeNormal(dipAzimuth, dip));
            if (shear < 0.15 || normal < 0.05) continue;
            const ratio = shear / normal;
            const ok = wantNear ? ratio >= 0.45 && ratio < FRICTION : ratio >= FRICTION;
            if (!ok) continue;
            if (faults.some(f => axisAngle(planeNormal(f.dipAzimuth, f.dip), planeNormal(dipAzimuth, dip)) < 10)) continue;
            faults.push({ dipAzimuth, dip, ratio });
            break;
        }
    }
    return faults;
}

// ---- A dataset ---------------------------------------------------------------------------------

export interface SyntheticSpec {
    /** First id; rows are numbered from it */
    firstId: number;
    phase: number;
    state: StressState;
    faults: FaultChoice[];
    /** Misfit angles to impose, one per datum (faults first, then fractures, then stylolites) */
    misfits?: number[];
    seed: number;
}

export interface SyntheticRow {
    id: number;
    type: Row['type'];
    /** Misfit with the imposed stress state, measured on the row as the library reads it */
    misfit: number;
    /** τ / σn for faults */
    ratio?: number;
}

export function generateDataset(spec: SyntheticSpec): { csv: string; rows: SyntheticRow[] } {
    const { state, faults, phase } = spec;
    const random = mulberry32(spec.seed);
    const misfits = spec.misfits ?? Array(faults.length + 4).fill(0);
    const sigma2 = cross(state.sigma1, state.sigma3);
    const rows: Row[] = [];
    const info: SyntheticRow[] = [];
    let id = spec.firstId;

    faults.forEach((f, i) => {
        const plane = planeRow(id++, 'Striated Plane', f.dipAzimuth, f.dip);
        const n = planeNormal(f.dipAzimuth, f.dip);
        const ideal = shearDirection(state, n);
        // The measured striation is turned on the plane by the misfit, one way or the other
        const target = rotate(ideal, n, misfits[i] * (random() < 0.5 ? -1 : 1));
        const { row, striation } = encodeStriation(plane, target);
        rows.push(row);
        info.push({ id: row.id, type: row.type, misfit: angle(striation, ideal), ratio: f.ratio });
    });

    // Tension fractures open normal to σ3, stylolites close normal to σ1
    ([['Extension Fracture', state.sigma3], ['Extension Fracture', state.sigma3],
      ['Stylolite Interface', state.sigma1], ['Stylolite Interface', state.sigma1]] as const).forEach(([type, ideal], k) => {
        const m = misfits[faults.length + k];
        // Tilt the normal by the misfit about an axis perpendicular to it (σ2 for an exact set)
        const turn = random() * 360;
        const perpendicular = norm(add(scale(sigma2, Math.cos(rad(turn))), scale(cross(ideal as V3, sigma2), Math.sin(rad(turn)))));
        const { dipAzimuth, dip } = planeOf(m ? rotate(ideal as V3, perpendicular, m) : ideal as V3);
        // The second of each pair is written the other way round (same plane): a horizontal
        // plane has no dip direction, a vertical one two
        const d = Math.round(dip);
        const azimuth = d === 0 ? (k % 2 ? 0 : 180) : (Math.round(dipAzimuth) + (d === 90 && k % 2 ? 180 : 0)) % 360;
        const row = planeRow(id++, type, azimuth, d);
        const datum = readRow(row);
        rows.push(row);
        info.push({ id: row.id, type, misfit: axisAngle(datum.normal, ideal as V3) });
    });

    return { csv: [HEADER, ...rows.map(r => line(r, phase))].join('\n'), rows: info };
}
