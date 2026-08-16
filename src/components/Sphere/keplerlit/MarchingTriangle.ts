import { Uint32BufferAttribute } from './attributes'
import { minMax } from './utils'

export class MarchingTriangles {
    topo_: any[] = [];
    lock_ = false;
    maxVertexIndex_ = -1;
    _bounds: Array<number> = []

    // topo of type BufferAttribute (with item count corresponding to 1 id)
    public setup(topo: Uint32BufferAttribute, bounds: Array<number>) {
        this.lock_ = false
        this.maxVertexIndex_ = -1
        this._bounds = bounds
        this.topo_ = []

        for (let l = 0; l < topo.array.length; l += 3) {
            let i = topo.array[l]
            let j = topo.array[l + 1]
            let k = topo.array[l + 2]
            this.topo_.push({ i, j, k })
            if (i === j || i === k || j === k) {
                throw new Error(`Error in topology while setting up iso-contouring in 'MarchingTriangles.' At index ${l}, got 3 indices (${i}, ${j}, ${k})`)
            }
            this.maxVertexIndex_ = Math.max(this.maxVertexIndex_, i, j, k)
        }
        // topo.forEach((value: number[], index: number) => {
        //     let i = value[0]
        //     let j = value[1]
        //     let k = value[2]
        //     this.topo_.push({ i, j, k })
        //     if (i === j || i === k || j === k) {
        //         throw new Error(`Error in topology while setting up iso-contouring in 'MarchingTriangles.' At index ${index}, got 3 indices (${i}, ${j}, ${k})`)
        //     }
        //     this.maxVertexIndex_ = Math.max(this.maxVertexIndex_, i, j, k)
        // })

        this.lock_ = true
        return true
    }

    /**
     * Return array of size 2:
     *
     * 1) result[0] represents the connected isoline edges
     *
     * 2) result[1] represents the connected isoline values
     */
    public isolines(prop: number[], isovalue: number) {
        let result: any = [[]]

        if (this.lock_ === false) {
            return result
        }
        if (prop.length < 0) {
            return result
        }

        if (this._bounds === undefined) {
            this._bounds = minMax(prop)
        }

        // Store the triangles cross by the iso-surface and for
        // each triangle i stored its value [1,6]
        const tri2code = new Map()
        const cut_edges: number[] = []
        const triangle = [0, 0, 0]
        const connectiviy = new Map(new Map())

        for (let i = 0; i < this.topo_.length; ++i) {
            triangle[0] = this.topo_[i].i
            triangle[1] = this.topo_[i].j
            triangle[2] = this.topo_[i].k

            let t1, t2, t3;
            const p0 = prop[triangle[0]]
            const p1 = prop[triangle[1]]
            const p2 = prop[triangle[2]]

            if (ok(p0, p1, p2, this._bounds[0], this._bounds[1]) === false) {
                continue
            }

            if ((p0 >= isovalue)) { t1 = 1; } else { t1 = 0; }
            if ((p1 >= isovalue)) { t2 = 1; } else { t2 = 0; }
            if ((p2 >= isovalue)) { t3 = 1; } else { t3 = 0; }

            const tri_code = lookupTable1[t1][t2][t3]

            // means that this triangle is cut by the isoline
            if (tri_code > 0 && tri_code < 7) {
                tri2code.set(i, tri_code);
                cut_edges[0] = lookupTable0[tri_code][0];
                cut_edges[1] = lookupTable0[tri_code][1];
                for (let e = 0; e < 2; ++e) {
                    let v0 = cut_edges[e];
                    let v1 = (v0 + 1) % 3
                    v0 = triangle[v0]
                    v1 = triangle[v1]
                    let vmin = Math.min(v0, v1)
                    let vmax = Math.max(v0, v1)
                    if (!(vmin in connectiviy)) {
                        let vmax_2_triangles = new Map()

                        vmax_2_triangles.set(vmax, [i])
                        connectiviy.set(vmin, vmax_2_triangles)
                    } else {
                        connectiviy.get(vmin).get(vmax).push(i)
                    }
                }
            }
        }

        // Extraction...
        do {
            if (tri2code.size <= 0) break

            let isoline: number[] = []
            let values: number[] = []
            const start = tri2code.keys()
            const first_tri = start.next().value
            let code = tri2code.get(first_tri)
            tri2code.delete(tri2code.keys().next().value)

            if (code < 1 || code > 6) {
                continue
            }

            triangle[0] = this.topo_[first_tri].i
            triangle[1] = this.topo_[first_tri].j
            triangle[2] = this.topo_[first_tri].k
            cut_edges[0] = lookupTable0[code][0]
            cut_edges[1] = lookupTable0[code][1]
            const first_edge: number[] = []
            const next_edge: number[] = []

            for (let e = 0; e < 2; ++e) {
                let v0 = cut_edges[e]
                let v1 = (v0 + 1) % 3
                v0 = triangle[v0]
                v1 = triangle[v1]
                isoline.push(v0)
                isoline.push(v1)
                values.push((isovalue - prop[v0]) / (prop[v1] - prop[v0]))
                let vmin = Math.min(v0, v1)
                let vmax = Math.max(v0, v1)

                if (e === 0) {
                    first_edge[0] = vmin
                    first_edge[1] = vmax
                } else {
                    next_edge[0] = vmin
                    next_edge[1] = vmax
                }
            }
            let first_e = 0
            let nb_loop = 0

            do {
                let current_tri = first_tri
                do {
                    let adj_trgls = [connectiviy.get(next_edge[0]).get(next_edge[1])]
                    if (adj_trgls.length === 1) {
                        break; // border
                    }
                    current_tri = adj_trgls[0] + adj_trgls[1] - current_tri
                    let iter = tri2code.get(current_tri)

                    if (!(iter in tri2code)) {
                        break
                    }
                    code = iter.second
                    tri2code.delete(iter)

                    // let f = this.topo_[current_tri] ;
                    triangle[0] = this.topo_[current_tri].i
                    triangle[1] = this.topo_[current_tri].j
                    triangle[2] = this.topo_[current_tri].k

                    cut_edges[0] = lookupTable0[code][0]
                    cut_edges[1] = lookupTable0[code][1]

                    for (let e = 0; e < 2; ++e) {
                        let v0 = cut_edges[e]
                        let v1 = (v0 + 1) % 3
                        v0 = triangle[v0]
                        v1 = triangle[v1]
                        let vmin = Math.min(v0, v1)
                        let vmax = Math.max(v0, v1)
                        if (vmin !== next_edge[0] || vmax !== next_edge[1]) {
                            isoline.push(v0)
                            isoline.push(v1)
                            values.push((isovalue - prop[v0]) / (prop[v1] - prop[v0]))
                            next_edge[0] = vmin
                            next_edge[1] = vmax
                            break
                        }
                    }
                } while (true)

                if (next_edge[0] === first_edge[0] && next_edge[1] === first_edge[1]) {
                    // Closed line
                    isoline.push(isoline[0])
                    isoline.push(isoline[1])
                    values.push(values[0])
                    first_e = values.length
                    break
                } else if (nb_loop === 0) {
                    next_edge[0] = first_edge[0]
                    next_edge[1] = first_edge[1]
                    first_e = values.length
                }
                ++nb_loop
            } while (nb_loop < 2)

            if (first_e === values.length) {
                result[0].push(isoline)
                if (result[1] === undefined) {
                    result[1] = [values]
                } else {
                    result[1].push(values)
                }
            } else {
                let connected_isoline_edges: number[] = []
                let connected_isoline_values: number[] = []
                for (let j = isoline.length - 1; j >= 2 * first_e; --j) {
                    connected_isoline_edges.push(isoline[j])
                }
                for (let j = values.length - 1; j >= first_e; --j) {
                    connected_isoline_values.push(1.0 - values[j])
                }
                for (let j = 0; j < 2 * first_e; ++j) {
                    connected_isoline_edges.push(isoline[j])
                }
                for (let j = 0; j < first_e; ++j) {
                    connected_isoline_values.push(values[j])
                }
                result[0].push(connected_isoline_edges)
                result[1].push(connected_isoline_values)
            }
        } while (true)

        return result
    }
}

function ok(p0: number, p1: number, p2: number, min: number, max: number) {
    function _in(p: number, min: number, max: number) {
        return p >= min && p <= max
    }
    return _in(p0, min, max) && _in(p1, min, max) && _in(p2, min, max)
}

const lookupTable0 = [[-1, -1], [1, 2], [0, 1], [2, 0], [2, 0], [0, 1], [1, 2], [-1, -1]];
const lookupTable1 = [[[0, 1], [2, 3]], [[4, 5], [6, 7]]];