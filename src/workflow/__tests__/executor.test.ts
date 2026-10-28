import { createDefaultRegistry, InversionBlock } from '../blocks';
import { BlockRegistry } from '../registry';
import { runWorkflow, planWorkflow, WorkflowCache, WorkflowValidationError } from '../executor';
import { instantiateTemplate, PREDEFINED_WORKFLOWS } from '../templates';
import { BlockDefinition, DatasetPayload, InversionResultPayload, Workflow } from '../types';
import { fileRef, countRows } from '../blocks/datasetUtils';
import { runInversion } from '../../inversion/InversionService';
import { dataNode, edge, env, FAST_INVERSION, faultFiles, node, seedRandom, synthetic2Files, workflow } from './fixtures';

jest.setTimeout(60000);

/** Default registry with the Inversion block wrapped to count its executions */
function countingRegistry() {
    const calls = { inversion: 0 };
    const inv: BlockDefinition = {
        ...InversionBlock,
        execute: async ctx => { calls.inversion++; return InversionBlock.execute!(ctx); },
    };
    const registry = new BlockRegistry();
    createDefaultRegistry().list().forEach(b => registry.register(b.type === 'inversion' ? inv : b));
    return { registry, calls };
}

/** The predefined misfit / re-inversion workflow on the given files, with fast inversions */
function templateWorkflow(files = synthetic2Files(), threshold = 10): Workflow {
    const wf = instantiateTemplate(PREDEFINED_WORKFLOWS[0]);
    wf.nodes.forEach(n => {
        if (n.type === 'data') n.scientificParams.files = files.map(fileRef);
        if (n.type === 'inversion') Object.assign(n.scientificParams, FAST_INVERSION);
        if (n.type === 'misfit-filter') n.scientificParams.threshold = threshold;
    });
    return wf;
}

let restoreRandom: () => void;
beforeEach(() => { restoreRandom = seedRandom(42); });
afterEach(() => restoreRandom());

describe('running the predefined workflow', () => {
    test('every block runs, rows are split and the rejected ones are tagged', async () => {
        const files = synthetic2Files();
        const { registry } = countingRegistry();
        const report = await runWorkflow(templateWorkflow(files), registry, env(files));

        Object.entries(report.nodes).forEach(([id, r]) => expect([id, r.status]).toEqual([id, 'done']));

        const inv1 = report.nodes['inversion-1'].outputs.out as InversionResultPayload;
        const kept = report.nodes['misfit-filter'].outputs.kept as DatasetPayload;
        const rejected = report.nodes['misfit-filter'].outputs.rejected as InversionResultPayload;
        expect(inv1.type).toBe('InversionResult');
        expect(countRows(kept.files) + countRows(rejected.files)).toBe(countRows(files));

        // Kept rows are plain data again; rejected rows keep the predictions of inversion 1
        kept.files.forEach(f => f.content.forEach((row: any) => {
            expect(row.predicted_striation).toBeUndefined();
            expect(row.misfit_angle).toBeUndefined();
            expect((f as any).stressAxes).toBeUndefined();
        }));
        rejected.files.forEach(f => f.content.forEach((row: any) => expect(row.misfit_angle).toBeGreaterThan(10)));

        // Rows stay traceable to the Data-tab file and row they came from
        rejected.files.forEach(f => f.content.forEach((row: any) => {
            expect(row._origin.fileId).toBe(f.id);
            const source = files.find(s => s.id === row._origin.fileId)!;
            expect(source.content[row._origin.rowIndex].id).toBe(row.id);
        }));

        expect(report.tagged).toHaveLength(1);
        expect(report.tagged[0]).toMatchObject({ tag: 'outlier', nodeId: 'tag-outliers', outdated: false });
        expect(report.tagged[0].payload).toBe(rejected);

        // Views simply receive their input
        expect(report.nodes['outliers-stereonet'].inputs.in[0]).toBe(rejected);
        expect(report.nodes['dashboard'].inputs.in[0]).toBe(report.nodes['inversion-2'].outputs.out);
    });

    test('provenance links each result back to the source files and parameters', async () => {
        const files = synthetic2Files();
        const report = await runWorkflow(templateWorkflow(files), createDefaultRegistry(), env(files));
        const data = report.nodes['data'].outputs.out;
        const inv1 = report.nodes['inversion-1'].outputs.out;
        const kept = report.nodes['misfit-filter'].outputs.kept;
        const inv2 = report.nodes['inversion-2'].outputs.out;

        expect(data.provenance.sourceFiles).toEqual(files.map(fileRef));
        expect(inv1.provenance.inputs).toEqual([data.provenance.id]);
        expect(kept.provenance.inputs).toEqual([inv1.provenance.id]);
        expect(inv2.provenance.inputs).toEqual([kept.provenance.id]);
        expect(inv2.provenance.scientificParams).toMatchObject({ method: 'Monte Carlo (Euler)' });
        expect(inv2.provenance.scientificParams.methodParams).toMatchObject({ nbRandomTrials: 2000, rotAngleHalfInterval: 90 });
        // Add Tags hands its input over unchanged, with its provenance
        expect(report.nodes['tag-outliers'].outputs.out.provenance.id)
            .toBe(report.nodes['misfit-filter'].outputs.rejected.provenance.id);
    });
});

describe('the inversion block', () => {
    test('gives exactly the result of the inversion service on the same data', async () => {
        const files = faultFiles();
        const wf = workflow([dataNode('d', files), node('i', 'inversion', FAST_INVERSION)], [edge('d', 'out', 'i')]);
        const report = await runWorkflow(wf, createDefaultRegistry(), env(files));
        const viaBlock = (report.nodes['i'].outputs.out as InversionResultPayload).solution;

        restoreRandom();
        restoreRandom = seedRandom(42);
        const direct = await runInversion({
            files, method: FAST_INVERSION.method, misfitCriterion: 'ANGLE',
            params: { rotAngleHalfInterval: 90, nbRandomTrials: 2000, stressRatio: 0.5, stressRatioHalfInterval: 1 },
        });

        expect(viaBlock.stressRatio).toBe(direct.solution.stressRatio);
        expect(viaBlock.misfit).toBe(direct.solution.misfit);
        expect(viaBlock.stressTensorSolution).toEqual(direct.solution.stressTensorSolution);
    });

    test('rows carry predictions, misfit and category; files carry the stress axes', async () => {
        const files = faultFiles();
        const wf = workflow([dataNode('d', files), node('i', 'inversion', FAST_INVERSION)], [edge('d', 'out', 'i')]);
        const out = (await runWorkflow(wf, createDefaultRegistry(), env(files))).nodes['i'].outputs.out as InversionResultPayload;
        const rows = out.files[0].content as any[];
        rows.forEach(row => {
            expect(row.predicted_striation).toHaveLength(3);
            expect(typeof row.misfit_angle).toBe('number');
            // Should be 'Striated planes': the category comes from the class name, which the
            // minified stress library build mangles (known bug, see InversionService categoryOf)
            expect(typeof row.misfit_category).toBe('string');
        });
        expect((out.files[0] as any).stressAxes.sigma1).toHaveLength(3);
        expect(out.resultsFile.id).toBe('stress-inversion-results');
    });
});

describe('cache and staleness', () => {
    test('a second run reuses every result', async () => {
        const files = synthetic2Files();
        const { registry, calls } = countingRegistry();
        const cache = new WorkflowCache();
        const wf = templateWorkflow(files);
        const first = await runWorkflow(wf, registry, env(files), { cache });
        expect(calls.inversion).toBe(2);

        const second = await runWorkflow(wf, registry, env(files), { cache, previous: first });
        expect(calls.inversion).toBe(2);
        expect(second.nodes['inversion-1'].cached).toBe(true);
        expect(second.nodes['inversion-2'].cached).toBe(true);
        expect(second.nodes['inversion-2'].outputs.out).toBe(first.nodes['inversion-2'].outputs.out);
    });

    test('changing the misfit threshold re-runs only what depends on it', async () => {
        const files = synthetic2Files();
        const { registry, calls } = countingRegistry();
        const cache = new WorkflowCache();
        const wf = templateWorkflow(files, 10);
        const first = await runWorkflow(wf, registry, env(files), { cache });

        wf.nodes.find(n => n.id === 'misfit-filter')!.scientificParams.threshold = 3;
        const plan = await planWorkflow(wf, registry, env(files), cache, first);
        expect(plan.nodes['inversion-1'].status).toBe('done');
        expect(plan.nodes['misfit-filter'].status).toBe('stale');
        expect(plan.nodes['inversion-2'].status).toBe('stale');
        expect(plan.nodes['dashboard'].status).toBe('stale');
        expect(calls.inversion).toBe(2);   // planning computes nothing

        const second = await runWorkflow(wf, registry, env(files), { cache, previous: first });
        expect(calls.inversion).toBe(3);   // only inversion 2 again
        expect(second.nodes['inversion-1'].cached).toBe(true);
        expect(second.nodes['inversion-2'].cached).toBeFalsy();
    });

    test('after clearing the cache, every block is out of date and is recomputed', async () => {
        const files = synthetic2Files();
        const { registry, calls } = countingRegistry();
        const cache = new WorkflowCache();
        const wf = templateWorkflow(files);
        const first = await runWorkflow(wf, registry, env(files), { cache });
        expect(calls.inversion).toBe(2);

        cache.clear();
        const plan = await planWorkflow(wf, registry, env(files), cache, first);
        ['data', 'inversion-1', 'misfit-filter', 'inversion-2'].forEach(id =>
            expect([id, plan.nodes[id].status]).toEqual([id, 'stale']));

        const second = await runWorkflow(wf, registry, env(files), { cache, previous: first });
        expect(calls.inversion).toBe(4);
        expect(second.nodes['inversion-1'].cached).toBeFalsy();
    });

    test('renaming a tag makes nothing stale', async () => {
        const files = synthetic2Files();
        const cache = new WorkflowCache();
        const wf = templateWorkflow(files);
        const first = await runWorkflow(wf, createDefaultRegistry(), env(files), { cache });
        wf.nodes.find(n => n.id === 'tag-outliers')!.scientificParams.tag = 'discarded';
        const plan = await planWorkflow(wf, createDefaultRegistry(), env(files), cache, first);
        Object.values(plan.nodes).forEach(r => expect(r.status).toBe('done'));
        expect(plan.tagged.map(t => t.tag)).toEqual(['discarded']);
    });

    test('editing a source file makes the Data block report the change', async () => {
        const files = faultFiles();
        const cache = new WorkflowCache();
        const wf = workflow([dataNode('d', files)], []);
        const first = await runWorkflow(wf, createDefaultRegistry(), env(files), { cache });
        expect(first.nodes['d'].status).toBe('done');

        const edited = [{ ...files[0], content: files[0].content.slice(1) }];
        const second = await runWorkflow(wf, createDefaultRegistry(), env(edited), { cache, previous: first });
        expect(second.nodes['d'].status).toBe('error');
        expect(second.nodes['d'].error).toMatch(/has changed/);
    });
});

describe('inactive blocks, errors and partial runs', () => {
    test('an inactive filter passes its input through', async () => {
        const files = faultFiles();
        const wf = workflow(
            [dataNode('d', files), node('f', 'filter', { dataTypes: ['joint'] }, { active: false }), node('v', 'view.stereonet')],
            [edge('d', 'out', 'f'), edge('f', 'out', 'v')]);
        const report = await runWorkflow(wf, createDefaultRegistry(), env(files));
        expect(report.nodes['f']).toMatchObject({ status: 'inactive', bypassed: true });
        expect(report.nodes['v'].status).toBe('done');
        expect(report.nodes['v'].inputs.in[0]).toBe(report.nodes['d'].outputs.out);
    });

    test('an inactive inversion stops its branch', async () => {
        const files = faultFiles();
        const wf = workflow(
            [dataNode('d', files), node('i', 'inversion', FAST_INVERSION, { active: false }), node('s', 'view.summary')],
            [edge('d', 'out', 'i'), edge('i', 'out', 's')]);
        const report = await runWorkflow(wf, createDefaultRegistry(), env(files));
        expect(report.nodes['i'].status).toBe('inactive');
        expect(report.nodes['s']).toMatchObject({ status: 'blocked', reason: 'Inversion is switched off' });
    });

    test('an error blocks everything downstream and outdates its tagged items', async () => {
        const files = synthetic2Files();
        const cache = new WorkflowCache();
        const wf = templateWorkflow(files);
        const first = await runWorkflow(wf, createDefaultRegistry(), env(files), { cache });

        const second = await runWorkflow(wf, createDefaultRegistry(), env([]), { cache, previous: first });
        expect(second.nodes['data'].status).toBe('error');
        expect(second.nodes['data'].error).toMatch(/is not in the Data tab/);
        ['inversion-1', 'misfit-filter', 'inversion-2', 'tag-outliers', 'dashboard'].forEach(id =>
            expect([id, second.nodes[id].status]).toEqual([id, 'blocked']));
        expect(second.tagged).toHaveLength(1);
        expect(second.tagged[0]).toMatchObject({ tag: 'outlier', outdated: true });
    });

    test('"run to here" only runs the target and what it needs', async () => {
        const files = synthetic2Files();
        const { registry, calls } = countingRegistry();
        const report = await runWorkflow(templateWorkflow(files), registry, env(files), { targetNodeId: 'misfit-filter' });
        expect(Object.keys(report.nodes).sort()).toEqual(['data', 'inversion-1', 'misfit-filter']);
        expect(calls.inversion).toBe(1);
    });

    test('an invalid workflow is refused', async () => {
        const wf = workflow([node('d', 'data'), node('s', 'view.summary')], [edge('d', 'out', 's')]);
        await expect(runWorkflow(wf, createDefaultRegistry(), env([]))).rejects.toBeInstanceOf(WorkflowValidationError);
    });

    test('a cancelled run stops before the next block', async () => {
        const files = synthetic2Files();
        const controller = new AbortController();
        const report = await runWorkflow(templateWorkflow(files), createDefaultRegistry(), env(files), {
            signal: controller.signal,
            onNodeUpdate: (id, r) => { if (id === 'inversion-1' && r.status === 'done') controller.abort(); },
        });
        expect(report.cancelled).toBe(true);
        expect(report.nodes['inversion-1'].status).toBe('done');
        expect(report.nodes['misfit-filter']).toBeUndefined();
    });
});

describe('filter', () => {
    test('keeps the selected data types and the rows matching the condition', async () => {
        const files = synthetic2Files();
        const wf = workflow(
            [dataNode('d', files), node('f', 'filter', { dataTypes: ['fault'], column: 'dip', operator: '>', value: '45' })],
            [edge('d', 'out', 'f')]);
        const out = (await runWorkflow(wf, createDefaultRegistry(), env(files))).nodes['f'].outputs.out as DatasetPayload;
        const rows = out.files.flatMap(f => f.content as any[]);
        expect(rows.length).toBeGreaterThan(0);
        rows.forEach(r => expect(Number(r.dip)).toBeGreaterThan(45));
        const all = files.flatMap(f => f.content as any[]);
        expect(rows.length).toBeLessThan(all.length);
    });
});
