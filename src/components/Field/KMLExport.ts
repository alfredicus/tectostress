import { FieldRecord } from './types'

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
        .filter(r => r.gps)
        .map(r => {
            const { latitude, longitude, altitude } = r.gps!
            const alt = altitude ?? 0
            return `    <Placemark>
      <name>${escapeXml(`${r.dataType} — ${r.timestamp.slice(0, 10)}`)}</name>
      <description>${escapeXml(recordDescription(r))}</description>
      <Point>
        <altitudeMode>clampToGround</altitudeMode>
        <coordinates>${longitude},${latitude},${alt}</coordinates>
      </Point>
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
        .filter(r => r.gps)
        .map(r => {
            const { latitude, longitude, altitude, accuracy } = r.gps!
            return {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: altitude !== null
                        ? [longitude, latitude, altitude]
                        : [longitude, latitude],
                },
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
                    gpsAccuracy: accuracy,
                    notes: r.notes,
                    convention: r.convention,
                },
            }
        })

    return JSON.stringify({ type: 'FeatureCollection', features }, null, 2)
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
