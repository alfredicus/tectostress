// InversionService.ts
// Stress inversion as a plain function, independent of React: builds the data, runs the search
// method, decomposes the resulting tensor, predicts each datum from the solution and enriches the
// input rows with those predictions. Used by the Run tab, and meant to be used by workflow blocks.

import { SearchMethodFactory, SearchMethod, InverseMethod, DataFactory, Data, FractureStrategy } from '@alfredo-taboada/stress';
import { decomposeStressTensor, eulerAnglesToDegrees, calculateStressRatio, extractEulerAnglesFromWrot } from '../math/tensor_analysis';
import { DataFile } from '../components/DataFile';
import { StressSolution } from '../components/types';

// ============================================================================
// TYPES
// ============================================================================

/** ANGLE = normalized acos in [0,1], DOT = 1−|cos| in [0,1] */
export type MisfitCriterion = 'ANGLE' | 'DOT';

export type InversionLogLevel = 'info' | 'success' | 'warning' | 'error';

export interface InversionRequest {
    /** Files whose rows are inverted together */
    files: DataFile[];
    /** Search method name, as known by SearchMethodFactory (e.g. 'Grid Search', 'MCMC') */
    method: string;
    /** Method parameters, as edited in the UI (sliders give numbers) */
    params: Record<string, number>;
    misfitCriterion: MisfitCriterion;
}

export interface InversionCallbacks {
    /** Coarse progress of the run (0–100). May return a promise, e.g. to let the UI repaint. */
    onStep?: (message: string, progress: number) => void | Promise<void>;
    /** Messages for a console / log */
    onLog?: (level: InversionLogLevel, message: string, details?: string) => void;
    /** Raw progress messages emitted by the search method itself */
    onSearchProgress?: (message: string) => void;
}

/** Source row of a datum handed to the inversion */
export interface DataOrigin {
    fileId: string;
    rowIndex: number;
}

export interface ProcessingStatistics {
    total: number;
    processed: number;
    errors: string[];
    unsupportedTypes: Set<string>;
}

/** Everything a run produces */
export interface InversionRun {
    solution: StressSolution;
    /** Data actually handed to the inversion */
    data: Data[];
    /** Engine holding the solution (used for predictions and the misfit landscape) */
    engine: any;
    /** Parallel to `data`: the source row of each datum */
    origins: DataOrigin[];
    stats: ProcessingStatistics;
}

/** Predicted orientation of one datum, and its angular misfit with the measured one */
export interface Prediction {
    normal?: number[];
    striation?: number[];
    misfitAngle?: number;
    category?: string;
}

/** Predictions keyed by `${fileId}::${rowIndex}` (see predictionKey) */
export type Predictions = Map<string, Prediction>;

export const predictionKey = (fileId: string, rowIndex: number) => `${fileId}::${rowIndex}`;

// ============================================================================
// RUN
// ============================================================================

// Observer class for simulation progress
class SimulationObserver {
    private updateCallback: (message: string) => void;

    constructor(updateCallback: (message: string) => void) {
        this.updateCallback = updateCallback;
    }

    update(message: string) {
        this.updateCallback(message);
    }
}

// Runs the search on the next tick, so a caller that just updated its UI gets a chance to paint
const runInversionAsync = (inv: any): Promise<any> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                const result = inv.run();
                resolve(result);
            } catch (error) {
                reject(error);
            }
        }, 10);
    });
};

/**
 * Run a stress inversion on the rows of `request.files`.
 * Throws when no datum can be processed, or when the search method is unknown.
 */
export async function runInversion(
    request: InversionRequest,
    callbacks: InversionCallbacks = {}
): Promise<InversionRun> {
    const { files, method, params, misfitCriterion } = request;
    const log = callbacks.onLog ?? (() => { });
    const step = async (message: string, progress: number) => { await callbacks.onStep?.(message, progress); };

    log('info', 'Starting stress inversion simulation...');
    log('info', `Selected method: ${method}`);
    log('info', `Processing ${files.length} file(s): ${files.map(f => f.name).join(', ')}`);
    await step('Initializing computation...', 0);

    // Setup inversion method
    log('info', 'Setting up inversion method...');
    await step('Setting up inversion method...', 10);

    const inv = new InverseMethod();
    // For Grid Search, convert 0/1 slider values to booleans for sweep flags
    let methodParams: Record<string, any> = { ...params };
    if (method === 'Grid Search') {
        for (const key of ['sweepPhi', 'sweepTheta', 'sweepAlpha', 'sweepR']) {
            if (key in methodParams) methodParams[key] = methodParams[key] !== 0;
        }
        if ('dimension' in methodParams) methodParams.dimension = Math.round(methodParams.dimension) as 2 | 3 | 4;
    }
    const searchMethod: SearchMethod = SearchMethodFactory.create(method, methodParams);

    if (!searchMethod) {
        throw new Error(`Unknown search method: "${method}". Check that the stress library is up to date.`);
    }

    const paramDetails = Object.entries(params)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
    log('info', 'Using parameters:', paramDetails);

    if (callbacks.onSearchProgress) {
        searchMethod.addObserver(new SimulationObserver(callbacks.onSearchProgress));
    }
    inv.setSearchMethod(searchMethod);

    // Process data
    log('info', 'Processing input data...');
    await step('Processing input data...', 30);

    const stats: ProcessingStatistics = {
        total: 0,
        processed: 0,
        errors: [],
        unsupportedTypes: new Set<string>()
    };

    // Source row of every datum added to the inversion, in insertion order — i.e. exactly
    // parallel to `inv.data`. Rows are matched by position rather than by an `id` column,
    // which not every input file provides.
    const origins: DataOrigin[] = [];

    files.forEach(file => {
        file.content.forEach((dataParams: any, index: number) => {
            stats.total++;

            try {
                const dataType = dataParams['type'];
                const data = DataFactory.create(dataType);

                if (!data) {
                    stats.unsupportedTypes.add(dataType);
                    stats.errors.push(
                        `File "${file.name}", row ${index + 1}: Unsupported data type "${dataType}"`
                    );
                    log('warning', `Unsupported data type: ${dataType}`, `File: ${file.name}, Row: ${index + 1}`);
                    return;
                }

                data.initialize(dataParams);
                (data as any).setStrategy?.(
                    misfitCriterion === 'DOT' ? FractureStrategy.DOT : FractureStrategy.ANGLE
                );

                // Tag the datum with its source file (used by the library in messages).
                try { (data as any).filename = file.name; } catch { /* setter may be absent */ }

                inv.addData(data);
                origins.push({ fileId: file.id, rowIndex: index });
                stats.processed++;

            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                stats.errors.push(
                    `File "${file.name}", row ${index + 1}: ${errorMsg}`
                );
                log('error', `Data processing error in ${file.name}`, `Row ${index + 1}: ${errorMsg}`);
            }
        });
    });

    log('info', `Data processing completed: ${stats.processed}/${stats.total} items processed successfully`);

    if (stats.errors.length > 0) {
        log('warning', `${stats.errors.length} items were skipped due to errors`);

        if (stats.unsupportedTypes.size > 0) {
            log('warning', `Unsupported data types found: ${Array.from(stats.unsupportedTypes).join(', ')}`);
        }
    }

    if (stats.processed === 0) {
        const errorMsg = `No valid data could be processed. Found unsupported types: ${Array.from(stats.unsupportedTypes).join(', ')}`;
        log('error', 'No valid data to process', errorMsg);
        throw new Error(errorMsg);
    }

    if (stats.processed < 3) {
        log('warning', `Only ${stats.processed} data items were processed. Results may not be reliable.`);
    }

    // Run inversion
    log('info', 'Running stress inversion algorithm...');
    await step('Running stress inversion...', 60);

    const t0 = performance.now();
    const sol = await runInversionAsync(inv);
    const elapsedMs = performance.now() - t0;

    // Process results
    log('info', 'Processing inversion results...');
    await step('Processing results...', 90);

    const stressTensor = sol.stressTensorSolution;
    const analysis = decomposeStressTensor(stressTensor);
    const eulerAngles = extractEulerAnglesFromWrot(sol.rotationMatrixW as number[][]);
    const eulerDegrees = eulerAnglesToDegrees(eulerAngles);
    const calculatedStressRatio = calculateStressRatio(analysis.eigenvalues);

    // Log key results
    log('success', 'Stress inversion completed successfully!');
    const elapsedStr = elapsedMs < 1000
        ? `${Math.round(elapsedMs)} ms`
        : `${(elapsedMs / 1000).toFixed(2)} s`;
    log('info', `Running time: ${elapsedStr}`);
    log('info', `Stress ratio: ${sol.stressRatio.toFixed(3)}`);
    log('info', `Fit: ${((1 - sol.misfit) * 100).toFixed(1)}%`);
    log('info', `Misfit: ${misfitCriterion === 'DOT'
        ? sol.misfit.toFixed(4)
        : `${(sol.misfit * 180).toFixed(1)}°`
        }`);

    // Extract MCMC posterior stats if applicable
    let mcmcStats: StressSolution['mcmcStats'] = undefined;
    const isMCMCMethod = method === 'MCMC' || method === 'MCMC Quaternion';
    const isMCMethod = method === 'Monte Carlo' || method === 'Monte Carlo Quaternion';
    if (isMCMCMethod || isMCMethod) {
        const sm = inv.searchMethod;
        const mcStats = (sm as any).getStats?.();
        if (mcStats) {
            mcmcStats = mcStats;
            const label = isMCMethod ? `${method} top-5%` : method;
            log('info', `${label} acceptance rate: ${mcStats.acceptanceRate.toFixed(1)}%`);
            log('info', `${label} chain length: ${mcStats.chainLength} samples`);
            log('info',
                `Stress ratio posterior: ${mcStats.stressRatio.mean.toFixed(3)} ± ${mcStats.stressRatio.std.toFixed(3)} ` +
                `[${mcStats.stressRatio.q05.toFixed(3)}, ${mcStats.stressRatio.q95.toFixed(3)}]`
            );
        }
    }

    await step('Finalizing...', 100);

    const solution: StressSolution = {
        ...sol,
        elapsedMs,
        misfitCriterion,
        mcmcStats,
        rotationMatrixW: sol.rotationMatrixW as number[][],
        analysis: {
            ...analysis,
            eulerAngles,
            eulerAnglesDegrees: eulerDegrees,
            calculatedStressRatio
        },
        // Visualization-ready data
        visualizationData: {
            inputData: files,
            processedDataCount: stats.processed,
            methodParameters: params,
            processingStatistics: stats
        }
    };

    return { solution, data: [...inv.data], engine: inv.engine, origins, stats };
}

// ============================================================================
// PREDICTIONS
// ============================================================================

// Friendly, grouped label for each Data subclass (constructor name) so the misfit
// histogram can be split by data type (striations, fractures, stylolites, …).
const categoryOf = (d: any): string => {
    const cls = d?.constructor?.name ?? '';
    switch (cls) {
        case 'StriatedPlaneKin': return 'Striated planes';
        case 'NeoformedStriatedPlane': return 'Neoformed striated planes';
        case 'ExtensionFracture': return 'Extension fractures';
        case 'StyloliteInterface': return 'Stylolites';
        case 'CompactionBand': return 'Compaction bands';
        case 'DilationBand': return 'Dilation bands';
        default: return cls || 'Other';
    }
};

const isNonZero = (v: number[]) => Array.isArray(v) && v.some(c => Math.abs(c) > 1e-9);

/**
 * Angle in degrees between the measured and the predicted vector, using the same
 * convention as the library's cost functions:
 *   oriented = false → the vector is an axis with no sense (a plane normal, or a
 *                      striation whose movement sense is unknown) ⇒ angle in [0, 90]
 *   oriented = true  → the sense matters (an oriented striation) ⇒ angle in [0, 180]
 */
const angleDeg = (a: number[], b: number[], oriented: boolean): number | undefined => {
    if (!Array.isArray(a) || !Array.isArray(b)) return undefined;
    const na = Math.hypot(a[0], a[1], a[2]);
    const nb = Math.hypot(b[0], b[1], b[2]);
    if (na === 0 || nb === 0) return undefined;
    const c = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (na * nb);
    const cc = oriented ? c : Math.abs(c);
    return Math.acos(Math.min(1, Math.max(-1, cc))) * 180 / Math.PI;
};

/**
 * Compute the predicted (ideal) orientation of each datum from the inverted stress tensor via
 * each Data's predict() method, keyed by source row so results can be matched back exactly.
 * predict() returns either { normal, striation } (faults) or a Vector3 = predicted normal
 * (joints ∥ σ3, stylolites ∥ σ1); shear fractures throw and are skipped.
 *
 * Note: resets `run.engine` to the solution.
 */
export function computePredictions(
    run: Pick<InversionRun, 'data' | 'engine' | 'origins'>,
    solution: StressSolution
): Predictions {
    const map: Predictions = new Map();
    const { data, engine, origins } = run;
    try {
        // The search leaves the engine on the last candidate evaluated, so reset it to the
        // best solution before predicting (mirrors the lib's own Runner).
        engine?.setHypotheticalStress?.(solution.rotationMatrixW, solution.stressRatio);
    } catch (e) {
        console.warn('Could not reset engine to solution for prediction', e);
        return map;
    }

    data.forEach((d: any, i: number) => {
        const origin = origins?.[i];
        if (!origin || typeof d?.predict !== 'function') return;
        try {
            const stress = engine.stress(d.position);
            const pred = d.predict(engine, { stress });
            if (!pred) return;

            const key = predictionKey(origin.fileId, origin.rowIndex);
            const category = categoryOf(d);
            if (Array.isArray(pred)) {
                // Predicted normal (extension fractures ∥ σ3, stylolites ∥ σ1). A plane normal
                // has no sense, so the misfit is the acute angle.
                if (isNonZero(pred)) {
                    map.set(key, { normal: pred, misfitAngle: angleDeg(d.normal, pred, false), category });
                }
            } else if (pred.striation && isNonZero(pred.striation)) {
                // Predicted striation (striated planes / faults); zero when shear stress ≈ 0.
                // pred.normal is the measured plane normal — predict() leaves the plane
                // unchanged — so only the striation is worth overlaying.
                map.set(key, {
                    striation: pred.striation,
                    misfitAngle: angleDeg(d.striationVector, pred.striation, d.oriented !== false),
                    category
                });
            }
        } catch {
            // Skip data that cannot be predicted (e.g. shear stress ≈ 0)
        }
    });

    return map;
}

/**
 * Flat list of per-datum angular differences (measured vs computed), tagged by data type,
 * used to draw the misfit histogram.
 */
export function misfitsFromPredictions(predictions: Predictions): { category: string; angle: number }[] {
    const out: { category: string; angle: number }[] = [];
    predictions.forEach(p => {
        if (p.misfitAngle != null && Number.isFinite(p.misfitAngle)) {
            out.push({ category: p.category ?? 'Other', angle: p.misfitAngle });
        }
    });
    return out;
}

// ============================================================================
// FILES FOR THE VISUALIZATIONS
// ============================================================================

/**
 * Virtual "results" file holding the solution as parameter / value / unit rows (read by the
 * MCMC statistics view among others). `method` and `params` describe the run.
 */
export function buildResultsFile(
    solution: StressSolution,
    method: string,
    params: Record<string, number>
): DataFile {
    return {
        id: 'stress-inversion-results',
        name: 'Stress Inversion Results',
        headers: ['parameter', 'value', 'unit'],
        content: [
            { parameter: 'stress_ratio', value: solution.stressRatio, unit: '' },
            { parameter: 'fit_percentage', value: (1 - solution.misfit) * 100, unit: '%' },
            { parameter: 'misfit_degrees', value: solution.misfit * 180 / Math.PI, unit: 'degrees' },
            ...(solution.analysis ? [
                { parameter: 'sigma1', value: solution.analysis.principalStresses.sigma1.value, unit: '' },
                { parameter: 'sigma2', value: solution.analysis.principalStresses.sigma2.value, unit: '' },
                { parameter: 'sigma3', value: solution.analysis.principalStresses.sigma3.value, unit: '' },
                { parameter: 'phi_degrees', value: solution.analysis.eulerAnglesDegrees.phi, unit: 'degrees' },
                { parameter: 'theta_degrees', value: solution.analysis.eulerAnglesDegrees.theta, unit: 'degrees' },
                { parameter: 'psi_degrees', value: solution.analysis.eulerAnglesDegrees.psi, unit: 'degrees' }
            ] : []),
            ...(solution.elapsedMs != null ? [
                { parameter: 'elapsed_ms', value: solution.elapsedMs, unit: 'ms' }
            ] : []),
            ...(solution.mcmcStats ? [
                { parameter: 'mcmc_acceptance_rate', value: solution.mcmcStats.acceptanceRate, unit: '%' },
                { parameter: 'mcmc_chain_length', value: solution.mcmcStats.chainLength, unit: 'samples' },
                { parameter: 'mcmc_stress_ratio_mean', value: solution.mcmcStats.stressRatio.mean, unit: '' },
                { parameter: 'mcmc_stress_ratio_std', value: solution.mcmcStats.stressRatio.std, unit: '' },
                { parameter: 'mcmc_stress_ratio_q05', value: solution.mcmcStats.stressRatio.q05, unit: '' },
                { parameter: 'mcmc_stress_ratio_q95', value: solution.mcmcStats.stressRatio.q95, unit: '' },
                { parameter: 'mcmc_misfit_mean', value: solution.mcmcStats.misfit.mean, unit: '' },
                { parameter: 'mcmc_misfit_std', value: solution.mcmcStats.misfit.std, unit: '' },
                { parameter: 'mcmc_misfit_min', value: solution.mcmcStats.misfit.min, unit: '' },
                // Euler angle posterior stats (degrees) — guarded for old persisted solutions
                ...(solution.mcmcStats.eulerAngles ? [
                    { parameter: 'mcmc_phi_mean', value: solution.mcmcStats.eulerAngles.phi.mean, unit: 'degrees' },
                    { parameter: 'mcmc_phi_std', value: solution.mcmcStats.eulerAngles.phi.std, unit: 'degrees' },
                    { parameter: 'mcmc_phi_q05', value: solution.mcmcStats.eulerAngles.phi.q05, unit: 'degrees' },
                    { parameter: 'mcmc_phi_q95', value: solution.mcmcStats.eulerAngles.phi.q95, unit: 'degrees' },
                    { parameter: 'mcmc_theta_mean', value: solution.mcmcStats.eulerAngles.theta.mean, unit: 'degrees' },
                    { parameter: 'mcmc_theta_std', value: solution.mcmcStats.eulerAngles.theta.std, unit: 'degrees' },
                    { parameter: 'mcmc_theta_q05', value: solution.mcmcStats.eulerAngles.theta.q05, unit: 'degrees' },
                    { parameter: 'mcmc_theta_q95', value: solution.mcmcStats.eulerAngles.theta.q95, unit: 'degrees' },
                    { parameter: 'mcmc_psi_mean', value: solution.mcmcStats.eulerAngles.psi.mean, unit: 'degrees' },
                    { parameter: 'mcmc_psi_std', value: solution.mcmcStats.eulerAngles.psi.std, unit: 'degrees' },
                    { parameter: 'mcmc_psi_q05', value: solution.mcmcStats.eulerAngles.psi.q05, unit: 'degrees' },
                    { parameter: 'mcmc_psi_q95', value: solution.mcmcStats.eulerAngles.psi.q95, unit: 'degrees' },
                ] : []),
                // Distribution arrays (JSON-encoded) — guarded for old persisted solutions
                ...(solution.mcmcStats.distributions ? (() => {
                    const dist = solution.mcmcStats!.distributions!;
                    const quantile = (sorted: number[], q: number) => {
                        const pos = q * (sorted.length - 1);
                        const lo = Math.floor(pos);
                        const hi = Math.ceil(pos);
                        return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
                    };
                    const q25 = (arr: number[]) => quantile([...arr].sort((a, b) => a - b), 0.25);
                    const q75 = (arr: number[]) => quantile([...arr].sort((a, b) => a - b), 0.75);
                    return [
                        { parameter: 'mcmc_dist_stress_ratio', value: JSON.stringify(dist.stressRatio), unit: 'json' },
                        { parameter: 'mcmc_dist_phi', value: JSON.stringify(dist.phi), unit: 'json' },
                        { parameter: 'mcmc_dist_theta', value: JSON.stringify(dist.theta), unit: 'json' },
                        { parameter: 'mcmc_dist_psi', value: JSON.stringify(dist.psi), unit: 'json' },
                        // Q25/Q75 for 50% credible intervals
                        { parameter: 'mcmc_stress_ratio_q25', value: q25(dist.stressRatio), unit: '' },
                        { parameter: 'mcmc_stress_ratio_q75', value: q75(dist.stressRatio), unit: '' },
                        { parameter: 'mcmc_phi_q25', value: q25(dist.phi), unit: 'degrees' },
                        { parameter: 'mcmc_phi_q75', value: q75(dist.phi), unit: 'degrees' },
                        { parameter: 'mcmc_theta_q25', value: q25(dist.theta), unit: 'degrees' },
                        { parameter: 'mcmc_theta_q75', value: q75(dist.theta), unit: 'degrees' },
                        { parameter: 'mcmc_psi_q25', value: q25(dist.psi), unit: 'degrees' },
                        { parameter: 'mcmc_psi_q75', value: q75(dist.psi), unit: 'degrees' },
                    ];
                })() : []),
                // Monte Carlo specific info
                ...((method === 'Monte Carlo' || method === 'Monte Carlo Quaternion') ? [
                    { parameter: 'mc_total_samples', value: params.nbRandomTrials ?? Math.round(solution.mcmcStats.chainLength / (params.topFraction ?? 0.05)), unit: '' },
                    { parameter: 'mc_accepted_count', value: solution.mcmcStats.chainLength, unit: '' },
                    { parameter: 'mc_acceptance_threshold', value: (params.topFraction ?? 0.05) * 100, unit: '%' },
                    { parameter: 'mc_threshold_type', value: 'top_pct', unit: '' },
                ] : []),
                // MCMC tuning parameters (derived from run params)
                ...(method === 'MCMC' && Object.keys(params).length > 0 ? [
                    { parameter: 'mcmc_n_burn', value: Math.floor((params.nbIterations ?? 50000) * (params.burnIn ?? 0.2)), unit: 'samples' },
                    { parameter: 'mcmc_sigma_rot', value: (params.rotAngleStepSize ?? 5) * Math.PI / 180, unit: 'radians' },
                    { parameter: 'mcmc_sigma_R', value: params.stressRatioStepSize ?? 0.05, unit: '' },
                ] : []),
                // MCMC Quaternion tuning parameters
                ...(method === 'MCMC Quaternion' && Object.keys(params).length > 0 ? [
                    { parameter: 'mcmc_n_burn', value: Math.floor((params.nbIterations ?? 50000) * (params.burnIn ?? 0.2)), unit: 'samples' },
                    { parameter: 'mcmc_sigma_rot', value: params.sigmaRot ?? 0.1, unit: 'radians' },
                    { parameter: 'mcmc_sigma_R', value: params.sigmaR ?? 0.05, unit: '' },
                    { parameter: 'mcmc_sigma_noise', value: params.sigmaNoise ?? (Math.PI / 18), unit: 'radians' },
                ] : []),
                // Stress axis orientation statistics (sigma1, sigma2, sigma3)
                ...(solution.mcmcStats.axesStats ? (() => {
                    const ax = solution.mcmcStats.axesStats!;
                    const axisKeys = (name: string, s: typeof ax.sigma1) => [
                        { parameter: `mcmc_${name}_trend`, value: s.trend, unit: 'degrees' },
                        { parameter: `mcmc_${name}_plunge`, value: s.plunge, unit: 'degrees' },
                        { parameter: `mcmc_${name}_mean_resultant_length`, value: s.meanResultantLength, unit: '' },
                        { parameter: `mcmc_${name}_fisher95`, value: s.fisherCone95, unit: 'degrees' },
                        { parameter: `mcmc_${name}_fisher68`, value: s.fisherCone68, unit: 'degrees' },
                    ];
                    return [
                        ...axisKeys('sigma1', ax.sigma1),
                        ...axisKeys('sigma2', ax.sigma2),
                        ...axisKeys('sigma3', ax.sigma3),
                        { parameter: 'mcmc_rotation_angle_mean', value: ax.rotationAngle.mean, unit: 'degrees' },
                        { parameter: 'mcmc_rotation_angle_std', value: ax.rotationAngle.std, unit: 'degrees' },
                        { parameter: 'mcmc_rotation_angle_q05', value: ax.rotationAngle.q05, unit: 'degrees' },
                        { parameter: 'mcmc_rotation_angle_q95', value: ax.rotationAngle.q95, unit: 'degrees' },
                    ];
                })() : []),
            ] : [])
        ],
        layout: { x: 0, y: 0, w: 6, h: 3 }
    };
}

/**
 * Copies of `files` whose rows carry the predicted orientation (`predicted_normal` /
 * `predicted_striation`) and `misfit_angle`, and whose file object carries the principal stress
 * axes (`stressAxes`), so the visualizations can overlay measured vs computed data.
 * Originals are never mutated.
 */
export function enrichFiles(
    files: DataFile[],
    solution: StressSolution,
    predictions: Predictions
): DataFile[] {
    // Principal stress axis directions (σ1, σ2, σ3), in the same coordinate frame as the
    // data normals, so the stereonet can overlay them. Attached to every file below.
    const stressAxes = solution.analysis
        ? {
            sigma1: solution.analysis.principalStresses.sigma1.direction,
            sigma2: solution.analysis.principalStresses.sigma2.direction,
            sigma3: solution.analysis.principalStresses.sigma3.direction
        }
        : undefined;

    return files.map(file => {
        const rows = file.content || (file as any).data;
        let newFile: any = file;
        if (predictions.size > 0 && Array.isArray(rows)) {
            let touched = false;
            const newRows = rows.map((row: any, rowIndex: number) => {
                const pred = predictions.get(predictionKey(file.id, rowIndex));
                if (!pred) return row;
                touched = true;
                return {
                    ...row,
                    ...(pred.normal ? { predicted_normal: pred.normal } : {}),
                    ...(pred.striation ? { predicted_striation: pred.striation } : {}),
                    ...(pred.misfitAngle != null ? { misfit_angle: pred.misfitAngle } : {})
                };
            });
            if (touched) newFile = { ...file, content: newRows };
        }
        return stressAxes ? { ...newFile, stressAxes } : newFile;
    });
}
