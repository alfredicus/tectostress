import { createDefaultRegistry } from '../blocks';
import { runWorkflow, planWorkflow, WorkflowCache } from '../executor';
import { instantiateTemplate, PREDEFINED_WORKFLOWS } from '../templates';
import { canConnect } from '../validate';
import { parseWorkflow } from '../persistence';
import { DatasetPayload, ReportPayload, Workflow } from '../types';
import { countRows, fileRef } from '../blocks/datasetUtils';
import { dataNode, edge, env, FAST_INVERSION, node, seedRandom, synthetic2Files, workflow } from './fixtures';

jest.setTimeout(60000);

let restoreRandom: () => void;
beforeEach(() => { restoreRandom = seedRandom(7); });
afterEach(() => restoreRandom());

const registry = createDefaultRegistry();

describe('aggregate', () => {
    // Two overlapping selections of the same file: faults, and anything dipping more than 45°
    const twoBranches = (mode: string) => {
        const files = synthetic2Files();
        return {
            files,
            wf: workflow(
                [
                    dataNode('d', files),
                    node('faults', 'filter', { dataTypes: ['fault'] }),
                    node('steep', 'filter', { column: 'dip', operator: '>', value: '45' }),
                    node('agg', 'aggregate', { mode }),
                ],
                [edge('d', 'out', 'faults'), edge('d', 'out', 'steep'), edge('faults', 'out', 'agg'), edge('steep', 'out', 'agg')]),
        };
    };

    test('keeps a row received twice only once, in a single file', async () => {
        const { files, wf } = twoBranches('unique');
        const r = await runWorkflow(wf, registry, env(files));
        const faults = countRows((r.nodes['faults'].outputs.out as DatasetPayload).files);
        const steep = countRows((r.nodes['steep'].outputs.out as DatasetPayload).files);
        const out = r.nodes['agg'].outputs.out as DatasetPayload;
        expect(out.files).toHaveLength(1);
        const origins = (out.files[0].content as any[]).map(row => row._origin.rowIndex);
        expect(new Set(origins).size).toBe(origins.length);
        expect(origins.length).toBeLessThan(faults + steep);
        expect(out.provenance.inputs).toHaveLength(2);
    });

    test('can keep every copy', async () => {
        const { files, wf } = twoBranches('concatenate');
        const r = await runWorkflow(wf, registry, env(files));
        const total = countRows((r.nodes['faults'].outputs.out as DatasetPayload).files)
            + countRows((r.nodes['steep'].outputs.out as DatasetPayload).files);
        expect(countRows((r.nodes['agg'].outputs.out as DatasetPayload).files)).toBe(total);
    });

    test('outputs plain data even when fed inversion results', async () => {
        const files = synthetic2Files();
        const wf = workflow(
            [dataNode('d', files), node('i', 'inversion', FAST_INVERSION), node('agg', 'aggregate')],
            [edge('d', 'out', 'i'), edge('i', 'out', 'agg')]);
        const out = (await runWorkflow(wf, registry, env(files))).nodes['agg'].outputs.out as DatasetPayload;
        expect(out.type).toBe('Dataset');
        (out.files[0].content as any[]).forEach(row => expect(row.misfit_angle).toBeUndefined());
        expect((out.files[0] as any).stressAxes).toBeUndefined();
    });
});

describe('generate report', () => {
    /** The predefined workflow, a misfit threshold that rejects some data, and a report of Inversion 2 */
    function withReport(params: Record<string, any> = {}): { wf: Workflow; files: ReturnType<typeof synthetic2Files> } {
        const files = synthetic2Files();
        const wf = instantiateTemplate(PREDEFINED_WORKFLOWS[0]);
        wf.nodes.forEach(n => {
            if (n.type === 'data') n.scientificParams.files = files.map(fileRef);
            if (n.type === 'inversion') Object.assign(n.scientificParams, FAST_INVERSION);
            if (n.type === 'misfit-filter') n.scientificParams.threshold = 3;
        });
        wf.nodes.push({ ...node('report', 'report', params), typeVersion: 2 });
        wf.edges.push(edge('inversion-2', 'out', 'report'));
        return { wf, files };
    }

    test('reports the inversion result connected to it, with its lineage', async () => {
        const { wf, files } = withReport({ title: 'Test report' });
        const r = await runWorkflow(wf, registry, env(files));
        expect(r.nodes['report'].status).toBe('done');
        const doc = (r.nodes['report'].outputs.report as ReportPayload).document;

        expect(doc.title).toBe('Test report');
        expect(doc.workflowName).toBe(wf.name);
        expect(doc.warnings).toEqual([]);
        expect(doc.items).toHaveLength(1);
        const item = doc.items[0];
        expect(item.payload).toBe(r.nodes['inversion-2'].outputs.out);
        expect(item.nodeId).toBe('inversion-2');
        expect(item.lineage.map(p => p.blockType)).toEqual(['data', 'inversion', 'misfit-filter', 'inversion']);
        expect(item.lineage[0].sourceFiles).toEqual(files.map(fileRef));
    });

    test('needs an inversion result: measured data are refused, unconnected it is blocked', async () => {
        const { wf, files } = withReport();
        expect(canConnect(wf, registry, { source: 'data', sourcePort: 'out', target: 'report', targetPort: 'in' }).ok).toBe(false);
        wf.edges = wf.edges.filter(e => e.target !== 'report');
        const r = await runWorkflow(wf, registry, env(files));
        expect(r.nodes['report'].status).toBe('blocked');
    });

    test('a saved v1 report (tags) loses its tag filter and keeps its title', () => {
        const json = JSON.stringify({ schemaVersion: 1, name: 'old', nodes: [
            { id: 'r', type: 'report', typeVersion: 1, scientificParams: { title: 'Phases', tags: 'phase' }, presentationParams: {} },
        ], edges: [] });
        const { workflow: wf } = parseWorkflow(json, registry);
        expect(wf.nodes[0].typeVersion).toBe(2);
        expect(wf.nodes[0].scientificParams).toEqual({ title: 'Phases' });
    });

    test('"run to here" on a report runs what it depends on, nothing else; a plan never generates it', async () => {
        const { wf, files } = withReport();
        const cache = new WorkflowCache();
        const r = await runWorkflow(wf, registry, env(files), { cache, targetNodeId: 'report' });
        expect(r.nodes['inversion-2'].status).toBe('done');
        expect(r.nodes['report'].status).toBe('done');
        expect(r.nodes['tag-outliers']).toBeUndefined();

        const plan = await planWorkflow(wf, registry, env(files), cache, r);
        expect(plan.nodes['report'].status).toBe('stale');
        expect(plan.nodes['report'].outputs.report).toBeUndefined();
    });
});
