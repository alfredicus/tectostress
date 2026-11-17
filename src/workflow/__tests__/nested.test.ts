// Groups inside groups (doc/workflow-spec.md §13.2): grouping, at any depth, must not change the
// scientific results, the provenance or the caching, and a file must keep the whole structure.

import { createDefaultRegistry } from '../blocks';
import { runWorkflow, planWorkflow, WorkflowCache } from '../executor';
import { instantiateTemplate, PREDEFINED_WORKFLOWS } from '../templates';
import {
    groupAsComposite, ungroupComposite, registryFor, expandComposites, usedComposites, compositeWithDependencies,
    makeLoop, loopOptions,
} from '../composite';
import { parseWorkflow, serializeWorkflow } from '../persistence';
import { validateWorkflow } from '../validate';
import { DatasetPayload, InversionResultPayload, Workflow, WorkflowRunReport } from '../types';
import { countRows, fileRef } from '../blocks/datasetUtils';
import { dataNode, edge, env, FAST_INVERSION, node, seedRandom, synthetic2Files, workflow } from './fixtures';

jest.setTimeout(60000);

const base = createDefaultRegistry();
let counter = 0;
const makeId = () => `n${++counter}`;

let restoreRandom: () => void;
beforeEach(() => { restoreRandom = seedRandom(11); });
afterEach(() => restoreRandom());
/** Same random sequence as at the start of the test, so two runs can be compared */
const reseed = () => { restoreRandom(); restoreRandom = seedRandom(11); };

const noErrors = (wf: Workflow) =>
    expect(validateWorkflow(wf, registryFor(wf, base)).filter(i => i.severity === 'error')).toEqual([]);

/** The first predefined workflow: Data → Inversion 1 → Misfit filter → Inversion 2 → Dashboard, + tagged outliers */
function template(files = synthetic2Files()): Workflow {
    const wf = instantiateTemplate(PREDEFINED_WORKFLOWS[0]);
    wf.nodes.forEach(n => {
        if (n.type === 'data') n.scientificParams.files = files.map(fileRef);
        if (n.type === 'inversion') Object.assign(n.scientificParams, FAST_INVERSION);
        if (n.type === 'misfit-filter') n.scientificParams.threshold = 3;
    });
    return wf;
}

/**
 * The template grouped on three levels:
 *   whole = [ data, analysis = [ inversion-1, clean = [ misfit-filter, inversion-2 ] ] ]
 */
function nested(files = synthetic2Files()) {
    const wf0 = template(files);
    const clean = groupAsComposite(wf0, base, ['misfit-filter', 'inversion-2'], 'Clean', makeId);
    const reg1 = registryFor(clean.workflow, base);
    const analysis = groupAsComposite(clean.workflow, reg1, ['inversion-1', clean.nodeId], 'Analysis', makeId);
    const reg2 = registryFor(analysis.workflow, base);
    const whole = groupAsComposite(analysis.workflow, reg2, ['data', analysis.nodeId], 'Whole', makeId);
    return {
        workflow: whole.workflow,
        whole: whole.nodeId,
        analysis: analysis.nodeId,
        clean: clean.nodeId,
        // Ids of the inner blocks in run results
        inv2: `${whole.nodeId}/${analysis.nodeId}/${clean.nodeId}/inversion-2`,
        filter: `${whole.nodeId}/${analysis.nodeId}/${clean.nodeId}/misfit-filter`,
        definitions: [whole.definition, analysis.definition, clean.definition],
    };
}

/** Inversion 2's result and the rejected data, wherever they are */
function results(r: WorkflowRunReport, inv2: string, filter: string) {
    return {
        inv2: r.nodes[inv2].outputs.out as InversionResultPayload,
        rejected: r.nodes[filter].outputs.rejected as DatasetPayload,
    };
}

describe('grouping groups', () => {
    test('groups can be grouped, on as many levels as wanted', () => {
        const n = nested();
        noErrors(n.workflow);
        // Only the outermost group is left on the canvas; every definition stays in the workflow
        expect(n.workflow.nodes.map(x => x.id).sort()).toEqual([n.whole, 'dashboard', 'outliers-stereonet', 'tag-outliers'].sort());
        expect(n.workflow.composites!.map(c => c.title).sort()).toEqual(['Analysis', 'Clean', 'Whole']);
        const [whole, analysis] = n.definitions;
        expect(whole.nodes.map(x => x.id).sort()).toEqual(['data', n.analysis].sort());
        expect(analysis.nodes.map(x => x.id).sort()).toEqual(['inversion-1', n.clean].sort());
        // The outer group exposes what the inner ones produce
        // (Inversion 2, Rejected, All (marked))
        expect(whole.outputs.map(o => o.type).sort()).toEqual(['InversionResult', 'InversionResult', 'InversionResult']);
    });

    test('the expansion goes down to ordinary blocks, with chained ids', () => {
        const n = nested();
        const { workflow: flat, inner } = expandComposites(n.workflow);
        expect(flat.nodes.map(x => x.id).sort()).toEqual([
            `${n.whole}/data`, `${n.whole}/${n.analysis}/inversion-1`, n.filter, n.inv2,
            'dashboard', 'outliers-stereonet', 'tag-outliers',
        ].sort());
        expect(Array.from(inner.keys())).toEqual([n.whole, `${n.whole}/${n.analysis}`, `${n.whole}/${n.analysis}/${n.clean}`]);
        noErrors(flat);
    });

    test('the user case: two groups of views combined into one', async () => {
        const files = synthetic2Files();
        const wf0 = workflow(
            [
                dataNode('d', files), node('i', 'inversion', FAST_INVERSION),
                node('histo', 'view.misfit-histogram'), node('mohr', 'view.mohr'),
                node('sphere', 'view.sphere'), node('stereo', 'view.stereonet'),
            ],
            ['histo', 'mohr', 'sphere', 'stereo'].map(v => edge('i', 'out', v, ['sphere', 'stereo'].includes(v) ? 'result' : 'in')).concat([edge('d', 'out', 'i')]));
        const a = groupAsComposite(wf0, base, ['histo', 'mohr'], 'Histo + Mohr', makeId);
        const b = groupAsComposite(a.workflow, registryFor(a.workflow, base), ['sphere', 'stereo'], 'Sphere + Stereo', makeId);
        const both = groupAsComposite(b.workflow, registryFor(b.workflow, base), [a.nodeId, b.nodeId], 'All views', makeId);
        noErrors(both.workflow);
        // One input (the inversion result), fed to both inner groups
        expect(both.definition.inputs).toHaveLength(1);
        expect(both.definition.inputs[0].targets).toHaveLength(2);

        const r = await runWorkflow(both.workflow, base, env(files));
        const inversion = r.nodes.i.outputs.out;
        ['histo', 'mohr'].forEach(v => expect(r.nodes[`${both.nodeId}/${a.nodeId}/${v}`].inputs.in[0]).toBe(inversion));
        ['sphere', 'stereo'].forEach(v => expect(r.nodes[`${both.nodeId}/${b.nodeId}/${v}`].inputs.result[0]).toBe(inversion));
        expect(r.nodes[`${both.nodeId}/${a.nodeId}`].status).toBe('done');
        expect(r.nodes[both.nodeId].status).toBe('done');
    });

    test('loops are not nested yet, in either direction', () => {
        const wf0 = template();
        const g = groupAsComposite(wf0, base, ['misfit-filter', 'inversion-2'], 'Clean', makeId);
        expect(() => loopOptions(g.workflow, registryFor(g.workflow, base), ['inversion-1', g.nodeId])).toThrow(/inside a loop/);

        const options = loopOptions(wf0, base, ['inversion-1', 'misfit-filter']);
        const loop = makeLoop(wf0, base, ['inversion-1', 'misfit-filter'], 'Loop', makeId,
            { carriedOutput: options.carriedOutputs.find(o => o.source.port === 'kept')!.id });
        expect(() => groupAsComposite(loop.workflow, registryFor(loop.workflow, base), [loop.nodeId, 'inversion-2'], 'x', makeId))
            .toThrow(/loop cannot go inside a group/);
    });

    test('a group containing itself (an edited file) is reported, not run forever', async () => {
        const n = nested();
        const clean = n.workflow.composites!.find(c => c.title === 'Clean')!;
        const analysis = n.workflow.composites!.find(c => c.title === 'Analysis')!;
        // Make "Clean" contain "Analysis", which contains "Clean"
        clean.nodes.push({ ...analysis.nodes[0], id: 'loopback', type: analysis.type });
        expect(() => expandComposites(n.workflow)).toThrow(/contains itself/);
    });
});

describe('running nested groups', () => {
    test('gives the same results and provenance as the blocks ungrouped', async () => {
        const files = synthetic2Files();
        const plain = await runWorkflow(template(files), base, env(files));
        reseed();
        const n = nested(files);
        const r = await runWorkflow(n.workflow, base, env(files));

        const direct = results(plain, 'inversion-2', 'misfit-filter');
        const viaGroups = results(r, n.inv2, n.filter);
        expect(viaGroups.inv2.solution.stressRatio).toBe(direct.inv2.solution.stressRatio);
        expect(viaGroups.inv2.solution.misfit).toBe(direct.inv2.solution.misfit);
        expect(viaGroups.inv2.provenance.id).toBe(direct.inv2.provenance.id);
        expect(viaGroups.rejected.provenance.id).toBe(direct.rejected.provenance.id);
        expect(countRows(viaGroups.rejected.files)).toBe(countRows(direct.rejected.files));
        // The provenance chain is the same: same inputs at every step
        expect(viaGroups.inv2.provenance.inputs).toEqual(direct.inv2.provenance.inputs);

        // Blocks outside receive what the innermost blocks produced, tags included
        expect(r.nodes.dashboard.inputs.in[0]).toBe(viaGroups.inv2);
        expect(r.tagged).toHaveLength(1);
        expect(r.tagged[0].payload.provenance.id).toBe(plain.tagged[0].payload.provenance.id);

        // Every level is reported, folded from the level below
        [n.whole, `${n.whole}/${n.analysis}`, `${n.whole}/${n.analysis}/${n.clean}`, n.inv2, n.filter]
            .forEach(id => expect(r.nodes[id].status).toBe('done'));
        expect(r.nodes[n.whole].outputs).toEqual(expect.objectContaining({}));
        expect(Object.values(r.nodes[n.whole].outputs)).toContain(viaGroups.inv2);
    });

    test('the cache is shared with the ungrouped blocks, and a deep parameter edit makes every level stale', async () => {
        const files = synthetic2Files();
        const cache = new WorkflowCache();
        await runWorkflow(template(files), base, env(files), { cache });

        // Grouping changes nothing scientific: everything comes from the cache
        const n = nested(files);
        const first = await runWorkflow(n.workflow, base, env(files), { cache });
        expect(first.nodes[n.inv2].cached).toBe(true);
        expect(first.nodes[n.whole].cached).toBe(true);

        // Edit the misfit threshold three levels down, where the engine reads it
        const whole = n.workflow.nodes.find(x => x.id === n.whole)!;
        const analysisParams = whole.scientificParams.inner[n.analysis];
        const cleanParams = analysisParams.inner[n.clean];
        cleanParams.inner['misfit-filter'] = { ...cleanParams.inner['misfit-filter'], threshold: 30 };

        const plan = await planWorkflow(n.workflow, base, env(files), cache, first);
        expect(plan.nodes[`${n.whole}/${n.analysis}/inversion-1`].status).toBe('done');
        expect(plan.nodes[n.filter].status).toBe('stale');
        expect(plan.nodes[`${n.whole}/${n.analysis}/${n.clean}`].status).toBe('stale');
        expect(plan.nodes[`${n.whole}/${n.analysis}`].status).toBe('stale');
        expect(plan.nodes[n.whole].status).toBe('stale');

        const second = await runWorkflow(n.workflow, base, env(files), { cache, previous: first });
        expect(countRows(results(second, n.inv2, n.filter).rejected.files))
            .toBeLessThan(countRows(results(first, n.inv2, n.filter).rejected.files));
    });

    test('"run to here" on a nested group runs what it needs, nothing else', async () => {
        const files = synthetic2Files();
        const n = nested(files);
        const r = await runWorkflow(n.workflow, base, env(files), { targetNodeId: n.whole });
        expect(r.nodes[n.whole].status).toBe('done');
        expect(r.nodes['tag-outliers']).toBeUndefined();
    });

    test('while a run is under way, blocks not computed yet and their groups show "waiting"', async () => {
        // The user case: an Inversion feeding a group of groups of views. While the Inversion
        // computes, the views wait; they must not look "Out of date" (nor their groups)
        const files = synthetic2Files();
        const wf0 = workflow(
            [dataNode('d', files), node('i', 'inversion', FAST_INVERSION), node('histo', 'view.misfit-histogram'), node('mohr', 'view.mohr'), node('stereo', 'view.stereonet')],
            [edge('d', 'out', 'i'), edge('i', 'out', 'histo'), edge('i', 'out', 'mohr'), edge('i', 'out', 'stereo', 'result')]);
        const inner = groupAsComposite(wf0, base, ['histo', 'mohr'], 'Inner', makeId);
        const outer = groupAsComposite(inner.workflow, registryFor(inner.workflow, base), [inner.nodeId, 'stereo'], 'Outer', makeId);
        const cache = new WorkflowCache();
        const plan = await planWorkflow(outer.workflow, base, env(files), cache);
        expect(plan.nodes[outer.nodeId].status).toBe('idle');

        const seen: Record<string, string[]> = {};
        let whileInversionRuns: Record<string, string> | undefined;
        const latest: Record<string, string> = {};
        await runWorkflow(outer.workflow, base, env(files), {
            cache, targetNodeId: outer.nodeId,
            onNodeUpdate: (id, r) => {
                (seen[id] ??= []).push(r.status);
                latest[id] = r.status;
                if (id === 'i' && r.status === 'running') whileInversionRuns = { ...latest };
            },
        });
        const histo = `${outer.nodeId}/${inner.nodeId}/histo`;
        expect(seen[histo][0]).toBe('waiting');
        expect(whileInversionRuns![histo]).toBe('waiting');
        expect(whileInversionRuns![`${outer.nodeId}/${inner.nodeId}`]).toBe('waiting');
        expect(whileInversionRuns![outer.nodeId]).toBe('waiting');
        expect(latest[outer.nodeId]).toBe('done');
        expect(latest[histo]).toBe('done');
    });

    test('an inner group switched off stops its branch inside the outer group', async () => {
        const files = synthetic2Files();
        const n = nested(files);
        const whole = n.workflow.nodes.find(x => x.id === n.whole)!;
        // The inner group node is stored, with its parameters, on the level above
        const analysisDef = n.workflow.composites!.find(c => c.title === 'Analysis')!;
        const cleanNode = analysisDef.nodes.find(x => x.id === n.clean)!;
        cleanNode.active = false;
        const r = await runWorkflow(n.workflow, base, env(files));
        expect(r.nodes[`${n.whole}/${n.analysis}/${n.clean}`].status).toBe('inactive');
        expect(r.nodes['dashboard'].status).toBe('blocked');
        expect(whole.active).toBe(true);
    });
});

describe('files and ungrouping', () => {
    test('save → load keeps the whole nested structure and gives the same results', async () => {
        const files = synthetic2Files();
        const n = nested(files);
        // An unused definition is dropped; the nested ones are kept
        const unused = { ...n.definitions[2], type: 'composite:unused-1' };
        const json = serializeWorkflow({ ...n.workflow, composites: [...n.workflow.composites!, unused] });
        const { workflow: loaded, issues } = parseWorkflow(json, base);
        expect(issues.filter(i => i.severity === 'error')).toEqual([]);
        expect(loaded.composites!.map(c => c.type).sort()).toEqual(n.workflow.composites!.map(c => c.type).sort());
        // Nodes, connections, parameters and hierarchy are identical
        expect(loaded.nodes).toEqual(JSON.parse(JSON.stringify(n.workflow.nodes)));
        expect(loaded.edges).toEqual(n.workflow.edges);
        n.workflow.composites!.forEach(c =>
            expect(loaded.composites!.find(x => x.type === c.type)).toEqual(JSON.parse(JSON.stringify(c))));
        // Saving again gives the same file
        expect(serializeWorkflow(loaded)).toBe(json);

        const before = await runWorkflow(n.workflow, base, env(files));
        reseed();
        const after = await runWorkflow(loaded, base, env(files));
        expect(results(after, n.inv2, n.filter).inv2.provenance.id).toBe(results(before, n.inv2, n.filter).inv2.provenance.id);
    });

    test('a group taken from the library brings the groups it contains', () => {
        const n = nested();
        const pool = [...n.workflow.composites!].reverse();
        const deps = compositeWithDependencies(n.definitions[0].type, pool);
        expect(deps.map(c => c.title)).toEqual(['Whole', 'Analysis', 'Clean']);
        expect(usedComposites({ nodes: [node('x', 'inversion')] }, pool)).toEqual([]);
    });

    test('ungrouping removes one level: inner groups come back as groups, with their edited parameters', async () => {
        const files = synthetic2Files();
        const n = nested(files);
        const whole = n.workflow.nodes.find(x => x.id === n.whole)!;
        whole.scientificParams.inner[n.analysis].inner[n.clean].inner['misfit-filter'].threshold = 12;

        const once = ungroupComposite(n.workflow, n.whole, makeId);
        noErrors(once);
        const analysisNode = once.nodes.find(x => x.type === n.definitions[1].type)!;
        expect(analysisNode).toBeDefined();
        expect(analysisNode.scientificParams.inner[n.clean].inner['misfit-filter'].threshold).toBe(12);
        // "Whole" is no longer used; the definitions inside it still are
        expect(once.composites!.map(c => c.title).sort()).toEqual(['Analysis', 'Clean']);

        const twice = ungroupComposite(once, analysisNode.id, makeId);
        const cleanNode = twice.nodes.find(x => x.type === n.definitions[2].type)!;
        const thrice = ungroupComposite(twice, cleanNode.id, makeId);
        expect(thrice.composites).toEqual([]);
        expect(thrice.nodes.map(x => x.type).sort()).toEqual(template().nodes.map(x => x.type).sort());
        expect(thrice.nodes.find(x => x.type === 'misfit-filter')!.scientificParams.threshold).toBe(12);
        const r = await runWorkflow(thrice, base, env(files));
        Object.values(r.nodes).forEach(x => expect(x.status).toBe('done'));
    });

    test('a definition still used deeper is kept when another copy is ungrouped', () => {
        const n = nested();
        // A second, top-level copy of "Clean" next to the one inside "Whole"
        const cleanDef = n.definitions[2];
        const copy = { ...n.workflow.nodes.find(x => x.id === n.whole)!.scientificParams.inner[n.analysis].inner[n.clean] };
        const wf: Workflow = {
            ...n.workflow,
            nodes: [...n.workflow.nodes, node('clean-copy', cleanDef.type, copy)],
        };
        const after = ungroupComposite(wf, 'clean-copy', makeId);
        expect(after.composites!.some(c => c.type === cleanDef.type)).toBe(true);
        noErrors(after);
    });
});
