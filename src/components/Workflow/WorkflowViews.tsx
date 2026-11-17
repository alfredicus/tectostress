// WorkflowViews.tsx
// Renders view blocks with the existing visualization components, and summarizes any payload.

import React, { useMemo } from 'react';
import { DataFile } from '../DataFile';
import StereonetComponent from '../Stereonet/StereonetComponent';
import SphereComponent from '../Sphere/SphereComponent';
import RoseDiagramComponent from '../Rose/RoseDiagramComponent';
import HistogramComponent from '../Histo/HistogramComponent';
import MisfitHistogramComponent from '../Histo/MisfitHistogramComponent';
import InversionMohrComponent from '../Mohr/InversionMohrComponent';
import ParameterSpaceLandscapeComponent from '../ParameterSpace/ParameterSpaceLandscapeComponent';
import MCMCStatsComponent from '../MCMCStats/MCMCStatsComponent';
import {
    BlockRegistry, DataPayload, InversionResultPayload, Payload, portAccepts, DATA_TYPES,
    POPULATION_STYLE, ShowPopulation, classification, inversionData, populationOf, selectPopulation,
} from '../../workflow';
import { countRows } from '../../workflow/blocks/datasetUtils';

const rowsOf = (files: DataFile[]) => files.flatMap(f => (f.content as any[]) ?? []);

const isInversion = (p: Payload): p is InversionResultPayload => p.type === 'InversionResult';

/** Key figures of an inversion result */
export function InversionSummary({ payload }: { payload: InversionResultPayload }) {
    const s = payload.solution;
    const misfit = s.misfitCriterion === 'DOT' ? s.misfit.toFixed(4) : `${(s.misfit * 180).toFixed(1)}°`;
    const axes = s.analysis?.principalStresses;
    const cell = 'p-3 rounded-lg';
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className={`${cell} bg-blue-50`}>
                    <div className="text-xs text-blue-800">Stress ratio</div>
                    <div className="text-xl font-bold">{s.stressRatio.toFixed(2)}</div>
                </div>
                <div className={`${cell} bg-green-50`}>
                    <div className="text-xs text-green-800">Fit</div>
                    <div className="text-xl font-bold">{((1 - s.misfit) * 100).toFixed(1)}%</div>
                </div>
                <div className={`${cell} bg-amber-50`}>
                    <div className="text-xs text-amber-800">Misfit</div>
                    <div className="text-xl font-bold">{misfit}</div>
                </div>
                <div className={`${cell} bg-gray-50`}>
                    <div className="text-xs text-gray-700">Data</div>
                    <div className="text-xl font-bold">{countRows(payload.files)}</div>
                </div>
            </div>
            {axes && (
                <table className="text-sm">
                    <tbody>
                        {(['sigma1', 'sigma2', 'sigma3'] as const).map((k, i) => (
                            <tr key={k}>
                                <td className="pr-3 font-medium">σ{i + 1}</td>
                                <td className="pr-3 text-gray-600">value {axes[k].value.toFixed(3)}</td>
                                <td className="text-gray-600">direction [{axes[k].direction.map((v: number) => v.toFixed(3)).join(', ')}]</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            <div className="text-xs text-gray-500">Method: {payload.method}</div>
        </div>
    );
}

/** Kept and rejected after a Misfit filter (§14.4): counts and misfit of each population */
function PopulationStats({ payload }: { payload: InversionResultPayload }) {
    const rows = rowsOf(payload.files);
    const stats = (['kept', 'rejected'] as const).map(p => {
        const angles = rows.filter(r => populationOf(r) === p && typeof r.misfit_angle === 'number').map(r => r.misfit_angle as number);
        const count = rows.filter(r => populationOf(r) === p).length;
        const mean = angles.length ? angles.reduce((a, b) => a + b, 0) / angles.length : undefined;
        const sorted = [...angles].sort((a, b) => a - b);
        const median = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : undefined;
        return { p, count, mean, median, max: sorted[sorted.length - 1] };
    }).filter(s => s.count > 0);
    const fmt = (v?: number) => v === undefined ? '—' : `${v.toFixed(1)}°`;
    return (
        <table className="text-sm">
            <thead><tr className="text-left text-gray-600">
                <th className="pr-4 py-1">Population</th><th className="pr-4">Data</th>
                <th className="pr-4">Mean misfit</th><th className="pr-4">Median</th><th className="pr-4">Max</th>
            </tr></thead>
            <tbody>
                {stats.map(s => (
                    <tr key={s.p} className="border-t">
                        <td className="pr-4 py-1">
                            <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-middle" style={{ backgroundColor: POPULATION_STYLE[s.p].color }} />
                            {POPULATION_STYLE[s.p].label}
                        </td>
                        <td className="pr-4">{s.count}</td><td className="pr-4">{fmt(s.mean)}</td>
                        <td className="pr-4">{fmt(s.median)}</td><td className="pr-4">{fmt(s.max)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

/** Which populations a view shows, with the threshold */
function PopulationLegend({ payload, show }: { payload: DataPayload; show: ShowPopulation }) {
    const c = classification(payload);
    if (!c.classified) return null;
    const shown = (['kept', 'rejected'] as const).filter(p => show === 'both' || show === p);
    return (
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-700 mb-2">
            {shown.map(p => (
                <span key={p} className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: POPULATION_STYLE[p].color }} />
                    {POPULATION_STYLE[p].label} ({c.counts[p]})
                </span>
            ))}
            {c.threshold !== undefined && <span className="text-gray-500">misfit threshold {c.threshold}°</span>}
            {show !== 'both' && <span className="text-gray-500">· showing {POPULATION_STYLE[show].label.toLowerCase()} data only</span>}
        </div>
    );
}

/** Mohr diagram of exactly the data received, coloured by population when both are shown */
function MohrView({ payload, grouped }: { payload: InversionResultPayload; grouped: boolean }) {
    const { data, groups } = useMemo(() => {
        const entries = inversionData(payload);
        const groups = grouped ? new Map(entries.filter(e => e.population).map(e => [e.datum, e.population as string])) : undefined;
        return { data: entries.map(e => e.datum), groups };
    }, [payload, grouped]);
    return <InversionMohrComponent solution={payload.solution} data={data} groupByDatum={groups} groupStyles={grouped ? POPULATION_STYLE : undefined} />;
}

/** Short description of a payload, for blocks that are not views */
export function PayloadSummary({ payload }: { payload: Payload }) {
    if (payload.type === 'Report') {
        return <div className="text-sm"><span className="font-medium">Report</span> · {payload.document.items.length} item(s)</div>;
    }
    return (
        <div className="space-y-2">
            <div className="text-sm">
                <span className="font-medium">{payload.type === 'InversionResult' ? 'Inversion result' : 'Dataset'}</span>
                {' · '}{countRows(payload.files)} rows in {payload.files.length} file(s)
            </div>
            {isInversion(payload) && <InversionSummary payload={payload} />}
        </div>
    );
}

const Sized: React.FC<{ height?: number; children: React.ReactNode }> = ({ height = 620, children }) => (
    <div style={{ height }} className="border rounded-lg bg-white">{children}</div>
);

/**
 * One view block type rendering one payload. Returns null when the payload does not fit the view.
 * After a Misfit filter, `show` picks the population(s); both are distinguished (§14.4).
 */
export function ViewRenderer({ viewType, payload: received, registry, show = 'both' }: {
    viewType: string; payload: DataPayload; registry: BlockRegistry; show?: ShowPopulation;
}) {
    const def = registry.get(viewType);
    if (!def) return null;
    // A view needing a stress solution, given measured data (e.g. in a Dashboard): say so (§16.3)
    if (!def.inputs.some(p => portAccepts(p, received.type))) {
        return (
            <p className="text-sm text-gray-500 italic">
                Needs an inversion result: {DATA_TYPES.Dataset.plural} have no stress solution yet.
            </p>
        );
    }
    const view = renderView(viewType, received, show);
    return view && (
        <div>
            <PopulationLegend payload={received} show={show} />
            {view}
        </div>
    );
}

function renderView(viewType: string, received: DataPayload, show: ShowPopulation) {
    const payload = selectPopulation(received, show);
    const c = classification(payload);
    // Both populations present and shown: each view distinguishes them
    const grouped = c.classified && show === 'both' && c.counts.kept > 0 && c.counts.rejected > 0;
    const groupProps = grouped ? { groupField: 'misfit_class', groupStyles: POPULATION_STYLE } : {};
    const key = `${payload.provenance.id}-${show}`;

    switch (viewType) {
        case 'view.stereonet':
            return <Sized key={key}><StereonetComponent files={payload.files} width={560} height={560} autoEnable={true} {...groupProps} /></Sized>;
        case 'view.sphere':
            // The principal values are in the results file (the files carry only the directions):
            // without it the sphere cannot place the data in the principal frame (no slip lines)
            return <Sized key={key}><SphereComponent files={isInversion(payload) ? [...payload.files, payload.resultsFile] : payload.files} width={560} height={560} autoEnable={true} {...groupProps} /></Sized>;
        case 'view.rose':
            return <Sized key={key} height={520}><RoseDiagramComponent files={payload.files} width={500} height={480} /></Sized>;
        case 'view.histogram':
            return <Sized key={key} height={460}><HistogramComponent files={payload.files} width={600} height={420} /></Sized>;
    }

    if (!isInversion(payload)) return null;
    switch (viewType) {
        case 'view.summary':
            return (
                <div key={key} className="space-y-3">
                    <InversionSummary payload={payload} />
                    {c.classified && <PopulationStats payload={payload} />}
                </div>
            );
        case 'view.misfit-histogram': {
            const predicted = rowsOf(payload.files).filter(r => typeof r.misfit_angle === 'number' && Number.isFinite(r.misfit_angle));
            const misfits = predicted.map(r => ({ category: r.misfit_category ?? 'Other', angle: r.misfit_angle as number }));
            const populations = c.classified ? {
                kept: predicted.filter(r => populationOf(r) === 'kept').map(r => r.misfit_angle as number),
                rejected: predicted.filter(r => populationOf(r) === 'rejected').map(r => r.misfit_angle as number),
                threshold: c.threshold,
                style: POPULATION_STYLE,
            } : undefined;
            return misfits.length
                ? <MisfitHistogramComponent key={key} misfits={misfits} totalData={countRows(payload.files)} populations={populations} />
                : <p className="text-sm text-gray-500 italic">No predicted data</p>;
        }
        case 'view.mohr':
            return payload.solution.analysis
                ? <MohrView key={key} payload={payload} grouped={grouped} />
                : null;
        case 'view.landscape':
            return <ParameterSpaceLandscapeComponent key={key} data={payload.run.data} engine={payload.run.engine}
                solution={payload.solution} misfitCriterion={payload.solution.misfitCriterion ?? 'ANGLE'} />;
        case 'view.mcmc-stats':
            return <MCMCStatsComponent key={key} files={[...payload.files, payload.resultsFile]} inline={true} />;
    }
    return null;
}
