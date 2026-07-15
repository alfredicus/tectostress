import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Histogram } from './Histogram';

/**
 * One measured-vs-computed angular difference for a single datum.
 *   category — friendly data-type label (e.g. "Striated planes", "Extension fractures")
 *   angle    — misfit angle in degrees (0–90), acute angle between measured and predicted vector
 */
export interface MisfitEntry {
    category: string;
    angle: number;
}

interface MisfitHistogramComponentProps {
    misfits: MisfitEntry[];
    /** Total data processed, so we can report how many produced a prediction. */
    totalData?: number;
}

// Distinct fill colour per category, cycled if there are more categories than colours.
const CATEGORY_COLORS = ['#3498db', '#e67e22', '#9b59b6', '#16a085', '#e74c3c', '#f1c40f', '#34495e'];

const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const median = (a: number[]) => {
    if (!a.length) return NaN;
    const s = [...a].sort((x, y) => x - y);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Histogram of the angular differences between measured and computed striations / fracture
 * normals after an inversion. Shown in the inversion results panel. Lets the user switch
 * between "All data" and each individual data category.
 */
const MisfitHistogramComponent: React.FC<MisfitHistogramComponentProps> = ({ misfits, totalData }) => {
    const chartRef = useRef<HTMLDivElement>(null);

    // Categories present in the data, in stable order of first appearance.
    const categories = useMemo(() => {
        const seen: string[] = [];
        for (const m of misfits) if (!seen.includes(m.category)) seen.push(m.category);
        return seen;
    }, [misfits]);

    const [selected, setSelected] = useState<string>('All');
    // User-controlled x-axis upper bound (0 → xMax) and bin width in degrees.
    const [xMax, setXMax] = useState<number>(90);
    const [binWidth, setBinWidth] = useState<number>(5);

    // If the available categories change (new run), fall back to "All".
    useEffect(() => {
        if (selected !== 'All' && !categories.includes(selected)) setSelected('All');
    }, [categories, selected]);

    const angles = useMemo(
        () => misfits
            .filter(m => selected === 'All' || m.category === selected)
            .map(m => m.angle)
            .filter(a => Number.isFinite(a)),
        [misfits, selected]
    );

    const colorFor = (cat: string) => {
        const idx = categories.indexOf(cat);
        return idx >= 0 ? CATEGORY_COLORS[idx % CATEGORY_COLORS.length] : CATEGORY_COLORS[0];
    };

    // (Re)draw the d3 histogram whenever the selection or data changes.
    useEffect(() => {
        if (!chartRef.current) return;
        chartRef.current.innerHTML = '';
        const safeMax = xMax > 0 ? xMax : 90;
        const safeWidth = binWidth > 0 ? Math.min(binWidth, safeMax) : 5;
        // Number of whole bins of `safeWidth` needed to cover [0, safeMax]; extend the domain
        // to a whole multiple of the width so every bin is exactly `safeWidth` degrees wide.
        const nBins = Math.max(1, Math.ceil(safeMax / safeWidth));
        // eslint-disable-next-line no-new
        new Histogram(chartRef.current, angles, {
            width: 560,
            height: 320,
            bins: nBins,
            domain: [0, nBins * safeWidth],
            fillColor: selected === 'All' ? '#3498db' : colorFor(selected),
            strokeColor: '#2c3e50',
            draw: { grid: true, labels: true, axes: true, density: true },
            xAxisLabel: 'Angular difference (measured − computed) [°]',
            yAxisLabel: 'Count',
        });
        return () => {
            if (chartRef.current) chartRef.current.innerHTML = '';
        };
    }, [angles, selected, xMax, binWidth]);

    if (misfits.length === 0) return null;

    const m = mean(angles);
    const med = median(angles);

    return (
        <div>
            <h4 className="text-xl font-semibold text-indigo-800 mb-1">
                Angular misfit distribution
            </h4>
            <p className="text-sm text-gray-600 mb-3">
                Angle between each measured striation / fracture normal and the orientation predicted
                by the inverted stress tensor.
                {totalData != null && (
                    <> {' '}({misfits.length} of {totalData} data predicted)</>
                )}
            </p>

            {/* Category selector */}
            <div className="flex flex-wrap gap-2 mb-3">
                {['All', ...categories].map(cat => {
                    const count = cat === 'All'
                        ? misfits.length
                        : misfits.filter(x => x.category === cat).length;
                    const active = selected === cat;
                    return (
                        <button
                            key={cat}
                            onClick={() => setSelected(cat)}
                            className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                                active
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                            {cat === 'All'
                                ? `All (${count})`
                                : (
                                    <span className="inline-flex items-center gap-1.5">
                                        <span
                                            className="inline-block w-2.5 h-2.5 rounded-sm"
                                            style={{ backgroundColor: colorFor(cat) }}
                                        />
                                        {cat} ({count})
                                    </span>
                                )}
                        </button>
                    );
                })}
            </div>

            {/* Axis / binning controls */}
            <div className="flex flex-wrap items-end gap-6 mb-3">
                <label className="flex flex-col text-sm text-gray-700">
                    <span className="mb-1 font-medium">X-axis max (°)</span>
                    <input
                        type="number"
                        min={1}
                        max={180}
                        step={1}
                        value={xMax}
                        onChange={e => {
                            const v = parseFloat(e.target.value);
                            setXMax(Number.isFinite(v) && v > 0 ? Math.min(v, 180) : 90);
                        }}
                        className="px-2 py-1 w-24 text-right border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                </label>
                <label className="flex flex-col text-sm text-gray-700">
                    <span className="mb-1 font-medium">Bin width (°)</span>
                    <input
                        type="number"
                        min={0.5}
                        max={90}
                        step={0.5}
                        value={binWidth}
                        onChange={e => {
                            const v = parseFloat(e.target.value);
                            setBinWidth(Number.isFinite(v) && v > 0 ? Math.min(v, 90) : 5);
                        }}
                        className="px-2 py-1 w-24 text-right border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                </label>
            </div>

            <div className="flex flex-wrap items-start gap-6">
                <div ref={chartRef} className="bg-white rounded-lg border border-gray-100 shadow-sm" />

                {/* Summary stats for the current selection */}
                <div className="grid grid-cols-2 gap-3 min-w-[180px]">
                    <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="text-xs font-medium text-blue-800">Mean</div>
                        <div className="text-xl font-bold">{Number.isFinite(m) ? `${m.toFixed(1)}°` : '—'}</div>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                        <div className="text-xs font-medium text-green-800">Median</div>
                        <div className="text-xl font-bold">{Number.isFinite(med) ? `${med.toFixed(1)}°` : '—'}</div>
                    </div>
                    <div className="bg-amber-50 p-3 rounded-lg">
                        <div className="text-xs font-medium text-amber-800">Max</div>
                        <div className="text-xl font-bold">
                            {angles.length ? `${Math.max(...angles).toFixed(1)}°` : '—'}
                        </div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-xs font-medium text-gray-700">N</div>
                        <div className="text-xl font-bold">{angles.length}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MisfitHistogramComponent;
