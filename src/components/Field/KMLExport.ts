import JSZip from 'jszip'
import { FieldRecord } from './types'
import { CONVENTIONAL_HEADERS, toConventionalRow } from './toDatasetRow'
import { AttachmentStore } from './AttachmentStore'

function escapeXml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function recordDescription(r: FieldRecord): string {
    const lines: string[] = []
    lines.push(`Type: ${r.dataType}`)
    if (r.planeSubtype) lines.push(`Subtype: ${r.planeSubtype}`)
    if (r.linearSubtype) lines.push(`Lineation: ${r.linearSubtype}`)
    if (r.plane) {
        lines.push(r.convention === 'dip_direction'
            ? `Plane: ${r.plane.dipDirection}° / ${r.plane.dip}° (dip dir / dip)`
            : `Plane: ${r.plane.strike}° / ${r.plane.dip}° (strike RHR / dip)`)
    }
    if (r.striation) {
        lines.push(`Striation trend/plunge: ${r.striation.trend ?? '—'}° / ${r.striation.plunge ?? '—'}°`)
    }
    if (r.movementType) lines.push(`Movement: ${r.movementType}`)
    if (r.notes) lines.push(`Notes: ${r.notes}`)
    lines.push(`Recorded: ${r.timestamp}`)
    return lines.join('\n')
}

export function toKML(records: FieldRecord[]): string {
    const placemarks = records
        .map(r => {
            const point = r.gps
                ? `
      <Point>
        <altitudeMode>clampToGround</altitudeMode>
        <coordinates>${r.gps.longitude},${r.gps.latitude},${r.gps.altitude ?? 0}</coordinates>
      </Point>`
                : ''
            return `    <Placemark>
      <name>${escapeXml(`${r.dataType} — ${r.timestamp.slice(0, 10)}`)}</name>
      <description>${escapeXml(recordDescription(r))}</description>${point}
    </Placemark>`
        })
        .join('\n')

    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Tectostress Field Records</name>
${placemarks}
  </Document>
</kml>`
}

export function toGeoJSON(records: FieldRecord[]): string {
    const features = records
        .map(r => {
            const geometry = r.gps
                ? {
                    type: 'Point',
                    coordinates: r.gps.altitude !== null
                        ? [r.gps.longitude, r.gps.latitude, r.gps.altitude]
                        : [r.gps.longitude, r.gps.latitude],
                }
                : null
            return {
                type: 'Feature',
                geometry,
                properties: {
                    id: r.id,
                    timestamp: r.timestamp,
                    dataType: r.dataType,
                    planeSubtype: r.planeSubtype ?? null,
                    linearSubtype: r.linearSubtype ?? null,
                    dipDirection: r.plane?.dipDirection ?? null,
                    dip: r.plane?.dip ?? null,
                    strike: r.plane?.strike ?? null,
                    striationTrend: r.striation?.trend ?? null,
                    striationPlunge: r.striation?.plunge ?? null,
                    movementType: r.movementType ?? null,
                    gpsAccuracy: r.gps?.accuracy ?? null,
                    notes: r.notes,
                    convention: r.convention,
                },
            }
        })

    return JSON.stringify({ type: 'FeatureCollection', features }, null, 2)
}

// Delimiter is chosen at export time. ';' is what Excel expects on European
// (e.g. French) locales; ',' is the US-locale / generic default. Numbers /
// LibreOffice / Google Sheets auto-detect either one.
export type CsvDelimiter = ',' | ';'

function csvCell(v: string | number | null | undefined): string {
    if (v === null || v === undefined) return ''
    const s = String(v)
    // Quote on any delimiter candidate so the cell is safe whichever is used.
    return /["\n\r,;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const FULL_HEADERS = [
    'id', 'timestamp', 'dataType', 'planeSubtype', 'linearSubtype', 'convention',
    'dipDirection', 'dip', 'strike',
    'striationPitch', 'striationPitchSide', 'striationTrend', 'striationPlunge',
    'movementType',
    'latitude', 'longitude', 'altitude', 'gpsAccuracy',
    'notes',
]

// All full-dump field columns for one record (photos are exported via the zip,
// not embedded here).
function fullRowCells(r: FieldRecord): (string | number)[] {
    return [
        r.id,
        r.timestamp,
        r.dataType,
        r.planeSubtype ?? '',
        r.linearSubtype ?? '',
        r.convention,
        r.plane?.dipDirection ?? '',
        r.plane?.dip ?? '',
        r.plane?.strike ?? '',
        r.striation?.pitch ?? '',
        r.striation?.pitchSide ?? '',
        r.striation?.trend ?? '',
        r.striation?.plunge ?? '',
        r.movementType ?? '',
        r.gps?.latitude ?? '',
        r.gps?.longitude ?? '',
        r.gps?.altitude ?? '',
        r.gps?.accuracy ?? '',
        r.notes,
    ]
}

export function toCSV(records: FieldRecord[], sep: CsvDelimiter = ';'): string {
    const rows = records.map(r => fullRowCells(r).map(csvCell).join(sep))
    // CRLF line endings + UTF-8 BOM so Excel opens it correctly (delimiter and
    // accents) on a double-click.
    return '\uFEFF' + [FULL_HEADERS.join(sep), ...rows].join('\r\n')
}

/**
 * Generic CSV serializer for plain row objects keyed by header. Shares the same
 * BOM + CRLF + quoting rules as toCSV so files open cleanly in Excel/Numbers.
 */
export function serializeCSV(headers: readonly string[], rows: Record<string, any>[], sep: CsvDelimiter = ';'): string {
    const head = headers.map(csvCell).join(sep)
    const body = rows.map(row => headers.map(h => csvCell(row[h])).join(sep))
    return '\uFEFF' + [head, ...body].join('\r\n')
}

// Split a `data:<mime>[;params];base64,<payload>` URI into its payload and a
// file extension derived from the mime type. Tolerates extra parameters such as
// the `;codecs=opus` that MediaRecorder adds to audio data-URIs.
function dataUriToParts(dataUri: string): { base64: string; ext: string } {
    const comma = dataUri.indexOf(',')
    if (!dataUri.startsWith('data:') || comma === -1) return { base64: '', ext: 'bin' }
    const header = dataUri.slice(5, comma)        // e.g. "audio/webm;codecs=opus;base64"
    if (!/;base64$/i.test(header)) return { base64: '', ext: 'bin' }
    const mime = header.split(';')[0]             // e.g. "audio/webm"
    const ext = mime === 'image/png' ? 'png'
              : mime === 'image/jpeg' ? 'jpg'
              : mime === 'audio/webm' ? 'webm'
              : mime === 'audio/mp4'  ? 'm4a'
              : mime === 'audio/mpeg' ? 'mp3'
              : (mime.split('/')[1] || 'bin')
    return { base64: dataUri.slice(comma + 1), ext }
}

/**
 * Build a .zip backup: the conventional, re-importable `data.csv` (same as the
 * "Export data CSV") plus a `photos` column whose values reference image files
 * stored decoded under `photos/` (e.g. `photos/rec-2-1.jpg`).
 */
export async function toZip(records: FieldRecord[], sep: CsvDelimiter = ';'): Promise<Blob> {
    const zip = new JSZip()
    const photosDir = zip.folder('photos')!
    const audioDir = zip.folder('audio')!
    const filesDir = zip.folder('files')!
    const headers = [...CONVENTIONAL_HEADERS, 'photos', 'voice', 'files']

    const withPlane = records.filter(r => r.plane)
    const lines: string[] = []

    for (let idx = 0; idx < withPlane.length; idx++) {
        const r = withPlane[idx]
        const row = toConventionalRow(r, idx + 1) as Record<string, any>

        const photoRefs = (r.photos ?? []).map((uri, j) => {
            const { base64, ext } = dataUriToParts(uri)
            const name = `rec-${idx + 1}-${j + 1}.${ext}`
            if (base64) photosDir.file(name, base64, { base64: true })
            return `photos/${name}`
        })

        let voiceRef = ''
        if (r.audio) {
            const { base64, ext } = dataUriToParts(r.audio)
            if (base64) {
                const name = `rec-${idx + 1}.${ext}`
                audioDir.file(name, base64, { base64: true })
                voiceRef = `audio/${name}`
            }
        }

        // Attachments: pull each blob from IndexedDB and store it as a real file.
        const fileRefs: string[] = []
        for (const a of r.attachments ?? []) {
            const blob = await AttachmentStore.get(a.id)
            if (!blob) continue
            const safe = a.name.replace(/[\/\\]/g, '_')
            const name = `rec-${idx + 1}-${safe}`
            filesDir.file(name, blob)
            fileRefs.push(`files/${name}`)
        }

        lines.push(headers
            .map(h =>
                h === 'photos' ? photoRefs.join('|')
                : h === 'voice' ? voiceRef
                : h === 'files' ? fileRefs.join('|')
                : row[h])
            .map(csvCell)
            .join(sep))
    }

    const csv = '\uFEFF' + [headers.map(csvCell).join(sep), ...lines].join('\r\n')
    zip.file('data.csv', csv)

    return zip.generateAsync({ type: 'blob' })
}

export function downloadText(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Share / save-as — lets the user pick a destination (Files / iCloud, Google
// Drive, Dropbox…) via the native share sheet, with graceful degradation.
// ---------------------------------------------------------------------------

let Capacitor: any = null
let Filesystem: any = null
let Directory: any = null
let Encoding: any = null
let Share: any = null

try { Capacitor = require('@capacitor/core').Capacitor } catch { /* web */ }
try {
    const fs = require('@capacitor/filesystem')
    Filesystem = fs.Filesystem
    Directory = fs.Directory
    Encoding = fs.Encoding
} catch { /* web */ }
try { Share = require('@capacitor/share').Share } catch { /* web */ }

// Treat as "mobile" when running natively, or in a touch / coarse-pointer
// browser. On desktop we skip the share sheet and download directly.
function isMobileLike(): boolean {
    if (Capacitor?.isNativePlatform?.()) return true
    if (typeof navigator === 'undefined') return false
    const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)')?.matches
    const touch = (navigator as any).maxTouchPoints > 0
    return !!coarse || touch
}

/**
 * Offer the user a destination to save `content`:
 *   1. Native (iOS/Android): write to the cache dir, then open the OS share
 *      sheet (Files, Drive, Dropbox… depending on installed apps).
 *   2. Web Share API (mobile browsers only): share the file through the
 *      browser's share sheet when supported.
 *   3. Desktop, or anything unsupported: classic download to the Downloads folder.
 */
export async function shareOrDownload(content: string, filename: string, mimeType: string) {
    // 1. Native share sheet
    if (Capacitor?.isNativePlatform?.() && Filesystem && Share) {
        try {
            const { uri } = await Filesystem.writeFile({
                path: filename,
                data: content,
                directory: Directory.Cache,
                encoding: Encoding.UTF8,
            })
            // Use `files` (not `url`): iOS then treats it as a document, so the
            // share sheet offers "Save to Files", Google Drive, Dropbox… and not
            // only communication apps (AirDrop, Messages, Notes…).
            await Share.share({ title: filename, files: [uri] })
        } catch (e) {
            // user dismissed the sheet, or an error occurred — don't double-save
            console.warn('Native share cancelled/failed:', e)
        }
        return
    }

    // 2. Web Share API with a file attachment — mobile/touch browsers only
    if (isMobileLike()) {
        try {
            const file = new File([content], filename, { type: mimeType })
            const nav = navigator as any
            if (nav.canShare?.({ files: [file] })) {
                await nav.share({ files: [file], title: filename })
                return
            }
        } catch (e: any) {
            if (e?.name === 'AbortError') return   // user cancelled the share sheet
            console.warn('Web share failed, falling back to download:', e)
        }
    }

    // 3. Desktop, or share unsupported: classic download
    downloadText(content, filename, mimeType)
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(String(reader.result).split(',')[1] ?? '')
        reader.onerror = reject
        reader.readAsDataURL(blob)
    })
}

/**
 * Binary counterpart of shareOrDownload for Blobs (e.g. a .zip): native share
 * sheet → Web Share API (mobile) → classic download.
 */
export async function shareOrDownloadBlob(blob: Blob, filename: string, mimeType: string) {
    // 1. Native share sheet (write the binary as base64 to the cache dir)
    if (Capacitor?.isNativePlatform?.() && Filesystem && Share) {
        try {
            const base64 = await blobToBase64(blob)
            const { uri } = await Filesystem.writeFile({
                path: filename,
                data: base64,
                directory: Directory.Cache,
            })
            await Share.share({ title: filename, files: [uri] })
        } catch (e) {
            console.warn('Native share cancelled/failed:', e)
        }
        return
    }

    // 2. Web Share API with a file attachment — mobile/touch browsers only
    if (isMobileLike()) {
        try {
            const file = new File([blob], filename, { type: mimeType })
            const nav = navigator as any
            if (nav.canShare?.({ files: [file] })) {
                await nav.share({ files: [file], title: filename })
                return
            }
        } catch (e: any) {
            if (e?.name === 'AbortError') return
            console.warn('Web share failed, falling back to download:', e)
        }
    }

    // 3. Desktop, or share unsupported: classic download
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}
