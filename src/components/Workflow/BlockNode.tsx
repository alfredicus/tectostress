// BlockNode.tsx
// How a workflow block looks on the canvas: title, state, and one handle per port.

import React from 'react';
import { Handle, NodeProps, Position, Node } from '@xyflow/react';
import { BlockDefinition, NodeResult, NodeStatus, PortDefinition, WorkflowNode } from '../../workflow';

export interface BlockNodeData extends Record<string, unknown> {
    node: WorkflowNode;
    def?: BlockDefinition;
    result?: NodeResult;
    /** Extra line under the title, e.g. why a block inside a group is not used */
    note?: string;
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

const ROLE_ACCENT: Record<string, string> = {
    source: 'border-t-sky-500',
    computation: 'border-t-indigo-500',
    view: 'border-t-emerald-500',
    report: 'border-t-purple-500',
};

const PORT_COLOR: Record<string, string> = {
    Dataset: '#0ea5e9',
    InversionResult: '#6366f1',
    any: '#94a3b8',
};

/** Vertical position of the i-th of n handles */
const handleTop = (i: number, n: number) => `${((i + 1) / (n + 1)) * 100}%`;

function Ports({ ports, side }: { ports: PortDefinition[]; side: 'in' | 'out' }) {
    return (
        <>
            {ports.map((port, i) => (
                <Handle
                    key={port.id}
                    id={port.id}
                    type={side === 'in' ? 'target' : 'source'}
                    position={side === 'in' ? Position.Left : Position.Right}
                    title={`${port.label} (${port.type === 'any' ? 'any value' : port.type}${port.optional ? ', optional' : ''})`}
                    style={{
                        top: handleTop(i, ports.length),
                        width: 10, height: 10,
                        // Optional inputs are hollow
                        background: port.optional ? 'white' : PORT_COLOR[port.type] ?? '#94a3b8',
                        border: port.optional ? `2px solid ${PORT_COLOR[port.type] ?? '#94a3b8'}` : '2px solid white',
                    }}
                />
            ))}
        </>
    );
}

const BlockNode: React.FC<NodeProps<BlockFlowNode>> = ({ data, selected }) => {
    const { node, def, result, note } = data;
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
            className={`relative flex rounded-lg bg-white shadow-sm border border-t-4 min-w-[170px] text-xs
                ${def ? ROLE_ACCENT[def.role] : 'border-t-red-500'}
                ${selected ? 'ring-2 ring-blue-400' : ''}
                ${node.active ? '' : 'opacity-60 border-dashed'}`}
            style={{ minHeight }}
        >
            {def && <Ports ports={def.inputs} side="in" />}
            {def && showInLabels && labelColumn(def.inputs, 'in')}

            <div className="flex-1 min-w-0">
            <div className="px-3 pt-2 pb-1">
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

            {def && <Ports ports={def.outputs} side="out" />}
        </div>
    );
};

export default React.memo(BlockNode);

// ---- Ports of an opened group (§13.1) -------------------------------------------------------

export interface PortNodeData extends Record<string, unknown> {
    side: 'in' | 'out';
    label: string;
    type: string;
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
    const color = PORT_COLOR[data.type] ?? '#94a3b8';
    return (
        <div className={`relative rounded-full border-2 border-dashed bg-white px-3 py-1.5 text-xs min-w-[120px] max-w-[230px]
            ${selected ? 'ring-2 ring-blue-400' : ''}`} style={{ borderColor: color }}>
            <div className="font-semibold text-gray-700 truncate" title={data.label}>
                {data.side === 'in' ? '⇥ ' : ''}{data.label}{data.side === 'out' ? ' ⇥' : ''}
            </div>
            <div className="text-[10px] text-gray-500">
                {data.side === 'in' ? 'Group input' : 'Group output'} · {data.type === 'any' ? 'any value' : data.type}
                {data.optional ? ', optional' : ''}
            </div>
            {data.note && <div className="text-[10px] text-indigo-700">{data.note}</div>}
            <Handle
                type={data.side === 'in' ? 'source' : 'target'}
                position={data.side === 'in' ? Position.Right : Position.Left}
                id="port"
                style={{
                    width: 10, height: 10,
                    background: data.optional ? 'white' : color,
                    border: data.optional ? `2px solid ${color}` : '2px solid white',
                }}
            />
        </div>
    );
});
