// dataBlock.ts
// Source block: files picked from the Data tab.

import { BlockDefinition, SourceFileRef } from '../types';
import { fileRef, resolveFileRef } from './datasetUtils';

export const DataBlock: BlockDefinition = {
    type: 'data',
    version: 1,
    title: 'Data',
    description: 'Files of the Data tab',
    category: 'Sources',
    role: 'source',
    inputs: [],
    outputs: [{ id: 'out', label: 'Dataset', type: 'Dataset' }],
    params: [
        { key: 'files', label: 'Files', kind: 'files', scope: 'scientific', default: [] },
    ],

    // The content of the files is part of the cache key: an edited file makes the block stale
    cacheKeyExtra(params, env) {
        return (params.files as SourceFileRef[]).map(ref => {
            const r = resolveFileRef(ref, env.files);
            return r.status === 'missing' ? { missing: ref.name } : { hash: fileRef(r.file).contentHash, status: r.status };
        });
    },

    async execute(ctx) {
        const refs = ctx.params.files as SourceFileRef[];
        if (!refs.length) throw new Error('No file selected');

        const files = refs.map(ref => {
            const r = resolveFileRef(ref, ctx.env.files);
            if (r.status === 'missing') {
                throw new Error(`File "${ref.name}" is not in the Data tab`);
            }
            if (r.status === 'changed') {
                throw new Error(`File "${ref.name}" has changed since it was added to this workflow; select it again to use its new content`);
            }
            return r.file;
        });

        // Every row remembers where it came from, so it stays traceable through filters
        const out = files.map(file => ({
            ...file,
            content: (file.content as any[]).map((row, rowIndex) =>
                row._origin ? row : { ...row, _origin: { fileId: file.id, rowIndex } }),
        }));

        ctx.log('info', `${files.length} file(s): ${files.map(f => f.name).join(', ')}`);
        return {
            outputs: { out: { type: 'Dataset', files: out } },
            sourceFiles: files.map(fileRef),
        };
    },
};
