// Parameters varying with the iteration inside a ForLoop (doc/workflow-spec.md §12.5)

import { createDefaultRegistry, InversionBlock } from '../blocks';
import { BlockRegistry } from '../registry';
import { runWorkflow, planWorkflow, WorkflowCache } from '../executor';
import { instantiateTemplate, PREDEFINED_WORKFLOWS } from '../templates';
import { registryFor, valueAtIteration, bodyForIteration } from '../composite';
import { parseWorkflow, serializeWorkflow } from '../persistence';
import { validateWorkflow } from '../validate';
import { BlockDefinition, DatasetPayload, Workflow, WorkflowNode } from '../types';
import { fileRef } from '../blocks/datasetUtils';
import { env, FAST_INVERSION, faultFiles, rotatedFiles, seedRandom } from './fixtures';

jest.setTimeout(120000);

const base = createDefaultRegistry();

let restoreRandom: () => void;
beforeEach(() => { restoreRandom = seedRandom(21); });
afterEach(() => restoreRandom());
const reseed = () => { restoreRandom(); restoreRandom = seedRandom(21); };

function countingRegistry() {
    const calls = { inversion: 0 };
    const inv: BlockDefinition = { ...InversionBlock, execute: async ctx => { calls.inversion++; return InversionBlock.execute!(ctx); } };
    const registry = new BlockRegistry();
    base.list().forEach(b => registry.register(b.type === 'inversion' ? inv : b));
    return { registry, calls };
}

const twoPhases = () => [...faultFiles(), ...rotatedFiles(faultFiles())];

/**
 * The predefined phase separation: in each iteration, Inversion → Misfit filter (kept → Phase
 * solution, tagged; rejected → next iteration and ExitLoop). Fast inversions; the ExitLoop never
 * stops it, so it runs `maxIterations` times unless no data are left.
 */
function phaseWorkflow(maxIterations = 3, files = twoPhases()): { wf: Workflow; loop: WorkflowNode } {
    const wf = instantiateTemplate(PREDEFINED_WORKFLOWS.find(t => t.id === 'phase-separation')!);
    wf.nodes.find(n => n.type === 'data')!.scientificParams.files = files.map(fileRef);
    const loop = wf.nodes.find(n => n.type.includes('loop'))!;
    const inner = loop.scientificParams.inner;
    Object.keys(inner).forEach(id => { if (id.includes('inversion')) Object.assign(inner[id], FAST_INVERSION); });
    inner.exit = { ...inner.exit, value: 0 };
    loop.scientificParams.maxIterations = maxIterations;
    return { wf, loop };
}

const issuesOf = (wf: Workflow) => validateWorkflow(wf, registryFor(wf, base));
const errorsOf = (wf: Workflow) => issuesOf(wf).filter(i => i.severity === 'error').map(i => i.message);

describe('values by iteration', () => {
    test('iteration numbering starts at 1; past the end of the list, the last value is reused', () => {
        const list = [20, 15, 12, 10];
        expect([1, 2, 3, 4, 5, 6].map(i => valueAtIteration(list, i))).toEqual([20, 15, 12, 10, 10, 10]);
        expect(valueAtIteration([7], 9)).toBe(7);
    });

    test('each iteration runs ordinary blocks with plain values', () => {
        const body: Workflow = {
            schemaVersion: 1, name: 'body', edges: [],
            nodes: [{ id: 'm', type: 'misfit-filter', typeVersion: 1, active: true, scientificParams: { threshold: 30, unpredicted: 'kept' }, presentationParams: {}, position: { x: 0, y: 0 } }],
        };
        const { workflow, used } = bodyForIteration(body, { m: { threshold: [20, 15] } }, 2);
        expect(workflow.nodes[0].scientificParams).toEqual({ threshold: 15, unpredicted: 'kept' });
        expect(used).toEqual([{ node: 'm', key: 'threshold', value: 15 }]);
        // No varying parameter: the body is used as it is
        expect(bodyForIteration(body, {}, 2).workflow).toBe(body);
    });
});

describe('checks', () => {
    test('constant by default: a loop without lists is valid and behaves as before', () => {
        const { wf } = phaseWorkflow();
        expect(errorsOf(wf)).toEqual([]);
    });

    test('lists must be non-empty numbers in range, for parameters declared eligible', () => {
        const set = (per: any) => { const { wf, loop } = phaseWorkflow(); loop.scientificParams.perIteration = per; return errorsOf(wf); };
        expect(set({ 'misfit-filter': { threshold: [] } })).toEqual([expect.stringMatching(/has no value/)]);
        expect(set({ 'misfit-filter': { threshold: [20, 'x'] } })).toEqual([expect.stringMatching(/must be a number/)]);
        expect(set({ 'misfit-filter': { threshold: [20, 200] } })).toEqual([expect.stringMatching(/between 0 and 180/)]);
        // Choices and computational settings stay constant
        expect(set({ 'misfit-filter': { unpredicted: [1] } })).toEqual([expect.stringMatching(/cannot vary/)]);
        expect(set({ inversion: { methodParams: [1] } })).toEqual([expect.stringMatching(/cannot vary/)]);
        expect(set({ nowhere: { threshold: [1] } })).toEqual([expect.stringMatching(/no block/)]);
        // ExitLoop's value is eligible too
        expect(set({ exit: { value: [0, 4] } })).toEqual([]);
    });

    test('values beyond the maximum number of iterations are allowed, with a warning that they are unused', () => {
        const { wf, loop } = phaseWorkflow(3);
        loop.scientificParams.perIteration = { 'misfit-filter': { threshold: [20, 15, 12, 10, 8] } };
        expect(errorsOf(wf)).toEqual([]);
        expect(issuesOf(wf).filter(i => i.severity === 'warning').map(i => i.message))
            .toContainEqual(expect.stringMatching(/5 values for at most 3 iterations; the last 2 are never used/));
    });

    test('only loops can hold such lists', () => {
        const wf = instantiateTemplate(PREDEFINED_WORKFLOWS[0]);
        wf.nodes.find(n => n.type === 'misfit-filter')!.scientificParams.perIteration = { x: { threshold: [1] } };
        expect(errorsOf(wf)).toEqual([expect.stringMatching(/only blocks inside a ForLoop/)]);
    });
});

describe('running', () => {
    test('each iteration uses its own value, shown in the iteration table and recorded in the provenance', async () => {
        const files = twoPhases();
        const { wf, loop } = phaseWorkflow(4, files);
        loop.scientificParams.perIteration = { 'misfit-filter': { threshold: [60, 40, 20] } };
        const r = await runWorkflow(wf, base, env(files));
        const summary = r.nodes[loop.id].loop!;
        const used = summary.iterations.map(it => it.params?.find(p => p.key === 'threshold')?.value);
        // 60, 40, 20, then the last value again
        expect(used).toEqual([60, 40, 20, 20].slice(0, summary.iterations.length));
        expect(summary.iterations.length).toBeGreaterThanOrEqual(3);
        summary.iterations.forEach(it => expect(it.params).toEqual([expect.objectContaining({ node: 'misfit-filter', key: 'threshold' })]));

        // The inner blocks shown are those of the last iteration, with the value it used
        const last = r.nodes[`${loop.id}/misfit-filter`].outputs.kept as DatasetPayload;
        expect(last.provenance.scientificParams.threshold).toBe(used[used.length - 1]);

        // Each phase tagged carries the values of its iteration, for the report
        r.tagged.forEach(t => expect(t.iterationParams).toEqual([
            expect.objectContaining({ key: 'threshold', value: used[t.iteration! - 1], blockName: expect.any(String) }),
        ]));
    });

    test('a constant parameter gives the same results as before', async () => {
        const files = twoPhases();
        const plain = phaseWorkflow(3, files);
        const before = await runWorkflow(plain.wf, base, env(files));
        reseed();
        // The same value at every iteration, written as a one-value list
        const varying = phaseWorkflow(3, files);
        varying.loop.scientificParams.perIteration = { 'misfit-filter': { threshold: [varying.loop.scientificParams.inner['misfit-filter'].threshold] } };
        const after = await runWorkflow(varying.wf, base, env(files));
        const strip = (its: any[]) => its.map(({ params, ...rest }) => rest);
        expect(strip(after.nodes[varying.loop.id].loop!.iterations)).toEqual(strip(before.nodes[plain.loop.id].loop!.iterations));
        expect(after.tagged.map(t => t.payload.provenance.id)).toEqual(before.tagged.map(t => t.payload.provenance.id));
    });

    test('changing only a later value recomputes from that iteration on: earlier ones come from the cache', async () => {
        const files = twoPhases();
        const { registry, calls } = countingRegistry();
        const cache = new WorkflowCache();
        const { wf, loop } = phaseWorkflow(3, files);
        loop.scientificParams.perIteration = { 'misfit-filter': { threshold: [60, 40, 20] } };
        const first = await runWorkflow(wf, registry, env(files), { cache });
        expect(first.nodes[loop.id].loop!.iterations).toHaveLength(3);
        const firstCalls = calls.inversion;
        expect(firstCalls).toBe(6); // two inversions per iteration

        // Editing the list makes the loop out of date
        loop.scientificParams.perIteration = { 'misfit-filter': { threshold: [60, 40, 5] } };
        const plan = await planWorkflow(wf, registry, env(files), cache, first);
        expect(plan.nodes[loop.id].status).toBe('stale');

        calls.inversion = 0;
        const second = await runWorkflow(wf, registry, env(files), { cache, previous: first });
        // Iterations 1–2 and the first inversion of iteration 3 (same input) come from the cache;
        // only the phase solution of iteration 3, whose data changed, is computed again
        expect(calls.inversion).toBe(1);
        const its = second.nodes[loop.id].loop!.iterations;
        expect(its.slice(0, 2)).toEqual(first.nodes[loop.id].loop!.iterations.slice(0, 2));
        expect(its[2].params).toEqual([expect.objectContaining({ node: 'misfit-filter', key: 'threshold', value: 5, label: 'Maximum misfit', unit: '°' })]);
    });
});

describe('files', () => {
    test('save → load keeps the lists, and gives the same results', async () => {
        const files = twoPhases();
        const { wf, loop } = phaseWorkflow(3, files);
        loop.scientificParams.perIteration = { 'misfit-filter': { threshold: [60, 40, 20] }, exit: { value: [0, 0, 2] } };
        const json = serializeWorkflow(wf);
        const { workflow: loaded, issues } = parseWorkflow(json, base);
        expect(issues.filter(i => i.severity === 'error')).toEqual([]);
        expect(loaded.nodes.find(n => n.id === loop.id)!.scientificParams.perIteration).toEqual(loop.scientificParams.perIteration);
        expect(serializeWorkflow(loaded)).toBe(json);

        const before = await runWorkflow(wf, base, env(files));
        reseed();
        const after = await runWorkflow(loaded, base, env(files));
        expect(after.nodes[loop.id].loop).toEqual(before.nodes[loop.id].loop);
        expect(after.tagged.map(t => t.payload.provenance.id)).toEqual(before.tagged.map(t => t.payload.provenance.id));
    });

    test('older files, without lists, load and run unchanged', () => {
        const { wf, loop } = phaseWorkflow();
        delete loop.scientificParams.perIteration;
        const { workflow: loaded, issues } = parseWorkflow(serializeWorkflow(wf), base);
        expect(issues.filter(i => i.severity === 'error')).toEqual([]);
        expect(loaded.nodes.find(n => n.id === loop.id)!.scientificParams.perIteration).toBeUndefined();
    });
});
