// templates.ts
// Predefined workflows (§4.8): the same format as a saved file, opened as an editable copy.

import { Workflow, WorkflowNode } from './types';
import { WORKFLOW_SCHEMA_VERSION } from './persistence';
import { createDefaultRegistry } from './blocks';
import { LOOP_COLLECTED, makeLoop } from './composite';

export interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    workflow: Workflow;
}

/**
 * The target workflow of §7: invert, drop the data the solution fits badly, invert again.
 * The rejected data are kept for the report and shown on their own stereonet.
 * Parameters left out take their block defaults; the Data block's files are chosen by the user.
 */
const MISFIT_REINVERSION: Workflow = {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    name: 'Inversion, misfit filter, re-inversion',
    description: 'Invert, reject the data with a misfit above a threshold, and invert the remaining data again.',
    nodes: [
        { id: 'data', type: 'data', typeVersion: 1, active: true, scientificParams: { files: [] }, presentationParams: {}, position: { x: 0, y: 120 } },
        { id: 'inversion-1', type: 'inversion', typeVersion: 1, label: 'Inversion 1', active: true, scientificParams: {}, presentationParams: {}, position: { x: 220, y: 120 } },
        { id: 'misfit-filter', type: 'misfit-filter', typeVersion: 1, active: true, scientificParams: { threshold: 30 }, presentationParams: {}, position: { x: 440, y: 120 } },
        { id: 'inversion-2', type: 'inversion', typeVersion: 1, label: 'Inversion 2', active: true, scientificParams: {}, presentationParams: {}, position: { x: 660, y: 40 } },
        { id: 'dashboard', type: 'view.dashboard', typeVersion: 1, label: 'Result', active: true, scientificParams: {}, presentationParams: {}, position: { x: 880, y: 40 } },
        { id: 'tag-outliers', type: 'add-tags', typeVersion: 1, active: true, scientificParams: { tag: 'outlier', note: 'Data rejected by the misfit filter' }, presentationParams: {}, position: { x: 660, y: 220 } },
        { id: 'outliers-stereonet', type: 'view.stereonet', typeVersion: 1, label: 'Rejected data', active: true, scientificParams: {}, presentationParams: {}, position: { x: 880, y: 220 } },
    ],
    edges: [
        { id: 'e1', source: 'data', sourcePort: 'out', target: 'inversion-1', targetPort: 'in' },
        { id: 'e2', source: 'inversion-1', sourcePort: 'out', target: 'misfit-filter', targetPort: 'in' },
        { id: 'e3', source: 'misfit-filter', sourcePort: 'kept', target: 'inversion-2', targetPort: 'in' },
        { id: 'e4', source: 'inversion-2', sourcePort: 'out', target: 'dashboard', targetPort: 'in' },
        { id: 'e5', source: 'misfit-filter', sourcePort: 'rejected', target: 'tag-outliers', targetPort: 'in' },
        { id: 'e6', source: 'tag-outliers', sourcePort: 'out', target: 'outliers-stereonet', targetPort: 'in' },
    ],
};

/**
 * Separating tectonic phases (§12.1): invert the data, keep those the solution fits as one phase
 * (re-inverted for its own solution, tagged "phase"), and repeat on the rejected data until too few
 * are left. The loop's collected output gives every datum with its phase number.
 */
function phaseSeparation(): Workflow {
    const n = (id: string, type: string, x: number, y: number, label?: string, scientificParams: Record<string, any> = {}): WorkflowNode =>
        ({ id, type, typeVersion: 1, label, active: true, scientificParams, presentationParams: {}, position: { x, y } });
    const flat: Workflow = {
        schemaVersion: WORKFLOW_SCHEMA_VERSION,
        name: 'Separate tectonic phases',
        description: 'Repeatedly invert, keep the well-fitted data as one phase, and go on with the rejected data. A simple example to adapt: it separates phases well when one dominates the data.',
        nodes: [
            n('data', 'data', 0, 100, undefined, { files: [] }),
            n('inversion', 'inversion', 220, 100, 'Inversion of the remaining data'),
            n('misfit-filter', 'misfit-filter', 440, 100, undefined, { threshold: 25 }),
            n('phase-inversion', 'inversion', 660, 40, 'Phase solution'),
            n('phase-tag', 'add-tags', 880, 40, 'Phase', { tag: 'phase', note: 'Data and stress solution of one tectonic phase' }),
            n('exit', 'exit-loop', 660, 180, 'Too few data left', { metric: 'rows', operator: '<', value: 4 }),
        ],
        edges: [
            { id: 'e1', source: 'data', sourcePort: 'out', target: 'inversion', targetPort: 'in' },
            { id: 'e2', source: 'inversion', sourcePort: 'out', target: 'misfit-filter', targetPort: 'in' },
            { id: 'e3', source: 'misfit-filter', sourcePort: 'kept', target: 'phase-inversion', targetPort: 'in' },
            { id: 'e4', source: 'phase-inversion', sourcePort: 'out', target: 'phase-tag', targetPort: 'in' },
            { id: 'e5', source: 'misfit-filter', sourcePort: 'rejected', target: 'exit', targetPort: 'in' },
        ],
    };
    let k = 0;
    const { workflow, nodeId, definition } = makeLoop(
        flat, createDefaultRegistry(), ['inversion', 'misfit-filter', 'phase-inversion', 'phase-tag', 'exit'],
        'Phase separation', () => `tpl${++k}`,
        { carriedOutput: 'out1', collect: 'out2', maxIterations: 5 });
    // out1 = the rejected data (carried to the next iteration), out2 = the phase, tagged
    if (definition.outputs[0]?.source.port !== 'rejected' || definition.outputs[1]?.source.node !== 'phase-tag') {
        throw new Error('Phase separation template: unexpected loop outputs');
    }
    return {
        ...workflow,
        nodes: [
            ...workflow.nodes,
            n('all-phases', 'view.stereonet', 480, 100, 'All phases'),
            n('report', 'report', 480, 220, undefined, { title: 'Tectonic phases', tags: 'phase' }),
        ],
        edges: [
            ...workflow.edges,
            { id: 'e6', source: nodeId, sourcePort: LOOP_COLLECTED, target: 'all-phases', targetPort: 'in' },
        ],
    };
}

export const PREDEFINED_WORKFLOWS: WorkflowTemplate[] = [
    {
        id: 'misfit-reinversion',
        name: MISFIT_REINVERSION.name,
        description: MISFIT_REINVERSION.description!,
        workflow: MISFIT_REINVERSION,
    },
    (() => {
        const workflow = phaseSeparation();
        return { id: 'phase-separation', name: workflow.name, description: workflow.description!, workflow };
    })(),
];

/** A deep copy of a template's workflow, safe to edit */
export function instantiateTemplate(template: WorkflowTemplate): Workflow {
    return JSON.parse(JSON.stringify(template.workflow));
}
