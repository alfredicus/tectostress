import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute } from "./attributes"
import { Color } from "./Color"
import { ColorMap, createLut } from "./colorMap"
import { MarchingTriangles } from "./MarchingTriangle"
import { fromValueToColor, minMax } from "./utils"

export type IsoLineReturnedType = {
    positions: number[],
    color?: number[]
}

export function createIsoContourLines(mesh: BufferGeometry, attribute: number[], isoList: number[], defaultColor: string, lut?: string): IsoLineReturnedType {
    if (mesh === undefined) {
        throw new Error('mesh is undefined')
    }

    if (mesh.getPositions() === undefined) {
        throw new Error('mesh.positions is undefined')
    }

    if (mesh.getIndices() === undefined) {
        throw new Error('mesh.indices is undefined')
    }

    if (attribute === undefined) {
        throw new Error('attribute is undefined')
    }

    const mm = minMax(attribute)
    const vmin = mm[0]
    const vmax = mm[1]


    let lutTable = undefined
    //if (lut === undefined || lut === null) {
    lutTable = createLut(lut ?? "Rainbow", 128)
    lutTable.setMin(vmin)
    lutTable.setMax(vmax)
    //}

    const dColor = new Color(defaultColor)
    const isoValues = isoList

    const algo = new MarchingTriangles()
    algo.setup(mesh.getIndices() as Uint32BufferAttribute, [vmin, vmax])

    const vertices = mesh.getPositions() as Float32BufferAttribute
    const positions: number[] = []
    const colors: number[] = []

    const normalizeAttr = (v: number) => (v - vmin) / (vmax - vmin)

    for (let i = 0; i < isoValues.length; ++i) {
        let result = algo.isolines(attribute, isoValues[i])

        const c = fromValueToColor(normalizeAttr(isoValues[i]), {
            min: vmin,
            max: vmax,
            defaultColor: dColor,
            lutTable
        })
        colors.push(...c)

        for (let k = 0; k < result[0].length; ++k) {
            for (let l = 0; l < result[0][k].length - 2; l += 2) {
                let i1 = result[0][k][l]
                let i2 = result[0][k][l + 1]
                let c = result[1][k][l / 2]

                const v1 = vertices.get(i1)
                const v2 = vertices.get(i2)
                let v1x = v1[0]
                let v1y = v1[1]
                let v1z = v1[2]
                let v2x = v2[0]
                let v2y = v2[1]
                let v2z = v2[2]
                positions.push(v1x + c * (v2x - v1x), v1y + c * (v2y - v1y), v1z + c * (v2z - v1z))
            }
        }
    }

    return {
        positions: positions,
        color: colors
    }
}