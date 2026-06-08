import React, { useState, useEffect } from 'react'
import { FieldRecord, MOVEMENT_TYPE_LABELS, Attachment } from './types'
import { FieldStore } from './FieldStore'
import { AttachmentStore } from './AttachmentStore'
import { formatBytes } from './formatBytes'
import FieldRecordForm from './FieldRecordForm'
import { toKML, toGeoJSON, toCSV, serializeCSV, toZip, CsvDelimiter, shareOrDownload, shareOrDownloadBlob } from './KMLExport'
import { recordsToDataset, recordsToConventionalRows, CONVENTIONAL_HEADERS } from './toDatasetRow'
import { DataFile } from '../DataFile'

interface Props {
    onFileLoaded: (file: DataFile) => void
    onNavigateToData: () => void
}

type View = 'list' | 'new' | 'detail'

const DATA_TYPE_LABELS: Record<string, string> = {
    plane: 'Plane',
    linear: 'Linear',
    striated_fault: 'Striated fault',
}

// Ensure the chosen filename keeps the right extension.
function ensureExtension(name: string, ext: string): string {
    const trimmed = name.trim()
    return trimmed.toLowerCase().endsWith(`.${ext}`) ? trimmed : `${trimmed}.${ext}`
}

/**
 * Ask the user for a filename, pre-filled with `defaultName`. Pressing Enter
 * confirms the default; Cancel aborts the export (returns null). Falls back to
 * the default where window.prompt is unavailable.
 */
function promptFilename(defaultName: string, ext: string): string | null {
    if (typeof window === 'undefined' || typeof window.prompt !== 'function') {
        return ensureExtension(defaultName, ext)
    }
    const answer = window.prompt('Export file name:', defaultName)
    if (answer === null) return null            // user cancelled
    return ensureExtension(answer || defaultName, ext)
}

export default function FieldRecordTab({ onFileLoaded, onNavigateToData }: Props) {
    const [records, setRecords] = useState<FieldRecord[]>([])
    const [view, setView] = useState<View>('list')
    const [selected, setSelected] = useState<FieldRecord | null>(null)
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
    const [confirmClearAll, setConfirmClearAll] = useState(false)
    // Which CSV export is awaiting a delimiter choice: raw field dump, the
    // conventional geologist data file, or none.
    const [csvChoice, setCsvChoice] = useState<'raw' | 'conventional' | null>(null)
    // Carry-over selections so the next record pre-selects the previous
    // fracture type / subtype / movement / convention.
    const [formDefaults, setFormDefaults] = useState<Partial<FieldRecord> | undefined>(undefined)
    // Validation errors raised while converting records to dataset rows.
    const [injectErrors, setInjectErrors] = useState<string[]>([])
    // Bumped on every save / new-record so the form remounts with a fresh,
    // empty record (clearing the previous capture, photos, notes…).
    const [formSeq, setFormSeq] = useState(0)
    // The record currently being edited (null when capturing a new one).
    const [editing, setEditing] = useState<FieldRecord | null>(null)

    useEffect(() => {
        setRecords(FieldStore.load())
    }, [])

    // All attachment ids referenced across the given records.
    function referencedAttachmentIds(recs: FieldRecord[]): Set<string> {
        const ids = new Set<string>()
        recs.forEach(r => (r.attachments ?? []).forEach(a => ids.add(a.id)))
        return ids
    }

    function handleSave(record: FieldRecord) {
        // Editing an existing record: update it in place and return to its detail.
        if (editing) {
            const updated = FieldStore.update(record)
            setRecords(updated)
            injectIntoDataset(updated)
            AttachmentStore.gc(referencedAttachmentIds(updated))
            setEditing(null)
            setSelected(record)
            setView('detail')
            return
        }

        const updated = FieldStore.add(record)
        setRecords(updated)
        injectIntoDataset(updated)
        AttachmentStore.gc(referencedAttachmentIds(updated))
        // Remember the type selections for the next capture, then stay on the
        // Field tab (list view) instead of navigating away to the Data tab.
        setFormDefaults({
            dataType: record.dataType,
            planeSubtype: record.planeSubtype,
            linearSubtype: record.linearSubtype,
            movementType: record.movementType,
            convention: record.convention,
        })
        // Re-open a fresh form right away so the next measurement starts on the
        // capture panel (same type) without going back through the list.
        setFormSeq(s => s + 1)
        setView('new')
    }

    function startEdit(record: FieldRecord) {
        setEditing(record)
        setFormSeq(s => s + 1)
        setView('new')
    }

    function handleClearAll() {
        FieldStore.clear()
        AttachmentStore.clear()
        setRecords([])
        setConfirmClearAll(false)
        setSelected(null)
        setView('list')
    }

    function handleDelete(id: string) {
        const updated = FieldStore.remove(id)
        setRecords(updated)
        AttachmentStore.gc(referencedAttachmentIds(updated))
        setConfirmDelete(null)
        if (selected?.id === id) {
            setSelected(null)
            setView('list')
        }
    }

    async function downloadAttachment(a: Attachment) {
        const blob = await AttachmentStore.get(a.id)
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = a.name
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
    }

    function injectIntoDataset(recs: FieldRecord[]) {
        // Convert records into library-ready rows aligned with the parameters
        // each data type defines, re-deriving the dip direction and validating
        // the plane geometry so the dataset never explodes later at Run time.
        const { rows, errors } = recordsToDataset(recs)
        setInjectErrors(errors)

        if (rows.length === 0) return

        // Union of keys across rows (striated rows carry extra columns).
        const headers = Array.from(rows.reduce((set, row) => {
            Object.keys(row).forEach(k => set.add(k))
            return set
        }, new Set<string>()))
        // Fixed name so handleFileLoaded deduplicates: each save replaces the
        // previous field-records file rather than accumulating multiple files.
        const dataFile: DataFile = {
            id: 'field-records',
            name: 'Field records',
            headers,
            content: rows as any,
            layout: { x: 0, y: 0, w: 6, h: 4 },
        }
        onFileLoaded(dataFile)
    }

    function exportAll(format: 'kml' | 'geojson') {
        const content = format === 'kml' ? toKML(records) : toGeoJSON(records)
        const ext = format === 'kml' ? 'kml' : 'geojson'
        const mime = format === 'kml' ? 'application/vnd.google-earth.kml+xml' : 'application/geo+json'
        const filename = promptFilename(`tectostress-field.${ext}`, ext)
        if (filename === null) return
        shareOrDownload(content, filename, mime)
    }

    function exportCSV(kind: 'raw' | 'conventional', sep: CsvDelimiter) {
        setCsvChoice(null)
        const defaultName = kind === 'conventional' ? 'tectostress-field-data.csv' : 'tectostress-field.csv'
        const filename = promptFilename(defaultName, 'csv')
        if (filename === null) return
        const content = kind === 'conventional'
            // Re-express each measurement with the conventional geologist
            // parameters (strike, dip, dip direction) in a re-importable file.
            ? serializeCSV(CONVENTIONAL_HEADERS, recordsToConventionalRows(records), sep)
            : toCSV(records, sep)
        shareOrDownload(content, filename, 'text/csv')
    }

    async function exportZip() {
        const filename = promptFilename('tectostress-field.zip', 'zip')
        if (filename === null) return
        // CSV inside the zip uses ';' (data.csv references photos under photos/).
        const blob = await toZip(records, ';')
        shareOrDownloadBlob(blob, filename, 'application/zip')
    }

    // -----------------------------------------------------------------------
    if (view === 'new') {
        return (
            <div className="max-w-lg mx-auto px-4 py-4">
                <FieldRecordForm
                    key={formSeq}
                    onSave={handleSave}
                    onCancel={() => { const wasEditing = !!editing; setEditing(null); setView(wasEditing ? 'detail' : 'list') }}
                    defaults={editing ? undefined : formDefaults}
                    initial={editing ?? undefined}
                />
            </div>
        )
    }

    if (view === 'detail' && selected) {
        return (
            <div className="max-w-lg mx-auto px-4 py-4">
                <div className="flex items-center justify-between mb-4">
                    <button onClick={() => setView('list')} className="text-blue-500 text-sm">← Back to list</button>
                    <button
                        onClick={() => startEdit(selected)}
                        className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-blue-300 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                    </button>
                </div>

                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-800 dark:text-gray-100">
                            {DATA_TYPE_LABELS[selected.dataType]}
                            {selected.planeSubtype && <span className="ml-1 text-sm font-normal text-gray-500">({selected.planeSubtype.replace(/_/g, ' ')})</span>}
                            {selected.linearSubtype && <span className="ml-1 text-sm font-normal text-gray-500">({selected.linearSubtype.replace(/_/g, ' ')})</span>}
                        </span>
                        <span className="text-xs text-gray-400">{new Date(selected.timestamp).toLocaleString()}</span>
                    </div>

                    {selected.plane && (
                        <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Plane</div>
                            <div className="font-mono text-sm text-gray-700 dark:text-gray-200">
                                {selected.convention === 'dip_direction'
                                    ? `Dip dir. ${selected.plane.dipDirection}° / Dip ${selected.plane.dip}°`
                                    : `Strike ${selected.plane.strike}° / Dip ${selected.plane.dip}°`}
                                <span className="text-gray-400 ml-2">(strike {selected.plane.strike}°)</span>
                            </div>
                        </div>
                    )}

                    {selected.striation && (
                        <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Striation</div>
                            <div className="font-mono text-sm text-gray-700 dark:text-gray-200">
                                Trend {selected.striation.trend ?? '—'}° / Plunge {selected.striation.plunge ?? '—'}°
                                {' '}(pitch {selected.striation.pitch}° {selected.striation.pitchSide})
                            </div>
                        </div>
                    )}

                    {selected.movementType && (
                        <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Movement</div>
                            <div className="text-sm text-gray-700 dark:text-gray-200">
                                {MOVEMENT_TYPE_LABELS[selected.movementType]}
                            </div>
                        </div>
                    )}

                    {selected.gps && (
                        <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">GPS</div>
                            <div className="font-mono text-sm text-gray-700 dark:text-gray-200">
                                {selected.gps.latitude.toFixed(6)}°, {selected.gps.longitude.toFixed(6)}°
                                {selected.gps.altitude !== null && ` · ${Math.round(selected.gps.altitude)} m`}
                                <span className="text-gray-400 ml-1">±{Math.round(selected.gps.accuracy)} m</span>
                            </div>
                        </div>
                    )}

                    {selected.photos.length > 0 && (
                        <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Photos</div>
                            <div className="flex flex-wrap gap-2">
                                {selected.photos.map((src, i) => (
                                    <img key={i} src={src} alt={`photo-${i}`}
                                        className="w-24 h-24 object-cover rounded-lg border border-gray-300" />
                                ))}
                            </div>
                        </div>
                    )}

                    {selected.audio && (
                        <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Voice note</div>
                            <audio src={selected.audio} controls className="h-9 w-full" />
                        </div>
                    )}

                    {selected.attachments && selected.attachments.length > 0 && (
                        <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Attachments</div>
                            <div className="flex flex-col gap-1.5">
                                {selected.attachments.map(a => (
                                    <button
                                        key={a.id}
                                        onClick={() => downloadAttachment(a)}
                                        className="flex items-center gap-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-left hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                                    >
                                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                        </svg>
                                        <span className="flex-1 min-w-0 truncate text-gray-700 dark:text-gray-200" title={a.name}>{a.name}</span>
                                        <span className="text-xs text-gray-400">{formatBytes(a.size)}</span>
                                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                                        </svg>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {selected.notes && (
                        <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Notes</div>
                            <div className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{selected.notes}</div>
                        </div>
                    )}

                    {/* Danger zone */}
                    {confirmDelete === selected.id ? (
                        <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                            <span className="text-sm text-red-600 flex-1">Delete this record?</span>
                            <button onClick={() => handleDelete(selected.id)} className="text-sm text-red-600 font-semibold underline">Yes, delete</button>
                            <button onClick={() => setConfirmDelete(null)} className="text-sm text-gray-500 underline">Cancel</button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setConfirmDelete(selected.id)}
                            className="text-sm text-red-500 underline pt-2"
                        >
                            Delete record
                        </button>
                    )}
                </div>
            </div>
        )
    }

    // -----------------------------------------------------------------------
    // LIST VIEW
    // -----------------------------------------------------------------------
    return (
        <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Field Records</h2>
                <button
                    onClick={() => { setFormSeq(s => s + 1); setView('new') }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium shadow hover:bg-blue-700 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    New record
                </button>
            </div>

            {/* Validation errors raised when adding records to the dataset */}
            {injectErrors.length > 0 && (
                <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
                    <div className="font-semibold mb-1">
                        {injectErrors.length} record{injectErrors.length > 1 ? 's' : ''} could not be added to the dataset:
                    </div>
                    <ul className="list-disc list-inside space-y-0.5">
                        {injectErrors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                </div>
            )}

            {/* Export bar */}
            {records.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => { injectIntoDataset(records); onNavigateToData() }}
                        className="text-sm px-3 py-1.5 rounded-lg border border-blue-300 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    >
                        Add all to dataset
                    </button>
                    <button
                        onClick={() => exportAll('kml')}
                        className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                        Export KML
                    </button>
                    <button
                        onClick={() => exportAll('geojson')}
                        className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                        Export GeoJSON
                    </button>
                    {csvChoice ? (
                        <span className="flex items-center gap-2 text-sm">
                            <span className="text-gray-600 dark:text-gray-300">
                                {csvChoice === 'conventional' ? 'Data CSV' : 'CSV'} separator:
                            </span>
                            <button
                                onClick={() => exportCSV(csvChoice, ';')}
                                className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                                title="Excel on French / European locales"
                            >
                                Semicolon ( ; )
                            </button>
                            <button
                                onClick={() => exportCSV(csvChoice, ',')}
                                className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                                title="Excel on US locale / generic"
                            >
                                Comma ( , )
                            </button>
                            <button onClick={() => setCsvChoice(null)} className="text-gray-500 underline">Cancel</button>
                        </span>
                    ) : (
                        <>
                            <button
                                onClick={() => setCsvChoice('conventional')}
                                className="text-sm px-3 py-1.5 rounded-lg border border-blue-300 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                title="Strike / dip / dip direction — re-importable data file"
                            >
                                Export data CSV
                            </button>
                            <button
                                onClick={() => setCsvChoice('raw')}
                                className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                title="Full field record dump (notes, GPS, timestamps…) — not a valid inversion input"
                            >
                                Export full CSV (not compatible)
                            </button>
                            <button
                                onClick={exportZip}
                                className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                title="ZIP: data.csv + photos as separate image files referenced in the CSV"
                            >
                                Export ZIP (CSV + photos)
                            </button>
                        </>
                    )}
                    {confirmClearAll ? (
                        <span className="flex items-center gap-2 text-sm">
                            <span className="text-red-600">Erase all {records.length} record{records.length > 1 ? 's' : ''}?</span>
                            <button onClick={handleClearAll} className="text-red-600 font-semibold underline">Yes, erase</button>
                            <button onClick={() => setConfirmClearAll(false)} className="text-gray-500 underline">Cancel</button>
                        </span>
                    ) : (
                        <button
                            onClick={() => setConfirmClearAll(true)}
                            className="text-sm px-3 py-1.5 rounded-lg border border-red-300 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                            Erase all
                        </button>
                    )}
                </div>
            )}

            {/* Record list */}
            {records.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <p className="text-sm">No field records yet.</p>
                    <p className="text-xs mt-1">Tap <strong>New record</strong> to start measuring.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {records.map(r => (
                        <button
                            key={r.id}
                            onClick={() => { setSelected(r); setView('detail') }}
                            className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-600 text-left transition-colors"
                        >
                            <TypeIcon type={r.dataType} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium text-sm text-gray-800 dark:text-gray-100">
                                        {DATA_TYPE_LABELS[r.dataType]}
                                        {r.movementType && <span className="ml-1 text-gray-400">· {r.movementType}</span>}
                                    </span>
                                    <span className="flex items-center gap-1.5 text-xs text-gray-400">
                                        {r.audio && <span title="Voice note">🎤</span>}
                                        {r.attachments && r.attachments.length > 0 && <span title="Attachments">📎 {r.attachments.length}</span>}
                                        {r.photos.length > 0 && <span>{r.photos.length} photo{r.photos.length > 1 ? 's' : ''}</span>}
                                    </span>
                                </div>
                                {r.plane && (
                                    <div className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-0.5">
                                        {r.convention === 'dip_direction'
                                            ? `${r.plane.dipDirection}° / ${r.plane.dip}°`
                                            : `${r.plane.strike}° / ${r.plane.dip}°`}
                                        {r.striation && ` · stria ${r.striation.trend ?? '—'}°/${r.striation.plunge ?? '—'}°`}
                                    </div>
                                )}
                                <div className="text-xs text-gray-400 mt-0.5">
                                    {new Date(r.timestamp).toLocaleString()}
                                    {r.gps && <span className="ml-2">GPS ±{Math.round(r.gps.accuracy)} m</span>}
                                </div>
                                {r.notes && <div className="text-xs text-gray-400 truncate mt-0.5">{r.notes}</div>}
                            </div>
                            <svg className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

function TypeIcon({ type }: { type: string }) {
    const color = type === 'striated_fault' ? '#ef4444' : type === 'linear' ? '#8b5cf6' : '#3b82f6'
    return (
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + '20', color }}>
            {type === 'striated_fault' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                </svg>
            ) : type === 'linear' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
            ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
            )}
        </div>
    )
}

