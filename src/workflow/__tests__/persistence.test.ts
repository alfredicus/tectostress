import { createDefaultRegistry } from '../blocks';
import { parseWorkflow, serializeWorkflow, WorkflowFormatError, WORKFLOW_SCHEMA_VERSION } from '../persistence';
import { instantiateTemplate, PREDEFINED_WORKFLOWS } from '../templates';

const registry = createDefaultRegistry();

describe('workflow files', () => {
    test('a saved workflow loads back identical', () => {
        const wf = instantiateTemplate(PREDEFINED_WORKFLOWS[0]);
        wf.nodes[1].active = false;
        const { workflow, issues } = parseWorkflow(serializeWorkflow(wf), registry);
        expect(workflow).toEqual(JSON.parse(JSON.stringify(wf)));
        expect(issues.filter(i => i.severity === 'error')).toEqual([]);
    });

    test('a file from a newer TectoStress is refused with a clear message', () => {
        const json = JSON.stringify({ schemaVersion: WORKFLOW_SCHEMA_VERSION + 1, name: 'x', nodes: [], edges: [] });
        expect(() => parseWorkflow(json, registry)).toThrow(/newer version of TectoStress/);
    });

    test('malformed files are refused', () => {
        expect(() => parseWorkflow('{', registry)).toThrow(WorkflowFormatError);
        expect(() => parseWorkflow('{"name":"x","nodes":[],"edges":[]}', registry)).toThrow(/schemaVersion/);
        expect(() => parseWorkflow('{"schemaVersion":1,"name":"x","nodes":[{"type":"data"}],"edges":[]}', registry))
            .toThrow(/needs an "id"/);
    });

    test('unknown blocks are reported, not dropped', () => {
        const json = JSON.stringify({
            schemaVersion: 1, name: 'x', edges: [],
            nodes: [{ id: 'a', type: 'future-block', typeVersion: 1, scientificParams: {}, presentationParams: {}, position: { x: 0, y: 0 } }],
        });
        const { workflow, issues } = parseWorkflow(json, registry);
        expect(workflow.nodes).toHaveLength(1);
        expect(issues).toEqual([expect.objectContaining({ severity: 'error', message: 'Unknown block type "future-block"' })]);
    });
});
