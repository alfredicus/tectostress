// Kinds of data and what each block accepts (doc/workflow-spec.md §16)

import { createDefaultRegistry } from '../blocks';
import { canConnect, validateWorkflow } from '../validate';
import { acceptedTypes, describeAccepted, inputColors, DATA_TYPES } from '../dataTypes';
import { parseWorkflow, serializeWorkflow } from '../persistence';
import { groupAsComposite, registryFor } from '../composite';
import { upgradeLibrary } from '../upgradeInputs';
import { runWorkflow } from '../executor';
import { CompositeDefinition, PayloadType } from '../types';
import { dataNode, edge, env, FAST_INVERSION, faultFiles, node, seedRandom, workflow } from './fixtures';

jest.setTimeout(60000);

const registry = createDefaultRegistry();
const M: PayloadType = 'Dataset';
const R: PayloadType = 'InversionResult';

/** The table of §16.3: block → input → kinds accepted */
const TABLE: Record<string, Record<string, PayloadType[]>> = {
    'filter': { in: [M, R] },
    'resample': { in: [M, R] },
    'aggregate': { in: [M, R] },
    'inversion': { in: [M, R] },
    'misfit-filter': { in: [R] },
    'view.stereonet': { data: [M], result: [R] },
    'view.sphere': { data: [M], result: [R] },
    'view.rose': { in: [M, R] },
    'view.histogram': { in: [M, R] },
    'view.misfit-histogram': { in: [R] },
    'view.mohr': { in: [R] },
    'view.summary': { in: [R] },
    'view.landscape': { in: [R] },
    'view.mcmc-stats': { in: [R] },
    'view.dashboard': { in: [M, R] },
};

describe('compatibility table (§16.3)', () => {
    test.each(Object.entries(TABLE))('%s', (type, ports) => {
        const def = registry.get(type)!;
        expect(def.inputs.map(p => p.id).sort()).toEqual(Object.keys(ports).sort());
        def.inputs.forEach(p => expect(acceptedTypes(p)).toEqual(ports[p.id]));
    });

    test('every connection the table allows is accepted, every other one refused with a reason', () => {
        // A source of each kind: Data (measured), Inversion (result)
        Object.entries(TABLE).forEach(([type, ports]) => Object.entries(ports).forEach(([port, accepted]) => {
            const wf = workflow([node('d', 'data'), node('i', 'inversion'), node('t', type)], [edge('d', 'out', 'i')]);
            ([['d', M], ['i', R]] as const).forEach(([source, kind]) => {
                const r = canConnect(wf, registry, { source, sourcePort: 'out', target: 't', targetPort: port });
                expect([type, port, kind, r.ok]).toEqual([type, port, kind, accepted.includes(kind)]);
                if (!r.ok) expect(r.reason).toBeTruthy();
            });
        }));
    });

    test('ports are drawn with the colours of what they accept', () => {
        const stereo = registry.get('view.stereonet')!.inputs;
        expect(stereo.map(inputColors)).toEqual([[DATA_TYPES.Dataset.color], [DATA_TYPES.InversionResult.color]]);
        expect(inputColors(registry.get('inversion')!.inputs[0])).toEqual([DATA_TYPES.Dataset.color, DATA_TYPES.InversionResult.color]);
        expect(inputColors(registry.get('view.mohr')!.inputs[0])).toEqual([DATA_TYPES.InversionResult.color]);
        expect(describeAccepted(registry.get('view.mohr')!.inputs[0])).toBe('inversion results only');
        expect(describeAccepted(registry.get('inversion')!.inputs[0])).toBe('measured data or inversion results');
    });
});

describe('refusals are explained', () => {
    const wf = () => workflow([node('d', 'data'), node('i', 'inversion'), node('m', 'view.mohr'), node('s', 'view.stereonet')], [edge('d', 'out', 'i')]);

    test('measured data into a view needing a stress solution', () => {
        expect(canConnect(wf(), registry, { source: 'd', sourcePort: 'out', target: 'm', targetPort: 'in' }).reason)
            .toBe('Mohr diagram needs an inversion result. Measured data have no stress solution yet: connect an Inversion first.');
    });

    test('the wrong one of two inputs points to the right one', () => {
        expect(canConnect(wf(), registry, { source: 'i', sourcePort: 'out', target: 's', targetPort: 'data' }).reason)
            .toBe('This input of Stereonet takes measured data only: connect the inversion results to its “Inversion result” input.');
        expect(canConnect(wf(), registry, { source: 'd', sourcePort: 'out', target: 's', targetPort: 'result' }).reason)
            .toBe('This input of Stereonet takes inversion results only: connect the measured data to its “Measured data” input.');
    });
});

describe('Stereonet and Sphere: one input of the two', () => {
    test('none connected is reported; both connected is an error', () => {
        const none = workflow([node('s', 'view.sphere')], []);
        expect(validateWorkflow(none, registry).map(i => [i.severity, i.message]))
            .toEqual([['warning', 'view.sphere (s): connect “Measured data” or “Inversion result”']]);
        const both = workflow([node('d', 'data'), node('i', 'inversion'), node('s', 'view.sphere')],
            [edge('d', 'out', 'i'), edge('d', 'out', 's', 'data'), edge('i', 'out', 's', 'result')]);
        expect(validateWorkflow(both, registry).filter(i => i.severity === 'error').map(i => i.message))
            .toEqual(['view.sphere (s): connect “Measured data” or “Inversion result”, not both']);
    });

    test('grouping a view keeps only the input it uses', () => {
        const wf = workflow([node('i', 'inversion', FAST_INVERSION), node('s', 'view.stereonet')], [edge('i', 'out', 's', 'result')]);
        const { definition } = groupAsComposite(wf, registry, ['i', 's'], 'G', () => 'g');
        expect(definition.inputs.map(i => [i.type, i.exact])).toEqual([['Dataset', undefined]]);
    });

    test('a group input feeding a measured-data input refuses inversion results', () => {
        const wf = workflow([node('d', 'data'), node('s', 'view.stereonet'), node('r', 'view.rose')],
            [edge('d', 'out', 's', 'data'), edge('d', 'out', 'r')]);
        const { definition } = groupAsComposite(wf, registry, ['s', 'r'], 'G', () => 'g');
        expect(definition.inputs.map(i => [i.type, i.exact])).toEqual([['Dataset', true]]);
    });
});

describe('a dashboard fed measured data', () => {
    test('warns about the views needing an inversion result', () => {
        const wf = workflow([node('d', 'data'), node('b', 'view.dashboard')], [edge('d', 'out', 'b')]);
        wf.nodes[1].presentationParams = { views: ['view.stereonet', 'view.mohr', 'view.summary'] };
        expect(validateWorkflow(wf, registry).map(i => i.message))
            .toEqual(['view.dashboard (b) receives measured data: Mohr diagram, Summary need an inversion result and will show nothing for them']);
    });
});

describe('older files (one input taking both)', () => {
    const oldFile = () => JSON.stringify({
        schemaVersion: 1, name: 'old',
        nodes: [
            { id: 'd', type: 'data', typeVersion: 1, scientificParams: {}, presentationParams: {} },
            { id: 'i', type: 'inversion', typeVersion: 1, scientificParams: {}, presentationParams: {} },
            { id: 's1', type: 'view.stereonet', typeVersion: 1, scientificParams: {}, presentationParams: {} },
            { id: 's2', type: 'view.sphere', typeVersion: 1, scientificParams: {}, presentationParams: {} },
            { id: 't', type: 'add-tags', typeVersion: 1, scientificParams: {}, presentationParams: {} },
            { id: 's3', type: 'view.stereonet', typeVersion: 1, scientificParams: {}, presentationParams: {} },
        ],
        edges: [
            { id: 'a', source: 'd', sourcePort: 'out', target: 'i', targetPort: 'in' },
            { id: 'b', source: 'd', sourcePort: 'out', target: 's1', targetPort: 'in' },
            { id: 'c', source: 'i', sourcePort: 'out', target: 's2', targetPort: 'in' },
            { id: 'e', source: 'i', sourcePort: 'out', target: 't', targetPort: 'in' },
            { id: 'f', source: 't', sourcePort: 'out', target: 's3', targetPort: 'in' },
        ],
    });

    test('each connection goes to the input for what it carries', () => {
        const { workflow: wf, issues } = parseWorkflow(oldFile(), registry);
        expect(issues.filter(i => i.severity === 'error')).toEqual([]);
        expect(wf.edges.map(e => [e.id, e.targetPort])).toEqual([['a', 'in'], ['b', 'data'], ['c', 'result'], ['e', 'in'], ['f', 'result']]);
        expect(wf.nodes.filter(n => n.type.startsWith('view')).map(n => n.typeVersion)).toEqual([2, 2, 2]);
        // and saved again, it stays the same
        expect(serializeWorkflow(parseWorkflow(serializeWorkflow(wf), registry).workflow)).toBe(serializeWorkflow(wf));
    });

    test('a group whose input fed a Sphere directly gets one input per kind, and runs the same', async () => {
        // As saved in the library before: one input "Sphere" (Dataset) feeding sphere.in
        const old: CompositeDefinition = {
            type: 'composite:my-block-x', version: 1, title: 'My block',
            nodes: [
                { id: 'sp', type: 'view.sphere', typeVersion: 1, active: true, scientificParams: {}, presentationParams: {}, position: { x: 0, y: 0 } },
                { id: 'ro', type: 'view.rose', typeVersion: 1, active: true, scientificParams: {}, presentationParams: {}, position: { x: 0, y: 0 } },
            ],
            edges: [],
            inputs: [{ id: 'in1', label: 'Sphere', type: 'Dataset', targets: [{ node: 'sp', port: 'in' }, { node: 'ro', port: 'in' }] }],
            outputs: [],
        };
        const [upgraded] = upgradeLibrary([old], registry);
        expect(upgraded.inputs.map(i => [i.id, i.type, i.exact, i.targets])).toEqual([
            ['in1', 'Dataset', true, [{ node: 'sp', port: 'data' }, { node: 'ro', port: 'in' }]],
            ['in1-result', 'InversionResult', undefined, [{ node: 'sp', port: 'result' }, { node: 'ro', port: 'in' }]],
        ]);
        expect(upgraded.nodes[0].typeVersion).toBe(2);

        // In a workflow: an inversion result connected to the old input goes to the new one
        const files = faultFiles();
        const json = JSON.stringify({
            schemaVersion: 1, name: 'w', composites: [old],
            nodes: [
                { ...dataNode('d', files) }, { ...node('i', 'inversion', FAST_INVERSION) },
                { ...node('g1', old.type) }, { ...node('g2', old.type) },
            ],
            edges: [edge('d', 'out', 'i'), edge('i', 'out', 'g1', 'in1'), edge('d', 'out', 'g2', 'in1')],
        });
        const { workflow: wf, issues } = parseWorkflow(json, registry);
        expect(issues.filter(i => i.severity === 'error')).toEqual([]);
        expect(wf.edges.filter(e => e.target.startsWith('g')).map(e => [e.target, e.targetPort])).toEqual([['g1', 'in1-result'], ['g2', 'in1']]);

        const restore = seedRandom(3);
        try {
            const r = await runWorkflow(wf, registry, env(files));
            expect(r.nodes['g1/sp'].inputs.result[0]).toBe(r.nodes.i.outputs.out);
            expect(r.nodes['g2/sp'].inputs.data[0]).toBe(r.nodes.d.outputs.out);
            expect(r.nodes['g1'].status).toBe('done');
        } finally { restore(); }
        expect(validateWorkflow(wf, registryFor(wf, registry)).filter(i => i.severity === 'error')).toEqual([]);
    });
});
