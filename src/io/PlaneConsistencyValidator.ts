import { fromAnglesToNormal } from '../types/fromAnglesToNormal';
import { Direction } from '../data/fault/types';

/**
 * Result of plane consistency validation
 */
export interface PlaneValidationResult {
    isValid: boolean;
    errorMessage?: string;
}

/**
 * Validates that plane parameters (strike, dip, dipDirection) are geometrically consistent
 * Uses fromAnglesToNormal which throws errors for invalid combinations
 */
export function validatePlaneConsistency(
    strike: number | undefined,
    dip: number | undefined,
    dipDirection: string | undefined,
    rowId: number | string
): PlaneValidationResult {
    
    // Check if required parameters are present
    if (strike === undefined || strike === null) {
        return {
            isValid: false,
            errorMessage: `Row ${rowId}: Strike is missing`
        };
    }

    if (dip === undefined || dip === null) {
        return {
            isValid: false,
            errorMessage: `Row ${rowId}: Dip is missing`
        };
    }

    // For non-vertical planes (dip < 90), dip direction is required
    if (dip < 90 && (!dipDirection || dipDirection.trim() === '')) {
        return {
            isValid: false,
            errorMessage: `Row ${rowId}: Dip direction is required for non-vertical planes (dip < 90)`
        };
    }

    // Convert string dipDirection to Direction enum
    let direction: Direction;
    
    if (dip === 90) {
        // Vertical planes don't need dip direction
        direction = Direction.UND; // Undefined
    } else {
        // Convert string to Direction enum
        const dirStr = dipDirection?.trim().toUpperCase();
        
        switch (dirStr) {
            case 'N': direction = Direction.N; break;
            case 'S': direction = Direction.S; break;
            case 'E': direction = Direction.E; break;
            case 'W': direction = Direction.W; break;
            case 'NE': direction = Direction.NE; break;
            case 'SE': direction = Direction.SE; break;
            case 'SW': direction = Direction.SW; break;
            case 'NW': direction = Direction.NW; break;
            default:
                return {
                    isValid: false,
                    errorMessage: `Row ${rowId}: Invalid dip direction '${dipDirection}'. Must be N, S, E, W, NE, SE, SW, or NW`
                };
        }
    }

    // Now try to calculate the normal vector using fromAnglesToNormal
    // If the combination is invalid, it will throw an error
    try {
        fromAnglesToNormal({ strike, dip, dipDirection: direction });
        
        // If we get here, the plane parameters are consistent
        return {
            isValid: true
        };
        
    } catch (error) {
        // The fromAnglesToNormal function detected an inconsistency
        return {
            isValid: false,
            errorMessage: `Row ${rowId}: Plane geometry is inconsistent - ${error.message}`
        };
    }
}