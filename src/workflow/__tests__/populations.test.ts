// Kept and rejected populations after a Misfit filter (doc/workflow-spec.md §14.4)

import { createDefaultRegistry } from '../blocks';
import { runWorkflow } from '../executor';
import { instantiateTemplate, PREDEFINED_WORKFLOWS } from '../templates';
import { InversionResultPayload, Workflow } from '../types';
import { countRows, fileRef } from '../blocks/datasetUtils';
import { classification, inversionData, selectPopulation } from '../populations';
import { env, FAST_INVERSION, seedRandom, synthetic2Files } from './fixtures';

jest.setTimeout(60000);

let restoreRandom: () => void;
beforeEach(() => { restoreRandom = seedRandom(5); });
afterEach(() => restoreRandom());

function template(files = synthetic2Files()): Workflow {
    const wf = instantiateTemplate(PREDEFINED_WORKFLOWS[0]);
    wf.nodes.forEach(n => {
        if (n.type === 'data') n.scientificParams.files = files.map(fileRef);
        if (n.type === 'inversion') Object.assign(n.scientificParams, FAST_INVERSION);
        if (n.type === 'misfit-filter') n.scientificParams.threshold = 10;
    });
    return wf;
}

test('views of kept, rejected or all data use exactly their own inversion data, each with its population', async () => {
    const files = synthetic2Files();
    const r = await runWorkflow(template(files), createDefaultRegistry(), env(files));
    const inv = r.nodes['inversion-1'].outputs.out as InversionResultPayload;
    const out = (p: string) => r.nodes['misfit-filter'].outputs[p] as InversionResultPayload;

    const kept = inversionData(out('kept'));
    const rejected = inversionData(out('rejected'));
    const all = inversionData(out('all'));
    // Before §14.4 the Mohr view drew every datum of the inversion whatever subset it received
    expect(kept.length).toBe(countRows(out('kept').files));
    expect(rejected.length).toBe(countRows(out('rejected').files));
    expect(all.length).toBe(kept.length + rejected.length);
    expect(all.length).toBe(inv.run.data.length);
    expect(kept.every(e => e.population === 'kept')).toBe(true);
    expect(rejected.every(e => e.population === 'rejected')).toBe(true);
    // Distinct data: no datum is both kept and rejected
    const keptSet = new Set(kept.map(e => e.datum));
    expect(rejected.some(e => keptSet.has(e.datum))).toBe(false);

    // Show: kept / rejected / both
    const c = classification(out('all'));
    expect(c).toMatchObject({ classified: true, threshold: 10, counts: { kept: kept.length, rejected: rejected.length } });
    expect(countRows(selectPopulation(out('all'), 'kept').files)).toBe(kept.length);
    expect(countRows(selectPopulation(out('all'), 'rejected').files)).toBe(rejected.length);
    expect(selectPopulation(out('all'), 'both')).toBe(out('all'));
    // Unclassified data are left alone
    expect(classification(inv).classified).toBe(false);
    expect(selectPopulation(inv, 'kept')).toBe(inv);
    expect(inversionData(inv)).toHaveLength(inv.run.data.length);
});
