import { normalizeName, DataFactory } from '@alfredo-taboada/stress'
import { FieldRecord, MovementType } from './types'

/**
 * Builds, from a captured FieldRecord, a row object that exactly matches the
 * parameters the @alfredo-taboada/stress library reads at runtime for the
 * corresponding data type — using the canonical (space-separated) keys the
 * library's readers consume.
 *
 * The library is internally inconsistent about the dip-direction key, so we
 * match each family's actual reader (verified against the compiled library):
 *   - Fractures / stylolites (FractureData → decodePlane) read camelCase
 *     `dipDirection`.
 *   - Striated faults (FaultData → readStriatedFaultPlane) read the
 *     space-separated `dip direction`, `rake`, `strike direction`,
 *     `type of movement`.
 *
 * Rather than trusting the stored (strike, dipDirection) pair — which can be
 * inconsistent for old records or after a convention toggle — both strike and
 * dip direction are re-derived from the measured dip azimuth so the plane is
 * always geometrically valid.
 */

// ---------------------------------------------------------------------------
// Field type → registered library data-type name (see DataFactory bindings)
// ---------------------------------------------------------------------------
export function libTypeName(r: FieldRecord): string {
    if (r.dataType === 'striated_fault') return 'striated plane'

    if (r.dataType === 'linear') {
        // Stylolite picks behave like a stylolite interface; other lineations
        // are best represented as extension fractures (passive stretching).
        return r.linearSubtype === 'stylolite_pick' ? 'stylolite interface' : 'extension fracture'
    }

    // dataType === 'plane'
    switch (r.planeSubtype) {
        case 'stylolite_plane': return 'stylolite interface'
        case 'joint':           return 'joint'
        case 'tension_fracture':
        case 'bedding':
        case 'cleavage':
        case 'other_plane':
        default:                return 'extension fracture'
    }
}

const STRIATED_TYPES = new Set(['striated plane', 'neoformed striated plane'])

// ---------------------------------------------------------------------------
// 8-way cardinal from an azimuth in degrees.
// ---------------------------------------------------------------------------
function azimuthToCardinal(deg: number): string {
    const d = ((deg % 360) + 360) % 360
    if (d < 22.5 || d >= 337.5) return 'N'
    if (d < 67.5)  return 'NE'
    if (d < 112.5) return 'E'
    if (d < 157.5) return 'SE'
    if (d < 202.5) return 'S'
    if (d < 247.5) return 'SW'
    if (d < 292.5) return 'W'
    return 'NW'
}

// Normalize an angle to [0, 360).
const norm360 = (deg: number): number => ((deg % 360) + 360) % 360

/**
 * Convert an internal movement code (e.g. `N_RL`) into a string the library's
 * `CTypeOfMovement.fromString` accepts. `normalizeName` lowercases and turns
 * underscores into spaces, matching the library's accepted forms (`n rl`, …).
 */
function movementParam(m?: MovementType): string {
    return m ? normalizeName(m) : 'und'
}

export interface DatasetRowResult {
    row?: Record<string, any>
    error?: string
}

// ---------------------------------------------------------------------------
// Conventional geologist data file (re-importable)
// ---------------------------------------------------------------------------
// Same plane re-expressed with the three conventional parameters
// (strike, dip, dip direction) plus the fault movement parameters, using the
// space-separated headers of the standard data files (see strike-slip.csv).
export const CONVENTIONAL_HEADERS = [
    'id', 'type', 'strike', 'dip', 'dip direction',
    'rake', 'strike direction', 'type of movement', 'notes',
] as const

/**
 * Express one record as a conventional data-file row. The original measurement
 * (dip + dip-direction azimuth) is re-expressed as:
 *   - strike = dip azimuth − 90°  (the strike line; the dip direction letter
 *     disambiguates which side the plane dips toward)
 *   - dip    = unchanged
 *   - dip direction = nearest geographic letter (N, NE, … NW) to the azimuth
 * Fault columns are left empty for non-striated data.
 */
export function toConventionalRow(r: FieldRecord, id: number): Record<string, any> | null {
    if (!r.plane) return null

    const type = libTypeName(r)
    const dip = r.plane.dip
    const dipAzimuth = norm360(r.plane.dipDirection)
    const strike = norm360(dipAzimuth - 90)
    // Vertical/horizontal planes carry no dip direction (handled separately).
    const dipDirection = (dip > 0 && dip < 90) ? azimuthToCardinal(dipAzimuth) : ''

    const isStriated = STRIATED_TYPES.has(type)

    return {
        id,
        type,
        strike,
        dip,
        'dip direction': dipDirection,
        rake: isStriated && r.striation ? r.striation.pitch : '',
        'strike direction': isStriated && r.striation ? r.striation.pitchSide : '',
        'type of movement': isStriated ? movementParam(r.movementType) : '',
        notes: r.notes ?? '',
    }
}

export function recordsToConventionalRows(records: FieldRecord[]): Record<string, any>[] {
    return records
        .filter(r => r.plane)
        .map((r, i) => toConventionalRow(r, i + 1) as Record<string, any>)
}

/**
 * Produce a library-ready row for a record, or an error message if the plane
 * geometry is inconsistent. `id` is the 1-based index used by the library for
 * its own diagnostics.
 */
export function toDatasetRow(r: FieldRecord, id: number): DatasetRowResult {
    if (!r.plane) return { error: `Record ${id}: no plane orientation captured` }

    const type = libTypeName(r)
    const dip = r.plane.dip

    // The dip-direction azimuth is the primary sensor measurement; the strike is
    // derived from it. Re-derive both here from the azimuth so the exported
    // (strike, dip direction) pair is always self-consistent — independent of a
    // possibly stale stored strike — and faithful to the measured dip azimuth.
    const dipAzimuth = norm360(r.plane.dipDirection)
    const strike = norm360(dipAzimuth - 90)
    // Vertical/horizontal planes have no dip direction (library expects it undefined).
    const dipDirection = (dip > 0 && dip < 90) ? azimuthToCardinal(dipAzimuth) : undefined

    const isStriated = STRIATED_TYPES.has(type)
    const row: Record<string, any> = { id, type, strike, dip }

    if (dipDirection) {
        // Key differs by family — see the module header.
        if (isStriated) row['dip direction'] = dipDirection
        else            row['dipDirection'] = dipDirection
    }

    if (isStriated && r.striation) {
        row['rake'] = r.striation.pitch
        row['strike direction'] = r.striation.pitchSide
        row['type of movement'] = movementParam(r.movementType)
    }

    // Validate by attempting the very same initialization the inversion does at
    // Run time, so any inconsistency (plane geometry, striation orthogonality,
    // movement vs. rake…) surfaces here in the Field tab instead of later.
    const data = DataFactory.create(type)
    if (!data) return { error: `Record ${id}: unsupported data type "${type}"` }
    try {
        data.initialize({ ...row })
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return { error: `Record ${id} (${type}): ${msg}` }
    }

    return { row }
}

/**
 * Map a list of records to library-ready rows, splitting valid rows from
 * per-record error messages so the caller can surface problems in the UI.
 */
export function recordsToDataset(records: FieldRecord[]): { rows: Record<string, any>[]; errors: string[] } {
    const rows: Record<string, any>[] = []
    const errors: string[] = []
    records
        .filter(r => r.plane)
        .forEach((r, i) => {
            const { row, error } = toDatasetRow(r, i + 1)
            if (row) rows.push(row)
            else if (error) errors.push(error)
        })
    return { rows, errors }
}
