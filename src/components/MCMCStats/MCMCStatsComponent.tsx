import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { HelpCircle, X, Info } from 'lucide-react';
import { BaseVisualizationProps } from '../VisualizationStateSystem';
import { MCMCStatsCompState } from './MCMCStatsParameters';

const HELP_FILE = 'gui/MCMC-analysis.md';
const getBasePath = () => process.env.NODE_ENV === 'production' ? '/tectostress' : '';

interface AngleStats {
    mean: number;
    std: number;
    q05: number;
    q95: number;
    q50_lower?: number;  // 50% CI lower bound
    q50_upper?: number;  // 50% CI upper bound
}

// Chain diagnostics for MCMC convergence assessment
interface MCMCDiagnostics {
    nChains?: number;              // Number of independent chains (recommended: 4-8)
    nBurn?: number;                // Burn-in samples discarded (~20% of total)
    thinningInterval?: number;     // Keep every k-th sample (based on τ)
    gelmanRubin?: number;          // R̂ convergence statistic (target: <1.01)
    effectiveSampleSize?: number;  // N_eff (target: >1000 per parameter)
    autocorrelationTime?: number;  // τ - integrated autocorrelation time
}

// Tuning parameters used during MCMC search
interface MCMCTuningParams {
    sigmaRot?: number;       // Rotation proposal width (radians, typical: 0.02-0.5)
    sigmaR?: number;         // Stress ratio proposal width (typical: 0.01-0.2)
    sigmaNoise?: number;     // Angular noise per datum (radians, default: 10°)
    targetAcceptance?: number; // Optimal acceptance rate (23% for MH)
}

// Statistics for one stress axis orientation
interface AxisStatistics {
    meanDirection?: [number, number, number];  // Unit vector (X, Y, Z)
    trend?: number;                            // Azimuth in degrees [0, 360)
    plunge?: number;                           // Inclination in degrees [0, 90]
    fisherCone95?: number;                     // 95% confidence cone half-angle (degrees)
    fisherCone68?: number;                     // 68% confidence cone (1σ equivalent)
    meanResultantLength?: number;              // R̄_k ∈ [0,1], measures dispersion
}

// Enhanced stress ratio statistics with bimodality detection
interface StressRatioStats {
    mean: number;
    std: number;
    ci50: [number, number];      // 50% credible interval
    ci95: [number, number];      // 95% credible interval
    isBimodal?: boolean;         // True if peaks near R≈0 and R≈1
    modes?: [number, number];    // Peak locations if bimodal
    modeWarning?: string;        // Interpretation guidance
}

// Monte Carlo specific information (not applicable to MCMC)
interface MonteCarloInfo {
    totalSamples?: number;         // N = total random samples generated
    acceptedCount?: number;        // |A| = size of accepted set
    acceptanceThreshold?: number;  // ΔM or CI percentage (e.g., 0.5 or 50)
    thresholdType?: string;        // "50_CI", "95_CI", or "delta_M"
    acceptedFraction?: number;     // acceptedCount / totalSamples
}

// Complete MCMC statistics data structure
interface MCMCStatsData {
    // Basic statistics (existing)
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

    // Euler angles (existing)
    phi?: AngleStats;
    theta?: AngleStats;
    psi?: AngleStats;

    // Best-fit values (existing)
    bestFit?: {
        stressRatio?: number;
        phi?: number;
        theta?: number;
        psi?: number;
    };

    // Distributions (existing)
    distributions?: {
        stressRatio: number[];
        phi: number[];
        theta: number[];
        psi: number[];
    };

    // NEW: Chain diagnostics
    diagnostics?: MCMCDiagnostics;

    // NEW: Tuning parameters
    tuning?: MCMCTuningParams;

    // NEW: Enhanced stress ratio statistics
    stressRatioEnhanced?: StressRatioStats;

    // NEW: Stress axis orientations
    axes?: {
        sigma1?: AxisStatistics;  // Maximum principal stress
        sigma2?: AxisStatistics;  // Intermediate principal stress
        sigma3?: AxisStatistics;  // Minimum principal stress
    };

    // NEW: Monte Carlo specific information
    monteCarloInfo?: MonteCarloInfo;
}

/**
 * Detect bimodality in stress ratio distribution
 * Returns true if peaks near R≈0 and R≈1 with trough in between
 */
function detectBimodality(dist: number[]): { isBimodal: boolean; modes?: [number, number]; warning?: string } {
    if (!dist || dist.length < 20) return { isBimodal: false };

    const nbins = 50;
    const hist = new Array(nbins).fill(0);

    // Build histogram
    dist.forEach(r => {
        const bin = Math.min(Math.floor(r * nbins), nbins - 1);
        hist[bin]++;
    });

    // Find peaks in first 20% and last 20% of range
    const edge = Math.floor(nbins * 0.2);
    const leftPeak = Math.max(...hist.slice(0, edge));
    const rightPeak = Math.max(...hist.slice(nbins - edge, nbins));
    const midMax = Math.max(...hist.slice(edge, nbins - edge));

    // Bimodal if both edges have significant peaks and middle is lower
    const isBimodal = (leftPeak > midMax * 1.5 && rightPeak > midMax * 1.5);

    if (isBimodal) {
        const leftMode = hist.slice(0, edge).indexOf(leftPeak) / nbins;
        const rightMode = (nbins - edge + hist.slice(nbins - edge, nbins).indexOf(rightPeak)) / nbins;
        return {
            isBimodal: true,
            modes: [leftMode, rightMode],
            warning: 'Bimodal R distribution detected. Physical degeneracy: report both modes separately. Do NOT average the peaks.'
        };
    }

    return { isBimodal: false };
}

/**
 * Calculate Fisher confidence cone half-angle from mean resultant length
 * Formula from documentation: δ_p = arccos(1 - ((1-R̄)/(R̄)) * ln(1/(1-p/100)))
 */
function fisherCone(meanResultantLength: number, pLevel: number): number {
    if (meanResultantLength <= 0 || meanResultantLength > 1) return NaN;
    const p = pLevel / 100;
    const R = meanResultantLength;
    const arg = 1 - ((1 - R) / R) * Math.log(1 / (1 - p));
    return Math.acos(Math.max(-1, Math.min(1, arg))) * (180 / Math.PI);
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
            q95: get(`mcmc_${prefix}_q95`) ?? 0,
            q50_lower: get(`mcmc_${prefix}_q25`),
            q50_upper: get(`mcmc_${prefix}_q75`)
        };
    };

    const distSR = parseJsonArray('mcmc_dist_stress_ratio');
    const distPhi = parseJsonArray('mcmc_dist_phi');
    const distTheta = parseJsonArray('mcmc_dist_theta');
    const distPsi = parseJsonArray('mcmc_dist_psi');

    // Bimodality detection for stress ratio
    const bimodalityInfo = distSR ? detectBimodality(distSR) : { isBimodal: false };

    // Extract chain diagnostics
    const diagnostics: MCMCDiagnostics | undefined = {
        nChains: get('mcmc_n_chains'),
        nBurn: get('mcmc_n_burn'),
        thinningInterval: get('mcmc_thinning'),
        gelmanRubin: get('mcmc_gelman_rubin'),
        effectiveSampleSize: get('mcmc_eff_sample_size'),
        autocorrelationTime: get('mcmc_autocorr_time')
    };

    // Extract tuning parameters
    const tuning: MCMCTuningParams | undefined = {
        sigmaRot: get('mcmc_sigma_rot'),
        sigmaR: get('mcmc_sigma_R'),
        sigmaNoise: get('mcmc_sigma_noise'),
        targetAcceptance: 0.23  // Theoretical optimal for Metropolis-Hastings
    };

    // Enhanced stress ratio statistics
    const stressRatioEnhanced: StressRatioStats | undefined = {
        mean: get('mcmc_stress_ratio_mean') ?? 0,
        std: get('mcmc_stress_ratio_std') ?? 0,
        ci50: [get('mcmc_stress_ratio_q25') ?? 0, get('mcmc_stress_ratio_q75') ?? 0],
        ci95: [get('mcmc_stress_ratio_q05') ?? 0, get('mcmc_stress_ratio_q95') ?? 0],
        isBimodal: bimodalityInfo.isBimodal,
        modes: bimodalityInfo.modes,
        modeWarning: bimodalityInfo.warning
    };

    // Extract stress axis statistics
    const extractAxisStats = (axisName: string): AxisStatistics | undefined => {
        const trend = get(`mcmc_${axisName}_trend`);
        const plunge = get(`mcmc_${axisName}_plunge`);
        const meanResLength = get(`mcmc_${axisName}_mean_resultant_length`);

        if (trend == null && plunge == null) return undefined;

        return {
            trend,
            plunge,
            meanResultantLength: meanResLength,
            fisherCone95: meanResLength ? fisherCone(meanResLength, 95) : undefined,
            fisherCone68: meanResLength ? fisherCone(meanResLength, 68) : undefined,
            meanDirection: get(`mcmc_${axisName}_direction`)
        };
    };

    // Extract Monte Carlo specific information
    const monteCarloInfo: MonteCarloInfo | undefined = (() => {
        const totalSamples = get('mc_total_samples');
        const acceptedCount = get('mc_accepted_count');
        const threshold = get('mc_acceptance_threshold');
        const thresholdType = get('mc_threshold_type');

        if (totalSamples == null && acceptedCount == null) return undefined;

        return {
            totalSamples,
            acceptedCount,
            acceptanceThreshold: threshold,
            thresholdType,
            acceptedFraction: (totalSamples && acceptedCount) ? acceptedCount / totalSamples : undefined
        };
    })();

    return {
        // Basic statistics (existing)
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

        // Euler angles (existing)
        phi: angleStats('phi'),
        theta: angleStats('theta'),
        psi: angleStats('psi'),

        // Best-fit values (existing)
        bestFit: {
            stressRatio: get('stress_ratio') ?? undefined,
            phi: get('phi_degrees') ?? undefined,
            theta: get('theta_degrees') ?? undefined,
            psi: get('psi_degrees') ?? undefined,
        },

        // Distributions (existing)
        distributions: (distSR && distPhi && distTheta && distPsi)
            ? { stressRatio: distSR, phi: distPhi, theta: distTheta, psi: distPsi }
            : undefined,

        // NEW: Chain diagnostics
        diagnostics: (diagnostics.nChains != null || diagnostics.gelmanRubin != null || diagnostics.nBurn != null) ? diagnostics : undefined,

        // NEW: Tuning parameters
        tuning: tuning.sigmaRot != null || tuning.sigmaR != null ? tuning : undefined,

        // NEW: Enhanced stress ratio statistics
        stressRatioEnhanced,

        // NEW: Stress axis orientations
        axes: {
            sigma1: extractAxisStats('sigma1'),
            sigma2: extractAxisStats('sigma2'),
            sigma3: extractAxisStats('sigma3')
        },

        // NEW: Monte Carlo information
        monteCarloInfo
    };
}

/** Tooltip component for inline help on hover */
const InfoTooltip: React.FC<{ text: string; size?: number }> = ({ text, size = 12 }) => {
    const [show, setShow] = useState(false);
    return (
        <div className="relative inline-block ml-1" style={{ verticalAlign: 'middle' }}>
            <Info
                size={size}
                className="cursor-help opacity-50 hover:opacity-100 transition-opacity"
                onMouseEnter={() => setShow(true)}
                onMouseLeave={() => setShow(false)}
            />
            {show && (
                <div className="absolute z-50 w-64 p-2 text-xs leading-relaxed bg-gray-900 text-white rounded shadow-lg -top-2 left-full ml-2 pointer-events-none">
                    <div className="absolute -left-1 top-3 w-2 h-2 bg-gray-900 transform rotate-45"></div>
                    {text}
                </div>
            )}
        </div>
    );
};

const StatCard: React.FC<{
    label: string;
    value: string;
    subtitle?: string;
    color: string;
    tooltip?: string;
}> = ({ label, value, subtitle, color, tooltip }) => (
    <div className={`${color} p-3 rounded-lg`}>
        <p className="text-xs font-medium opacity-70 mb-1">
            {label}
            {tooltip && <InfoTooltip text={tooltip} />}
        </p>
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

const MCMCStatsComponent: React.FC<BaseVisualizationProps<MCMCStatsCompState> & { inline?: boolean }> = ({
    files,
    width = 400,
    height = 400,
    inline = false
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
        if (inline) return null;
        return (
            <div
                style={{ width, height }}
                className="flex items-center justify-center text-gray-500 border border-dashed border-gray-300 rounded bg-gray-50"
            >
                <div className="text-center p-6 max-w-md">
                    <div className="mb-3">
                        <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <p className="text-sm font-semibold text-gray-700 mb-2">No MCMC/Monte Carlo Data Available</p>
                    <p className="text-xs text-gray-600 leading-relaxed mb-3">
                        Run an MCMC or Monte Carlo stress inversion to see:
                    </p>
                    <ul className="text-xs text-left text-gray-600 space-y-1 mb-3 inline-block">
                        <li>• Posterior distributions and credible intervals</li>
                        <li>• Chain diagnostics and convergence metrics</li>
                        <li>• Stress ratio and axis orientations</li>
                        <li>• Bimodality detection and warnings</li>
                    </ul>
                    <p className="text-xs text-indigo-600 font-medium">
                        ← Select MCMC or Monte Carlo method and click "Run Inversion"
                    </p>
                </div>
            </div>
        );
    }

    const isCompact = !inline && height < 300;

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
            style={inline ? undefined : { width, height }}
            className={inline ? undefined : "p-3 overflow-auto"}
        >
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold text-indigo-800">
                    {stats.monteCarloInfo ? 'Monte Carlo Top-5% Statistics' : 'MCMC Posterior Statistics'}
                </h2>
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

            {/* Monte Carlo Info Panel */}
            {stats.monteCarloInfo && (
                <div className="mt-3 p-3 bg-gradient-to-br from-cyan-50 to-sky-50 rounded-lg border border-cyan-200">
                    <h5 className="text-xs font-bold text-cyan-800 mb-2 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                        </svg>
                        Monte Carlo Sampling Statistics
                    </h5>
                    <div className="grid grid-cols-3 gap-2">
                        {stats.monteCarloInfo.totalSamples != null && (
                            <div className="p-2 rounded bg-cyan-100 text-cyan-900">
                                <p className="text-[10px] font-medium opacity-70">Total Samples</p>
                                <p className="text-sm font-bold">{stats.monteCarloInfo.totalSamples.toLocaleString()}</p>
                                <p className="text-[9px] opacity-60">N (uniform random)</p>
                            </div>
                        )}
                        {stats.monteCarloInfo.acceptedCount != null && (
                            <div className="p-2 rounded bg-sky-100 text-sky-900">
                                <p className="text-[10px] font-medium opacity-70">Accepted</p>
                                <p className="text-sm font-bold">{stats.monteCarloInfo.acceptedCount.toLocaleString()}</p>
                                <p className="text-[9px] opacity-60">
                                    {stats.monteCarloInfo.acceptedFraction != null
                                        ? `${(stats.monteCarloInfo.acceptedFraction * 100).toFixed(1)}% of total`
                                        : 'models'}
                                </p>
                            </div>
                        )}
                        {stats.monteCarloInfo.acceptanceThreshold != null && (
                            <div className="p-2 rounded bg-teal-100 text-teal-900">
                                <p className="text-[10px] font-medium opacity-70">Threshold</p>
                                <p className="text-sm font-bold">
                                    {stats.monteCarloInfo.thresholdType === 'top_pct'
                                        ? `Top ${stats.monteCarloInfo.acceptanceThreshold}%`
                                        : stats.monteCarloInfo.thresholdType?.includes('CI')
                                            ? `${stats.monteCarloInfo.acceptanceThreshold}%`
                                            : `ΔM < ${stats.monteCarloInfo.acceptanceThreshold.toFixed(3)}`}
                                </p>
                                <p className="text-[9px] opacity-60">
                                    {stats.monteCarloInfo.thresholdType === 'top_pct' ? 'top fraction kept' :
                                     stats.monteCarloInfo.thresholdType === '50_CI' ? '50% credible int.' :
                                     stats.monteCarloInfo.thresholdType === '95_CI' ? '95% credible int.' :
                                     'misfit threshold'}
                                </p>
                            </div>
                        )}
                    </div>
                    <p className="text-[9px] text-cyan-800 mt-2 italic">
                        Monte Carlo uses uniform random sampling on SO(3) × [0,1]. No MCMC chains or burn-in required.
                    </p>
                </div>
            )}

            {/* Best-fit vs Mean Comparison (Monte Carlo) */}
            {stats.monteCarloInfo && stats.bestFit && (
                <div className="mt-3 p-3 bg-gradient-to-br from-emerald-50 to-green-50 rounded-lg border border-emerald-200">
                    <h5 className="text-xs font-bold text-emerald-800 mb-2 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Best-fit vs. Posterior Mean Comparison
                    </h5>
                    <div className="grid grid-cols-2 gap-3">
                        {/* Stress Ratio */}
                        {stats.bestFit.stressRatio != null && (
                            <div className="col-span-2 p-2 rounded bg-white bg-opacity-60">
                                <p className="text-[10px] font-medium text-emerald-700 mb-1">Stress Ratio (R)</p>
                                <div className="grid grid-cols-3 gap-2 text-[11px]">
                                    <div>
                                        <span className="text-[9px] text-gray-600">Best-fit:</span>
                                        <span className="ml-1 font-bold text-green-700">{stats.bestFit.stressRatio.toFixed(4)}</span>
                                    </div>
                                    <div>
                                        <span className="text-[9px] text-gray-600">Mean:</span>
                                        <span className="ml-1 font-bold text-blue-700">{stats.stressRatioMean.toFixed(4)}</span>
                                    </div>
                                    <div>
                                        <span className="text-[9px] text-gray-600">Δ:</span>
                                        <span className={`ml-1 font-bold ${
                                            Math.abs(stats.bestFit.stressRatio - stats.stressRatioMean) > 0.1
                                                ? 'text-orange-600' : 'text-gray-600'
                                        }`}>
                                            {Math.abs(stats.bestFit.stressRatio - stats.stressRatioMean).toFixed(4)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* Euler Angles */}
                        {stats.bestFit.phi != null && stats.phi && (
                            <div className="p-2 rounded bg-purple-50">
                                <p className="text-[10px] font-medium text-purple-700 mb-1">ϕ (Phi)</p>
                                <div className="text-[10px] space-y-0.5">
                                    <div><span className="text-gray-600">Best:</span> <span className="font-mono font-bold">{stats.bestFit.phi.toFixed(1)}°</span></div>
                                    <div><span className="text-gray-600">Mean:</span> <span className="font-mono font-bold">{stats.phi.mean.toFixed(1)}°</span></div>
                                </div>
                            </div>
                        )}
                        {stats.bestFit.theta != null && stats.theta && (
                            <div className="p-2 rounded bg-purple-50">
                                <p className="text-[10px] font-medium text-purple-700 mb-1">θ (Theta)</p>
                                <div className="text-[10px] space-y-0.5">
                                    <div><span className="text-gray-600">Best:</span> <span className="font-mono font-bold">{stats.bestFit.theta.toFixed(1)}°</span></div>
                                    <div><span className="text-gray-600">Mean:</span> <span className="font-mono font-bold">{stats.theta.mean.toFixed(1)}°</span></div>
                                </div>
                            </div>
                        )}
                    </div>
                    <p className="text-[9px] text-emerald-700 mt-2 italic">
                        Large difference (Δ) indicates non-Gaussian posterior. Both values should be reported.
                    </p>
                </div>
            )}

            {/* Chain Diagnostics Panel (MCMC only) */}
            {stats.diagnostics && !stats.monteCarloInfo && (
                <div className="mt-3 p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                    <h5 className="text-xs font-bold text-green-800 mb-2 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Chain Diagnostics
                    </h5>
                    <div className="grid grid-cols-3 gap-2">
                        {/* Gelman-Rubin R̂ */}
                        {stats.diagnostics.gelmanRubin != null && (
                            <div className={`p-2 rounded ${
                                stats.diagnostics.gelmanRubin < 1.01 ? 'bg-green-100 text-green-900' :
                                stats.diagnostics.gelmanRubin < 1.05 ? 'bg-yellow-100 text-yellow-900' :
                                'bg-red-100 text-red-900'
                            }`}>
                                <p className="text-[10px] font-medium opacity-70">
                                    Gelman-Rubin R̂
                                    <InfoTooltip text="Measures chain convergence by comparing within-chain to between-chain variance. R̂ < 1.01 means chains have converged to the same distribution. If R̂ > 1.05, run longer chains or increase burn-in." size={10} />
                                </p>
                                <p className="text-sm font-bold">{stats.diagnostics.gelmanRubin.toFixed(4)}</p>
                                <p className="text-[9px] opacity-60">
                                    {stats.diagnostics.gelmanRubin < 1.01 ? '✓ Converged' :
                                     stats.diagnostics.gelmanRubin < 1.05 ? '⚠ Marginal' : '✗ Not converged'}
                                </p>
                            </div>
                        )}

                        {/* Effective Sample Size */}
                        {stats.diagnostics.effectiveSampleSize != null && (
                            <div className={`p-2 rounded ${
                                stats.diagnostics.effectiveSampleSize > 1000 ? 'bg-green-100 text-green-900' :
                                stats.diagnostics.effectiveSampleSize > 500 ? 'bg-yellow-100 text-yellow-900' :
                                'bg-red-100 text-red-900'
                            }`}>
                                <p className="text-[10px] font-medium opacity-70">
                                    Effective N
                                    <InfoTooltip text="Number of independent samples accounting for autocorrelation. Target: >1,000 per parameter. N_eff = total_samples / τ. If too low, run longer chains or increase thinning." size={10} />
                                </p>
                                <p className="text-sm font-bold">{Math.round(stats.diagnostics.effectiveSampleSize).toLocaleString()}</p>
                                <p className="text-[9px] opacity-60">
                                    {stats.diagnostics.effectiveSampleSize > 1000 ? '✓ Sufficient' :
                                     stats.diagnostics.effectiveSampleSize > 500 ? '⚠ Low' : '✗ Too low'}
                                </p>
                            </div>
                        )}

                        {/* Autocorrelation Time */}
                        {stats.diagnostics.autocorrelationTime != null && (
                            <div className="p-2 rounded bg-gray-100 text-gray-900">
                                <p className="text-[10px] font-medium opacity-70">
                                    Autocorr. τ
                                    <InfoTooltip text="How many MCMC steps before samples become approximately independent. τ ≈ 1-5 is excellent, τ ≈ 10-50 is typical. Set thinning interval ≈ τ for independent samples." size={10} />
                                </p>
                                <p className="text-sm font-bold">{stats.diagnostics.autocorrelationTime.toFixed(2)}</p>
                                <p className="text-[9px] opacity-60">samples</p>
                            </div>
                        )}
                    </div>

                    {/* Chain Setup Info */}
                    <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-green-800">
                        {stats.diagnostics.nChains != null && (
                            <div><span className="font-medium">Chains:</span> {stats.diagnostics.nChains}</div>
                        )}
                        {stats.diagnostics.nBurn != null && (
                            <div><span className="font-medium">Burn-in:</span> {stats.diagnostics.nBurn.toLocaleString()}</div>
                        )}
                        {stats.diagnostics.thinningInterval != null && (
                            <div><span className="font-medium">Thinning:</span> 1:{stats.diagnostics.thinningInterval}</div>
                        )}
                    </div>

                    {/* Validation Warnings */}
                    {(stats.diagnostics.gelmanRubin != null && stats.diagnostics.gelmanRubin > 1.05) && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-[10px] text-red-800">
                            <span className="font-bold">⚠ Action needed:</span> R̂ &gt; 1.05 indicates chains have not converged.
                            Try: (1) increase burn-in, (2) run longer chains, or (3) adjust tuning parameters.
                        </div>
                    )}
                    {(stats.diagnostics.effectiveSampleSize != null && stats.diagnostics.effectiveSampleSize < 500) && (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-[10px] text-yellow-800">
                            <span className="font-bold">⚠ Low precision:</span> N_eff &lt; 500. Consider running longer chains or increasing thinning interval ≈ τ.
                        </div>
                    )}
                </div>
            )}

            {/* Tuning Parameters Panel (MCMC only) */}
            {stats.tuning && !stats.monteCarloInfo && (stats.tuning.sigmaRot != null || stats.tuning.sigmaR != null) && (
                <div className="mt-3 p-3 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
                    <h5 className="text-xs font-bold text-indigo-800 mb-2 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                        </svg>
                        MCMC Tuning Parameters
                    </h5>
                    <div className="grid grid-cols-3 gap-2">
                        {stats.tuning.sigmaRot != null && (
                            <div className="p-2 rounded bg-indigo-100 text-indigo-900">
                                <p className="text-[10px] font-medium opacity-70">σ_rot</p>
                                <p className="text-sm font-bold">{stats.tuning.sigmaRot.toFixed(4)}</p>
                                <p className="text-[9px] opacity-60">rad (rotation)</p>
                            </div>
                        )}
                        {stats.tuning.sigmaR != null && (
                            <div className="p-2 rounded bg-purple-100 text-purple-900">
                                <p className="text-[10px] font-medium opacity-70">σ_R</p>
                                <p className="text-sm font-bold">{stats.tuning.sigmaR.toFixed(4)}</p>
                                <p className="text-[9px] opacity-60">stress ratio</p>
                            </div>
                        )}
                        {stats.tuning.sigmaNoise != null && (
                            <div className="p-2 rounded bg-blue-100 text-blue-900">
                                <p className="text-[10px] font-medium opacity-70">σ_noise</p>
                                <p className="text-sm font-bold">{(stats.tuning.sigmaNoise * 180 / Math.PI).toFixed(1)}°</p>
                                <p className="text-[9px] opacity-60">angular noise</p>
                            </div>
                        )}
                    </div>

                    {/* Acceptance Rate vs Target */}
                    {stats.tuning.targetAcceptance != null && (
                        <div className="mt-2 p-2 rounded bg-white bg-opacity-60 text-[10px]">
                            <span className="font-medium text-indigo-800">Acceptance rate:</span>{' '}
                            <span className="font-bold">{stats.acceptanceRate.toFixed(1)}%</span>
                            {' '}/{' '}
                            <span className="text-gray-600">target: {(stats.tuning.targetAcceptance * 100).toFixed(0)}%</span>
                            {Math.abs(stats.acceptanceRate - stats.tuning.targetAcceptance * 100) < 5 && (
                                <span className="ml-1 text-green-600 font-medium">✓ optimal</span>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Bimodality Warning */}
            {stats.stressRatioEnhanced?.isBimodal && stats.stressRatioEnhanced.modeWarning && (
                <div className="mt-3 p-3 bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg border-2 border-orange-300">
                    <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div className="flex-1">
                            <h5 className="text-xs font-bold text-orange-900 mb-1">⚠ Bimodal Stress Ratio Distribution</h5>
                            <p className="text-[11px] text-orange-800 leading-relaxed">
                                {stats.stressRatioEnhanced.modeWarning}
                            </p>
                            {stats.stressRatioEnhanced.modes && (
                                <div className="mt-2 flex gap-3 text-[10px] text-orange-900">
                                    <div className="px-2 py-1 bg-orange-200 rounded font-mono">
                                        Mode 1: R ≈ {stats.stressRatioEnhanced.modes[0].toFixed(3)}
                                    </div>
                                    <div className="px-2 py-1 bg-orange-200 rounded font-mono">
                                        Mode 2: R ≈ {stats.stressRatioEnhanced.modes[1].toFixed(3)}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

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

            {/* Stress Axes Orientation Table */}
            {stats.axes && (stats.axes.sigma1 || stats.axes.sigma2 || stats.axes.sigma3) && (
                <div className="mt-3 p-3 bg-gradient-to-br from-slate-50 to-gray-50 rounded-lg border border-slate-200">
                    <h5 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        Principal Stress Axis Orientations
                    </h5>
                    <div className="overflow-x-auto">
                        <table className="w-full text-[10px] border-collapse">
                            <thead>
                                <tr className="border-b border-slate-300">
                                    <th className="text-left py-1.5 px-2 font-bold text-slate-700">Axis</th>
                                    <th className="text-right py-1.5 px-2 font-bold text-slate-700">
                                        Trend (°)
                                        <InfoTooltip text="Azimuth [0°, 360°) measured clockwise from North. Horizontal projection of the axis direction." size={10} />
                                    </th>
                                    <th className="text-right py-1.5 px-2 font-bold text-slate-700">
                                        Plunge (°)
                                        <InfoTooltip text="Inclination [0°, 90°] from horizontal. 0° = horizontal, 90° = vertical downward." size={10} />
                                    </th>
                                    <th className="text-right py-1.5 px-2 font-bold text-slate-700">
                                        R̄
                                        <InfoTooltip text="Mean resultant length [0, 1]. Measures axis clustering: R̄ ≈ 1 = tight clustering (well-constrained), R̄ ≈ 0 = uniform dispersion (unconstrained)." size={10} />
                                    </th>
                                    <th className="text-right py-1.5 px-2 font-bold text-slate-700">
                                        Fisher 95°
                                        <InfoTooltip text="95% confidence cone half-angle. True axis lies within this cone with 95% probability. <20° = well-constrained, >60° = poorly constrained." size={10} />
                                    </th>
                                    <th className="text-right py-1.5 px-2 font-bold text-slate-700">
                                        Fisher 68°
                                        <InfoTooltip text="68% confidence cone (≈1σ). Narrower, roughly equivalent to one standard deviation for directional data." size={10} />
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {(['sigma1', 'sigma2', 'sigma3'] as const).map((axis) => {
                                    const axisData = stats.axes![axis];
                                    if (!axisData) return null;
                                    const label = axis === 'sigma1' ? 'σ₁ (max)' : axis === 'sigma2' ? 'σ₂ (int)' : 'σ₃ (min)';
                                    const colorClass = axis === 'sigma1' ? 'bg-red-50' : axis === 'sigma2' ? 'bg-green-50' : 'bg-blue-50';
                                    return (
                                        <tr key={axis} className={`border-b border-slate-200 ${colorClass}`}>
                                            <td className="py-1.5 px-2 font-bold text-slate-800">{label}</td>
                                            <td className="py-1.5 px-2 text-right font-mono text-slate-700">
                                                {axisData.trend != null ? axisData.trend.toFixed(1) : '—'}
                                            </td>
                                            <td className="py-1.5 px-2 text-right font-mono text-slate-700">
                                                {axisData.plunge != null ? axisData.plunge.toFixed(1) : '—'}
                                            </td>
                                            <td className="py-1.5 px-2 text-right font-mono text-slate-700">
                                                {axisData.meanResultantLength != null ? axisData.meanResultantLength.toFixed(4) : '—'}
                                            </td>
                                            <td className="py-1.5 px-2 text-right font-mono text-slate-700">
                                                {axisData.fisherCone95 != null && !isNaN(axisData.fisherCone95)
                                                    ? axisData.fisherCone95.toFixed(1) : '—'}
                                            </td>
                                            <td className="py-1.5 px-2 text-right font-mono text-slate-700">
                                                {axisData.fisherCone68 != null && !isNaN(axisData.fisherCone68)
                                                    ? axisData.fisherCone68.toFixed(1) : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-[9px] text-slate-600 mt-2 italic">
                        R̄: mean resultant length (1 = perfect clustering, 0 = uniform dispersion)
                    </p>
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
