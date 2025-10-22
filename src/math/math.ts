// import { eigen as EIGEN } from "@youwol/math"
// import { assertNormalizedVector } from "../debug"
// import { assertNormalizedVector } from "@alfredo-taboada/stress/src/lib/debug"
import { SphericalCoords } from "./SphericalCoords"
// import { EIGEN } from "./eigen"

export const Sqrt2 = Math.sqrt(2)
export const Sqrt2Over2 = Sqrt2/2
export const Sqrt2Over4 = Sqrt2/4
export const OneOverSqrt3 = 1/Math.sqrt(3)
export const Sqrt3Over2 = Math.sqrt(3)/2
export const Sqrt6Over4 = Math.sqrt(6)/4

export const Pi = Math.PI
export const TwoPi = Math.PI * 2
export const HalfPi = Math.PI / 2
export const PiOver3 = Math.PI / 3
export const PiOver4 = Math.PI / 4

// ------------------------------------------------
export const isInProductionMode = false
// ------------------------------------------------

export function assertNormalizedVector(v: Vector3, eps = 1e-5): void {
    if (isInProductionMode === false) {
        const c = norm2(v)
        if (Math.abs(1 - c) > eps) {
            throw `vector ${v} is not normalized with eps=${eps}`
        }
    }
}

export function rand(start = 0, end = 1) {
    return start + Math.random() * (end - start)
}

/**
 * @category Math
 */
export type Point2D = [number, number]

/**
 * @category Math
 */
export type Point3D = [number, number, number]

/**
 * @category Math
 */
export type Vector3 = [number, number, number]

/**
 * @category Math
 */
export type Matrix3x3 = [[number, number, number], [number, number, number], [number, number, number]]


export function displayMatrix3x3(msg: string, m: Matrix3x3) {
    console.log(msg, ":")
    console.log(m[0][0], m[0][1], m[0][2])
    console.log(m[1][0], m[1][1], m[1][2])
    console.log(m[2][0], m[2][1], m[2][2])
}
/**
 * @category Math
 */
export function newPoint3D() {
    return [0, 0, 0] as Point3D
}

/**
 * @category Math
 */
export function newVector3D() {
    return [0, 0, 0] as Vector3
}

/**
 * @category Math
 */
export function newMatrix3x3(): Matrix3x3 {
    return [[0, 0, 0], [0, 0, 0], [0, 0, 0]] as Matrix3x3
}

/**
 * @category Math
 */
export function cloneMatrix3x3(m: Matrix3x3): Matrix3x3 {
    return [[...m[0]], [...m[1]], [...m[2]]]
}

/**
 * @category Math
 */
export function newMatrix3x3Identity(): Matrix3x3 {
    return [[1, 0, 0], [0, 1, 0], [0, 0, 1]] as Matrix3x3
}

/**
 * @category Math
 */
export function deg2rad(a: number): number {
    return a * Math.PI / 180
}

/**
 * @category Math
 */
export const rad2deg = (a: number): number => a / Math.PI * 180

/**
 * @category Math
 */
export function vectorMagnitude(vector: Vector3): number {
    // Calculate the magnitude of the vector
    return Math.sqrt(vector[0] ** 2 + vector[1] ** 2 + vector[2] ** 2)
}

export function norm(v: Vector3) {
    return vectorMagnitude(v)
}

export function norm2(vector: Vector3): number {
    // Calculate the magnitude of the vector
    return vector[0] ** 2 + vector[1] ** 2 + vector[2] ** 2
}

/**
 * If norm is provided, then the vector is divided by the norm
 * @category Math
 */
export function normalizeVector(vector: Vector3, norm?: number): Vector3 {
    if (norm !== undefined) {
        if (norm === 0) {
            throw new Error(`norm is zero`)
        }
        return [vector[0] / norm, vector[1] / norm, vector[2] / norm]
    }

    // Calculate the magnitude of the vector
    let magVector = vectorMagnitude(vector)
    if (magVector === 0) {
        throw new Error(`vector is null and cannot be normalized`)
    }
    return [vector[0] / magVector, vector[1] / magVector, vector[2] / magVector]
}

/**
 * @category Math
 */
export function stressTensorPrincipalAxes(sigma: [number, number, number]): Matrix3x3 {
    // Calculate the stress tensor STP in the principal stress frame 
    const STP: Matrix3x3 = newMatrix3x3()
    // Stress tensor in the principal stress axis is diagonal
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (i === j) {
                STP[i][j] = sigma[i]
            } else {
                STP[i][j] = 0
            }
        }
    }
    return STP
}

/**
 * @category Math
 */
export function tensor_x_Vector(
    { T, V }:
        { T: Matrix3x3, V: Vector3 }): Vector3 {
    // Pre-multply tensor T by vector V
    const TV = newVector3D() as Vector3
    TV[0] = T[0][0] * V[0] + T[0][1] * V[1] + T[0][2] * V[2]
    TV[1] = T[1][0] * V[0] + T[1][1] * V[1] + T[1][2] * V[2]
    TV[2] = T[2][0] * V[0] + T[2][1] * V[1] + T[2][2] * V[2]

    return TV
}

/**
 * @category Math
 */
export function constant_x_Vector(
    { k, V }:
        { k: number, V: Vector3 }): Vector3 {
    // multiply vector V by constant k
    const TV = newVector3D() as Vector3
    TV[0] = k * V[0]
    TV[1] = k * V[1]
    TV[2] = k * V[2]

    return TV
}

/**
 * @category Math
 */
export function add_Vectors(
    { U, V }:
        { U: Vector3, V: Vector3 }): Vector3 {
    // multiply vector V by constant k
    const TV = newVector3D() as Vector3
    TV[0] = U[0] + V[0]
    TV[1] = U[1] + V[1]
    TV[2] = U[2] + V[2]

    return TV
}

/**
 * @category Math
 */
export function scalarProduct({ U, V }:{ U: Vector3, V: Vector3 }): number {
    return U[0] * V[0] + U[1] * V[1] + U[2] * V[2]
}

/**
 * @category Math
 */
export function scalarProductUnitVectors({ U, V }: { U: Vector3, V: Vector3 }): number {
    assertNormalizedVector(U)
    assertNormalizedVector(V)

    let UdotV = U[0] * V[0] + U[1] * V[1] + U[2] * V[2]

    // The scalar product of unit vectors: -1 <= UdotV <= 1
    UdotV = setValueInUnitInterval(UdotV)

    return UdotV
}

/**
 * @category Math
 * Scalar value is constrained to interval [-1,1]
 */
export function setValueInUnitInterval(U: number): number {
    let V = U
    if (U > 1) {
        V = 1
    }
    if (U < -1) {
        V = -1
    }
    return V
}

/**
 * @brief Calculate the cross product of 2 vectors U and V: U x V
 * @param {U: Vector3, V: Vector3}
 * @example
 * ```ts
 * const Ua: Vector3 = ...
 * const Va: Vector3 = ...
 * const return = crossProduct({U: Ua, V: Va})
 * ```
 * @category Math
 */
export function crossProduct(
    { U, V }:
        { U: Vector3, V: Vector3 }): Vector3 {
    return [U[1] * V[2] - U[2] * V[1],
    U[2] * V[0] - U[0] * V[2],
    U[0] * V[1] - U[1] * V[0]]
}

/**
 * @brief Calculate the cross product of 2 vectors U and V: U x V
 * @param {U: Vector3, V: Vector3}
 * @example
 * ```ts
 * const Ua: Vector3 = ...
 * const Va: Vector3 = ...
 * const return = crossProduct({U: Ua, V: Va})
 * ```
 * @category Math
 */
export function normalizedCrossProduct({ U, V }: { U: Vector3, V: Vector3 }): Vector3 {
    let W: Vector3
    W = crossProduct({ U, V })
    return normalizeVector(W)
}

/**
 * @brief Calculate the multiplication of 2 tensors A and B: Cik = Aij Bjk
 * @param {A: Matrix3x3, B: Matrix3x3}
 * @example
 * ```ts
 * const Ma: Matrix3x3 = ...
 * const Mb: Matrix3x3 = ...
 * const C = multiplyTensors({A: Ma, B: Mb})
 * ```
 * @category Math
 */
export function multiplyTensors({ A, B }: { A: Matrix3x3, B: Matrix3x3 }): Matrix3x3 {
    const C: Matrix3x3 = newMatrix3x3()

    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            C[i][j] = 0
            for (let k = 0; k < 3; k++) {
                C[i][j] += A[i][k] * B[k][j]
            }
        }
    }
    return C
}

/**
 * @category Math
 */
export function transposeTensor(A: Matrix3x3): Matrix3x3 {
    // Calculate the multiplication of 2 tensors: Cik = Aij Bjk
    const B: Matrix3x3 = newMatrix3x3()

    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            B[j][i] = A[i][j]
        }
    }
    return B
}

/**
 * @category Math
 */
export function rotationParamsFromRotTensor(rotTensor: Matrix3x3): { rotAxis: Vector3, rotMag: number } {
    // The cartesian and spherical coords of a unit vector corresponding to the rotation axis are determined 
    // from the components of the tensor definning a proper rotation

    let rotVector = [0, 0, 0] as Vector3

    // The axis of rotation is determined from the components of the matrix of a proper rotation
    rotVector[0] = rotTensor[2][1] - rotTensor[1][2]
    rotVector[1] = rotTensor[0][2] - rotTensor[2][0]
    rotVector[2] = rotTensor[1][0] - rotTensor[0][1]
    let rotVectorMag = vectorMagnitude(rotVector)

    // The magnitude of rotVector computed this way is ||rotVector|| = 2 sin θ, where θ is the angle of rotation.
    let rotMag = Math.asin(rotVectorMag / 2)
    let rotAxis = [1, 0, 0] as Vector3
    if (rotMag > 0) {
        rotAxis = normalizeVector(rotVector, rotMag)
    }

    return {
        rotAxis,
        rotMag
    }
}
// /**
//  * @category Math
//  */
// export function normalVector(
//     { phi, theta }:
//         { phi: number, theta: number }): Vector3 {
//     /** 
//      * Define unit vector normal to the fault plane in the upper hemisphere (pointing upward) from angles in spherical coordinates.
//      * The normal vector is constant for each fault plane and is defined in the geographic reference system: S = (X,Y,Z)
//     */
//     let normal = newVector3D() // ***

//     normal[0] = Math.sin(phi) * Math.cos(theta)
//     normal[1] = Math.sin(phi) * Math.sin(theta)
//     normal[2] = Math.cos(phi)

//     return normal
// }

/**
 * @category Math
 */
export function spherical2unitVectorCartesian(spheriCoords: SphericalCoords): Vector3 {
    // The principal stress axes and microfault data such as stylolites can be represented by lines.
    // A line is defined by its trend and plunge angles in the geographic reference system:
    // trend = azimuth of the line in interval [0, 360), measured clockwise from the North direction
    // plunge =  vertical angle between the horizontal plane and the sigma 1 axis (positive downward), in interval [0,90]

    // (phi,theta) : spherical coordinate angles defining the unit vector in the geographic reference system: S = (X,Y,Z) = (E,N,Up)

    // phi : azimuthal angle in interval [0, 2 PI), measured anticlockwise from the X axis (East direction) in reference system S
    // theta: colatitude or polar angle in interval [0, PI/2], measured downward from the zenith (upward direction)

    let V = newVector3D() as Vector3

    V[0] = Math.sin(spheriCoords.theta) * Math.cos(spheriCoords.phi)
    V[1] = Math.sin(spheriCoords.theta) * Math.sin(spheriCoords.phi)
    V[2] = Math.cos(spheriCoords.theta)

    return V
}

/**
 * @category Math
 */
export function unitVectorCartesian2Spherical(V: Vector3, EPS = 1e-7): SphericalCoords {
    // This routine inverts the following equations in spherical coordinates:
    // V[0] = Math.sin(spheriCoords.theta) * Math.cos(spheriCoords.phi)
    // V[1] = Math.sin(spheriCoords.theta) * Math.sin(spheriCoords.phi)
    // V[2] = Math.cos(spheriCoords.theta)

    // (phi,theta) : spherical coordinate angles defining the unit vector in the geographic reference system: S = (X,Y,Z) = (E,N,Up)

    // phi : azimuthal angle in interval [0, 2 PI), measured anticlockwise from the X axis (East direction) in reference system S
    // theta: colatitude or polar angle in interval [0, PI/2], measured downward from the zenith (upward direction)

    let spheriCoords: SphericalCoords = new SphericalCoords()

    // Unit vector component V[0] is constrained to interval [-1,1]
    V[2] = setValueInUnitInterval(V[2])

    // theta = polar angle in interval [0,PI]
    spheriCoords.theta = Math.acos(V[2])
    let stheta = Math.sin(spheriCoords.theta)

    if (Math.abs(stheta) > EPS) {       // In principle, stheta >=0
        // cphi = cos(phi)
        let cphi = V[0] / stheta
        // cphi is constrained to interval [-1,1]
        cphi = setValueInUnitInterval(cphi)
        // phi is in interval [0,PI]
        spheriCoords.phi = Math.acos(cphi)
        if (V[1] < 0) {
            // phi is in interval (PI,2PI). The angle is obtained by reflexion on the x axis:
            spheriCoords.phi = 2 * Math.PI - spheriCoords.phi
        }
    } else {
        // theta is close to 0 or PI, thus the unit vector is close to the vertical axis
        // phi can take any value
        spheriCoords.phi = 0
    }
    return spheriCoords
}

/**
 * @category Math
 */
export function properRotationTensor({ nRot, angle }:
    { nRot: Vector3, angle: number }): Matrix3x3 {
    // Calculate the proper rotation tensor psi corresponding to an anticlockwise rotation angle around a unit axis nRot
    // Psi allows to calculate the new coords of a vector undergoing a given rotation

    const PsiRot: Matrix3x3 = newMatrix3x3()

    let cosa = Math.cos(angle)
    let sina = Math.sin(angle)

    PsiRot[0][0] = cosa + nRot[0] ** 2 * (1 - cosa)
    PsiRot[0][1] = nRot[0] * nRot[1] * (1 - cosa) - nRot[2] * sina
    PsiRot[0][2] = nRot[0] * nRot[2] * (1 - cosa) + nRot[1] * sina
    PsiRot[1][0] = nRot[1] * nRot[0] * (1 - cosa) + nRot[2] * sina
    PsiRot[1][1] = cosa + nRot[1] ** 2 * (1 - cosa)
    PsiRot[1][2] = nRot[1] * nRot[2] * (1 - cosa) - nRot[0] * sina
    PsiRot[2][0] = nRot[2] * nRot[0] * (1 - cosa) - nRot[1] * sina
    PsiRot[2][1] = nRot[2] * nRot[1] * (1 - cosa) + nRot[0] * sina
    PsiRot[2][2] = cosa + nRot[2] ** 2 * (1 - cosa)

    return PsiRot
}

/**
 * @category Math
 */
export function minRotAngleRotationTensor(rotTensor: Matrix3x3, EPS = 1e-7): number {
    // let rotTensor be the rotation tensor between two right-handed references systems Sa = (Xa, Ya, Za) and Sb = (Xb, Yb, Zb) such that:
    //      Vb = rotTensor Va
    // where Va and Vb are corresponding vectors defined in reference systems Sa and Sb, respectively
    // Sa may correspond to the reference system of the principal directions of a stress tensor defined by microstructure kinematics:
    //      a pair of conjugate faults or a neoformed striated plane.
    // Sb may be the reference system of the principal directions of a hypothetical stress tensor defined by the interactive search
    //      or an inverse method. 
    // Recall that the principal stress direction (Sigma 1, Sigma 3, Sigma 2) are parallel to (X, Y, Z), respectively

    // This function calculates the minimum rotation angle between Sa and Sb, by considering the four possible right-handed reference systems
    // that are consistent with principal stress directions in system Sb. 

    // The angle of rotation associated to rotTensor is defined by the trace tr(rotTensor), according to the relation:
    //      tr(rotTensor) = 1 + 2 cos(rotAngle)
    // where rotAngle is in interval [0,PI]

    // Note that the inverse rotation tensor defined by the transposed matrix has the same trace. 
    // Thus the rotation angle is the same for tensors rotTensor and rotTensorT (i.e., transposed)

    let traceRotTensor: number[] = new Array(4)
    // The trace of the first rotation tensor such that reference system Sb0 = (Xb, Yb, Zb)
    traceRotTensor[0] = rotTensor[0][0] + rotTensor[1][1] + rotTensor[2][2]
    // The trace of the second rotation tensor such that reference system Sb1 = (Xb, -Yb, -Zb)
    // System Sb1 is obtained by rotating Sb0 at an angle of PI around Xb
    // Note that Sb1 is right-handed and its principal axes are parallel to (Sigma 1, Sigma 3, Sigma 2)
    traceRotTensor[1] = rotTensor[0][0] - rotTensor[1][1] - rotTensor[2][2]
    // The trace of the second rotation tensor such that reference system Sb2 = (-Xb, Yb, -Zb)
    // System Sb2 is obtained by rotating Sb0 at an angle of PI around Yb
    // Note that Sb2 is right-handed and its principal axes are parallel to (Sigma 1, Sigma 3, Sigma 2)
    traceRotTensor[2] = - rotTensor[0][0] + rotTensor[1][1] - rotTensor[2][2]
    // The trace of the second rotation tensor such that reference system Sb3 = (Xb, -Yb, -Zb)
    // System Sb3 is obtained by rotating Sb0 at an angle of PI around Zb
    // Note that Sb3 is right-handed and its principal axes are parallel to (Sigma 1, Sigma 3, Sigma 2)
    traceRotTensor[3] = - rotTensor[0][0] - rotTensor[1][1] + rotTensor[2][2]

    const max = traceRotTensor.reduce((cur, v) => Math.max(cur, v), Number.NEGATIVE_INFINITY)
    let cosMinRotAngle = (max - 1) / 2

    if (Math.abs(cosMinRotAngle) > 1) {
        if (Math.abs(cosMinRotAngle) > 1 + EPS) {
            throw new Error(`The cosine of the minimum rotation angle of the rotation tensor is not in the unit interval`)
        }
        cosMinRotAngle = setValueInUnitInterval(cosMinRotAngle)
    }

    return Math.acos(cosMinRotAngle)
}

/**
 * @category Math
 */
export function rotationTensor_Sa_Sb({ Xb, Yb, Zb }: { Xb: Vector3, Yb: Vector3, Zb: Vector3 }): Matrix3x3 {
    // Calculate the rotation tensor rotTensor between two reference systems Sa and Sb, such that:
    //  Vb = rotTensor  Va
    //  Va = rotTensorT Vb        (rotTensorT is tensor rotTensor transposed)
    //  Sa = (Xa,Ya,Za) is a right-handed reference system defined by 3 unit vectors (Xa,Ya,Za)
    //  Sb = (Xb,Yb,Zb) is a right-handed reference system defined by 3 unit vectors (Xb,Yb,Zb)
    //  We supposse that the coordinates of unit vectors (Xb,Yb,Zb) are defined in reference system Sa    
    //  Under this hypothesis, the lines of rotTensor are given by the unit vectors (Xb,Yb,Zb)
    //  In other words the coordinates of Vb are obtained from the scalar product of unit vectors (Xb,Yb,Zb) . Va

    let rotTensor: Matrix3x3 = newMatrix3x3()

    // First line is defined by unit vector Xb
    // Note that the scalar product Xb . Va = Vb(X) i.e., The coordinate of vector Vb in Xb direction 
    rotTensor[0][0] = Xb[0]
    rotTensor[0][1] = Xb[1]
    rotTensor[0][2] = Xb[2]

    // Second line is defined by unit vector Yb
    // Note that the scalar product Yb . Va = Vb(Y) i.e., The coordinate of vector Vb in Yb direction 
    rotTensor[1][0] = Yb[0]
    rotTensor[1][1] = Yb[1]
    rotTensor[1][2] = Yb[2]

    // Third line is defined by unit vector Zb
    // Note that the scalar product Zb . Va = Vb(Z) i.e., The coordinate of vector Vb in Zb direction 
    rotTensor[2][0] = Zb[0]
    rotTensor[2][1] = Zb[1]
    rotTensor[2][2] = Zb[2]

    return rotTensor
}

export function trendPlunge2unitAxis({ trend, plunge }: { trend: number, plunge: number }): Vector3 {
    // (phi,theta) : spherical coordinate angles defining the unit vector parallel to a micro/meso structure (e.g., Crystal Fibers in Vein or styloilte teeth).
    //               in the geographic reference system: S = (X,Y,Z) = (E,N,Up)

    // phi : azimuthal angle in interval [0, 2 PI), measured anticlockwise from the X axis (East direction) in reference system S
    // theta: colatitude or polar angle in interval [0, PI], measured downward from the zenith (upward direction)
    //        theta points downward for positive plunges, and upward for negative plunges.

    const coordinates: SphericalCoords = new SphericalCoords()
    const unitAxis = newVector3D() as Vector3

    // The polar angle (or colatitude) theta is calculated in radians from the plunge of the Crystal Fibers :
    coordinates.theta = deg2rad(plunge) + Math.PI / 2

    // The azimuthal angle is calculated in radians from the trend of the Crystal Fibers :
    //      trend + phi = PI / 2 
    coordinates.phi = deg2rad(90 - trend)

    // if (this.crystal_fibers_trend > 90) {
    //     // phi < 0
    //     coordinates.phi = coordinates.phi + 2 * Math.PI
    // }
    
    // The unit vector parallel to the Crystal Fibers is defined by angles (phi, theta) in spherical coordinates.
    // normal: unit vector parallel to the Crystal Fibers in Vein defined in the geographic reference system: S = (X,Y,Z)
    return spherical2unitVectorCartesian(coordinates)
}


/**
 * ============================================================================
 * PLANE GEOMETRY FUNCTIONS
 * Functions for calculating plane orientation vectors from normal vector
 * ============================================================================
 */

/**
 * Tolerance for numerical comparisons
 */
const TOLERANCE = 1e-7;

/**
 * Calculate the strike vector from the plane's upward normal vector
 * The strike vector is horizontal and perpendicular to the normal vector
 * 
 * @param n_plane - Upward unit normal vector to the plane {x, y, z}
 * @returns n_strike - Unit vector parallel to strike direction {x, y, z}
 */
export function calculateStrikeVector(n_plane: number[]): number[] {
    let n_strike_x: number;
    let n_strike_y: number;
    let n_strike_z: number;

    // Check if plane is vertical (n_plane[2] ≈ 1)
    if (1 - Math.abs(n_plane[2]) < TOLERANCE) {
        // Plane is vertical
        // Strike vector points North (0, 1, 0)
        n_strike_x = 0;
        n_strike_y = 1;
        n_strike_z = 0;
    } else {
        // Plane is not vertical
        // Calculate horizontal component magnitude
        const n_plane_xy = Math.sqrt(n_plane[0] * n_plane[0] + n_plane[1] * n_plane[1]);
        
        // Strike vector is perpendicular to projection of normal in XY plane
        n_strike_x = -n_plane[1] / n_plane_xy;
        n_strike_y = n_plane[0] / n_plane_xy;
        n_strike_z = 0;
    }

    return [n_strike_x, n_strike_y, n_strike_z];
}

/**
 * Calculate the dip vector from the plane's normal and strike vectors
 * The dip vector points in the direction of maximum slope (downward)
 * (n_dip, n_strike, n_plane) forms a left-handed orthonormal system
 * 
 * @param n_plane - Upward unit normal vector to the plane {x, y, z}
 * @param n_strike - Unit vector parallel to strike direction {x, y, z}
 * @returns n_dip - Unit vector parallel to dip direction {x, y, z}
 */
export function calculateDipVector(
    n_plane: number[],
    n_strike: number[]
): number[] {
    // n_dip = n_strike × n_plane (cross product)
    const n_dip_x = n_strike[1] * n_plane[2] - n_strike[2] * n_plane[1];
    const n_dip_y = n_strike[2] * n_plane[0] - n_strike[0] * n_plane[2];
    const n_dip_z = n_strike[0] * n_plane[1] - n_strike[1] * n_plane[0];

    return [n_dip_x, n_dip_y, n_dip_z];
}

/**
 * Generate points along a great circle (plane trace) on the lower hemisphere
 * The great circle passes through the strike and dip vectors
 * 
 * @param n_strike - Unit vector parallel to strike direction {x, y, z}
 * @param n_dip - Unit vector parallel to dip direction {x, y, z}
 * @param numPoints - Number of points to generate along the half-circle (default: 100)
 * @returns Array of points {x, y, z} along the great circle in the lower hemisphere
 */
export function generateGreatCirclePoints(
    n_strike: number[],     // ← ARRAY [x, y, z]
    n_dip: number[],        // ← ARRAY [x, y, z]
    numPoints: number = 100
): Array<{ x: number; y: number; z: number }> {
    const points: Array<{ x: number; y: number; z: number }> = [];

    for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * Math.PI;
        
        // Point = cos(angle)*n_strike + sin(angle)*n_dip
        const x = Math.cos(angle) * n_strike[0] + Math.sin(angle) * n_dip[0];
        const y = Math.cos(angle) * n_strike[1] + Math.sin(angle) * n_dip[1];
        const z = Math.cos(angle) * n_strike[2] + Math.sin(angle) * n_dip[2];
        
        points.push({ x, y, z });
    }

    return points;
}

/**
 * Complete function: Calculate strike and dip vectors from plane normal
 * Convenience function that calls both calculateStrikeVector and calculateDipVector
 * 
 * @param n_plane - Upward unit normal vector to the plane {x, y, z}
 * @returns Object containing both n_strike and n_dip vectors
 */
export function calculatePlaneVectors(n_plane: number[]): {
    n_strike: number[];
    n_dip: number[];
} {
    const n_strike = calculateStrikeVector(n_plane);
    const n_dip = calculateDipVector(n_plane, n_strike);

    return {
        n_strike,
        n_dip
    };
}

/**
 * Modified eigen from @youwol/math (same name)
 */

/*
export function eigen(s: Matrix3x3) {
    const { values, vectors } = EIGEN([s[0][0], s[0][1], s[0][2], s[1][1], s[1][2], s[2][2]])

    // eigen calculates the 3 eigenvectors and eigenvalues in the following order: Sigma_3, Sigma_2, Sigma_1
    // The eigen vectors are UNIT vectors, which are NOT necessarily defined in a right-handed reference system
  
    // Generate a Right-Handed reference system for reference system Sh = (Xh, Yh, Zh) = (Sigma_1, Sigma_3, Sigma_2) from the unitary eigenvectors 
    const S1 : Vector3 = [vectors[6], vectors[7], vectors[8]]
    const S3 : Vector3 = [vectors[0], vectors[1], vectors[2]]
    const S2 : Vector3 = crossProduct({ U: S1, V: S3 }) //----------- compare this vector with corresponding eigenvector, i.e., it may be inverted

    const s1 = values[2]
    const s3 = values[0]
    const s2 = values[1]

    return {
        S1,
        S2,
        S3,
        s1,
        s2,
        s3
    }
} 
*/

