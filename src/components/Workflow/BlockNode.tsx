// BlockNode.tsx
// How a workflow block looks on the canvas: title, state, and one handle per port.

import React from 'react';
import { Handle, NodeProps, Position, Node } from '@xyflow/react';
import { BarChart3, Boxes, Cog, Database, FileText, GitBranch, Repeat, Tag } from 'lucide-react';
import {
    BlockDefinition, colorOf, describeAccepted, DATA_TYPES, FlowType, inputColors, isCompositeType, nameOf,
    NodeResult, NodeStatus, PayloadType, portBackground, PortDefinition, WorkflowNode,
} from '../../workflow';

export interface BlockNodeData extends Record<string, unknown> {
    node: WorkflowNode;
    def?: BlockDefinition;
    result?: NodeResult;
    /** Extra line under the title, e.g. why a block inside a group is not used */
    note?: string;
    /** Type actually carried by each output (a pass-through output takes the type it receives) */
    outputTypes?: Record<string, FlowType>;
    /** While a link is being dragged: whether each input would accept it (§16.4) */
    connectable?: Record<string, boolean>;
}

export type BlockFlowNode = Node<BlockNodeData, 'block'>;

export const STATUS_STYLE: Record<NodeStatus, { label: string; className: string }> = {
    idle: { label: 'Not run', className: 'bg-gray-100 text-gray-600' },
    stale: { label: 'Out of date', className: 'bg-amber-100 text-amber-800' },
    running: { label: 'Running', className: 'bg-blue-100 text-blue-700 animate-pulse' },
    done: { label: 'Done', className: 'bg-green-100 text-green-800' },
    error: { label: 'Failed', className: 'bg-red-100 text-red-700' },
    blocked: { label: 'Blocked', className: 'bg-orange-100 text-orange-800' },
    skipped: { label: 'Skipped', className: 'bg-gray-100 text-gray-400 italic' },
    inactive: { label: 'Off', className: 'bg-slate-200 text-slate-600' },
};

/**
 * Three families of blocks, each with one dark, muted colour for its icon and category word (§16.2).
 * The hues avoid those that already mean something: blue and purple (kinds of data), green, amber,
 * orange and red (states of a run), teal and orange (kept and rejected data in the views).
 */
export const BLOCK_FAMILIES = {
    source: { name: 'Sources', color: '#7c5a3a', meaning: 'where data enter' },
    computation: { name: 'Computation', color: '#334155', meaning: 'what transforms them' },
    output: { name: 'Outputs', color: '#9d174d', meaning: 'what you look at' },
} as const;
export type BlockFamily = keyof typeof BLOCK_FAMILIES;

/** Family of a palette category ("Sources", "Processing", "Views"…) */
export function familyOfCategory(category: string): BlockFamily {
    if (category === 'Sources') return 'source';
    if (category === 'Views' || category === 'Report') return 'output';
    return 'computation';
}

/**
 * The kind of block, shown by an icon and a word in the colour of its family. Blue and purple are
 * kept for the kinds of data (ports and links), the badge colours for the state of a run (§16.2).
 */
export function blockCategory(def: BlockDefinition | undefined): {
    word: string; Icon: React.FC<{ className?: string }>; family: BlockFamily;
} {
    if (!def) return { word: 'Unknown', Icon: Cog, family: 'computation' };
    if (isCompositeType(def.type)) {
        return def.params.some(p => p.key === 'maxIterations')
            ? { word: 'Loop', Icon: Repeat, family: 'computation' }
            : { word: 'Group', Icon: Boxes, family: 'computation' };
    }
    if (def.role === 'source') return { word: 'Source', Icon: Database, family: 'source' };
    if (def.role === 'view') return { word: 'View', Icon: BarChart3, family: 'output' };
    if (def.role === 'report') return { word: 'Report', Icon: FileText, family: 'output' };
    // Add Tags marks results for the report: filed with it, in the palette and on the canvas
    if (def.category === 'Report') return { word: 'Report', Icon: Tag, family: 'output' };
    if (def.category === 'Control') return { word: 'Control', Icon: GitBranch, family: 'computation' };
    return { word: 'Processing', Icon: Cog, family: 'computation' };
}

/** Tooltip of an input: what it accepts, and what the block does with each kind */
export function inputTooltip(port: PortDefinition): string {
    const lines = [`${port.label}: accepts ${describeAccepted(port)}${port.optional ? ' (optional)' : ''}`];
    Object.entries(port.meaning ?? {}).forEach(([type, text]) => {
        if (text) lines.push(`• ${DATA_TYPES[type as PayloadType].name}: ${text}`);
    });
    return lines.join('\n');
}

/** Vertical position of the i-th of n handles */
const handleTop = (i: number, n: number) => `${((i + 1) / (n + 1)) * 100}%`;

function Ports({ ports, side, types, connectable, oneOf }: {
    ports: PortDefinition[]; side: 'in' | 'out'; types?: Record<string, FlowType>; connectable?: Record<string, boolean>;
    /** Alternative inputs: one of them is required, so they are not drawn as optional */
    oneOf?: string[];
}) {
    return (
        <>
            {ports.map((port, i) => {
                // An input shows every kind it accepts; an output, the kind it produces
                const colors = side === 'in' ? inputColors(port) : [colorOf(types?.[port.id] ?? port.type)];
                const title = side === 'in' ? inputTooltip(port) : `${port.label}: ${nameOf(types?.[port.id] ?? port.type).toLowerCase()}`;
                const ok = side === 'in' ? connectable?.[port.id] : undefined;
                const hollow = port.optional && !oneOf?.includes(port.id);
                return (
                    <Handle
                        key={port.id}
                        id={port.id}
                        type={side === 'in' ? 'target' : 'source'}
                        position={side === 'in' ? Position.Left : Position.Right}
                        title={title}
                        style={{
                            top: handleTop(i, ports.length),
                            width: 12, height: 12,
                            // Optional inputs are hollow (a ring of their colour(s))
                            background: hollow ? 'white' : portBackground(colors),
                            border: hollow ? `3px solid ${colors[0]}` : '2px solid white',
                            ...(hollow && colors.length > 1 ? { borderColor: `${colors[0]} ${colors[1]} ${colors[1]} ${colors[0]}` } : {}),
                            // While a link is dragged: accepting inputs stand out, the others fade
                            ...(ok === true ? { boxShadow: '0 0 0 4px rgba(34,197,94,0.45)' } : {}),
                            ...(ok === false ? { opacity: 0.2 } : {}),
                        }}
                    />
                );
            })}
        </>
    );
}

const BlockNode: React.FC<NodeProps<BlockFlowNode>> = ({ data, selected }) => {
    const { node, def, result, note, outputTypes, connectable } = data;
    const category = blockCategory(def);
    const status: NodeStatus = !node.active ? 'inactive' : result?.status ?? 'idle';
    const style = STATUS_STYLE[status];
    const title = node.label || def?.title || node.type;

    // Port labels are shown when a side has several ports, so links are unambiguous. They get
    // their own column next to the title, and the block grows to fit them.
    const inCount = def?.inputs.length ?? 0;
    const outCount = def?.outputs.length ?? 0;
    const showInLabels = inCount > 1;
    const showOutLabels = outCount > 1;
    const minHeight = Math.max(inCount, outCount) > 1 ? 20 + Math.max(inCount, outCount) * 22 : undefined;

    const labelColumn = (ports: PortDefinition[], side: 'in' | 'out') => (
        <div className={`relative w-24 shrink-0 pointer-events-none ${side === 'in' ? 'order-first' : ''}`}>
            {ports.map((p, i) => (
                <div key={p.id} title={p.label}
                    className={`absolute ${side === 'in' ? 'left-2' : 'right-2 text-right'} -translate-y-1/2 max-w-[88px] truncate text-[10px] text-gray-500`}
                    style={{ top: handleTop(i, ports.length) }}>
                    {p.label}
                </div>
            ))}
        </div>
    );

    return (
        <div
            className={`relative flex rounded-lg bg-white shadow-sm border min-w-[170px] text-xs
                ${def ? 'border-gray-300' : 'border-red-500'}
                ${selected ? 'ring-2 ring-blue-400' : ''}
                ${node.active ? '' : 'opacity-60 border-dashed'}`}
            style={{ minHeight }}
        >
            {def && <Ports ports={def.inputs} side="in" connectable={connectable} oneOf={def.oneOfInputs} />}
            {def && showInLabels && labelColumn(def.inputs, 'in')}

            <div className="flex-1 min-w-0">
            <div className="px-3 pt-2 pb-1">
                <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide"
                    style={{ color: BLOCK_FAMILIES[category.family].color }}>
                    <category.Icon className="w-3 h-3" /> {category.word}
                </div>
                <div className="font-semibold text-gray-800 truncate" title={title}>{title}</div>
                {node.label && def && <div className="text-[10px] text-gray-500">{def.title}</div>}
                {!def && <div className="text-[10px] text-red-600">Unknown block type “{node.type}”</div>}
                {note && <div className="text-[10px] text-indigo-700 max-w-[180px]">{note}</div>}
            </div>

            <div className="px-3 pb-2 flex items-center gap-1 flex-wrap">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${style.className}`}>
                    {result?.bypassed ? 'Off (bypassed)' : style.label}
                </span>
                {result?.cached && status === 'done' && def?.role !== 'view' && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500">cached</span>
                )}
            </div>

            {status === 'running' && result?.progress != null && (
                <div className="mx-3 mb-2 h-1 bg-blue-100 rounded">
                    <div className="h-1 bg-blue-500 rounded" style={{ width: `${Math.round(result.progress * 100)}%` }} />
                </div>
            )}
            </div>

            {def && showOutLabels && labelColumn(def.outputs, 'out')}

            {def && <Ports ports={def.outputs} side="out" types={outputTypes} />}
        </div>
    );
};

export default React.memo(BlockNode);

// ---- Ports of an opened group (§13.1) -------------------------------------------------------

export interface PortNodeData extends Record<string, unknown> {
    side: 'in' | 'out';
    label: string;
    type: string;
    /** Group inputs: accepts `type` alone */
    exact?: boolean;
    optional?: boolean;
    /** Extra line, e.g. "replaces Data" or "→ next iteration" */
    note?: string;
}

export type PortFlowNode = Node<PortNodeData, 'port'>;

/**
 * An input or output of the opened group, drawn at the edge of its inner graph: where the outside
 * data comes in, and where results leave.
 */
export const PortNode: React.FC<NodeProps<PortFlowNode>> = React.memo(({ data, selected }) => {
    const port = { type: data.type as PayloadType | 'any', exact: data.exact };
    const colors = data.side === 'in' ? inputColors(port) : [colorOf(data.type as FlowType)];
    const color = colors[0];
    return (
        <div className={`relative rounded-full border-2 border-dashed bg-white px-3 py-1.5 text-xs min-w-[120px] max-w-[230px]
            ${selected ? 'ring-2 ring-blue-400' : ''}`} style={{ borderColor: color }}>
            <div className="font-semibold text-gray-700 truncate" title={data.label}>
                {data.side === 'in' ? '⇥ ' : ''}{data.label}{data.side === 'out' ? ' ⇥' : ''}
            </div>
            <div className="text-[10px] text-gray-500">
                {data.side === 'in' ? `Group input · accepts ${describeAccepted(port)}` : `Group output · ${nameOf(data.type as FlowType).toLowerCase()}`}
                {data.optional ? ', optional' : ''}
            </div>
            {data.note && <div className="text-[10px] text-indigo-700">{data.note}</div>}
            <Handle
                type={data.side === 'in' ? 'source' : 'target'}
                position={data.side === 'in' ? Position.Right : Position.Left}
                id="port"
                style={{
                    width: 10, height: 10,
                    background: data.optional ? 'white' : portBackground(colors),
                    border: data.optional ? `2px solid ${color}` : '2px solid white',
                }}
            />
        </div>
    );
});
