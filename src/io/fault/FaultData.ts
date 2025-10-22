import { Vector3 } from "../../types"
import { assertNumberDefined, assertPropertyDefined, getDirection, getTypeOfMovement, isDirectionDefined, isNumberDefined, isPropertyDefined, isTypeOfMovementDefined } from "../../utils/assertJson"
import { DataStatus } from "../DataDescription"
import { CDirection, CTypeOfMovement, Direction, Plane, Striation, TypeOfMovement } from "./types"
import { StressData } from "../stress/StressData"

/**
 * @see HIERARCHY.md
 * @category Data
 */
export abstract class FaultData extends StressData {
    protected nStriation: Vector3 = undefined

    /**
     * Measured striation in the fault plane
     */
    get striationVector() {
        return this.nStriation
    }

    protected readStriatedFaultPlane(obj: Record<string, any>, plane: Plane, striation: Striation, result: DataStatus): void {
        assertNumberDefined(obj, 'strike')
        assertNumberDefined(obj, 'dip')
        plane.strike = obj.strike
        plane.dip = obj.dip

        // The dip direction is read after the rake
        // Why did we write this sentence ?

        if (isDirectionDefined(obj, 'dip direction')) {
            // The dip direction is defined 
            plane.dipDirection = getDirection(obj, 'dip direction')
        }
    
        // ----------------------
    
        // Check consistency of the rake and strike direction
    
        // In function createStriation, we suppose by default that the striation trend is defined: striation.trendIsDefined = true
    
        let strikeDirIsGeographicDir = false
        let strikeDirIsUND = false
        let strikeDirIsEmptySet = false
    
        if (!isPropertyDefined(obj, "rake") && !isPropertyDefined(obj, "striation trend")) {
            // The striation must be defined either by the rake or by the striation trend 
            result.status = false
            result.messages.push(`Data number ${obj.id}, striation parameters for ${obj.type}: please set either the rake or the striation trend`)
        } else if (isNumberDefined(obj, "rake") && isNumberDefined(obj, "striation trend")) {
            // The striation must be defined either by the rake or by the striation trend 
            result.status = false
            result.messages.push(`Data number ${obj.id}, striation parameters for ${obj.type}: please set either the rake or the striation trend, but not both`)
        } else if (isNumberDefined(obj, 'rake')) {
            // The rake is defined 
            striation.trendIsDefined = false
            striation.rake = obj.rake
    
            if (striation.rake < 0 || striation.rake > 90) {
                // The rake is not in interval [0,90]: in principle, this condition this condition has already been checked in DataDescription, checkRanges
                result.status = false
                result.messages.push(`Data number ${obj.id}, ${obj.type}, striation parameter: please set the rake in interval [0,90]`)
            }
    
            if (isDirectionDefined(obj, 'strike direction')) {
                // The strike direction is defined 
                striation.strikeDirection = getDirection(obj, 'strike direction')
    
                if (CDirection.isOk(striation.strikeDirection) === true) {
                    // The strike direction is a valid geographic direction: 'E', 'W', 'N', 'S', 'NE', 'SE', 'SW', 'NW'
                    //      i.e., strike direction is an element of set (E, W, N, S, NE, SE, SW, NW)
                    strikeDirIsGeographicDir = true
                }
                else if (striation.strikeDirection === Direction.UND) {
                    // The strike direction is undefined (UND) 
                    strikeDirIsUND = true
                }
                else {
                    // The strike direction is not a valid string 
                    result.status = false
                    result.messages.push(`Data number ${obj.id}, striation parameters for ${obj.type}: please set the strike direction from set (E, W, N, S, NE, SE, SW, NW, UND)`)
                }
            } else {
                // Strike direction is not defined (i.e., empty set)
                strikeDirIsEmptySet = true
            }
        } else {
            // The striation trend is defined
            striation.trendIsDefined = true
            assertPropertyDefined(obj, 'trend')
            striation.trend = obj.trend
        }
    
        if (plane.dip > 0 && plane.dip < 90) {
            // General situation: the striated plane is neither horizontal nor vertical
    
            if (isPropertyDefined(obj, 'rake')) { // The rake is defined
                striation.rake = obj.rake
    
                if (striation.rake > 0 && striation.rake < 90) {
                    // The the rake is in interval (0,90); thus, the striation is neither horizontal nor perpendicular to the strike 
                    // In this general situation, the strike direction must be a geographic direction, and not undefined ('UND') or not defined (empty set)
    
                    if (strikeDirIsEmptySet) {
                        // The strike direction cannot be the empty set
                        result.status = false
                        result.messages.push(`Data number ${obj.id}, ${obj.type}, striation parameter: the strike direction is not the empty string; please set a geographic direction for the strike direction`)
    
                    } else if (strikeDirIsUND) {
                        // The strike direction must be defined in terms of a geographic direction (i.e., it cannot be undefined - UND)
                        result.status = false
                        result.messages.push(`Data number ${obj.id}, ${obj.type}, striation parameter: the strike direction is not undefined (UND); please set a geographic direction from set (E, W, N, S, NE, SE, SW, NW)`)
    
                    } else if (!strikeDirIsGeographicDir) {
                        // The strike direction must be defined in terms of a geographic direction (E, W, N, S, NE, SE, SW, NW, UND)
                        // In principle this else if is never reached as the geographic direction has already been checked
                        result.status = false
                        result.messages.push(`Data number ${obj.id}, ${obj.type}, striation parameter: please set a geographic direction for the strike direction from set (E, W, N, S, NE, SE, SW, NW)`)
                    }
    
                } else if (striation.rake === 0 || striation.rake === 90) {
                    // If rake = 0 or rake = 90, then the strike direction can be either of three possibilities:
                    // An element from the geographic direction set, the undefined element (UND), or not defined (i.e. empty set)
                    // This condition for the strike direction has already been checked 
                }
            }
    
        }
        else if (plane.dip === 0) {
            // The plane is horizontal and the striation is defined by the striation trend and not the rake and strike direction
            if (!striation.trendIsDefined) {
                // The striation trend is not defined. Thus, the rake is defined, which is incorrect
                result.status = false
                result.messages.push(`Data number ${obj.id}, ${obj.type}, striation parameter: for a horizontal plane, please set the striation trend to indicate relative movement of the top block (and not the rake and strike direction)`)
            }
    
        }
        else if (plane.dip === 90) {
            // The plane is vertical and the striation is defined by the rake and (posibly the strike direction), and not the striation trend 
    
            if (striation.trendIsDefined) {
                // The rake must be defined and not the striation trend
                result.status = false
                result.messages.push(`Data number ${obj.id}, ${obj.type}, striation parameters: for a vertical plane, please set the rake and strike direction (cols 5, 6) and not the striation trend (col 7)`)
            } else {
                // The rake is defined
    
                if (striation.rake > 0 && striation.rake < 90) {
                    // The striation is not horizontal or vertical, i.e., the rake is in interval (0,90)
                    // Thus, the strike direction must be a geographic direction, and not undefined ('UND') or not defined (empty set)
    
                    if (strikeDirIsEmptySet) {
                        // The strike direction cannot be the empty set
                        result.status = false
                        result.messages.push(`Data number ${obj.id}, ${obj.type}, striation parameter: please set a geographic direction for the strike direction (col 6) from set (E, W, N, S, NE, SE, SW, NW)`)
    
                    } else if (strikeDirIsUND) {
                        // The strike direction must be defined in terms of a geographic direction (i.e., it cannot be undefined - UND)
                        result.status = false
                        result.messages.push(`Data number ${obj.id}, ${obj.type}, striation parameter: the strike direction (col 6) is not undefined (UND); please set a geographic direction from set (E, W, N, S, NE, SE, SW, NW)`)
    
                    } else if (!strikeDirIsGeographicDir) {
                        // The strike direction must be defined in terms of a geographic direction (E, W, N, S, NE, SE, SW, NW, UND)
                        // In principle this else if is never reached as the geographic direction has already been checked
                        result.status = false
                        result.messages.push(`Data number ${obj.id}, ${obj.type}, striation parameter: please set a geographic direction for the strike direction (col 6) from set (E, W, N, S, NE, SE, SW, NW)`)
                    }
                } else if (striation.rake === 0 || striation.rake === 90) {
                    // The striation is horizontal or vertical, i.e., the rake = 0 or 90, and the strike direction can be either of three possibilities:
                    // An element from the geographic direction set, the undefined element (UND), or not defined (i.e. empty set)
                    // This condition for strike direction has already been checked
                }
            }
        }
        else {
            // The plane dip is not in interval [0,90] (in principle this condition is already checked in ranges)
            result.status = false
            result.messages.push(`Data number ${obj.id}, ${obj.type}, plane parameter: please set the plane dip in interval [0,90] (col 3)`)
        }
    
        if (strikeDirIsEmptySet) {
            // Strike direction is not defined (i.e., empty set)
            // This value is equivalent to undefined (UND) in subsequent methods and functions (faultStriationAngle_A)
            striation.strikeDirection = Direction.UND
        }
    
        // ----------------------
    
        // Check consistency of the dip direction
    
        let dipDirIsGeographicDir = false
        let dipDirIsUND = false
        let dipDirIsEmptySet = false
    
        if (isDirectionDefined(obj, 'dip direction')) {
            // The dip direction is defined 
            plane.dipDirection = getDirection(obj, 'dip direction')
    
            if (CDirection.isOk(plane.dipDirection) === true) {
                // The dip direction is a valid geographic direction: 'E', 'W', 'N', 'S', 'NE', 'SE', 'SW', 'NW'
                //      i.e., strike direction is an element of set (E, W, N, S, NE, SE, SW, NW)
                dipDirIsGeographicDir = true
            }
            else if (plane.dipDirection === Direction.UND) {
                // The dip direction is undefined (UND) 
                dipDirIsUND = true
            }
            else {
                // The dip direction is not a valid string 
                result.status = false
                result.messages.push(`Data number ${obj.id}, ${obj.type}, plane parameters: please define the dip direction from set (E, W, N, S, NE, SE, SW, NW, UND)`)
            }
        } else {
            // dip direction is not defined (i.e., empty set)
            dipDirIsEmptySet = true
        }
    
        if (plane.dip > 0 && plane.dip < 90) {
            // General situation: the striated plane is neither horizontal nor vertical:
            // The dip direction must be defined in terms of a geographic direction (E, W, N, S, NE, SE, SW, NW)
    
            if (dipDirIsEmptySet) {
                // The dip direction cannot be the empty set
                result.status = false
                result.messages.push(`Data number ${obj.id}, ${obj.type}, plane parameter: the dip direction is not the empty string; please define the dip direction (col 4) from set (E, W, N, S, NE, SE, SW, NW)`)
    
            } else if (dipDirIsUND) {
                // The dip direction must be defined in terms of a geographic direction (i.e., it cannot be undefined - UND)
                result.status = false
                result.messages.push(`Data number ${obj.id}, ${obj.type}, plane parameter: the dip direction is not undefined (UND); please define the dip direction (col 4) from set (E, W, N, S, NE, SE, SW, NW)`)
    
            } else if (!dipDirIsGeographicDir) {
                // In principle this else if is never reached as the geographic direction has already been checked for the dip direction parameter
                result.status = false
                result.messages.push(`Data number ${obj.id}, ${obj.type}, plane parameter: please define the dip direction from set (E, W, N, S, NE, SE, SW, NW)`)
            }
    
        } else if (plane.dip === 0) {
            // The plane is horizontal
            // In this special situation, the dip direction can be either of three possibilities:
            // An element from the geographic direction set, the undefined element (UND), or not defined (i.e. empty set)
            // This condition for dip direction has already been checked
    
        } else if (plane.dip === 90) {
            // The plane is vertical and the rake (and not the striation trend) is defined in interval [0,90]
    
            if (striation.rake !== 90) {
                // The striation is not vertical, i.e., the rake is in interval [0,90)
                // In this special situation, the dip direction can be either of three possibilities:
                // An element from the geographic direction set, the undefined element (UND), or not defined (i.e. empty set)
                // This condition for dip direction has already been checked
    
            } else {
                // The plane and striation are vertical
                // In this special situation, THE DIP DIRECTION POINTS TOWARD THE UPLIFTED BLOCK. 
                // Thus, the dip direction is a geographic direction from set (E, W, N, S, NE, SE, SW, NW) and is not undefined (UND) or not defined (the empty set)
    
                if (!dipDirIsGeographicDir) {
                    result.status = false
                    result.messages.push(`Data number ${obj.id}, ${obj.type}, plane parameter: for a vertical plane with vertical striation, THE DIP DIRECTION POINTS TOWARD THE UPLIFTED BLOCK. Please define the dip direction (col 4) from set (E, W, N, S, NE, SE, SW, NW)`)
                }
            }
        }
    
        if (dipDirIsEmptySet) {
            // Dip direction is not defined (i.e., empty set)
            // This value is equivalent to undefined (UND) in subsequent methods and functions (FaultHelper)
            plane.dipDirection = Direction.UND
        }
    
        // ----------------------
    
        // Check consistency of the type of movement
    
        let typeOfMoveIsKinematicDir = false
        let typeOfMoveIsUND = false
        let typeOfMoveIsEmptySet = false
    
        if (isTypeOfMovementDefined(obj, 'type of movement')) {
            // The type of movement is defined 
            striation.typeOfMovement = getTypeOfMovement(obj, 'type of movement')
    
            if (CTypeOfMovement.isOk(striation.typeOfMovement)) {
                // The type of movement is a valid kinematic direction: 'I', 'I_LL', 'I_RL', 'LL', 'N', 'N_LL', 'N_RL', 'RL'
                //      i.e., type of movement is an element of set (I, I_LL, I_RL, LL, N, N_LL, N_RL, RL)
                typeOfMoveIsKinematicDir = true
            }
            else if (striation.typeOfMovement === TypeOfMovement.UND) {
                // The type of movement is undefined (UND) 
                typeOfMoveIsUND = true
            }
            else {
                // The type of movement is not a valid string 
                result.status = false
                result.messages.push(`Data number ${obj.id}, ${obj.type}, striation parameters: please set the type of movement from set (I, I_LL, I_RL, LL, N, N_LL, N_RL, RL, UND)`)
            }
        } else {
            // type of movement is not defined (i.e., empty set)
            typeOfMoveIsEmptySet = true
        }
    
        if (plane.dip > 0 && plane.dip < 90) {
            // General situation: the striated plane is neither horizontal nor vertical
            // The type of movement must be defined in terms of a valid kinematic direction: 'I', 'I_LL', 'I_RL', 'LL', 'N', 'N_LL', 'N_RL', 'RL'
    
            if (typeOfMoveIsEmptySet) {
                // The type of movement cannot be the empty set
                result.status = false
                result.messages.push(`Data number ${obj.id}, ${obj.type}, striation parameter: the type of movement is not the empty string; please set the type of movement from set (I, I_LL, I_RL, LL, N, N_LL, N_RL, RL, UND)`)
    
            } else if (typeOfMoveIsUND) {
                // The type of movement cannot be undefined (UND)
                result.status = false
                result.messages.push(`Data number ${obj.id}, ${obj.type}, striation parameter: the type of movement is not undefined (UND); please set the type of movement from set (I, I_LL, I_RL, LL, N, N_LL, N_RL, RL, UND)`)
    
            } else if (!typeOfMoveIsKinematicDir) {
                // The type of movement is an element of set (I, I_LL, I_RL, LL, N, N_LL, N_RL, RL)
                // In principle, this condition has already been checked
                result.status = false
                result.messages.push(`Data number ${obj.id}, ${obj.type}, striation parameter: please set a type of movement (col 8) from set (I, I_LL, I_RL, LL, N, N_LL, N_RL, RL)`)
            }
    
        } else if (plane.dip === 0) {
            // The plane is horizontal 
            // In this special situation, the type of movement is either undefined (UND) or not defined (the empty set)
    
            if (!typeOfMoveIsUND && !typeOfMoveIsEmptySet) {
                result.status = false
                result.messages.push(`Data number ${obj.id}, ${obj.type}, striation parameter: for a horizontal plane, please set the type of movement (col 8) as undefined (UND) or non defined (empty string)`)
            }
    
        } else if (plane.dip === 90) {
            // The plane is vertical
    
            if (striation.rake < 90) {
                // The striation is oblique and the type of movement is an element of set (I, I_LL, I_RL, LL, N, N_LL, N_RL, RL)
    
                if (!typeOfMoveIsKinematicDir) {
                    result.status = false
                    result.messages.push(`Data number ${obj.id}, ${obj.type}, striation parameter: please set a type of movement from set (I, I_LL, I_RL, LL, N, N_LL, N_RL, RL)`)
                }
    
            } else {
                // The plane and striation are vertical
                // In this special situation, the type of movement is either undefined (UND) or not defined (the empty set)
    
                if (!typeOfMoveIsUND && !typeOfMoveIsEmptySet) {
                    result.status = false
                    result.messages.push(`Data number ${obj.id}, ${obj.type}, striation parameter: for a vertical plane with vertical striation, please set the type of movement (col 8) as undefined (UND) or non defined (empty string)`)
                }
            }
        }
    
        if (typeOfMoveIsEmptySet) {
            // Type of movement is not defined (i.e., empty set)
            // This value is equivalent to undefined (UND) in subsequent methods and functions (FaultHelper)
            striation.typeOfMovement = TypeOfMovement.UND
        }
    
    }
    
}

export interface StriatedFaultData {
    id: number | string;
    
    // Plane geometry
    strike: number;
    dip: number;
    dipDirection: Direction;
    
    // Striation parameters
    rake: number;
    strikeDirection: Direction;
    typeOfMovement: TypeOfMovement;
    
    // Pre-calculated vectors (from FaultDataHelper)
    _planeVectors?: {
        n_plane: Vector3;      // Unit normal (upward)
        n_strike: Vector3;     // Unit vector along strike
        n_dip: Vector3;        // Unit vector along dip
        n_striation: Vector3;  // ← THE CORRECT STRIATION VECTOR!
        n_perp_striation: Vector3;
    };
}
