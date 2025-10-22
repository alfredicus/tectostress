import { HypotheticalSolutionTensorParameters } from "../../geomeca"
import { Matrix3x3, Vector3, add_Vectors, constant_x_Vector, crossProduct, deg2rad, minRotAngleRotationTensor, multiplyTensors, newMatrix3x3, normalizeVector, normalizedCrossProduct, properRotationTensor, rotationTensor_Sa_Sb, scalarProduct, tensor_x_Vector, transposeTensor, vectorMagnitude } from "../../types"

import { DataStatus } from "../DataDescription"
import { StrengthAngleType, StriatedPlaneProblemType } from "./types"
import { StriatedPlaneKin } from "./StriatedPlane_Kin"

export class NeoformedStriatedPlane extends StriatedPlaneKin {
    protected angleMean_nSigma1_Sm_nPlane: number
    protected deltaTheta1_Sm = 0

    protected angleType = StrengthAngleType.Undefined

    protected angleS1MinIsDefined = false
    protected angleS1Min = 0                // formerly named angleS1Min
    protected angleS1Max = Math.PI / 4        // formerly named angleS1Max

    protected angleFrictionIsDefined = false
    protected angleFrictionMin = 0          // formerly named frictionAngleMin
    protected angleFrictionMax = Math.PI / 2  // formerly named frictionAngleMax

    protected nSigma1_Sm_Mean: Vector3
    protected nSigma1_Sm: Vector3
    protected nSigma2_Sm: Vector3
    protected nSigma3_Sm: Vector3

    protected Mrot = [newMatrix3x3(), newMatrix3x3(), newMatrix3x3()]

    initialize(jsonObject: any): DataStatus {
        const result = super.initialize(jsonObject)

        // Either 'friction', 'angleS1' or 'undefined' or not defined
        if (jsonObject['angleType']) {
            if (jsonObject['angleType'] === 'friction') {
                this.angleType = StrengthAngleType.Friction
            }
            else if (jsonObject['angleType'] === 'S1') {
                this.angleType = StrengthAngleType.Sigma1
            }
            else {
                this.angleType = StrengthAngleType.Undefined
            }
        }
        else {
            this.angleType = StrengthAngleType.Undefined
        }

        // -------------------------------------

        // TODO
        // 1. check that the angles are in [0, pi/2]
        // 2. check that min < max

        if (jsonObject['minAngle']) {
            if (this.angleType === StrengthAngleType.Friction) {
                this.angleFrictionMin = deg2rad(jsonObject['minAngle'])
                this.angleFrictionIsDefined = true
            }
            else if (this.angleType === StrengthAngleType.Sigma1) {
                // The user defines the minimum angle between the neoformed striated plane and the compressional stress axis Sigma_1
                // This angle can be estimated from fault mechanics.
                // angleS1Max = complementary angle, defined as the angle between the normal to the plane and Sigma_1 <S1, n-plane>                
                this.angleS1Min = Math.PI / 2 - deg2rad(jsonObject['minAngle'])
                this.angleS1MinIsDefined = true
            }
            else {
                result.warnings.push(`For data id ${jsonObject.id} of type ${jsonObject.type}, min angle is provided while angle type is undefined`)
            }
        }

        if (jsonObject['maxAngle']) {
            if (this.angleType === StrengthAngleType.Friction) {
                this.angleFrictionMax = deg2rad(jsonObject['maxAngle'])
                this.angleFrictionIsDefined = true
            }
            else if (this.angleType === StrengthAngleType.Sigma1) {
                // The user defines the maximum angle between the neoformed striated plane and the compressional stress axis Sigma_1
                // This angle can be estimated from fault mechanics.
                // angleS1Max = complementary angle, defined as the angle between the normal to the plane and Sigma_1 <S1, n-plane>
                this.angleS1Max = Math.PI / 2 - deg2rad(jsonObject['maxAngle'])
                this.angleS1MinIsDefined = true
            }
            else {
                result.warnings.push(`For data id ${jsonObject.id} of type ${jsonObject.type}, max angle is provided while angle type is undefined`)
            }
        }

        // Calculate:
        // nSigma1_Sm_Mean = unit vector Sigma 1 defined in reference system Sm, whose location in the Mohr Circle is centred around the valid angular interval.
        // deltaTheta1_Sm = angle between nSigma1_Sm_Mean and the stress axis located at the boundaries of the Mohr circle angular interval.
        this.nSigma1_Sm_Mean_deltaTheta1_Sm_MohrCircle()

        // Calculate three rotation tensors from the geographic reference system to the micro/meso structure reference system (i.e., from S to Sm).
        // Reference systems Sm are associated with three significant points in the Mohr-Circle angular interval linked to the micro/meso structure :
        //      Points are located at the minimum, intermediate and maximum angle relative to Sigma_1_Sm
        this.rotationTensors_S2Sm_Mrot()

        return result
    }

    cost({ displ, strain, stress }: { displ?: Vector3, strain?: HypotheticalSolutionTensorParameters, stress?: HypotheticalSolutionTensorParameters }): number {
        if (this.problemType === StriatedPlaneProblemType.DYNAMIC) {
            // We define 3 orthonormal right-handed reference systems:
            //      S =  (X, Y, Z ) is the geographic reference frame oriented in (East, North, Up) directions.
            //      Sm = (Xm,Ym,Zm) is the principal stress reference frame parallel to the stress axes, 
            //              defined in terms of the micro/meso structure, e.g., the neoformed striated plane (sigma1_Sm, sigma3_Sm, sigma2_Sm);
            //      Sh = (Xh,Yh,Zh) is the principal stress reference frame parallel to the stress axes, 
            //              defined from the hypothetical stress tensor solution, e.g., from grid search or Montecarlo (sigma1_Sh, sigma3_Sh, sigma2_Sh);

            // Sh is defined by Sr or Sw reference systems:
            //      Sr  =  (Xr, Yr, Zr ) is the principal reference frame chosen by the user in the interactive search phase ('r' stands for 'rough' solution).
            //      Sw =  (Xw, Yw, Zw ) is the principal reference frame for a fixed node in the search grid (sigma_1, sigma_3, sigma_2) ('w' stands for 'winning' solution)

            // The cost method implements two rotation tensors termed Mrot[i] and Hrot, defined in terms of reference frames Sm and Sh:

            // Mrot[i] is is the transformation matrix between S and Sm ('M' stands for micro/meso structure), such that:
            //      Vm = Mrot[i]  V      where V and Vm are corresponding vectors in S and Sm
            //      V  = MTrot[i] Vm       (MTrot is tensor Mrot transposed)
            // Mrot[i] is calculated only once, when initializing the neoformed striated plane **

            // Hrot is is the transformation matrix between S and Sh ('H' sand 'h' stand for 'hypothetical' solution), such that:
            //      Vh = Hrot[i]  V      where V and Vh are corresponding vectors in S and Sh
            //      V  = HTrot[i] Vh     (HTrot is tensor Hrot transposed)

            // Hrot is is defined either by Rrot or by Wrot, depending on the calling functions:
            //      Hrot = Rrot in the interactive search phase using integral curves
            //      Hrot = Wrot in the inverse method search phase using Montecarlo (for example)

            // Rotation tensors Rrot and RTrot between systems S and Sr are such that:
            //      Vr = Rrot  V
            //      V  = RTrot Vr        (RTrot is tensor Rrot transposed)

            // Rotation tensors Wrot and WTrot between systems S and Sw satisfy : WTrot = RTrot DTrot, such that:
            //      Vw = Wrot  V
            //      V  = WTrot Vw        (WTrot is tensor Wrot transposed)

            let Omega: number = Number.POSITIVE_INFINITY
            let nOmega: Vector3

            // nSigma1_Sh, nSigma2_Sh, nSigma3_Sh = Unit vectors parallel to principal stress axes in hypothetical reference system Sh
            const nSigma1_Sh = stress.S1_X
            const nSigma2_Sh = stress.S2_Z

            // nSigma2_Sh_X_nSigma2_Sm = rotation axis between the stress axes nSigma2_Sh and nSigma2_Sm defined by the cross product of two unit vectors
            let nSigma2_Sh_X_nSigma2_Sm = crossProduct({ U: nSigma2_Sh, V: this.nSigma2_Sm })
            // The magnitude of two unit vectors is sin(Omega), where Omega is the angle between the unit vectors 
            let Mag_nSigma2_Sh_X_nSigma2_Sm = vectorMagnitude(nSigma2_Sh_X_nSigma2_Sm)

            let nSigma1_Sh_Rot: Vector3 = undefined
            if (Mag_nSigma2_Sh_X_nSigma2_Sm > this.EPS) {
                // unit vectors nSigma2_Sh and nSigma2_Sm are not parallel (i.e., the stress axes are not aligned)
                // nOmega = unitary rotation axis 
                nOmega = normalizeVector(nSigma2_Sh_X_nSigma2_Sm, Mag_nSigma2_Sh_X_nSigma2_Sm)

                // Omega = Positive (anticlockwise) rotation angle between vectors nSigma2_Sh and nSigma2_Sm - in interval (0,PI)
                // Note that acos(x) gives an angle in interval [0,PI]
                Omega = Math.acos(scalarProduct({ U: nSigma2_Sh, V: this.nSigma2_Sm }))

                let Prot: Matrix3x3 = undefined
                if (Omega <= Math.PI / 2) {
                    // Omega is the minimum rotation angle such that stress axis nSigma2_Sh is transformed into nSigma2_Sm:

                    // Calculate the proper rotation matrix Prot such that :
                    //      nSigma2_Sm = Prot nSigma2_Sh 
                    Prot = properRotationTensor({ nRot: nOmega, angle: Omega })

                } else {
                    // Omega is in interval (PI / 2, PI). In this situation:
                    //      The minimum rotation is given by the complementary angle : PI - Omega
                    //      The axis of rotation is : - nOmega
                    // Note that, for an arbitrary axis (e.g., nSigma1_Sh), a rotation of Omega around axis nOmega 
                    //      is not equivalent to a rotation (PI - Omega() around axis (- nOmega)

                    // Calculate the proper rotation matrix PR such that :
                    //      Prot nSigma2_Sh = - nSigma2_Sm
                    Prot = properRotationTensor({ nRot: constant_x_Vector({ k: -1, V: nOmega }), angle: Math.PI - Omega })
                }
                // nSigma1_Sh_Rot = image of hypothetical stress axis nSigma1_Sh obtained from proper rotation matrix
                //          nSigma1_Sh_Rot is in the plane of mouvement ot the neoformed striated plane
                nSigma1_Sh_Rot = tensor_x_Vector({ T: Prot, V: nSigma1_Sh })

            } else {
                // unit vectors nSigma2_Sh and nSigma2_Sm are aligned; thus the rotation angle is zero
                Omega = 0
                nSigma1_Sh_Rot = nSigma1_Sh
            }

            // Calculate if nSigma1_Sh_Rot is located in the valid Mohr-Circle angular interval
            // sigma1_Sm_Mean = Mean orientation of unit vector nSigma1_Sm corresponding to a point centred in the valid Mohr-Circle angular interval.
            //      This value is calculated in method nSigma1_Sm_Mean_deltaTheta1_Sm_MohrCircle
            // sigma1_Sm_Mean . nSigma1_Sh_Rot = cos(alpha) where alpha = minimum angle between the two stress axes
            //      Note that if the scalar product is negative (e.g. PI/2 < alpha <= PI ) then the minimum angle is given by PI - alpha
            //      This situation is considered by taking the absolute value of the scalar product:
            const angle_nSigma1_Sm_Mean_nSigma1_Sh_Rot = Math.acos(Math.abs(scalarProduct({ U: this.nSigma1_Sm_Mean, V: nSigma1_Sh_Rot })))

            if (angle_nSigma1_Sm_Mean_nSigma1_Sh_Rot <= this.deltaTheta1_Sm) {
                // The stress axis nSigma1_Sh_Rot is located within the Mohr Circle angular interval
                //      deltaTheta1_Sm = angle between sigma1_Sm_Mean and the stress axis located at the boundaries of the Mohr circle angular interval.
                // Thus, the minimum rotation angle Omega defines the misfit between the hypothetical stress tensor (sigma1_Sh, sigma3_Sh, sigma2_Sh)
                //      and a stress tensor (sigma1_Sm, sigma3_Sm, sigma2_Sm) consistent with the micro/meso structure kinematics (e.g., the neoformed striated plane)
                return Omega

            } else {
                // The stress axis nSigma1_Sh_Rot is NOT located at an angle within the valid Mohr Circle Angular Interval (MCAI):
                //       [nSigma1_Sm_Mean - deltaTheta1_Sm, nSigma1_Sm_Mean + deltaTheta1_Sm]
                // Thus we shall examine 3 points of the Mohr Circle angular interval, in order to determine the minimum rotation 
                //      between principal stress axes (sigma1_Sh, sigma3_Sh, sigma2_Sh) and (sigma1_Sm, sigma3_Sm, sigma2_Sm)

                const OmegaMC = [0, 0, 0]
                const MrotHTrot = [newMatrix3x3(), newMatrix3x3(), newMatrix3x3()]
                for (let i = 0; i < 3; i++) {
                    // The cost function for a micro/meso structure is defined as the minimum angular rotation between reference systems Sh and Sm(i(), where:
                    //      Sh is defined according to the hypothetical stress tensor solution ('h' stands for hypothetical);
                    //      Sm(i) is defined according to the micro/meso structure stress tensors Mrot[i] ('m' an 'M' stand for micro/meso structure).

                    // The rotation tensor MrotHTrot between systems Sh and Sm is such that: Vm = MrotHTrot Vh (where Vh is defined in Sr or Sw), 
                    //      where MrotHTrot = Mrot . HTrot (HTrot = Hrot transposed):
                    MrotHTrot[i] = multiplyTensors({ A: this.Mrot[i], B: transposeTensor(stress.Hrot) })

                    // The angle of rotation associated to tensor MrotHTrot is defined by the trace tr(MrotHTrot), according to the relation:
                    //      tr(MrotHTrot) = 1 + 2 cos(theta)
                    // 4 possible right-handed reference systems are considered for MrotHTrot in order to calculate the minimum rotation angle
                    OmegaMC[i] = minRotAngleRotationTensor(MrotHTrot[i])
                }

                // Calculate the minimum rotation angle between reference systems Sh and Sm(i) (i = 0,1,2 )
                const misfit = Math.min(...OmegaMC)
                if (misfit === OmegaMC[1]) {
                    throw 'The minimum rotation angle for neoformed striated plane ' + this.noPlane + ' corresponds to the middle point in the Mohr circle'
                        + '. Thus the rotation angle is not a simple monotonic function!'
                }

                // -----------------------
                // ON DOIT RETOURNER QUEC CHOSE ici
                // -----------------------
                // return Number.POSITIVE_INFINITY
            }
        }
    }

    protected nSigma1_Sm_Mean_deltaTheta1_Sm_MohrCircle() {
        // This method calculates vector sigma1_Sm_Mean and deltaTheta1_Sm such that:
        //      nSigma1_Sm_Mean = unit vector Sigma 1 defined in reference system Sm, whose location in the Mohr Circle is centred in the valid angular interval.
        //      deltaTheta1_Sm = angle between sigma1_Sm_Mean and the stress axis located at the boundaries of the Mohr circle angular interval.

        if (this.angleS1MinIsDefined == true) {
            // Case 3: The  <Sigma 1,n> angular interval is defined:
            //  The angle between nSigma1_Sm and the normal to the fault plane is constrained within interval [angleS1Min, angleS1Max]
            this.angleMean_nSigma1_Sm_nPlane = (this.angleS1Min + this.angleS1Max) / 2
            this.deltaTheta1_Sm = (this.angleS1Max - this.angleS1Min) / 2

        } else if (this.angleFrictionIsDefined) {
            // A specific friction angle interval is defined for the neoformed striated plane. Thus, 
            // Case 2: The friction angle phi is defined in interval [angleFrictionMin, angleFrictionMax]. Both friction angles belong to interval [0,PI/2)
            //      The angle <Sigma 1,n> can de readily calculated from the friction angle using relation:
            //      <Sigma 1,n> = PI/4 + phi/2
            this.angleMean_nSigma1_Sm_nPlane = (Math.PI + this.angleFrictionMin + this.angleFrictionMax) / 4
            this.deltaTheta1_Sm = (this.angleFrictionMax - this.angleFrictionMin) / 4

        } else {
            // Case 1: The optional parameters concerning the friction angle interval or the <Sigma 1,n> angular interval are not specified
            // In such case, the location of the striated plane in the Mohr Circle is not constrained and includes all the left quadrant of the Circle.
            // In other words, angle <Sigma 1,n> is in interval [PI/4,PI/2)
            this.angleMean_nSigma1_Sm_nPlane = 3 * Math.PI / 8       // 67.5°
            this.deltaTheta1_Sm = Math.PI / 8                       // 22.5°
        }
        // nSigma1_Sm_Mean is in the extensional quadrant of the plane of movement, and is defined by:
        //      nSigma1_Sm_Mean = cos(angleMean_nSigma1_Sm_nPlane) nPlane - sin(angleMean_nSigma1_Sm_nPlane) nStriation
        this.nSigma1_Sm_Mean = add_Vectors({
            U: constant_x_Vector({ k: Math.cos(this.angleMean_nSigma1_Sm_nPlane), V: this.nPlane }),
            V: constant_x_Vector({ k: - Math.sin(this.angleMean_nSigma1_Sm_nPlane), V: this.nStriation })
        })
    }

    protected rotationTensors_S2Sm_Mrot() {
        // This method calculates the 3 rotation matrixes Mrot[i] between the geographic reference system S = (X, Y, Z)
        // and the reference systems Sm = (Xm, Ym, Zm) associated to the micro/meso structure (e.g., neoformed striated plane, such that:
        //      Vm = Mrot[i] . V        where V and Vm are corresponding vectors in reference systems S and Sm
        // Sm is defined according to index i (1, 2, and 3), which represents a specific point in the Mohr-Circle angular interval.

        // Calculate the unit vector parellel to Sigma2_Sm, which is perpendicular to nPlane and nStriation:
        this.nSigma2_Sm = normalizedCrossProduct({ U: this.nPlane, V: this.nStriation })

        // Firstly, we calculate the angles defining 3 points of the valid Mohr Circle angular interval (MCAI):
        // angle_nPlane_nSigma1_Sm[i] = angle between the normal to the plane and the stress axis sigma1_Sm for 3 points located in the MCAI:
        let angle_nPlane_nSigma1_Sm = []
        // Minimum angle in the interval
        angle_nPlane_nSigma1_Sm[0] = this.angleMean_nSigma1_Sm_nPlane - this.deltaTheta1_Sm
        // Middle point
        angle_nPlane_nSigma1_Sm[1] = this.angleMean_nSigma1_Sm_nPlane
        // Maximum angle in the interval
        angle_nPlane_nSigma1_Sm[2] = this.angleMean_nSigma1_Sm_nPlane + this.deltaTheta1_Sm

        for (let i = 0; i < 3; i++) {
            // Loop for calculating the transformation matrixes Mrot[i]
            // sigma1_Sm is defined in the plane of movement (dilatant quadrant) in terms of angle angle_nPlane_nSigma1_Sm[i]
            this.nSigma1_Sm = add_Vectors({
                U: constant_x_Vector({ k: Math.cos(angle_nPlane_nSigma1_Sm[i]), V: this.nPlane }),
                V: constant_x_Vector({ k: - Math.sin(angle_nPlane_nSigma1_Sm[i]), V: this.nStriation })
            })
            // The micro/meso structure stress tensor  (sigma1_Sm, sigma3_Sm, sigma2_Sm) is right handed: 
            this.nSigma3_Sm = crossProduct({ U: this.nSigma2_Sm, V: this.nSigma1_Sm })

            // Mrot[i] = rotation matrixes for the micro/meso structure reference systems (sigma1_Sm, sigma3_Sm, sigma2_Sm) corresponding to the 3 points in the
            //          Mohr-Circle angular interval. The micro/meso structure is defined according to the data type (i.e., the neoformed striated plane):
            //      Vm = Mrot[i] . V
            // where V and Vm are corresponding vectors in reference systems S and Sm

            // Mrot[i] is an array containing 3x3 matrices
            this.Mrot[i] = rotationTensor_Sa_Sb({ Xb: this.nSigma1_Sm, Yb: this.nSigma3_Sm, Zb: this.nSigma2_Sm })
        }
    }
}