// persistence.ts
// Workflow files: JSON with a schema version, migrated when loaded (§4.8).
// Only the graph and its parameters are saved, never results.

import { BlockRegistry } from './registry';
import { validateWorkflow, ValidationIssue } from './validate';
import { isCompositeType, registryFor } from './composite';
import { CompositeDefinition, Workflow, WorkflowEdge, WorkflowNode } from './types';

export const WORKFLOW_SCHEMA_VERSION = 1;

/** Upgrades from schema version N to N+1, indexed by N */
const MIGRATIONS: Record<number, (raw: any) => any> = {};

export class WorkflowFormatError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'WorkflowFormatError';
    }
}

export function serializeWorkflow(workflow: Workflow): string {
    // Only the composite definitions actually used
    const used = (workflow.composites ?? []).filter(c => workflow.nodes.some(n => n.type === c.type));
    const clean: Workflow = {
        schemaVersion: WORKFLOW_SCHEMA_VERSION,
        name: workflow.name,
        ...(workflow.description ? { description: workflow.description } : {}),
        nodes: workflow.nodes.map(n => ({
            id: n.id,
            type: n.type,
            typeVersion: n.typeVersion,
            ...(n.label ? { label: n.label } : {}),
            active: n.active,
            scientificParams: n.scientificParams,
            presentationParams: n.presentationParams,
            position: n.position,
        })),
        edges: workflow.edges.map(e => ({
            id: e.id, source: e.source, sourcePort: e.sourcePort, target: e.target, targetPort: e.targetPort,
        })),
        ...(used.length ? { composites: used } : {}),
    };
    return JSON.stringify(clean, null, 2);
}

const isObject = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);

function checkShape(raw: any): void {
    if (!isObject(raw)) throw new WorkflowFormatError('A workflow file must contain a JSON object');
    if (typeof raw.name !== 'string') throw new WorkflowFormatError('Missing workflow name');
    if (!Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) {
        throw new WorkflowFormatError('A workflow needs "nodes" and "edges" lists');
    }
    raw.nodes.forEach((n: any, i: number) => {
        if (!isObject(n) || typeof n.id !== 'string' || typeof n.type !== 'string') {
            throw new WorkflowFormatError(`Block #${i + 1} needs an "id" and a "type"`);
        }
    });
    raw.edges.forEach((e: any, i: number) => {
        if (!isObject(e) || ['id', 'source', 'sourcePort', 'target', 'targetPort'].some(k => typeof e[k] !== 'string')) {
            throw new WorkflowFormatError(`Connection #${i + 1} is incomplete`);
        }
    });
    if (raw.composites !== undefined) {
        if (!Array.isArray(raw.composites)) throw new WorkflowFormatError('"composites" must be a list');
        raw.composites.forEach((c: any, i: number) => {
            if (!isObject(c) || typeof c.type !== 'string' || !isCompositeType(c.type) || typeof c.title !== 'string'
                || !Array.isArray(c.nodes) || !Array.isArray(c.edges) || !Array.isArray(c.inputs) || !Array.isArray(c.outputs)) {
                throw new WorkflowFormatError(`Group definition #${i + 1} is incomplete`);
            }
        });
    }
}

/**
 * Read a workflow file. Throws WorkflowFormatError when the file cannot be understood; returns
 * the structural issues (unknown blocks, type mismatches…) otherwise, for the editor to show.
 */
export function parseWorkflow(json: string, registry: BlockRegistry): { workflow: Workflow; issues: ValidationIssue[] } {
    let raw: any;
    try {
        raw = JSON.parse(json);
    } catch (e) {
        throw new WorkflowFormatError(`Not a valid JSON file: ${e instanceof Error ? e.message : e}`);
    }
    if (!isObject(raw)) throw new WorkflowFormatError('A workflow file must contain a JSON object');

    let version = raw.schemaVersion;
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
        throw new WorkflowFormatError('Missing or invalid "schemaVersion"');
    }
    if (version > WORKFLOW_SCHEMA_VERSION) {
        throw new WorkflowFormatError(
            `This workflow was saved by a newer version of TectoStress (format ${version}, this version reads up to ${WORKFLOW_SCHEMA_VERSION})`);
    }
    while (version < WORKFLOW_SCHEMA_VERSION) {
        const migrate = MIGRATIONS[version];
        if (!migrate) throw new WorkflowFormatError(`No migration from workflow format ${version}`);
        raw = migrate(raw);
        version++;
    }
    checkShape(raw);

    const nodes: WorkflowNode[] = raw.nodes.map((n: any) => {
        const node: WorkflowNode = {
            id: n.id,
            type: n.type,
            typeVersion: typeof n.typeVersion === 'number' ? n.typeVersion : 1,
            label: typeof n.label === 'string' ? n.label : undefined,
            active: n.active !== false,
            scientificParams: isObject(n.scientificParams) ? n.scientificParams : {},
            presentationParams: isObject(n.presentationParams) ? n.presentationParams : {},
            position: isObject(n.position) && typeof n.position.x === 'number' && typeof n.position.y === 'number'
                ? { x: n.position.x, y: n.position.y } : { x: 0, y: 0 },
        };
        // Blocks saved by an older version of their definition
        const def = registry.get(node.type);
        if (def && node.typeVersion < def.version && def.migrate) {
            const migrated = def.migrate({ scientific: node.scientificParams, presentation: node.presentationParams }, node.typeVersion);
            node.scientificParams = migrated.scientific;
            node.presentationParams = migrated.presentation;
            node.typeVersion = def.version;
        }
        return node;
    });
    const edges: WorkflowEdge[] = raw.edges.map((e: any) => ({
        id: e.id, source: e.source, sourcePort: e.sourcePort, target: e.target, targetPort: e.targetPort,
    }));

    const workflow: Workflow = {
        schemaVersion: WORKFLOW_SCHEMA_VERSION,
        name: raw.name,
        description: typeof raw.description === 'string' ? raw.description : undefined,
        nodes,
        edges,
        ...(raw.composites?.length ? { composites: raw.composites as CompositeDefinition[] } : {}),
    };
    return { workflow, issues: validateWorkflow(workflow, registryFor(workflow, registry)) };
}
