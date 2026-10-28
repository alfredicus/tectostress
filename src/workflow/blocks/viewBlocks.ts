// viewBlocks.ts
// View blocks: leaves that display their input (§4.3). The engine never executes them; the
// Workflow tab renders the visualization named by `visualization` with the received payloads.

import { BlockDefinition, ParamDefinition, PayloadType } from '../types';

/** Saved state of the visualization (zoom, colours, projection…): presentation only */
const STATE_PARAM: ParamDefinition = { key: 'state', label: 'View state', kind: 'object', scope: 'presentation', default: null };

function view(type: string, title: string, input: PayloadType, visualization: string, description: string): BlockDefinition {
    return {
        type,
        version: 1,
        title,
        description,
        category: 'Views',
        role: 'view',
        inputs: [{ id: 'in', label: input === 'Dataset' ? 'Dataset' : 'Inversion result', type: input }],
        outputs: [],
        visualization,
        params: [STATE_PARAM],
    };
}

export const VIEW_BLOCKS: BlockDefinition[] = [
    // Any dataset (and therefore any inversion result, whose predictions they overlay)
    view('view.stereonet', 'Stereonet', 'Dataset', 'wulff', 'Wulff or Schmidt projection of the data'),
    view('view.rose', 'Rose diagram', 'Dataset', 'rose', 'Orientation rose diagram'),
    view('view.histogram', 'Histogram', 'Dataset', 'histogram', 'Histogram of a column'),
    view('view.sphere', 'Sphere', 'Dataset', 'sphere', '3D stress sphere'),
    // Inversion results only
    view('view.summary', 'Summary', 'InversionResult', 'summary', 'Stress ratio, fit, principal stresses'),
    view('view.misfit-histogram', 'Misfit histogram', 'InversionResult', 'misfitHistogram', 'Angular misfit of each datum'),
    view('view.mohr', 'Mohr diagram', 'InversionResult', 'mohr', 'Mohr circles of the solution'),
    view('view.landscape', 'Misfit landscape', 'InversionResult', 'landscape', 'Misfit around the solution'),
    view('view.mcmc-stats', 'MCMC statistics', 'InversionResult', 'mcmcStats', 'Posterior statistics of MCMC / Monte Carlo methods'),
];

export const DashboardBlock: BlockDefinition = {
    type: 'view.dashboard',
    version: 1,
    title: 'Dashboard',
    description: 'Several views laid out together; computes nothing (§4.9)',
    category: 'Views',
    role: 'view',
    inputs: [{ id: 'in', label: 'Values', type: 'Dataset', multiple: true }],
    outputs: [],
    params: [
        {
            key: 'views', label: 'Views', kind: 'multiselect', scope: 'presentation',
            default: ['view.stereonet', 'view.misfit-histogram', 'view.summary'],
            options: VIEW_BLOCKS.map(v => ({ value: v.type, label: v.title })),
        },
        { key: 'layout', label: 'Layout', kind: 'object', scope: 'presentation', default: null },
    ],
};
