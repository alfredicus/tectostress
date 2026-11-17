// validate.ts
// Structural checks on a workflow graph: block types, ports, payload types, cycles (§4.1, §4.2).

import { BlockRegistry, findPort } from './registry';
import { PayloadType, PortDefinition, Workflow, WorkflowEdge, WorkflowNode } from './types';
import { DATA_TYPES, portAccepts, refusalReason } from './dataTypes';

export interface ValidationIssue {
    /** Errors prevent running the workflow; warnings only block the nodes concerned */
    severity: 'error' | 'warning';
    message: string;
    nodeId?: string;
    edgeId?: string;
}

/** Resolved type of a port: a payload type, 'any', or 'unknown' (sameAs an unconnected input) */
export type ResolvedType = PayloadType | 'any' | 'unknown';

const nodeName = (node: WorkflowNode) => node.label || `${node.type} (${node.id})`;

/**
 * Type produced by an output port. For `sameAs` ports, follows the connection into the
 * referenced input port; 'unknown' while that input is unconnected.
 */
export function resolveOutputType(
    workflow: Workflow,
    registry: BlockRegistry,
    nodeId: string,
    portId: string,
    visiting = new Set<string>()
): ResolvedType {
    const node = workflow.nodes.find(n => n.id === nodeId);
    const def = node && registry.get(node.type);
    const port = def && findPort(def.outputs, portId);
    if (!port) return 'unknown';
    if (!port.sameAs) return port.type;

    const key = `${nodeId}:${portId}`;
    if (visiting.has(key)) return 'unknown';   // cycle, reported elsewhere
    visiting.add(key);
    const edge = workflow.edges.find(e => e.target === nodeId && e.targetPort === port.sameAs);
    if (!edge) return 'unknown';
    return resolveOutputType(workflow, registry, edge.source, edge.sourcePort, visiting);
}

/** Whether a value of `produced` type may flow into `port` (§16) */
export function typesCompatible(produced: ResolvedType, port: Pick<PortDefinition, 'type' | 'exact'>): boolean {
    return portAccepts(port, produced);
}

/** Node ids in dependency order (Kahn). Returns null when the graph has a cycle. */
export function topologicalOrder(workflow: Workflow): string[] | null {
    const indegree = new Map<string, number>(workflow.nodes.map(n => [n.id, 0]));
    const next = new Map<string, string[]>(workflow.nodes.map(n => [n.id, []]));
    workflow.edges.forEach(e => {
        if (!indegree.has(e.source) || !indegree.has(e.target)) return;
        indegree.set(e.target, indegree.get(e.target)! + 1);
        next.get(e.source)!.push(e.target);
    });
    // Keep the workflow's node order among ready nodes, so execution order is predictable
    const queue = workflow.nodes.filter(n => indegree.get(n.id) === 0).map(n => n.id);
    const order: string[] = [];
    while (queue.length) {
        const id = queue.shift()!;
        order.push(id);
        next.get(id)!.forEach(t => {
            indegree.set(t, indegree.get(t)! - 1);
            if (indegree.get(t) === 0) queue.push(t);
        });
    }
    return order.length === workflow.nodes.length ? order : null;
}

/** `nodeId` and every node it depends on */
export function upstreamOf(workflow: Workflow, nodeId: string): Set<string> {
    const out = new Set<string>([nodeId]);
    const stack = [nodeId];
    while (stack.length) {
        const id = stack.pop()!;
        workflow.edges.filter(e => e.target === id).forEach(e => {
            if (!out.has(e.source)) { out.add(e.source); stack.push(e.source); }
        });
    }
    return out;
}

function checkEdge(workflow: Workflow, registry: BlockRegistry, edge: WorkflowEdge): string | null {
    const source = workflow.nodes.find(n => n.id === edge.source);
    const target = workflow.nodes.find(n => n.id === edge.target);
    if (!source || !target) return 'Connection to a block that does not exist';
    if (source.id === target.id) return 'A block cannot be connected to itself';
    const sourceDef = registry.get(source.type);
    const targetDef = registry.get(target.type);
    if (!sourceDef || !targetDef) return null;   // unknown types are reported per node
    const out = findPort(sourceDef.outputs, edge.sourcePort);
    const inp = findPort(targetDef.inputs, edge.targetPort);
    if (!out) return `${sourceDef.title} has no output "${edge.sourcePort}"`;
    if (!inp) return `${targetDef.title} has no input "${edge.targetPort}"`;
    const produced = resolveOutputType(workflow, registry, edge.source, edge.sourcePort);
    if (!typesCompatible(produced, inp)) {
        // Another input of the same block that would take it (Stereonet: measured data / inversion result)
        const alternative = targetDef.inputs.find(p => p.id !== inp.id && portAccepts(p, produced));
        return refusalReason(produced, inp, target.label || targetDef.title, alternative);
    }
    return null;
}

/** All structural problems of a workflow */
export function validateWorkflow(workflow: Workflow, registry: BlockRegistry): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    const seen = new Set<string>();
    workflow.nodes.forEach(node => {
        if (seen.has(node.id)) {
            issues.push({ severity: 'error', nodeId: node.id, message: `Duplicate block id "${node.id}"` });
        }
        seen.add(node.id);
        const def = registry.get(node.type);
        if (!def) {
            issues.push({ severity: 'error', nodeId: node.id, message: `Unknown block type "${node.type}"` });
        } else if (node.typeVersion > def.version) {
            issues.push({
                severity: 'error', nodeId: node.id,
                message: `${nodeName(node)} was saved by a newer version of TectoStress (block version ${node.typeVersion} > ${def.version})`
            });
        }
    });

    const edgeIds = new Set<string>();
    workflow.edges.forEach(edge => {
        if (edgeIds.has(edge.id)) {
            issues.push({ severity: 'error', edgeId: edge.id, message: `Duplicate connection id "${edge.id}"` });
        }
        edgeIds.add(edge.id);
        const problem = checkEdge(workflow, registry, edge);
        if (problem) issues.push({ severity: 'error', edgeId: edge.id, message: problem });
    });

    workflow.nodes.forEach(node => {
        const def = registry.get(node.type);
        if (!def) return;
        def.inputs.forEach(port => {
            const count = workflow.edges.filter(e => e.target === node.id && e.targetPort === port.id).length;
            if (count > 1 && !port.multiple) {
                issues.push({
                    severity: 'error', nodeId: node.id,
                    message: `Input "${port.label}" of ${nodeName(node)} accepts a single connection (${count} found)`
                });
            }
            if (count === 0 && !port.optional && !def.oneOfInputs?.includes(port.id)) {
                issues.push({
                    severity: 'warning', nodeId: node.id,
                    message: `Input "${port.label}" of ${nodeName(node)} is not connected`
                });
            }
        });
    });

    // Exactly one of alternative inputs (§16.3)
    workflow.nodes.forEach(node => {
        const def = registry.get(node.type);
        if (!def?.oneOfInputs) return;
        const ports = def.inputs.filter(p => def.oneOfInputs!.includes(p.id));
        const connected = ports.filter(p => workflow.edges.some(e => e.target === node.id && e.targetPort === p.id));
        const names = ports.map(p => `“${p.label}”`).join(' or ');
        if (connected.length === 0) {
            issues.push({ severity: 'warning', nodeId: node.id, message: `${nodeName(node)}: connect ${names}` });
        } else if (connected.length > 1) {
            issues.push({ severity: 'error', nodeId: node.id, message: `${nodeName(node)}: connect ${names}, not both` });
        }
    });

    // A dashboard fed measured data, with views needing a stress solution (§16.3)
    workflow.nodes.forEach(node => {
        if (node.type !== 'view.dashboard') return;
        const def = registry.get(node.type);
        const views: string[] = node.presentationParams?.views ?? def?.params.find(p => p.key === 'views')?.default ?? [];
        const needing = views.map(v => registry.get(v)).filter(v => v && v.inputs.length > 0
            && v.inputs.every(p => !portAccepts(p, 'Dataset')));
        const measured = workflow.edges.some(e => e.target === node.id
            && resolveOutputType(workflow, registry, e.source, e.sourcePort) === 'Dataset');
        if (measured && needing.length) {
            issues.push({
                severity: 'warning', nodeId: node.id,
                message: `${nodeName(node)} receives ${DATA_TYPES.Dataset.plural}: ${needing.map(v => v!.title).join(', ')} need an inversion result and will show nothing for them`,
            });
        }
    });

    if (!topologicalOrder(workflow)) {
        issues.push({ severity: 'error', message: 'The workflow contains a cycle' });
    }

    workflow.nodes.forEach(node => issues.push(...checkPerIteration(workflow, registry, node)));

    return issues;
}

/**
 * Parameters varying with the iteration (§12.5): only on a ForLoop, only for parameters declared
 * eligible, as non-empty lists of numbers within the parameter's range
 */
function checkPerIteration(workflow: Workflow, registry: BlockRegistry, node: WorkflowNode): ValidationIssue[] {
    const per = node.scientificParams?.perIteration;
    if (per === undefined || per === null) return [];
    const issues: ValidationIssue[] = [];
    const error = (message: string) => issues.push({ severity: 'error', nodeId: node.id, message });
    const loop = workflow.composites?.find(c => c.type === node.type);
    if (!loop?.loop) { error(`${nodeName(node)}: only blocks inside a ForLoop can have parameters varying with the iteration`); return issues; }
    if (typeof per !== 'object' || Array.isArray(per)) { error(`${nodeName(node)}: unreadable parameters varying with the iteration`); return issues; }
    const maxIterations = Number(node.scientificParams.maxIterations ?? 10);

    Object.entries<any>(per).forEach(([innerId, lists]) => {
        const inner = loop.nodes.find(n => n.id === innerId);
        const def = inner && registry.get(inner.type);
        if (!inner || !def) { error(`${nodeName(node)}: no block “${innerId}” in this loop`); return; }
        const name = `${inner.label || def.title} (in ${nodeName(node)})`;
        Object.entries<any>(lists ?? {}).forEach(([key, values]) => {
            const param = def.params.find(p => p.key === key);
            if (!param || !param.perIteration) {
                error(`“${param?.label ?? key}” of ${name} cannot vary with the iteration`);
            } else if (!Array.isArray(values) || values.length === 0) {
                error(`“${param.label}” of ${name} varies with the iteration but has no value`);
            } else if (values.some(v => typeof v !== 'number' || !Number.isFinite(v))) {
                error(`“${param.label}” of ${name}: every value must be a number`);
            } else if (values.some(v => (param.min !== undefined && v < param.min) || (param.max !== undefined && v > param.max))) {
                error(`“${param.label}” of ${name}: values must be between ${param.min ?? '−∞'} and ${param.max ?? '∞'}`);
            } else if (values.length > maxIterations) {
                issues.push({
                    severity: 'warning', nodeId: node.id,
                    message: `“${param.label}” of ${name}: ${values.length} values for at most ${maxIterations} iterations; the last ${values.length - maxIterations} are never used`,
                });
            }
        });
    });
    return issues;
}

/**
 * Whether a new connection may be added (used by the editor while the user drags a link).
 * Refuses unknown ports, incompatible types, an occupied single input, and cycles.
 */
export function canConnect(
    workflow: Workflow,
    registry: BlockRegistry,
    candidate: Omit<WorkflowEdge, 'id'>
): { ok: boolean; reason?: string } {
    const edge: WorkflowEdge = { ...candidate, id: '__candidate__' };
    const problem = checkEdge(workflow, registry, edge);
    if (problem) return { ok: false, reason: problem };

    const target = workflow.nodes.find(n => n.id === edge.target)!;
    const inp = findPort(registry.get(target.type)!.inputs, edge.targetPort)!;
    if (!inp.multiple && workflow.edges.some(e => e.target === edge.target && e.targetPort === edge.targetPort)) {
        return { ok: false, reason: `Input "${inp.label}" is already connected` };
    }
    if (workflow.edges.some(e => e.source === edge.source && e.sourcePort === edge.sourcePort
        && e.target === edge.target && e.targetPort === edge.targetPort)) {
        return { ok: false, reason: 'These ports are already connected' };
    }
    if (upstreamOf(workflow, edge.source).has(edge.target)) {
        return { ok: false, reason: 'This connection would create a cycle' };
    }
    return { ok: true };
}
