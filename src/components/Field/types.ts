export type OrientationConvention = 'dip_direction' | 'strike_rhr'

export type DataType = 'plane' | 'linear' | 'striated_fault'

export type PlaneSubtype =
    | 'tension_fracture'
    | 'stylolite_plane'
    | 'joint'
    | 'bedding'
    | 'cleavage'
    | 'other_plane'

export type LinearSubtype =
    | 'stylolite_pick'
    | 'mineral_lineation'
    | 'intersection_lineation'
    | 'fold_axis'
    | 'other_linear'

// Matches TypeOfMovement codes used in the existing codebase
export type MovementType =
    | 'N'     // Normal
    | 'I'     // Inverse / Reverse
    | 'RL'    // Right lateral (dextral)
    | 'LL'    // Left lateral (sinistral)
    | 'N_RL'  // Normal + right lateral
    | 'N_LL'  // Normal + left lateral
    | 'I_RL'  // Inverse + right lateral
    | 'I_LL'  // Inverse + left lateral
    | 'UND'   // Undefined

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
    N:    'Normal',
    I:    'Reverse / Thrust',
    RL:   'Dextral (right lateral)',
    LL:   'Sinistral (left lateral)',
    N_RL: 'Normal + Dextral',
    N_LL: 'Normal + Sinistral',
    I_RL: 'Reverse + Dextral',
    I_LL: 'Reverse + Sinistral',
    UND:  'Undetermined',
}

export interface PlaneOrientation {
    dipDirection: number   // 0–360°  (azimuth of dip)
    dip: number            // 0–90°
    strike: number         // 0–360° (dipDirection − 90, mod 360)
}

export interface StriationOrientation {
    // Pitch (rake) on the plane + which end of the strike the rake is measured from
    pitch: number          // 0–90°
    pitchSide: 'N' | 'E' | 'S' | 'W'
    // Derived absolute trend/plunge (computed from plane + pitch)
    trend?: number
    plunge?: number
}

export interface GpsPosition {
    latitude: number
    longitude: number
    altitude: number | null
    accuracy: number        // metres
    timestamp: number
}

export interface FieldRecord {
    id: string
    timestamp: string       // ISO 8601
    dataType: DataType
    planeSubtype?: PlaneSubtype
    linearSubtype?: LinearSubtype

    plane?: PlaneOrientation
    striation?: StriationOrientation
    movementType?: MovementType

    gps?: GpsPosition
    photos: string[]        // data-URIs or Capacitor file paths
    notes: string
    convention: OrientationConvention
}

export function createEmptyRecord(): FieldRecord {
    return {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        dataType: 'striated_fault',
        photos: [],
        notes: '',
        convention: 'dip_direction',
    }
}
