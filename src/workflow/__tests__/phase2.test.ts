import { createDefaultRegistry } from '../blocks';
import { runWorkflow, planWorkflow, WorkflowCache } from '../executor';
import { instantiateTemplate, PREDEFINED_WORKFLOWS } from '../templates';
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
    /** The predefined workflow, a misfit threshold that rejects some data, and a report block */
    function withReport(params: Record<string, any> = {}): { wf: Workflow; files: ReturnType<typeof synthetic2Files> } {
        const files = synthetic2Files();
        const wf = instantiateTemplate(PREDEFINED_WORKFLOWS[0]);
        wf.nodes.forEach(n => {
            if (n.type === 'data') n.scientificParams.files = files.map(fileRef);
            if (n.type === 'inversion') Object.assign(n.scientificParams, FAST_INVERSION);
            if (n.type === 'misfit-filter') n.scientificParams.threshold = 3;
        });
        // Also keep the final inversion for the report
        wf.nodes.push(node('tag-final', 'add-tags', { tag: 'final', note: 'Re-inverted data' }));
        wf.edges.push(edge('inversion-2', 'out', 'tag-final'));
        wf.nodes.push(node('report', 'report', params));
        return { wf, files };
    }

    test('runs last and collects every tagged item with its lineage', async () => {
        const { wf, files } = withReport({ title: 'Test report' });
        const r = await runWorkflow(wf, registry, env(files));
        expect(r.nodes['report'].status).toBe('done');
        const doc = (r.nodes['report'].outputs.report as ReportPayload).document;

        expect(doc.title).toBe('Test report');
        expect(doc.workflowName).toBe(wf.name);
        expect(doc.items.map(i => i.tag).sort()).toEqual(['final', 'outlier']);
        expect(doc.warnings).toEqual([]);

        const final = doc.items.find(i => i.tag === 'final')!;
        expect(final.note).toBe('Re-inverted data');
        expect(final.lineage.map(p => p.blockType)).toEqual(['data', 'inversion', 'misfit-filter', 'inversion']);
        expect(final.lineage[0].sourceFiles).toEqual(files.map(fileRef));
        expect(final.lineage[final.lineage.length - 1].id).toBe(final.payload.provenance.id);
    });

    test('keeps only the requested tags and warns about missing ones', async () => {
        const { wf, files } = withReport({ tags: 'outlier, nothing' });
        const doc = ((await runWorkflow(wf, registry, env(files))).nodes['report'].outputs.report as ReportPayload).document;
        expect(doc.items.map(i => i.tag)).toEqual(['outlier']);
        expect(doc.warnings).toEqual(['No item tagged “nothing”']);
    });

    test('flags items that could not be refreshed', async () => {
        const { wf, files } = withReport();
        const cache = new WorkflowCache();
        const first = await runWorkflow(wf, registry, env(files), { cache });
        // The data are gone: every branch fails, the report keeps the last items, flagged
        const second = await runWorkflow(wf, registry, env([]), { cache, previous: first });
        const doc = (second.nodes['report'].outputs.report as ReportPayload).document;
        expect(doc.items).toHaveLength(2);
        doc.items.forEach(i => expect(i.outdated).toBe(true));
        expect(doc.warnings[0]).toMatch(/2 item\(s\) come from an earlier run/);
    });

    test('"run to here" on a report runs the whole workflow; a plan never generates it', async () => {
        const { wf, files } = withReport();
        const cache = new WorkflowCache();
        const r = await runWorkflow(wf, registry, env(files), { cache, targetNodeId: 'report' });
        expect(r.nodes['inversion-2'].status).toBe('done');
        expect((r.nodes['report'].outputs.report as ReportPayload).document.items).toHaveLength(2);

        const plan = await planWorkflow(wf, registry, env(files), cache, r);
        expect(plan.nodes['report'].status).toBe('stale');
        expect(plan.nodes['report'].outputs.report).toBeUndefined();
    });
});
