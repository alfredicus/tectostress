// upgradeInputs.ts
// Workflows and groups saved before a block got one input per kind of data (§16.3: Stereonet and
// Sphere, version 1 → 2). Each connection goes to the input matching what it carries, so the
// drawing shows the same thing as before.

import { registryFor } from './composite';
import { portAccepting, acceptedByAll } from './dataTypes';
import { BlockRegistry, findPort } from './registry';
import { CompositeDefinition, PayloadType, Workflow, WorkflowEdge, WorkflowNode } from './types';
import { resolveOutputType } from './validate';

/** Group inputs split in two: group type → input id → id of the new "inversion result" input */
type Splits = Map<string, Map<string, string>>;

const RESULT_SUFFIX = '-result';

/** Inner blocks saved by an older version of their definition (as is done for top-level blocks) */
function upgradeNode(node: WorkflowNode, registry: BlockRegistry): WorkflowNode {
    const def = registry.get(node.type);
    if (!def || node.typeVersion >= def.version) return node;
    const migrated = def.migrate
        ? def.migrate({ scientific: node.scientificParams, presentation: node.presentationParams }, node.typeVersion)
        : { scientific: node.scientificParams, presentation: node.presentationParams };
    return { ...node, scientificParams: migrated.scientific, presentationParams: migrated.presentation, typeVersion: def.version };
}

function retargetEdges(graph: Workflow, registry: BlockRegistry, splits: Splits): WorkflowEdge[] {
    return graph.edges.map(edge => {
        const target = graph.nodes.find(n => n.id === edge.target);
        if (!target) return edge;
        const legacy = registry.get(target.type)?.legacyInputs?.[edge.targetPort];
        const split = splits.get(target.type)?.get(edge.targetPort);
        if (!legacy && !split) return edge;
        const carried = resolveOutputType(graph, registry, edge.source, edge.sourcePort);
        if (legacy) {
            const port = legacy.byType[carried as PayloadType] ?? legacy.otherwise;
            return { ...edge, targetPort: port };
        }
        return carried === 'InversionResult' ? { ...edge, targetPort: split! } : edge;
    });
}

function upgradeComposite(def: CompositeDefinition, all: CompositeDefinition[], base: BlockRegistry, splits: Splits): CompositeDefinition {
    const registry = registryFor({ schemaVersion: 1, name: '', nodes: [], edges: [], composites: all }, base);
    const graph: Workflow = { schemaVersion: 1, name: def.title, nodes: def.nodes, edges: def.edges, composites: all };
    const edges = retargetEdges(graph, registry, splits);
    const nodes = def.nodes.map(n => upgradeNode(n, registry));
    const portOf = (t: { node: string; port: string }) => {
        const node = nodes.find(n => n.id === t.node);
        return node ? findPort(registry.get(node.type)?.inputs ?? [], t.port) : undefined;
    };

    const inputs: CompositeDefinition['inputs'] = [];
    const mySplits = new Map<string, string>();
    def.inputs.forEach(input => {
        const legacyTargets = input.targets.filter(t => {
            const node = nodes.find(n => n.id === t.node);
            return node && registry.get(node.type)?.legacyInputs?.[t.port];
        });
        if (legacyTargets.length === 0) { inputs.push(input); return; }
        const route = (type: PayloadType) => input.targets.map(t => {
            const node = nodes.find(n => n.id === t.node)!;
            const legacy = registry.get(node.type)?.legacyInputs?.[t.port];
            return legacy ? { node: t.node, port: legacy.byType[type] ?? legacy.otherwise } : t;
        });
        const typed = (targets: { node: string; port: string }[]) => {
            const ports = targets.map(portOf).filter(Boolean) as NonNullable<ReturnType<typeof portOf>>[];
            return portAccepting(acceptedByAll(ports)) ?? { type: input.type };
        };
        if (input.type === 'InversionResult') {
            const targets = route('InversionResult');
            inputs.push({ ...input, ...typed(targets), targets });
            return;
        }
        // It took both kinds: one input for each, so every outside connection keeps its meaning
        const dataTargets = route('Dataset');
        const resultTargets = route('InversionResult').filter(t => portOf(t) && acceptedByAll([portOf(t)!]).includes('InversionResult'));
        const resultId = `${input.id}${RESULT_SUFFIX}`;
        mySplits.set(input.id, resultId);
        inputs.push({ ...input, ...typed(dataTargets), label: `${input.label} · measured data`, optional: true, targets: dataTargets });
        inputs.push({ id: resultId, label: `${input.label} · inversion result`, type: 'InversionResult', optional: true, targets: resultTargets });
    });
    if (mySplits.size) splits.set(def.type, mySplits);
    return { ...def, nodes, edges, inputs };
}

/** Groups whose inner groups are upgraded first */
function upgradeComposites(defs: CompositeDefinition[], base: BlockRegistry, splits: Splits): CompositeDefinition[] {
    const done = new Map<string, CompositeDefinition>();
    let pending = [...defs];
    while (pending.length) {
        const ready = pending.filter(d => d.nodes.every(n => !defs.some(o => o.type === n.type) || done.has(n.type) || n.type === d.type));
        const batch = ready.length ? ready : pending;   // a cycle is reported elsewhere
        batch.forEach(d => done.set(d.type, upgradeComposite(d, [...Array.from(done.values()), ...pending.filter(p => !done.has(p.type))], base, splits)));
        pending = pending.filter(d => !done.has(d.type));
    }
    return defs.map(d => done.get(d.type)!);
}

/** A connection or a group input still going to a replaced input (e.g. `in` of a Stereonet) */
function needsUpgrade(nodes: WorkflowNode[], edges: WorkflowEdge[], defs: CompositeDefinition[], base: BlockRegistry): boolean {
    const legacy = (graph: WorkflowNode[], node: string, port: string) => {
        const n = graph.find(x => x.id === node);
        return !!(n && base.get(n.type)?.legacyInputs?.[port]);
    };
    return edges.some(e => legacy(nodes, e.target, e.targetPort))
        || defs.some(d => d.edges.some(e => legacy(d.nodes, e.target, e.targetPort))
            || d.inputs.some(i => i.targets.some(t => legacy(d.nodes, t.node, t.port))));
}

/** A workflow with every connection to a replaced input moved to the input for what it carries */
export function upgradeInputs(workflow: Workflow, base: BlockRegistry): Workflow {
    const defs = workflow.composites ?? [];
    if (!needsUpgrade(workflow.nodes, workflow.edges, defs, base)) return workflow;
    const splits: Splits = new Map();
    const composites = upgradeComposites(defs, base, splits);
    const upgraded: Workflow = { ...workflow, ...(workflow.composites ? { composites } : {}) };
    const registry = registryFor(upgraded, base);
    return {
        ...upgraded,
        edges: retargetEdges({ ...upgraded, nodes: workflow.nodes }, registry, splits),
        nodes: workflow.nodes.map(n => upgradeNode(n, registry)),
    };
}

/** Groups of the library, upgraded the same way */
export function upgradeLibrary(library: CompositeDefinition[], base: BlockRegistry): CompositeDefinition[] {
    if (!needsUpgrade([], [], library, base)) return library;
    return upgradeComposites(library, base, new Map());
}
