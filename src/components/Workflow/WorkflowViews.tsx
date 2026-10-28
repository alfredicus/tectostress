// WorkflowViews.tsx
// Renders view blocks with the existing visualization components, and summarizes any payload.

import React from 'react';
import { DataFile } from '../DataFile';
import StereonetComponent from '../Stereonet/StereonetComponent';
import SphereComponent from '../Sphere/SphereComponent';
import RoseDiagramComponent from '../Rose/RoseDiagramComponent';
import HistogramComponent from '../Histo/HistogramComponent';
import MisfitHistogramComponent from '../Histo/MisfitHistogramComponent';
import InversionMohrComponent from '../Mohr/InversionMohrComponent';
import ParameterSpaceLandscapeComponent from '../ParameterSpace/ParameterSpaceLandscapeComponent';
import MCMCStatsComponent from '../MCMCStats/MCMCStatsComponent';
import { BlockRegistry, DataPayload, InversionResultPayload, Payload, isSubtypeOf, PayloadType } from '../../workflow';
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

/** One view block type rendering one payload. Returns null when the payload does not fit the view. */
export function ViewRenderer({ viewType, payload, registry }: { viewType: string; payload: DataPayload; registry: BlockRegistry }) {
    const def = registry.get(viewType);
    const expected = def?.inputs[0]?.type;
    if (!def || (expected && expected !== 'any' && !isSubtypeOf(payload.type, expected as PayloadType))) {
        return null;
    }
    const key = payload.provenance.id;

    switch (viewType) {
        case 'view.stereonet':
            return <Sized key={key}><StereonetComponent files={payload.files} width={560} height={560} autoEnable={true} /></Sized>;
        case 'view.sphere':
            return <Sized key={key}><SphereComponent files={payload.files} width={560} height={560} autoEnable={true} /></Sized>;
        case 'view.rose':
            return <Sized key={key} height={520}><RoseDiagramComponent files={payload.files} width={500} height={480} /></Sized>;
        case 'view.histogram':
            return <Sized key={key} height={460}><HistogramComponent files={payload.files} width={600} height={420} /></Sized>;
    }

    if (!isInversion(payload)) return null;
    switch (viewType) {
        case 'view.summary':
            return <InversionSummary key={key} payload={payload} />;
        case 'view.misfit-histogram': {
            const misfits = rowsOf(payload.files)
                .filter(r => typeof r.misfit_angle === 'number' && Number.isFinite(r.misfit_angle))
                .map(r => ({ category: r.misfit_category ?? 'Other', angle: r.misfit_angle as number }));
            return misfits.length
                ? <MisfitHistogramComponent key={key} misfits={misfits} totalData={countRows(payload.files)} />
                : <p className="text-sm text-gray-500 italic">No predicted data</p>;
        }
        case 'view.mohr':
            return payload.solution.analysis
                ? <InversionMohrComponent key={key} solution={payload.solution} data={payload.run.data} />
                : null;
        case 'view.landscape':
            return <ParameterSpaceLandscapeComponent key={key} data={payload.run.data} engine={payload.run.engine}
                solution={payload.solution} misfitCriterion={payload.solution.misfitCriterion ?? 'ANGLE'} />;
        case 'view.mcmc-stats':
            return <MCMCStatsComponent key={key} files={[...payload.files, payload.resultsFile]} inline={true} />;
    }
    return null;
}
