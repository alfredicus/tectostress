// WorkflowTab.tsx
// The Workflow tab (doc/workflow-spec.md): build a graph of blocks, run it, inspect the results.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ReactFlow, ReactFlowProvider, Background, Controls, useReactFlow, useNodesInitialized,
    Connection, Edge, EdgeChange, NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AlertTriangle, Boxes, Download, Eraser, FilePlus, Repeat, FolderOpen, Play, Printer, Save, SkipForward, Square, Tag, Trash2, Ungroup, X } from 'lucide-react';
import appPackage from '../../../package.json';
import stressPackage from '@alfredo-taboada/stress/package.json';
import { DataFile } from '../DataFile';
import {
    canConnect, createDefaultRegistry, createNode, fileRef, instantiateTemplate, parseWorkflow,
    planWorkflow, PREDEFINED_WORKFLOWS, Provenance, resolveOutputType, runWorkflow, serializeWorkflow,
    validateWorkflow, Workflow, WorkflowCache, WorkflowEnvironment, WorkflowNode, WorkflowRunReport,
    WORKFLOW_SCHEMA_VERSION, BlockDefinition, NodeResult, paramsWithDefaults, ReportPayload,
    registryFor, groupAsComposite, ungroupComposite, isCompositeType, outerId, CompositeDefinition, InnerParams,
    innerPresentation, BlockRegistry, makeLoop, loopOptions, LOOP_COLLECTED,
} from '../../workflow';
import { hashValue } from '../../workflow/hash';
import BlockNode, { BlockFlowNode, STATUS_STYLE } from './BlockNode';
import ParamEditor from './ParamEditor';
import { PayloadSummary, ViewRenderer } from './WorkflowViews';
import { buildReportHtml } from './reportHtml';

const STORAGE_KEY = 'tectostress-workflow';
const LIBRARY_KEY = 'tectostress-workflow-library';
const DRAG_TYPE = 'application/tectostress-block';
const CATEGORY_ORDER = ['Sources', 'Processing', 'Control', 'My blocks', 'Report', 'Views'];
const EDGE_COLOR: Record<string, string> = { Dataset: '#0ea5e9', InversionResult: '#6366f1' };

const nodeTypes = { block: BlockNode };

const uid = () => Math.random().toString(36).slice(2, 8);

const emptyWorkflow = (): Workflow => ({ schemaVersion: WORKFLOW_SCHEMA_VERSION, name: 'New workflow', nodes: [], edges: [] });

function loadStoredWorkflow(registry: ReturnType<typeof createDefaultRegistry>): Workflow {
    try {
        const json = localStorage.getItem(STORAGE_KEY);
        if (json) return parseWorkflow(json, registry).workflow;
    } catch { /* unreadable or blocked storage: start empty */ }
    return emptyWorkflow();
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
        // A group from the library travels with the workflow from now on
        const groupDef = isCompositeType(type) && !workflow.composites?.some(c => c.type === type)
            ? library.find(c => c.type === type) : undefined;
        setWorkflow(wf => ({
            ...wf,
            nodes: [...wf.nodes, node],
            ...(groupDef ? { composites: [...(wf.composites ?? []), groupDef] } : {}),
        }));
        selectOnly(id);
        setSelectedEdgeId(null);
    }, [registry, files, workflow.nodes, workflow.composites, library]);

    const replaceWorkflow = useCallback((next: Workflow) => {
        setWorkflow(next);
        setReport(null);
        lastRunRef.current = undefined;
        selectOnly(null);
        setPendingReplace(null);
        setMessage(null);
        fitPending.current = true;
    }, []);

    // Fit a newly opened workflow once its blocks have been measured (fitting earlier, before they
    // have a size, zooms out to a speck)
    const fitPending = useRef(false);
    const nodesInitialized = useNodesInitialized();
    useEffect(() => {
        if (fitPending.current && nodesInitialized && workflow.nodes.length) {
            fitPending.current = false;
            fitView({ padding: 0.2 });
        }
    }, [nodesInitialized, workflow.nodes, fitView]);

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
            setLibrary(lib => [...lib.filter(c => c.type !== r.definition.type), r.definition]);
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
            setLibrary(lib => [...lib.filter(c => c.type !== r.definition.type), r.definition]);
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
        const outer = workflow.nodes.find(n => n.id === outerId(id));
        const outerName = outer ? outer.label || registry.get(outer.type)?.title || outer.type : id;
        if (outerId(id) === id) return outerName;
        const innerLocal = id.slice(outerId(id).length + 1);
        const inner = workflow.composites?.find(c => c.type === outer?.type)?.nodes.find(n => n.id === innerLocal);
        return `${outerName} › ${inner ? inner.label || registry.get(inner.type)?.title || inner.type : innerLocal}`;
    }, [workflow, registry]);

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

    const palette = useMemo(() => {
        const groups = new Map<string, BlockDefinition[]>();
        registry.list().forEach(b => groups.set(b.category, [...(groups.get(b.category) ?? []), b]));
        return Array.from(groups.entries()).sort(([a], [b]) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b));
    }, [registry]);

    /** A group shows the views it contains, then summaries of its outputs */
    const groupResult = (node: WorkflowNode) => {
        const groupDef = workflow.composites?.find(c => c.type === node.type);
        const result = results[node.id];
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
                    const r = results[`${node.id}/${inner.id}`];
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
                    {palette.map(([category, blocks]) => (
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
                                            onClick={e => { e.stopPropagation(); setLibrary(lib => lib.filter(c => c.type !== b.type)); }}
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}
                    <p className="text-[11px] text-gray-500">Drag a block onto the canvas, or click it. Cmd/Ctrl-click or Shift-drag on the canvas selects several blocks.</p>
                </div>

                <div ref={canvasRef} className="flex-1 relative" onDrop={onDrop} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}>
                    <ReactFlow
                        nodes={rfNodes}
                        edges={rfEdges}
                        nodeTypes={nodeTypes}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeClick={onNodeClick}
                        isValidConnection={isValidConnection}
                        onPaneClick={() => { selectOnly(null); setSelectedEdgeId(null); }}
                        fitView
                        minZoom={0.3}
                        deleteKeyCode={['Backspace', 'Delete']}
                    >
                        <Background gap={16} />
                        <Controls showInteractive={false} />
                    </ReactFlow>
                    {workflow.nodes.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center text-gray-500 text-sm">
                                <p>Add blocks from the palette,</p>
                                <p>or start from a predefined workflow.</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="w-80 border-l overflow-y-auto p-3 text-sm">
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

                            <div className="flex gap-2 pt-2 border-t">
                                {selectedDef?.role !== 'view' && (
                                    <button className={button} onClick={() => run(selected.id)} disabled={running || errors.length > 0}
                                        title="Run this block and what it needs">
                                        <SkipForward className="w-4 h-4" /> Run to here
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
                </div>
            </div>

            {/* Results */}
            <div className="border rounded-lg bg-white">
                <div className="flex border-b text-sm">
                    <button className={`px-4 py-2 ${bottomTab === 'result' ? 'border-b-2 border-blue-500 text-blue-700' : 'text-gray-600'}`}
                        onClick={() => setBottomTab('result')}>
                        Result{selected ? ` — ${selected.label || selectedDef?.title || selected.type}` : ''}
                    </button>
                    <button className={`px-4 py-2 inline-flex items-center gap-1 ${bottomTab === 'tagged' ? 'border-b-2 border-blue-500 text-blue-700' : 'text-gray-600'}`}
                        onClick={() => setBottomTab('tagged')}>
                        <Tag className="w-3.5 h-3.5" /> Tagged items ({tagged.length})
                    </button>
                </div>

                <div className="p-4">
                    {bottomTab === 'result' && (
                        !selected ? <p className="text-sm text-gray-500">Select a block to see its result.</p>
                        : !selectedResult || (selectedResult.status !== 'done' && !(selectedResult.status === 'inactive' && selectedResult.bypassed))
                            ? <p className="text-sm text-gray-500">
                                {selectedResult?.status === 'stale' ? 'Out of date: run the workflow to update it.'
                                    : selectedResult?.reason ?? selectedResult?.error ?? 'Not run yet.'}
                            </p>
                        : selectedDef?.role === 'view' ? (
                            <ViewNodeResult node={selected} def={selectedDef} result={selectedResult} registry={registry} />
                        ) : isCompositeType(selected.type) ? (
                            groupResult(selected)
                        ) : selectedDef?.role === 'report' && selectedResult.outputs.report?.type === 'Report' ? (
                            <ReportPanel
                                payload={selectedResult.outputs.report as ReportPayload}
                                labelOf={labelOf}
                            />
                        ) : (
                            <div className="space-y-4">
                                {Object.entries(selectedResult.outputs).map(([port, payload]) => (
                                    <div key={port} className="space-y-2">
                                        {(selectedDef?.outputs.length ?? 0) > 1 && (
                                            <div className="font-medium">{selectedDef?.outputs.find(o => o.id === port)?.label}</div>
                                        )}
                                        <PayloadSummary payload={payload} />
                                        <ProvenanceDetails provenance={payload.provenance} />
                                    </div>
                                ))}
                                {Object.keys(selectedResult.outputs).length === 0 && (
                                    <p className="text-sm text-gray-500">This block produced nothing.</p>
                                )}
                                <p className="text-xs text-gray-500">Connect a view block to this block to plot its result.</p>
                            </div>
                        )
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
                                                    <button className="text-xs underline" onClick={() => { selectOnly(outerId(item.nodeId)); setBottomTab('result'); }}>
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
