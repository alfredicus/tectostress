// WorkflowTab.tsx
// The Workflow tab (doc/workflow-spec.md): build a graph of blocks, run it, inspect the results.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ReactFlow, ReactFlowProvider, Background, Controls, useReactFlow, useNodesInitialized,
    Connection, Edge, EdgeChange, NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AlertTriangle, Boxes, ChevronRight, Download, LogIn, Eraser, FilePlus, Repeat, FolderOpen, Play, Printer, Save, SkipForward, Square, Tag, Trash2, Ungroup, X } from 'lucide-react';
import appPackage from '../../../package.json';
import stressPackage from '@alfredo-taboada/stress/package.json';
import { DataFile } from '../DataFile';
import {
    canConnect, createDefaultRegistry, createNode, fileRef, instantiateTemplate, parseWorkflow,
    planWorkflow, PREDEFINED_WORKFLOWS, Provenance, resolveOutputType, runWorkflow, serializeWorkflow,
    validateWorkflow, Workflow, WorkflowCache, WorkflowEnvironment, WorkflowNode, WorkflowRunReport,
    WORKFLOW_SCHEMA_VERSION, BlockDefinition, NodeResult, paramsWithDefaults, ReportPayload,
    registryFor, groupAsComposite, ungroupComposite, isCompositeType, outerId, CompositeDefinition, InnerParams,
    innerPresentation, BlockRegistry, makeLoop, loopOptions, LOOP_COLLECTED, compositeWithDependencies,
} from '../../workflow';
import { hashValue } from '../../workflow/hash';
import BlockNode, { BlockFlowNode, PortFlowNode, PortNode, STATUS_STYLE } from './BlockNode';
import ParamEditor from './ParamEditor';
import { PayloadSummary, ViewRenderer } from './WorkflowViews';
import { buildReportHtml } from './reportHtml';

const STORAGE_KEY = 'tectostress-workflow';
const LIBRARY_KEY = 'tectostress-workflow-library';
const DRAG_TYPE = 'application/tectostress-block';
const CATEGORY_ORDER = ['Sources', 'Processing', 'Control', 'My blocks', 'Report', 'Views'];
const EDGE_COLOR: Record<string, string> = { Dataset: '#0ea5e9', InversionResult: '#6366f1' };

const nodeTypes = { block: BlockNode, port: PortNode };

const uid = () => Math.random().toString(36).slice(2, 8);

const emptyWorkflow = (): Workflow => ({ schemaVersion: WORKFLOW_SCHEMA_VERSION, name: 'New workflow', nodes: [], edges: [] });

function loadStoredWorkflow(registry: ReturnType<typeof createDefaultRegistry>): Workflow {
    try {
        const json = localStorage.getItem(STORAGE_KEY);
        if (json) return parseWorkflow(json, registry).workflow;
    } catch { /* unreadable or blocked storage: start empty */ }
    return emptyWorkflow();
}

/**
 * A new group in the library, with the groups it contains (§13.2), so it can be reused even after
 * they are removed from the workflow
 */
function addToLibrary(library: CompositeDefinition[], def: CompositeDefinition, pool: CompositeDefinition[]): CompositeDefinition[] {
    const deps = compositeWithDependencies(def.type, [def, ...pool]).filter(d => d.type !== def.type);
    return [
        ...library.filter(c => c.type !== def.type),
        ...deps.filter(d => !library.some(c => c.type === d.type)),
        def,
    ];
}

/** Groups saved in this browser, offered in the palette (§11.3) */
function loadLibrary(): CompositeDefinition[] {
    try {
        const json = localStorage.getItem(LIBRARY_KEY);
        const list = json ? JSON.parse(json) : [];
        return Array.isArray(list) ? list.filter(c => c && typeof c.type === 'string' && isCompositeType(c.type)) : [];
    } catch {
        return [];
    }
}

/**
 * A plan only knows what the cache knows. Keep the details of the last real run (errors, logs,
 * durations) for the blocks whose cache key has not changed since.
 */
function withRunDetails(plan: WorkflowRunReport, lastRun?: WorkflowRunReport): WorkflowRunReport {
    if (!lastRun) return plan;
    const nodes: Record<string, NodeResult> = { ...plan.nodes };
    Object.entries(plan.nodes).forEach(([id, planned]) => {
        const ran = lastRun.nodes[id];
        if (!ran || ran.key === undefined || ran.key !== planned.key) return;
        nodes[id] = ran.status === 'error' ? ran : { ...planned, logs: ran.logs, durationMs: ran.durationMs };
    });
    return { ...plan, nodes };
}

// ---- Opened groups (§13.1) -------------------------------------------------------------------

/** An inner block as its group runs it: with the parameters stored on the group node */
function effectiveInner(group: WorkflowNode, inner: WorkflowNode): WorkflowNode {
    return {
        ...inner,
        scientificParams: (group.scientificParams?.inner as InnerParams | undefined)?.[inner.id] ?? inner.scientificParams,
        presentationParams: innerPresentation(group, inner),
    };
}

/** One opened level: the group node (as run), its definition and its id in run results */
interface OpenLevel {
    node: WorkflowNode;
    def: CompositeDefinition;
    /** Expanded id, e.g. `outer/inner`: inner results are stored under `${runId}/${innerId}` */
    runId: string;
}

/**
 * Follow a path of group ids from the top of the workflow. Each id is local to the level above.
 * Null if a group on the path no longer exists.
 */
function resolveOpenPath(workflow: Workflow, path: string[]): OpenLevel[] | null {
    const levels: OpenLevel[] = [];
    let nodes = workflow.nodes;
    let parent: WorkflowNode | null = null;
    for (const id of path) {
        const raw = nodes.find(n => n.id === id);
        if (!raw) return null;
        const node: WorkflowNode = parent ? effectiveInner(parent, raw) : raw;
        const def = workflow.composites?.find(c => c.type === node.type);
        if (!def) return null;
        const runId = levels.length ? `${levels[levels.length - 1].runId}/${id}` : id;
        levels.push({ node, def, runId });
        nodes = def.nodes;
        parent = node;
    }
    return levels;
}

/**
 * A group node with new parameters for one of its inner blocks, possibly several levels down
 * (`rest` = ids of the groups between this node and the inner block). Parameters live on the
 * top-level group node, nested under `inner`, as the engine reads them.
 */
function withInnerParams(
    node: WorkflowNode, rest: string[], innerLocalId: string,
    scope: 'scientific' | 'presentation', values: Record<string, any>, composites: CompositeDefinition[]
): WorkflowNode {
    const key = scope === 'scientific' ? 'scientificParams' : 'presentationParams';
    const set = (n: WorkflowNode, id: string, v: Record<string, any>): WorkflowNode =>
        ({ ...n, [key]: { ...n[key], inner: { ...(n[key]?.inner ?? {}), [id]: v } } });
    if (rest.length === 0) return set(node, innerLocalId, values);
    const def = composites.find(c => c.type === node.type);
    const raw = def?.nodes.find(n => n.id === rest[0]);
    if (!raw) return node;
    const child = withInnerParams(effectiveInner(node, raw), rest.slice(1), innerLocalId, scope, values, composites);
    return set(node, rest[0], child[key]);
}

/** Scientific then display parameters of a block, each edited in place */
function BlockParams({ def, node, files, onChange }: {
    def: BlockDefinition; node: WorkflowNode; files: DataFile[];
    onChange: (scope: 'scientific' | 'presentation', key: string, value: any, current: Record<string, any>) => void;
}) {
    const scientific = paramsWithDefaults(def, node, 'scientific');
    const presentation = paramsWithDefaults(def, node, 'presentation');
    const sciParams = def.params.filter(p => p.scope === 'scientific' && p.kind !== 'object');
    const presParams = def.params.filter(p => p.scope === 'presentation' && p.kind !== 'object');
    return (
        <>
            {sciParams.length === 0 && presParams.length === 0 && <div className="text-xs text-gray-400">No parameter</div>}
            {sciParams.map(p => (
                <div key={p.key}>
                    <div className="text-xs text-gray-600 mb-0.5" title={p.help}>{p.label}</div>
                    <ParamEditor param={p} value={scientific[p.key]} siblings={scientific} files={files}
                        onChange={v => onChange('scientific', p.key, v, scientific)} />
                    {p.help && <div className="text-[11px] text-gray-400 mt-0.5">{p.help}</div>}
                </div>
            ))}
            {presParams.length > 0 && <div className="text-xs font-medium text-gray-700 pt-1 border-t">Display</div>}
            {presParams.map(p => (
                <div key={p.key}>
                    <div className="text-xs text-gray-600 mb-0.5">{p.label}</div>
                    <ParamEditor param={p} value={presentation[p.key]} siblings={presentation} files={files}
                        onChange={v => onChange('presentation', p.key, v, presentation)} />
                </div>
            ))}
        </>
    );
}

function ProvenanceDetails({ provenance }: { provenance: Provenance }) {
    return (
        <details className="text-xs text-gray-600">
            <summary className="cursor-pointer select-none">Provenance</summary>
            <div className="mt-1 space-y-0.5 pl-2 border-l">
                <div>Produced by <b>{provenance.blockType}</b> (v{provenance.blockVersion}), block “{provenance.blockId}”</div>
                <div>At {new Date(provenance.startedAt).toLocaleString()} in {provenance.durationMs} ms</div>
                {provenance.sourceFiles && (
                    <div>Files: {provenance.sourceFiles.map(f => `${f.name} (${f.rowCount} rows, #${f.contentHash.slice(0, 8)})`).join(', ')}</div>
                )}
                {Object.keys(provenance.scientificParams).length > 0 && (
                    <pre className="bg-gray-50 rounded p-1 overflow-x-auto">{JSON.stringify(provenance.scientificParams, (k, v) =>
                        k === 'files' && Array.isArray(v) ? v.map((f: any) => f.name) : v, 2)}</pre>
                )}
                <div>From: {provenance.inputs.length ? provenance.inputs.map(i => `#${i.slice(0, 8)}`).join(', ') : '—'}</div>
                <div>Id #{provenance.id.slice(0, 8)} · TectoStress {provenance.appVersion} · stress library {provenance.stressLibVersion}</div>
            </div>
        </details>
    );
}

/** What a view block shows: its visualization(s) for each payload it receives */
function ViewNodeResult({ node, def, result, registry }: {
    node: WorkflowNode; def: BlockDefinition; result: NodeResult; registry: BlockRegistry;
}) {
    const inputs = result.inputs.in ?? [];
    const views: string[] = node.type === 'view.dashboard'
        ? paramsWithDefaults(def, node, 'presentation').views
        : [node.type];
    return (
        <div className="space-y-6">
            {inputs.map((payload, i) => (
                <div key={`${payload.provenance.id}-${i}`} className="space-y-4">
                    {inputs.length > 1 && <div className="text-sm font-medium">Input {i + 1}</div>}
                    {views.map(v => (
                        <div key={v}>
                            {views.length > 1 && <h4 className="font-semibold text-indigo-800 mb-2">{registry.get(v)?.title}</h4>}
                            <ViewRenderer viewType={v} payload={payload} registry={registry} />
                        </div>
                    ))}
                    <ProvenanceDetails provenance={payload.provenance} />
                </div>
            ))}
        </div>
    );
}

/** Preview of a generated report, with download and print (PDF) */
function ReportPanel({ payload, labelOf }: { payload: ReportPayload; labelOf: (blockId: string) => string }) {
    const [html, setHtml] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        let cancelled = false;
        setHtml(null);
        setError(null);
        buildReportHtml(payload.document, labelOf)
            .then(h => { if (!cancelled) setHtml(h); })
            .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [payload.provenance.id]);

    const download = () => {
        if (!html) return;
        const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `${payload.document.title.replace(/[^\w-]+/g, '_') || 'report'}.html`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const button = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm bg-white hover:bg-gray-50 disabled:opacity-40';
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <span className="text-sm">
                    <b>{payload.document.title}</b> · {payload.document.items.length} item(s)
                    {payload.document.warnings.length > 0 && <span className="text-amber-700"> · {payload.document.warnings.length} warning(s)</span>}
                </span>
                <div className="flex-1" />
                <button className={button} onClick={download} disabled={!html}><Download className="w-4 h-4" /> Download HTML</button>
                <button className={button} onClick={() => iframeRef.current?.contentWindow?.print()} disabled={!html}
                    title="Opens the print dialog: choose “Save as PDF” to get a PDF">
                    <Printer className="w-4 h-4" /> Print / Save as PDF
                </button>
            </div>
            {error && <p className="text-sm text-red-700">Could not build the report: {error}</p>}
            {!html && !error && <p className="text-sm text-gray-500">Building the report…</p>}
            {html && <iframe ref={iframeRef} srcDoc={html} title="Report preview" className="w-full border rounded" style={{ height: 800 }} />}
        </div>
    );
}

interface Props {
    files: DataFile[];
}

const WorkflowEditor: React.FC<Props> = ({ files }) => {
    const baseRegistry = useMemo(createDefaultRegistry, []);
    const [library, setLibrary] = useState<CompositeDefinition[]>(loadLibrary);
    const env = useMemo<WorkflowEnvironment>(() => ({
        files,
        appVersion: appPackage.version,
        stressLibVersion: stressPackage.version,
    }), [files]);

    const [workflow, setWorkflow] = useState<Workflow>(() => loadStoredWorkflow(baseRegistry));
    // Block types available: the built-in ones, the groups of this workflow and of the library
    const registry = useMemo(() => registryFor(workflow, baseRegistry, library),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [workflow.composites, library, baseRegistry]);
    const [groupName, setGroupName] = useState('');
    const [report, setReport] = useState<WorkflowRunReport | null>(null);
    const [running, setRunning] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;
    const selectOnly = useCallback((id: string | null) => setSelectedIds(id ? [id] : []), []);
    // Selection as rendered, for modifier clicks (see onNodeClick)
    const selectionRef = useRef<string[]>([]);
    selectionRef.current = selectedIds;
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
    const [bottomTab, setBottomTab] = useState<'result' | 'tagged'>('result');
    const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
    const [pendingReplace, setPendingReplace] = useState<{ workflow: Workflow; label: string } | null>(null);

    // Groups opened to look inside (§13.1): ids from the top, each local to the level above.
    // Inside, the structure is read-only; inner blocks are selected with their own (local) id.
    const [openPath, setOpenPath] = useState<string[]>([]);
    const [innerSelectedId, setInnerSelectedId] = useState<string | null>(null);
    const openLevels = useMemo(() => resolveOpenPath(workflow, openPath), [workflow, openPath]);
    const opened = openLevels && openLevels.length ? openLevels[openLevels.length - 1] : null;
    const canvasNodeCount = opened ? opened.def.nodes.length : workflow.nodes.length;

    const cacheRef = useRef(new WorkflowCache());
    // Bumped when the cache is cleared, so the plan is refreshed
    const [cacheVersion, setCacheVersion] = useState(0);
    const lastRunRef = useRef<WorkflowRunReport | undefined>(undefined);
    const runningRef = useRef(false);
    const abortRef = useRef<AbortController | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { screenToFlowPosition, fitView } = useReactFlow();

    const canvasRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = canvasRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        let visible = false;
        const observer = new ResizeObserver(([entry]) => {
            const nowVisible = entry.contentRect.width > 0 && entry.contentRect.height > 0;
            if (nowVisible && !visible) setTimeout(() => fitView({ padding: 0.2 }), 0);
            visible = nowVisible;
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, [fitView]);

    const issues = useMemo(() => validateWorkflow(workflow, registry), [workflow, registry]);
    const errors = issues.filter(i => i.severity === 'error');
    const results = report?.nodes ?? {};

    // ---- Persistence of the graph (not of results, §4.8) ---------------------------------
    useEffect(() => {
        const t = setTimeout(() => {
            try { localStorage.setItem(STORAGE_KEY, serializeWorkflow(workflow)); } catch { /* storage unavailable */ }
        }, 300);
        return () => clearTimeout(t);
    }, [workflow]);

    useEffect(() => {
        try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(library)); } catch { /* storage unavailable */ }
    }, [library]);

    // ---- Plan: show which blocks are up to date whenever something scientific changes ---
    const signature = useMemo(() => hashValue({
        nodes: workflow.nodes.map(n => [n.id, n.type, n.active, n.scientificParams]),
        edges: workflow.edges.map(e => [e.source, e.sourcePort, e.target, e.targetPort]),
    }), [workflow]);

    useEffect(() => {
        if (errors.length) return;
        let cancelled = false;
        const t = setTimeout(async () => {
            if (runningRef.current) return;
            try {
                const plan = await planWorkflow(workflow, registry, env, cacheRef.current, lastRunRef.current);
                if (!cancelled && !runningRef.current) setReport(withRunDetails(plan, lastRunRef.current));
            } catch { /* invalid graph: issues are shown instead */ }
        }, 250);
        return () => { cancelled = true; clearTimeout(t); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [signature, env, errors.length, cacheVersion]);

    // ---- Graph editing -------------------------------------------------------------------
    const updateNode = useCallback((id: string, update: (n: WorkflowNode) => WorkflowNode) => {
        setWorkflow(wf => ({ ...wf, nodes: wf.nodes.map(n => n.id === id ? update(n) : n) }));
    }, []);

    const removeNodes = useCallback((ids: string[]) => {
        setWorkflow(wf => ({
            ...wf,
            nodes: wf.nodes.filter(n => !ids.includes(n.id)),
            edges: wf.edges.filter(e => !ids.includes(e.source) && !ids.includes(e.target)),
        }));
        setSelectedIds(s => s.filter(x => !ids.includes(x)));
    }, []);

    const addBlock = useCallback((type: string, position?: { x: number; y: number }) => {
        const def = registry.get(type);
        if (!def) return;
        const pos = position ?? {
            x: workflow.nodes.length ? Math.max(...workflow.nodes.map(n => n.position.x)) + 220 : 40,
            y: 80,
        };
        const id = `${type.replace(/\W+/g, '-')}-${uid()}`;
        const node = createNode(def, id, pos);
        // A new Data block starts with every file of the Data tab
        if (type === 'data') node.scientificParams.files = files.map(fileRef);
        // A group from the library travels with the workflow from now on, with the groups inside it
        const needed = isCompositeType(type)
            ? compositeWithDependencies(type, [...(workflow.composites ?? []), ...library])
                .filter(c => !workflow.composites?.some(w => w.type === c.type))
            : [];
        setWorkflow(wf => ({
            ...wf,
            nodes: [...wf.nodes, node],
            ...(needed.length ? { composites: [...(wf.composites ?? []), ...needed] } : {}),
        }));
        selectOnly(id);
        setSelectedEdgeId(null);
    }, [registry, files, workflow.nodes, workflow.composites, library]);

    const replaceWorkflow = useCallback((next: Workflow) => {
        setWorkflow(next);
        setReport(null);
        lastRunRef.current = undefined;
        selectOnly(null);
        setOpenPath([]);
        setInnerSelectedId(null);
        setPendingReplace(null);
        setMessage(null);
        fitPending.current = true;
    }, []);

    // Fit a newly opened workflow once its blocks have been measured (fitting earlier, before they
    // have a size, zooms out to a speck)
    const fitPending = useRef(false);
    const nodesInitialized = useNodesInitialized();
    useEffect(() => {
        if (fitPending.current && nodesInitialized && canvasNodeCount) {
            fitPending.current = false;
            fitView({ padding: 0.2 });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodesInitialized, canvasNodeCount, openPath, fitView]);

    /** Look inside a group or loop shown on the canvas (§13.1) */
    const openGroup = useCallback((id: string) => {
        setOpenPath(p => [...p, id]);
        setInnerSelectedId(null);
        setSelectedEdgeId(null);
        fitPending.current = true;
    }, []);

    /** Go back up to a level of the breadcrumb (0 = the workflow), selecting the group just left */
    const closeTo = useCallback((depth: number) => {
        setOpenPath(p => {
            if (depth >= p.length) return p;
            const left = p[depth];
            if (depth === 0) { selectOnly(left); setInnerSelectedId(null); } else setInnerSelectedId(left);
            return p.slice(0, depth);
        });
        setSelectedEdgeId(null);
        fitPending.current = true;
    }, [selectOnly]);

    // A group on the opened path disappeared (deleted, ungrouped…): back to the workflow
    useEffect(() => {
        if (openPath.length && !openLevels) { setOpenPath([]); setInnerSelectedId(null); }
    }, [openPath, openLevels]);

    // Esc goes up one level, unless typing in a field
    useEffect(() => {
        if (!openPath.length) return;
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            if (e.key !== 'Escape' || (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
            closeTo(openPath.length - 1);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [openPath.length, closeTo]);

    const askReplace = (next: Workflow, label: string) => {
        if (workflow.nodes.length === 0) replaceWorkflow(next);
        else setPendingReplace({ workflow: next, label });
    };

    // "Make a loop" (§12.1): what the selection allows, and the user's choices
    const [loopDraft, setLoopDraft] = useState<{ carriedOutput?: string; collect?: string; maxIterations: number }>({ maxIterations: 10 });
    const loopChoice = useMemo(() => {
        if (selectedIds.length < 2) return null;
        try { return { options: loopOptions(workflow, registry, selectedIds) }; }
        catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
    }, [workflow, registry, selectedIds]);

    const loopSelection = () => {
        if (!loopChoice || !('options' in loopChoice) || !loopChoice.options) return;
        const { carriedOutputs, collectable } = loopChoice.options;
        try {
            const r = makeLoop(workflow, registry, selectedIds, groupName || 'Loop', uid, {
                carriedOutput: loopDraft.carriedOutput ?? carriedOutputs[0].id,
                collect: loopDraft.collect ?? collectable[0]?.id ?? 'none',
                maxIterations: loopDraft.maxIterations,
            });
            setWorkflow(r.workflow);
            setLibrary(lib => addToLibrary(lib, r.definition, r.workflow.composites ?? []));
            selectOnly(r.nodeId);
            setGroupName('');
            setLoopDraft({ maxIterations: 10 });
        } catch (e) {
            setMessage({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
        }
    };

    const groupSelection = () => {
        try {
            const r = groupAsComposite(workflow, registry, selectedIds, groupName || 'My block', uid);
            setWorkflow(r.workflow);
            setLibrary(lib => addToLibrary(lib, r.definition, r.workflow.composites ?? []));
            selectOnly(r.nodeId);
            setGroupName('');
        } catch (e) {
            setMessage({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
        }
    };

    const ungroup = (id: string) => {
        try {
            setWorkflow(wf => ungroupComposite(wf, id, uid));
            selectOnly(null);
        } catch (e) {
            setMessage({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
        }
    };

    /** Display name of a block, including blocks inside a group (`group/inner`) */
    const labelOf = useCallback((id: string): string => {
        // `a/b/c`: block c inside group b inside group a, at any depth (§13.2)
        const names: string[] = [];
        let nodes: WorkflowNode[] = workflow.nodes;
        for (const part of id.split('/')) {
            const n = nodes.find(x => x.id === part);
            names.push(n ? n.label || registry.get(n.type)?.title || n.type : part);
            nodes = (n && workflow.composites?.find(c => c.type === n.type)?.nodes) ?? [];
        }
        return names.join(' › ');
    }, [workflow, registry]);

    /**
     * Is input `port` of the group opened at `depth` fed by something? By a block next to it, or by
     * an input of the group around it that is itself fed (groups inside groups, §13.2)
     */
    const inputFed = useCallback((depth: number, port: string): boolean => {
        const id = openPath[depth];
        if (depth === 0) return workflow.edges.some(e => e.target === id && e.targetPort === port);
        const parent = openLevels?.[depth - 1]?.def;
        if (!parent) return false;
        if (parent.edges.some(e => e.target === id && e.targetPort === port)) return true;
        return parent.inputs.some(i => i.targets.some(t => t.node === id && t.port === port) && inputFed(depth - 1, i.id));
    }, [openPath, openLevels, workflow.edges]);

    // ---- Inside an opened group: its blocks, its ports, read-only (§13.1) -------------------
    const innerView = useMemo(() => {
        if (!opened || !openLevels) return null;
        const { node: group, def, runId } = opened;
        const connected = new Set(def.inputs.filter(i => inputFed(openPath.length - 1, i.id)).map(i => i.id));
        const nameOf = (id: string) => {
            const n = def.nodes.find(x => x.id === id);
            return n ? n.label || registry.get(n.type)?.title || n.type : id;
        };
        // Inner Data blocks replaced by the data connected to the group
        const replaced = new Map(def.inputs.filter(i => i.replaces && connected.has(i.id)).map(i => [i.replaces!.node, i]));
        const blockDef = registry.get(group.type);

        const inner = def.nodes.map(raw => effectiveInner(group, raw));
        const xs = inner.map(n => n.position.x);
        const ys = inner.map(n => n.position.y);
        const minX = xs.length ? Math.min(...xs) : 0;
        const maxX = xs.length ? Math.max(...xs) : 0;
        const midY = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : 0;
        const column = (k: number, n: number) => midY + (k - (n - 1) / 2) * 90;

        const nodes: (BlockFlowNode | PortFlowNode)[] = inner.map(n => ({
            id: n.id,
            type: 'block' as const,
            position: n.position,
            selected: innerSelectedId === n.id,
            draggable: false,
            data: {
                node: n,
                def: registry.get(n.type),
                result: results[`${runId}/${n.id}`],
                note: replaced.has(n.id)
                    ? `Not used: replaced by “${replaced.get(n.id)!.label}”`
                    : isCompositeType(n.type) ? 'Double-click to open' : undefined,
            },
        }));
        const edges: Edge[] = [];
        const edgeStyle = (type: string, dim = false) => ({
            stroke: EDGE_COLOR[type] ?? '#94a3b8', strokeWidth: 2, ...(dim ? { strokeDasharray: '4 4', opacity: 0.4 } : {}),
        });
        const innerWorkflow: Workflow = { ...workflow, nodes: inner, edges: def.edges };
        const typeOf = (node: string, port: string) => {
            try { return resolveOutputType(innerWorkflow, registry, node, port); } catch { return 'any'; }
        };

        // Inputs on the left. An input left unconnected outside feeds nothing.
        def.inputs.forEach((input, k) => {
            const isConnected = connected.has(input.id);
            const note = def.loop?.carriedInput === input.id ? '↺ from the 2nd iteration on: the previous iteration’s result'
                : input.replaces && !isConnected ? `Not connected: ${nameOf(input.replaces.node)} is used`
                : !isConnected ? 'Not connected'
                : undefined;
            nodes.push({
                id: `__in:${input.id}`, type: 'port', position: { x: minX - 320, y: column(k, def.inputs.length) },
                draggable: false, selectable: false,
                data: { side: 'in', label: input.label, type: input.type, optional: input.optional, note },
            });
            if (input.replaces && !isConnected) return;
            input.targets.forEach((t, j) => edges.push({
                id: `__in:${input.id}:${j}`, source: `__in:${input.id}`, sourceHandle: 'port', target: t.node, targetHandle: t.port,
                style: edgeStyle(input.type, !isConnected),
            }));
        });

        def.edges.forEach(e => edges.push({
            id: `__e:${e.id}`, source: e.source, sourceHandle: e.sourcePort, target: e.target, targetHandle: e.targetPort,
            selected: false, animated: results[`${runId}/${e.target}`]?.status === 'running',
            style: edgeStyle(typeOf(e.source, e.sourcePort), replaced.has(e.source)),
        }));

        // Outputs on the right, with the ForLoop's "All iterations" output
        const outs = (blockDef?.outputs ?? def.outputs).map(o => {
            if (o.id !== LOOP_COLLECTED) return { port: o, source: def.outputs.find(x => x.id === o.id)?.source, note: undefined as string | undefined };
            const collect = paramsWithDefaults(blockDef!, group, 'scientific').collect;
            const from = def.outputs.find(x => x.id === collect);
            return { port: o, source: from?.source, note: from ? `Gathers “${from.label}” over every iteration` : 'Nothing collected' };
        });
        outs.forEach(({ port, source, note }, k) => {
            nodes.push({
                id: `__out:${port.id}`, type: 'port', position: { x: maxX + 300, y: column(k, outs.length) },
                draggable: false, selectable: false,
                data: {
                    side: 'out', label: port.label, type: port.type,
                    note: note ?? (def.loop?.carriedOutput === port.id ? '↻ passed to the next iteration' : undefined),
                },
            });
            if (source) edges.push({
                id: `__out:${port.id}`, source: source.node, sourceHandle: source.port, target: `__out:${port.id}`, targetHandle: 'port',
                style: { ...edgeStyle(port.type), ...(port.id === LOOP_COLLECTED ? { strokeDasharray: '6 3' } : {}) },
            });
        });
        return { nodes, edges, replaced };
    }, [opened, openLevels, openPath, workflow, registry, results, innerSelectedId, inputFed]);

    // ---- React Flow wiring ---------------------------------------------------------------
    const rfNodes: BlockFlowNode[] = useMemo(() => workflow.nodes.map(n => ({
        id: n.id,
        type: 'block',
        position: n.position,
        selected: selectedIds.includes(n.id),
        data: { node: n, def: registry.get(n.type), result: results[n.id] },
    })), [workflow.nodes, results, selectedIds, registry]);

    const rfEdges: Edge[] = useMemo(() => workflow.edges.map(e => {
        const type = resolveOutputType(workflow, registry, e.source, e.sourcePort);
        const running = results[e.target]?.status === 'running';
        return {
            id: e.id,
            source: e.source,
            sourceHandle: e.sourcePort,
            target: e.target,
            targetHandle: e.targetPort,
            selected: e.id === selectedEdgeId,
            animated: running,
            style: { stroke: EDGE_COLOR[type] ?? '#94a3b8', strokeWidth: e.id === selectedEdgeId ? 3 : 2 },
        };
    }), [workflow, results, selectedEdgeId, registry]);

    // Inside a group only selection changes: nothing can be moved, deleted or connected
    const onInnerNodesChange = useCallback((changes: NodeChange[]) => {
        changes.forEach(c => {
            if (c.type !== 'select' || c.id.startsWith('__')) return;
            if (c.selected) setInnerSelectedId(c.id);
            else setInnerSelectedId(s => s === c.id ? null : s);
        });
    }, []);

    const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: { id: string; type?: string }) => {
        if (node.type !== 'block') return;
        const type = opened
            ? opened.def.nodes.find(n => n.id === node.id)?.type
            : workflow.nodes.find(n => n.id === node.id)?.type;
        if (type && isCompositeType(type)) openGroup(node.id);
    }, [opened, workflow.nodes, openGroup]);

    const onNodesChange = useCallback((changes: NodeChange<BlockFlowNode>[]) => {
        const removed: string[] = [];
        changes.forEach(c => {
            if (c.type === 'position' && c.position) {
                const pos = c.position;
                updateNode(c.id, n => ({ ...n, position: { x: pos.x, y: pos.y } }));
            } else if (c.type === 'remove') {
                removed.push(c.id);
            } else if (c.type === 'select') {
                if (c.selected) { setSelectedIds(s => s.includes(c.id) ? s : [...s, c.id]); setSelectedEdgeId(null); }
                else setSelectedIds(s => s.filter(x => x !== c.id));
            }
        });
        if (removed.length) removeNodes(removed);
    }, [updateNode, removeNodes]);

    // Cmd/Ctrl/Shift-click adds or removes a block from the selection. Read from the click event
    // itself: React Flow's own multi-selection key relies on key events, which some input methods
    // do not send. Runs after React Flow's selection changes, so it overrides them.
    const onNodeClick = useCallback((event: React.MouseEvent, node: { id: string }) => {
        if (!(event.metaKey || event.ctrlKey || event.shiftKey)) return;
        const before = selectionRef.current;
        setSelectedIds(before.includes(node.id) ? before.filter(x => x !== node.id) : [...before, node.id]);
        setSelectedEdgeId(null);
    }, []);

    const onEdgesChange = useCallback((changes: EdgeChange[]) => {
        const removed = changes.filter(c => c.type === 'remove').map(c => c.id);
        changes.forEach(c => {
            if (c.type === 'select') {
                if (c.selected) setSelectedEdgeId(c.id);
                else setSelectedEdgeId(s => s === c.id ? null : s);
            }
        });
        if (removed.length) setWorkflow(wf => ({ ...wf, edges: wf.edges.filter(e => !removed.includes(e.id)) }));
    }, []);

    const toCandidate = (c: Connection | Edge) => ({
        source: c.source, sourcePort: c.sourceHandle ?? '', target: c.target, targetPort: c.targetHandle ?? '',
    });

    const isValidConnection = useCallback((c: Connection | Edge) =>
        canConnect(workflow, registry, toCandidate(c)).ok, [workflow, registry]);

    const onConnect = useCallback((c: Connection) => {
        const candidate = toCandidate(c);
        const check = canConnect(workflow, registry, candidate);
        if (!check.ok) { setMessage({ kind: 'error', text: check.reason ?? 'Cannot connect these blocks' }); return; }
        setWorkflow(wf => ({ ...wf, edges: [...wf.edges, { id: `e-${uid()}`, ...candidate }] }));
    }, [workflow, registry]);

    const onDrop = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        const type = event.dataTransfer.getData(DRAG_TYPE);
        if (type) addBlock(type, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
    }, [addBlock, screenToFlowPosition]);

    // ---- Run -----------------------------------------------------------------------------
    const run = useCallback(async (targetNodeId?: string) => {
        if (errors.length || runningRef.current) return;
        const controller = new AbortController();
        abortRef.current = controller;
        runningRef.current = true;
        setRunning(true);
        setMessage(null);
        setBottomTab('result');
        try {
            const r = await runWorkflow(workflow, registry, env, {
                cache: cacheRef.current,
                previous: lastRunRef.current,
                targetNodeId,
                signal: controller.signal,
                onNodeUpdate: (id, result) => setReport(prev => prev
                    ? { ...prev, nodes: { ...prev.nodes, [id]: result } }
                    : { nodes: { [id]: result }, tagged: [], startedAt: '', finishedAt: '', cancelled: false, dryRun: false }),
            });
            lastRunRef.current = r;
            setReport(r);
            const failed = Object.values(r.nodes).filter(n => n.status === 'error').length;
            if (r.cancelled) setMessage({ kind: 'info', text: 'Run cancelled' });
            else if (failed) setMessage({ kind: 'error', text: `${failed} block(s) failed: select them to see why` });
        } catch (e) {
            setMessage({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
        } finally {
            runningRef.current = false;
            abortRef.current = null;
            setRunning(false);
        }
    }, [errors.length, workflow, registry, env]);

    // Forget every stored result: blocks become out of date and the next Run recomputes them
    const clearCache = () => {
        const count = cacheRef.current.size;
        cacheRef.current.clear();
        setCacheVersion(v => v + 1);
        setMessage({ kind: 'info', text: count ? `Cache cleared (${count} stored result(s)): the next Run recomputes every block` : 'The cache was already empty' });
    };

    // ---- Save / Load ---------------------------------------------------------------------
    const save = () => {
        const blob = new Blob([serializeWorkflow(workflow)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${workflow.name.replace(/[^\w-]+/g, '_') || 'workflow'}.workflow.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const load = async (file: File) => {
        try {
            const { workflow: wf, issues: loaded } = parseWorkflow(await file.text(), registry);
            askReplace(wf, `“${wf.name}”`);
            const problems = loaded.filter(i => i.severity === 'error');
            if (problems.length) setMessage({ kind: 'error', text: `Loaded with problems: ${problems.map(i => i.message).join('; ')}` });
        } catch (e) {
            setMessage({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
        }
    };

    const fromTemplate = (id: string) => {
        const template = PREDEFINED_WORKFLOWS.find(t => t.id === id);
        if (!template) return;
        const wf = instantiateTemplate(template);
        wf.nodes.forEach(n => { if (n.type === 'data') n.scientificParams.files = files.map(fileRef); });
        askReplace(wf, `the template “${template.name}”`);
    };

    // ---- Selection -----------------------------------------------------------------------
    const selected = workflow.nodes.find(n => n.id === selectedId) ?? null;
    const selectedDef: BlockDefinition | undefined = selected ? registry.get(selected.type) : undefined;
    const selectedResult = selected ? results[selected.id] : undefined;
    const tagged = report?.tagged ?? [];

    // Inside an opened group: the inner block selected, as its group runs it
    const innerRaw = opened && innerSelectedId ? opened.def.nodes.find(n => n.id === innerSelectedId) : undefined;
    const innerNode = opened && innerRaw ? effectiveInner(opened.node, innerRaw) : null;
    const innerDef = innerNode ? registry.get(innerNode.type) : undefined;
    const innerRunId = opened && innerNode ? `${opened.runId}/${innerNode.id}` : '';
    const innerResult = innerNode ? results[innerRunId] : undefined;

    /** Store a parameter of the selected inner block on the top-level group node */
    const setInnerParam = (scope: 'scientific' | 'presentation', key: string, value: any, current: Record<string, any>) => {
        if (!innerNode || !openPath.length) return;
        const composites = workflow.composites ?? [];
        updateNode(openPath[0], n => withInnerParams(n, openPath.slice(1), innerNode.id, scope, { ...current, [key]: value }, composites));
    };

    const palette = useMemo(() => {
        const groups = new Map<string, BlockDefinition[]>();
        registry.list().forEach(b => groups.set(b.category, [...(groups.get(b.category) ?? []), b]));
        return Array.from(groups.entries()).sort(([a], [b]) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b));
    }, [registry]);

    /** A group shows the views it contains, then summaries of its outputs */
    const groupResult = (node: WorkflowNode, runId: string = node.id) => {
        const groupDef = workflow.composites?.find(c => c.type === node.type);
        const result = results[runId];
        if (!groupDef || !result) return null;
        const innerViews = groupDef.nodes.filter(n => registry.get(n.type)?.role === 'view');
        const loop = result.loop;
        const stopped = loop && ({
            exit: 'stopped by its ExitLoop', max: 'stopped at the maximum number of iterations',
            empty: 'stopped: no data left', 'no-value': 'stopped: nothing produced to carry on', cancelled: 'cancelled',
        } as const)[loop.stoppedBy];
        return (
            <div className="space-y-6">
                {loop && (
                    <div className="space-y-2">
                        <div className="text-sm"><b>{loop.iterations.length} iteration(s)</b>, {stopped}. Outputs are those of the last iteration
                            {groupDef.loop && registry.get(node.type)?.outputs.some(o => o.id === LOOP_COLLECTED) ? '; “All iterations” gathers every iteration' : ''}.</div>
                        <div className="overflow-x-auto">
                            <table className="text-sm border-collapse">
                                <thead><tr className="text-left text-gray-600">
                                    <th className="pr-4 py-1">Iteration</th><th className="pr-4">Data in</th><th className="pr-4">Carried on</th>
                                    <th className="pr-4">Misfit</th><th className="pr-4">Stress ratio</th>
                                </tr></thead>
                                <tbody>
                                    {loop.iterations.map(it => (
                                        <tr key={it.iteration} className="border-t">
                                            <td className="pr-4 py-1">{it.iteration}</td>
                                            <td className="pr-4">{it.rowsIn}</td>
                                            <td className="pr-4">{it.rowsOut ?? '—'}</td>
                                            <td className="pr-4">{it.misfit === undefined ? '—' : it.misfitCriterion === 'DOT' ? it.misfit.toFixed(4) : `${it.misfit.toFixed(1)}°`}</td>
                                            <td className="pr-4">{it.stressRatio === undefined ? '—' : it.stressRatio.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                {innerViews.map(inner => {
                    const innerDef = registry.get(inner.type)!;
                    const r = results[`${runId}/${inner.id}`];
                    const shown = { ...inner, presentationParams: innerPresentation(node, inner) };
                    return (
                        <div key={inner.id} className="space-y-2">
                            <h3 className="font-semibold text-gray-800">{inner.label || innerDef.title}</h3>
                            {r?.status === 'done'
                                ? <ViewNodeResult node={shown} def={innerDef} result={r} registry={registry} />
                                : <p className="text-sm text-gray-500">{r?.reason ?? r?.error ?? 'Not run yet.'}</p>}
                        </div>
                    );
                })}
                {Object.entries(result.outputs).map(([port, payload]) => (
                    <div key={port} className="space-y-2">
                        <div className="font-medium">{registry.get(node.type)?.outputs.find(o => o.id === port)?.label}</div>
                        <PayloadSummary payload={payload} />
                        <ProvenanceDetails provenance={payload.provenance} />
                    </div>
                ))}
                {innerViews.length === 0 && Object.keys(result.outputs).length === 0 && (
                    <p className="text-sm text-gray-500">This group produced nothing.</p>
                )}
            </div>
        );
    };

    /** What the results pane shows for a block (`runId`: its id in the run results) */
    const resultBody = (node: WorkflowNode | null, def: BlockDefinition | undefined, result: NodeResult | undefined, runId: string) => (
        !node ? <p className="text-sm text-gray-500">Select a block to see its result.</p>
        : !result || (result.status !== 'done' && !(result.status === 'inactive' && result.bypassed))
            ? <p className="text-sm text-gray-500">
                {result?.status === 'stale' ? 'Out of date: run the workflow to update it.'
                    : result?.reason ?? result?.error ?? 'Not run yet.'}
            </p>
        : def?.role === 'view' ? (
            <ViewNodeResult node={node} def={def} result={result} registry={registry} />
        ) : isCompositeType(node.type) ? (
            groupResult(node, runId)
        ) : def?.role === 'report' && result.outputs.report?.type === 'Report' ? (
            <ReportPanel
                payload={result.outputs.report as ReportPayload}
                labelOf={labelOf}
            />
        ) : (
            <div className="space-y-4">
                {Object.entries(result.outputs).map(([port, payload]) => (
                    <div key={port} className="space-y-2">
                        {(def?.outputs.length ?? 0) > 1 && (
                            <div className="font-medium">{def?.outputs.find(o => o.id === port)?.label}</div>
                        )}
                        <PayloadSummary payload={payload} />
                        <ProvenanceDetails provenance={payload.provenance} />
                    </div>
                ))}
                {Object.keys(result.outputs).length === 0 && (
                    <p className="text-sm text-gray-500">This block produced nothing.</p>
                )}
                {!opened && <p className="text-xs text-gray-500">Connect a view block to this block to plot its result.</p>}
            </div>
        )
    );

    /** Status badge, reason and error of a block */
    const statusBlock = (node: WorkflowNode, result: NodeResult | undefined) => result && (
        <div className="space-y-1">
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[node.active ? result.status : 'inactive'].className}`}>
                {result.bypassed ? 'Off (bypassed)' : STATUS_STYLE[node.active ? result.status : 'inactive'].label}
            </span>
            {result.cached && result.status === 'done' && <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-500">cached</span>}
            {result.reason && <div className="text-xs text-orange-700">{result.reason}</div>}
            {result.error && <div className="text-xs text-red-700">{result.error}</div>}
            {result.status === 'running' && result.progressMessage && (
                <div className="text-xs text-blue-700">{result.progressMessage}</div>
            )}
        </div>
    );

    const logBlock = (result: NodeResult | undefined) => result && result.logs.length > 0 && (
        <details>
            <summary className="cursor-pointer text-xs text-gray-600">Log ({result.logs.length})</summary>
            <div className="mt-1 space-y-0.5 max-h-48 overflow-y-auto text-[11px] font-mono">
                {result.logs.map((l, i) => (
                    <div key={i} className={l.level === 'error' ? 'text-red-700' : l.level === 'warning' ? 'text-amber-700' : 'text-gray-600'}>
                        {l.message}{l.details ? ` — ${l.details}` : ''}
                    </div>
                ))}
            </div>
        </details>
    );

    /** Right-hand panel inside an opened group: the selected inner block, or the group itself */
    const innerInspector = () => {
        if (!opened) return null;
        const { node: group, def } = opened;
        if (!innerNode) {
            const groupDef = registry.get(group.type);
            const isConnected = (port: string) => inputFed(openPath.length - 1, port);
            return (
                <div className="space-y-3">
                    <div>
                        <div className="font-semibold text-base">{group.label || def.title}</div>
                        <div className="text-xs text-gray-500">
                            {def.loop ? 'Loop' : 'Group'} of {def.nodes.length} blocks{def.description ? ` · ${def.description}` : ''}
                        </div>
                    </div>
                    {statusBlock(group, results[opened.runId])}
                    <div>
                        <div className="text-xs font-medium text-gray-700 mb-1">Inputs</div>
                        {def.inputs.length === 0 && <div className="text-xs text-gray-400">None</div>}
                        {def.inputs.map(i => (
                            <div key={i.id} className="text-xs text-gray-600">
                                {i.label} <span className="text-gray-400">({i.type}{i.optional ? ', optional' : ''})</span>
                                {!isConnected(i.id) && <span className="text-gray-400"> · not connected</span>}
                            </div>
                        ))}
                    </div>
                    <div>
                        <div className="text-xs font-medium text-gray-700 mb-1">Outputs</div>
                        {(groupDef?.outputs ?? def.outputs).map(o => (
                            <div key={o.id} className="text-xs text-gray-600">{o.label} <span className="text-gray-400">({o.type})</span></div>
                        ))}
                    </div>
                    {def.loop && groupDef && (() => {
                        const p = paramsWithDefaults(groupDef, group, 'scientific');
                        const carried = def.outputs.find(o => o.id === def.loop!.carriedOutput);
                        return (
                            <div className="text-xs text-gray-600 space-y-0.5">
                                <div>Maximum iterations: {p.maxIterations}</div>
                                <div>Passed to the next iteration: {carried?.label ?? '—'}</div>
                                <div className="text-gray-500">Blocks show the last iteration.</div>
                            </div>
                        );
                    })()}
                    <p className="text-xs text-gray-500">Click a block to see its parameters and results.</p>
                    {logBlock(results[opened.runId])}
                </div>
            );
        }
        const replacedBy = innerView?.replaced.get(innerNode.id);
        return (
            <div className="space-y-3">
                <div>
                    <div className="font-semibold text-base">{innerNode.label || innerDef?.title || innerNode.type}</div>
                    {innerNode.label && innerDef && <div className="text-xs text-gray-500">{innerDef.title}</div>}
                    {innerDef?.description && <div className="text-xs text-gray-500">{innerDef.description}</div>}
                    <div className="text-[11px] text-gray-400">In {group.label || def.title}</div>
                </div>
                {replacedBy && (
                    <p className="text-xs text-gray-600 bg-gray-50 border rounded p-2">
                        Not used: the group works on the data connected to “{replacedBy.label}”.
                    </p>
                )}
                {!innerNode.active && <p className="text-xs text-gray-600">Switched off inside the group.</p>}
                {statusBlock(innerNode, innerResult)}
                {isCompositeType(innerNode.type) && (
                    <button className={button} onClick={() => openGroup(innerNode.id)}>
                        <LogIn className="w-4 h-4" /> Open
                    </button>
                )}
                {innerDef && (
                    <fieldset disabled={running} className="space-y-3">
                        <BlockParams def={innerDef} node={innerNode} files={files} onChange={setInnerParam} />
                    </fieldset>
                )}
                <p className="text-[11px] text-gray-500">
                    Parameters are stored on the group. To add, remove or reconnect blocks, go back up and Ungroup.
                </p>
                {logBlock(innerResult)}
            </div>
        );
    };

    // ---- Render --------------------------------------------------------------------------
    const button = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed';

    return (
        <div className="space-y-3">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
                <input
                    className="border rounded px-2 py-1.5 text-sm font-medium w-64"
                    value={workflow.name}
                    onChange={e => setWorkflow(wf => ({ ...wf, name: e.target.value }))}
                    aria-label="Workflow name"
                />
                <button className={button} onClick={() => askReplace(emptyWorkflow(), 'an empty workflow')} disabled={running}>
                    <FilePlus className="w-4 h-4" /> New
                </button>
                <select
                    className="border rounded px-2 py-1.5 text-sm bg-white" value="" disabled={running}
                    onChange={e => { fromTemplate(e.target.value); e.target.value = ''; }}
                >
                    <option value="">Predefined workflows…</option>
                    {PREDEFINED_WORKFLOWS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button className={button} onClick={() => fileInputRef.current?.click()} disabled={running}>
                    <FolderOpen className="w-4 h-4" /> Load
                </button>
                <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) load(f); e.target.value = ''; }} />
                <button className={button} onClick={save}><Save className="w-4 h-4" /> Save</button>
                <button className={button} onClick={clearCache} disabled={running}
                    title="Forget the stored results of every block, so the next Run recomputes everything">
                    <Eraser className="w-4 h-4" /> Clear cache
                </button>

                <div className="flex-1" />
                {running ? (
                    <button className={`${button} border-red-300 text-red-700`} onClick={() => abortRef.current?.abort()}>
                        <Square className="w-4 h-4" /> Cancel
                    </button>
                ) : (
                    <button
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40"
                        onClick={() => run()} disabled={errors.length > 0 || workflow.nodes.length === 0}
                        title={errors.length ? 'Fix the problems listed below first' : 'Run every block that is not up to date'}
                    >
                        <Play className="w-4 h-4" /> Run
                    </button>
                )}
            </div>

            {pendingReplace && (
                <div className="flex items-center gap-3 p-2 rounded bg-amber-50 border border-amber-200 text-sm">
                    <span>Replace the current workflow with {pendingReplace.label}? Unsaved changes will be lost.</span>
                    <button className={button} onClick={() => replaceWorkflow(pendingReplace.workflow)}>Replace</button>
                    <button className={button} onClick={() => setPendingReplace(null)}>Cancel</button>
                </div>
            )}
            {message && (
                <div className={`flex items-start gap-2 p-2 rounded text-sm ${message.kind === 'error' ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-800'}`}>
                    <span className="flex-1">{message.text}</span>
                    <button className="text-xs underline" onClick={() => setMessage(null)}>Dismiss</button>
                </div>
            )}
            {errors.length > 0 && (
                <div className="p-2 rounded bg-red-50 text-sm text-red-800 space-y-0.5">
                    {errors.map((i, k) => (
                        <div key={k} className="flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" />{i.message}</div>
                    ))}
                </div>
            )}

            {/* Palette | canvas | inspector */}
            <div className="flex border rounded-lg overflow-hidden bg-white" style={{ height: 540 }}>
                <div className="w-48 border-r overflow-y-auto p-2 space-y-3 bg-gray-50">
                    {opened && (
                        <div className="text-xs text-gray-600 space-y-2">
                            <p className="font-medium text-indigo-800">Looking inside “{opened.node.label || opened.def.title}”.</p>
                            <p>Click a block to see its parameters and results. Double-click a group to open it.</p>
                            <p>The blocks and connections cannot be changed here: go back to the workflow and use Ungroup to change them.</p>
                            <p className="text-gray-500">Esc goes up one level.</p>
                        </div>
                    )}
                    {!opened && palette.map(([category, blocks]) => (
                        <div key={category}>
                            <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">{category}</div>
                            {category === 'Control' && (
                                <div
                                    onClick={() => setMessage({
                                        kind: 'info',
                                        text: selectedIds.length > 1
                                            ? 'Use “Make a loop” in the panel on the right.'
                                            : 'A ForLoop repeats a group of blocks: select the blocks to repeat (Cmd/Ctrl-click), then use “Make a loop” in the panel on the right.',
                                    })}
                                    title="Repeat blocks until an ExitLoop stops them"
                                    className="flex items-center gap-1.5 px-2 py-1.5 mb-1 rounded bg-white border border-dashed text-sm cursor-pointer hover:border-blue-400"
                                >
                                    <Repeat className="w-3.5 h-3.5 text-gray-500" /> ForLoop
                                </div>
                            )}
                            {blocks.map(b => (
                                <div
                                    key={b.type}
                                    draggable
                                    onDragStart={e => { e.dataTransfer.setData(DRAG_TYPE, b.type); e.dataTransfer.effectAllowed = 'move'; }}
                                    onClick={() => addBlock(b.type)}
                                    title={b.description}
                                    className="group flex items-center px-2 py-1.5 mb-1 rounded bg-white border text-sm cursor-grab hover:border-blue-400"
                                >
                                    <span className="flex-1 truncate">{b.title}</span>
                                    {library.some(c => c.type === b.type) && (
                                        <button
                                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600"
                                            title="Remove from my blocks (workflows using it keep their copy)"
                                            onClick={e => {
                                                e.stopPropagation();
                                                const user = library.find(c => c.type !== b.type && compositeWithDependencies(c.type, library).some(d => d.type === b.type));
                                                if (user) setMessage({ kind: 'error', text: `“${b.title}” is used inside “${user.title}” in My blocks: remove that one first` });
                                                else setLibrary(lib => lib.filter(c => c.type !== b.type));
                                            }}
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}
                    {!opened && <p className="text-[11px] text-gray-500">Drag a block onto the canvas, or click it. Cmd/Ctrl-click or Shift-drag on the canvas selects several blocks. Double-click a group to look inside.</p>}
                </div>

                <div ref={canvasRef} className={`flex-1 relative flex flex-col ${opened ? 'bg-indigo-50/60' : ''}`}
                    onDrop={opened ? undefined : onDrop}
                    onDragOver={e => { if (opened) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}>
                    {opened && openLevels && (
                        <nav className="flex items-center flex-wrap gap-1 px-3 py-1.5 border-b bg-indigo-50 text-sm" aria-label="Opened groups">
                            <button className="text-blue-700 hover:underline" onClick={() => closeTo(0)}>{workflow.name || 'Workflow'}</button>
                            {openLevels.map((level, k) => {
                                const name = level.node.label || level.def.title;
                                const last = k === openLevels.length - 1;
                                return (
                                    <React.Fragment key={level.runId}>
                                        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                                        {last
                                            ? <span className="font-semibold text-gray-800">{name}{level.def.loop ? ' (loop)' : ''}</span>
                                            : <button className="text-blue-700 hover:underline" onClick={() => closeTo(k + 1)}>{name}</button>}
                                    </React.Fragment>
                                );
                            })}
                            <span className="ml-2 text-xs text-gray-500">
                                read-only{opened.def.loop ? ' · showing the last iteration' : ''}
                            </span>
                            <div className="flex-1" />
                            <button className="text-xs text-gray-600 hover:text-gray-900 underline" onClick={() => closeTo(openPath.length - 1)}
                                title="Esc">
                                Up one level
                            </button>
                        </nav>
                    )}
                    <div className="flex-1 relative">
                    {opened && innerView ? (
                        <ReactFlow
                            key={`open:${opened.runId}`}
                            nodes={innerView.nodes}
                            edges={innerView.edges}
                            nodeTypes={nodeTypes}
                            onNodesChange={onInnerNodesChange}
                            onNodeDoubleClick={onNodeDoubleClick}
                            onPaneClick={() => setInnerSelectedId(null)}
                            nodesDraggable={false}
                            nodesConnectable={false}
                            edgesFocusable={false}
                            elementsSelectable
                            deleteKeyCode={null}
                            zoomOnDoubleClick={false}
                            fitView
                            minZoom={0.3}
                        >
                            <Background gap={16} color="#c7d2fe" />
                            <Controls showInteractive={false} />
                        </ReactFlow>
                    ) : (
                    <ReactFlow
                        key="workflow"
                        nodes={rfNodes}
                        edges={rfEdges}
                        nodeTypes={nodeTypes}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeClick={onNodeClick}
                        onNodeDoubleClick={onNodeDoubleClick}
                        isValidConnection={isValidConnection}
                        onPaneClick={() => { selectOnly(null); setSelectedEdgeId(null); }}
                        zoomOnDoubleClick={false}
                        fitView
                        minZoom={0.3}
                        deleteKeyCode={['Backspace', 'Delete']}
                    >
                        <Background gap={16} />
                        <Controls showInteractive={false} />
                    </ReactFlow>
                    )}
                    {!opened && workflow.nodes.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center text-gray-500 text-sm">
                                <p>Add blocks from the palette,</p>
                                <p>or start from a predefined workflow.</p>
                            </div>
                        </div>
                    )}
                    </div>
                </div>

                <div className="w-80 border-l overflow-y-auto p-3 text-sm">
                    {opened ? innerInspector() : (<>
                    {selectedIds.length > 1 && (
                        <div className="space-y-3">
                            <div className="font-semibold text-base">{selectedIds.length} blocks selected</div>
                            <label className="block">
                                <span className="text-xs text-gray-600">Name of the new block</span>
                                <input className="w-full border rounded px-2 py-1 text-sm" value={groupName} placeholder="My block"
                                    onChange={e => setGroupName(e.target.value)} />
                            </label>
                            <button className={button} onClick={groupSelection} disabled={running}>
                                <Boxes className="w-4 h-4" /> Group as block
                            </button>
                            <p className="text-xs text-gray-500">
                                Connections crossing the selection become the inputs and outputs of the new block.
                                It is also added to “My blocks” in the palette.
                            </p>
                            <div className="pt-3 border-t space-y-2">
                                <div className="font-medium">Make a loop</div>
                                {loopChoice && 'error' in loopChoice && <p className="text-xs text-amber-700">{loopChoice.error}</p>}
                                {loopChoice && 'options' in loopChoice && loopChoice.options && (() => {
                                    const { carriedInput, carriedOutputs, collectable } = loopChoice.options;
                                    return (
                                        <>
                                            <p className="text-xs text-gray-500">
                                                Repeats these blocks. Each iteration feeds “{carriedInput.label}” with what the previous one produced on:
                                            </p>
                                            <select className="w-full border rounded px-2 py-1 text-sm"
                                                value={loopDraft.carriedOutput ?? carriedOutputs[0].id}
                                                onChange={e => setLoopDraft(d => ({ ...d, carriedOutput: e.target.value }))}>
                                                {carriedOutputs.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                                            </select>
                                            <label className="block">
                                                <span className="text-xs text-gray-600">Collected over all iterations</span>
                                                <select className="w-full border rounded px-2 py-1 text-sm"
                                                    value={loopDraft.collect ?? collectable[0]?.id ?? 'none'}
                                                    onChange={e => setLoopDraft(d => ({ ...d, collect: e.target.value }))}>
                                                    <option value="none">Nothing</option>
                                                    {collectable.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                                                </select>
                                            </label>
                                            <label className="block">
                                                <span className="text-xs text-gray-600">Maximum iterations</span>
                                                <input type="number" min={1} max={100} className="w-full border rounded px-2 py-1 text-sm"
                                                    value={loopDraft.maxIterations}
                                                    onChange={e => setLoopDraft(d => ({ ...d, maxIterations: Math.max(1, Number(e.target.value) || 1) }))} />
                                            </label>
                                            <button className={button} onClick={loopSelection} disabled={running}>
                                                <Repeat className="w-4 h-4" /> Make a loop
                                            </button>
                                            <p className="text-xs text-gray-500">Put an ExitLoop among the blocks to stop before the maximum.</p>
                                        </>
                                    );
                                })()}
                            </div>
                            <button className={`${button} text-red-700`} onClick={() => removeNodes(selectedIds)} disabled={running}>
                                <Trash2 className="w-4 h-4" /> Delete the {selectedIds.length} blocks
                            </button>
                        </div>
                    )}
                    {selectedIds.length === 0 && (
                        <p className="text-gray-500">Select a block to edit it.<br />Delete a block or a link with the Delete key.</p>
                    )}
                    {selected && (
                        <div className="space-y-3">
                            <div>
                                <div className="font-semibold text-base">{selectedDef?.title ?? selected.type}</div>
                                {selectedDef?.description && <div className="text-xs text-gray-500">{selectedDef.description}</div>}
                            </div>

                            {selectedResult && (
                                <div className="space-y-1">
                                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[selected.active ? selectedResult.status : 'inactive'].className}`}>
                                        {selectedResult.bypassed ? 'Off (bypassed)' : STATUS_STYLE[selected.active ? selectedResult.status : 'inactive'].label}
                                    </span>
                                    {selectedResult.reason && <div className="text-xs text-orange-700">{selectedResult.reason}</div>}
                                    {selectedResult.error && <div className="text-xs text-red-700">{selectedResult.error}</div>}
                                    {selectedResult.status === 'running' && selectedResult.progressMessage && (
                                        <div className="text-xs text-blue-700">{selectedResult.progressMessage}</div>
                                    )}
                                </div>
                            )}

                            <fieldset disabled={running} className="space-y-3">
                                <label className="block">
                                    <span className="text-xs text-gray-600">Label</span>
                                    <input className="w-full border rounded px-2 py-1 text-sm" value={selected.label ?? ''}
                                        placeholder={selectedDef?.title}
                                        onChange={e => updateNode(selected.id, n => ({ ...n, label: e.target.value || undefined }))} />
                                </label>
                                <label className="flex items-center gap-2">
                                    <input type="checkbox" checked={selected.active}
                                        onChange={e => updateNode(selected.id, n => ({ ...n, active: e.target.checked }))} />
                                    Active
                                    <span className="text-xs text-gray-500">
                                        {selectedDef?.bypass ? '(when off, passes its input through)' : selectedDef?.role === 'view' ? '' : '(when off, stops its branch)'}
                                    </span>
                                </label>

                                {selectedDef && isCompositeType(selected.type) && (() => {
                                    const own = selectedDef.params.filter(p => p.scope === 'scientific' && p.kind !== 'object');
                                    if (own.length === 0) return null;
                                    const values = paramsWithDefaults(selectedDef, selected, 'scientific');
                                    return (
                                        <div className="space-y-2">
                                            {own.map(p => (
                                                <div key={p.key}>
                                                    <div className="text-xs text-gray-600 mb-0.5" title={p.help}>{p.label}</div>
                                                    <ParamEditor param={p} value={values[p.key]} siblings={values} files={files}
                                                        onChange={v => updateNode(selected.id, n => ({ ...n, scientificParams: { ...n.scientificParams, [p.key]: v } }))} />
                                                    {p.help && <div className="text-[11px] text-gray-400 mt-0.5">{p.help}</div>}
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}

                                {selectedDef && isCompositeType(selected.type) && (() => {
                                    const groupDef = workflow.composites?.find(c => c.type === selected.type);
                                    if (!groupDef) return null;
                                    const inner: InnerParams = selected.scientificParams.inner ?? {};
                                    return groupDef.nodes.map(innerNode => {
                                        const innerDef = registry.get(innerNode.type);
                                        if (!innerDef) return null;
                                        // A group inside: one entry, opened to see and edit its own blocks
                                        if (isCompositeType(innerNode.type)) {
                                            return (
                                                <div key={innerNode.id} className="border rounded p-2 flex items-center gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-semibold text-gray-700 truncate">{innerNode.label || innerDef.title}</div>
                                                        <div className="text-[11px] text-gray-500">{innerDef.description}</div>
                                                    </div>
                                                    <button type="button" className={button} onClick={() => { setOpenPath([selected.id, innerNode.id]); setInnerSelectedId(null); fitPending.current = true; }}>
                                                        <LogIn className="w-4 h-4" /> Open
                                                    </button>
                                                </div>
                                            );
                                        }
                                        // An inner Data block replaced by data connected to the group
                                        const replacedBy = groupDef.inputs.find(i => i.replaces?.node === innerNode.id
                                            && workflow.edges.some(e => e.target === selected.id && e.targetPort === i.id));
                                        if (replacedBy) {
                                            return (
                                                <div key={innerNode.id} className="border rounded p-2 text-xs text-gray-500">
                                                    <div className="font-semibold text-gray-400 line-through">{innerNode.label || innerDef.title}</div>
                                                    Not used: the group works on the data connected to “{replacedBy.label}”.
                                                </div>
                                            );
                                        }
                                        const current = { ...innerNode, scientificParams: inner[innerNode.id] ?? innerNode.scientificParams };
                                        const values = paramsWithDefaults(innerDef, current, 'scientific');
                                        const params = innerDef.params.filter(p => p.scope === 'scientific');
                                        const displayParams = innerDef.params.filter(p => p.scope === 'presentation' && p.kind !== 'object');
                                        const display = paramsWithDefaults(innerDef, { ...innerNode, presentationParams: innerPresentation(selected, innerNode) }, 'presentation');
                                        return (
                                            <div key={innerNode.id} className="border rounded p-2 space-y-2">
                                                <div className="text-xs font-semibold text-gray-700">{innerNode.label || innerDef.title}</div>
                                                {params.length === 0 && displayParams.length === 0 && <div className="text-xs text-gray-400">No parameter</div>}
                                                {displayParams.map(p => (
                                                    <div key={p.key}>
                                                        <div className="text-xs text-gray-600 mb-0.5">{p.label}</div>
                                                        <ParamEditor
                                                            param={p} value={display[p.key]} siblings={display} files={files}
                                                            onChange={v => updateNode(selected.id, n => ({
                                                                ...n,
                                                                presentationParams: {
                                                                    ...n.presentationParams,
                                                                    inner: { ...(n.presentationParams.inner ?? {}), [innerNode.id]: { ...display, [p.key]: v } },
                                                                },
                                                            }))}
                                                        />
                                                    </div>
                                                ))}
                                                {params.map(p => (
                                                    <div key={p.key}>
                                                        <div className="text-xs text-gray-600 mb-0.5" title={p.help}>{p.label}</div>
                                                        <ParamEditor
                                                            param={p} value={values[p.key]} siblings={values} files={files}
                                                            onChange={v => updateNode(selected.id, n => ({
                                                                ...n,
                                                                scientificParams: {
                                                                    ...n.scientificParams,
                                                                    inner: { ...(n.scientificParams.inner ?? {}), [innerNode.id]: { ...values, [p.key]: v } },
                                                                },
                                                            }))}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    });
                                })()}

                                {selectedDef && !isCompositeType(selected.type) && (() => {
                                    const scientific = paramsWithDefaults(selectedDef, selected, 'scientific');
                                    const presentation = paramsWithDefaults(selectedDef, selected, 'presentation');
                                    const sciParams = selectedDef.params.filter(p => p.scope === 'scientific');
                                    const presParams = selectedDef.params.filter(p => p.scope === 'presentation' && p.kind !== 'object');
                                    return (
                                        <>
                                            {sciParams.map(p => (
                                                <div key={p.key}>
                                                    <div className="text-xs text-gray-600 mb-0.5" title={p.help}>{p.label}</div>
                                                    <ParamEditor
                                                        param={p} value={scientific[p.key]} siblings={scientific} files={files}
                                                        onChange={v => updateNode(selected.id, n => ({ ...n, scientificParams: { ...n.scientificParams, [p.key]: v } }))}
                                                    />
                                                    {p.help && <div className="text-[11px] text-gray-400 mt-0.5">{p.help}</div>}
                                                </div>
                                            ))}
                                            {presParams.length > 0 && <div className="text-xs font-medium text-gray-700 pt-1 border-t">Display</div>}
                                            {presParams.map(p => (
                                                <div key={p.key}>
                                                    <div className="text-xs text-gray-600 mb-0.5">{p.label}</div>
                                                    <ParamEditor
                                                        param={p} value={presentation[p.key]} siblings={presentation} files={files}
                                                        onChange={v => updateNode(selected.id, n => ({ ...n, presentationParams: { ...n.presentationParams, [p.key]: v } }))}
                                                    />
                                                </div>
                                            ))}
                                        </>
                                    );
                                })()}
                            </fieldset>

                            <div className="flex flex-wrap gap-2 pt-2 border-t">
                                {selectedDef?.role !== 'view' && (
                                    <button className={button} onClick={() => run(selected.id)} disabled={running || errors.length > 0}
                                        title="Run this block and what it needs">
                                        <SkipForward className="w-4 h-4" /> Run to here
                                    </button>
                                )}
                                {isCompositeType(selected.type) && (
                                    <button className={button} onClick={() => openGroup(selected.id)}
                                        title="Look inside: its blocks, connections, parameters and results (or double-click it)">
                                        <LogIn className="w-4 h-4" /> Open
                                    </button>
                                )}
                                {isCompositeType(selected.type) && (
                                    <button className={button} onClick={() => ungroup(selected.id)} disabled={running}
                                        title="Put the blocks of this group back on the canvas">
                                        <Ungroup className="w-4 h-4" /> Ungroup
                                    </button>
                                )}
                                <button className={`${button} text-red-700`} onClick={() => removeNodes([selected.id])} disabled={running}>
                                    <Trash2 className="w-4 h-4" /> Delete
                                </button>
                            </div>

                            {selectedResult && selectedResult.logs.length > 0 && (
                                <details>
                                    <summary className="cursor-pointer text-xs text-gray-600">Log ({selectedResult.logs.length})</summary>
                                    <div className="mt-1 space-y-0.5 max-h-48 overflow-y-auto text-[11px] font-mono">
                                        {selectedResult.logs.map((l, i) => (
                                            <div key={i} className={l.level === 'error' ? 'text-red-700' : l.level === 'warning' ? 'text-amber-700' : 'text-gray-600'}>
                                                {l.message}{l.details ? ` — ${l.details}` : ''}
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            )}
                        </div>
                    )}
                    </>)}
                </div>
            </div>

            {/* Results */}
            <div className="border rounded-lg bg-white">
                <div className="flex border-b text-sm">
                    <button className={`px-4 py-2 ${bottomTab === 'result' ? 'border-b-2 border-blue-500 text-blue-700' : 'text-gray-600'}`}
                        onClick={() => setBottomTab('result')}>
                        Result{opened
                            ? ` — ${innerNode ? `${opened.node.label || opened.def.title} › ${innerNode.label || innerDef?.title || innerNode.type}` : opened.node.label || opened.def.title}`
                            : selected ? ` — ${selected.label || selectedDef?.title || selected.type}` : ''}
                    </button>
                    <button className={`px-4 py-2 inline-flex items-center gap-1 ${bottomTab === 'tagged' ? 'border-b-2 border-blue-500 text-blue-700' : 'text-gray-600'}`}
                        onClick={() => setBottomTab('tagged')}>
                        <Tag className="w-3.5 h-3.5" /> Tagged items ({tagged.length})
                    </button>
                </div>

                <div className="p-4">
                    {bottomTab === 'result' && (
                        opened
                            ? innerNode
                                ? resultBody(innerNode, innerDef, innerResult, innerRunId)
                                : resultBody(opened.node, registry.get(opened.node.type), results[opened.runId], opened.runId)
                            : resultBody(selected, selectedDef, selectedResult, selected?.id ?? '')
                    )}

                    {bottomTab === 'tagged' && (
                        tagged.length === 0
                            ? <p className="text-sm text-gray-500">Nothing tagged yet. Add Tags blocks keep values for the report.</p>
                            : (
                                <div className="space-y-2">
                                    {tagged.map((item, i) => {
                                        return (
                                            <div key={i} className="border rounded p-2 space-y-1">
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Tag className="w-3.5 h-3.5 text-purple-600" />
                                                    <span className="font-medium">{item.tag}</span>
                                                    {item.iteration !== undefined && <span className="text-gray-500">iteration {item.iteration}</span>}
                                                    <span className="text-gray-500">
                                                        {item.payload.type === 'InversionResult' ? 'Inversion result' : 'Dataset'} ·
                                                        {' '}{item.payload.files.reduce((k, f) => k + f.content.length, 0)} rows
                                                    </span>
                                                    {item.outdated && <span className="px-1.5 rounded text-xs bg-amber-100 text-amber-800">outdated</span>}
                                                    <div className="flex-1" />
                                                    <button className="text-xs underline" onClick={() => {
                                                        const path = item.nodeId.split('/');
                                                        if (path.length > 1 && resolveOpenPath(workflow, path.slice(0, -1))) {
                                                            setOpenPath(path.slice(0, -1));
                                                            setInnerSelectedId(path[path.length - 1]);
                                                            fitPending.current = true;
                                                        } else {
                                                            setOpenPath([]);
                                                            selectOnly(outerId(item.nodeId));
                                                        }
                                                        setBottomTab('result');
                                                    }}>
                                                        {labelOf(item.nodeId)}
                                                    </button>
                                                </div>
                                                {item.note && <div className="text-xs text-gray-600">{item.note}</div>}
                                                <ProvenanceDetails provenance={item.payload.provenance} />
                                            </div>
                                        );
                                    })}
                                </div>
                            )
                    )}
                </div>
            </div>
        </div>
    );
};

const WorkflowTab: React.FC<Props> = props => (
    <ReactFlowProvider>
        <WorkflowEditor {...props} />
    </ReactFlowProvider>
);

export default WorkflowTab;
