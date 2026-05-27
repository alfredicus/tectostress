// InversionMohrComponent.tsx
// Mohr diagram for the stress inversion results tab.
//
// Convention handling
// ───────────────────
// Library eigenvalues use tension-positive sign (compression = negative).
//
// Geologist (compression +): σ1=+1, σ2=+R, σ3= 0   x-domain [0, 1]
// Engineer  (tension +):     σ1=−1, σ2=−R, σ3= 0   x-domain [−1, 0]
//
// σ1 = most compressive axis in BOTH conventions (same physical direction).
// Normal-vector mapping is therefore IDENTICAL for both:
//   MohrCircle engine frame: (x,y,z) = (σ1, σ3, σ2)  [non-standard ordering]
//     n1_Mohr = dot(n, e_σ1)  →  feeds σ1 slot
//     n2_Mohr = dot(n, e_σ3)  →  feeds σ3 slot
//     n3_Mohr = dot(n, e_σ2)  →  feeds σ2 slot
//
// Key identity: σn_eng = −σn_geo,  τ is invariant.

import React, { useEffect, useRef, useState } from 'react';
import { Data } from '@alfredo-taboada/stress';
import { MohrCircle } from './MohrCircle';
import { StressSolution } from '../types';
import { useSettings } from '../Settings/SettingsContext';

// ─── Default canvas size ──────────────────────────────────────────────────────
const BASE_WIDTH  = 820;   // px  ← edit here to resize
const BASE_HEIGHT = 560;   // px  ← edit here to resize

const ZOOM_STEP = 0.2;
const ZOOM_MIN  = 0.4;
const ZOOM_MAX  = 3.0;

// ─── Props ────────────────────────────────────────────────────────────────────

interface InversionMohrComponentProps {
    solution: StressSolution;
    data: Data[];
}

// ─── Per-type display colours ─────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
    fault:     '#e74c3c',
    joint:     '#3498db',
    stylolite: '#27ae60',
};
const TYPE_LABELS: Record<string, string> = {
    fault:     'Fault',
    joint:     'Joint',
    stylolite: 'Stylolite',
};
const DEFAULT_COLOR = '#8e44ad';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dot3(a: number[], b: number[]): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function canonicalType(raw: unknown): string {
    return String(raw ?? '').toLowerCase().trim();
}

// ─── Component ────────────────────────────────────────────────────────────────

const InversionMohrComponent: React.FC<InversionMohrComponentProps> = ({
    solution,
    data,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState<number>(1.0);

    const { settings } = useSettings();
    const isEngineer = settings.stressConvention === 'engineer';

    const effectiveWidth  = Math.round(BASE_WIDTH  * zoom);
    const effectiveHeight = Math.round(BASE_HEIGHT * zoom);

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !solution.analysis) return;

        const { eigenvalues, eigenvectors } = solution.analysis;
        if (!eigenvalues || eigenvalues.length < 3 || !eigenvectors || eigenvectors.length < 3) return;

        // ── 1. Identify σ1 (most compressive) by MAGNITUDE, not algebraic order ──
        //
        // The library may store eigenvalues with tension-positive sign (negative
        // for compression).  Sorting algebraically would misidentify the axes.
        // Sorting by |value| descending always puts σ1 (most compressive = largest
        // magnitude) first, regardless of the library's internal sign convention.
        const combined = eigenvalues
            .map((value, i) => ({ value, vec: eigenvectors[i] as number[] }))
            .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

        const s1 = combined[0].value;   // most compressive (sign from library)
        const s2 = combined[1].value;
        const s3 = combined[2].value;   // least compressive
        const e1 = combined[0].vec;     // σ1 axis in geographic frame (E, N, Up)
        const e2 = combined[1].vec;
        const e3 = combined[2].vec;

        // Signed range: may be negative if library uses tension-positive convention.
        const range_signed = s1 - s3;
        if (Math.abs(range_signed) < 1e-10) return;   // degenerate / isotropic

        // Stress ratio R ∈ [0,1] — formula is sign-invariant when both numerator
        // and denominator share the same sign (both compression or both tension).
        const R = (s2 - s3) / range_signed;

        // ── 2. Normalised principal stresses for the chosen convention ─────────
        //
        //   Geologist: σ1=+1, σ2=+R, σ3= 0   (compression positive)
        //   Engineer:  σ1=−1, σ2=−R, σ3= 0   (tension positive; same axes, negated)
        const sig1n = isEngineer ? -1 :  1;
        const sig2n = isEngineer ? -R :  R;
        const sig3n = 0;

        // Fixed axis domains so both conventions share the same visual scale.
        // Max τ = |σ1−σ3|/2 = 0.5 for both → y upper bound 0.6 gives breathing room.
        const xDomain: [number, number] = isEngineer ? [-1, 0] : [0, 1];
        const yDomain: [number, number] = [0, 0.6];

        const xLabel = isEngineer
            ? 'σn (normalised) — tension +'
            : 'σn (normalised) — compression +';

        // ── 3. Build MohrCircle engine ─────────────────────────────────────────
        const mohr = new MohrCircle(container, {
            width:       effectiveWidth,
            height:      effectiveHeight,
            title:       '',
            xAxisLabel:  xLabel,
            yAxisLabel:  'τ (normalised)',
            xDomain,
            yDomain,
            draw: {
                grid:        true,
                labels:      true,
                axes:        true,
                coloredArea: true,
                stressPoint: true,
            },
        });
        mohr.setPrincipalStresses(sig1n, sig2n, sig3n);

        // ── 4. Project each datum's normal onto the principal-stress axes ──────
        //
        //   n_sig1 = dot(n_fault, e1)  component along σ1 axis (most compressive)
        //   n_sig2 = dot(n_fault, e2)  component along σ2 axis
        //   n_sig3 = dot(n_fault, e3)  component along σ3 axis (least compressive)
        //
        //   MohrCircle engine (x,y,z) = (σ1, σ3, σ2) — see MohrCircle.ts:327
        //     n1_Mohr = n_sig1  →  σ1 slot
        //     n2_Mohr = n_sig3  →  σ3 slot
        //     n3_Mohr = n_sig2  →  σ2 slot
        //   ⇒  σn = σ1·n_sig1² + σ3·n_sig3² + σ2·n_sig2²  ✓
        //   Same mapping for both conventions (axis directions identical, values differ).

        const vectors: Array<{ n: [number, number, number]; color: string; label: string }> = [];

        for (const datum of data) {
            const nRaw = (datum as any).normal as number[] | undefined;
            if (!nRaw || nRaw.length < 3) continue;

            // Components of the fault normal in the principal-stress eigenvector frame
            const n_sig1 = dot3(nRaw, e1);
            const n_sig2 = dot3(nRaw, e2);
            const n_sig3 = dot3(nRaw, e3);

            if (n_sig1 * n_sig1 + n_sig2 * n_sig2 + n_sig3 * n_sig3 < 1e-10) continue;

            // Map to MohrCircle engine frame (x,y,z) = (σ1, σ3, σ2)
            const n1_Mohr = n_sig1;   // n1 slot → σ1
            const n2_Mohr = n_sig3;   // n2 slot → σ3
            const n3_Mohr = n_sig2;   // n3 slot → σ2

            const n: [number, number, number] = [n1_Mohr, n2_Mohr, n3_Mohr];
            const typeStr = canonicalType((datum as any).type);
            vectors.push({ n, color: TYPE_COLORS[typeStr] ?? DEFAULT_COLOR, label: '' });
        }

        mohr.setNormalVectors(vectors);

        return () => { container.innerHTML = ''; };
    }, [solution, data, effectiveWidth, effectiveHeight, isEngineer]);

    // ── Zoom ──────────────────────────────────────────────────────────────────
    const zoomIn  = () => setZoom(z => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 10) / 10));
    const zoomOut = () => setZoom(z => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 10) / 10));

    // ── Legend & subtitle ─────────────────────────────────────────────────────
    const presentTypes = Array.from(new Set(
        data.map(d => canonicalType((d as any).type)).filter(t => t in TYPE_COLORS)
    ));

    // Compute R for the subtitle using the same magnitude-sort logic
    const R_display = solution.analysis
        ? (() => {
            const ev = [...solution.analysis.eigenvalues]
                .sort((a, b) => Math.abs(b) - Math.abs(a));   // magnitude descending
            const d = ev[0] - ev[2];
            return Math.abs(d) > 1e-10 ? (ev[1] - ev[2]) / d : solution.stressRatio;
        })()
        : solution.stressRatio;

    const conventionBadge = isEngineer
        ? <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">Engineer — tension +</span>
        : <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-medium">Geologist — compression +</span>;

    const mohrStressLine = isEngineer
        ? <>σ₁&nbsp;=&nbsp;−1, σ₂&nbsp;≈&nbsp;<span className="font-mono">{(-R_display).toFixed(3)}</span>, σ₃&nbsp;=&nbsp;0</>
        : <>σ₃&nbsp;=&nbsp;0, σ₁&nbsp;=&nbsp;1, σ₂&nbsp;≈&nbsp;<span className="font-mono">{R_display.toFixed(3)}</span></>;

    return (
        <div className="bg-white rounded-lg border border-indigo-200 p-4">
            {/* ── Header row ── */}
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-3">
                    <h4 className="text-lg font-semibold text-indigo-800">
                        Mohr Diagram — Data Normals
                    </h4>
                    {conventionBadge}
                </div>
                {/* Zoom controls */}
                <div className="flex items-center gap-1 select-none">
                    <button onClick={zoomOut} disabled={zoom <= ZOOM_MIN} title="Zoom out"
                        className="w-7 h-7 flex items-center justify-center rounded border border-gray-300
                                   bg-gray-50 text-gray-700 text-base font-bold leading-none
                                   hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        −
                    </button>
                    <span className="w-12 text-center text-xs font-mono text-gray-600">{zoom.toFixed(1)}×</span>
                    <button onClick={zoomIn} disabled={zoom >= ZOOM_MAX} title="Zoom in"
                        className="w-7 h-7 flex items-center justify-center rounded border border-gray-300
                                   bg-gray-50 text-gray-700 text-base font-bold leading-none
                                   hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        +
                    </button>
                </div>
            </div>

            {/* ── Sub-header: legend + subtitle ── */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3">
                {presentTypes.map(type => (
                    <span key={type} className="flex items-center gap-1 text-xs text-gray-600">
                        <span className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: TYPE_COLORS[type] }} />
                        {TYPE_LABELS[type] ?? type}
                    </span>
                ))}
                <span className="text-xs text-gray-400">|</span>
                <span className="text-xs text-gray-500">
                    {mohrStressLine}&nbsp;— hover a point for (σn,&nbsp;τ)
                </span>
            </div>

            {/* ── D3 canvas ── */}
            <div ref={containerRef} />
        </div>
    );
};

export default InversionMohrComponent;
