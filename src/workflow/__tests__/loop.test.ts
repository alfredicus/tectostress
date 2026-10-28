import { createDefaultRegistry, InversionBlock } from '../blocks';
import { BlockRegistry } from '../registry';
import { runWorkflow, planWorkflow, WorkflowCache } from '../executor';
import { instantiateTemplate, PREDEFINED_WORKFLOWS } from '../templates';
import { loopOptions, makeLoop, registryFor, LOOP_COLLECTED } from '../composite';
import { parseWorkflow, serializeWorkflow } from '../persistence';
import { validateWorkflow } from '../validate';
import { BlockDefinition, DatasetPayload, InversionResultPayload, ReportPayload, Workflow } from '../types';
import { countRows, fileRef } from '../blocks/datasetUtils';
import { dataNode, edge, env, FAST_INVERSION, faultFiles, node, rotatedFiles, seedRandom, workflow } from './fixtures';

jest.setTimeout(120000);

const base = createDefaultRegistry();
let k = 0;
const makeId = () => `l${++k}`;

let restoreRandom: () => void;
beforeEach(() => { restoreRandom = seedRandom(21); });
afterEach(() => restoreRandom());

function countingRegistry() {
    const calls = { inversion: 0 };
    const inv: BlockDefinition = { ...InversionBlock, execute: async ctx => { calls.inversion++; return InversionBlock.execute!(ctx); } };
    const registry = new BlockRegistry();
    base.list().forEach(b => registry.register(b.type === 'inversion' ? inv : b));
    return { registry, calls };
}

/** Two "tectonic phases": the synthetic faults, and the same faults rotated by 90° */
const twoPhases = () => [...faultFiles(), ...rotatedFiles(faultFiles())];

/** The predefined phase-separation workflow on the given files, with fast inversions */
function phaseWorkflow(files = twoPhases()): Workflow {
    const wf = instantiateTemplate(PREDEFINED_WORKFLOWS.find(t => t.id === 'phase-separation')!);
    wf.nodes.find(n => n.type === 'data')!.scientificParams.files = files.map(fileRef);
    const loop = wf.nodes.find(n => n.type.includes('loop'))!;
    Object.values<any>(loop.scientificParams.inner).forEach((p, i) => {
        const id = Object.keys(loop.scientificParams.inner)[i];
        if (id.includes('inversion')) Object.assign(p, FAST_INVERSION);
    });
    return wf;
}
const loopId = (wf: Workflow) => wf.nodes.find(n => n.type.includes('loop'))!.id;

describe('Conditional', () => {
    function branches(threshold: number) {
        const files = faultFiles();
        return {
            files,
            wf: workflow(
                [
                    dataNode('d', files),
                    node('i', 'inversion', FAST_INVERSION),
                    node('c', 'conditional', { metric: 'misfit', operator: '≤', value: threshold }),
                    node('good', 'filter'),
                    node('bad', 'filter'),
                    node('merge', 'aggregate'),
                    node('v', 'view.summary'),
                ],
                [edge('d', 'out', 'i'), edge('i', 'out', 'c'), edge('c', 'then', 'good'), edge('c', 'else', 'bad'),
                 edge('good', 'out', 'merge'), edge('bad', 'out', 'merge'), edge('c', 'else', 'v')]),
        };
    }

    test('sends the value to one branch; the other is skipped, and merging uses the branch taken', async () => {
        const { files, wf } = branches(90);
        const r = await runWorkflow(wf, base, env(files));
        expect(r.nodes['c'].skippedPorts).toEqual(['else']);
        expect(r.nodes['good'].status).toBe('done');
        expect(r.nodes['bad']).toMatchObject({ status: 'skipped', reason: 'On a branch not taken' });
        expect(r.nodes['v'].status).toBe('skipped');
        expect(r.nodes['merge'].status).toBe('done');
        expect(countRows((r.nodes['merge'].outputs.out as DatasetPayload).files)).toBe(countRows(files));
    });

    test('the other branch when the condition does not hold, without recomputing the inversion', async () => {
        const { registry, calls } = countingRegistry();
        const cache = new WorkflowCache();
        const { files, wf } = branches(90);
        const first = await runWorkflow(wf, registry, env(files), { cache });
        wf.nodes.find(n => n.id === 'c')!.scientificParams.value = 0;
        const plan = await planWorkflow(wf, registry, env(files), cache, first);
        expect(plan.nodes['good'].status).toBe('skipped');
        expect(plan.nodes['v'].status).toBe('done');
        const second = await runWorkflow(wf, registry, env(files), { cache, previous: first });
        expect(second.nodes['bad'].status).toBe('done');
        expect(calls.inversion).toBe(1);
    });
});

describe('ForLoop', () => {
    test('separating phases: iterates on the rejected data and collects every phase', async () => {
        const files = twoPhases();
        const wf = phaseWorkflow(files);
        const id = loopId(wf);
        const r = await runWorkflow(wf, base, env(files));

        const loop = r.nodes[id];
        expect(loop.status).toBe('done');
        const its = loop.loop!.iterations;
        expect(its.length).toBeGreaterThanOrEqual(2);
        expect(['exit', 'empty', 'max']).toContain(loop.loop!.stoppedBy);
        // Each iteration starts from what the previous one rejected
        its.slice(1).forEach((it, i) => expect(it.rowsIn).toBe(its[i].rowsOut));
        expect(its[0].rowsIn).toBe(countRows(files));

        // Collected: every phase's data, each row with its iteration (phase) number
        const collected = loop.outputs[LOOP_COLLECTED] as DatasetPayload;
        const rows = collected.files.flatMap(f => f.content as any[]);
        expect(rows.length).toBe(its.reduce((n, it) => n + (it.rowsIn - (it.rowsOut ?? 0)), 0));
        rows.forEach(row => expect(row.iteration).toBeGreaterThanOrEqual(1));
        expect(new Set(rows.map(r => r._origin.fileId + r._origin.rowIndex)).size).toBe(rows.length);

        // One tagged phase per iteration, and the report has them all with their lineage
        expect(r.tagged.map(t => t.iteration)).toEqual(its.map(it => it.iteration));
        const doc = (r.nodes['report'].outputs.report as ReportPayload).document;
        expect(doc.items.map(i => i.iteration)).toEqual(its.map(it => it.iteration));
        const second = doc.items[1];
        expect(second.lineage[0].blockType).toBe('data');
        // Phase 2 comes from iteration 1's rejected data: two inversions and a misfit filter before it
        expect(second.lineage.map(p => p.blockType)).toEqual(
            ['data', 'inversion', 'misfit-filter', 'inversion', 'misfit-filter', 'inversion']);
    });

    test('cached iterations are reused; changing the maximum makes the loop stale', async () => {
        const { registry, calls } = countingRegistry();
        const cache = new WorkflowCache();
        const files = twoPhases();
        const wf = phaseWorkflow(files);
        const first = await runWorkflow(wf, registry, env(files), { cache });
        const n = calls.inversion;
        expect(n).toBeGreaterThanOrEqual(4);

        const plan = await planWorkflow(wf, registry, env(files), cache, first);
        expect(plan.nodes[loopId(wf)].status).toBe('done');
        const again = await runWorkflow(wf, registry, env(files), { cache, previous: first });
        expect(calls.inversion).toBe(n);
        expect(again.nodes[loopId(wf)].loop!.iterations).toHaveLength(first.nodes[loopId(wf)].loop!.iterations.length);

        wf.nodes.find(x => x.id === loopId(wf))!.scientificParams.maxIterations = 1;
        const plan2 = await planWorkflow(wf, registry, env(files), cache, again);
        expect(plan2.nodes[loopId(wf)].status).toBe('done');   // iteration 1 is cached
        const one = await runWorkflow(wf, registry, env(files), { cache, previous: again });
        expect(one.nodes[loopId(wf)].loop).toMatchObject({ stoppedBy: 'max' });
        expect(one.nodes[loopId(wf)].loop!.iterations).toHaveLength(1);
        expect(calls.inversion).toBe(n);
    });

    test('ExitLoop on the change since the previous iteration', async () => {
        // Iterative cleaning: invert, drop badly fitted data, until the stress ratio stops moving
        const files = faultFiles();
        const flat = workflow(
            [
                dataNode('d', files),
                node('i', 'inversion', FAST_INVERSION),
                node('m', 'misfit-filter', { threshold: 60 }),
                node('x', 'exit-loop', { metric: 'deltaStressRatio', operator: '<', value: 1 }),
            ],
            [edge('d', 'out', 'i'), edge('i', 'out', 'm'), edge('i', 'out', 'x')]);
        const options = loopOptions(flat, base, ['i', 'm', 'x']);
        expect(options.carriedInput.type).toBe('Dataset');
        const kept = options.carriedOutputs.find(o => o.source.port === 'kept')!;
        const { workflow: wf, nodeId } = makeLoop(flat, base, ['i', 'm', 'x'], 'Clean', makeId,
            { carriedOutput: kept.id, maxIterations: 5 });
        expect(validateWorkflow(wf, registryFor(wf, base)).filter(i => i.severity === 'error')).toEqual([]);

        const r = await runWorkflow(wf, base, env(files));
        // Not available on iteration 1, so the loop goes on; any change is < 1 on iteration 2
        expect(r.nodes[nodeId].loop).toMatchObject({ stoppedBy: 'exit' });
        expect(r.nodes[nodeId].loop!.iterations).toHaveLength(2);
    });

    test('is saved and loaded with its definition, and stops its branch when switched off', async () => {
        const files = twoPhases();
        const wf = phaseWorkflow(files);
        const { workflow: loaded, issues } = parseWorkflow(serializeWorkflow(wf), base);
        expect(issues.filter(i => i.severity === 'error')).toEqual([]);
        expect(loaded.composites![0].loop).toEqual(wf.composites![0].loop);

        loaded.nodes.find(n => n.id === loopId(loaded))!.active = false;
        const r = await runWorkflow(loaded, base, env(files));
        expect(r.nodes[loopId(loaded)].status).toBe('inactive');
        expect(r.nodes['all-phases'].status).toBe('blocked');
    });
});
