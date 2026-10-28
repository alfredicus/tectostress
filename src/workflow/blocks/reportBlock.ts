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

const parseTags = (text: string) => text.split(',').map(t => t.trim()).filter(Boolean);

export const ReportBlock: BlockDefinition = {
    type: 'report',
    version: 1,
    title: 'Generate report',
    description: 'Report of the tagged items: HTML, or PDF by printing',
    category: 'Report',
    role: 'report',
    inputs: [],
    outputs: [],
    params: [
        { key: 'title', label: 'Title', kind: 'string', scope: 'scientific', default: 'Stress inversion report' },
        { key: 'author', label: 'Author', kind: 'string', scope: 'scientific', default: '' },
        { key: 'tags', label: 'Tags', kind: 'string', scope: 'scientific', default: '', help: 'Comma-separated; empty includes every tag' },
        { key: 'includeTables', label: 'Include data tables', kind: 'boolean', scope: 'scientific', default: true },
        { key: 'includeProvenance', label: 'Include provenance', kind: 'boolean', scope: 'scientific', default: true },
    ],

    async execute(ctx) {
        const wanted = parseTags(String(ctx.params.tags ?? ''));
        const selected = ctx.tagged.filter(t => wanted.length === 0 || wanted.includes(t.tag));
        const labelOf = (id: string) => {
            const node = ctx.workflow.nodes.find(n => n.id === id);
            return node?.label || node?.type || id;
        };

        const items: ReportItem[] = selected.map(t => ({
            tag: t.tag,
            note: t.note,
            nodeId: t.nodeId,
            nodeLabel: labelOf(t.nodeId),
            iteration: t.iteration,
            outdated: t.outdated,
            payload: t.payload,
            lineage: lineageOf(t.payload.provenance, ctx.provenance),
        }));

        const warnings: string[] = [];
        const outdated = items.filter(i => i.outdated);
        if (outdated.length) {
            warnings.push(`${outdated.length} item(s) come from an earlier run and may not match the current workflow: ` +
                outdated.map(i => `“${i.tag}” (${i.nodeLabel})`).join(', '));
        }
        const missing = wanted.filter(tag => !ctx.tagged.some(t => t.tag === tag));
        if (missing.length) warnings.push(`No item tagged ${missing.map(t => `“${t}”`).join(', ')}`);
        if (items.length === 0) warnings.push('Nothing to report: add Add Tags blocks to the workflow');

        const document: ReportDocument = {
            title: String(ctx.params.title || 'Stress inversion report'),
            author: String(ctx.params.author ?? '').trim() || undefined,
            createdAt: new Date().toISOString(),
            workflowName: ctx.workflow.name,
            appVersion: ctx.env.appVersion,
            stressLibVersion: ctx.env.stressLibVersion,
            tags: wanted,
            includeTables: ctx.params.includeTables !== false,
            includeProvenance: ctx.params.includeProvenance !== false,
            items,
            warnings,
        };
        ctx.log('info', `${items.length} item(s) in the report`);
        return {
            outputs: { report: { type: 'Report', document } },
            provenanceInputs: items.map(i => i.payload.provenance.id),
        };
    },
};
