// datasetUtils.ts
// Helpers shared by the blocks that read or transform datasets.

import { DataFile } from '../../components/DataFile';
import { hashValue } from '../hash';
import { SourceFileRef } from '../types';

/** Row fields written by an inversion; they only make sense next to that inversion's solution */
export const INVERSION_ROW_FIELDS = ['predicted_normal', 'predicted_striation', 'misfit_angle', 'misfit_category'];

const rowsOf = (file: DataFile): Record<string, any>[] => {
    const rows = file.content ?? (file as any).data;
    return Array.isArray(rows) ? rows : [];
};

/** Hash of a file's rows: identifies its content independently of its id or its display state */
export function contentHash(file: DataFile): string {
    return hashValue(rowsOf(file));
}

export function fileRef(file: DataFile): SourceFileRef {
    return { id: file.id, name: file.name, contentHash: contentHash(file), rowCount: rowsOf(file).length };
}

export type FileResolution =
    | { status: 'ok'; file: DataFile }
    | { status: 'changed'; file: DataFile }
    | { status: 'missing' };

/**
 * Find the Data-tab file a saved reference points to. File ids change between sessions, so an
 * identical content under the same name is accepted; a different content is reported, never
 * silently used (§4.8).
 */
export function resolveFileRef(ref: SourceFileRef, files: DataFile[]): FileResolution {
    const byId = files.find(f => f.id === ref.id);
    if (byId) return { status: contentHash(byId) === ref.contentHash ? 'ok' : 'changed', file: byId };
    const sameContent = files.find(f => f.name === ref.name && contentHash(f) === ref.contentHash);
    if (sameContent) return { status: 'ok', file: sameContent };
    const sameName = files.find(f => f.name === ref.name);
    if (sameName) return { status: 'changed', file: sameName };
    return { status: 'missing' };
}

/** Copies of `files` keeping only the rows that satisfy `keep` */
export function filterRows(files: DataFile[], keep: (row: Record<string, any>) => boolean): DataFile[] {
    return files.map(file => ({ ...file, content: rowsOf(file).filter(keep) }));
}

/** Copies of `files` without anything an inversion added (row predictions, stress axes) */
export function stripInversionFields(files: DataFile[]): DataFile[] {
    return files.map(file => {
        const { stressAxes, ...rest } = file as any;
        return {
            ...rest,
            content: rowsOf(file).map(row => {
                if (!INVERSION_ROW_FIELDS.some(f => f in row)) return row;
                const copy = { ...row };
                INVERSION_ROW_FIELDS.forEach(f => delete copy[f]);
                return copy;
            }),
        };
    });
}

export function countRows(files: DataFile[]): number {
    return files.reduce((n, f) => n + rowsOf(f).length, 0);
}
