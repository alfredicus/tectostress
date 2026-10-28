// composite.ts
// Composite blocks (§11.3): a group of blocks saved and reused as one block. At run time a
// composite is expanded into its inner blocks, so cache, provenance and states work unchanged.

import { hashValue } from './hash';
import { BlockRegistry, findPort } from './registry';
import { resolveOutputType, topologicalOrder } from './validate';
import {
    BlockDefinition, CompositeDefinition, NodeResult, NodeStatus, PayloadType, Workflow, WorkflowEdge, WorkflowNode,
    WorkflowRunReport, isSubtypeOf,
} from './types';

export const COMPOSITE_PREFIX = 'composite:';
export const isCompositeType = (type: string) => type.startsWith(COMPOSITE_PREFIX);

/** Separator between a composite node id and an inner node id, in expanded workflows */
export const INNER_SEPARATOR = '/';
export const innerId = (compositeId: string, inner: string) => `${compositeId}${INNER_SEPARATOR}${inner}`;
/** The top-level node an expanded id belongs to */
export const outerId = (id: string) => id.split(INNER_SEPARATOR)[0];

/**
 * Parameters of the inner blocks, as stored on a composite node: scientific ones in
 * `scientificParams.inner`, display settings of inner views in `presentationParams.inner`
 */
export type InnerParams = Record<string, Record<string, any>>;

/** Display settings of an inner block of a composite node */
export function innerPresentation(node: WorkflowNode, inner: WorkflowNode): Record<string, any> {
    return (node.presentationParams?.inner as InnerParams | undefined)?.[inner.id] ?? inner.presentationParams;
}

export function compositeBlockDefinition(def: CompositeDefinition): BlockDefinition {
    const block: BlockDefinition = {
        type: def.type,
        version: def.version,
        title: def.title,
        description: def.description ?? `Group of ${def.nodes.length} blocks`,
        category: 'My blocks',
        role: 'computation',
        inputs: def.inputs.map(i => ({ id: i.id, label: i.label, type: i.type, optional: i.optional })),
        outputs: def.outputs.map(o => ({ id: o.id, label: o.label, type: o.type })),
        params: [{
            key: 'inner', label: 'Inner blocks', kind: 'object', scope: 'scientific',
            default: Object.fromEntries(def.nodes.map(n => [n.id, n.scientificParams])),
        }],
        // Never executed: expanded into its inner blocks before running
    };
    if (!def.loop) return block;

    // A ForLoop (§12): run by the executor, iteration after iteration
    const collectable = def.outputs.filter(o => o.type !== 'any');
    return {
        ...block,
        description: def.description ?? `Loop over ${def.nodes.length} blocks`,
        outputs: [...block.outputs, { id: LOOP_COLLECTED, label: 'All iterations', type: 'Dataset' }],
        params: [
            ...block.params,
            { key: 'maxIterations', label: 'Maximum iterations', kind: 'number', scope: 'scientific', default: 10, min: 1, max: 100, step: 1 },
            {
                key: 'collect', label: 'Collected over all iterations', kind: 'select', scope: 'scientific',
                default: collectable[0]?.id ?? 'none',
                options: [{ value: 'none', label: 'Nothing' }, ...collectable.map(o => ({ value: o.id, label: o.label }))],
                help: 'Gathered into the “All iterations” output, each row with its iteration number',
            },
        ],
    };
}

/** Output of a ForLoop gathering one inner output over all iterations */
export const LOOP_COLLECTED = 'collected';

/** Placeholder source feeding a loop body with the values of the loop's inputs */
export const LOOP_INPUT_TYPE = '__loop-input';
export const LoopInputBlock: BlockDefinition = {
    type: LOOP_INPUT_TYPE,
    version: 1,
    title: 'Loop input',
    category: 'Internal',
    role: 'source',
    inputs: [],
    outputs: [{ id: 'out', label: 'Value', type: 'any' }],
    params: [],
    // Its value is injected by the loop at each iteration
};

/**
 * The workflow run at each iteration of a ForLoop: its inner blocks, plus one placeholder source
 * per loop input that is connected (or required). Returns the placeholder of each input.
 */
export function buildLoopBody(def: CompositeDefinition, node: WorkflowNode, connected: Set<string>): {
    workflow: Workflow; inputNodes: Map<string, string>;
} {
    const params: InnerParams = node.scientificParams.inner ?? {};
    const fakeEdges = Array.from(connected).map(id => ({ id, source: '', sourcePort: '', target: node.id, targetPort: id }));
    const { replacedPorts, droppedNodes } = replacements(def, fakeEdges, node.id);

    const nodes: WorkflowNode[] = def.nodes.filter(n => !droppedNodes.has(n.id)).map(n => ({
        ...n,
        scientificParams: params[n.id] ?? n.scientificParams,
        presentationParams: innerPresentation(node, n),
    }));
    const edges: WorkflowEdge[] = def.edges.filter(e =>
        !replacedPorts.has(`${e.source}:${e.sourcePort}`) && !droppedNodes.has(e.source));

    const inputNodes = new Map<string, string>();
    def.inputs.forEach(input => {
        if (!connected.has(input.id)) return;
        const id = `__in-${input.id}`;
        inputNodes.set(input.id, id);
        nodes.push({ id, type: LOOP_INPUT_TYPE, typeVersion: 1, active: true, scientificParams: {}, presentationParams: {}, position: { x: 0, y: 0 } });
        input.targets.forEach((t, k) => edges.push({ id: `${id}-${k}`, source: id, sourcePort: 'out', target: t.node, targetPort: t.port }));
    });
    return { workflow: { schemaVersion: 1, name: def.title, nodes, edges }, inputNodes };
}

/** The registry extended with the composite blocks a workflow (and a library) defines */
export function registryFor(workflow: Workflow, base: BlockRegistry, library: CompositeDefinition[] = []): BlockRegistry {
    const composites = [...(workflow.composites ?? []), ...library];
    if (composites.length === 0) return base;
    const registry = new BlockRegistry();
    base.list().forEach(b => registry.register(b));
    composites.forEach(c => { if (!registry.has(c.type)) registry.register(compositeBlockDefinition(c)); });
    return registry;
}

// ============================================================================
// EXPANSION AND FOLDING
// ============================================================================

export interface Expansion {
    workflow: Workflow;
    /** Composite node id → ids of its inner nodes in the expanded workflow */
    inner: Map<string, string[]>;
    definitions: Map<string, CompositeDefinition>;
    /** Expanded ids of inner source blocks left out because a connected input replaces them */
    dropped: Set<string>;
}

/** Replace every active composite node by its inner blocks, rewiring the connections */
export function expandComposites(workflow: Workflow): Expansion {
    const definitions = new Map((workflow.composites ?? []).map(c => [c.type, c]));
    const inner = new Map<string, string[]>();
    const dropped = new Set<string>();
    const nodes: WorkflowNode[] = [];
    let edges: WorkflowEdge[] = [...workflow.edges];

    workflow.nodes.forEach(node => {
        const def = definitions.get(node.type);
        // An inactive composite stays a single (inactive) block: it stops its branch. A ForLoop
        // stays a single block too: the executor runs it iteration after iteration
        if (!def || !node.active || def.loop) { nodes.push(node); return; }

        const params: InnerParams = node.scientificParams.inner ?? {};
        const { replacedPorts, droppedNodes } = replacements(def, workflow.edges, node.id);
        const ids: string[] = [];
        def.nodes.forEach(n => {
            const id = innerId(node.id, n.id);
            if (droppedNodes.has(n.id)) { dropped.add(id); return; }
            ids.push(id);
            nodes.push({
                ...n,
                id,
                label: n.label,
                scientificParams: params[n.id] ?? n.scientificParams,
                presentationParams: innerPresentation(node, n),
                position: { x: node.position.x + n.position.x, y: node.position.y + n.position.y },
            });
        });
        inner.set(node.id, ids);

        const rewired: WorkflowEdge[] = [];
        edges.forEach(e => {
            if (e.target === node.id) {
                const input = def.inputs.find(i => i.id === e.targetPort);
                input?.targets.forEach((t, k) => rewired.push({
                    ...e, id: `${e.id}${INNER_SEPARATOR}${k}`, target: innerId(node.id, t.node), targetPort: t.port,
                }));
            } else if (e.source === node.id) {
                const output = def.outputs.find(o => o.id === e.sourcePort);
                if (output) rewired.push({ ...e, source: innerId(node.id, output.source.node), sourcePort: output.source.port });
            } else {
                rewired.push(e);
            }
        });
        def.edges
            .filter(e => !replacedPorts.has(`${e.source}:${e.sourcePort}`) && !droppedNodes.has(e.source))
            .forEach(e => rewired.push({
                ...e, id: innerId(node.id, e.id), source: innerId(node.id, e.source), target: innerId(node.id, e.target),
            }));
        edges = rewired;
    });

    const loops = (workflow.composites ?? []).filter(c => c.loop);
    return { workflow: { ...workflow, nodes, edges, composites: loops.length ? loops : undefined }, inner, definitions, dropped };
}

/**
 * Inner source outputs replaced by a connected input of the composite node, and the inner source
 * blocks no longer needed (all their used outputs replaced, none exported by the composite)
 */
function replacements(def: CompositeDefinition, edges: WorkflowEdge[], compositeId: string) {
    const replacedPorts = new Set(def.inputs
        .filter(i => i.replaces && edges.some(e => e.target === compositeId && e.targetPort === i.id))
        .map(i => `${i.replaces!.node}:${i.replaces!.port}`));
    const droppedNodes = new Set(def.nodes
        .filter(n => {
            const used = def.edges.filter(e => e.source === n.id).map(e => `${n.id}:${e.sourcePort}`);
            return used.length > 0 && used.every(p => replacedPorts.has(p))
                && !def.outputs.some(o => o.source.node === n.id);
        })
        .map(n => n.id));
    return { replacedPorts, droppedNodes };
}

// Most significant state first: what the composite shows when its inner blocks differ
const STATUS_PRIORITY: NodeStatus[] = ['error', 'running', 'blocked', 'stale', 'idle', 'done', 'skipped', 'inactive'];

/** Result of a composite node, from the results of its inner blocks */
export function foldComposite(
    compositeId: string,
    def: CompositeDefinition,
    nodes: Record<string, NodeResult>,
    dropped: Set<string> = new Set()
): NodeResult | undefined {
    const inner = def.nodes
        .filter(n => !dropped.has(innerId(compositeId, n.id)))
        .map(n => ({ node: n, result: nodes[innerId(compositeId, n.id)] }));
    if (inner.every(i => !i.result)) return undefined;

    const statuses: NodeStatus[] = inner.map(i => i.result?.status ?? 'idle')
        // An inner block switched off inside the composite does not make the composite "off"
        .map((s): NodeStatus => s === 'inactive' ? 'done' : s);
    const status = STATUS_PRIORITY.find(s => statuses.includes(s)) ?? 'idle';
    const first = (pred: (r: NodeResult) => boolean) => inner.find(i => i.result && pred(i.result));
    const failing = first(r => r.status === 'error');
    const blocked = first(r => r.status === 'blocked' || r.status === 'stale');
    const running = first(r => r.status === 'running');
    const name = (n: WorkflowNode) => n.label || n.type;

    const outputs: NodeResult['outputs'] = {};
    def.outputs.forEach(o => {
        const payload = nodes[innerId(compositeId, o.source.node)]?.outputs[o.source.port];
        if (payload) outputs[o.id] = payload;
    });
    const inputs: NodeResult['inputs'] = {};
    def.inputs.forEach(i => {
        const t = i.targets[0];
        const values = t && nodes[innerId(compositeId, t.node)]?.inputs[t.port];
        if (values) inputs[i.id] = values;
    });

    return {
        status,
        key: hashValue(inner.map(i => i.result?.key ?? null)),
        // "cached" when nothing inside had to be computed
        cached: status === 'done' && inner.every(i => !i.result || i.result.cached || i.result.status === 'inactive') || undefined,
        inputs,
        outputs,
        error: failing ? `${name(failing.node)}: ${failing.result!.error}` : undefined,
        reason: !failing && blocked ? `${name(blocked.node)}: ${blocked.result!.reason ?? 'not up to date'}` : undefined,
        progress: running?.result!.progress,
        progressMessage: running ? `${name(running.node)}${running.result!.progressMessage ? `: ${running.result!.progressMessage}` : ''}` : undefined,
        logs: inner.flatMap(i => (i.result?.logs ?? []).map(l => ({ ...l, message: `[${name(i.node)}] ${l.message}` }))),
        durationMs: inner.reduce((t, i) => t + (i.result?.durationMs ?? 0), 0) || undefined,
    };
}

/** Add the folded result of every composite node to a report of the expanded workflow */
export function foldReport(report: WorkflowRunReport, expansion: Expansion, workflow: Workflow): WorkflowRunReport {
    const nodes = { ...report.nodes };
    expansion.inner.forEach((_, compositeId) => {
        const node = workflow.nodes.find(n => n.id === compositeId)!;
        const folded = foldComposite(compositeId, expansion.definitions.get(node.type)!, report.nodes, expansion.dropped);
        if (folded) nodes[compositeId] = folded;
    });
    return { ...report, nodes };
}

// ============================================================================
// GROUP / UNGROUP (editor operations)
// ============================================================================

export class CompositeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CompositeError';
    }
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'block';

/**
 * Turn the selected blocks into a composite block. Connections crossing the selection become its
 * inputs (one per outside source) and outputs (one per inner output used outside).
 */
export function groupAsComposite(
    workflow: Workflow,
    registry: BlockRegistry,
    selectedIds: string[],
    title: string,
    makeId: () => string
): { workflow: Workflow; definition: CompositeDefinition; nodeId: string } {
    const selected = workflow.nodes.filter(n => selectedIds.includes(n.id));
    if (selected.length < 2) throw new CompositeError('Select at least two blocks to group');
    for (const n of selected) {
        const def = registry.get(n.type);
        if (!def) throw new CompositeError(`Unknown block type "${n.type}"`);
        if (isCompositeType(n.type)) throw new CompositeError('A group cannot contain another group (not supported yet)');
        // Views are fine (the group shows them); a report gathers the tags of the whole run
        if (def.role === 'report') {
            throw new CompositeError(`${def.title} blocks cannot go into a group: a report covers the whole workflow`);
        }
    }

    const inside = new Set(selectedIds);
    const innerEdges = workflow.edges.filter(e => inside.has(e.source) && inside.has(e.target));
    const incoming = workflow.edges.filter(e => !inside.has(e.source) && inside.has(e.target));
    const outgoing = workflow.edges.filter(e => inside.has(e.source) && !inside.has(e.target));
    const title_ = title.trim() || 'My block';
    const portLabel = (nodeId: string, portId: string, side: 'in' | 'out') => {
        const node = workflow.nodes.find(n => n.id === nodeId)!;
        const def = registry.get(node.type)!;
        const ports = side === 'in' ? def.inputs : def.outputs;
        const name = node.label || def.title;
        // The port name only matters when the inner block has several on that side
        return ports.length > 1 ? `${name} · ${findPort(ports, portId)?.label ?? portId}` : name;
    };

    // One input per outside source, feeding every inner port it was connected to
    const inputs: CompositeDefinition['inputs'] = [];
    const inputOf = new Map<string, string>();
    incoming.forEach(e => {
        const key = `${e.source}:${e.sourcePort}`;
        let id = inputOf.get(key);
        if (!id) {
            id = `in${inputs.length + 1}`;
            inputOf.set(key, id);
            const node = workflow.nodes.find(n => n.id === e.target)!;
            const port = findPort(registry.get(node.type)!.inputs, e.targetPort)!;
            inputs.push({ id, label: portLabel(e.target, e.targetPort, 'in'), type: port.type, targets: [] });
        }
        inputs.find(i => i.id === id)!.targets.push({ node: e.target, port: e.targetPort });
    });

    // Inner input ports fed by nothing (typically the first block of the group) become inputs too,
    // with their own type: Dataset for an Inversion or a Filter, InversionResult for a Misfit filter
    const order = topologicalOrder(workflow) ?? workflow.nodes.map(n => n.id);
    order.filter(id => inside.has(id)).forEach(id => {
        const def = registry.get(workflow.nodes.find(n => n.id === id)!.type)!;
        def.inputs.forEach(port => {
            if (workflow.edges.some(e => e.target === id && e.targetPort === port.id)) return;
            inputs.push({
                id: `in${inputs.length + 1}`,
                label: portLabel(id, port.id, 'in'),
                type: port.type,
                optional: port.optional,
                targets: [{ node: id, port: port.id }],
            });
        });
    });

    // Inner source blocks (Data) get an optional input that can replace their output: unconnected,
    // the group reads its own data; connected, it works on the dataset received instead
    order.filter(id => inside.has(id)).forEach(id => {
        const def = registry.get(workflow.nodes.find(n => n.id === id)!.type)!;
        if (def.role !== 'source') return;
        def.outputs.forEach(port => {
            const consumers = innerEdges.filter(e => e.source === id && e.sourcePort === port.id);
            if (consumers.length === 0 || port.type === 'any') return;
            const node = workflow.nodes.find(n => n.id === id)!;
            inputs.push({
                id: `in${inputs.length + 1}`,
                label: `Instead of ${node.label || def.title}`,
                type: port.type,
                optional: true,
                targets: consumers.map(e => ({ node: e.target, port: e.targetPort })),
                replaces: { node: id, port: port.id },
            });
        });
    });

    // Outputs: every inner output port used outside, plus the final results inside the group,
    // i.e. output ports no inner processing block consumes (a view or an ExitLoop inside does not
    // count), so the group can be connected onwards even when its result is only used inside
    const outputs: CompositeDefinition['outputs'] = [];
    const outputOf = new Map<string, string>();
    const addOutput = (node: string, port: string) => {
        const key = `${node}:${port}`;
        if (outputOf.has(key)) return;
        const id = `out${outputs.length + 1}`;
        outputOf.set(key, id);
        const type = resolveOutputType(workflow, registry, node, port);
        outputs.push({
            id, label: portLabel(node, port, 'out'),
            type: type === 'unknown' ? 'any' : type,
            source: { node, port },
        });
    };
    outgoing.forEach(e => addOutput(e.source, e.sourcePort));
    // A block with no output (a view, an ExitLoop) does not pass the value on: it does not count
    const isSink = (id: string) => {
        const def = registry.get(workflow.nodes.find(n => n.id === id)!.type);
        return def?.role === 'view' || def?.outputs.length === 0;
    };
    order.filter(id => inside.has(id) && !isSink(id)).forEach(id => {
        const def = registry.get(workflow.nodes.find(n => n.id === id)!.type)!;
        def.outputs.forEach(port => {
            const consumedInside = innerEdges.some(e => e.source === id && e.sourcePort === port.id && !isSink(e.target));
            if (!consumedInside) addOutput(id, port.id);
        });
    });

    const minX = Math.min(...selected.map(n => n.position.x));
    const minY = Math.min(...selected.map(n => n.position.y));
    const definition: CompositeDefinition = {
        type: `${COMPOSITE_PREFIX}${slug(title_)}-${makeId()}`,
        version: 1,
        title: title_,
        nodes: selected.map(n => ({ ...n, position: { x: n.position.x - minX, y: n.position.y - minY } })),
        edges: innerEdges,
        inputs,
        outputs,
    };

    const nodeId = `${slug(title_)}-${makeId()}`;
    const compositeNode: WorkflowNode = {
        id: nodeId,
        type: definition.type,
        typeVersion: 1,
        active: true,
        scientificParams: { inner: Object.fromEntries(selected.map(n => [n.id, n.scientificParams])) },
        presentationParams: { inner: Object.fromEntries(selected.map(n => [n.id, n.presentationParams])) },
        position: { x: minX, y: minY },
    };

    const edges: WorkflowEdge[] = [
        ...workflow.edges.filter(e => !inside.has(e.source) && !inside.has(e.target)),
        // Same outside source into several inner ports: one connection into the composite
        ...Array.from(inputOf.entries()).map(([key, id]) => {
            const e = incoming.find(x => `${x.source}:${x.sourcePort}` === key)!;
            return { id: e.id, source: e.source, sourcePort: e.sourcePort, target: nodeId, targetPort: id };
        }),
        ...outgoing.map(e => ({ ...e, source: nodeId, sourcePort: outputOf.get(`${e.source}:${e.sourcePort}`)! })),
    ];

    return {
        workflow: {
            ...workflow,
            nodes: [...workflow.nodes.filter(n => !inside.has(n.id)), compositeNode],
            edges,
            composites: [...(workflow.composites ?? []), definition],
        },
        definition,
        nodeId,
    };
}

/** What "Make a loop" would produce for a selection: the carried input and the possible choices */
export function loopOptions(workflow: Workflow, registry: BlockRegistry, selectedIds: string[]) {
    const { definition } = groupAsComposite(workflow, registry, selectedIds, 'loop', () => 'preview');
    const carried = definition.inputs.find(i => !i.optional) ?? definition.inputs[0];
    if (!carried) {
        throw new CompositeError('A loop needs an input to pass a value from one iteration to the next: its first block must have an input');
    }
    const fits = (type: string) => carried.type === 'any' || type === 'any'
        || (type !== 'any' && isSubtypeOf(type as PayloadType, carried.type as PayloadType));
    const carriedOutputs = definition.outputs.filter(o => fits(o.type));
    if (carriedOutputs.length === 0) {
        throw new CompositeError(`No output of the selection can be passed back to “${carried.label}” (${carried.type})`);
    }
    return { definition, carriedInput: carried, carriedOutputs, collectable: definition.outputs.filter(o => o.type !== 'any') };
}

/** Turn the selected blocks into a ForLoop (§12.1) */
export function makeLoop(
    workflow: Workflow,
    registry: BlockRegistry,
    selectedIds: string[],
    title: string,
    makeId: () => string,
    options: { carriedOutput: string; collect?: string; maxIterations?: number }
): { workflow: Workflow; definition: CompositeDefinition; nodeId: string } {
    const { carriedInput, carriedOutputs } = loopOptions(workflow, registry, selectedIds);
    if (!carriedOutputs.some(o => o.id === options.carriedOutput)) {
        throw new CompositeError('Choose which output is passed to the next iteration');
    }
    const grouped = groupAsComposite(workflow, registry, selectedIds, title.trim() || 'Loop', makeId);
    const definition: CompositeDefinition = {
        ...grouped.definition,
        type: grouped.definition.type.replace(COMPOSITE_PREFIX, `${COMPOSITE_PREFIX}loop-`),
        loop: { carriedInput: carriedInput.id, carriedOutput: options.carriedOutput },
    };
    return {
        definition,
        nodeId: grouped.nodeId,
        workflow: {
            ...grouped.workflow,
            composites: [...(grouped.workflow.composites ?? []).filter(c => c.type !== grouped.definition.type), definition],
            nodes: grouped.workflow.nodes.map(n => n.id !== grouped.nodeId ? n : {
                ...n,
                type: definition.type,
                scientificParams: {
                    ...n.scientificParams,
                    maxIterations: options.maxIterations ?? 10,
                    collect: options.collect ?? 'none',
                },
            }),
        },
    };
}

/** Put the inner blocks of a composite node back on the canvas */
export function ungroupComposite(workflow: Workflow, compositeNodeId: string, makeId: () => string): Workflow {
    const node = workflow.nodes.find(n => n.id === compositeNodeId);
    const def = node && workflow.composites?.find(c => c.type === node.type);
    if (!node || !def) throw new CompositeError('Not a group');

    const params: InnerParams = node.scientificParams.inner ?? {};
    const suffix = makeId();
    const newId = (id: string) => `${id}-${suffix}`;
    // A connected replacement input keeps feeding the same blocks after ungrouping; the inner
    // source it replaced stays on the canvas, disconnected
    const { replacedPorts } = replacements(def, workflow.edges, node.id);
    const nodes = def.nodes.map(n => ({
        ...n,
        id: newId(n.id),
        scientificParams: params[n.id] ?? n.scientificParams,
        presentationParams: innerPresentation(node, n),
        position: { x: node.position.x + n.position.x, y: node.position.y + n.position.y },
    }));

    const edges: WorkflowEdge[] = [];
    workflow.edges.forEach(e => {
        if (e.target === node.id) {
            def.inputs.find(i => i.id === e.targetPort)?.targets.forEach((t, k) =>
                edges.push({ ...e, id: `${e.id}-${k}-${suffix}`, target: newId(t.node), targetPort: t.port }));
        } else if (e.source === node.id) {
            const o = def.outputs.find(x => x.id === e.sourcePort);
            if (o) edges.push({ ...e, source: newId(o.source.node), sourcePort: o.source.port });
        } else {
            edges.push(e);
        }
    });
    def.edges
        .filter(e => !replacedPorts.has(`${e.source}:${e.sourcePort}`))
        .forEach(e => edges.push({ ...e, id: newId(e.id), source: newId(e.source), target: newId(e.target) }));

    const others = workflow.nodes.filter(n => n.id !== node.id);
    const stillUsed = others.some(n => n.type === def.type);
    return {
        ...workflow,
        nodes: [...others, ...nodes],
        edges,
        composites: stillUsed ? workflow.composites : workflow.composites!.filter(c => c.type !== def.type),
    };
}
