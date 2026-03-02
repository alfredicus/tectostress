import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { HelpCircle, X } from 'lucide-react';
import { BaseVisualizationProps } from '../VisualizationStateSystem';
import { MCMCStatsCompState } from './MCMCStatsParameters';

const HELP_FILE = 'gui/MCMC-analysis.md';
const getBasePath = () => process.env.NODE_ENV === 'production' ? '/tectostress' : '';

interface AngleStats {
    mean: number;
    std: number;
    q05: number;
    q95: number;
}

interface MCMCStatsData {
    acceptanceRate: number;
    chainLength: number;
    stressRatioMean: number;
    stressRatioStd: number;
    stressRatioQ05: number;
    stressRatioQ95: number;
    misfitMean: number;
    misfitStd: number;
    misfitMin: number;
    elapsedMs?: number;
    phi?: AngleStats;
    theta?: AngleStats;
    psi?: AngleStats;
    bestFit?: {
        stressRatio?: number;
        phi?: number;
        theta?: number;
        psi?: number;
    };
    distributions?: {
        stressRatio: number[];
        phi: number[];
        theta: number[];
        psi: number[];
    };
}

function extractMCMCStats(files: any[]): MCMCStatsData | null {
    const resultsFile = files.find(f => f.id === 'stress-inversion-results');
    if (!resultsFile || !resultsFile.content) return null;

    const get = (param: string): any => {
        const row = resultsFile.content.find((r: any) => r.parameter === param);
        return row?.value;
    };

    const acceptanceRate = get('mcmc_acceptance_rate');
    if (acceptanceRate == null) return null;

    const parseJsonArray = (param: string): number[] | undefined => {
        const raw = get(param);
        if (raw == null) return undefined;
        if (typeof raw === 'string') {
            try { return JSON.parse(raw); } catch { return undefined; }
        }
        if (Array.isArray(raw)) return raw;
        return undefined;
    };

    const angleStats = (prefix: string): AngleStats | undefined => {
        const mean = get(`mcmc_${prefix}_mean`);
        if (mean == null) return undefined;
        return {
            mean,
            std: get(`mcmc_${prefix}_std`) ?? 0,
            q05: get(`mcmc_${prefix}_q05`) ?? 0,
            q95: get(`mcmc_${prefix}_q95`) ?? 0
        };
    };

    const distSR = parseJsonArray('mcmc_dist_stress_ratio');
    const distPhi = parseJsonArray('mcmc_dist_phi');
    const distTheta = parseJsonArray('mcmc_dist_theta');
    const distPsi = parseJsonArray('mcmc_dist_psi');

    return {
        acceptanceRate,
        chainLength: get('mcmc_chain_length') ?? 0,
        stressRatioMean: get('mcmc_stress_ratio_mean') ?? 0,
        stressRatioStd: get('mcmc_stress_ratio_std') ?? 0,
        stressRatioQ05: get('mcmc_stress_ratio_q05') ?? 0,
        stressRatioQ95: get('mcmc_stress_ratio_q95') ?? 0,
        misfitMean: get('mcmc_misfit_mean') ?? 0,
        misfitStd: get('mcmc_misfit_std') ?? 0,
        misfitMin: get('mcmc_misfit_min') ?? 0,
        elapsedMs: get('elapsed_ms'),
        phi: angleStats('phi'),
        theta: angleStats('theta'),
        psi: angleStats('psi'),
        bestFit: {
            stressRatio: get('stress_ratio') ?? undefined,
            phi: get('phi_degrees') ?? undefined,
            theta: get('theta_degrees') ?? undefined,
            psi: get('psi_degrees') ?? undefined,
        },
        distributions: (distSR && distPhi && distTheta && distPsi)
            ? { stressRatio: distSR, phi: distPhi, theta: distTheta, psi: distPsi }
            : undefined
    };
}

const StatCard: React.FC<{
    label: string;
    value: string;
    subtitle?: string;
    color: string;
}> = ({ label, value, subtitle, color }) => (
    <div className={`${color} p-3 rounded-lg`}>
        <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
        <p className="text-lg font-bold leading-tight">{value}</p>
        {subtitle && <p className="text-xs opacity-60 mt-0.5">{subtitle}</p>}
    </div>
);

/** Inline SVG histogram with axis labels, mean+CI lines, best-fit marker, and tooltips */
const MiniHistogram: React.FC<{
    data: number[];
    label: string;
    unit: string;
    color: string;
    mean?: number;
    q05?: number;
    q95?: number;
    bestFit?: number;
    ciLabel?: string;
    width?: number;
    height?: number;
    numBins?: number;
}> = ({ data, label, unit, color, mean, q05, q95, bestFit, ciLabel = '90% CI', width = 440, height = 240, numBins = 45 }) => {
    if (!data || data.length === 0) return null;

    const mn = Math.min(...data);
    const mx = Math.max(...data);
    const range = mx - mn || 1;
    const bw = range / numBins;
    const fmt = (v: number) => Math.abs(v) < 1 ? v.toFixed(3) : v.toFixed(1);

    const bins = new Array(numBins).fill(0);
    for (const v of data) bins[Math.min(Math.floor((v - mn) / bw), numBins - 1)]++;
    const maxC = Math.max(...bins);
    const total = data.length;

    const pad = { top: 22, bottom: 38, left: 44, right: 12 };
    const cW = width - pad.left - pad.right;
    const cH = height - pad.top - pad.bottom;
    const barW = cW / numBins;
    const yTicks = [0, Math.round(maxC / 2), maxC];
    const xMid = (mn + mx) / 2;
    const valToX = (v: number) => pad.left + ((v - mn) / range) * cW;
    const inBounds = (x: number) => x >= pad.left && x <= pad.left + cW;

    const meanX = mean != null ? valToX(mean) : undefined;
    const q05X = q05 != null ? valToX(q05) : undefined;
    const q95X = q95 != null ? valToX(q95) : undefined;
    const bestX = bestFit != null ? valToX(bestFit) : undefined;
    // Mode: center of the tallest bin
    const modeIdx = bins.indexOf(maxC);
    const modeVal = mn + (modeIdx + 0.5) * bw;
    const modeX = valToX(modeVal);

    return (
        <svg width={width} height={height} className="bg-white rounded-lg border border-indigo-100 shadow-sm flex-shrink-0">
            {/* Title */}
            <text x={width / 2} y={15} textAnchor="middle" fontSize={13} fontWeight={700} fill="#1f2937">
                {label}{unit && ` (${unit})`}
            </text>
            {/* Y-axis */}
            <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + cH} stroke="#d1d5db" strokeWidth={0.5} />
            {yTicks.map((t) => {
                const y = pad.top + cH - (maxC > 0 ? (t / maxC) * cH : 0);
                return (
                    <g key={t}>
                        <line x1={pad.left - 4} y1={y} x2={pad.left} y2={y} stroke="#9ca3af" strokeWidth={0.5} />
                        <text x={pad.left - 6} y={y + 3.5} textAnchor="end" fontSize={9} fill="#6b7280">{t}</text>
                    </g>
                );
            })}
            <text x={8} y={pad.top + cH / 2} textAnchor="middle" fontSize={9} fill="#9ca3af"
                transform={`rotate(-90, 8, ${pad.top + cH / 2})`}>count</text>
            {/* X-axis */}
            <line x1={pad.left} y1={pad.top + cH} x2={pad.left + cW} y2={pad.top + cH} stroke="#d1d5db" strokeWidth={0.5} />
            {/* CI shaded band */}
            {q05X != null && q95X != null && inBounds(q05X) && inBounds(q95X) && (
                <rect x={q05X} y={pad.top} width={q95X - q05X} height={cH}
                    fill={color} opacity={0.08}>
                    <title>{`${ciLabel}: [${fmt(q05!)}, ${fmt(q95!)}]${unit}`}</title>
                </rect>
            )}
            {/* Bars */}
            {bins.map((c, i) => {
                const bH = maxC > 0 ? (c / maxC) * cH : 0;
                const binLo = mn + i * bw;
                const binHi = binLo + bw;
                const pct = total > 0 ? ((c / total) * 100).toFixed(1) : '0';
                return (
                    <rect key={i} x={pad.left + i * barW} y={pad.top + cH - bH}
                        width={Math.max(barW - 0.5, 0.5)} height={bH} fill={color} opacity={0.7}>
                        <title>{`${fmt(binLo)} – ${fmt(binHi)}${unit}\n${c} samples (${pct}%)`}</title>
                    </rect>
                );
            })}
            {/* 90% CI boundary lines */}
            {q05X != null && inBounds(q05X) && (
                <line x1={q05X} y1={pad.top} x2={q05X} y2={pad.top + cH}
                    stroke={color} strokeWidth={1} strokeDasharray="4,3" opacity={0.6} />
            )}
            {q95X != null && inBounds(q95X) && (
                <line x1={q95X} y1={pad.top} x2={q95X} y2={pad.top + cH}
                    stroke={color} strokeWidth={1} strokeDasharray="4,3" opacity={0.6} />
            )}
            {/* Mean line (red dashed) */}
            {meanX != null && inBounds(meanX) && (
                <>
                    <line x1={meanX} y1={pad.top} x2={meanX} y2={pad.top + cH}
                        stroke="#ef4444" strokeWidth={2} strokeDasharray="5,3" />
                    <text x={meanX} y={pad.top - 4} textAnchor="middle" fontSize={9} fill="#ef4444" fontWeight={700}>
                        μ={fmt(mean!)}{unit}
                    </text>
                </>
            )}
            {/* Best-fit marker (green solid) */}
            {bestX != null && inBounds(bestX) && (
                <>
                    <line x1={bestX} y1={pad.top} x2={bestX} y2={pad.top + cH}
                        stroke="#16a34a" strokeWidth={2} />
                    <polygon
                        points={`${bestX - 5},${pad.top} ${bestX + 5},${pad.top} ${bestX},${pad.top + 8}`}
                        fill="#16a34a" />
                    <title>{`Best fit: ${fmt(bestFit!)}${unit}`}</title>
                </>
            )}
            {/* Mode marker (orange diamond at top of tallest bin) */}
            {inBounds(modeX) && (
                <>
                    <polygon
                        points={`${modeX},${pad.top + 2} ${modeX + 5},${pad.top + 8} ${modeX},${pad.top + 14} ${modeX - 5},${pad.top + 8}`}
                        fill="#f59e0b" stroke="#d97706" strokeWidth={0.5} />
                    <line x1={modeX} y1={pad.top + 14} x2={modeX} y2={pad.top + cH}
                        stroke="#f59e0b" strokeWidth={1} strokeDasharray="2,3" opacity={0.5} />
                </>
            )}
            {/* X-axis tick labels */}
            <text x={pad.left} y={height - 18} textAnchor="start" fontSize={9} fill="#6b7280">{fmt(mn)}</text>
            <text x={pad.left + cW / 2} y={height - 18} textAnchor="middle" fontSize={9} fill="#6b7280">{fmt(xMid)}</text>
            <text x={pad.left + cW} y={height - 18} textAnchor="end" fontSize={9} fill="#6b7280">{fmt(mx)}</text>
            {/* X-axis label */}
            <text x={pad.left + cW / 2} y={height - 4} textAnchor="middle" fontSize={10} fill="#6b7280">
                {label}{unit && ` (${unit})`}
            </text>
            {/* Legend */}
            <g transform={`translate(${pad.left + cW - 130}, ${pad.top + 4})`}>
                <line x1={0} y1={4} x2={14} y2={4} stroke="#16a34a" strokeWidth={2} />
                <text x={18} y={7} fontSize={8} fill="#374151">Best fit</text>
                <line x1={0} y1={16} x2={14} y2={16} stroke="#ef4444" strokeWidth={2} strokeDasharray="4,2" />
                <text x={18} y={19} fontSize={8} fill="#374151">Mean (μ)</text>
                <polygon points="7,24 12,28 7,32 2,28" fill="#f59e0b" stroke="#d97706" strokeWidth={0.5} />
                <text x={18} y={31} fontSize={8} fill="#374151">Mode (peak)</text>
                <rect x={0} y={36} width={14} height={8} fill={color} opacity={0.15} stroke={color} strokeWidth={0.5} strokeDasharray="3,2" />
                <text x={18} y={43} fontSize={8} fill="#374151">{ciLabel}</text>
            </g>
        </svg>
    );
};

const MCMCStatsComponent: React.FC<BaseVisualizationProps<MCMCStatsCompState>> = ({
    files,
    width = 400,
    height = 400
}) => {
    const stats = extractMCMCStats(files ?? []);
    const [ciLevel, setCiLevel] = useState<number>(90);
    const [helpOpen, setHelpOpen] = useState(false);
    const [helpContent, setHelpContent] = useState<string | null>(null);

    const openHelp = useCallback(async () => {
        setHelpOpen(true);
        if (helpContent) return; // already loaded
        try {
            const res = await fetch(`${getBasePath()}/help/${HELP_FILE}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setHelpContent(await res.text());
        } catch {
            setHelpContent('# Error\n\nFailed to load help document.');
        }
    }, [helpContent]);

    if (!stats) {
        return (
            <div
                style={{ width, height }}
                className="flex items-center justify-center text-gray-500 border border-dashed border-gray-300 rounded"
            >
                <div className="text-center p-4">
                    <p className="text-sm font-medium">No MCMC data available</p>
                    <p className="text-xs mt-1">Run an MCMC inversion to see posterior statistics</p>
                </div>
            </div>
        );
    }

    const isCompact = height < 300;

    // Quantile helper
    const quantile = (sorted: number[], q: number) => {
        const pos = q * (sorted.length - 1);
        const lo = Math.floor(pos);
        const hi = Math.ceil(pos);
        return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
    };

    const qLo = (100 - ciLevel) / 200;
    const qHi = 1 - qLo;
    const ciLabel = `${ciLevel}% CI`;

    // Pre-sort distributions for dynamic quantile computation
    const sortedDists = stats.distributions ? {
        stressRatio: [...stats.distributions.stressRatio].sort((a, b) => a - b),
        phi: [...stats.distributions.phi].sort((a, b) => a - b),
        theta: [...stats.distributions.theta].sort((a, b) => a - b),
        psi: [...stats.distributions.psi].sort((a, b) => a - b),
    } : undefined;

    const dynCI = (key: 'stressRatio' | 'phi' | 'theta' | 'psi') => {
        if (!sortedDists) return { lo: 0, hi: 0 };
        return { lo: quantile(sortedDists[key], qLo), hi: quantile(sortedDists[key], qHi) };
    };

    const srCI = dynCI('stressRatio');

    return (
        <div
            style={{ width, height }}
            className="p-3 overflow-auto"
        >
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-indigo-800">MCMC Posterior Statistics</h4>
                <button
                    onClick={openHelp}
                    className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors"
                    title="How to read MCMC results"
                >
                    <HelpCircle className="w-3.5 h-3.5" />
                    Help
                </button>
            </div>

            <div className={`grid ${isCompact ? 'grid-cols-4' : 'grid-cols-2'} gap-2`}>
                <StatCard
                    label="Acceptance Rate"
                    value={`${stats.acceptanceRate.toFixed(1)}%`}
                    color="bg-indigo-50 text-indigo-900"
                />
                <StatCard
                    label="Chain Length"
                    value={stats.chainLength.toLocaleString()}
                    subtitle="post burn-in samples"
                    color="bg-indigo-50 text-indigo-900"
                />
                <StatCard
                    label="Stress Ratio"
                    value={`${stats.stressRatioMean.toFixed(3)} \u00B1 ${stats.stressRatioStd.toFixed(3)}`}
                    subtitle={`${ciLabel}: [${srCI.lo.toFixed(3)}, ${srCI.hi.toFixed(3)}]`}
                    color="bg-blue-50 text-blue-900"
                />
                <StatCard
                    label="Misfit"
                    value={`${stats.misfitMean.toFixed(4)} \u00B1 ${stats.misfitStd.toFixed(4)}`}
                    subtitle={`Min: ${stats.misfitMin.toFixed(4)}`}
                    color="bg-amber-50 text-amber-900"
                />
            </div>

            {/* CI slider */}
            <div className="mt-3 mb-2 flex items-center gap-3">
                <label className="text-xs font-medium text-indigo-700 whitespace-nowrap">
                    Credible Interval:
                </label>
                <input
                    type="range"
                    min={50}
                    max={99}
                    step={1}
                    value={ciLevel}
                    onChange={(e) => setCiLevel(parseInt(e.target.value))}
                    className="flex-1 h-1.5 bg-indigo-200 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs font-bold text-indigo-800 w-10 text-right">{ciLevel}%</span>
            </div>

            {/* Euler angle stat cards with dynamic CI */}
            {stats.phi && stats.theta && stats.psi && (
                <div className={`grid grid-cols-3 gap-2 mt-2`}>
                    {(['phi', 'theta', 'psi'] as const).map((angle) => {
                        const sym = { phi: 'ϕ', theta: 'θ', psi: 'ψ' }[angle];
                        const lbl = { phi: 'Phi', theta: 'Theta', psi: 'Psi' }[angle];
                        const s = stats[angle]!;
                        const ci = dynCI(angle);
                        return (
                            <StatCard
                                key={angle}
                                label={`${sym} (${lbl})`}
                                value={`${s.mean.toFixed(1)}\u00B0 \u00B1 ${s.std.toFixed(1)}\u00B0`}
                                subtitle={`${ciLabel}: [${ci.lo.toFixed(1)}\u00B0, ${ci.hi.toFixed(1)}\u00B0]`}
                                color="bg-purple-50 text-purple-900"
                            />
                        );
                    })}
                </div>
            )}

            {/* Posterior distribution histograms with dynamic CI */}
            {stats.distributions && sortedDists && (
                <div className="mt-3">
                    <p className="text-xs font-medium text-gray-600 mb-1">Posterior Distributions</p>
                    <div className="flex flex-wrap gap-3 justify-center">
                        {([
                            { key: 'stressRatio' as const, label: 'Stress Ratio', unit: '', color: '#3b82f6',
                              mean: stats.stressRatioMean, bestFit: stats.bestFit?.stressRatio },
                            { key: 'phi' as const, label: 'ϕ (Phi)', unit: '°', color: '#8b5cf6',
                              mean: stats.phi?.mean, bestFit: stats.bestFit?.phi },
                            { key: 'theta' as const, label: 'θ (Theta)', unit: '°', color: '#a855f7',
                              mean: stats.theta?.mean, bestFit: stats.bestFit?.theta },
                            { key: 'psi' as const, label: 'ψ (Psi)', unit: '°', color: '#7c3aed',
                              mean: stats.psi?.mean, bestFit: stats.bestFit?.psi },
                        ]).map(({ key, label, unit, color, mean, bestFit }) => {
                            const ci = dynCI(key);
                            return (
                                <MiniHistogram
                                    key={key}
                                    data={stats.distributions![key]}
                                    label={label}
                                    unit={unit}
                                    color={color}
                                    mean={mean}
                                    q05={ci.lo}
                                    q95={ci.hi}
                                    bestFit={bestFit}
                                    ciLabel={ciLabel}
                                />
                            );
                        })}
                    </div>
                </div>
            )}

            {stats.elapsedMs != null && (
                <div className="mt-2 text-xs text-gray-500 text-right">
                    Computed in {stats.elapsedMs < 1000
                        ? `${Math.round(stats.elapsedMs)} ms`
                        : `${(stats.elapsedMs / 1000).toFixed(2)} s`}
                </div>
            )}

            {/* Help modal */}
            {helpOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                    onClick={() => setHelpOpen(false)}>
                    <div
                        className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b">
                            <h3 className="text-lg font-semibold text-gray-800">MCMC Analysis — Help</h3>
                            <button
                                onClick={() => setHelpOpen(false)}
                                className="p-1 hover:bg-gray-100 rounded transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="px-6 py-4 overflow-auto flex-1">
                            {helpContent ? (
                                <div className="prose prose-sm max-w-none">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm, remarkMath]}
                                        rehypePlugins={[rehypeKatex]}
                                    >
                                        {helpContent}
                                    </ReactMarkdown>
                                </div>
                            ) : (
                                <div className="text-gray-500 text-center py-8">Loading...</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MCMCStatsComponent;
