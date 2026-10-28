// conditions.ts
// Conditions of ExitLoop and Conditional blocks: quantity · comparison · value (§12.2).

import { countRows } from './blocks/datasetUtils';
import { DataPayload, InversionResultPayload, LoopContext, ParamDefinition } from './types';

export interface Metric {
    value: string;
    label: string;
    /** Needs an inversion result as input */
    inversion?: boolean;
    /** Only meaningful inside a ForLoop */
    loop?: boolean;
}

export const METRICS: Metric[] = [
    { value: 'rows', label: 'Number of data' },
    { value: 'misfit', label: 'Misfit (° for the angle criterion)', inversion: true },
    { value: 'fit', label: 'Fit (%)', inversion: true },
    { value: 'stressRatio', label: 'Stress ratio', inversion: true },
    { value: 'iteration', label: 'Iteration number', loop: true },
    { value: 'deltaStressRatio', label: 'Change of stress ratio since the previous iteration', inversion: true, loop: true },
    { value: 'axesRotation', label: 'Rotation of σ1/σ3 since the previous iteration (°)', inversion: true, loop: true },
];

export const OPERATORS = ['<', '≤', '=', '≠', '≥', '>'] as const;
export type Operator = typeof OPERATORS[number];

/** Parameters shared by the blocks that test a condition */
export function conditionParams(defaults: { metric: string; operator: Operator; value: number }): ParamDefinition[] {
    return [
        {
            key: 'metric', label: 'Quantity', kind: 'select', scope: 'scientific', default: defaults.metric,
            options: METRICS.map(m => ({ value: m.value, label: m.label })),
        },
        {
            key: 'operator', label: 'Comparison', kind: 'select', scope: 'scientific', default: defaults.operator,
            options: OPERATORS.map(o => ({ value: o, label: o })),
        },
        { key: 'value', label: 'Value', kind: 'number', scope: 'scientific', default: defaults.value },
    ];
}

const isInversion = (p: DataPayload): p is InversionResultPayload => p.type === 'InversionResult';

/** Angle in degrees between two axes (no sense) */
function axisAngle(a: number[], b: number[]): number {
    const na = Math.hypot(a[0], a[1], a[2]), nb = Math.hypot(b[0], b[1], b[2]);
    if (!na || !nb) return NaN;
    const c = Math.abs((a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (na * nb));
    return Math.acos(Math.min(1, c)) * 180 / Math.PI;
}

/**
 * Value of a quantity for a payload. Undefined when it does not apply yet (a "since the previous
 * iteration" quantity on the first iteration); throws when it can never apply to this input.
 */
export function metricValue(metric: string, payload: DataPayload, loop: LoopContext | undefined, port = 'in'): number | undefined {
    const m = METRICS.find(x => x.value === metric);
    if (!m) throw new Error(`Unknown quantity "${metric}"`);
    if (m.inversion && !isInversion(payload)) throw new Error(`“${m.label}” needs an inversion result as input`);
    if (m.loop && !loop) return undefined;

    switch (metric) {
        case 'rows': return countRows(payload.files);
        case 'iteration': return loop!.iteration;
    }
    const s = (payload as InversionResultPayload).solution;
    switch (metric) {
        case 'misfit': return s.misfitCriterion === 'DOT' ? s.misfit : s.misfit * 180;
        case 'fit': return (1 - s.misfit) * 100;
        case 'stressRatio': return s.stressRatio;
    }

    const previous = loop!.previousInput(port);
    if (!previous || !isInversion(previous)) return undefined;
    const p = previous.solution;
    if (metric === 'deltaStressRatio') return Math.abs(s.stressRatio - p.stressRatio);
    if (metric === 'axesRotation') {
        const now = s.analysis?.principalStresses, before = p.analysis?.principalStresses;
        if (!now || !before) return undefined;
        return Math.max(
            axisAngle(now.sigma1.direction, before.sigma1.direction),
            axisAngle(now.sigma3.direction, before.sigma3.direction));
    }
    return undefined;
}

export function compare(a: number, operator: string, b: number): boolean {
    switch (operator) {
        case '<': return a < b;
        case '≤': return a <= b;
        case '=': return a === b;
        case '≠': return a !== b;
        case '≥': return a >= b;
        case '>': return a > b;
    }
    throw new Error(`Unknown comparison "${operator}"`);
}

/** The condition holds; false when its quantity does not apply yet */
export function evaluateCondition(params: Record<string, any>, payload: DataPayload, loop?: LoopContext): boolean {
    const v = metricValue(params.metric, payload, loop);
    return v !== undefined && Number.isFinite(v) && compare(v, params.operator, Number(params.value));
}

export function describeCondition(params: Record<string, any>): string {
    const m = METRICS.find(x => x.value === params.metric);
    return `${m?.label ?? params.metric} ${params.operator} ${params.value}`;
}
