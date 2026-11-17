// dataTypes.ts
// The kinds of data flowing between blocks, and what each input accepts (doc/workflow-spec.md §16).
// Connection checks, port drawing, tooltips, the legend and refusal messages all come from here.

import { PayloadType, PortDefinition, isSubtypeOf } from './types';

/** Type of a value as far as the editor can tell: 'unknown' before a pass-through block is fed */
export type FlowType = PayloadType | 'any' | 'unknown';

export interface DataTypeInfo {
    /** Name shown to the user */
    name: string;
    /** Plural, in sentences ("accepts measured data or inversion results") */
    plural: string;
    color: string;
    meaning: string;
}

/** Blue and purple mean the kind of data, and nothing else, everywhere in the interface */
export const DATA_TYPES: Record<PayloadType | 'any', DataTypeInfo> = {
    Dataset: {
        name: 'Measured data', plural: 'measured data', color: '#0ea5e9',
        meaning: 'Observations as measured: no stress solution yet',
    },
    InversionResult: {
        name: 'Inversion result', plural: 'inversion results', color: '#8b5cf6',
        meaning: 'The observations with a stress solution, the predicted striation and the misfit of each datum',
    },
    Report: {
        name: 'Report', plural: 'reports', color: '#64748b',
        meaning: 'A document gathering tagged results',
    },
    any: {
        name: 'Any value', plural: 'any value', color: '#94a3b8',
        meaning: 'Passed on unchanged: takes the kind of what it receives',
    },
};

/** The kinds of data shown on the canvas (Report never flows through a link) */
export const FLOW_TYPES: PayloadType[] = ['Dataset', 'InversionResult'];

export const colorOf = (type: FlowType) => DATA_TYPES[type === 'unknown' ? 'any' : type].color;
export const nameOf = (type: FlowType) => DATA_TYPES[type === 'unknown' ? 'any' : type].name;

type Accepting = Pick<PortDefinition, 'type' | 'exact'>;

/**
 * What an input accepts. A port of type T accepts T and what contains it (an inversion result
 * contains measured data), unless it is `exact`.
 */
export function acceptedTypes(port: Accepting): PayloadType[] {
    if (port.type === 'any') return [...FLOW_TYPES];
    if (port.exact) return [port.type];
    return FLOW_TYPES.filter(t => isSubtypeOf(t, port.type as PayloadType));
}

/** Whether a value of type `produced` may flow into `port` */
export function portAccepts(port: Accepting, produced: FlowType): boolean {
    if (port.type === 'any' || produced === 'any' || produced === 'unknown') return true;
    if (produced === 'Report') return false;
    return acceptedTypes(port).includes(produced);
}

/** The port accepting exactly `types` (used for a group input feeding several inner inputs) */
export function portAccepting(types: PayloadType[]): Accepting | null {
    if (types.length === 0) return null;
    if (types.length === 1) return types[0] === 'Dataset' ? { type: 'Dataset', exact: true } : { type: types[0] };
    return { type: 'Dataset' };
}

/** Types accepted by every one of `ports` */
export function acceptedByAll(ports: Accepting[]): PayloadType[] {
    return FLOW_TYPES.filter(t => ports.every(p => acceptedTypes(p).includes(t)));
}

/** "measured data or inversion results", "inversion results only", "any value" */
export function describeAccepted(port: Accepting): string {
    if (port.type === 'any') return 'any value (passed on unchanged)';
    const types = acceptedTypes(port);
    if (types.length === FLOW_TYPES.length) return types.map(t => DATA_TYPES[t].plural).join(' or ');
    return `${types.map(t => DATA_TYPES[t].plural).join(' or ')} only`;
}

/** Colours drawn for an input: one per kind accepted ('any' is grey) */
export function inputColors(port: Accepting): string[] {
    if (port.type === 'any') return [DATA_TYPES.any.color];
    return acceptedTypes(port).map(t => DATA_TYPES[t].color);
}

/** CSS background of a port dot: one colour, or one half per kind accepted */
export function portBackground(colors: string[]): string {
    if (colors.length <= 1) return colors[0] ?? DATA_TYPES.any.color;
    const step = 100 / colors.length;
    return `linear-gradient(90deg, ${colors.map((c, i) => `${c} ${i * step}%, ${c} ${(i + 1) * step}%`).join(', ')})`;
}

/**
 * Why `produced` cannot go into `port` of block `blockTitle`, in words a geologist can act on.
 * `alternative` is another input of the same block that would accept it.
 */
export function refusalReason(produced: FlowType, port: Accepting & { label?: string }, blockTitle: string,
    alternative?: { label: string }): string {
    const got = produced === 'unknown' || produced === 'any' ? 'this value' : DATA_TYPES[produced].plural;
    if (alternative) {
        return `This input of ${blockTitle} takes ${describeAccepted(port)}: connect the ${got} to its “${alternative.label}” input.`;
    }
    if (produced === 'Dataset' && acceptedTypes(port).every(t => t === 'InversionResult')) {
        return `${blockTitle} needs an inversion result. Measured data have no stress solution yet: connect an Inversion first.`;
    }
    if (produced === 'Report') return `${blockTitle} cannot use a report.`;
    return `${blockTitle} takes ${describeAccepted(port)}, not ${got}.`;
}
