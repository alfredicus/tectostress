// viewBlocks.ts
// View blocks: leaves that display their input (§4.3). The engine never executes them; the
// Workflow tab renders the visualization named by `visualization` with the received payloads.

import { BlockDefinition, ParamDefinition, PayloadType } from '../types';

/** Saved state of the visualization (zoom, colours, projection…): presentation only */
const STATE_PARAM: ParamDefinition = { key: 'state', label: 'View state', kind: 'object', scope: 'presentation', default: null };

/** Kept / rejected data after a Misfit filter (§14.4): which population the view shows */
export const SHOW_PARAM: ParamDefinition = {
    key: 'show', label: 'Show', kind: 'select', scope: 'presentation', default: 'both',
    options: [
        { value: 'both', label: 'Kept and rejected (distinguished)' },
        { value: 'kept', label: 'Kept only' },
        { value: 'rejected', label: 'Rejected only' },
    ],
    help: 'For data that went through a Misfit filter; ignored otherwise',
};

type ViewInput = 'measured' | 'result' | 'either' | 'separate';

const MEASURED = 'The measured data received';
const RESULT_FOR_PLOT = 'The observations, with the predicted striations; after a Misfit filter, kept and rejected data are distinguished';

/**
 * A view block. Its input(s), §16.3:
 * - 'measured' / 'result': one input of that kind only;
 * - 'either': one input taking both, used the same way (measured data);
 * - 'separate': two inputs, because the view shows more for an inversion result than for
 *   measured data. Exactly one is connected.
 */
function view(type: string, title: string, input: ViewInput, visualization: string, description: string,
    meaning: Partial<Record<PayloadType, string>> = {}): BlockDefinition {
    const block: BlockDefinition = {
        type,
        version: 1,
        title,
        description,
        category: 'Views',
        role: 'view',
        inputs: [],
        outputs: [],
        visualization,
        params: [SHOW_PARAM, STATE_PARAM],
    };
    switch (input) {
        case 'measured':
            block.inputs = [{ id: 'in', label: 'Measured data', type: 'Dataset', exact: true, meaning }];
            break;
        case 'result':
            block.inputs = [{ id: 'in', label: 'Inversion result', type: 'InversionResult', meaning }];
            break;
        case 'either':
            block.inputs = [{ id: 'in', label: 'Data', type: 'Dataset', meaning }];
            break;
        case 'separate':
            // Version 2: one input per kind of data (version 1 had a single input taking both)
            block.version = 2;
            block.inputs = [
                { id: 'data', label: 'Measured data', type: 'Dataset', exact: true, optional: true, meaning: { Dataset: meaning.Dataset } },
                { id: 'result', label: 'Inversion result', type: 'InversionResult', optional: true, meaning: { InversionResult: meaning.InversionResult } },
            ];
            block.oneOfInputs = ['data', 'result'];
            block.legacyInputs = { in: { byType: { Dataset: 'data', InversionResult: 'result' }, otherwise: 'data' } };
            block.migrate = params => params;
            break;
    }
    return block;
}

export const VIEW_BLOCKS: BlockDefinition[] = [
    // Measured data, or an inversion result whose predictions are shown too: two inputs
    view('view.stereonet', 'Stereonet', 'separate', 'wulff', 'Wulff or Schmidt projection of the data', {
        Dataset: 'The measured planes and striations', InversionResult: RESULT_FOR_PLOT,
    }),
    view('view.sphere', 'Sphere', 'separate', 'sphere', '3D stress sphere', {
        Dataset: 'The measured planes and striations', InversionResult: RESULT_FOR_PLOT,
    }),
    // Measured columns: the same for measured data and for the data of an inversion result
    view('view.rose', 'Rose diagram', 'either', 'rose', 'Orientation rose diagram', {
        Dataset: MEASURED, InversionResult: 'Its measured data',
    }),
    view('view.histogram', 'Data histogram', 'either', 'histogram', 'Distribution of a measured variable (dip, strike, rake…)', {
        Dataset: MEASURED, InversionResult: 'Its measured data (the misfits are in Misfit histogram)',
    }),
    // They need a stress solution: inversion results only
    view('view.summary', 'Summary', 'result', 'summary', 'Stress ratio, fit, principal stresses'),
    view('view.misfit-histogram', 'Misfit histogram', 'result', 'misfitHistogram', 'Angular misfit of each datum'),
    view('view.mohr', 'Mohr diagram', 'result', 'mohr', 'Mohr circles of the solution'),
    view('view.landscape', 'Misfit landscape', 'result', 'landscape', 'Misfit around the solution'),
    view('view.mcmc-stats', 'MCMC statistics', 'result', 'mcmcStats', 'Posterior statistics of MCMC / Monte Carlo methods'),
];

export const DashboardBlock: BlockDefinition = {
    type: 'view.dashboard',
    version: 1,
    title: 'Dashboard',
    description: 'Several views laid out together; computes nothing (§4.9)',
    category: 'Views',
    role: 'view',
    // Takes both; a view needing an inversion result says so when it receives measured data
    inputs: [{
        id: 'in', label: 'Data', type: 'Dataset', multiple: true, meaning: {
            Dataset: 'Views of measured data; views needing a stress solution show nothing',
            InversionResult: 'Every view chosen',
        },
    }],
    outputs: [],
    params: [
        {
            key: 'views', label: 'Views', kind: 'multiselect', scope: 'presentation',
            default: ['view.stereonet', 'view.misfit-histogram', 'view.summary'],
            options: VIEW_BLOCKS.map(v => ({ value: v.type, label: v.title })),
        },
        SHOW_PARAM,
        { key: 'layout', label: 'Layout', kind: 'object', scope: 'presentation', default: null },
    ],
};
