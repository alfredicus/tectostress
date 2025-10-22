import { deg2rad, normalizeVector, Vector3 } from '../types'

/**
 * @param parameters 
 */
export function fromDipTrendToNormal({
    dipAngle,
    dipAzimuth,
}: {
    dipAngle: number
    dipAzimuth: number
}): Vector3 {
    const delta = deg2rad(dipAngle)
    const alpha = deg2rad(dipAzimuth)

    return normalizeVector([
        Math.sin(delta) * Math.sin(alpha),
        Math.sin(delta) * Math.cos(alpha),
        Math.cos(delta)
    ])
}
