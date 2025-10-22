// Calculate the stress components of fault planes

import { constant_x_Vector, crossProduct, Matrix3x3, newMatrix3x3, newVector3D, normalizedCrossProduct, Vector3 } from "../../math/math"
import { deg2rad, tensor_x_Vector, spherical2unitVectorCartesian } from "../../math/math"
import { SphericalCoords } from "../../math/SphericalCoords"
import { CDirection, Direction, Plane, Striation, TypeOfMovement } from "./types"
import { scalarProduct } from "../../math/math"

/**
 * A fault is represented by a plane, this with a normal and a position.
 */
export class FaultDataHelper {

    static create(plane: Plane, striation: Striation) {
        const f = new FaultDataHelper({
            strike: plane.strike,
            dipDirection: plane.dipDirection,
            dip: plane.dip
        })

        if (!striation.trendIsDefined) { // i.e. the plane is not horizontal
            // The striation is defined by the rake and strike direction and not by the trend

            if (f.dip !== 90 || striation.rake !== 90) {
                // Complementary cases to vertical plane with vertical striation
                f.setStriationFromRake({
                    typeOfMovement: striation.typeOfMovement,
                    rake: striation.rake,
                    strikeDirection: striation.strikeDirection,
                })
            }
            else {
                // Special case: vertical plane with vertical striation
                f.setStriationForVerticalPlaneAndRake({
                    strike: plane.strike,
                    dipDirection: plane.dipDirection,
                    strikeDirection: striation.strikeDirection,
                    typeOfMovement: striation.typeOfMovement
                })
            }
            // return {
            //     nPlane: f.normal,
            //     nStriation: f.striation,
            //     nPerpStriation: f.e_perp_striation
            // }
            return f

        } else {
            // The striation is defined by the trend: the fault plane is not vertical (it may be horizontal or shallow dipping)
            f.setStriationFromTrend({
                typeOfMovement: striation.typeOfMovement,
                striationTrend: striation.trend,
            })

            // return {
            //     nPlane: f.normal,
            //     nStriation: f.striation,
            //     nPerpStriation: f.e_perp_striation
            // }
            return f
        }

        // ** In principle this return is not reached (??)
        // return {
        //     nPlane: f.normal
        // }
    }

    /**
     * Set the orientation of the striation in the fault plane, which can defined in two different ways (which are exclusive):
     * 1. Rake (or pitch) [0,90], measured from the strike direction, which points in one of the two opposite directions of the fault strike.
     *   Strike direction : (N, E, S, W) or a combination of two direction (NE, SE, SW, NW).
     * 2. For shallow-dipping planes (i.e., the compass inclinometer is inaccurate):
     *   Striae trend: [0, 360)
     */
    constructor({ strike, dipDirection, dip }: { strike: number, dipDirection: Direction, dip: number }) {
        this.strike = strike
        this.dipDirection = dipDirection
        this.dip = dip
        this.faultSphericalCoords()
    }

    get sphericalCoords() {
        return this.coordinates
    }

    get normal(): Vector3 {
        return this.normal_
    }

    /**
     * @brief Get the striation vector in reference system S
     */
    get striation(): Vector3 {
        return this.e_striation_
    }

    /**
     * @brief Get the striation vector in reference system S
     */
    get e_perp_striation(): Vector3 {
        return this.e_perp_striation_
    }

    check({ displ, strain, stress }: { displ: Vector3, strain: Matrix3x3, stress: Matrix3x3 }): boolean {
        return stress !== undefined
    }

    cost({ displ, strain, stress }: { displ: Vector3, strain: Matrix3x3, stress: Matrix3x3 }): number {
        return 1
    }

    /**
     * General case to set the striation.
     * 
     * Set the orientation of the striation in the fault plane, which can defined in two different ways (which are exclusive):
     * 1. Rake (or pitch) [0,90], measured from the strike direction, which points in one of the two opposite directions of the fault strike.
     *   Strike direction : (N, E, S, W) or a combination of two direction (NE, SE, SW, NW).
     * 2. For shallow-dipping planes (i.e., the compass inclinometer is inaccurate):
     *   Striae trend: [0, 360)
     */
    private setStriationFromRake(
        { typeOfMovement, rake, strikeDirection }:
            { typeOfMovement: TypeOfMovement, rake: number, strikeDirection: Direction }): FaultDataHelper {
        // check and set
        this.rake = rake
        this.strikeDirection = strikeDirection
        this.typeMov = typeOfMovement
        this.faultStriationAngle_A()
        this.faultStriationAngle_B()

        return this
    }

    /**
     * Special case for horizontal and shallow angle plane.
     */
    private setStriationFromTrend(
        { typeOfMovement, striationTrend }:
            { typeOfMovement: TypeOfMovement, striationTrend: number }): FaultDataHelper {
        this.typeMov = typeOfMovement
        this.striationTrend = striationTrend

        // Calculate the striation vector and check that it matches the type of movement
        //  if the type of movement is undefined then the data may be duplicated and considered with two opposite striation directions **
        let phi_striationTrend = 0

        if (this.dip === 0) {
            // The plane is horizontal: 
            //      by convention, the striation trend points toward the direction of movement of the top block relative to the bottom block

            // phi_striationTrend = angle indicating the direction of the horizontal vector pointing toward the striation trend 
            //      phi_striationTrend is measured anticlockwise from the X axis in reference system S = (X, Y, Z) = (E, N, Up)
            phi_striationTrend = Math.PI / 2 - deg2rad(this.striationTrend)
            if (phi_striationTrend < 0) { phi_striationTrend = phi_striationTrend + 2 * Math.PI }

            // nStriation = unit vector representing the striation in reference system S, which points toward the striation trend
            this.nStriation[0] = Math.cos(phi_striationTrend)
            this.nStriation[1] = Math.sin(phi_striationTrend)
            this.nStriation[2] = 0

        } else {
            // The plane has (in principle) a shallow dip (note that the striation trend is not defined for a vertical plane)

            // phi_nStriationTrend = angle indicating the direction of the horizontal vector perpendicular to the striation trend 
            //      phi_nStriationTrend is measured anticlockwise from the X axis in reference system S = (X, Y, Z) = (E, N, Up)
            phi_striationTrend = 2 * Math.PI - deg2rad(this.striationTrend)

            // nTrend = unit vector normal to the vertical plane that is parallel to the striation trend
            this.nStriationTrend[0] = Math.cos(phi_striationTrend)
            this.nStriationTrend[1] = Math.sin(phi_striationTrend)
            this.nStriationTrend[2] = 0

            // Calculate in reference system S the unit vector nStriation, which lies in the fault plane and in the vertical plane parallel to the trend.
            // Thus, nStriation is perpendicular to nTrend and to normal (the normal to the fault plane), and can be calculated using the normalized cross product
            this.nStriation = normalizedCrossProduct({ U: this.normal, V: this.nStriationTrend })

            // nStriation should be oriented according to the movement of the hanging wall relative to the footwall:
            // To test and invert (if necessary) the striation vector, the fault plane is subdivided in four Quadrants, 
            //      by combinning two strike-slip with two dip-slip movements in the local reference system (e_phi, e_theta)

            // StrikeSlipMov = strike slip movement: Left-Lateral in the direction of e_phi
            //      Left-Lateral (LL): StrikeSlipMov > 0;       Right-Lateral (RL): StrikeSlipMov < 0
            let StrikeSlipMov = scalarProduct({ U: this.e_phi, V: this.nStriation })

            // StrikeSlipMov = dip slip  movement: Normal in the direction of e_theta
            //      Normal (N): DipSlipMov > 0;       Inverse (I): DipSlipMov < 0
            let DipSlipMov = scalarProduct({ U: this.e_theta, V: this.nStriation })

            if (Math.abs(DipSlipMov) < this.EPS) {
                // The dip-slip component of movement is negligible and the type of movement is pure strike-slip

                if (StrikeSlipMov > 0) {
                    // If the type of movement is Left-Lateral (LL) then the striation vector is correctly oriented;
                    // If type of movement is right-lateral (RL) then the striation vector is inverted

                    if ((this.typeMov !== TypeOfMovement.LL) && (this.typeMov !== TypeOfMovement.RL) && (this.typeMov !== TypeOfMovement.UND)) {
                        // Thus, the type of movement cannot be different from a strike-slip fault (LL, OR RL) - or it is undefined (UND)
                        throw new Error(`Type of movement for data number xx is wrong. Cannot be this.typeMov`)

                    } else if (this.typeMov === TypeOfMovement.RL) {
                        // The direction of the striation vector is inverted to match the type of movement
                        this.nStriation = constant_x_Vector({ k: -1, V: this.nStriation })
                    }

                } else if (StrikeSlipMov < 0) {
                    // If the type of movement is Right-Lateral (RL) then the striation vector is correctly oriented;
                    // If type of movement is Left-lateral (LL) then the striation vector is inverted

                    if ((this.typeMov !== TypeOfMovement.LL) && (this.typeMov !== TypeOfMovement.RL) && (this.typeMov !== TypeOfMovement.UND)) {
                        // Thus, the type of movement cannot be different from a strike-slip fault (LL, OR RL) - or it is undefined (UND)
                        throw new Error(`Type of movement for data number xx is wrong. Cannot be this.typeMov`)

                    } else if (this.typeMov === TypeOfMovement.LL) {
                        // The direction of the striation vector is inverted to match the type of movement
                        this.nStriation = constant_x_Vector({ k: -1, V: this.nStriation })
                    }
                }

            } else if (Math.abs(StrikeSlipMov) < this.EPS) {
                // The strike-slip component of movement is negligible and the type of movement is pure dip-slip

                if (DipSlipMov > 0) {
                    // If the type of movement is Normal (N) then the striation vector is correctly oriented;
                    // If type of movement is Inverse (I) then the striation vector is inverted

                    if ((this.typeMov !== TypeOfMovement.N) && (this.typeMov !== TypeOfMovement.I) && (this.typeMov !== TypeOfMovement.UND)) {
                        // Thus, the type of movement cannot be different from a dip-slip fault (N, OR I) - or it is undefined (UND)
                        throw new Error(`Type of movement for data number xx is wrong. Cannot be this.typeMov`)

                    } else if (this.typeMov === TypeOfMovement.I) {
                        // The direction of the striation vector is inverted to match the type of movement
                        this.nStriation = constant_x_Vector({ k: -1, V: this.nStriation })
                    }

                } else if (DipSlipMov < 0) {
                    // If the type of movement is Inverse (I) then the striation vector is correctly oriented;
                    // If type of movement is Normal (N) then the striation vector is inverted

                    if ((this.typeMov !== TypeOfMovement.N) && (this.typeMov !== TypeOfMovement.I) && (this.typeMov !== TypeOfMovement.UND)) {
                        // Thus, the type of movement cannot be different from a dip-slip fault (N, OR I) - or it is undefined (UND)
                        throw new Error(`Type of movement for data number xx is wrong. Cannot be this.typeMov`)

                    } else if (this.typeMov === TypeOfMovement.N) {
                        // The direction of the striation vector is inverted to match the type of movement
                        this.nStriation = constant_x_Vector({ k: -1, V: this.nStriation })
                    }
                }

            } else {
                // The type of movement combines both a dip-slip and a strike-slip component
                // Note that the striation can be oriented in two opposite directions depending on the type of movement

                if ((StrikeSlipMov > 0) && (DipSlipMov > 0)) {
                    // Quadrant 1: Striation combines left-lateral and normal components
                    // If the type of movement combines a Normal and a Left-Lateral component (N, N_LL, or LL) then the striation vector is correctly oriented:
                    //      i.e., nStriation is located in Quadrant 1 consistently with the type of movement;
                    // If the type of movement combines an Inverse and a Right-Lateral component (I, I_RL, or RL) then the striation vector is inverted:
                    //      i.e., nStriation should be located in Quadrant 3 and not in Quadrant 1

                    if (this.typeMov !== TypeOfMovement.UND) {
                        // The type of movement is not undefined

                        if ((this.typeMov === TypeOfMovement.N_RL) || (this.typeMov === TypeOfMovement.I_LL)) {
                            // Note that the type of movement cannot be (N_RL, or I_LL), in which case the striation would be located in Quadrants 2 or 4
                            throw new Error(`Type of movement for data number xx is wrong. Cannot be this.typeMov`)

                        } else if ((this.typeMov === TypeOfMovement.I) || (this.typeMov === TypeOfMovement.I_RL) || (this.typeMov === TypeOfMovement.RL)) {
                            // The direction of the striation vector has to be inverted to match the type of movement
                            this.nStriation = constant_x_Vector({ k: -1, V: this.nStriation })
                        }
                    }

                } else if ((StrikeSlipMov < 0) && (DipSlipMov > 0)) {
                    // Quadrant 2: type of movement combines right-lateral and normal movement
                    // If the type of movement combines a Normal and a Right-Lateral component (N, N_RL, or RL) then the striation vector is correctly oriented:
                    //      i.e., nStriation is located in Quadrant 2 consistently with the type of movement;
                    // If the type of movement combines an Inverse and a Left-Lateral component (I, I_LL, or LL) then the striation vector is inverted:
                    //      i.e., nStriation should be located in Quadrant 4 and not in Quadrant 2

                    if (this.typeMov !== TypeOfMovement.UND) {
                        // The type of movement is not undefined

                        if ((this.typeMov === TypeOfMovement.N_LL) || (this.typeMov === TypeOfMovement.I_RL)) {
                            // Thus, the type of movement cannot be (N_LL, or I_RL), in which case the striation would be located in Quadrants 1 or 3
                            throw new Error(`Type of movement for data number xx is wrong. Cannot be this.typeMov`)

                        } else if ((this.typeMov === TypeOfMovement.I) || (this.typeMov === TypeOfMovement.I_LL) || (this.typeMov === TypeOfMovement.LL)) {
                            // The direction of the striation vector has to be inverted to match the type of movement
                            this.nStriation = constant_x_Vector({ k: -1, V: this.nStriation })
                        }
                    }

                } else if ((StrikeSlipMov < 0) && (DipSlipMov < 0)) {
                    // Quadrant 3: type of movement combines right-lateral and an inverse movement
                    // If the type of movement combines a Inverse and a Right-Lateral component (I, I_RL, or RL) then the striation vector is correctly oriented:
                    //      i.e., nStriation is located in Quadrant 3 consistently with the type of movement;
                    // If the type of movement combines an Normal and a Left-Lateral component (N, N_LL, or LL) then the striation vector is inverted:
                    //      i.e., nStriation should be located in Quadrant 1 and not in Quadrant 3

                    if (this.typeMov !== TypeOfMovement.UND) {
                        // The type of movement is not undefined

                        if ((this.typeMov === TypeOfMovement.N_RL) || (this.typeMov === TypeOfMovement.I_LL)) {
                            // Thus, the type of movement cannot be (N_RL, or I_LL), in which case the striation would be located in Quadrants 2 or 4
                            throw new Error(`Type of movement for data number xx is wrong. Cannot be this.typeMov`)

                        } else if ((this.typeMov === TypeOfMovement.N) || (this.typeMov === TypeOfMovement.N_LL) || (this.typeMov === TypeOfMovement.LL)) {
                            // The direction of the striation vector has to be inverted to match the type of movement
                            this.nStriation = constant_x_Vector({ k: -1, V: this.nStriation })
                        }
                    }

                } else if ((StrikeSlipMov > 0) && (DipSlipMov < 0)) {
                    // Quadrant 4: type of movement combines left-lateral and an inverse movement
                    // If the type of movement combines a Inverse and a Left-Lateral component (I, I_LL, or LL) then the striation vector is correctly oriented:
                    //      i.e., nStriation is located in Quadrant 4 consistently with the type of movement;
                    // If the type of movement combines an Normal and a Right-Lateral component (N, N_RL, or RL) then the striation vector is inverted:
                    //      i.e., nStriation should be located in Quadrant 2 and not in Quadrant 4

                    if (this.typeMov !== TypeOfMovement.UND) {
                        // The type of movement is not undefined

                        if ((this.typeMov === TypeOfMovement.N_LL) || (this.typeMov === TypeOfMovement.I_RL)) {
                            // Thus, the type of movement cannot be (N_LL, or I_RL), in which case the striation would be located in Quadrants 1 or 3
                            throw new Error(`Type of movement for data number xx is wrong. Cannot be this.typeMov`)

                        } else if ((this.typeMov === TypeOfMovement.N) || (this.typeMov === TypeOfMovement.N_RL) || (this.typeMov === TypeOfMovement.RL)) {
                            // The direction of the striation vector has to be inverted to match the type of movement
                            this.nStriation = constant_x_Vector({ k: -1, V: this.nStriation })
                        }
                    }
                }
            }
        }
        // Calculate in reference system S the unit vector e_perp_striation_ located on the fault plane and perpendicular to the striation.
        // This vector is necessary for calculating the misfit angle for criteria involving friction.
        // The local coord system (e_striation_, e_perp_striation_, normal) is right handed
        this.e_perp_striation_ = crossProduct({ U: this.normal, V: this.e_striation_ })

        return this
    }

    private setStriationForVerticalPlaneAndRake(
        { typeOfMovement, strike, strikeDirection, dipDirection }:
            { typeOfMovement: TypeOfMovement, strike: number, strikeDirection: Direction, dipDirection: Direction }
    ) {

        // This method calculates in reference system S the unit vector e_striation pointing toward the measured striation

        // Special case: Vertical plane with vertical striation
        // In such case the dip direction has a different meaning: it points in the direction of the uplifted block

        //      The unit vector e_phi is is parallel to the strike of the fault plane, and is oriented such that e_theta x e_phi = e_r (where x is the cross porduct )
        //      The azimuthal angle phi is chosen in the direction of the fault dip (note that phi is different from the azimuth of the fault plane measured in the field)

        // The unit normal vector nPlane = e_r points in the direction of the "outer block"

        this.strike = strike
        this.strikeDirection = strikeDirection
        this.typeMov = typeOfMovement
        this.dipDirection = dipDirection

        if (this.strike === 0) {
            // Spherical coords in reference system S (method faultSphericalCoords): (phi, theta) = (PI, PI / 2)
            // The unit normal vector nPlane is defined from spherical coords (phi, theta) in reference system S; 
            // nPlane points West

            if ((this.strikeDirection !== Direction.N) && (this.strikeDirection !== Direction.S) && (this.strikeDirection !== Direction.UND)) {
                throw new Error(`Strike direction this.strikeDirection for measuring the rake is wrong. Should be N, S, or UND`)
            }

            if ((this.dipDirection !== Direction.E) && (this.dipDirection !== Direction.W)) {
                // Vertical plane with vertical striation: the dip direction has a different meaning: it points in the direction of the uplifted block
                throw new Error(`Special case: vertical plane with vertical striation: Dip direction points toward the uplifted bock and should be E or W`)
            }

            // Calculate the striation vector

            if (this.dipDirection === Direction.W) {
                // nPlane and the dip direction point in the same direction (West)
                // Thus, the uplifted block is located in the direction of nPlane (outward block)
                // The striation vector idicates relative movement of the 'outward block' relative to the 'inner block'.
                // Thus e_striation_ points upward
                this.e_striation_[0] = 0
                this.e_striation_[1] = 0
                this.e_striation_[2] = 1

            } else {
                // nPlane and the dip direction point in opposite directions:: dipDirection = E
                // Thus e_striation_ points downward
                this.e_striation_[0] = 0
                this.e_striation_[1] = 0
                this.e_striation_[2] = -1
            }

        } else if (this.strike < 90) {
            // phi = PI - strike
            // nPlane points NW, N, or W toward the 'outer block'; thus the 'inner block' is located SE, S, or E

            if ((this.strikeDirection === Direction.SE) || (this.strikeDirection === Direction.NW)) {
                throw new Error(`Strike direction this.strikeDirection for measuring the rake is wrong. It cannot be SE or NW`)
            }

            if ((this.dipDirection === Direction.SW) || (this.dipDirection === Direction.NE) || (this.dipDirection === Direction.UND)) {
                // Vertical plane with vertical striation: the dip direction has a different meaning: it points in the direction of the uplifted block
                throw new Error(`Special case: vertical plane with vertical striation: dip direction this.dipDirection is wrong. It should point toward the uplifted block: please set consistent dip direction`)
            }

            // Calculate the striation vector

            if ((this.dipDirection === Direction.NW) || (this.dipDirection === Direction.N) || (this.dipDirection === Direction.W)) {
                // nPlane and the dip direction point in the same direction (NW, N, or W). 
                // Thus, the uplifted block corresponds to the outward block
                // The striation vector idicates relative movement of the 'outward block' relative to the 'inner block', and e_striation_ points upward
                this.e_striation_[0] = 0
                this.e_striation_[1] = 0
                this.e_striation_[2] = 1

            } else {
                // nPlane and the dip direction point in opposite directions: dipDirection = SE, S, or E
                // Thus, the uplifted block corresponds to the inner block, and e_striation_ points downward
                this.e_striation_[0] = 0
                this.e_striation_[1] = 0
                this.e_striation_[2] = -1
            }

        } else if (this.strike === 90) {
            // Spherical coords in reference system S (method faultSphericalCoords): (phi, theta) = (PI / 2, PI / 2)
            // The unit normal vector nPlane is defined from spherical coords (phi, theta) in reference system S; 
            // nPlane points North

            if ((this.strikeDirection !== Direction.E) && (this.strikeDirection !== Direction.W) && (this.strikeDirection !== Direction.UND)) {
                throw new Error(`Strike direction this.strikeDirection for measuring the rake is wrong. Should be N, S, or UND`)
            }

            if ((this.dipDirection !== Direction.N) && (this.dipDirection !== Direction.S)) {
                // Vertical plane with vertical striation: the dip direction has a different meaning: it points in the direction of the uplifted block
                throw new Error(`Special case: vertical plane with vertical striation: Dip direction points toward the uplifted bock and should be N or S`)
            }

            // Calculate the striation vector

            if (this.dipDirection === Direction.N) {
                // nPlane and the dip direction point in the same direction (North)
                // Thus, the uplifted block is located in the direction of nPlane (outward block)
                // The striation vector idicates relative movement of the 'outward block' relative to the 'inner block'.
                // Thus e_striation_ points upward
                this.e_striation_[0] = 0
                this.e_striation_[1] = 0
                this.e_striation_[2] = 1

            } else {
                // nPlane and the dip direction point in opposite directions: dipDirection = S
                // Thus e_striation_ points downward
                this.e_striation_[0] = 0
                this.e_striation_[1] = 0
                this.e_striation_[2] = -1
            }

        } else if (this.strike < 180) {
            // phi = PI - strike
            // nPlane points NE, N, or E toward the 'outer block'; thus the 'inner block' is located SW, S, or W

            if ((this.strikeDirection === Direction.SW) || (this.strikeDirection === Direction.NE)) {
                throw new Error(`Strike direction this.strikeDirection for measuring the rake is wrong. It cannot be SW or NE`)
            }

            if ((this.dipDirection === Direction.SE) || (this.dipDirection === Direction.NW) || (this.dipDirection === Direction.UND)) {
                // Vertical plane with vertical striation: the dip direction has a different meaning: it points in the direction of the uplifted block
                throw new Error(`Special case: vertical plane with vertical striation: dip direction this.dipDirection is wrong. It should point toward the uplifted block: please set consistent dip direction`)
            }

            // Calculate the striation vector

            if ((this.dipDirection === Direction.NE) || (this.dipDirection === Direction.N) || (this.dipDirection === Direction.E)) {
                // nPlane and the dip direction point in the same direction (NE, N, or E). 
                // Thus, the uplifted block corresponds to the outward block
                // The striation vector idicates relative movement of the 'outward block' relative to the 'inner block', and e_striation_ points upward
                this.e_striation_[0] = 0
                this.e_striation_[1] = 0
                this.e_striation_[2] = 1

            } else {
                // nPlane and the dip direction point in opposite directions: dipDirection = SW, S, or W 
                // Thus, the uplifted block corresponds to the inner block, and e_striation_ points downward
                this.e_striation_[0] = 0
                this.e_striation_[1] = 0
                this.e_striation_[2] = -1
            }

        } else if (this.strike === 180) {
            // Spherical coords in reference system S (method faultSphericalCoords): (phi, theta) = (PI, PI / 2)
            // The unit normal vector nPlane is defined from spherical coords (phi, theta) in reference system S; 
            // nPlane points East

            if ((this.strikeDirection !== Direction.N) && (this.strikeDirection !== Direction.S) && (this.strikeDirection !== Direction.UND)) {
                throw new Error(`Strike direction this.strikeDirection for measuring the rake is wrong. Should be N, S, or UND`)
            }

            if ((this.dipDirection !== Direction.E) && (this.dipDirection !== Direction.W)) {
                // Vertical plane with vertical striation: the dip direction has a different meaning: it points in the direction of the uplifted block
                throw new Error(`Special case - vertical plane with vertical striation - Dip direction points toward the uplifted bock and should be E or W`)
            }

            // Calculate the striation vector

            if (this.dipDirection === Direction.E) {
                // nPlane and the dip direction point in the same direction (East)
                // Thus, the uplifted block is located in the direction of nPlane (outward block)
                // The striation vector idicates relative movement of the 'outward block' relative to the 'inner block'.
                // Thus e_striation_ points upward
                this.e_striation_[0] = 0
                this.e_striation_[1] = 0
                this.e_striation_[2] = 1

            } else {
                // nPlane and the dip direction point in opposite directions: dipDirection = W
                // Thus e_striation_ points downward
                this.e_striation_[0] = 0
                this.e_striation_[1] = 0
                this.e_striation_[2] = -1
            }

        } else if (this.strike < 270) {
            // phi = 3 PI - strike
            // nPlane points SE, S, or E toward the 'outer block'; thus the 'inner block' is located NW, N, or W

            if ((this.strikeDirection === Direction.SE) || (this.strikeDirection === Direction.NW)) {
                throw new Error(`Strike direction this.strikeDirection for measuring the rake is wrong. It cannot be SE nor NW`)
            }

            if ((this.dipDirection === Direction.NE) || (this.dipDirection === Direction.SW) || (this.dipDirection === Direction.UND)) {
                // Vertical plane with vertical striation: the dip direction has a different meaning: it points in the direction of the uplifted block
                //**throw new Error(`Special case - vertical plane with vertical striation: dip direction dipDirection is wrong  It should point toward the uplifted block: please set consistent dip direction`)
            }

            // Calculate the striation vector

            if ((this.dipDirection === Direction.SE) || (this.dipDirection === Direction.S) || (this.dipDirection === Direction.E)) {
                // nPlane and the dip direction point in the same direction (SE, S, or E). 
                // Thus, the uplifted block corresponds to the outward block
                // The striation vector idicates relative movement of the 'outward block' relative to the 'inner block', and e_striation_ points upward
                this.e_striation_[0] = 0
                this.e_striation_[1] = 0
                this.e_striation_[2] = 1

            } else {
                // nPlane and the dip direction point in opposite directions: dipDirection = NW, N, or W
                // Thus, the uplifted block corresponds to the inner block, and e_striation_ points downward
                this.e_striation_[0] = 0
                this.e_striation_[1] = 0
                this.e_striation_[2] = -1
            }

        } else if (this.strike === 270) {
            // Spherical coords in reference system S (method faultSphericalCoords): (phi, theta) = (3 PI / 2, PI / 2)
            // The unit normal vector nPlane is defined from spherical coords (phi, theta) in reference system S; 
            // nPlane points South

            if ((this.strikeDirection !== Direction.E) && (this.strikeDirection !== Direction.W) && (this.strikeDirection !== Direction.UND)) {
                throw new Error(`Strike direction this.strikeDirection for measuring the rake is wrong. Should be E, W, or UND`)
            }

            if ((this.dipDirection !== Direction.N) && (this.dipDirection !== Direction.S)) {
                // Vertical plane with vertical striation: the dip direction has a different meaning: it points in the direction of the uplifted block
                //**throw new Error(`Special case - vertical plane with vertical striation: Dip direction points toward the uplifted bock and should be N or S`)
            }

            // Calculate the striation vector

            if (this.dipDirection === Direction.S) {
                // nPlane and the dip direction point in the same direction (South)
                // Thus, the uplifted block is located in the direction of nPlane (outward block)
                // The striation vector idicates relative movement of the 'outward block' relative to the 'inner block'.
                // Thus e_striation_ points upward
                this.e_striation_[0] = 0
                this.e_striation_[1] = 0
                this.e_striation_[2] = 1

            } else {
                // nPlane and the dip direction point in opposite direction: dipDirection = N
                // Thus e_striation_ points downward
                this.e_striation_[0] = 0
                this.e_striation_[1] = 0
                this.e_striation_[2] = -1
            }

        } else if (this.strike < 360) {
            // phi = 3 PI - strike
            // nPlane points SW, S, or W toward the 'outer block'; thus the 'inner block' is located NE, N, or E

            if ((this.strikeDirection === Direction.SW) || (this.strikeDirection === Direction.NE)) {
                throw new Error(`Strike direction this.strikeDirection for measuring the rake is wrong. It cannot be SW nor NE`)
            }

            if ((this.dipDirection === Direction.SE) || (this.dipDirection === Direction.NW) || (this.dipDirection === Direction.UND)) {
                // Vertical plane with vertical striation: the dip direction has a different meaning: it points in the direction of the uplifted block
                //**throw new Error(`Special case: vertical plane with vertical striation: dip direction this.dipDirection is wrong. It should point toward the uplifted block: please set consistent dip direction`)
            }

            // Calculate the striation vector

            if ((this.dipDirection === Direction.SW) || (this.dipDirection === Direction.S) || (this.dipDirection === Direction.W)) {
                // nPlane and the dip direction point in the same direction (SW, S, or W). 
                // Thus, the uplifted block corresponds to the outward block
                // The striation vector idicates relative movement of the 'outward block' relative to the 'inner block', and e_striation_ points upward
                this.e_striation_[0] = 0
                this.e_striation_[1] = 0
                this.e_striation_[2] = 1

            } else {
                // nPlane and the dip direction point in opposite directions: : dipDirection = NE, N, or E
                // Thus, the uplifted block corresponds to the inner block, and e_striation_ points downward
                this.e_striation_[0] = 0
                this.e_striation_[1] = 0
                this.e_striation_[2] = -1
            }
        } else {
            // In principle the range of the strike angle has already been checked
            throw new Error(`Strike this.strike is out of range (0,360)`)
        }

        // Calculate in reference system S the unit vector e_perp_striation_ located on the fault plane and perpendicular to the striation.
        // This vector is necessary for calculating the misfit angle for criteria involving friction.
        // The local coord system (e_striation_, e_perp_striation_, normal) is right handed **
        this.e_perp_striation_ = crossProduct({ U: this.normal, V: this.e_striation_ })  // this.normal or this.normal_

        //return
    }

    // ------------------------------ PRIVATE

    private faultSphericalCoords(): void {
        // Each fault is defined by a set of parameters as follows:
        //      The fault plane orientation is defined by three parameters:
        //      Fault strike: clockwise angle measured from the North direction [0, 360)
        //      Fault dip: [0, 90]
        //      Dip direction: (N, E, S, W) or a combination of two directions (NE, SE, SW, NW).
        //          For horizontal planes and vertical planes with oblique rake the dip direction is undefined
        //          For vertical planes with vertical striations the dip Direction has a different meaning: it points toward the uplifted block (particular case)

        // (phi,theta) : spherical coordinate angles defining the unit vector perpendicular to the fault plane (pointing upward)
        //                 in the geographic reference system: S = (X,Y,Z) = (E,N,Up)

        // phi : azimuthal angle in interval [0, 2 PI), measured anticlockwise from the X axis (East direction) in reference system S
        // theta: colatitude or polar angle in interval [0, PI/2], measured downward from the zenith (upward direction)

        //  Write functions relating trend and rake

        // The polar angle (or colatitude) theta is defined by the dip of the fault plane in radians:
        this.coordinates.theta = deg2rad(this.dip)

        // This function calculates the azimuth phi such that the right-handed local coordinate system in polar coordinates is located in the upper hemisphere.
        //      In other words, the radial unit vector is in the upper hemisphere.

        // The right-handed local reference system is specified by three unit vectors defined in the increasing radial, polar, and azimuthal directions (r, theta, and phi):
        //      The azimuthal angle phi is chosen in the direction of the fault dip (note that phi is different from the azimuth of the fault plane measured in the field) 
        //      The unit vector e_theta is parallel to the dip of the fault plane
        //      The unit vector e_phi is is parallel to the strike of the fault plane, and is oriented such that e_theta x e_phi = e_r (where x is the cross porduct )
        //      

        // The following 'if structure' calculates phi from the strike and dip direction of the fault plane:
        if (this.dip === 0) {
            // The fault plane is horizontal - the dip direction is undefined (UND)
            // The radial unit vector points upward and the zimuthal angle can take any value
            this.coordinates.phi = 0

        } else if (this.dip === 90) {
            // The fault plane is vertical 
            if (this.strike <= 180) {
                // phi is in interval [0,PI]
                this.coordinates.phi = Math.PI - deg2rad(this.strike)
            } else {
                // fault strike is in interval (PI,2 PI) and phi is in interval (PI,2 PI)
                this.coordinates.phi = 3 * Math.PI - deg2rad(this.strike)
            }
        } else if (this.strike === 0) {    // The fault plane is neither horizontal nor vertical and the dip direction is defined

            if (this.dipDirection === Direction.E) {
                this.coordinates.phi = 0
            } else if (this.dipDirection === Direction.W) {
                this.coordinates.phi = Math.PI
            } else {
                throw new Error(`dip direction is wrong. Should be E or W. Got ${CDirection.fromType(this.dipDirection)}`)
            }
        } else if (this.strike < 90) {

            if ((this.dipDirection === Direction.S) || (this.dipDirection === Direction.E) || (this.dipDirection === Direction.SE)) {
                // this.strike + this.coordinates.phi = 2 PI
                this.coordinates.phi = 2 * Math.PI - deg2rad(this.strike)

            } else if ((this.dipDirection === Direction.N) || (this.dipDirection === Direction.W) || (this.dipDirection === Direction.NW)) {
                // this.strike + this.coordinates.phi = PI
                this.coordinates.phi = Math.PI - deg2rad(this.strike)
            } else {
                throw new Error(`dip direction is wrong. Should be N, S, E, W, SE or NW. Got ${CDirection.fromType(this.dipDirection)}`)
            }
        } else if (this.strike === 90) {
            if (this.dipDirection === Direction.S) {
                this.coordinates.phi = 3 * Math.PI / 2
            } else if (this.dipDirection === Direction.N) {
                this.coordinates.phi = Math.PI / 2
            } else {
                throw new Error(`dip direction is wrong. Should be N or S. Got ${CDirection.fromType(this.dipDirection)}`)
            }
        } else if (this.strike < 180) {

            if ((this.dipDirection === Direction.S) || (this.dipDirection === Direction.W) || (this.dipDirection === Direction.SW)) {
                // this.strike + this.coordinates.phi = 2Pi
                this.coordinates.phi = 2 * Math.PI - deg2rad(this.strike)

            } else if ((this.dipDirection === Direction.N) || (this.dipDirection === Direction.E) || (this.dipDirection === Direction.NE)) {
                // this.strike + this.coordinates.phi = Pi
                this.coordinates.phi = Math.PI - deg2rad(this.strike)
            } else {
                throw new Error(`dip direction is wrong. Should be N, S, E, W, SE or NW. Got ${CDirection.fromType(this.dipDirection)}`)
            }
        }
        else if (this.strike === 180) {
            if (this.dipDirection === Direction.W) {
                this.coordinates.phi = Math.PI
            } else if (this.dipDirection === Direction.E) {
                this.coordinates.phi = 0
            } else {
                throw new Error(`dip direction is wrong. Should be E or W. Got ${CDirection.fromType(this.dipDirection)}`)
            }
        } else if (this.strike < 270) {

            if ((this.dipDirection === Direction.N) || (this.dipDirection === Direction.W) || (this.dipDirection === Direction.NW)) {
                // this.strike + this.coordinates.phi = 2Pi
                this.coordinates.phi = 2 * Math.PI - deg2rad(this.strike)

            } else if ((this.dipDirection === Direction.S) || (this.dipDirection === Direction.E) || (this.dipDirection === Direction.SE)) {
                // this.strike + this.coordinates.phi = 3Pi
                this.coordinates.phi = 3 * Math.PI - deg2rad(this.strike)

            } else {
                throw new Error(`dip direction is wrong. Should be N, S, E, W, NW or SE. Got ${CDirection.fromType(this.dipDirection)}`)
            }
        } else if (this.strike === 270) {
            if (this.dipDirection === Direction.S) {
                this.coordinates.phi = 3 * Math.PI / 2
            } else if (this.dipDirection === Direction.N) {
                this.coordinates.phi = Math.PI / 2
            } else {
                throw new Error(`dip direction is wrong. Should be N or S. Got ${CDirection.fromType(this.dipDirection)}`)
            }
        } else if (this.strike < 360) {

            if ((this.dipDirection === Direction.N) || (this.dipDirection === Direction.E) || (this.dipDirection === Direction.NE)) {
                // this.strike + this.coordinates.phi = 2Pi
                this.coordinates.phi = 2 * Math.PI - deg2rad(this.strike)

            } else if ((this.dipDirection === Direction.S) || (this.dipDirection === Direction.W) || (this.dipDirection === Direction.SW)) {
                // this.strike + this.coordinates.phi = 3Pi
                this.coordinates.phi = 3 * Math.PI - deg2rad(this.strike)

            } else {
                throw new Error(`dip direction is wrong. Should be N, S, E, W, NE or SW. Got ${CDirection.fromType(this.dipDirection)}`)
            }
        }
        else if (this.strike === 360) {
            if (this.dipDirection === Direction.E) {
                this.coordinates.phi = 0
            } else if (this.dipDirection === Direction.W) {
                this.coordinates.phi = Math.PI
            } else {
                throw new Error(`dip direction is wrong. Should be E or W. Got ${CDirection.fromType(this.dipDirection)}`)
            }
        } else {
            throw new Error(`Strike is wrong. Should be in interval [0,360]`)
        }

        // The fault plane is defined by angles (phi, theta) in spherical coordinates.
        // normal: unit vector normal to the fault plane (pointing upward) defined in the geographic reference system: S = (X,Y,Z)
        this.normal_ = spherical2unitVectorCartesian(this.coordinates)

        // e_phi = unit vector parallel to the strike of the fault plane
        this.e_phi[0] = - Math.sin(this.coordinates.phi)
        this.e_phi[1] = Math.cos(this.coordinates.phi)
        this.e_phi[2] = 0

        // e_theta = unit vector parallel to the dip of the fault plane
        this.e_theta[0] = Math.cos(this.coordinates.theta) * Math.cos(this.coordinates.phi)
        this.e_theta[1] = Math.cos(this.coordinates.theta) * Math.sin(this.coordinates.phi)
        this.e_theta[2] = - Math.sin(this.coordinates.theta)


        // --------------------------------------        
    }

    private faultStriationAngle_A(): void {
        // Function calculating the striation angle in the local reference frame in polar coordinates from the rake
        //      The effect of fault movement on the striation is considered in function faultStriationAngle_B

        // Each fault is defined by a set of parameters as follows:
        //      The fault plane orientation is defined by three parameters:
        //      Fault strike: clockwise angle measured from the North direction [0, 360)
        //      Strike direction (optional): (N, E, S, W) or a combination of two direction (NE, SE, SW, NW).
        //      Fault dip: [0, 90]
        //      Dip direction: (N, E, S, W) or a combination of two directions (NE, SE, SW, NW).

        // The orientation of the striation in the fault plane can defined in two different ways (which are exclusive):

        // 1-   Rake (or pitch) [0,90], measured from the strike direction, which points in one of the two opposite directions of the fault strike.
        //      Strike direction : (N, E, S, W) or a combination of two direction (NE, SE, SW, NW).
        //      Note that the specified strike direction is used to determine the spatial orientation of the striation 

        // 2-   For shallow-dipping planes (i.e., the compass inclinometer is inaccurate):
        //      Striae trend: [0, 360)

        // alphaStria : striation angle measured in the local reference plane (e_phi, e_theta) indicating the motion of the outward block
        //      alphaStria is measured clockwise from e_phi, in interval [0, 2 PI) (this choice is consistent with the definition of the rake, which is measured from the fault strike)

        // V[0] = Math.sin(this.coordinates.theta) * Math.cos( this.coordinates.phi )
        // V[1] = Math.sin(this.coordinates.theta) * Math.sin( this.coordinates.phi )
        // V[2] = Math.cos(this.coordinates.theta)

        // if structure for calculating the striation angle in the local reference frame in polar coordinates from the rake:

        // The special case in which the plane and rake are vertical is treated separately in method setStriationForVerticalPlaneAndRake: the dip direction points toward the uplifted block

        // The following 'if structure' calculates phi from the strike and dip direction (if defined) of the fault plane:

        // Calculate alphaStriaDeg in the general case, i.e;., for planes that are not horizontal and are not vertical with vertical striations (special cases are treated elsewhere)

        if (this.dip > 0 && this.dip < 90) {
            // The plane is not horizontal nor vertical

            if (this.rake > 0 && this.rake < 90) {
                // The strike direction is a geographic direction that must be consistently defined relative to the strike
                // Check the strike direction and calculate the angle alphaStria in the local reference frame
                this.checkStrikeDir_CalcAlphaStria()
            }
            else {
                // The rake = 0 or rake = 90
                if (this.strikeDirection === Direction.UND) {

                    if (this.rake === 0) {
                        // Calculate the angle alphaStria for rake = 0 and rake = 90 in the local reference frame
                        this.calcAlphaStriationRake_0_Sd_UND()
                    }
                    else if (this.rake === 90) {
                        // Calculate the angle alphaStria for rake = 90 and rake = 90 in the local reference frame
                        this.calcAlphaStriationRake_90_Sd_UND()
                    }
                    else {
                        // 0 < rake : this case is studied elsewhere; In principle, the program should not reach this line
                        throw new Error(`Error in faultStriationAngle_A: rake is not in interval [0,90]`)
                    }
                }
                else {
                    // The strike direction is a geographic direction that must be consistently defined relative to the strike
                    // Check the strike direction and calculate the angle alphaStria in the local reference frame
                    this.checkStrikeDir_CalcAlphaStria()
                }
            }

        } else if (this.dip === 90) {
            // The plane is vertical

            if (this.rake > 0 && this.rake < 90) {
                // The strike direction is a geographic direction that must be consistently defined relative to the strike
                // Check the strike direction and calculate the angle alphaStria in the local reference frame
                this.checkStrikeDir_CalcAlphaStria_vp()

            }
            else if (this.rake === 0) {
                // The rake = 0 

                if (this.strikeDirection === Direction.UND) {
                    // The strike direction is undefined: calculate the angle alphaStria in the local reference frame
                    this.calcAlphaStriationRake_0_Sd_UND()

                } else {
                    // The strike direction is a geographic direction: Check the strike direction and calculate the angle alphaStria in the local reference frame
                    this.checkStrikeDir_CalcAlphaStria_vp()
                }

            }
            else {
                // The plane and striation are vertical (rake = 90): this case is studied elsewhere; In principle, the program should not reach this line
                throw new Error(`Error in faultStriationAngle_A: analysis of striation data for a vertical plane and striation should be done in setStriationForVerticalPlaneAndRake`)

            }

        } else {
            // The dip =0 : this case is studied elsewhere; In principle, the program should not reach this line
            throw new Error(`Error in faultStriationAngle_A: analysis of striation data for a horizontal plane should be done in setStriationFromTrend`)
        }
    }

    private checkStrikeDir_CalcAlphaStria(): void {
        // The fault plane and striation are oblique: 0 < dip < 90; 0 < rake < 90
        // Thus, the plane is not vertical (nor horizontal) and the strike direction is a geographic direction that must be consistently defined relative to the strike

        // This function checks the strike direction and calculates the angle alphaStria in the local reference frame

        if (this.strike === 0) {
            if (this.dipDirection === Direction.E) {
                if (this.strikeDirection === Direction.N) {
                    this.alphaStriaDeg = this.rake          // For testing the type of mouvement of faults 
                    this.alphaStria = deg2rad(this.rake)
                } else if (this.strikeDirection === Direction.S) {
                    this.alphaStriaDeg = 180 - this.rake    // For testing the type of mouvement of faults
                    this.alphaStria = Math.PI - deg2rad(this.rake)
                } else {
                    throw new Error(`Strike direction for measuring the rake is wrong. Should be N or S`)
                }
            } else if (this.dipDirection === Direction.W) {
                if (this.strikeDirection === Direction.N) {
                    this.alphaStriaDeg = 180 - this.rake
                    this.alphaStria = Math.PI - deg2rad(this.rake)
                } else if (this.strikeDirection === Direction.S) {
                    this.alphaStriaDeg = this.rake
                    this.alphaStria = deg2rad(this.rake)
                } else {
                    throw new Error(`Strike direction for measuring the rake is wrong. Should be N or S`)
                }
            } else {
                throw new Error(`dip direction is wrong. Should be E or W. Got ${CDirection.fromType(this.dipDirection)}`)
            }
        } else if (this.strike < 90) {
            if ((this.dipDirection === Direction.S) || (this.dipDirection === Direction.E) || (this.dipDirection === Direction.SE)) {
                if ((this.strikeDirection === Direction.N) || (this.strikeDirection === Direction.E) || (this.strikeDirection === Direction.NE)) {
                    this.alphaStriaDeg = this.rake
                    this.alphaStria = deg2rad(this.rake)
                } else if ((this.strikeDirection === Direction.S) || (this.strikeDirection === Direction.W) || (this.strikeDirection === Direction.SW)) {
                    this.alphaStriaDeg = 180 - this.rake
                    this.alphaStria = Math.PI - deg2rad(this.rake)
                } else {
                    throw new Error(`Strike direction for measuring the rake is wrong. Should be N, S, E, W, NE or SW. Got ${this.strikeDirection}`)
                }
            } else if ((this.dipDirection === Direction.N) || (this.dipDirection === Direction.W) || (this.dipDirection === Direction.NW)) {
                if ((this.strikeDirection === Direction.N) || (this.strikeDirection === Direction.E) || (this.strikeDirection === Direction.NE)) {
                    this.alphaStriaDeg = 180 - this.rake
                    this.alphaStria = Math.PI - deg2rad(this.rake)
                } else if ((this.strikeDirection === Direction.S) || (this.strikeDirection === Direction.W) || (this.strikeDirection === Direction.SW)) {
                    this.alphaStriaDeg = this.rake
                    this.alphaStria = deg2rad(this.rake)
                } else {
                    throw new Error(`Strike direction for measuring the rake is wrong. Should be  N, S, E, W, NE or SW`)
                }
            } else {
                throw new Error(`dip direction is wrong. Should be N, S, E, W, SE or NW. Got ${CDirection.fromType(this.dipDirection)}`)
            }
        } else if (this.strike === 90) {

            if (this.dipDirection === Direction.S) {
                if (this.strikeDirection === Direction.E) {
                    this.alphaStriaDeg = this.rake
                    this.alphaStria = deg2rad(this.rake)
                } else if (this.strikeDirection === Direction.W) {
                    this.alphaStriaDeg = 180 - this.rake
                    this.alphaStria = Math.PI - deg2rad(this.rake)
                } else {
                    throw new Error(`Strike direction for measuring the rake is wrong. Should be E or W`)
                }
            } else if (this.dipDirection === Direction.N) {
                if (this.strikeDirection === Direction.E) {
                    this.alphaStriaDeg = 180 - this.rake
                    this.alphaStria = Math.PI - deg2rad(this.rake)
                } else if (this.strikeDirection === Direction.W) {
                    this.alphaStriaDeg = this.rake
                    this.alphaStria = deg2rad(this.rake)
                } else {
                    throw new Error(`Strike direction for measuring the rake is wrong. Should be E or W`)
                }
            } else {
                throw new Error(`dip direction is wrong. Should be N or S. Got ${CDirection.fromType(this.dipDirection)}`)
            }
        } else if (this.strike < 180) {

            if ((this.dipDirection === Direction.S) || (this.dipDirection === Direction.W) || (this.dipDirection === Direction.SW)) {
                if ((this.strikeDirection === Direction.S) || (this.strikeDirection === Direction.E) || (this.strikeDirection === Direction.SE)) {
                    this.alphaStriaDeg = this.rake
                    this.alphaStria = deg2rad(this.rake)
                } else if ((this.strikeDirection === Direction.N) || (this.strikeDirection === Direction.W) || (this.strikeDirection === Direction.NW)) {
                    this.alphaStriaDeg = 180 - this.rake
                    this.alphaStria = Math.PI - deg2rad(this.rake)
                } else {
                    throw new Error(`Strike direction for measuring the rake is wrong. Should be N, S, E, W, SE or NW `)
                }
            } else if ((this.dipDirection === Direction.N) || (this.dipDirection === Direction.E) || (this.dipDirection === Direction.NE)) {
                if ((this.strikeDirection === Direction.S) || (this.strikeDirection === Direction.E) || (this.strikeDirection === Direction.SE)) {
                    this.alphaStriaDeg = 180 - this.rake
                    this.alphaStria = Math.PI - deg2rad(this.rake)
                } else if ((this.strikeDirection === Direction.N) || (this.strikeDirection === Direction.W) || (this.strikeDirection === Direction.NW)) {
                    this.alphaStriaDeg = this.rake
                    this.alphaStria = deg2rad(this.rake)
                } else {
                    throw new Error(`Strike direction for measuring the rake is wrong. Should be N, S, E, W, SE or NW `)
                }
            } else {
                throw new Error(`dip direction is wrong. Should be N, S, E, W, SW or NE. Got ${CDirection.fromType(this.dipDirection)}`)
            }
        } else if (this.strike === 180) {

            if (this.dipDirection === Direction.W) {
                if (this.strikeDirection === Direction.S) {
                    this.alphaStriaDeg = this.rake
                    this.alphaStria = deg2rad(this.rake)
                } else if (this.strikeDirection === Direction.N) {
                    this.alphaStriaDeg = 180 - this.rake
                    this.alphaStria = Math.PI - deg2rad(this.rake)
                } else {
                    throw new Error(`Strike direction for measuring the rake is wrong. Should be N or S`)
                }
            } else if (this.dipDirection === Direction.E) {
                if (this.strikeDirection === Direction.S) {
                    this.alphaStriaDeg = 180 - this.rake
                    this.alphaStria = Math.PI - deg2rad(this.rake)
                } else if (this.strikeDirection === Direction.N) {
                    this.alphaStriaDeg = this.rake
                    this.alphaStria = deg2rad(this.rake)
                } else {
                    throw new Error(`Strike direction for measuring the rake is wrong. Should be N or S`)
                }
            } else {
                throw new Error(`dip direction is wrong. Should be E or W. Got ${CDirection.fromType(this.dipDirection)}`)
            }
        } else if (this.strike < 270) {

            if ((this.dipDirection === Direction.N) || (this.dipDirection === Direction.W) || (this.dipDirection === Direction.NW)) {
                if ((this.strikeDirection === Direction.S) || (this.strikeDirection === Direction.W) || (this.strikeDirection === Direction.SW)) {
                    this.alphaStriaDeg = this.rake
                    this.alphaStria = deg2rad(this.rake)
                } else if ((this.strikeDirection === Direction.N) || (this.strikeDirection === Direction.E) || (this.strikeDirection === Direction.NE)) {
                    this.alphaStriaDeg = 180 - this.rake
                    this.alphaStria = Math.PI - deg2rad(this.rake)
                } else {
                    throw new Error(`Strike direction for measuring the rake is wrong. Should be N, S, E, W, SW or NE `)
                }
            } else if ((this.dipDirection === Direction.S) || (this.dipDirection === Direction.E) || (this.dipDirection === Direction.SE)) {
                if ((this.strikeDirection === Direction.S) || (this.strikeDirection === Direction.W) || (this.strikeDirection === Direction.SW)) {
                    this.alphaStriaDeg = 180 - this.rake
                    this.alphaStria = Math.PI - deg2rad(this.rake)
                } else if ((this.strikeDirection === Direction.N) || (this.strikeDirection === Direction.E) || (this.strikeDirection === Direction.NE)) {
                    this.alphaStriaDeg = this.rake
                    this.alphaStria = deg2rad(this.rake)
                } else {
                    throw new Error(`Strike direction for measuring the rake is wrong. Should be N, S, E, W, SW or NE `)
                }
            } else {
                throw new Error(`dip direction is wrong. Should be N, S, E, W, SE or NW. Got ${CDirection.fromType(this.dipDirection)}`)
            }
        } else if (this.strike === 270) {

            if (this.dipDirection === Direction.N) {
                if (this.strikeDirection === Direction.W) {
                    this.alphaStriaDeg = this.rake
                    this.alphaStria = deg2rad(this.rake)
                } else if (this.strikeDirection === Direction.E) {
                    this.alphaStriaDeg = 180 - this.rake
                    this.alphaStria = Math.PI - deg2rad(this.rake)
                } else {
                    throw new Error(`Strike direction for measuring the rake is wrong. Should be E or W`)
                }
            } else if (this.dipDirection === Direction.S) {
                if (this.strikeDirection === Direction.W) {
                    this.alphaStriaDeg = 180 - this.rake
                    this.alphaStria = Math.PI - deg2rad(this.rake)
                } else if (this.strikeDirection === Direction.E) {
                    this.alphaStriaDeg = this.rake
                    this.alphaStria = deg2rad(this.rake)
                } else {
                    throw new Error(`Strike direction for measuring the rake is wrong. Should be E or W`)
                }
            } else {
                throw new Error(`dip direction is wrong. Should be N or S. Got ${CDirection.fromType(this.dipDirection)}`)
            }
        } else if (this.strike < 360) {

            if ((this.dipDirection === Direction.N) || (this.dipDirection === Direction.E) || (this.dipDirection === Direction.NE)) {
                if ((this.strikeDirection === Direction.N) || (this.strikeDirection === Direction.W) || (this.strikeDirection === Direction.NW)) {
                    this.alphaStriaDeg = this.rake
                    this.alphaStria = deg2rad(this.rake)
                } else if ((this.strikeDirection === Direction.S) || (this.strikeDirection === Direction.E) || (this.strikeDirection === Direction.SE)) {
                    this.alphaStriaDeg = 180 - this.rake
                    this.alphaStria = Math.PI - deg2rad(this.rake)
                } else {
                    throw new Error(`Strike direction for measuring the rake is wrong. Should be N, S, E, W, NW or SE `)
                }
            } else if ((this.dipDirection === Direction.S) || (this.dipDirection === Direction.W) || (this.dipDirection === Direction.SW)) {
                if ((this.strikeDirection === Direction.N) || (this.strikeDirection === Direction.W) || (this.strikeDirection === Direction.NW)) {
                    this.alphaStriaDeg = 180 - this.rake
                    this.alphaStria = Math.PI - deg2rad(this.rake)
                } else if ((this.strikeDirection === Direction.S) || (this.strikeDirection === Direction.E) || (this.strikeDirection === Direction.SE)) {
                    this.alphaStriaDeg = this.rake
                    this.alphaStria = deg2rad(this.rake)
                } else {
                    throw new Error(`Strike direction for measuring the rake is wrong. Should be N, S, E, W, NW or SE `)
                }
            } else {
                throw new Error(`dip direction is wrong. Should be N, S, E, W, NE or SW. Got ${CDirection.fromType(this.dipDirection)}`)
            }
        } else if (this.strike === 360) {
            // This case should not occur since in principle strike < 360
            if (this.dipDirection === Direction.E) {
                if (this.strikeDirection === Direction.N) {
                    this.alphaStriaDeg = this.rake
                    this.alphaStria = deg2rad(this.rake)
                } else if (this.strikeDirection === Direction.S) {
                    this.alphaStriaDeg = 180 - this.rake
                    this.alphaStria = Math.PI - deg2rad(this.rake)
                } else {
                    throw new Error(`Strike direction for measuring the rake is wrong. Should be N or S`)
                }
            } else if (this.dipDirection === Direction.W) {
                if (this.strikeDirection === Direction.N) {
                    this.alphaStriaDeg = 180 - this.rake
                    this.alphaStria = Math.PI - deg2rad(this.rake)
                } else if (this.strikeDirection === Direction.S) {
                    this.alphaStriaDeg = this.rake
                    this.alphaStria = deg2rad(this.rake)
                } else {
                    throw new Error(`Strike direction for measuring the rake is wrong. Should be N or S`)
                }
            } else {
                throw new Error(`dip direction is wrong. Should be E or W. Got ${CDirection.fromType(this.dipDirection)}`)
            }
        } else {
            throw new Error(`fault strike is out of the expected interval [0,360)`)

        }
    }

    private calcAlphaStriationRake_0_Sd_UND(): void {
        // Consider an oblique or vertical fault plane, such that the striation is horizontal, and the strike direction is undefined: 
        //      0 < dip ; rake = 0; strikeDirection = Direction.UND
        //      If the strike direction is undefined (UND), then there is no need to check the geographic direction

        // This function calculates the angle alphaStria in the local reference frame

        // rake = 0 and strike direction = UND 
        // In this particular case, the orientation of the striation angle is 0 (this value may be modified in method faultStriationAngle_B depending on the type of movement)
        this.alphaStriaDeg = 0
        this.alphaStria = 0
    }

    private calcAlphaStriationRake_90_Sd_UND(): void {
        // Consider an oblique or vertical fault plane, such that the striation is perpendicular to the strike, and the strike direction is undefined: 
        //      0 < dip ; rake = 90; strikeDirection = Direction.UND
        //      If the strike direction is undefined (UND), then there is no need to check the geographic direction

        // This function calculates the angle alphaStria in the local reference frame

        // rake = 90 and strike direction = UND 
        // In this particular case, the orientation of the striation angle is PI / 2 (this value may be modified in method faultStriationAngle_B depending on the type of movement)
        this.alphaStriaDeg = 90
        this.alphaStria = Math.PI / 2
    }

    private checkStrikeDir_CalcAlphaStria_vp(): void {
        // The fault plane is vertical, the striation is oblique or horizontal and the strike direction is a geographic direction
        //      dip = 90 ; rake < 90; strikeDirection is an element of set (E, W, N, S, NE, SE, SW, NW)
        // Note that the strike direction is a geographic direction that must be consistently defined relative to the strike
        // This method checks the strike direction and calculates the angle alphaStria in the local reference frame

        if (this.strike === 0) {
            // phi = PI
            if (this.strikeDirection === Direction.N) {
                this.alphaStriaDeg = 180 - this.rake
                this.alphaStria = Math.PI - deg2rad(this.rake)
            } else if (this.strikeDirection === Direction.S) {
                this.alphaStriaDeg = this.rake
                this.alphaStria = deg2rad(this.rake)
            } else {
                // If the rake =/= 90 then the strike direction is N or S
                throw new Error(`Strike direction for measuring the rake is wrong. Should be N or S`)
            }
        } else if (this.strike < 90) {
            // phi = PI - strike
            if ((this.strikeDirection === Direction.N) || (this.strikeDirection === Direction.E) || (this.strikeDirection === Direction.NE)) {
                this.alphaStriaDeg = 180 - this.rake
                this.alphaStria = Math.PI - deg2rad(this.rake)
            } else if ((this.strikeDirection === Direction.S) || (this.strikeDirection === Direction.W) || (this.strikeDirection === Direction.SW)) {
                this.alphaStriaDeg = this.rake
                this.alphaStria = deg2rad(this.rake)
            } else {
                throw new Error(`Strike direction for measuring the rake is wrong. Should be  N, S, E, W, NE or SW`)
            }
        } else if (this.strike === 90) {
            // phi = PI/2
            if (this.strikeDirection === Direction.E) {
                this.alphaStriaDeg = 180 - this.rake
                this.alphaStria = Math.PI - deg2rad(this.rake)
            } else if (this.strikeDirection === Direction.W) {
                this.alphaStriaDeg = this.rake
                this.alphaStria = deg2rad(this.rake)
            } else {
                throw new Error(`Strike direction for measuring the rake is wrong. Should be E, or W`)
            }
        } else if (this.strike < 180) {
            // phi = PI - strike
            if ((this.strikeDirection === Direction.S) || (this.strikeDirection === Direction.E) || (this.strikeDirection === Direction.SE)) {
                this.alphaStriaDeg = 180 - this.rake
                this.alphaStria = Math.PI - deg2rad(this.rake)
            } else if ((this.strikeDirection === Direction.N) || (this.strikeDirection === Direction.W) || (this.strikeDirection === Direction.NW)) {
                this.alphaStriaDeg = this.rake
                this.alphaStria = deg2rad(this.rake)
            } else {
                throw new Error(`Strike direction for measuring the rake is wrong. Should be N, S, E, W, SE or NW `)
            }
        } else if (this.strike === 180) {
            // phi = 0
            if (this.strikeDirection === Direction.S) {
                this.alphaStriaDeg = 180 - this.rake
                this.alphaStria = Math.PI - deg2rad(this.rake)
            } else if (this.strikeDirection === Direction.N) {
                this.alphaStriaDeg = this.rake
                this.alphaStria = deg2rad(this.rake)
            } else {
                throw new Error(`Strike direction for measuring the rake is wrong. Should be N or S`)
            }
        } else if (this.strike < 270) {
            // phi = 3 PI - strike
            if ((this.strikeDirection === Direction.S) || (this.strikeDirection === Direction.W) || (this.strikeDirection === Direction.SW)) {
                this.alphaStriaDeg = 180 - this.rake
                this.alphaStria = Math.PI - deg2rad(this.rake)
            } else if ((this.strikeDirection === Direction.N) || (this.strikeDirection === Direction.E) || (this.strikeDirection === Direction.NE)) {
                this.alphaStriaDeg = this.rake
                this.alphaStria = deg2rad(this.rake)
            } else {
                throw new Error(`Strike direction for measuring the rake is wrong. Should be N, S, E, W, SW or NE `)
            }
        } else if (this.strike === 270) {
            // phi = 3 PI / 2
            if (this.strikeDirection === Direction.W) {
                this.alphaStriaDeg = 180 - this.rake
                this.alphaStria = Math.PI - deg2rad(this.rake)
            } else if (this.strikeDirection === Direction.E) {
                this.alphaStriaDeg = this.rake
                this.alphaStria = deg2rad(this.rake)
            } else {
                throw new Error(`Strike direction for measuring the rake is wrong. Should be E or W`)
            }
        } else if (this.strike < 360) {
            // phi = 3 PI - strike
            if ((this.strikeDirection === Direction.N) || (this.strikeDirection === Direction.W) || (this.strikeDirection === Direction.NW)) {
                this.alphaStriaDeg = 180 - this.rake
                this.alphaStria = Math.PI - deg2rad(this.rake)
            } else if ((this.strikeDirection === Direction.S) || (this.strikeDirection === Direction.E) || (this.strikeDirection === Direction.SE)) {
                this.alphaStriaDeg = this.rake
                this.alphaStria = deg2rad(this.rake)
            } else {
                throw new Error(`Strike direction for measuring the rake is wrong. Should be N, S, E, W, NW or SE `)
            }
        } else if (this.strike === 360) {
            // This case should not occur since in principle strike < 360
            // phi = PI
            if (this.strikeDirection === Direction.N) {
                this.alphaStriaDeg = 180 - this.rake
                this.alphaStria = Math.PI - deg2rad(this.rake)
            } else if (this.strikeDirection === Direction.S) {
                this.alphaStriaDeg = this.rake
                this.alphaStria = deg2rad(this.rake)
            } else {
                throw new Error(`Strike direction for measuring the rake is wrong. Should be N or S`)
            }
        } else {
            // This case should not occur since in principle strike < 360
            throw new Error(`fault strike is out of the expected interval [0,360)`)
        }
    }

    private faultStriationAngle_B(): void {
        // Function introducuing the effect of fault movement on the striation angle
        // This function is called after function faultStriationAngle_A
        // We calculate a unit vector e_striation pointing toward the measured striation

        // Type of mouvement: For verification purposes, it is recommended to indicate both the dip-slip and strike-slip compoenents, when possible. 
        //      Dip-slip component:
        //          N = Normal fault, 
        //          I = Inverse fault or thrust
        //      Strike-slip componenet:
        //          RL = Right-Lateral fault
        //          LL = Left-Lateral fault

        // Type of mouvement: N, I, RL, LL, N-RL, N-LL, I-RL, I-LL

        // this.alphaStriaDeg is in interval [0,180] according to function faultStriationAngle_A; 
        // This angle indicates the mouvement of the top (outward) block relative to the bottom (inner) block 

        // 'if structure' that modifies when required the striation angle according to the type of mouvement of faults:

        if (this.dip === 90) {
            // The fault plane is vertical and only the strike-slip component of motion is defined
            // alphaStriaDeg calculated in function faultStriationAngle_B is in interval [0,PI]

            if ((this.alphaStriaDeg >= 0) && (this.alphaStriaDeg < 90)) {
                // alphaStriaDeg has a left-lateral strike-slip component 
                if (this.typeMov === TypeOfMovement.RL) {
                    // Fault movement is oriented opposite to the present value of the striation angle
                    this.alphaStriaDeg += 180
                    this.alphaStria += Math.PI
                } else if (this.typeMov != TypeOfMovement.LL) {
                    throw new Error(`type of mouvement is not consistent with fault data. Should be RL or LL`)
                }
            } else if (this.alphaStriaDeg === 90) {   // Pure dip-slip mouvement
                // Note that if alphaStriaDeg = 90 then the fault only has a dip-slip component and the direction of the uplifted block is requested 
                // In principle this code line is never reached since this special case is treated in method setStriationForVerticalPlaneAndRake,
                // which is called in method create()
                this.faultStriationUpliftedBlock()

            } else if (this.alphaStriaDeg <= 180) {
                // 90 < alphaStriaDeg <= 180 means that the fault is normal-right-lateral
                if (this.typeMov === TypeOfMovement.LL) {
                    // Fault movement is oriented opposite to the present value of the striation angle
                    this.alphaStriaDeg += 180
                    this.alphaStria += Math.PI
                } else if (this.typeMov != TypeOfMovement.RL) {
                    throw new Error(`type of mouvement is not consistent with fault data. Should be RL or LL`)
                }
            } else {
                throw new Error(`calculated striation alphaStriaDeg should be in interval [0,180]. Check routine faultStriationAngle_A`)
            }

        } else {      // The fault plane is not vertical and both strike-slip and dip-slip components of motion are defined

            if (this.alphaStriaDeg === 0) {   // Pure strike-slip mouvement
                // alphaStriaDeg = 0 means that the fault is left-lateral
                if (this.typeMov === TypeOfMovement.RL) {
                    // Fault movement is oriented opposite to the present value of the striation angle
                    this.alphaStriaDeg = 180        // Striation values are recalculated
                    this.alphaStria = Math.PI
                } else if (this.typeMov != TypeOfMovement.LL) {
                    throw new Error(`type of mouvement is not consistent with fault data. Should be RL or LL`)
                }
            } else if (this.alphaStriaDeg < 90) {   // Strike-slip and dip slip mouvement
                // 0 < alphaStriaDeg < 90 means that the fault is normal-left-lateral
                if ((this.typeMov === TypeOfMovement.RL) || (this.typeMov === TypeOfMovement.I) || (this.typeMov === TypeOfMovement.I_RL)) {
                    this.alphaStriaDeg += 180
                    this.alphaStria += Math.PI
                } else if ((this.typeMov !== TypeOfMovement.LL) && (this.typeMov !== TypeOfMovement.N) && (this.typeMov !== TypeOfMovement.N_LL)) {
                    throw new Error(`type of mouvement is not consistent with fault data. Should be LL or N or N-LL or RL or I or I-RL`)
                }
            } else if (this.alphaStriaDeg === 90) {   // Pure dip-slip mouvement
                // alphaStriaDeg = 90 means that the fault is normal
                if (this.typeMov === TypeOfMovement.I) {
                    // Fault movement is oriented opposite to the present value of the striation angle
                    this.alphaStriaDeg = 270        // Striation values are recalculated
                    this.alphaStria = 3 * Math.PI / 2
                } else if (this.typeMov != TypeOfMovement.N) {
                    throw new Error(`type of mouvement is not consistent with fault data. Should be N or I`)
                }
            } else if (this.alphaStriaDeg < 180) {   // Strike-slip and dip slip mouvement
                // 90 < alphaStriaDeg < 180 means that the fault is normal-right-lateral
                if ((this.typeMov === TypeOfMovement.LL) || (this.typeMov === TypeOfMovement.I) || (this.typeMov === TypeOfMovement.I_LL)) {
                    this.alphaStriaDeg += 180
                    this.alphaStria += Math.PI
                } else if ((this.typeMov !== TypeOfMovement.RL) && (this.typeMov !== TypeOfMovement.N) && (this.typeMov === TypeOfMovement.N_RL)) {
                    throw new Error(`type of mouvement is not consistent with fault data. Should be LL or I or I-LL or RL or N or N-RL`)
                }
            } else if (this.alphaStriaDeg === 180) {   // Pure strike-slip mouvement
                // alphaStriaDeg = 180 means that the fault is right-lateral
                if (this.typeMov === TypeOfMovement.LL) {
                    // Fault movement is oriented opposite to the present value of the striation angle
                    this.alphaStriaDeg = 0        // Striation values are recalculated
                    this.alphaStria = 0
                } else if (this.typeMov != TypeOfMovement.RL) {
                    throw new Error(`type of mouvement is not consistent with fault data. Should be RL or LL`)
                }
            } else {
                throw new Error(`calculated striation alphaStriaDeg should be in interval [0,180]. Check routine faultStriationAngle_A`)
            }
        }

        // Calculate in reference system S the unit vector e_striation pointing toward the measured striation BB
        this.e_striation_[0] = Math.cos(this.alphaStria) * this.e_phi[0] + Math.sin(this.alphaStria) * this.e_theta[0]
        this.e_striation_[1] = Math.cos(this.alphaStria) * this.e_phi[1] + Math.sin(this.alphaStria) * this.e_theta[1]
        this.e_striation_[2] = Math.cos(this.alphaStria) * this.e_phi[2] + Math.sin(this.alphaStria) * this.e_theta[2]

        // Calculate in reference system S the unit vector e_perp_striation_ located on the fault plane and perpendicular to the striation.
        // This vector is necessary for calculating the misfit angle for criteria involving friction.
        // The local coord system (e_striation_, e_perp_striation_, normal) is right handed
        this.e_perp_striation_ = crossProduct({ U: this.normal, V: this.e_striation_ })  // .normal or this.normal_
    }

    private faultStriationUpliftedBlock(): void {
        //  Special case: The fault plane is vertical and the rake is 90°: this.dip = 90, this.rake = 90, this.alphaStriaDeg = 90

        // This method is currently replaced by method setStriationForVerticalPlaneAndRake, which is specific to this special case,
        // in which the dip direction has a different meaning: it points toward the uplifted block.

        // Nevertheless, method faultStriationUpliftedBlock, which cas called in faultStriationAngle_B, works properly.

        // To calculate the orientation of the striation the user must specify an additional parameter indicating the direction of the uplifted block:
        // Thus, in this special case the dip direction is interpreted differently and points toward the uplifted block
        //      dipDirection: (N, E, S, W) or a combination of two directions (NE, SE, SW, NW)

        if (this.strike === 0) {

            if (this.dipDirection === Direction.W) {
                this.alphaStriaDeg = 270
                this.alphaStria = 3 * Math.PI / 2
            } else if (this.dipDirection !== Direction.E) {
                throw new Error(`The orientation of the uplifted block is wrong. Should be E or W`)
            }

        } else if (this.strike < 90) {

            if ((this.dipDirection === Direction.N) || (this.dipDirection === Direction.W) || (this.dipDirection === Direction.NW)) {
                this.alphaStriaDeg = 270
                this.alphaStria = 3 * Math.PI / 2
            } else if ((this.dipDirection !== Direction.S) && (this.dipDirection !== Direction.E) && (this.dipDirection !== Direction.SE)) {
                throw new Error(`The orientation of the uplifted block is wrong. Should be N, S, E, W, SE or NW`)
            }

        } else if (this.strike === 90) {

            if (this.dipDirection === Direction.N) {
                this.alphaStriaDeg = 270
                this.alphaStria = 3 * Math.PI / 2
            } else if (this.dipDirection !== Direction.S) {
                throw new Error(`The orientation of the uplifted block is wrong. Should be N or S`)
            }

        } else if (this.strike < 180) {

            if ((this.dipDirection === Direction.N) || (this.dipDirection === Direction.E) || (this.dipDirection === Direction.NE)) {
                this.alphaStriaDeg = 270
                this.alphaStria = 3 * Math.PI / 2
            } else if ((this.dipDirection !== Direction.S) && (this.dipDirection !== Direction.W) && (this.dipDirection !== Direction.SW)) {
                throw new Error(`The orientation of the uplifted block is wrong. Should be N, S, E, W, NE or SW`)
            }

        } else if (this.strike === 180) {

            if (this.dipDirection === Direction.E) {
                this.alphaStriaDeg = 270
                this.alphaStria = 3 * Math.PI / 2
            } else if (this.dipDirection !== Direction.W) {
                throw new Error(`The orientation of the uplifted block is wrong. Should be E or W`)
            }

        } else if (this.strike < 270) {

            if ((this.dipDirection === Direction.S) || (this.dipDirection === Direction.E) || (this.dipDirection === Direction.SE)) {
                this.alphaStriaDeg = 270
                this.alphaStria = 3 * Math.PI / 2
            } else if ((this.dipDirection !== Direction.N) && (this.dipDirection !== Direction.W) && (this.dipDirection !== Direction.NW)) {
                throw new Error(`The orientation of the uplifted block is wrong. Should be N, S, E, W, SE or NW`)
            }

        } else if (this.strike === 270) {

            if (this.dipDirection === Direction.S) {
                this.alphaStriaDeg = 270
                this.alphaStria = 3 * Math.PI / 2
            } else if (this.dipDirection !== Direction.N) {
                throw new Error(`The orientation of the uplifted block is wrong. Should be N or S`)
            }

        } else if (this.strike < 360) {

            if ((this.dipDirection === Direction.S) || (this.dipDirection === Direction.W) || (this.dipDirection === Direction.SW)) {
                this.alphaStriaDeg = 270
                this.alphaStria = 3 * Math.PI / 2
            } else if ((this.dipDirection !== Direction.N) && (this.dipDirection !== Direction.E) && (this.dipDirection !== Direction.NE)) {
                throw new Error(`The orientation of the uplifted block is wrong. Should be N, S, E, W, NE or SW`)
            }

        } else if (this.strike === 360) {

            if (this.dipDirection === Direction.W) {
                this.alphaStriaDeg = 270
                this.alphaStria = 3 * Math.PI / 2
            } else if (this.dipDirection !== Direction.E) {
                throw new Error(`The orientation of the uplifted block is wrong. Should be E or W`)
            }

        } else {
            throw new Error(`fault strike is out of the expected interval [0,360)`)
        }
    }

    private faultSphericalCoordsSP() {
        // Calculate the spherical coordinates of the unit vector normal to the plane in reference system Sr

        // normalSp: unit vector normal to the fault plane (pointing upward) defined in the stress tensor reference system: 
        //          Sr = (Xr,Yr,Zr)=(sigma 1,sigma 3,sigma 2)
        // values should be recalculated for new stress tensors    

        // Let Rrot be the rotation tensor R between reference systems S and Sr, such that:
        //      Vr = R V,  where V and Vr are the same vector defined in reference frames S and Sr, respectively

        this.normalSp = tensor_x_Vector({ T: this.RTrot, V: this.normal })

        if (this.normalSp[0] > 0) {
            if (this.normalSp[1] >= 0) {
                // phiSp is in interval [0, Pi/2)
                this.coordinatesSp.phi = Math.atan(this.normalSp[1] / this.normalSp[0])
            } else {
                // phiSp is in interval (3Pi/2, 2Pi)
                // atan is probably defined in interval (-Pi/2, Pi/2)
                this.coordinatesSp.phi = 2 * Math.PI + Math.atan(this.normalSp[1] / this.normalSp[0])
            }
        } else if (this.normalSp[0] < 0) {
            if (this.normalSp[1] >= 0) {
                // phiSp is in interval (Pi/2, Pi]
                this.coordinatesSp.phi = Math.atan(this.normalSp[1] / this.normalSp[0]) + Math.PI
            } else {
                // phiSp is defined in interval [Pi, 3Pi/2)
                this.coordinatesSp.phi = Math.atan(this.normalSp[1] / this.normalSp[0]) + Math.PI
            }
        } else {
            if (this.normalSp[1] > 0) {
                // phiSp = Pi/2
                this.coordinatesSp.phi = Math.PI / 2
            } else {
                // phiSp = 3Pi/2
                this.coordinatesSp.phi = 3 * Math.PI / 2
            }
        }

    }

    private faultNormalVectorSp(): void {
        /**
         *  (phiSp,thetaSp) : spherical coordinate angles defining the unit vector perpendicular to the fault plane (pointing upward in system S)
         *               in the stress tensor reference system: Sr = (X,Y,Z) ('r' stands for 'rough' solution)
         *  These angles are recalculated from the new stress tensors
         */




    }

    /**
     * Rotate the tensor about an angle...
     * @param rotAx_phi 
     */
    private vector_rotation(rotAx_phi: number): void {
        throw 'TODO'
        // this.x = Math.sin( rotAx_phi);
    }




    // ------------------------------ variable members

    // Each fault is defined by a set of parameters as follows:
    //      The fault plane orientation is defined by three parameters:
    //      Fault strike: clockwise angle measured from the North direction [0, 360)
    //      Fault dip: [0, 90]
    //      Dip direction: (N, E, S, W) or a combination of two directions (NE, SE, SW, NW).
    private strike: number
    private dip: number
    private dipDirection: Direction

    private rake = 0
    private strikeDirection = Direction.UND
    private striationTrend = 0
    private nStriationTrend: Vector3 = [0, 0, 0]
    private nStriation: Vector3 = [0, 0, 0]
    // Type of mouvement: For verification purposes, it is recommended to indicate both the dip-slip and strike-slip compoenents, when possible. 
    //      Dip-slip component:
    //          N = Normal fault, 
    //          I = Inverse fault or thrust
    //      Strike-slip componenet:
    //          RL = Right-Lateral fault
    //          LL = Left-Lateral fault
    // Type of mouvement: N, I, RL, LL, N-RL, N-LL, I-RL, I-LL
    private typeMov = TypeOfMovement.UND

    // We define 2 orthonormal right-handed reference systems:
    //      S =  (X, Y, Z ) is the geographic reference frame oriented in (East, North, Up) directions.
    //      Sr = (Xr,Yr,Zr) is the principal stress reference frame, parallel to (sigma_1, sigma_3, sigma_2) ('r' stands for 'rough' solution);

    // (phi,theta) : spherical coordinate angles defining the unit vector perpendicular to the fault plane (pointing upward)
    //                 in reference system S
    // phi : azimuth phi in interval [0, 2 PI), measured anticlockwise from the X axis (East direction) in reference system S
    // theta: colatitude or polar angle in interval [0, PI/2], measured downward from the zenith (upward direction)
    private coordinates: SphericalCoords = new SphericalCoords()

    // private phi:    number      // constant value for each fault plane
    // private theta:  number      // constant value for each fault plane

    // normal: unit vector normal to the fault plane (pointing upward) defined in the geographic reference system S
    private normal_: Vector3 = newVector3D()       // constant values for each fault plane
    // (e_phi, e_theta) = unit vectors defining local reference frame tangent to the sphere in spherical coordinates
    private e_phi: Vector3 = newVector3D()
    private e_theta: Vector3 = newVector3D()

    // normalSp: unit vector normal to the fault plane (pointing upward) defined in the stress tensor reference system: Sr = (Xr,Yr,Zr)=(s1,s3,s2)
    private normalSp: Vector3 = newVector3D()       // values should be recalculated for new stress tensors
    // (phiSp,thetaSp) : spherical coordinate angles defining the unit vector perpendicular to the fault plane (pointing upward in system S)
    //                 in the stress tensor reference system: Sr = (Xr,Yr,Zr)
    // private phiSp:    number      // constant values for each fault plane
    // private thetaSp:  number      // values are recalculated for new stress tensors
    private coordinatesSp: SphericalCoords = new SphericalCoords()

    private RTrot: Matrix3x3 = newMatrix3x3()

    private alphaStriaDeg = 0
    private alphaStria = 0
    // e_striation_: unit vector in reference system S pointing toward the measured striation
    private e_striation_: Vector3 = newVector3D()

    // e_perp_striation_: unit vector in reference system S located in the fault plane and perpendicular to the measured striation
    private e_perp_striation_: Vector3 = newVector3D()

    private EPS: number = 1e-7;

    // striation: unit vector pointing toward the measured striation in the geographic reference system: S = (X,Y,Z)
    // private striation:      Vector3 = newVector3D()      // constant value for each fault plane

    /*
    // striationSp: unit vector pointing toward the measured striation in the stress tensor reference system: Sr = (Xr,Yr,Zr)
    private striationSp: Vector3 = newVector3D()     // values are recalculated for new stress tensors
    // stress: stress vector in the geographic reference system: S = (X,Y,Z)
    private stress: Vector3 = newVector3D()     // values are recalculated for new stress tensors
    // shearStressSp: shear stress vector in the geographic reference system: S = (X,Y,Z)
    private shearStress: Vector3 = newVector3D()

    private stressMag: number     // values are recalculated for new stress tensors
    private normalStress: number     // values are recalculated for new stress tensors
    private shearStressMag: number     // values are recalculated for new stress tensors

    // angularDifStriae: angular difference between the measured and calculated striations
    private angularDifStriae

    private upliftedBlock: Direction

    private isUpLiftedBlock: boolean = false
    */
}
