// inversionBlock.ts
// Stress inversion, through the same service as the Run tab.

import {
    buildResultsFile, computePredictions, enrichFiles, predictionKey, runInversion, MisfitCriterion,
} from '../../inversion/InversionService';
import { CONFIG_DATA, defaultMethodParams } from '../../inversion/methods';
import { BlockDefinition } from '../types';
import { stripInversionFields } from './datasetUtils';

const METHODS = CONFIG_DATA.search.list.filter(m => m.active && m.params.length > 0);

export const InversionBlock: BlockDefinition = {
    type: 'inversion',
    version: 1,
    title: 'Inversion',
    description: 'Stress inversion of a dataset',
    category: 'Processing',
    role: 'computation',
    inputs: [{
        id: 'in', label: 'Data', type: 'Dataset', meaning: {
            Dataset: 'The measured data are inverted',
            InversionResult: 'Its measured data are inverted again; its solution and predictions are discarded',
        },
    }],
    outputs: [{ id: 'out', label: 'Inversion result', type: 'InversionResult' }],
    params: [
        {
            key: 'method', label: 'Search method', kind: 'select', scope: 'scientific',
            default: METHODS[0]?.name ?? '', options: METHODS.map(m => ({ value: m.name, label: m.name }))
        },
        {
            key: 'misfitCriterion', label: 'Misfit criterion', kind: 'select', scope: 'scientific', default: 'ANGLE',
            options: [{ value: 'ANGLE', label: 'Angle' }, { value: 'DOT', label: 'Dot product' }]
        },
        {
            key: 'misfitKeepPercent', label: 'Data fitted (best %)', kind: 'number', scope: 'scientific', default: 100,
            min: 1, max: 100, step: 1, unit: '%', perIteration: true,
            help: 'The misfit minimised is the mean over this share of the data, the best fitted ones (100: all). Below 100 the solution may ignore the rest, e.g. another tectonic phase',
        },
        { key: 'methodParams', label: 'Method parameters', kind: 'methodParams', scope: 'scientific', default: {}, dependsOn: 'method' },
    ],

    // Only the parameters of the chosen method count, with its defaults filled in, so switching
    // method and back gives the same cache key
    normalizeParams(params) {
        const defaults = defaultMethodParams(params.method);
        const stored = params.methodParams ?? {};
        const methodParams = Object.fromEntries(
            Object.entries(defaults).map(([k, v]) => [k, stored[k] !== undefined ? Number(stored[k]) : v]));
        // 100 % is the plain mean, as before this parameter existed: left out, so results computed
        // before keep their cache key
        const { misfitKeepPercent, ...rest } = params;
        const keep = Number(misfitKeepPercent);
        return { ...rest, methodParams, ...(keep > 0 && keep < 100 ? { misfitKeepPercent: keep } : {}) };
    },

    async execute(ctx) {
        const input = ctx.inputs.in[0];
        const { method, misfitCriterion, methodParams } = ctx.params;
        const misfitKeepPercent = Number(ctx.params.misfitKeepPercent ?? 100);
        if (ctx.signal?.aborted) throw new Error('Cancelled');
        if (input.type === 'InversionResult') {
            ctx.log('info', 'The input is an inversion result: its measured data are inverted again; its solution and predictions are discarded');
        }

        // A dataset that went through an earlier inversion is inverted from its measurements only
        const files = stripInversionFields(input.files);

        const run = await runInversion(
            { files, method, params: methodParams, misfitCriterion: misfitCriterion as MisfitCriterion, misfitKeepPercent },
            {
                onStep: (message, progress) => ctx.progress(progress / 100, message),
                onLog: (level, message, details) => ctx.log(level, message, details),
            }
        );
        const predictions = computePredictions(run, run.solution);

        // Rows carry their misfit category too, so the misfit histogram survives filtering, and
        // the index of their datum in the inversion (`_datum`), so views of a subset (kept or
        // rejected data, §14.4) use exactly the data they receive
        const datumOf = new Map(run.origins.map((o, i) => [predictionKey(o.fileId, o.rowIndex), i]));
        const enriched = enrichFiles(files, run.solution, predictions).map(file => ({
            ...file,
            content: (file.content as any[]).map((row, i) => {
                const key = predictionKey(file.id, i);
                const category = predictions.get(key)?.category;
                const datum = datumOf.get(key);
                return category || datum !== undefined
                    ? { ...row, ...(category ? { misfit_category: category } : {}), ...(datum !== undefined ? { _datum: datum } : {}) }
                    : row;
            }),
        }));

        return {
            outputs: {
                out: {
                    type: 'InversionResult',
                    files: enriched,
                    solution: run.solution,
                    resultsFile: buildResultsFile(run.solution, method, methodParams),
                    run: { data: run.data, engine: run.engine, origins: run.origins },
                    method,
                    methodParams,
                },
            },
        };
    },
};
