function trimAll(s: string): string {
    return s.toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();
}

/**
 * - DYNAMIC is related to forces (or stresses)
 * - KINEMATIC is related to displacement field
 * @category Data
 */
export enum StriatedPlaneProblemType {
    DYNAMIC,
    KINEMATIC
}

export type Plane = {
    strike: number,
    dip: number,
    dipDirection: Direction
}
export function createPlane(): Plane {
    return {
        strike: 0,
        dip: 0,
        dipDirection: Direction.UND
    }
}

export type Striation = {
    rake: number,
    strikeDirection: Direction,
    trendIsDefined: boolean
    trend: number,
    typeOfMovement: TypeOfMovement
}

export function createStriation(): Striation {
    return {
        rake: 0,
        strikeDirection: Direction.UND,
        trendIsDefined: true,
        trend: 0,
        typeOfMovement: TypeOfMovement.UND
    }
}

// ---------------------------------------------

export enum StrengthAngleType {
    Friction = 0,
    Sigma1,
    Undefined
}

export class CStrengthAngleType {
    static fromString(s: string): StrengthAngleType {
        switch (s) {
            case 'Friction': return StrengthAngleType.Friction
            case 'Sigma1': return StrengthAngleType.Sigma1
            case 'Undefined': return StrengthAngleType.Undefined
            default: throw `unknown strength angle type ${s}`
        }
    }

    static exists(s: string): boolean {
        if (s.length === 0) {
            return true
        }
        return CStrengthAngleType.isOk(CStrengthAngleType.fromString(s))
    }

    static isOk(d: StrengthAngleType): boolean {
        return d < angleTypes.length
    }
}

// ------------------------------------------------------------------------

export const enum StriationType {
    Riedel,
    PPlane,
    Calcite,
    Strilolyte
}
const striationTypes = ['riedel', 'pplane', 'calcite', 'strilolite']

export class CStriationType {
    static fromString(s: string): StriationType {
        switch (s) {
            case 'Riedel': return StriationType.Riedel
            case 'PPlane': return StriationType.PPlane
            case 'Calcite': return StriationType.Calcite
            case 'Strilolyte': return StriationType.Strilolyte
            default: throw `unknown striation type ${s}`
        }
    }

    static exists(s: string): boolean {
        if (s.length === 0) {
            return true
        }
        return CStriationType.isOk(CStriationType.fromString(s))
    }

    static isOk(d: StriationType): boolean {
        return d < striationTypes.length
    }
}

// ------------------------------------------------------------------------

/**
 * @category Data
 */
export const enum TypeOfMovement {
    N = 0,
    I,
    RL, // 2
    LL,
    N_RL, // 4
    N_LL,
    I_RL, // 6
    I_LL,
    UND, // 8
    ERROR
}
const mvts = ['N', 'I', 'RL', 'LL', 'N_RL', 'N_LL', 'I_RL', 'I_LL', 'UND']

/**
 * For the class name, 'C' stands for class
 * 
 * Usage
 * @code
 * CTypeOfMovement.exists('Right Lateral') // ok
 * @endcode
 * 
 * @category Data
 */
export class CTypeOfMovement {
    static exists(s: string): boolean {
        if (s.length === 0) {
            return true
        }
        return CTypeOfMovement.isOk(CTypeOfMovement.fromString(s))
    }

    static fromUserToInternal(name: string): string {
        const id = CTypeOfMovement.fromString(name)
        if (id >= mvts.length) {
            throw `Undefined type of movement ${name}`
        }
        return mvts[id]
    }

    static fromString(s: string): TypeOfMovement {
        const S = trimAll(s.replace('-', ' ').replace('_', ' ').toLowerCase())

        switch (S) {
            case 'normal':
            case 'n': return TypeOfMovement.N // 0

            case 'inverse':
            case 'reverse':
            case 'thrust':
            case 'i':
            case 'r': return TypeOfMovement.I

            case 'right lateral':
            case 'dextral':
            case 'rl':
            case 'd': return TypeOfMovement.RL // 2

            case 'left lateral':
            case 'sinistral':
            case 'll':
            case 's': return TypeOfMovement.LL

            case 'normal right lateral':
            case 'right lateral normal':
            case 'normal dextral':
            case 'dextral normal':
            case 'n rl':
            case 'rl n':
            case 'n d':
            case 'd n': return TypeOfMovement.N_RL // 4

            case 'normal left lateral':
            case 'left lateral normal':
            case 'normal sinistral':
            case 'sinistral normal':
            case 'n ll':
            case 'll n':
            case 'n s':
            case 's n': return TypeOfMovement.N_LL

            case 'inverse right lateral':
            case 'right lateral inverse':
            case 'inverse dextral':
            case 'dextral inverse':
            case 'reverse right lateral':
            case 'right lateral reverse':
            case 'reverse dextral':
            case 'dextral reverse':
            case 'i rl':
            case 'rl i':
            case 'i d':
            case 'd i':
            case 'r rl':
            case 'rl r':
            case 'r d':
            case 'd r': return TypeOfMovement.I_RL // 6

            case 'inverse left lateral':
            case 'left lateral inverse':
            case 'inverse sinistral':
            case 'sinistral inverse':
            case 'reverse left lateral':
            case 'left lateral reverse':
            case 'reverse sinistral':
            case 'sinistral reverse':
            case 'i ll':
            case 'll i':
            case 'i s':
            case 's i':
            case 'r ll':
            case 'll r':
            case 'r s':
            case 's r': return TypeOfMovement.I_LL

            case 'undefined':
            case 'undetermined':
            case 'unknown':
            case 'null':
            case '':
            case 'und': return TypeOfMovement.UND // 8
        }
    }

    static isOk(d: TypeOfMovement): boolean {
        return d < mvts.length
    }
}

// --------------------------------------------------------------------------


/**
 * @category Data
 */
export const enum Direction {
    E = "e", // 0
    W = "w", // 1
    N = "n", // 2
    S = "s", // 3
    NE = "ne", // 4
    SE = "se", // 5
    SW = "sw", // 6
    NW = "nw", // 7
    UND = "und",
    ERROR = "error"
}
const dirs = ['E', 'W', 'N', 'S', 'NE', 'SE', 'SW', 'NW', 'UND']

/**
 * For the class name, 'C' stands for class
 * @category Data
 */
export class CDirection {
    static exists(s: string): boolean {
        if (s.length === 0) {
            return true
        }
        return CDirection.isOk(CDirection.fromString(s))
    }

    static fromUserToInternal(name: string): string {
        const id = CDirection.fromString(name)
        if (id >= mvts.length) {
            throw `Undefined type of movement ${name}`
        }
        return mvts[id]
    }

    static isOk(d: Direction): boolean {
        return d < dirs.length
    }

    static fromType(t: Direction): string {
        return dirs[t]
    }

    static fromString(s: string): Direction {
        if (s.length === 0) {
            return Direction.UND
        }

        const S = s.replace('-', ' ').toLowerCase()

        switch (S) {
            case 'east':
            case 'e': return Direction.E

            case 'west':
            case 'w': return Direction.W

            case 'north':
            case 'n': return Direction.N

            case 'south':
            case 's': return Direction.S

            case 'north east':
            case 'ne': return Direction.NE

            case 'south east':
            case 'se': return Direction.SE

            case 'south west':
            case 'sw': return Direction.SW

            case 'north west':
            case 'nw': return Direction.NW

            default: return Direction.ERROR
        }
    }
}

// --------- Hidden --------------

const angleTypes = ['friction', 'sigma1']