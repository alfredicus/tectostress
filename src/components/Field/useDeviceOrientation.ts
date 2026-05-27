import { useState, useEffect, useCallback, useRef } from 'react'
import { PlaneOrientation, StriationOrientation } from './types'

export interface OrientationReading extends PlaneOrientation {
    // Striation: phone top-axis projected onto the fault plane
    rake: number                    // 0–90°  (angle from strike, in the plane)
    pitchSide: 'N' | 'E' | 'S' | 'W'
    striaTrend: number              // 0–360° absolute azimuth of striation
    striaPlunge: number             // 0–90°  plunge below horizontal

    raw: { alpha: number; beta: number; gamma: number } | null
    available: boolean
    error: string | null
}

export interface CombinedSnapshot {
    plane: PlaneOrientation
    striation: StriationOrientation
}

/** Values the user controls when in virtual/desktop-simulator mode */
export interface VirtualSensorValues {
    dipDirection: number    // 0–360°
    dip: number             // 0–90°
    rake: number            // 0–90°
    striaTrend: number      // 0–360°
    striaPlunge: number     // 0–90°
}

const INITIAL: OrientationReading = {
    dipDirection: 0, dip: 0, strike: 0,
    rake: 0, pitchSide: 'N', striaTrend: 0, striaPlunge: 0,
    raw: null, available: false, error: null,
}

const DEFAULT_VIRTUAL: VirtualSensorValues = {
    dipDirection: 45, dip: 60, rake: 30, striaTrend: 45, striaPlunge: 25,
}

function computeAll(alpha: number, beta: number, gamma: number): Omit<OrientationReading, 'raw' | 'available' | 'error'> {
    // W3C DeviceOrientationEvent (absolute=true) convention:
    //   alpha = compass heading of phone -Y axis, CW from North (0–360)
    //   beta  = front-back tilt (-180..180), positive = top toward user
    //   gamma = left-right tilt (-90..90),   positive = tilted right
    //
    // Phone physical gesture for a striated fault:
    //   Lay phone FACE-UP on the fault plane, phone TOP pointing along the slickenline.
    //   → plane normal  = screen-up direction (phone Z-axis in world frame)
    //   → striation dir = phone Y-axis (top) projected onto the fault plane

    const toRad = (d: number) => (d * Math.PI) / 180
    const a = toRad(alpha), b = toRad(beta), g = toRad(gamma)

    const cosA = Math.cos(a), sinA = Math.sin(a)
    const cosB = Math.cos(b), sinB = Math.sin(b)
    const cosG = Math.cos(g), sinG = Math.sin(g)

    // Rotate a device-frame vector v through R = Rz(α)·Rx(β)·Ry(γ)
    function rotate(vx: number, vy: number, vz: number) {
        // Ry(γ)
        const x1 = cosG * vx + sinG * vz
        const y1 = vy
        const z1 = -sinG * vx + cosG * vz
        // Rx(β)
        const x2 = x1
        const y2 = cosB * y1 - sinB * z1
        const z2 = sinB * y1 + cosB * z1
        // Rz(α)
        return {
            x: cosA * x2 - sinA * y2,   // East
            y: sinA * x2 + cosA * y2,   // North
            z: z2                         // Up
        }
    }

    // ── Plane normal ──────────────────────────────────────────────────────
    // Device Z-axis = (0,0,1) = screen-up direction (away from phone back)
    // When phone is face-up on a plane, screen-up = upward pole of the plane
    const pole = rotate(0, 0, 1)

    // Ensure pole points upward (if phone face-down, flip)
    const sign = pole.z >= 0 ? 1 : -1
    const pE = sign * pole.x   // East
    const pN = sign * pole.y   // North
    const pZ = sign * pole.z   // Up  (always ≥ 0)

    // Dip = 90° − angle(pole, vertical)
    const dip = Math.max(0, Math.min(90,
        Math.round(90 - (Math.acos(Math.min(1, pZ)) * 180) / Math.PI)
    ))

    // Dip direction = azimuth of the downward pole projection onto horizontal
    let dipDir = (Math.atan2(-pE, -pN) * 180) / Math.PI
    dipDir = ((dipDir % 360) + 360) % 360
    const dipDirection = Math.round(dipDir)
    const strike = (dipDirection - 90 + 360) % 360

    // ── Striation ─────────────────────────────────────────────────────────
    // Device Y-axis = (0,1,0) = phone top-button direction
    const topWorld = rotate(0, 1, 0)

    // Project phone-top onto the fault plane: subtract component along pole
    const dot = topWorld.x * pE + topWorld.y * pN + topWorld.z * pZ
    let sE = topWorld.x - dot * pE
    let sN = topWorld.y - dot * pN
    let sZ = topWorld.z - dot * pZ

    const mag = Math.sqrt(sE * sE + sN * sN + sZ * sZ)
    if (mag > 1e-4) { sE /= mag; sN /= mag; sZ /= mag }

    // Ensure striation points downward (plunging end, not rising end)
    if (sZ > 0) { sE = -sE; sN = -sN; sZ = -sZ }

    // Trend & plunge
    let striaTrend = (Math.atan2(sE, sN) * 180) / Math.PI
    striaTrend = ((striaTrend % 360) + 360) % 360
    const striaPlunge = Math.max(0, Math.min(90,
        Math.round((Math.asin(Math.max(-1, Math.min(1, -sZ))) * 180) / Math.PI)
    ))

    // Rake: angle between striation and strike direction in the plane
    const strikeRad = (strike * Math.PI) / 180
    const strikE = Math.sin(strikeRad), strikN = Math.cos(strikeRad)
    const cosRake = Math.max(-1, Math.min(1, sE * strikE + sN * strikN))
    let rake = Math.round((Math.acos(cosRake) * 180) / Math.PI)
    if (rake > 90) rake = 180 - rake

    // PitchSide: which end of the strike the striation is measured from
    const pitchSide = azimuthToCardinal(striaTrend)

    return { dipDirection, dip, strike, rake, pitchSide, striaTrend: Math.round(striaTrend), striaPlunge }
}

function azimuthToCardinal(az: number): 'N' | 'E' | 'S' | 'W' {
    const a = ((az % 360) + 360) % 360
    if (a < 45 || a >= 315) return 'N'
    if (a < 135) return 'E'
    if (a < 225) return 'S'
    return 'W'
}

/** Build a full OrientationReading from virtual slider values */
function makeVirtualReading(v: VirtualSensorValues): OrientationReading {
    const strike = (v.dipDirection - 90 + 360) % 360
    const pitchSide = azimuthToCardinal(v.striaTrend)
    return {
        dipDirection: v.dipDirection,
        dip: v.dip,
        strike,
        rake: v.rake,
        pitchSide,
        striaTrend: v.striaTrend,
        striaPlunge: v.striaPlunge,
        raw: null,
        available: true,
        error: null,
    }
}

export function useDeviceOrientation() {
    const [reading, setReading] = useState<OrientationReading>(INITIAL)
    const latestRef = useRef<OrientationReading | null>(null)

    // ── Virtual / desktop-simulator mode ─────────────────────────────────
    const [virtualMode, setVirtualMode] = useState(false)
    const [virtualVals, setVirtualVals] = useState<VirtualSensorValues>(DEFAULT_VIRTUAL)

    // Keep latestRef in sync with virtual mode so snapshot() is correct
    useEffect(() => {
        if (virtualMode) {
            const r = makeVirtualReading(virtualVals)
            latestRef.current = r
            setReading(r)
        }
    }, [virtualMode, virtualVals])

    const requestPermission = useCallback(async (): Promise<boolean> => {
        if (virtualMode) return true
        const DevOri = DeviceOrientationEvent as any
        if (typeof DevOri.requestPermission === 'function') {
            try {
                const result = await DevOri.requestPermission()
                if (result !== 'granted') {
                    setReading(r => ({ ...r, error: 'Motion permission denied. Please allow in Settings.' }))
                    return false
                }
            } catch {
                setReading(r => ({ ...r, error: 'Could not request motion permission.' }))
                return false
            }
        }
        return true
    }, [virtualMode])

    useEffect(() => {
        // When virtual mode is active the event listener is not needed
        if (virtualMode) return

        let frameId: number | null = null
        let pending: { alpha: number; beta: number; gamma: number } | null = null

        function onOrientation(evt: DeviceOrientationEvent) {
            if (evt.alpha === null || evt.beta === null || evt.gamma === null) return
            pending = { alpha: evt.alpha, beta: evt.beta, gamma: evt.gamma }
        }

        function tick() {
            if (pending) {
                const { alpha, beta, gamma } = pending
                const computed = computeAll(alpha, beta, gamma)
                const full: OrientationReading = { ...computed, raw: { alpha, beta, gamma }, available: true, error: null }
                latestRef.current = full
                setReading(full)
                pending = null
            }
            frameId = requestAnimationFrame(tick)
        }

        const win = window as any
        if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
            if ('ondeviceorientationabsolute' in win) {
                win.addEventListener('deviceorientationabsolute', onOrientation, true)
            } else {
                window.addEventListener('deviceorientation', onOrientation, true)
            }
            frameId = requestAnimationFrame(tick)
        } else {
            setReading(r => ({ ...r, error: 'Device orientation not available on this device.' }))
        }

        return () => {
            if ('ondeviceorientationabsolute' in win) {
                win.removeEventListener('deviceorientationabsolute', onOrientation, true)
            } else {
                window.removeEventListener('deviceorientation', onOrientation, true)
            }
            if (frameId !== null) cancelAnimationFrame(frameId)
        }
    }, [virtualMode])

    // Snapshot returns plane + striation together for one-click capture
    const snapshot = useCallback((): CombinedSnapshot | null => {
        const r = latestRef.current
        if (!r) return null
        return {
            plane: { dipDirection: r.dipDirection, dip: r.dip, strike: r.strike },
            striation: { pitch: r.rake, pitchSide: r.pitchSide, trend: r.striaTrend, plunge: r.striaPlunge },
        }
    }, [])

    return {
        reading,
        snapshot,
        requestPermission,
        // Virtual / desktop-simulator API
        virtualMode,
        setVirtualMode,
        virtualVals,
        setVirtualVals,
    }
}
