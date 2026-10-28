import { createDefaultRegistry } from '../blocks';
import { runWorkflow, planWorkflow, WorkflowCache } from '../executor';
import { instantiateTemplate, PREDEFINED_WORKFLOWS } from '../templates';
import { groupAsComposite, ungroupComposite, registryFor, CompositeError } from '../composite';
import { parseWorkflow, serializeWorkflow } from '../persistence';
import { canConnect, validateWorkflow } from '../validate';
import { DatasetPayload, InversionResultPayload, Workflow } from '../types';
import { countRows, fileRef } from '../blocks/datasetUtils';
import { dataNode, edge, env, exampleFiles, FAST_INVERSION, node, seedRandom, synthetic2Files, workflow } from './fixtures';
import { synthetic_faults } from '../../components/data/synthetic-faults';

jest.setTimeout(60000);

const base = createDefaultRegistry();
let counter = 0;
const makeId = () => `id${++counter}`;

let restoreRandom: () => void;
beforeEach(() => { restoreRandom = seedRandom(11); });
afterEach(() => restoreRandom());

function template(files = synthetic2Files(), threshold = 3): Workflow {
    const wf = instantiateTemplate(PREDEFINED_WORKFLOWS[0]);
    wf.nodes.forEach(n => {
        if (n.type === 'data') n.scientificParams.files = files.map(fileRef);
        if (n.type === 'inversion') Object.assign(n.scientificParams, FAST_INVERSION);
        if (n.type === 'misfit-filter') n.scientificParams.threshold = threshold;
    });
    return wf;
}

/** The template with "misfit filter → inversion 2" grouped as one block */
function grouped(files = synthetic2Files()) {
    return groupAsComposite(template(files), base, ['misfit-filter', 'inversion-2'], 'Clean and re-invert', makeId);
}

describe('grouping', () => {
    test('connections crossing the selection become the inputs and outputs of the group', () => {
        const { workflow, definition, nodeId } = grouped();
        expect(definition.title).toBe('Clean and re-invert');
        expect(definition.nodes.map(n => n.id).sort()).toEqual(['inversion-2', 'misfit-filter']);
        expect(definition.edges).toHaveLength(1);
        expect(definition.inputs).toEqual([expect.objectContaining({
            id: 'in1', type: 'InversionResult', targets: [{ node: 'misfit-filter', port: 'in' }],
        })]);
        expect(definition.outputs.map(o => [o.source.node, o.source.port, o.type])).toEqual([
            ['inversion-2', 'out', 'InversionResult'],
            ['misfit-filter', 'rejected', 'InversionResult'],
        ]);
        expect(workflow.nodes.map(n => n.id)).toContain(nodeId);
        expect(validateWorkflow(workflow, registryFor(workflow, base)).filter(i => i.severity === 'error')).toEqual([]);
    });

    test('report blocks, single blocks and nested groups are refused', () => {
        const wf = template();
        wf.nodes.push({ ...wf.nodes[0], id: 'report', type: 'report', scientificParams: {} });
        expect(() => groupAsComposite(wf, base, ['inversion-2', 'report'], 'x', makeId)).toThrow(CompositeError);
        expect(() => groupAsComposite(wf, base, ['inversion-2'], 'x', makeId)).toThrow(/at least two/);
        const { workflow, nodeId } = grouped();
        expect(() => groupAsComposite(workflow, registryFor(workflow, base), [nodeId, 'inversion-1'], 'y', makeId))
            .toThrow(/another group/);
    });
});

describe('a group containing views', () => {
    // Data + Inversion + Dashboard, a ready-made analysis
    function analysis(files = synthetic2Files()) {
        const wf = template(files);
        wf.nodes.find(n => n.id === 'dashboard')!.presentationParams = { views: ['view.summary'] };
        // Re-wire the dashboard onto inversion 1 so the three blocks form a closed group
        wf.edges = wf.edges.map(e => e.target === 'dashboard' ? { ...e, source: 'inversion-1' } : e);
        return groupAsComposite(wf, base, ['data', 'inversion-1', 'dashboard'], 'Quick analysis', makeId);
    }

    test('exposes its final result as an output, even when only a view inside uses it', async () => {
        const files = synthetic2Files();
        const { workflow, nodeId, definition } = analysis(files);
        expect(definition.outputs.map(o => [o.source.node, o.source.port, o.type]))
            .toEqual([['inversion-1', 'out', 'InversionResult']]);

        // Connect it onwards
        const reg = registryFor(workflow, base);
        const candidate = { source: nodeId, sourcePort: 'out1', target: 'outliers-stereonet', targetPort: 'in' };
        workflow.edges = workflow.edges.filter(e => e.target !== 'outliers-stereonet');
        expect(canConnect(workflow, reg, candidate).ok).toBe(true);
        workflow.edges.push({ id: 'onwards', ...candidate });
        const r = await runWorkflow(workflow, base, env(files));
        expect(r.nodes['outliers-stereonet'].status).toBe('done');
        expect(r.nodes['outliers-stereonet'].inputs.in[0]).toBe(r.nodes[`${nodeId}/inversion-1`].outputs.out);
    });

    test('runs, and its inner views receive their inputs', async () => {
        const files = synthetic2Files();
        const { workflow, nodeId } = analysis(files);
        const r = await runWorkflow(workflow, base, env(files));
        expect(r.nodes[nodeId].status).toBe('done');
        const dashboard = r.nodes[`${nodeId}/dashboard`];
        expect(dashboard.status).toBe('done');
        expect(dashboard.inputs.in[0]).toBe(r.nodes[`${nodeId}/inversion-1`].outputs.out);
    });

    test('keeps the display settings of its views, through ungrouping too', () => {
        const { workflow, nodeId } = analysis();
        const node = workflow.nodes.find(n => n.id === nodeId)!;
        expect(node.presentationParams.inner.dashboard).toEqual({ views: ['view.summary'] });
        node.presentationParams.inner.dashboard = { views: ['view.stereonet'] };
        const back = ungroupComposite(workflow, nodeId, makeId);
        expect(back.nodes.find(n => n.type === 'view.dashboard' && n.id.startsWith('dashboard-'))!.presentationParams)
            .toEqual({ views: ['view.stereonet'] });
    });
});

describe('inputs of a group', () => {
    test('a group with a Data block gets an optional input that can replace its data', async () => {
        const files = synthetic2Files();
        const faults = exampleFiles(synthetic_faults as any, 'faults');
        // Data → Inversion → Dashboard, grouped
        const wf = workflow(
            [dataNode('d', files), node('i', 'inversion', FAST_INVERSION), node('v', 'view.dashboard')],
            [edge('d', 'out', 'i'), edge('i', 'out', 'v')]);
        const { workflow: grouped_, nodeId, definition } = groupAsComposite(wf, base, ['d', 'i', 'v'], 'Analysis', makeId);
        expect(definition.inputs).toEqual([expect.objectContaining({
            type: 'Dataset', optional: true, replaces: { node: 'd', port: 'out' }, targets: [{ node: 'i', port: 'in' }],
        })]);

        // Not connected: no warning, the group reads its own data
        expect(validateWorkflow(grouped_, registryFor(grouped_, base))).toEqual([]);
        const own = await runWorkflow(grouped_, base, env([...files, ...faults]));
        expect(own.nodes[nodeId].status).toBe('done');
        expect(countRows((own.nodes[`${nodeId}/i`].outputs.out as DatasetPayload).files)).toBe(countRows(files));

        // Connected: the group works on the dataset received, and its own Data block is left out
        grouped_.nodes.push(dataNode('other', faults));
        grouped_.edges.push(edge('other', 'out', nodeId, definition.inputs[0].id));
        const other = await runWorkflow(grouped_, base, env([...files, ...faults]));
        expect(other.nodes[nodeId].status).toBe('done');
        expect(countRows((other.nodes[`${nodeId}/i`].outputs.out as DatasetPayload).files)).toBe(countRows(faults));
        expect(other.nodes[`${nodeId}/d`]).toBeUndefined();

        // Ungrouped, the outside data keep feeding the inversion
        const back = ungroupComposite(grouped_, nodeId, makeId);
        expect(validateWorkflow(back, base).filter(i => i.severity === 'error')).toEqual([]);
        const inv = back.nodes.find(n => n.type === 'inversion')!;
        expect(back.edges.filter(e => e.target === inv.id).map(e => e.source)).toEqual(['other']);
    });

    test('the first block of a group decides the type of its required input', () => {
        const wf = workflow(
            [node('m', 'misfit-filter'), node('i', 'inversion', FAST_INVERSION), node('v', 'view.stereonet')],
            [edge('m', 'kept', 'i'), edge('i', 'out', 'v')]);
        const fromMisfit = groupAsComposite(wf, base, ['m', 'i'], 'A', makeId).definition;
        expect(fromMisfit.inputs.map(i => [i.type, i.optional])).toEqual([['InversionResult', undefined]]);

        // Inversion → Stereonet with nothing feeding the inversion
        const alone = workflow([node('i', 'inversion', FAST_INVERSION), node('v', 'view.stereonet')], [edge('i', 'out', 'v')]);
        const fromInversion = groupAsComposite(alone, base, ['i', 'v'], 'B', makeId);
        expect(fromInversion.definition.inputs.map(i => i.type)).toEqual(['Dataset']);
        // Unconnected, a required input is reported
        const issues = validateWorkflow(fromInversion.workflow, registryFor(fromInversion.workflow, base));
        expect(issues.some(i => i.severity === 'warning' && i.nodeId === fromInversion.nodeId)).toBe(true);
    });
});

describe('running a group', () => {
    test('gives the same results as the blocks it contains', async () => {
        const files = synthetic2Files();
        const plain = await runWorkflow(template(files), base, env(files));

        restoreRandom();
        restoreRandom = seedRandom(11);
        const { workflow, nodeId } = grouped(files);
        const r = await runWorkflow(workflow, base, env(files));

        expect(r.nodes[nodeId].status).toBe('done');
        const viaGroup = r.nodes[nodeId].outputs.out1 as InversionResultPayload;
        const direct = plain.nodes['inversion-2'].outputs.out as InversionResultPayload;
        expect(viaGroup.solution.stressRatio).toBe(direct.solution.stressRatio);
        // Ids depend on block types, parameters and inputs, not on names: grouping keeps them
        expect(viaGroup.provenance.id).toBe(direct.provenance.id);
        expect(countRows((r.nodes[nodeId].outputs.out2 as DatasetPayload).files))
            .toBe(countRows((plain.nodes['misfit-filter'].outputs.rejected as DatasetPayload).files));
        // Blocks around the group receive its outputs
        expect(r.nodes['dashboard'].inputs.in[0]).toBe(viaGroup);
        expect(r.tagged).toHaveLength(1);
        // Inner results are reported too
        expect(r.nodes[`${nodeId}/inversion-2`].status).toBe('done');
    });

    test('a second run reuses the cache; editing an inner parameter makes the group stale', async () => {
        const files = synthetic2Files();
        const cache = new WorkflowCache();
        const { workflow, nodeId } = grouped(files);
        const first = await runWorkflow(workflow, base, env(files), { cache });
        const again = await runWorkflow(workflow, base, env(files), { cache, previous: first });
        expect(again.nodes[nodeId].cached).toBe(true);

        const node = workflow.nodes.find(n => n.id === nodeId)!;
        node.scientificParams.inner['misfit-filter'] = { ...node.scientificParams.inner['misfit-filter'], threshold: 30 };
        const plan = await planWorkflow(workflow, base, env(files), cache, again);
        expect(plan.nodes['inversion-1'].status).toBe('done');
        expect(plan.nodes[nodeId].status).toBe('stale');

        const third = await runWorkflow(workflow, base, env(files), { cache, previous: again });
        expect(countRows((third.nodes[nodeId].outputs.out2 as DatasetPayload).files))
            .toBeLessThan(countRows((again.nodes[nodeId].outputs.out2 as DatasetPayload).files));
    });

    test('shows why it cannot run, and stops its branch when switched off', async () => {
        const files = synthetic2Files();
        const { workflow, nodeId } = grouped(files);
        const failed = await runWorkflow(workflow, base, env([]));
        expect(failed.nodes[nodeId].status).toBe('blocked');
        expect(failed.nodes[nodeId].reason).toMatch(/^misfit-filter: Inversion 1 is blocked/);

        workflow.nodes.find(n => n.id === nodeId)!.active = false;
        const off = await runWorkflow(workflow, base, env(files));
        expect(off.nodes[nodeId].status).toBe('inactive');
        expect(off.nodes['dashboard'].status).toBe('blocked');
    });

    test('"run to here" on a group runs it and what it needs, nothing else', async () => {
        const files = synthetic2Files();
        const { workflow, nodeId } = grouped(files);
        const r = await runWorkflow(workflow, base, env(files), { targetNodeId: nodeId });
        expect(r.nodes[nodeId].status).toBe('done');
        expect(r.nodes['tag-outliers']).toBeUndefined();
    });
});

describe('ungroup and files', () => {
    test('ungrouping restores the blocks, the connections and the edited parameters', async () => {
        const files = synthetic2Files();
        const { workflow, nodeId } = grouped(files);
        workflow.nodes.find(n => n.id === nodeId)!.scientificParams.inner['misfit-filter'].threshold = 12;
        const back = ungroupComposite(workflow, nodeId, makeId);

        expect(back.nodes.map(n => n.type).sort()).toEqual(template().nodes.map(n => n.type).sort());
        expect(back.edges).toHaveLength(template().edges.length);
        expect(back.composites).toEqual([]);
        expect(back.nodes.find(n => n.type === 'misfit-filter')!.scientificParams.threshold).toBe(12);
        expect(validateWorkflow(back, base).filter(i => i.severity === 'error')).toEqual([]);
        const r = await runWorkflow(back, base, env(files));
        Object.values(r.nodes).forEach(n => expect(n.status).toBe('done'));
    });

    test('a workflow file carries the definitions of the groups it uses', () => {
        const { workflow, nodeId } = grouped();
        const unused = { ...workflow.composites![0], type: 'composite:unused-1' };
        const json = serializeWorkflow({ ...workflow, composites: [...workflow.composites!, unused] });
        const { workflow: loaded, issues } = parseWorkflow(json, base);
        expect(loaded.composites!.map(c => c.type)).toEqual([workflow.composites![0].type]);
        expect(loaded.nodes.find(n => n.id === nodeId)!.type).toBe(workflow.composites![0].type);
        expect(issues.filter(i => i.severity === 'error')).toEqual([]);
    });
});
