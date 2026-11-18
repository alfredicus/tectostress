// Inversion: fit only the best x % of the data (SearchMethod.setMisfitKeepPercent of the stress library)

import * as stressLib from '@alfredo-taboada/stress';
import { createDefaultRegistry } from '../blocks';
import { InversionBlock } from '../blocks/inversionBlock';
import { runWorkflow } from '../executor';
import { InversionResultPayload } from '../types';
import { dataNode, edge, env, FAST_INVERSION, node, seedRandom, synthetic2Files, workflow } from './fixtures';

jest.setTimeout(60000);
const registry = createDefaultRegistry();
const wf = (keep: number) => {
    const files = synthetic2Files();
    return { files, wf: workflow([dataNode('d', files), node('i', 'inversion', { ...FAST_INVERSION, misfitKeepPercent: keep })], [edge('d', 'out', 'i')]) };
};

test('100 % is the plain mean: left out of the parameters, so earlier results keep their cache key', () => {
    const p = InversionBlock.normalizeParams!({ ...FAST_INVERSION, misfitKeepPercent: 100 });
    expect('misfitKeepPercent' in p).toBe(false);
    expect(InversionBlock.normalizeParams!({ ...FAST_INVERSION, misfitKeepPercent: 60 }).misfitKeepPercent).toBe(60);
});

test('below 100 %, a library without the setter is refused, never ignored', async () => {
    const { files, wf: w } = wf(60);
    const setter = (stressLib as any).SearchMethod?.prototype?.setMisfitKeepPercent;
    const r = await runWorkflow(w, registry, env(files));
    if (typeof setter === 'function') {
        expect(r.nodes.i.status).toBe('done');      // a newer library: nothing to refuse
    } else {
        expect(r.nodes.i.status).toBe('error');
        expect(r.nodes.i.error).toMatch(/best 60 % of the data needs a newer stress library/);
    }
});

test('with a library that has it, the share reaches the search and is recorded in the result', async () => {
    const received: number[] = [];
    const create = stressLib.SearchMethodFactory.create;
    const spy = jest.spyOn(stressLib.SearchMethodFactory, 'create').mockImplementation((name: string, params: any) => {
        const method: any = create.call(stressLib.SearchMethodFactory, name, params);
        if (method && typeof method.setMisfitKeepPercent !== 'function') method.setMisfitKeepPercent = (p: number) => received.push(p);
        else if (method) { const real = method.setMisfitKeepPercent.bind(method); method.setMisfitKeepPercent = (p: number) => { received.push(p); real(p); }; }
        return method;
    });
    const restore = seedRandom(2);
    try {
        const { files, wf: w } = wf(60);
        const r = await runWorkflow(w, registry, env(files));
        expect(r.nodes.i.status).toBe('done');
        expect(received).toEqual([60]);
        const out = r.nodes.i.outputs.out as InversionResultPayload;
        expect(out.solution.misfitKeepPercent).toBe(60);
        expect(out.resultsFile.content).toContainEqual({ parameter: 'misfit_over_best_percent', value: 60, unit: '%' });
        expect(r.nodes.i.logs.map(l => l.message)).toContain('Misfit minimised over the best 60 % of the data (the others are ignored by the search)');
    } finally { spy.mockRestore(); restore(); }
});
