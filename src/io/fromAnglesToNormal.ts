import { deg2rad, spherical2unitVectorCartesian } from "../math/math"
import { SphericalCoords } from "../math/SphericalCoords"
import { Direction } from "./fault/types"

/**
 * @param parameters 
 */
export function fromAnglesToNormal({strike, dip, dipDirection}:{strike: number, dip: number, dipDirection: Direction}) {
    // Each fault is defined by a set of parameters as follows:
    //      The fault plane orientation is defined by three parameters:
    //      Fault strike: clockwise angle measured from the North direction [0, 360)
    //      Fault dip: [0, 90]
    //      Dip direction: (N, E, S, W) or a combination of two directions (NE, SE, SW, NW).

    // (phi,theta) : spherical coordinate angles defining the unit vector perpendicular to the fault plane (pointing upward)
    //                 in the geographic reference system: S = (X,Y,Z) = (E,N,Up)

    // phi : azimuthal angle in interval [0, 2 PI), measured anticlockwise from the X axis (East direction) in reference system S
    // theta: colatitude or polar angle in interval [0, PI/2], measured downward from the zenith (upward direction)

    //  Write functions relating trend and rake

    // The polar angle (or colatitude) theta is defined by the dip of the fault plane in radians:
    const coordinates = new SphericalCoords
    coordinates.theta = deg2rad( dip )

    // This function calculates the azimuth phi such that the right-handed local coordinate system in polar coordinates is located in the upper hemisphere.
    //      In other words, the radial unit vector is in the upper hemisphere.

    // The right-handed local reference system is specified by three unit vectors defined in the increasing radial, polar, and azimuthal directions (r, theta, and phi):
    //      The azimuthal angle phi is chosen in the direction of the fault dip (note that phi is different from the azimuth of the fault plane measured in the field) 
    //      The unit vector e_theta is parallel to the dip of the fault plane
    //      The unit vector e_phi is is parallel to the strike of the fault plane, and is oriented such that e_theta x e_phi = e_r (where x is the cross porduct )
    //      
    
    // The following 'if structure' calculates phi from the strike and dip direction of the fault plane:
    if ( dip=== 90 ) {
        // The fault plane is vertical and the dip direction is not defined
        if ( strike <= 180 ) {
            // phi is in interval [0,PI]
            coordinates.phi = Math.PI - deg2rad( strike )
        } else {
            // fault strike is in interval (PI,2 PI) and phi is in interval (PI,2 PI)
            coordinates.phi = 3 * Math.PI - deg2rad( strike )
        }
    }
    else if ( strike === 0 ) {    // The fault plane is not vertical and the dip direction is defined

        if ( dipDirection === Direction.E ) {
            coordinates.phi = 0
        } else if ( dipDirection === Direction.W ) {
            coordinates.phi = Math.PI
        } else {
            throw new Error(`dip direction is wrong. Should be E or W`)
        }
    } else if ( strike < 90 ){

        if ( ( dipDirection === Direction.S ) || ( dipDirection === Direction.E ) || ( dipDirection === Direction.SE ) ) {
            // strike + coordinates.phi = 2Pi
            coordinates.phi = 2 * Math.PI - deg2rad( strike ) 

        } else if ( ( dipDirection === Direction.N ) || ( dipDirection === Direction.W ) || ( dipDirection === Direction.NW ) ) {
            // strike + coordinates.phi = Pi
            coordinates.phi = Math.PI - deg2rad( strike ) 
        } else {
            throw new Error(`dip direction is wrong. Should be N, S, E, W, SE or NW`)
        }    
    } else if ( strike === 90 ) {
        if ( dipDirection === Direction.S ) {
            coordinates.phi = 3 * Math.PI / 2
        } else if ( dipDirection === Direction.N ) {
            coordinates.phi = Math.PI / 2
        } else {
            throw new Error(`dip direction is wrong. Should be N or S`)
        }
    } else if ( strike < 180 ){

        if ( ( dipDirection === Direction.S ) || ( dipDirection === Direction.W ) || ( dipDirection === Direction.SW ) ) {
            // strike + coordinates.phi = 2Pi
            coordinates.phi = 2 * Math.PI - deg2rad( strike ) 

        } else if ( ( dipDirection === Direction.N ) || ( dipDirection === Direction.E ) || ( dipDirection === Direction.NE ) ) {
            // strike + coordinates.phi = Pi
            coordinates.phi = Math.PI - deg2rad( strike ) 
        } else {
            throw new Error(`dip direction is wrong. Should be N, S, E, W, SE or NW`)
        }    
    }
    else if ( strike === 180 ) {
        if ( dipDirection === Direction.W ) {
            coordinates.phi = Math.PI
        } else if ( dipDirection === Direction.E ) {
            coordinates.phi = 0
        } else {
            throw new Error(`dip direction is wrong. Should be E or W`)
        }
    } else if ( strike < 270 ){

        if ( ( dipDirection === Direction.N ) || ( dipDirection === Direction.W ) || ( dipDirection === Direction.NW ) ) {
            // strike + coordinates.phi = 2Pi
            coordinates.phi = 2 * Math.PI - deg2rad( strike ) 

        } else if ( ( dipDirection === Direction.S ) || ( dipDirection === Direction.E ) || ( dipDirection === Direction.SE ) ) {
            // strike + coordinates.phi = 3Pi
            coordinates.phi = 3 * Math.PI - deg2rad( strike ) 

        } else {
            throw new Error(`dip direction is wrong. Should be N, S, E, W, NW or SE`)
        }    
    } else if ( strike === 270 ) {
        if ( dipDirection === Direction.S ) {
            coordinates.phi = 3 * Math.PI / 2
        } else if ( dipDirection === Direction.N ) {
            coordinates.phi = Math.PI / 2
        } else {
            throw new Error(`dip direction is wrong. Should be N or S`)
        }
    } else if ( strike < 360 ){

        if ( ( dipDirection === Direction.N ) || ( dipDirection === Direction.E ) || ( dipDirection === Direction.NE ) ) {
            // strike + coordinates.phi = 2Pi
            coordinates.phi = 2 * Math.PI - deg2rad( strike ) 

        } else if ( ( dipDirection === Direction.S ) || ( dipDirection === Direction.W ) || ( dipDirection === Direction.SW ) ) {
            // strike + coordinates.phi = 3Pi
            coordinates.phi = 3 * Math.PI - deg2rad( strike ) 

        } else {
            throw new Error(`dip direction is wrong. Should be N, S, E, W, NE or SW`)
        }
    }
    else if ( strike === 360 ) {
        if ( dipDirection === Direction.E ) {
            coordinates.phi = 0
        } else if ( dipDirection === Direction.W ) {
            coordinates.phi = Math.PI
        } else {
            throw new Error(`dip direction is wrong. Should be E or W`)
        }
    } else {
        throw new Error(`Strike is wrong. Should be in interval [0,360]`)
    }   

    // The fault plane is defined by angles (phi, theta) in spherical coordinates.
    // normal: unit vector normal to the fault plane (pointing upward) defined in the geographic reference system: S = (X,Y,Z)
    return spherical2unitVectorCartesian(coordinates)
}
