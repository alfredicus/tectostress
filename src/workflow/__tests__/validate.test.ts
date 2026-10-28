import { createDefaultRegistry } from '../blocks';
import { canConnect, resolveOutputType, topologicalOrder, validateWorkflow } from '../validate';
import { isSubtypeOf } from '../types';
import { PREDEFINED_WORKFLOWS } from '../templates';
import { registryFor } from '../composite';
import { edge, node, workflow } from './fixtures';

const registry = createDefaultRegistry();

describe('payload types', () => {
    test('an InversionResult is a Dataset, not the reverse', () => {
        expect(isSubtypeOf('InversionResult', 'Dataset')).toBe(true);
        expect(isSubtypeOf('Dataset', 'InversionResult')).toBe(false);
    });
});

describe('validateWorkflow', () => {
    test('the predefined workflows are valid', () => {
        PREDEFINED_WORKFLOWS.forEach(t => {
            expect(validateWorkflow(t.workflow, registryFor(t.workflow, registry)).filter(i => i.severity === 'error')).toEqual([]);
        });
    });

    test('a Dataset cannot feed a block that needs an InversionResult', () => {
        const wf = workflow([node('d', 'data'), node('s', 'view.summary')], [edge('d', 'out', 's')]);
        const issues = validateWorkflow(wf, registry);
        expect(issues.some(i => i.severity === 'error' && /expects InversionResult/.test(i.message))).toBe(true);
    });

    test('an InversionResult can feed a block that needs a Dataset', () => {
        const wf = workflow(
            [node('d', 'data'), node('i', 'inversion'), node('st', 'view.stereonet')],
            [edge('d', 'out', 'i'), edge('i', 'out', 'st')]);
        expect(validateWorkflow(wf, registry).filter(i => i.severity === 'error')).toEqual([]);
    });

    test('sameAs outputs take the type of their input', () => {
        const wf = workflow(
            [node('d', 'data'), node('i', 'inversion'), node('f', 'filter'), node('t', 'add-tags')],
            [edge('d', 'out', 'i'), edge('i', 'out', 'f'), edge('f', 'out', 't')]);
        expect(resolveOutputType(wf, registry, 'f', 'out')).toBe('InversionResult');
        expect(resolveOutputType(wf, registry, 't', 'out')).toBe('InversionResult');
    });

    test('unknown block types, unknown ports and cycles are errors', () => {
        const wf = workflow(
            [node('a', 'filter'), node('b', 'filter'), node('x', 'no-such-block')],
            [edge('a', 'out', 'b'), edge('b', 'out', 'a'), edge('a', 'nope', 'b')]);
        const messages = validateWorkflow(wf, registry).filter(i => i.severity === 'error').map(i => i.message);
        expect(messages).toEqual(expect.arrayContaining([
            'Unknown block type "no-such-block"',
            'Filter has no output "nope"',
            'The workflow contains a cycle',
        ]));
    });

    test('two connections into a single input is an error, an unconnected input a warning', () => {
        const wf = workflow(
            [node('d1', 'data'), node('d2', 'data'), node('i', 'inversion'), node('f', 'filter')],
            [edge('d1', 'out', 'i'), edge('d2', 'out', 'i')]);
        const issues = validateWorkflow(wf, registry);
        expect(issues.some(i => i.severity === 'error' && i.nodeId === 'i')).toBe(true);
        expect(issues.some(i => i.severity === 'warning' && i.nodeId === 'f')).toBe(true);
    });

    test('a dashboard accepts several inputs', () => {
        const wf = workflow(
            [node('d1', 'data'), node('d2', 'data'), node('v', 'view.dashboard')],
            [edge('d1', 'out', 'v'), edge('d2', 'out', 'v')]);
        expect(validateWorkflow(wf, registry).filter(i => i.severity === 'error')).toEqual([]);
    });

    test('topological order follows the dependencies', () => {
        const wf = workflow(
            [node('v', 'view.stereonet'), node('f', 'filter'), node('d', 'data')],
            [edge('d', 'out', 'f'), edge('f', 'out', 'v')]);
        expect(topologicalOrder(wf)).toEqual(['d', 'f', 'v']);
    });
});

describe('canConnect', () => {
    const base = () => workflow(
        [node('d', 'data'), node('i', 'inversion'), node('m', 'misfit-filter'), node('i2', 'inversion'), node('s', 'view.summary')],
        [edge('d', 'out', 'i'), edge('i', 'out', 'm')]);

    test('accepts a compatible connection', () => {
        expect(canConnect(base(), registry, { source: 'm', sourcePort: 'kept', target: 'i2', targetPort: 'in' }).ok).toBe(true);
    });

    test('refuses an incompatible type', () => {
        const r = canConnect(base(), registry, { source: 'm', sourcePort: 'kept', target: 's', targetPort: 'in' });
        expect(r.ok).toBe(false);
        expect(r.reason).toMatch(/expects InversionResult/);
    });

    test('refuses an occupied single input', () => {
        const r = canConnect(base(), registry, { source: 'd', sourcePort: 'out', target: 'i', targetPort: 'in' });
        expect(r).toEqual({ ok: false, reason: 'Input "Dataset" is already connected' });
    });

    test('refuses a cycle', () => {
        const wf = workflow([node('a', 'filter'), node('b', 'filter')], [edge('a', 'out', 'b')]);
        expect(canConnect(wf, registry, { source: 'b', sourcePort: 'out', target: 'a', targetPort: 'in' }))
            .toEqual({ ok: false, reason: 'This connection would create a cycle' });
    });
});
