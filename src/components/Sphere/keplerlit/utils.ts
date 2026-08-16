import { Color } from "./Color"
import { ColorMap, createLut } from "./colorMap"

/**
 * @brief Linearly interpolates between two values. This name is a contraction of "linear interpolation"
 * @param t The parameter t is clamped to the range [0, 1]
 * @param min The minimum value
 * @param max The minimum value
 * @example
 * ```ts
 * lerp(0  , 1, 5) // 1
 * lerp(0.5, 1, 5) // 3
 * lerp(1  , 1, 5) // 5
 * ```
 * @category Utils
 */
export const lerp = (t: number, min: number, max: number) => {
    if (t < 0 || t > 1) throw new Error(`t must be clamped to the range [0,1]. Got ${t}`)
    return (1 - t) * min + t * max
}

/**
 * @brief Compute the minimum and maximum value of an array in one pass
 */
export function minMax(array: Array<number>): Array<number> {
    let m = Number.POSITIVE_INFINITY
    let M = Number.NEGATIVE_INFINITY
    const n = array.length
    for (let i = 0; i < n; ++i) {
        const a = array[i]
        if (a < m) m = a
        if (a > M) M = a
    }
    return [m, M]
}

/**
 * @brief Compute the maximum value of an array
 */
export function max(array: Array<number>): number {
    let m = Number.NEGATIVE_INFINITY
    const n = array.length
    for (let i = 0; i < n; ++i) {
        const a = array[i]
        if (a > m) m = a
    }
    return m
}

/**
 * @brief Compute the minimum value of an array
 */
export function min(array: Array<number>): number {
    let m = Number.POSITIVE_INFINITY
    const n = array.length
    for (let i = 0; i < n; ++i) {
        const a = array[i]
        if (a < m) m = a
    }
    return m
}

/**
 * @brief Normalize an array of numbers to the range [0, 1]
 */
export function normalize(array: Array<number>): Array<number> {
    const m = minMax(array)
    return array.map((v) => (v - m[0]) / (m[1] - m[0]))
}

/**
 * @brief Scale an array of numbers by a factor
 */
export function scale(array: Array<number>, s: number): Array<number> {
    return array.map((v) => v * s)
}

/**
 * @param value The value to transform in to a color using a lookup table
 * @param params An object to deal with min, max, lut, default-color and reverse table.
 * The value **must** be normalized.
 * @returns [reg, green, blue]
 * @category Lookup Table 
 */
export function fromValueToColor(
    value: number,
    { min = 0, max = 1, lutTable, defaultColor, reverse = false }:
        { min?: number, max?: number, lutTable: ColorMap, defaultColor: Color, reverse?: boolean }):
    [number, number, number] {
    if (value < 0 || value > 1) {
        throw new Error(`value *must% be normalized. Got ${value}`)
    }

    let w = reverse ? (1.0 - value) : value
    if (w >= min && w <= max) {
        const c = lutTable.getColor(w)
        return [c.r, c.g, c.b]
    }

    return [defaultColor.r, defaultColor.g, defaultColor.b]
}

/**
 * @param values 
 * @param param1 
 * @returns 
 * @category Lookup Table 
 */
export function fromValuesToColors(
    values: Array<number>,
    { defaultColor, lut, duplicateLut = 1, min = 0, max = 1, lockLut = true, reverse = false }:
        { defaultColor: Color, lut: string | ColorMap, duplicateLut?: number, min?: number, max?: number, lockLut?: boolean, reverse?: boolean }): number[] {
    const lutTable = (lut instanceof ColorMap ? lut : createLut(lut, 32, duplicateLut))
    const minmax = minMax(values)
    const vmin = minmax[0]
    const vmax = minmax[1]

    if (lockLut) {
        lutTable.setMin(0).setMax(1)
    } else {
        lutTable.setMin(min).setMax(max)
    }

    let colors = new Array(3 * values.length).fill(0)

    values.forEach((v, i) => {
        const w = reverse ? (v - vmax) / (vmin - vmax) : (v - vmin) / (vmax - vmin)
        if (w >= min && w <= max) {
            const c = lutTable.getColor(w)
            colors[3 * i] = c.r; colors[3 * i + 1] = c.g; colors[3 * i + 2] = c.b
        }
        else {
            colors[3 * i] = defaultColor.r; colors[3 * i + 1] = defaultColor.g; colors[3 * i + 2] = defaultColor.b
        }
    })

    return colors
}
