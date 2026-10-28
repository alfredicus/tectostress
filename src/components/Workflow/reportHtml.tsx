// reportHtml.tsx
// Turns a report document (§11.2) into a standalone HTML page. Figures are drawn by the app's own
// components, rendered off-screen, and embedded as SVG, so they match what the views show.

import React from 'react';
import { createRoot } from 'react-dom/client';
import StereonetComponent from '../Stereonet/StereonetComponent';
import MisfitHistogramComponent from '../Histo/MisfitHistogramComponent';
import { DataPayload, InversionResultPayload, Provenance, ReportDocument, ReportItem } from '../../workflow';
import { countRows } from '../../workflow/blocks/datasetUtils';

const esc = (v: unknown) => String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Render a component off-screen and return the SVG it draws (the largest one, so toolbar icons
 * are ignored). The components draw with d3 in effects, hence the short wait.
 */
async function captureSvg(element: React.ReactElement, selector = 'svg'): Promise<string | null> {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-10000px;top:0;width:720px;height:720px;overflow:hidden;';
    document.body.appendChild(host);
    const root = createRoot(host);
    try {
        root.render(element);
        await wait(600);
        const svgs = Array.from(host.querySelectorAll<SVGSVGElement>(selector));
        const area = (s: SVGSVGElement) => (Number(s.getAttribute('width')) || s.clientWidth) * (Number(s.getAttribute('height')) || s.clientHeight);
        const svg = svgs.sort((a, b) => area(b) - area(a))[0];
        if (!svg) return null;
        const copy = svg.cloneNode(true) as SVGSVGElement;
        copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        return new XMLSerializer().serializeToString(copy);
    } finally {
        root.unmount();
        host.remove();
    }
}

/** Trend and plunge (degrees) of an axis given as [east, north, up], on the lower hemisphere */
export function trendPlunge(v: number[]): { trend: number; plunge: number } {
    let [x, y, z] = v;
    const n = Math.hypot(x, y, z) || 1;
    [x, y, z] = [x / n, y / n, z / n];
    if (z > 0) [x, y, z] = [-x, -y, -z];
    return {
        trend: ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360,
        plunge: (Math.asin(-z) * 180) / Math.PI,
    };
}

const fmt = (v: number, digits = 1) => Number.isFinite(v) ? v.toFixed(digits) : '—';

function inversionSummary(p: InversionResultPayload): string {
    const s = p.solution;
    const misfit = s.misfitCriterion === 'DOT' ? fmt(s.misfit, 4) : `${fmt(s.misfit * 180)}°`;
    const axes = s.analysis?.principalStresses;
    const solved = (s as any).visualizationData?.processedDataCount as number | undefined;
    const shown = countRows(p.files);
    const axisRows = axes ? (['sigma1', 'sigma2', 'sigma3'] as const).map((k, i) => {
        const tp = trendPlunge(axes[k].direction);
        return `<tr><td>σ${i + 1}</td><td>${fmt(tp.trend)}°</td><td>${fmt(tp.plunge)}°</td><td>${fmt(axes[k].value, 3)}</td></tr>`;
    }).join('') : '';
    return `
<div class="metrics">
  <div><span>Stress ratio</span><b>${fmt(s.stressRatio, 3)}</b></div>
  <div><span>Fit</span><b>${fmt((1 - s.misfit) * 100)}%</b></div>
  <div><span>Misfit</span><b>${misfit}</b></div>
  <div><span>Data</span><b>${shown}</b></div>
</div>
${solved !== undefined && solved !== shown ? `<p class="muted">These ${shown} data are a subset: the solution above was computed from ${solved} data.</p>` : ''}
<p class="muted">Method: ${esc(p.method)} · ${esc(Object.entries(p.methodParams).map(([k, v]) => `${k} = ${v}`).join(', '))}</p>
${axisRows ? `<table class="axes"><thead><tr><th>Axis</th><th>Trend</th><th>Plunge</th><th>Value</th></tr></thead><tbody>${axisRows}</tbody></table>` : ''}`;
}

const HIDDEN_COLUMN = (key: string) =>
    key.startsWith('_') || key.startsWith('predicted_') || key === 'misfit_category' || /[A-Z]/.test(key);

function dataTable(payload: DataPayload, maxRows = 500): string {
    const rows = payload.files.flatMap(f => (f.content as any[]) ?? []);
    if (!rows.length) return '<p class="muted">No data.</p>';
    const columns: string[] = [];
    rows.forEach(r => Object.keys(r).forEach(k => { if (!HIDDEN_COLUMN(k) && !columns.includes(k)) columns.push(k); }));
    const cell = (v: unknown) => typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : esc(v);
    const body = rows.slice(0, maxRows)
        .map(r => `<tr>${columns.map(c => `<td>${cell(r[c])}</td>`).join('')}</tr>`).join('');
    return `<div class="table-wrap"><table class="data"><thead><tr>${columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>` +
        (rows.length > maxRows ? `<p class="muted">First ${maxRows} of ${rows.length} rows.</p>` : '');
}

function provenanceTable(lineage: Provenance[], labelOf: (blockId: string) => string): string {
    const params = (p: Provenance) => esc(JSON.stringify(p.scientificParams, (k, v) =>
        k === 'files' && Array.isArray(v) ? v.map((f: any) => f.name) : v));
    const rows = lineage.map((p, i) => `
<tr>
  <td>${i + 1}</td>
  <td><b>${esc(labelOf(p.blockId))}</b><br><span class="muted">${esc(p.blockType)} v${p.blockVersion}</span></td>
  <td>${p.sourceFiles ? `Files: ${esc(p.sourceFiles.map(f => `${f.name} (${f.rowCount} rows, #${f.contentHash.slice(0, 8)})`).join(', '))}<br>` : ''}<code>${params(p)}</code></td>
  <td>${esc(new Date(p.startedAt).toLocaleString())}<br><span class="muted">${p.durationMs} ms · #${p.id.slice(0, 8)}</span></td>
</tr>`).join('');
    return `<table class="provenance"><thead><tr><th>#</th><th>Step</th><th>Parameters</th><th>Run</th></tr></thead><tbody>${rows}</tbody></table>`;
}

async function itemHtml(item: ReportItem, doc: ReportDocument, labelOf: (id: string) => string): Promise<string> {
    const p = item.payload;
    const parts: string[] = [];
    parts.push(`<h3>${esc(labelOf(item.nodeId))}${item.iteration !== undefined ? ` — iteration ${item.iteration}` : ''} <span class="muted">— ${p.type === 'InversionResult' ? 'inversion result' : 'dataset'}, ${countRows(p.files)} rows</span></h3>`);
    if (item.outdated) parts.push('<p class="warning">From an earlier run: may not match the current workflow.</p>');
    if (item.note) parts.push(`<p>${esc(item.note)}</p>`);

    const figures: string[] = [];
    if (p.type === 'InversionResult') {
        parts.push(inversionSummary(p));
        const rows = p.files.flatMap(f => (f.content as any[]) ?? []);
        const misfits = rows.filter(r => typeof r.misfit_angle === 'number')
            .map(r => ({ category: r.misfit_category ?? 'Other', angle: r.misfit_angle as number }));
        if (misfits.length) {
            const svg = await captureSvg(<MisfitHistogramComponent misfits={misfits} totalData={rows.length} />);
            if (svg) figures.push(`<figure>${svg}<figcaption>Angular misfit</figcaption></figure>`);
        }
    }
    if (countRows(p.files) > 0) {
        const svg = await captureSvg(<StereonetComponent files={p.files} width={560} height={560} autoEnable={true} />,
            '[id^="stereonet-"] svg');
        if (svg) figures.unshift(`<figure>${svg}<figcaption>Stereonet${p.type === 'InversionResult' ? ' (predictions dashed, σ1 σ2 σ3 as stars)' : ''}</figcaption></figure>`);
    }
    if (figures.length) parts.push(`<div class="figures">${figures.join('')}</div>`);

    if (doc.includeTables) parts.push(`<details open><summary>Data</summary>${dataTable(p)}</details>`);
    if (doc.includeProvenance) parts.push(`<details open><summary>Provenance</summary>${provenanceTable(item.lineage, labelOf)}</details>`);
    return `<section class="item">${parts.join('\n')}</section>`;
}

const STYLE = `
body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1f2937; margin: 2rem auto; max-width: 960px; padding: 0 1rem; line-height: 1.45; }
h1 { margin-bottom: .2rem; } h2 { border-bottom: 2px solid #e5e7eb; padding-bottom: .2rem; margin-top: 2rem; }
h3 { margin-bottom: .4rem; }
.muted { color: #6b7280; font-weight: normal; font-size: .9em; }
.warning { background: #fef3c7; color: #92400e; padding: .5rem .75rem; border-radius: 6px; }
.metrics { display: flex; flex-wrap: wrap; gap: .75rem; margin: .5rem 0; }
.metrics div { background: #f3f4f6; border-radius: 6px; padding: .4rem .8rem; min-width: 7rem; }
.metrics span { display: block; font-size: .8em; color: #6b7280; } .metrics b { font-size: 1.3em; }
table { border-collapse: collapse; font-size: .85em; margin: .5rem 0; }
th, td { border: 1px solid #e5e7eb; padding: .25rem .5rem; text-align: left; vertical-align: top; }
th { background: #f9fafb; }
.table-wrap { overflow-x: auto; }
.figures { display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-start; }
figure { margin: 0; } figure svg { max-width: 100%; height: auto; } figcaption { font-size: .85em; color: #6b7280; text-align: center; }
code { font-size: .85em; word-break: break-all; }
summary { cursor: pointer; font-weight: 600; margin: .5rem 0; }
.item { page-break-inside: avoid; margin-bottom: 1.5rem; }
@media print { body { margin: 0; } details > summary { list-style: none; } .item { page-break-inside: auto; } }
`;

/** The complete HTML page of a report */
export async function buildReportHtml(doc: ReportDocument, labelOf: (blockId: string) => string): Promise<string> {
    const byTag = new Map<string, ReportItem[]>();
    doc.items.forEach(i => byTag.set(i.tag, [...(byTag.get(i.tag) ?? []), i]));

    const sections: string[] = [];
    for (const [tag, items] of Array.from(byTag.entries())) {
        const html: string[] = [];
        for (const item of items) html.push(await itemHtml(item, doc, labelOf));
        sections.push(`<h2>${esc(tag)}</h2>${html.join('\n')}`);
    }

    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(doc.title)}</title><style>${STYLE}</style></head>
<body>
<h1>${esc(doc.title)}</h1>
<p class="muted">${doc.author ? `${esc(doc.author)} · ` : ''}${esc(new Date(doc.createdAt).toLocaleString())} · workflow “${esc(doc.workflowName)}” ·
TectoStress ${esc(doc.appVersion)} · stress library ${esc(doc.stressLibVersion)}</p>
${doc.warnings.map(w => `<p class="warning">${esc(w)}</p>`).join('\n')}
${sections.join('\n')}
</body></html>`;
}
