import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Data } from '@alfredo-taboada/stress';
import { StressSolution } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type ParamKey = 'phi' | 'theta' | 'psi' | 'R';

const ALL_PARAMS: ParamKey[] = ['phi', 'theta', 'psi', 'R'];

const PARAM_LABEL: Record<ParamKey, string> = {
    phi: 'φ', theta: 'θ', psi: 'ψ', R: 'R',
};

const PARAM_UNIT: Record<ParamKey, string> = {
    phi: '°', theta: '°', psi: '°', R: '',
};

const DEG2RAD = Math.PI / 180;

function isAngle(k: ParamKey): boolean { return k !== 'R'; }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

// ─── Colormap: rainbow (low misfit = blue, high = red) ───────────────────────
function rainbow(t: number): [number, number, number] {
    t = Math.max(0, Math.min(1, t));
    // blue → cyan → green → yellow → red
    const stops: [number, number, number][] = [
        [  0,   0, 255],   // t=0  blue  (best / low misfit)
        [  0, 255, 255],   // t=0.25 cyan
        [  0, 255,   0],   // t=0.5  green
        [255, 255,   0],   // t=0.75 yellow
        [255,   0,   0],   // t=1  red   (worst / high misfit)
    ];
    const idx = t * (stops.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, stops.length - 1);
    const f  = idx - lo;
    return [
        stops[lo][0] + (stops[hi][0] - stops[lo][0]) * f,
        stops[lo][1] + (stops[hi][1] - stops[lo][1]) * f,
        stops[lo][2] + (stops[hi][2] - stops[lo][2]) * f,
    ];
}

// ─── Rotation math (ZXZ Euler, absolute angles) ───────────────────────────────
type Mat3 = [[number,number,number],[number,number,number],[number,number,number]];

function buildDTrot(phi: number, theta: number, psi: number): Mat3 {
    const cp = Math.cos(phi),  sp = Math.sin(phi);
    const ct = Math.cos(theta), st = Math.sin(theta);
    const ca = Math.cos(psi),  sa = Math.sin(psi);
    return [
        [ cp*ct,  -sp*ca + cp*st*sa,   sp*sa + cp*st*ca ],
        [ sp*ct,   cp*ca + sp*st*sa,  -cp*sa + sp*st*ca ],
        [ -st,     ct*sa,              ct*ca             ],
    ];
}

function transpose(A: Mat3): Mat3 {
    return [
        [A[0][0], A[1][0], A[2][0]],
        [A[0][1], A[1][1], A[2][1]],
        [A[0][2], A[1][2], A[2][2]],
    ];
}

/**
 * Compute mean misfit at absolute (phi, theta, psi, R).
 * engine is a HomogeneousEngine instance, typed as any to avoid dependency
 * on the (not-yet-rebuilt) library exports.
 */
function computeMisfit(
    data: Data[], engine: any,
    phi: number, theta: number, psi: number, R: number,
): number {
    if (R < 0 || R > 1) return NaN;
    const Wrot = transpose(buildDTrot(phi, theta, psi));
    engine.setHypotheticalStress(Wrot, R);
    return data.reduce((sum, d) =>
        sum + d.cost({ stress: engine.stress(d.position) })
    , 0) / data.length;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
    data: Data[];
    engine: any;       // HomogeneousEngine from inv.engine
    solution: StressSolution;
    misfitCriterion?: 'ANGLE' | 'DOT';
}

const ParameterSpaceLandscapeComponent: React.FC<Props> = ({ data, engine, solution, misfitCriterion = 'ANGLE' }) => {
    // When ANGLE criterion, stored costs are acos/π ∈ [0,1] → display in degrees (×180)
    const toDisplayMisfit = useCallback(
        (v: number) => misfitCriterion === 'ANGLE' ? v * 180 : v,
        [misfitCriterion]
    );
    const misfitUnit = misfitCriterion === 'ANGLE' ? '°' : '';

    // Axis assignment: [P1=innerX, P2=innerY, P3=outerX, P4=outerY]
    const [axes, setAxes] = useState<[ParamKey, ParamKey, ParamKey, ParamKey]>(
        ['phi', 'R', 'theta', 'psi']
    );

    // Ranges (degrees for angles, raw for R)
    const [ranges, setRanges] = useState<Record<ParamKey, [number, number]>>(() => {
        const a = solution?.analysis;
        if (!a) return { phi: [-180, 180], theta: [-90, 90], psi: [-180, 180], R: [0, 1] };
        const pd = a.eulerAnglesDegrees;
        const sr = solution.stressRatio;
        return {
            phi:   [Math.max(-180, pd.phi   - 30), Math.min(180, pd.phi   + 30)],
            theta: [Math.max(-90,  pd.theta - 20), Math.min(90,  pd.theta + 20)],
            psi:   [Math.max(-180, pd.psi   - 30), Math.min(180, pd.psi   + 30)],
            R:     [Math.max(0,    sr       - 0.3), Math.min(1,   sr       + 0.3)],
        };
    });

    const [outerN,  setOuterN]  = useState(4);
    const [innerN,  setInnerN]  = useState(20);

    // grid[i4][i3] = Float32Array(innerN × innerN) misfit values
    const [grid,        setGrid]        = useState<Float32Array[][] | null>(null);
    const [colorRange,  setColorRange]  = useState<[number, number]>([0, 1]);
    const [isComputing, setIsComputing] = useState(false);
    const [progress,    setProgress]    = useState(0);

    const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

    // Reset ranges to full physical bounds — match extractEulerAnglesFromWrot output ranges:
    // φ, ψ ∈ [-180°, 180°] (atan2 output), θ ∈ [-90°, 90°] (arcsin output)
    const resetToBounds = useCallback(() => {
        setRanges({ phi: [-180, 180], theta: [-90, 90], psi: [-180, 180], R: [0, 1] });
    }, []);

    // Center ranges around the current solution (±30° for angles, ±0.2 for R)
    const centerOnSolution = useCallback(() => {
        const a = solution?.analysis;
        if (!a) return;
        const pd = a.eulerAnglesDegrees;
        const sr = solution.stressRatio;
        setRanges({
            phi:   [Math.max(-180, pd.phi   - 30), Math.min(180, pd.phi   + 30)],
            theta: [Math.max(-90,  pd.theta - 20), Math.min(90,  pd.theta + 20)],
            psi:   [Math.max(-180, pd.psi   - 30), Math.min(180, pd.psi   + 30)],
            R:     [Math.max(0,    sr       - 0.2), Math.min(1,   sr       + 0.2)],
        });
    }, [solution]);

    // Clear grid when configuration changes
    useEffect(() => { setGrid(null); }, [axes, ranges, outerN, innerN]);

    // ── Draw one cell ─────────────────────────────────────────────────────────
    const drawCell = useCallback((
        canvas: HTMLCanvasElement,
        cell: Float32Array,
        gMin: number, gMax: number, n: number,
        p1Frac: number | null,   // [0,1] position of solution along P1
        p2Frac: number | null,   // [0,1] position of solution along P2
    ) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const range = gMax - gMin || 1;
        const img = ctx.createImageData(n, n);

        for (let i2 = 0; i2 < n; i2++) {
            for (let i1 = 0; i1 < n; i1++) {
                const m   = cell[i2 * n + i1];
                const t   = (m - gMin) / range;       // 0=best, 1=worst
                const [r, g, b] = rainbow(t);
                const px  = i1;
                const py  = n - 1 - i2;               // flip Y: i2=0 at bottom
                const k   = (py * n + px) * 4;
                img.data[k]     = r;
                img.data[k + 1] = g;
                img.data[k + 2] = b;
                img.data[k + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);

        // Black filled circle at current solution position
        if (p1Frac !== null && p2Frac !== null &&
            p1Frac >= 0 && p1Frac <= 1 && p2Frac >= 0 && p2Frac <= 1) {
            const cx = p1Frac * (n - 1);
            const cy = (1 - p2Frac) * (n - 1);        // flip Y
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(cx, cy, 1.8, 0, 2 * Math.PI);
            ctx.fill();
        }
    }, []);

    // ── Redraw all canvases ───────────────────────────────────────────────────
    useEffect(() => {
        if (!grid) return;

        // Place the dot at the known solution position in parameter space.
        // Wrap angular values by ±360° to bring them into the displayed range.
        const [p1k, p2k, p3k, p4k] = axes;
        const ed = solution?.analysis?.eulerAnglesDegrees;
        const solDeg: Record<ParamKey, number> = {
            phi:   ed?.phi   ?? 0,
            theta: ed?.theta ?? 0,
            psi:   ed?.psi   ?? 0,
            R:     solution?.stressRatio ?? 0,
        };

        function wrapAngle(val: number, lo: number, hi: number): number {
            let a = val;
            while (a < lo) a += 360;
            while (a > hi) a -= 360;
            return a;
        }
        function toDisplay(pk: ParamKey): number {
            return isAngle(pk) ? wrapAngle(solDeg[pk], ranges[pk][0], ranges[pk][1]) : solDeg[pk];
        }

        const solP1 = toDisplay(p1k);
        const solP2 = toDisplay(p2k);
        const solP3 = toDisplay(p3k);
        const solP4 = toDisplay(p4k);

        const N4 = grid.length;
        const N3 = grid[0]?.length ?? 0;

        // Find outer cell (i3, i4) whose P3/P4 is closest to the solution
        let dotI3 = 0, dotI4 = 0;
        let minD3 = Infinity, minD4 = Infinity;
        for (let i = 0; i < N3; i++) {
            const p3 = lerp(ranges[p3k][0], ranges[p3k][1], N3 > 1 ? i / (N3 - 1) : 0.5);
            const d = Math.abs(p3 - solP3);
            if (d < minD3) { minD3 = d; dotI3 = i; }
        }
        for (let i = 0; i < N4; i++) {
            const p4 = lerp(ranges[p4k][0], ranges[p4k][1], N4 > 1 ? i / (N4 - 1) : 0.5);
            const d = Math.abs(p4 - solP4);
            if (d < minD4) { minD4 = d; dotI4 = i; }
        }

        // Fractional (P1, P2) position within that cell
        const p1Frac = (solP1 - ranges[p1k][0]) / (ranges[p1k][1] - ranges[p1k][0]);
        const p2Frac = (solP2 - ranges[p2k][0]) / (ranges[p2k][1] - ranges[p2k][0]);

        for (let i4 = 0; i4 < N4; i4++) {
            for (let i3 = 0; i3 < (grid[i4]?.length ?? 0); i3++) {
                const canvas = canvasRefs.current[i4 * (grid[i4]?.length ?? 0) + i3];
                const cell = grid[i4][i3];
                if (canvas && cell && cell.length === innerN * innerN) {
                    const isCell = i3 === dotI3 && i4 === dotI4;
                    drawCell(canvas, cell, colorRange[0], colorRange[1],
                        innerN,
                        isCell ? p1Frac : null,
                        isCell ? p2Frac : null);
                }
            }
        }
    }, [grid, colorRange, innerN, drawCell, axes, ranges, solution]);

    // ── Computation ──────────────────────────────────────────────────────────
    const compute = useCallback(async () => {
        if (data.length === 0) return;
        if (new Set(axes).size !== 4) { alert('All 4 axes must be different parameters.'); return; }

        setIsComputing(true);
        setProgress(0);
        setGrid(null);

        const [p1k, p2k, p3k, p4k] = axes;
        const N4 = outerN, N3 = outerN, N2 = innerN, N1 = innerN;
        const newGrid: Float32Array[][] = Array.from({ length: N4 }, () => new Array(N3));
        let gMin = Infinity, gMax = -Infinity;
        let done = 0;

        for (let i4 = 0; i4 < N4; i4++) {
            const p4raw = lerp(ranges[p4k][0], ranges[p4k][1], N4 > 1 ? i4 / (N4 - 1) : 0.5);
            const p4val = isAngle(p4k) ? p4raw * DEG2RAD : p4raw;

            for (let i3 = 0; i3 < N3; i3++) {
                const p3raw = lerp(ranges[p3k][0], ranges[p3k][1], N3 > 1 ? i3 / (N3 - 1) : 0.5);
                const p3val = isAngle(p3k) ? p3raw * DEG2RAD : p3raw;

                const cell = new Float32Array(N2 * N1);

                for (let i2 = 0; i2 < N2; i2++) {
                    const p2raw = lerp(ranges[p2k][0], ranges[p2k][1], N2 > 1 ? i2 / (N2 - 1) : 0.5);
                    const p2val = isAngle(p2k) ? p2raw * DEG2RAD : p2raw;

                    for (let i1 = 0; i1 < N1; i1++) {
                        const p1raw = lerp(ranges[p1k][0], ranges[p1k][1], N1 > 1 ? i1 / (N1 - 1) : 0.5);
                        const p1val = isAngle(p1k) ? p1raw * DEG2RAD : p1raw;

                        let phi = 0, theta = 0, psi = 0, R = 0.5;
                        const assign = (k: ParamKey, v: number) => {
                            if      (k === 'phi')   phi   = v;
                            else if (k === 'theta') theta = v;
                            else if (k === 'psi')   psi   = v;
                            else                    R     = v;
                        };
                        assign(p1k, p1val); assign(p2k, p2val);
                        assign(p3k, p3val); assign(p4k, p4val);

                        const m = computeMisfit(data, engine, phi, theta, psi, R);
                        cell[i2 * N1 + i1] = m;
                        if (isFinite(m)) {
                            if (m < gMin) gMin = m;
                            if (m > gMax) gMax = m;
                        }
                    }
                }

                newGrid[i4][i3] = cell;
                done++;
                setProgress(Math.round((done / (N4 * N3)) * 100));
                await new Promise<void>(res => setTimeout(res, 0));
            }
        }

        setGrid(newGrid);
        setColorRange([gMin, gMax]);
        setIsComputing(false);
    }, [data, engine, axes, ranges, outerN, innerN]);

    // ── Outer axis tick labels ────────────────────────────────────────────────
    const p3Labels = useMemo(() =>
        Array.from({ length: outerN }, (_, i) => {
            const v = lerp(ranges[axes[2]][0], ranges[axes[2]][1], outerN > 1 ? i / (outerN - 1) : 0.5);
            return v.toFixed(isAngle(axes[2]) ? 0 : 2) + PARAM_UNIT[axes[2]];
        }), [axes, ranges, outerN]);

    const p4Labels = useMemo(() =>
        Array.from({ length: outerN }, (_, i) => {
            const v = lerp(ranges[axes[3]][0], ranges[axes[3]][1], outerN > 1 ? i / (outerN - 1) : 0.5);
            return v.toFixed(isAngle(axes[3]) ? 0 : 2) + PARAM_UNIT[axes[3]];
        }), [axes, ranges, outerN]);

    const cellPx = Math.max(60, Math.min(140, Math.floor(560 / outerN)));

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-4">
            <h4 className="text-xl font-semibold text-indigo-800">Parameter Space Landscape</h4>

            {/* Controls */}
            <div className="grid grid-cols-2 gap-6 bg-gray-50 p-4 rounded-lg">

                <div className="space-y-2">
                    <h5 className="text-sm font-semibold text-gray-700">Axis assignment</h5>
                    {(['P1 (inner X)', 'P2 (inner Y)', 'P3 (outer X)', 'P4 (outer Y)'] as const).map((label, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-28">{label}</span>
                            <select
                                className="text-xs border border-gray-300 rounded px-1 py-0.5"
                                value={axes[idx]}
                                onChange={e => {
                                    const next = [...axes] as [ParamKey, ParamKey, ParamKey, ParamKey];
                                    next[idx] = e.target.value as ParamKey;
                                    setAxes(next);
                                }}
                            >
                                {ALL_PARAMS.map(p => (
                                    <option key={p} value={p}>{PARAM_LABEL[p]}</option>
                                ))}
                            </select>
                        </div>
                    ))}
                </div>

                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <h5 className="text-sm font-semibold text-gray-700">Ranges</h5>
                        <button
                            onClick={resetToBounds}
                            className="text-xs px-2 py-0.5 border border-gray-300 rounded hover:bg-gray-100 text-gray-600"
                            title="Reset all ranges to full physical bounds"
                        >
                            Full bounds
                        </button>
                        <button
                            onClick={centerOnSolution}
                            className="text-xs px-2 py-0.5 border border-indigo-300 rounded hover:bg-indigo-50 text-indigo-600"
                            title="Center ranges around the current solution"
                        >
                            Center on solution
                        </button>
                    </div>
                    {ALL_PARAMS.map(pk => (
                        <div key={pk} className="flex items-center gap-1">
                            <span className="text-xs font-mono text-gray-600 w-5">{PARAM_LABEL[pk]}</span>
                            <input type="number" step={isAngle(pk) ? 5 : 0.05}
                                className="text-xs border border-gray-300 rounded px-1 py-0.5 w-16"
                                value={ranges[pk][0]}
                                onChange={e => setRanges(r => ({ ...r, [pk]: [+e.target.value, r[pk][1]] }))}
                            />
                            <span className="text-xs text-gray-400">–</span>
                            <input type="number" step={isAngle(pk) ? 5 : 0.05}
                                className="text-xs border border-gray-300 rounded px-1 py-0.5 w-16"
                                value={ranges[pk][1]}
                                onChange={e => setRanges(r => ({ ...r, [pk]: [r[pk][0], +e.target.value] }))}
                            />
                            <span className="text-xs text-gray-400">{PARAM_UNIT[pk]}</span>
                        </div>
                    ))}

                    <div className="flex items-center gap-4 pt-1">
                        <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">Outer N</span>
                            <input type="number" min={2} max={8}
                                className="text-xs border border-gray-300 rounded px-1 py-0.5 w-12"
                                value={outerN}
                                onChange={e => setOuterN(Math.max(2, Math.min(8, +e.target.value)))}
                            />
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">Inner res.</span>
                            <input type="number" min={10} max={60} step={5}
                                className="text-xs border border-gray-300 rounded px-1 py-0.5 w-12"
                                value={innerN}
                                onChange={e => setInnerN(Math.max(10, Math.min(60, +e.target.value)))}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Compute button + colorbar bounds */}
            <div className="flex items-center gap-4 flex-wrap">
                <button
                    onClick={compute}
                    disabled={isComputing || data.length === 0}
                    className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isComputing ? `Computing… ${progress}%` : 'Compute landscape'}
                </button>

                {grid && !isComputing && (
                    <div className="flex items-center gap-2">
                        {/* Color scale: blue → red gradient with editable bounds */}
                        <span className="text-xs text-gray-500 font-medium">Color scale:</span>
                        <input
                            type="number"
                            step={misfitCriterion === 'ANGLE' ? 1 : 0.001}
                            className="text-xs border border-gray-300 rounded px-1 py-0.5 w-16 text-right"
                            value={toDisplayMisfit(colorRange[0]).toFixed(misfitCriterion === 'ANGLE' ? 1 : 4)}
                            onChange={e => {
                                const display = +e.target.value;
                                const raw = misfitCriterion === 'ANGLE' ? display / 180 : display;
                                setColorRange(r => [raw, r[1]]);
                            }}
                        />
                        <div
                            className="h-3 rounded"
                            style={{
                                width: 80,
                                background: 'linear-gradient(to right, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000)',
                            }}
                        />
                        <input
                            type="number"
                            step={misfitCriterion === 'ANGLE' ? 1 : 0.001}
                            className="text-xs border border-gray-300 rounded px-1 py-0.5 w-16"
                            value={toDisplayMisfit(colorRange[1]).toFixed(misfitCriterion === 'ANGLE' ? 1 : 4)}
                            onChange={e => {
                                const display = +e.target.value;
                                const raw = misfitCriterion === 'ANGLE' ? display / 180 : display;
                                setColorRange(r => [r[0], raw]);
                            }}
                        />
                        <span className="text-xs text-gray-400">{misfitUnit}&nbsp;·&nbsp; ● = solution</span>
                    </div>
                )}
            </div>

            {/* Grid of heatmaps */}
            {grid && (
                <div className="flex gap-3 overflow-auto">

                    {/* P4 axis: label + tick values */}
                    <div className="flex flex-col items-end" style={{ minWidth: 44 }}>
                        <span className="text-xs font-semibold text-gray-600 mb-1">
                            {PARAM_LABEL[axes[3]]}{PARAM_UNIT[axes[3]]}
                        </span>
                        {[...p4Labels].reverse().map((l, i) => (
                            <div key={i} style={{ height: cellPx + 4 }} className="flex items-center justify-end">
                                <span className="text-xs text-gray-500">{l}</span>
                            </div>
                        ))}
                    </div>

                    <div>
                        {/* Rows: highest P4 at top */}
                        <div className="flex flex-col gap-1">
                            {Array.from({ length: outerN }, (_, row) => {
                                const i4 = outerN - 1 - row;
                                return (
                                    <div key={i4} className="flex gap-1">
                                        {Array.from({ length: outerN }, (_, i3) => {
                                            const idx = i4 * outerN + i3;
                                            return (
                                                <canvas
                                                    key={`${i4}-${i3}`}
                                                    ref={el => { canvasRefs.current[idx] = el; }}
                                                    width={innerN}
                                                    height={innerN}
                                                    style={{
                                                        width: cellPx, height: cellPx,
                                                        imageRendering: 'pixelated',
                                                        border: '1px solid #d1d5db',
                                                    }}
                                                    title={`${PARAM_LABEL[axes[2]]}=${p3Labels[i3]}, ${PARAM_LABEL[axes[3]]}=${p4Labels[i4]}`}
                                                />
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>

                        {/* P3 tick labels */}
                        <div className="flex gap-1 mt-1">
                            {p3Labels.map((l, i) => (
                                <div key={i} style={{ width: cellPx }}
                                    className="text-center text-xs text-gray-500">
                                    {l}
                                </div>
                            ))}
                        </div>
                        <div className="text-center text-xs font-semibold text-gray-600 mt-0.5">
                            {PARAM_LABEL[axes[2]]}{PARAM_UNIT[axes[2]]}
                        </div>

                        {/* Inner axis legend */}
                        <div className="mt-2 flex gap-6 text-xs text-gray-500">
                            <span>
                                → {PARAM_LABEL[axes[0]]}&thinsp;
                                [{ranges[axes[0]][0].toFixed(isAngle(axes[0]) ? 0 : 2)},
                                &thinsp;{ranges[axes[0]][1].toFixed(isAngle(axes[0]) ? 0 : 2)}]{PARAM_UNIT[axes[0]]}
                            </span>
                            <span>
                                ↑ {PARAM_LABEL[axes[1]]}&thinsp;
                                [{ranges[axes[1]][0].toFixed(isAngle(axes[1]) ? 0 : 2)},
                                &thinsp;{ranges[axes[1]][1].toFixed(isAngle(axes[1]) ? 0 : 2)}]{PARAM_UNIT[axes[1]]}
                            </span>
                        </div>
                    </div>

                    {/* Rainbow color bar */}
                    <div className="flex flex-col items-center ml-2">
                        <span className="text-xs text-gray-500 mb-1">
                            {toDisplayMisfit(colorRange[1]).toFixed(misfitCriterion === 'ANGLE' ? 1 : 3)}{misfitUnit}
                        </span>
                        <div style={{
                            width: 14,
                            height: outerN * (cellPx + 4),
                            background: 'linear-gradient(to bottom, red, yellow, green, cyan, blue)',
                            borderRadius: 3,
                        }} />
                        <span className="text-xs text-gray-500 mt-1">
                            {toDisplayMisfit(colorRange[0]).toFixed(misfitCriterion === 'ANGLE' ? 1 : 3)}{misfitUnit}
                        </span>
                        <span className="text-xs text-gray-400 mt-2" style={{ writingMode: 'vertical-rl' }}>
                            misfit
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ParameterSpaceLandscapeComponent;
