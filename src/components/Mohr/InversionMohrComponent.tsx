// InversionMohrComponent.tsx
// Mohr diagram for the stress inversion results tab.
//
// Layout
// ──────
// Wrapped in StablePlotWithSettings, like the Wulff stereonet, so it carries the same two
// collapsible panels: left = which data types to plot, right = display style.
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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Data } from '@alfredo-taboada/stress';
import { Layers } from 'lucide-react';
import { MohrCircle } from './MohrCircle';
import { StressSolution } from '../types';
import { useSettings } from '../Settings/SettingsContext';
import StablePlotWithSettings from '../PlotWithSettings';
import { beautifyName, TypeSynonyms } from '@/utils';

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
//
// Data carry their raw type string ("striated plane", "extension fracture", …), so they are
// mapped through TypeSynonyms to the canonical group that owns the colour. Anything that matches
// no group keeps its own name and is coloured from the fallback palette.

const CANONICAL_TYPES = ['fault', 'joint', 'stylolite', 'dilation band', 'compaction band'];

const TYPE_COLORS: Record<string, string> = {
    fault:              '#e74c3c',
    joint:              '#3498db',
    stylolite:          '#27ae60',
    'dilation band':    '#8e44ad',
    'compaction band':  '#0097a7',
};
const TYPE_LABELS: Record<string, string> = {
    fault:              'Faults',
    joint:              'Joints',
    stylolite:          'Stylolites',
    'dilation band':    'Dilation bands',
    'compaction band':  'Compaction bands',
};
const FALLBACK_COLORS = ['#f39c12', '#16a085', '#d35400', '#7f8c8d', '#c0392b'];

// ─── Display style ────────────────────────────────────────────────────────────

interface MohrStyle {
    pointRadius: number;
    pointOpacity: number;
    strokeWidth: number;
    showGrid: boolean;
    showAxes: boolean;
    showLabels: boolean;
    showPointLabels: boolean;
    showColoredArea: boolean;
}

const DEFAULT_STYLE: MohrStyle = {
    pointRadius: 5,
    pointOpacity: 1,
    strokeWidth: 2,
    showGrid: true,
    showAxes: true,
    showLabels: true,
    showPointLabels: true,
    showColoredArea: true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dot3(a: number[], b: number[]): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Canonical group a datum belongs to, or its own beautified type when it matches none. */
function groupOf(raw: unknown): string {
    const t = String(raw ?? '').trim();
    if (!t) return 'unknown';
    for (const canonical of CANONICAL_TYPES) {
        try {
            if (TypeSynonyms.isSameType(canonical, t)) return canonical;
        } catch {
            // Canonical type missing from the synonym table — try the next one.
        }
    }
    return beautifyName(t) || 'unknown';
}

// ─── Component ────────────────────────────────────────────────────────────────

const InversionMohrComponent: React.FC<InversionMohrComponentProps> = ({
    solution,
    data,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState<number>(1.0);
    const [showDataPanel, setShowDataPanel] = useState<boolean>(false);

    // Data types the user has switched off (all shown by default)
    const [hiddenTypes, setHiddenTypes] = useState<Record<string, boolean>>({});
    // Per-type colour overrides on top of TYPE_COLORS / the fallback palette
    const [colorOverrides, setColorOverrides] = useState<Record<string, string>>({});
    const [style, setStyle] = useState<MohrStyle>(DEFAULT_STYLE);

    const { settings } = useSettings();
    const isEngineer = settings.stressConvention === 'engineer';

    const effectiveWidth  = Math.round(BASE_WIDTH  * zoom);
    const effectiveHeight = Math.round(BASE_HEIGHT * zoom);

    // Data types present, in order of first appearance, with their counts.
    const groups = useMemo(() => {
        const counts = new Map<string, number>();
        data.forEach(d => {
            const g = groupOf((d as any).type);
            counts.set(g, (counts.get(g) ?? 0) + 1);
        });
        return Array.from(counts, ([key, count]) => ({ key, count }));
    }, [data]);

    const colorFor = (key: string): string => {
        if (colorOverrides[key]) return colorOverrides[key];
        if (TYPE_COLORS[key]) return TYPE_COLORS[key];
        const idx = groups.findIndex(g => g.key === key);
        return FALLBACK_COLORS[(idx < 0 ? 0 : idx) % FALLBACK_COLORS.length];
    };
    const labelFor = (key: string): string => TYPE_LABELS[key] ?? beautifyName(key);

    const plottedCount = groups
        .filter(g => !hiddenTypes[g.key])
        .reduce((sum, g) => sum + g.count, 0);

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
            strokeWidth:  style.strokeWidth,
            pointRadius:  style.pointRadius,
            pointOpacity: style.pointOpacity,
            draw: {
                grid:        style.showGrid,
                labels:      style.showLabels,
                axes:        style.showAxes,
                coloredArea: style.showColoredArea,
                stressPoint: true,
                pointLabels: style.showPointLabels,
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
            const group = groupOf((datum as any).type);
            if (hiddenTypes[group]) continue;

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
            vectors.push({ n, color: colorFor(group), label: '' });
        }

        mohr.setNormalVectors(vectors);

        return () => { container.innerHTML = ''; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [solution, data, effectiveWidth, effectiveHeight, isEngineer, hiddenTypes, colorOverrides, style]);

    // ── Zoom ──────────────────────────────────────────────────────────────────
    const zoomIn  = () => setZoom(z => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 10) / 10));
    const zoomOut = () => setZoom(z => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 10) / 10));

    const toggleType = (key: string) =>
        setHiddenTypes(prev => ({ ...prev, [key]: !prev[key] }));

    const updateStyle = (patch: Partial<MohrStyle>) =>
        setStyle(prev => ({ ...prev, ...patch }));

    // ── Legend & subtitle ─────────────────────────────────────────────────────

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

    // ── Header actions: convention badge + canvas zoom ────────────────────────
    const headerActions = (
        <div className="flex items-center gap-3">
            {conventionBadge}
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
    );

    // ── Left panel: which data types to plot ──────────────────────────────────
    const dataSelectionPanel = (
        <div className="space-y-4">
            <div>
                <h4 className="font-medium text-gray-800 mb-2">Data Types to Plot</h4>
                <div className="border rounded-lg p-3 max-h-64 overflow-y-auto">
                    {groups.map(group => (
                        <label key={group.key} className="flex items-center justify-between py-1 cursor-pointer">
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={!hiddenTypes[group.key]}
                                    onChange={() => toggleType(group.key)}
                                    className="mr-2"
                                />
                                <span
                                    className="inline-block w-3 h-3 rounded-full mr-2 flex-shrink-0"
                                    style={{ backgroundColor: colorFor(group.key) }}
                                />
                                <span className="text-sm">{labelFor(group.key)}</span>
                            </div>
                            <span className="text-xs text-gray-500 ml-2">{group.count}</span>
                        </label>
                    ))}
                    {groups.length === 0 && (
                        <p className="text-sm text-gray-500 italic">No data to plot</p>
                    )}
                </div>
            </div>

            <p className="text-xs text-gray-500">
                {plottedCount} of {data.length} data plotted. Colours are set in the settings panel.
            </p>
        </div>
    );

    // ── Right panel: display style ────────────────────────────────────────────
    const settingsContent = (
        <div className="space-y-4">
            <div className="pb-4 border-b">
                <h5 className="font-medium text-gray-800 mb-3">Diagram Size</h5>
                <label className="block text-sm font-medium mb-2">
                    Zoom: {(zoom * 100).toFixed(0)}%
                </label>
                <input
                    type="range"
                    min={ZOOM_MIN}
                    max={ZOOM_MAX}
                    step="0.1"
                    value={zoom}
                    onChange={e => setZoom(parseFloat(e.target.value))}
                    className="w-full"
                />
                {zoom !== 1.0 && (
                    <button
                        onClick={() => setZoom(1.0)}
                        className="mt-2 w-full text-xs px-3 py-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                    >
                        Reset to 100%
                    </button>
                )}
            </div>

            <div className="pb-4 border-b">
                <h5 className="font-medium text-gray-800 mb-3">Data Points</h5>
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Point size: {style.pointRadius} px
                        </label>
                        <input
                            type="range" min="1" max="14" step="1"
                            value={style.pointRadius}
                            onChange={e => updateStyle({ pointRadius: parseInt(e.target.value) })}
                            className="w-full"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Opacity: {style.pointOpacity.toFixed(1)}
                        </label>
                        <input
                            type="range" min="0.1" max="1" step="0.1"
                            value={style.pointOpacity}
                            onChange={e => updateStyle({ pointOpacity: parseFloat(e.target.value) })}
                            className="w-full"
                        />
                    </div>
                    <label className="flex items-center justify-between">
                        <span className="text-sm">Point Labels</span>
                        <input
                            type="checkbox"
                            checked={style.showPointLabels}
                            onChange={e => updateStyle({ showPointLabels: e.target.checked })}
                            className="rounded"
                        />
                    </label>
                </div>
            </div>

            <div className="pb-4 border-b">
                <h5 className="font-medium text-gray-800 mb-3">Diagram Display</h5>
                <div className="space-y-3">
                    {([
                        { key: 'showGrid',        label: 'Show Grid' },
                        { key: 'showAxes',        label: 'Show Axes' },
                        { key: 'showLabels',      label: 'Show Labels' },
                        { key: 'showColoredArea', label: 'Show Shaded Area' },
                    ] as const).map(({ key, label }) => (
                        <label key={key} className="flex items-center justify-between">
                            <span className="text-sm">{label}</span>
                            <input
                                type="checkbox"
                                checked={style[key]}
                                onChange={e => updateStyle({ [key]: e.target.checked } as Partial<MohrStyle>)}
                                className="rounded"
                            />
                        </label>
                    ))}
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Circle Width: {style.strokeWidth} px
                        </label>
                        <input
                            type="range" min="1" max="5" step="1"
                            value={style.strokeWidth}
                            onChange={e => updateStyle({ strokeWidth: parseInt(e.target.value) })}
                            className="w-full"
                        />
                    </div>
                </div>
            </div>

            <div>
                <h5 className="font-medium text-gray-800 mb-3">Data Colours</h5>
                <div className="space-y-2">
                    {groups.map(group => (
                        <label key={group.key} className="flex items-center justify-between">
                            <span className="text-sm">{labelFor(group.key)}</span>
                            <input
                                type="color"
                                value={colorFor(group.key)}
                                onChange={e => setColorOverrides(prev => ({ ...prev, [group.key]: e.target.value }))}
                                className="w-10 h-6 rounded"
                            />
                        </label>
                    ))}
                    {Object.keys(colorOverrides).length > 0 && (
                        <button
                            onClick={() => setColorOverrides({})}
                            className="mt-2 w-full text-xs px-3 py-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                        >
                            Reset colours
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    // ── Plot content: legend + d3 canvas ──────────────────────────────────────
    const plotContent = (
        <div className="flex flex-col items-center w-full h-full overflow-auto">
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mb-2">
                {groups.filter(g => !hiddenTypes[g.key]).map(group => (
                    <span key={group.key} className="flex items-center gap-1 text-xs text-gray-600">
                        <span className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: colorFor(group.key) }} />
                        {labelFor(group.key)}
                    </span>
                ))}
                <span className="text-xs text-gray-400">|</span>
                <span className="text-xs text-gray-500">
                    {mohrStressLine}&nbsp;— hover a point for (σn,&nbsp;τ)
                </span>
            </div>

            <div ref={containerRef} />
        </div>
    );

    // The wrapper fills its parent, so give it a height that fits the canvas plus the
    // header, the legend line and the plot-area padding.
    return (
        <div style={{ height: effectiveHeight + 170 }}>
            <StablePlotWithSettings
                title="Mohr Diagram — Data Normals"
                leftPanel={dataSelectionPanel}
                settingsPanel={settingsContent}
                headerActions={headerActions}
                borderColor="#c7d2fe"
                borderWidth={1}
                settingsPanelWidth={320}
                leftPanelWidth={320}
                initialLeftPanelOpen={showDataPanel}
                showLeftPanelButton={true}
                leftPanelButtonIcon={<Layers size={16} />}
                onLeftPanelToggle={setShowDataPanel}
            >
                {plotContent}
            </StablePlotWithSettings>
        </div>
    );
};

export default InversionMohrComponent;
