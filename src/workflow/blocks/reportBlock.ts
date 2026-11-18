// reportBlock.ts
// Generate report: gathers the tagged items of the run into a report document (§11.2).
// The document is plain data; the Workflow tab renders it as HTML (and PDF through printing).

import { BlockDefinition, Provenance, ReportDocument, ReportItem } from '../types';

/** Every provenance record a value depends on, sources first, each once */
export function lineageOf(start: Provenance, lookup: (id: string) => Provenance | undefined): Provenance[] {
    const out: Provenance[] = [];
    const seen = new Set<string>();
    const visit = (p: Provenance) => {
        if (seen.has(p.id)) return;
        seen.add(p.id);
        p.inputs.forEach(id => {
            const input = lookup(id);
            if (input) visit(input);
        });
        out.push(p);
    };
    visit(start);
    return out;
}

export const ReportBlock: BlockDefinition = {
    type: 'report',
    // v2: the report of the inversion result connected to it (v1 gathered the tagged items of the run)
    version: 2,
    title: 'Generate report',
    description: 'Report of an inversion result (solution, misfits, stereonet, data, provenance): HTML, or PDF by printing',
    category: 'Report',
    role: 'report',
    inputs: [{
        id: 'in', label: 'Inversion result', type: 'InversionResult',
        meaning: { InversionResult: 'Reported: solution, misfits, stereonet, data and how they were obtained' },
    }],
    outputs: [],
    params: [
        { key: 'title', label: 'Title', kind: 'string', scope: 'scientific', default: 'Stress inversion report' },
        { key: 'author', label: 'Author', kind: 'string', scope: 'scientific', default: '' },
        { key: 'includeTables', label: 'Include data tables', kind: 'boolean', scope: 'scientific', default: true },
        { key: 'includeProvenance', label: 'Include provenance', kind: 'boolean', scope: 'scientific', default: true },
    ],
    // v1 → v2: the tag filter has no meaning any more
    migrate({ scientific, presentation }) {
        const { tags, ...rest } = scientific;
        return { scientific: rest, presentation };
    },

    async execute(ctx) {
        const input = ctx.inputs.in[0];
        const source = ctx.workflow.nodes.find(n => n.id === input.provenance.blockId);
        const item: ReportItem = {
            tag: '',
            nodeId: input.provenance.blockId,
            nodeLabel: source?.label || source?.type || input.provenance.blockId,
            outdated: false,
            payload: input,
            lineage: lineageOf(input.provenance, ctx.provenance),
        };
        const document: ReportDocument = {
            title: String(ctx.params.title || 'Stress inversion report'),
            author: String(ctx.params.author ?? '').trim() || undefined,
            createdAt: new Date().toISOString(),
            workflowName: ctx.workflow.name,
            appVersion: ctx.env.appVersion,
            stressLibVersion: ctx.env.stressLibVersion,
            tags: [],
            includeTables: ctx.params.includeTables !== false,
            includeProvenance: ctx.params.includeProvenance !== false,
            items: [item],
            warnings: [],
        };
        ctx.log('info', `Report of “${item.nodeLabel}”`);
        return {
            outputs: { report: { type: 'Report', document } },
            provenanceInputs: [input.provenance.id],
        };
    },
};
