// validate.ts
// Structural checks on a workflow graph: block types, ports, payload types, cycles (§4.1, §4.2).

import { BlockRegistry, findPort } from './registry';
import { isSubtypeOf, PayloadType, Workflow, WorkflowEdge, WorkflowNode } from './types';

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

/** Whether a value of `produced` type may flow into a port expecting `expected` */
export function typesCompatible(produced: ResolvedType, expected: PayloadType | 'any'): boolean {
    if (expected === 'any' || produced === 'any' || produced === 'unknown') return true;
    return isSubtypeOf(produced, expected);
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
    if (!typesCompatible(produced, inp.type)) {
        return `${sourceDef.title} produces ${produced}, but ${targetDef.title} expects ${inp.type}`;
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
            if (count === 0 && !port.optional) {
                issues.push({
                    severity: 'warning', nodeId: node.id,
                    message: `Input "${port.label}" of ${nodeName(node)} is not connected`
                });
            }
        });
    });

    if (!topologicalOrder(workflow)) {
        issues.push({ severity: 'error', message: 'The workflow contains a cycle' });
    }

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
