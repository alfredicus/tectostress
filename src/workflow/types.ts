// types.ts
// Core types of the workflow engine (see doc/workflow-spec.md).
// Plain TypeScript, no React: the engine runs and is tested without any UI.

import { DataFile } from '../components/DataFile';
import { StressSolution } from '../components/types';
import { InversionRun } from '../inversion/InversionService';

// ============================================================================
// PAYLOADS (what an arrow carries, §4.2)
// ============================================================================

export type PayloadType = 'Dataset' | 'InversionResult' | 'Report';

/** Direct supertype of each payload type: an InversionResult *is a* Dataset. */
const SUPERTYPE: Record<PayloadType, PayloadType | null> = {
    Dataset: null,
    InversionResult: 'Dataset',
    Report: null,
};

/** True when a value of type `type` can be used where `expected` is required. */
export function isSubtypeOf(type: PayloadType, expected: PayloadType): boolean {
    for (let t: PayloadType | null = type; t; t = SUPERTYPE[t]) {
        if (t === expected) return true;
    }
    return false;
}

/** Reference to a Data-tab file, as stored in a workflow and in provenance records. */
export interface SourceFileRef {
    id: string;
    name: string;
    contentHash: string;
    rowCount?: number;
}

/** How a value was produced (§4.7). */
export interface Provenance {
    /** Deterministic id: identical inputs and scientific parameters give the same id */
    id: string;
    blockId: string;
    blockType: string;
    blockVersion: number;
    scientificParams: Record<string, unknown>;
    /** Provenance ids of the values this one was computed from */
    inputs: string[];
    /** Set by source blocks */
    sourceFiles?: SourceFileRef[];
    stressLibVersion: string;
    appVersion: string;
    startedAt: string;
    durationMs: number;
}

/** Row-level link back to the Data-tab file and row a row came from. */
export interface RowOrigin {
    fileId: string;
    rowIndex: number;
}

export interface DatasetPayload {
    type: 'Dataset';
    /** Same shape as the Data tab. Every row carries `_origin: RowOrigin`. */
    files: DataFile[];
    provenance: Provenance;
}

export interface InversionResultPayload {
    type: 'InversionResult';
    /**
     * The inverted rows, enriched with `predicted_normal` / `predicted_striation`,
     * `misfit_angle` and `misfit_category`; every file carries `stressAxes`.
     */
    files: DataFile[];
    solution: StressSolution;
    /** Parameter / value / unit rows describing the solution (read by the MCMC stats view) */
    resultsFile: DataFile;
    /** Library objects of the run, for views that need them (Mohr, misfit landscape) */
    run: Pick<InversionRun, 'data' | 'engine' | 'origins'>;
    method: string;
    methodParams: Record<string, number>;
    provenance: Provenance;
}

/** A value kept for the report, with how it was obtained (§11.2) */
export interface ReportItem {
    tag: string;
    note?: string;
    nodeId: string;
    nodeLabel: string;
    /** Tagged inside a ForLoop: the iteration that produced it */
    iteration?: number;
    outdated: boolean;
    payload: DataPayload;
    /** Every step from the source files to this value, sources first */
    lineage: Provenance[];
}

export interface ReportDocument {
    title: string;
    author?: string;
    createdAt: string;
    workflowName: string;
    appVersion: string;
    stressLibVersion: string;
    /** Tags asked for (empty: all) */
    tags: string[];
    includeTables: boolean;
    includeProvenance: boolean;
    items: ReportItem[];
    warnings: string[];
}

export interface ReportPayload {
    type: 'Report';
    document: ReportDocument;
    provenance: Provenance;
}

/** Payloads made of data rows */
export type DataPayload = DatasetPayload | InversionResultPayload;

export type Payload = DataPayload | ReportPayload;

/** A payload before the engine attaches its provenance */
export type PayloadBody =
    | Omit<DatasetPayload, 'provenance'>
    | Omit<InversionResultPayload, 'provenance'>
    | Omit<ReportPayload, 'provenance'>;

// ============================================================================
// BLOCK DEFINITIONS (§4.3, §4.4, §5)
// ============================================================================

export type BlockRole = 'source' | 'computation' | 'view' | 'report';

export interface PortDefinition {
    id: string;
    label: string;
    /** 'any' accepts every payload type */
    type: PayloadType | 'any';
    /** Input ports only: accepts several connections (e.g. Dashboard) */
    multiple?: boolean;
    /** Input ports only: an unconnected optional port does not block the block */
    optional?: boolean;
    /** Output ports only: the output has the type of the payload received on this input port */
    sameAs?: string;
}

/**
 * Scientific parameters change results: editing one makes the block and its downstream stale.
 * Presentation parameters (views only) never do.
 */
export type ParamScope = 'scientific' | 'presentation';

export type ParamKind =
    | 'number' | 'boolean' | 'string' | 'select' | 'multiselect'
    /** References to Data-tab files (SourceFileRef[]) */
    | 'files'
    /** Parameters of the search method chosen in the parameter named by `dependsOn` */
    | 'methodParams'
    /** Opaque value managed by the UI (e.g. a visualization's saved state) */
    | 'object';

export interface ParamDefinition {
    key: string;
    label: string;
    kind: ParamKind;
    scope: ParamScope;
    default: unknown;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    options?: { value: string; label: string }[];
    dependsOn?: string;
    help?: string;
}

export type LogLevel = 'info' | 'success' | 'warning' | 'error';

export interface LogEntry {
    level: LogLevel;
    message: string;
    details?: string;
    time: string;
}

/** What a block's execute() receives */
export interface BlockContext {
    nodeId: string;
    /** Scientific parameters, defaults filled in (and normalized, see normalizeParams) */
    params: Record<string, any>;
    /** Payloads received on each input port (several for `multiple` ports) */
    inputs: Record<string, DataPayload[]>;
    env: WorkflowEnvironment;
    signal?: AbortSignal;
    log(level: LogLevel, message: string, details?: string): void;
    /** Progress of this block, in [0, 1] */
    progress(fraction: number, message?: string): void;
    /** Keep a value for a report (§4.10) */
    tag(tag: string, note: string | undefined, payload: DataPayload): void;
    /** Set when the block runs inside a ForLoop (§12) */
    loop?: LoopContext;
    /** The workflow being run (read only) */
    workflow: Workflow;
    /** Report blocks: the tagged items of this run, including outdated ones */
    tagged: TaggedItem[];
    /** Provenance record of any value produced in this run (or kept from the previous one) */
    provenance(id: string): Provenance | undefined;
}

export interface BlockResult {
    /** One payload per output port; a missing port produces nothing */
    outputs: Record<string, PayloadBody | Payload>;
    /** Source blocks: the files read */
    sourceFiles?: SourceFileRef[];
    /** Provenance ids this result depends on, when they do not come through input ports */
    provenanceInputs?: string[];
    /** Output ports deliberately left empty (a Conditional's branch not taken): downstream is skipped */
    skip?: string[];
    /** ExitLoop: ask the enclosing ForLoop to stop after this iteration */
    exitLoop?: boolean;
}

/** What a block sees of the ForLoop it runs in (§12) */
export interface LoopContext {
    /** 1 for the first iteration */
    iteration: number;
    /** The value this block received on a port at the previous iteration */
    previousInput(port: string): DataPayload | undefined;
}

export interface LoopIterationSummary {
    iteration: number;
    /** Data carried into the iteration */
    rowsIn: number;
    /** Data carried out, to the next iteration */
    rowsOut?: number;
    /** Of the first inversion result of the iteration */
    misfit?: number;
    misfitCriterion?: string;
    stressRatio?: number;
}

export interface LoopSummary {
    iterations: LoopIterationSummary[];
    stoppedBy: 'exit' | 'max' | 'empty' | 'no-value' | 'cancelled';
}

export interface BlockDefinition {
    type: string;
    /** Bumped when parameters or behaviour change; saved workflows record it (§4.8) */
    version: number;
    title: string;
    description?: string;
    category: string;
    role: BlockRole;
    inputs: PortDefinition[];
    outputs: PortDefinition[];
    params: ParamDefinition[];
    /**
     * When inactive, pass the payload received on `from` straight to `to` instead of stopping
     * the branch (§4.5). Only declared where input and output types are compatible.
     */
    bypass?: { from: string; to: string };
    /**
     * The block hands its input over unchanged (with its provenance), and only has side effects
     * such as tagging. It is re-run every time and never cached, and changing its parameters
     * never makes downstream blocks stale.
     */
    passThrough?: boolean;
    /** Visualization descriptor id rendered by a view block */
    visualization?: string;
    /** Normalize scientific parameters before hashing and execution (e.g. fill method defaults) */
    normalizeParams?(params: Record<string, any>): Record<string, any>;
    /** Extra cache-key material, e.g. the content hash of the files a source block reads */
    cacheKeyExtra?(params: Record<string, any>, env: WorkflowEnvironment): unknown;
    /** Upgrade the parameters saved by an older version of this block */
    migrate?(params: { scientific: Record<string, any>; presentation: Record<string, any> }, fromVersion: number):
        { scientific: Record<string, any>; presentation: Record<string, any> };
    execute?(ctx: BlockContext): Promise<BlockResult>;
}

// ============================================================================
// WORKFLOW MODEL (§4.1, §4.8)
// ============================================================================

export interface WorkflowNode {
    id: string;
    type: string;
    typeVersion: number;
    label?: string;
    active: boolean;
    scientificParams: Record<string, any>;
    presentationParams: Record<string, any>;
    position: { x: number; y: number };
}

export interface WorkflowEdge {
    id: string;
    source: string;
    sourcePort: string;
    target: string;
    targetPort: string;
}

/** A port of a composite block, mapped onto ports of its inner blocks (§11.3) */
export interface CompositePort {
    id: string;
    label: string;
    type: PayloadType | 'any';
    /** Inputs only: the inner port it feeds is optional */
    optional?: boolean;
}

/** A reusable group of blocks, used as a single block (§11.3) */
export interface CompositeDefinition {
    /** Block type of the composite: `composite:<id>` */
    type: string;
    version: number;
    title: string;
    description?: string;
    /** Inner graph; ids are local to the composite */
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    /**
     * Each input feeds one or more inner input ports. An optional input may `replace` the output of
     * an inner source block (e.g. a Data block): connected, it feeds that block's consumers instead.
     */
    inputs: (CompositePort & {
        targets: { node: string; port: string }[];
        replaces?: { node: string; port: string };
    })[];
    /** Set for a ForLoop (§12): the group is repeated instead of being run once */
    loop?: {
        /** Input fed, from the second iteration on, with the value of `carriedOutput` */
        carriedInput: string;
        /** Output whose value is passed to the next iteration */
        carriedOutput: string;
    };
    /** Each output comes from one inner output port */
    outputs: (CompositePort & { source: { node: string; port: string } })[];
}

export interface Workflow {
    schemaVersion: number;
    name: string;
    description?: string;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    /** Definitions of the composite blocks used, so a file is self-contained */
    composites?: CompositeDefinition[];
}

/** What the engine needs from the application */
export interface WorkflowEnvironment {
    /** Files of the Data tab */
    files: DataFile[];
    appVersion: string;
    stressLibVersion: string;
}

// ============================================================================
// EXECUTION (§4.6)
// ============================================================================

export type NodeStatus =
    | 'idle'      // never run
    | 'stale'     // its result no longer matches its parameters or inputs
    | 'running'
    | 'done'
    | 'error'
    | 'blocked'   // cannot run: an input is missing, errored, inactive or stale
    | 'skipped'   // on a Conditional branch not taken (§12.4)
    | 'inactive'; // switched off (bypassed or stopping its branch)

export interface NodeResult {
    status: NodeStatus;
    /** Cache key of the last computation */
    key?: string;
    /** Taken from the cache instead of being computed */
    cached?: boolean;
    /** Inactive block whose input was passed through */
    bypassed?: boolean;
    inputs: Record<string, DataPayload[]>;
    outputs: Record<string, Payload>;
    error?: string;
    /** Why the block is blocked */
    reason?: string;
    progress?: number;
    progressMessage?: string;
    logs: LogEntry[];
    durationMs?: number;
    /** Output ports left empty on purpose (Conditional) */
    skippedPorts?: string[];
    /** ExitLoop asked its loop to stop */
    exitLoop?: boolean;
    /** ForLoop: what each iteration did */
    loop?: LoopSummary;
}

export interface TaggedItem {
    tag: string;
    note?: string;
    nodeId: string;
    payload: DataPayload;
    /** Tagged inside a ForLoop: the iteration that produced it */
    iteration?: number;
    /** Its branch did not produce a fresh value in the last run (stale, blocked, errored…) */
    outdated: boolean;
}

export interface WorkflowRunReport {
    nodes: Record<string, NodeResult>;
    tagged: TaggedItem[];
    startedAt: string;
    finishedAt: string;
    cancelled: boolean;
    /** Plan only: nothing was executed (see RunOptions.dryRun) */
    dryRun: boolean;
}
