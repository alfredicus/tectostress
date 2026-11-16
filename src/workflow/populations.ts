// populations.ts
// Kept and rejected populations after a Misfit filter (doc/workflow-spec.md §14.4): which
// population each datum belongs to, and the inversion data a subset of rows corresponds to.

import { DataPayload, InversionResultPayload } from './types';

export type Population = 'kept' | 'rejected';
/** What a view shows of a classified input (display option "Show") */
export type ShowPopulation = 'both' | Population;

/** Colours of the two populations, the same in every view */
export const POPULATION_STYLE: Record<Population, { label: string; color: string }> = {
    kept: { label: 'Kept', color: '#0f766e' },
    rejected: { label: 'Rejected', color: '#ea580c' },
};

const rowsOf = (payload: DataPayload): Record<string, any>[] =>
    payload.files.flatMap(f => ((f.content as any[]) ?? []));

/** Population of a row, or undefined when it has not been through a Misfit filter */
export const populationOf = (row: Record<string, any>): Population | undefined =>
    row.misfit_class === 'kept' || row.misfit_class === 'rejected' ? row.misfit_class : undefined;

/** Whether the payload's rows were classified by a Misfit filter, and with which threshold */
export function classification(payload: DataPayload): { classified: boolean; threshold?: number; counts: Record<Population, number> } {
    const counts: Record<Population, number> = { kept: 0, rejected: 0 };
    let threshold: number | undefined;
    rowsOf(payload).forEach(row => {
        const p = populationOf(row);
        if (!p) return;
        counts[p]++;
        if (typeof row.misfit_threshold === 'number') threshold = row.misfit_threshold;
    });
    return { classified: counts.kept + counts.rejected > 0, threshold, counts };
}

/** The payload restricted to one population ("both": unchanged) */
export function selectPopulation<P extends DataPayload>(payload: P, show: ShowPopulation): P {
    if (show === 'both' || !classification(payload).classified) return payload;
    return {
        ...payload,
        files: payload.files.map(f => ({ ...f, content: ((f.content as any[]) ?? []).filter(r => populationOf(r) === show) })),
    };
}

/**
 * The inversion data (library objects) of the rows a payload holds, each with its population.
 * A view of a subset (kept or rejected data) then draws exactly those data, not every datum of
 * the inversion. Rows without `_datum` (results made before it existed) fall back to every datum.
 */
export function inversionData(payload: InversionResultPayload): { datum: any; population?: Population }[] {
    const all = payload.run.data ?? [];
    const rows = rowsOf(payload);
    if (!rows.some(r => typeof r._datum === 'number')) return all.map(datum => ({ datum }));
    return rows
        .filter(r => typeof r._datum === 'number' && all[r._datum])
        .map(r => ({ datum: all[r._datum], population: populationOf(r) }));
}
