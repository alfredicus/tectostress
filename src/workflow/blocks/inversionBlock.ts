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
    inputs: [{ id: 'in', label: 'Dataset', type: 'Dataset' }],
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
        { key: 'methodParams', label: 'Method parameters', kind: 'methodParams', scope: 'scientific', default: {}, dependsOn: 'method' },
    ],

    // Only the parameters of the chosen method count, with its defaults filled in, so switching
    // method and back gives the same cache key
    normalizeParams(params) {
        const defaults = defaultMethodParams(params.method);
        const stored = params.methodParams ?? {};
        const methodParams = Object.fromEntries(
            Object.entries(defaults).map(([k, v]) => [k, stored[k] !== undefined ? Number(stored[k]) : v]));
        return { ...params, methodParams };
    },

    async execute(ctx) {
        const input = ctx.inputs.in[0];
        const { method, misfitCriterion, methodParams } = ctx.params;
        if (ctx.signal?.aborted) throw new Error('Cancelled');

        // A dataset that went through an earlier inversion is inverted from its measurements only
        const files = stripInversionFields(input.files);

        const run = await runInversion(
            { files, method, params: methodParams, misfitCriterion: misfitCriterion as MisfitCriterion },
            {
                onStep: (message, progress) => ctx.progress(progress / 100, message),
                onLog: (level, message, details) => ctx.log(level, message, details),
            }
        );
        const predictions = computePredictions(run, run.solution);

        // Rows carry their misfit category too, so the misfit histogram survives filtering
        const enriched = enrichFiles(files, run.solution, predictions).map(file => ({
            ...file,
            content: (file.content as any[]).map((row, i) => {
                const category = predictions.get(predictionKey(file.id, i))?.category;
                return category ? { ...row, misfit_category: category } : row;
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
