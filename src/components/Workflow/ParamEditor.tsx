// ParamEditor.tsx
// Editors for block parameters, generated from their declarations.

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { DataFile } from '../DataFile';
import { CONFIG_DATA } from '../../inversion/methods';
import { fileRef, ParamDefinition, SourceFileRef } from '../../workflow';
import { resolveFileRef } from '../../workflow/blocks/datasetUtils';

interface Props {
    param: ParamDefinition;
    value: any;
    /** All scientific parameters of the block (for `dependsOn`) */
    siblings: Record<string, any>;
    files: DataFile[];
    onChange(value: any): void;
}

const inputClass = 'w-full border rounded px-2 py-1 text-sm';

function FilesEditor({ value, files, onChange }: { value: SourceFileRef[]; files: DataFile[]; onChange(v: SourceFileRef[]): void }) {
    const refs = Array.isArray(value) ? value : [];
    const resolved = refs.map(ref => ({ ref, r: resolveFileRef(ref, files) }));
    const selectedIds = new Set(resolved.flatMap(({ r }) => r.status !== 'missing' ? [r.file.id] : []));

    const toggle = (file: DataFile) => {
        onChange(selectedIds.has(file.id)
            ? resolved.filter(({ r }) => r.status === 'missing' || r.file.id !== file.id).map(({ ref }) => ref)
            : [...refs, fileRef(file)]);
    };

    return (
        <div className="space-y-1">
            {files.length === 0 && <p className="text-xs text-gray-500 italic">No file in the Data tab</p>}
            {files.map(file => (
                <label key={file.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={selectedIds.has(file.id)} onChange={() => toggle(file)} />
                    <span className="truncate">{file.name}</span>
                    <span className="text-xs text-gray-400">({file.content.length} rows)</span>
                </label>
            ))}
            {resolved.filter(({ r }) => r.status !== 'ok').map(({ ref, r }) => (
                <div key={ref.id} className="flex items-start gap-1 text-xs text-amber-800 bg-amber-50 rounded p-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <div className="flex-1">
                        {r.status === 'missing'
                            ? <>“{ref.name}” is not in the Data tab.</>
                            : <>“{ref.name}” has changed since it was selected.</>}
                        <div className="flex gap-2 mt-1">
                            {r.status === 'changed' && (
                                <button className="underline" onClick={() =>
                                    onChange(refs.map(x => x === ref ? fileRef(r.file) : x))}>
                                    Use the current version
                                </button>
                            )}
                            <button className="underline" onClick={() => onChange(refs.filter(x => x !== ref))}>Remove</button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function MethodParamsEditor({ method, value, onChange }: { method: string; value: Record<string, number>; onChange(v: Record<string, number>): void }) {
    const config = CONFIG_DATA.search.list.find(m => m.name === method);
    if (!config || config.params.length === 0) return <p className="text-xs text-gray-500 italic">No parameter</p>;
    const current = value ?? {};
    return (
        <div className="space-y-2">
            {config.params.map(p => (
                <label key={p.name} className="block">
                    <span className="text-xs text-gray-600">{p.display}</span>
                    <input
                        type="number" className={inputClass} min={p.min} max={p.max}
                        value={current[p.name] ?? p.value}
                        onChange={e => {
                            const v = e.target.value === '' ? undefined : Number(e.target.value);
                            const next = { ...current };
                            if (v === undefined || Number.isNaN(v)) delete next[p.name]; else next[p.name] = v;
                            onChange(next);
                        }}
                    />
                </label>
            ))}
        </div>
    );
}

const ParamEditor: React.FC<Props> = ({ param, value, siblings, files, onChange }) => {
    switch (param.kind) {
        case 'number':
            return (
                <div className="flex items-center gap-2">
                    <input
                        type="number" className={inputClass}
                        min={param.min} max={param.max} step={param.step}
                        value={value ?? ''}
                        onChange={e => onChange(e.target.value === '' ? param.default : Number(e.target.value))}
                    />
                    {param.unit && <span className="text-sm text-gray-500">{param.unit}</span>}
                </div>
            );
        case 'boolean':
            return <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} />;
        case 'string':
            return <input type="text" className={inputClass} value={value ?? ''} onChange={e => onChange(e.target.value)} />;
        case 'select':
            return (
                <select className={inputClass} value={value ?? ''} onChange={e => onChange(e.target.value)}>
                    {param.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            );
        case 'multiselect': {
            const selected: string[] = Array.isArray(value) ? value : [];
            return (
                <div className="space-y-1">
                    {param.options?.map(o => (
                        <label key={o.value} className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox" checked={selected.includes(o.value)}
                                onChange={() => onChange(selected.includes(o.value)
                                    ? selected.filter(v => v !== o.value)
                                    : [...selected, o.value])}
                            />
                            {o.label}
                        </label>
                    ))}
                </div>
            );
        }
        case 'files':
            return <FilesEditor value={value} files={files} onChange={onChange} />;
        case 'methodParams':
            return <MethodParamsEditor method={siblings[param.dependsOn ?? 'method']} value={value} onChange={onChange} />;
        default:
            return null;
    }
};

export default ParamEditor;
