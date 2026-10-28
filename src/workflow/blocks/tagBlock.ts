// tagBlock.ts
// Add Tags: keep the value flowing through for a report (§4.10).

import { BlockDefinition } from '../types';

export const AddTagsBlock: BlockDefinition = {
    type: 'add-tags',
    version: 1,
    title: 'Add Tags',
    description: 'Keep this value for a report',
    category: 'Report',
    role: 'computation',
    inputs: [{ id: 'in', label: 'Value', type: 'any' }],
    outputs: [{ id: 'out', label: 'Value', type: 'any', sameAs: 'in' }],
    bypass: { from: 'in', to: 'out' },
    // Never cached, and renaming a tag never makes downstream blocks stale
    passThrough: true,
    params: [
        { key: 'tag', label: 'Tag', kind: 'string', scope: 'scientific', default: 'tag' },
        { key: 'note', label: 'Note', kind: 'string', scope: 'scientific', default: '' },
    ],

    async execute(ctx) {
        const payload = ctx.inputs.in[0];
        const tag = String(ctx.params.tag ?? '').trim();
        if (!tag) throw new Error('The tag name is empty');
        const note = String(ctx.params.note ?? '').trim() || undefined;
        ctx.tag(tag, note, payload);
        return { outputs: { out: payload } };
    },
};
