// executor.ts
// Runs a workflow: blocks in dependency order, with per-block states, cache, provenance and
// tagged items (§4.5, §4.6, §4.7, §4.10).

import { hashValue } from './hash';
import { BlockRegistry, paramsWithDefaults } from './registry';
import {
    buildLoopBody, expandComposites, foldComposite, foldReport, isCompositeType, LOOP_COLLECTED, LoopInputBlock,
    LOOP_INPUT_TYPE, outerId, registryFor,
} from './composite';
import { countRows } from './blocks/datasetUtils';
import { topologicalOrder, upstreamOf, validateWorkflow, ValidationIssue } from './validate';
import {
    BlockContext, BlockDefinition, CompositeDefinition, DataPayload, LogEntry, LogLevel, LoopIterationSummary,
    LoopSummary, NodeResult, Payload, PayloadBody, Provenance,
    TaggedItem, Workflow, WorkflowEnvironment, WorkflowNode, WorkflowRunReport, isSubtypeOf,
} from './types';

// ============================================================================
// CACHE
// ============================================================================

interface CacheEntry {
    outputs: Record<string, Payload>;
    tags: { tag: string; note?: string; payload: DataPayload }[];
}

/**
 * Results of computation blocks, keyed by block type and version, scientific parameters and
 * input provenance ids. In memory only; least recently used entries are dropped first.
 */
export class WorkflowCache {
    private readonly entries = new Map<string, CacheEntry>();

    constructor(private readonly maxEntries = 100) { }

    get(key: string): CacheEntry | undefined {
        const entry = this.entries.get(key);
        if (entry) {
            this.entries.delete(key);
            this.entries.set(key, entry);
        }
        return entry;
    }

    has(key: string): boolean {
        return this.entries.has(key);
    }

    set(key: string, entry: CacheEntry): void {
        this.entries.delete(key);
        this.entries.set(key, entry);
        while (this.entries.size > this.maxEntries) {
            this.entries.delete(this.entries.keys().next().value as string);
        }
    }

    clear(): void {
        this.entries.clear();
    }

    get size(): number {
        return this.entries.size;
    }
}

// ============================================================================
// RUN
// ============================================================================

export class WorkflowValidationError extends Error {
    constructor(public readonly issues: ValidationIssue[]) {
        super(`The workflow is not valid:\n${issues.map(i => `- ${i.message}`).join('\n')}`);
        this.name = 'WorkflowValidationError';
    }
}

export interface RunOptions {
    /** Results reused across runs. Without one, every block is computed. */
    cache?: WorkflowCache;
    /** "Run to here": only this block and what it depends on */
    targetNodeId?: string;
    /** Report of the previous run: kept for blocks outside `targetNodeId`, and for tagged items */
    previous?: WorkflowRunReport;
    /**
     * Compute nothing: report which blocks are up to date (cache hits) and which are stale.
     * Pass-through blocks (e.g. Add Tags) still run, as they only hand values over.
     */
    dryRun?: boolean;
    signal?: AbortSignal;
    onNodeUpdate?(nodeId: string, result: NodeResult): void;
    /** Internal (ForLoop bodies): values given to some blocks instead of running them */
    injected?: Record<string, Record<string, Payload>>;
    /** Internal (ForLoop bodies): the iteration being run, and the report of the previous one */
    loop?: { iteration: number; previous?: WorkflowRunReport };
}

/** The registry able to run loop bodies (with their input placeholders) */
const bodyRegistries = new WeakMap<BlockRegistry, BlockRegistry>();
function withLoopInput(registry: BlockRegistry): BlockRegistry {
    if (registry.has(LOOP_INPUT_TYPE)) return registry;
    let r = bodyRegistries.get(registry);
    if (!r) {
        r = new BlockRegistry();
        registry.list().forEach(b => r!.register(b));
        r.register(LoopInputBlock);
        bodyRegistries.set(registry, r);
    }
    return r;
}

const nodeName = (node: WorkflowNode, def?: BlockDefinition) => node.label || def?.title || node.type;

function describeUnavailable(node: WorkflowNode, def: BlockDefinition | undefined, result: NodeResult | undefined): string {
    const name = nodeName(node, def);
    switch (result?.status) {
        case 'error': return `${name} failed`;
        case 'inactive': return `${name} is switched off`;
        case 'blocked': return `${name} is blocked`;
        case 'stale': return `${name} is not up to date`;
        case 'idle': case undefined: return `${name} has not been run`;
        default: return `${name} produced no value on this output`;
    }
}

/**
 * Run a workflow. Composite blocks are expanded into their inner blocks first; the report has a
 * result for every top-level block (composites included, folded from their inner blocks) and for
 * every inner block (ids `composite/inner`).
 */
/**
 * Rows produced over all iterations of a loop, each with its `iteration` number. Rows of the same
 * Data-tab file are kept in one file; file-level stress axes are dropped (they differ by iteration).
 */
function collectIterations(values: DataPayload[]) {
    const byId = new Map<string, any>();
    values.forEach((payload, k) => {
        payload.files.forEach(file => {
            const { stressAxes, ...rest } = file as any;
            const rows = (file.content as any[]).map(row => ({ ...row, iteration: k + 1 }));
            const existing = byId.get(file.id);
            if (existing) existing.content = [...existing.content, ...rows];
            else byId.set(file.id, { ...rest, content: rows });
        });
    });
    return Array.from(byId.values());
}

export async function runWorkflow(
    workflow: Workflow,
    baseRegistry: BlockRegistry,
    env: WorkflowEnvironment,
    options: RunOptions = {}
): Promise<WorkflowRunReport> {
    const registry = registryFor(workflow, baseRegistry);
    const errors = validateWorkflow(workflow, registry).filter(i => i.severity === 'error');
    if (errors.length) throw new WorkflowValidationError(errors);
    if (!workflow.nodes.some(n => isCompositeType(n.type) && n.active)) {
        return runFlat(workflow, registry, env, options, options.targetNodeId ? [options.targetNodeId] : undefined);
    }

    const expansion = expandComposites(workflow);
    const innerErrors = validateWorkflow(expansion.workflow, registry).filter(i => i.severity === 'error');
    if (innerErrors.length) throw new WorkflowValidationError(innerErrors);

    const target = options.targetNodeId;
    const targets = target ? expansion.inner.get(target) ?? [target] : undefined;

    // Live updates: inner blocks as they are, and their composite folded again each time
    const live: Record<string, NodeResult> = {};
    const onNodeUpdate = options.onNodeUpdate && ((id: string, result: NodeResult) => {
        live[id] = result;
        options.onNodeUpdate!(id, result);
        const compositeId = outerId(id);
        const node = workflow.nodes.find(n => n.id === compositeId);
        if (compositeId !== id && node) {
            const folded = foldComposite(compositeId, expansion.definitions.get(node.type)!, live, expansion.dropped);
            if (folded) options.onNodeUpdate!(compositeId, folded);
        }
    });

    const report = await runFlat(expansion.workflow, registry, env, { ...options, onNodeUpdate }, targets);
    return foldReport(report, expansion, workflow);
}

async function runFlat(
    workflow: Workflow,
    registry: BlockRegistry,
    env: WorkflowEnvironment,
    options: RunOptions,
    targetNodeIds?: string[]
): Promise<WorkflowRunReport> {
    const { cache, previous, dryRun = false, signal, onNodeUpdate } = options;
    const startedAt = new Date().toISOString();
    const byId = new Map(workflow.nodes.map(n => [n.id, n]));
    const isReport = (id: string) => registry.get(byId.get(id)!.type)?.role === 'report';
    // Report blocks gather the tagged items of the whole run: they come last, and running "to"
    // a report block runs everything
    const sorted = topologicalOrder(workflow)!;
    const order = [...sorted.filter(id => !isReport(id)), ...sorted.filter(isReport)];
    const subset = targetNodeIds && !targetNodeIds.some(isReport)
        ? new Set(targetNodeIds.flatMap(id => Array.from(upstreamOf(workflow, id))))
        : null;

    const results: Record<string, NodeResult> = {};
    const tagged: TaggedItem[] = [];
    const taggedBy = new Set<string>();
    let cancelled = false;

    const emit = (id: string) => onNodeUpdate?.(id, { ...results[id] });

    // Tagged items not produced again keep their last value, flagged as outdated when their
    // block was part of this run and could not produce a fresh one (§4.10)
    let carriedOver = false;
    const carryOverTags = () => {
        if (carriedOver) return;
        carriedOver = true;
        previous?.tagged.forEach(item => {
            const owner = byId.has(item.nodeId) ? item.nodeId : outerId(item.nodeId);
            if (!byId.has(owner) || taggedBy.has(item.nodeId) || taggedBy.has(owner)) return;
            const attempted = !subset || subset.has(owner);
            tagged.push({ ...item, outdated: attempted ? true : item.outdated });
        });
    };

    // Provenance of values produced inside loop iterations (not kept as block results)
    const loopProvenance = new Map<string, Provenance>();
    const provenanceOf = (id: string) => {
        if (loopProvenance.has(id)) return loopProvenance.get(id);
        const all = [
            ...Object.values(results), ...Object.values(previous?.nodes ?? {}),
        ].flatMap(r => Object.values(r.outputs));
        return [...all, ...tagged.map(t => t.payload)].find(p => p.provenance.id === id)?.provenance;
    };

    /**
     * ForLoop (§12.1): run the body again and again, each iteration receiving on the carried input
     * what the previous one produced on the carried output, until an ExitLoop asks to stop, the
     * carried value is empty, or the maximum number of iterations is reached.
     */
    const runLoop = async (id: string, node: WorkflowNode, def: BlockDefinition, loopDef: CompositeDefinition, result: NodeResult) => {
        const params = paramsWithDefaults(def, node, 'scientific');
        const cfg = loopDef.loop!;
        const connected = new Set(Object.keys(result.inputs).filter(p => result.inputs[p].length > 0));
        const { workflow: body, inputNodes } = buildLoopBody(loopDef, node, connected);
        const bodyRegistry = withLoopInput(registry);
        const carriedOut = loopDef.outputs.find(o => o.id === cfg.carriedOutput)!;
        const collectOut = params.collect && params.collect !== 'none' ? loopDef.outputs.find(o => o.id === params.collect) : undefined;
        const maxIterations = Math.max(1, Math.round(Number(params.maxIterations) || 1));
        const nameIn = (inner: string) => {
            const n = loopDef.nodes.find(x => x.id === inner);
            return n ? n.label || registry.get(n.type)?.title || n.type : inner;
        };

        const inputIds = Object.fromEntries(Object.entries(result.inputs).map(([p, v]) => [p, v.map(x => x.provenance.id)]));
        result.key = hashValue({ type: def.type, version: def.version, params, inputs: inputIds });

        let carried = result.inputs[cfg.carriedInput]?.[0];
        const iterations: LoopIterationSummary[] = [];
        const collected: DataPayload[] = [];
        let last: WorkflowRunReport | undefined;
        let stoppedBy: LoopSummary['stoppedBy'] = 'max';
        const t0 = Date.now();
        const startedAtLoop = new Date().toISOString();
        if (!dryRun) { result.status = 'running'; emit(id); }

        for (let it = 1; it <= maxIterations; it++) {
            if (signal?.aborted) { stoppedBy = 'cancelled'; break; }
            if (!carried || countRows(carried.files) === 0) { stoppedBy = 'empty'; break; }

            const injected: Record<string, Record<string, Payload>> = {};
            inputNodes.forEach((nodeId, inputId) => {
                const value = inputId === cfg.carriedInput ? carried : result.inputs[inputId]?.[0];
                if (value) injected[nodeId] = { out: value };
            });
            const report = await runWorkflow(body, bodyRegistry, env, {
                cache, dryRun, signal, injected,
                loop: { iteration: it, previous: last },
                onNodeUpdate: (inner, r) => {
                    if (dryRun || r.status !== 'running') return;
                    result.progress = (it - 1 + (r.progress ?? 0)) / maxIterations;
                    result.progressMessage = `Iteration ${it}: ${nameIn(inner)}${r.progressMessage ? ` — ${r.progressMessage}` : ''}`;
                    emit(id);
                },
            });
            last = report;
            // Keep every iteration's provenance, so lineages can go through the iterations
            Object.values(report.nodes).forEach(r => Object.values(r.outputs).forEach(p => loopProvenance.set(p.provenance.id, p.provenance)));
            report.tagged.forEach(t => loopProvenance.set(t.payload.provenance.id, t.payload.provenance));

            const failed = Object.entries(report.nodes).find(([, r]) => r.status === 'error');
            if (failed) throw new Error(`Iteration ${it}: ${nameIn(failed[0])}: ${failed[1].error}`);
            if (dryRun && Object.values(report.nodes).some(r => r.status === 'stale' || r.status === 'idle')) {
                // Not everything is in the cache: the loop has to run again
                result.status = previous?.nodes[id]?.key !== undefined ? 'stale' : 'idle';
                return;
            }

            // Tags of every iteration are kept, marked with their iteration
            report.tagged.filter(t => !t.outdated).forEach(t => {
                const inner = `${id}/${t.nodeId}`;
                tagged.push({ ...t, nodeId: inner, iteration: it });
                taggedBy.add(inner);
                taggedBy.add(id);
            });

            const next = report.nodes[carriedOut.source.node]?.outputs[carriedOut.source.port];
            // First inversion computed in this iteration (not the carried value received)
            const inversion = Object.entries(report.nodes)
                .filter(([inner]) => !inner.startsWith('__in-'))
                .flatMap(([, r]) => Object.values(r.outputs))
                .find((p): p is Extract<Payload, { type: 'InversionResult' }> => p.type === 'InversionResult');
            iterations.push({
                iteration: it,
                rowsIn: countRows(carried.files),
                rowsOut: next && next.type !== 'Report' ? countRows(next.files) : undefined,
                misfit: inversion ? (inversion.solution.misfitCriterion === 'DOT' ? inversion.solution.misfit : inversion.solution.misfit * 180) : undefined,
                misfitCriterion: inversion?.solution.misfitCriterion,
                stressRatio: inversion?.solution.stressRatio,
            });
            if (collectOut) {
                const c = report.nodes[collectOut.source.node]?.outputs[collectOut.source.port];
                if (c && c.type !== 'Report') collected.push(c);
            }

            if (Object.values(report.nodes).some(r => r.exitLoop)) { stoppedBy = 'exit'; break; }
            if (!next || next.type === 'Report') { stoppedBy = 'no-value'; break; }
            carried = next;
        }

        if (last) {
            const final = last;
            loopDef.outputs.forEach(o => {
                const p = final.nodes[o.source.node]?.outputs[o.source.port];
                if (p) result.outputs[o.id] = p;
            });
            // Inner results of the last iteration, for the views inside the loop
            Object.entries(final.nodes).forEach(([inner, r]) => {
                if (!inner.startsWith('__in-')) results[`${id}/${inner}`] = r;
            });
        }
        if (collected.length) {
            result.outputs[LOOP_COLLECTED] = {
                type: 'Dataset',
                files: collectIterations(collected),
                provenance: {
                    id: hashValue([result.key, LOOP_COLLECTED, collected.map(c => c.provenance.id)]),
                    blockId: id,
                    blockType: def.type,
                    blockVersion: def.version,
                    scientificParams: params,
                    inputs: collected.map(c => c.provenance.id),
                    stressLibVersion: env.stressLibVersion,
                    appVersion: env.appVersion,
                    startedAt: startedAtLoop,
                    durationMs: Date.now() - t0,
                },
            };
        }
        result.loop = { iterations, stoppedBy };
        result.status = 'done';
        result.durationMs = Date.now() - t0;
        result.progress = undefined;
        result.progressMessage = undefined;
        result.logs.push({
            level: 'info',
            time: new Date().toISOString(),
            message: `${iterations.length} iteration(s), stopped ${({
                exit: 'by ExitLoop', max: 'at the maximum number of iterations', empty: 'because no data were left',
                'no-value': 'because the carried output produced nothing', cancelled: 'by cancellation',
            } as const)[stoppedBy]}`,
        });
    };

    for (const id of order) {
        if (subset && !subset.has(id)) continue;
        if (signal?.aborted) { cancelled = true; break; }

        const node = byId.get(id)!;
        const def = registry.get(node.type)!;
        if (def.role === 'report') carryOverTags();
        const result: NodeResult = { status: 'idle', inputs: {}, outputs: {}, logs: [] };
        results[id] = result;

        const injected = options.injected?.[id];
        if (injected) {
            result.status = 'done';
            result.outputs = { ...injected };
            emit(id);
            continue;
        }

        // ---- Inputs --------------------------------------------------------------------
        let unavailable: string | undefined;
        let skipped = false;
        const upstreamStatuses = new Set<string>();
        for (const port of def.inputs) {
            const edges = workflow.edges.filter(e => e.target === id && e.targetPort === port.id);
            if (edges.length === 0) {
                if (!port.optional) unavailable ??= `Input "${port.label}" is not connected`;
                continue;
            }
            const values: DataPayload[] = [];
            let skippedEdges = 0;
            for (const edge of edges) {
                const source = results[edge.source];
                const payload = source?.outputs[edge.sourcePort];
                // A branch not taken (§12.4): skipped, not an error
                if (!payload && source && (source.status === 'skipped' || source.skippedPorts?.includes(edge.sourcePort))) {
                    skippedEdges++;
                } else if (!payload) {
                    upstreamStatuses.add(source?.status ?? 'idle');
                    const sourceNode = byId.get(edge.source)!;
                    unavailable ??= describeUnavailable(sourceNode, registry.get(sourceNode.type), source);
                } else if (payload.type === 'Report' || (port.type !== 'any' && !isSubtypeOf(payload.type, port.type))) {
                    unavailable ??= `Input "${port.label}" received ${payload.type}, expects ${port.type}`;
                } else {
                    values.push(payload);
                }
            }
            result.inputs[port.id] = values;
            // Several inputs (Aggregate, Dashboard) use the branches that produced something
            if (skippedEdges > 0 && values.length === 0) skipped = true;
        }

        // ---- Inactive (§4.5) -------------------------------------------------------------
        if (!node.active) {
            result.status = 'inactive';
            const passed = def.bypass && !unavailable ? result.inputs[def.bypass.from]?.[0] : undefined;
            if (def.bypass && passed) {
                result.outputs[def.bypass.to] = passed;
                result.bypassed = true;
            }
            emit(id);
            continue;
        }

        if (skipped) {
            result.status = 'skipped';
            result.reason = 'On a branch not taken';
            emit(id);
            continue;
        }

        if (unavailable) {
            // In a plan, a block waiting on a stale or never-run block is itself stale / not run
            result.status = upstreamStatuses.has('idle') && dryRun ? 'idle'
                : upstreamStatuses.has('stale') ? 'stale'
                : 'blocked';
            result.reason = unavailable;
            emit(id);
            continue;
        }

        // ---- Views: nothing to compute, the UI renders their inputs ----------------------
        if (def.role === 'view') {
            result.status = 'done';
            emit(id);
            continue;
        }

        const loopDef = workflow.composites?.find(c => c.type === node.type && c.loop);
        if (loopDef) {
            try {
                await runLoop(id, node, def, loopDef, result);
            } catch (error) {
                result.status = 'error';
                result.error = error instanceof Error ? error.message : String(error);
            }
            emit(id);
            if (signal?.aborted) { cancelled = true; break; }
            continue;
        }

        if (!def.execute) {
            result.status = 'error';
            result.error = `${def.title} cannot be executed`;
            emit(id);
            continue;
        }

        // ---- Computation -----------------------------------------------------------------
        let params = paramsWithDefaults(def, node, 'scientific');
        if (def.normalizeParams) params = def.normalizeParams(params);

        const inputIds = Object.fromEntries(
            Object.entries(result.inputs).map(([port, values]) => [port, values.map(v => v.provenance.id)])
        );
        const key = hashValue({
            type: def.type,
            version: def.version,
            params,
            inputs: inputIds,
            extra: def.cacheKeyExtra?.(params, env),
        });
        result.key = key;

        const localTags: CacheEntry['tags'] = [];
        const pushTag = (tag: string, note: string | undefined, payload: DataPayload) => {
            localTags.push({ tag, note, payload });
            tagged.push({ tag, note, nodeId: id, payload, outdated: false });
            taggedBy.add(id);
        };

        // Reports are cheap and depend on the whole run: never cached
        const cacheable = !def.passThrough && def.role !== 'report';
        if (def.role === 'report' && dryRun) {
            result.status = previous?.nodes[id]?.key !== undefined ? 'stale' : 'idle';
            emit(id);
            continue;
        }
        if (cacheable) {
            const hit = cache?.get(key);
            if (hit) {
                result.outputs = { ...hit.outputs };
                result.cached = true;
                result.status = 'done';
                hit.tags.forEach(t => pushTag(t.tag, t.note, t.payload));
                emit(id);
                continue;
            }
            if (dryRun) {
                result.status = previous?.nodes[id]?.key !== undefined ? 'stale' : 'idle';
                emit(id);
                continue;
            }
        }

        const log = (level: LogLevel, message: string, details?: string) => {
            const entry: LogEntry = { level, message, details, time: new Date().toISOString() };
            result.logs.push(entry);
        };
        const ctx: BlockContext = {
            nodeId: id,
            params,
            inputs: result.inputs,
            env,
            signal,
            log,
            progress: (fraction, message) => {
                result.progress = fraction;
                result.progressMessage = message;
                emit(id);
            },
            tag: (tag, note, payload) => pushTag(tag, note, payload),
            workflow,
            tagged: [...tagged],
            provenance: provenanceOf,
            loop: options.loop ? {
                iteration: options.loop.iteration,
                previousInput: port => options.loop!.previous?.nodes[id]?.inputs[port]?.[0],
            } : undefined,
        };

        result.status = 'running';
        emit(id);
        const t0 = Date.now();
        const runStartedAt = new Date().toISOString();
        try {
            const out = await def.execute(ctx);
            const durationMs = Date.now() - t0;
            result.durationMs = durationMs;
            if (out.skip?.length) result.skippedPorts = out.skip;
            if (out.exitLoop) result.exitLoop = true;

            for (const [port, body] of Object.entries(out.outputs)) {
                if (def.passThrough) {
                    // Handed over unchanged: keeps the provenance of the value received
                    result.outputs[port] = body as Payload;
                    continue;
                }
                const provenance: Provenance = {
                    id: hashValue([key, port]),
                    blockId: id,
                    blockType: def.type,
                    blockVersion: def.version,
                    scientificParams: params,
                    inputs: out.provenanceInputs ?? Object.values(inputIds).flat(),
                    sourceFiles: out.sourceFiles,
                    stressLibVersion: env.stressLibVersion,
                    appVersion: env.appVersion,
                    startedAt: runStartedAt,
                    durationMs,
                };
                result.outputs[port] = { ...(body as PayloadBody), provenance } as Payload;
            }
            if (cacheable) cache?.set(key, { outputs: { ...result.outputs }, tags: localTags });
            result.status = 'done';
            result.progress = undefined;
            result.progressMessage = undefined;
        } catch (error) {
            result.status = 'error';
            result.error = error instanceof Error ? error.message : String(error);
            log('error', result.error);
        }
        emit(id);
        if (signal?.aborted) { cancelled = true; break; }
    }

    // Blocks outside a "run to here" keep their previous result
    if (previous) {
        Object.entries(previous.nodes).forEach(([id, r]) => {
            if (!results[id] && byId.has(id)) results[id] = r;
        });
    }

    carryOverTags();

    return {
        nodes: results,
        tagged,
        startedAt,
        finishedAt: new Date().toISOString(),
        cancelled,
        dryRun,
    };
}

/** Which blocks are up to date, without computing anything (a dry run) */
export function planWorkflow(
    workflow: Workflow,
    registry: BlockRegistry,
    env: WorkflowEnvironment,
    cache: WorkflowCache,
    previous?: WorkflowRunReport
): Promise<WorkflowRunReport> {
    return runWorkflow(workflow, registry, env, { cache, previous, dryRun: true });
}
