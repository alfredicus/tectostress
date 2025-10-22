/**
 * GeologicalDataValidator.ts
 * 
 * Validates geological data loaded from CSV files.
 * This function is called by CSVParsing.ts for each data row.
 */

import { fromAnglesToNormal } from './fromAnglesToNormal';
import { Direction } from './fault/types';
import { TypeSynonyms } from '../utils/TypeSynonyms';
import { calculatePlaneVectors } from '../math/math';

export function validateGeologicalData(dataType: string, row: Record<string, any>): {
    errors: string[];
    planeVectors?: {
        n_plane: { x: number; y: number; z: number };
        n_strike: { x: number; y: number; z: number };
        n_dip: { x: number; y: number; z: number };
    };
} {
    const errors: string[] = [];

    const needsPlaneValidation = isPlaneData(dataType);

    if (needsPlaneValidation) {
        const result = validatePlaneGeometry(row);
        return result;  // Returns both errors and planeVectors if successful
    }

    return { errors };
}

/**
 * Check if this data type represents a planar structure
 * Uses TypeSynonyms to check against known plane types
 */
function isPlaneData(dataType: string): boolean {
    const normalizedType = dataType.toLowerCase().trim();
    
    // Check if it's one of the main plane types or their synonyms
    const planeTypes = ['joint', 'fault', 'stylolite'];
    
    for (const mainType of planeTypes) {
        if (TypeSynonyms.isSameType(mainType, normalizedType)) {
            return true;
        }
    }
    
    // Additional types that need plane validation but aren't in TypeSynonyms yet
    // TODO: Add these to TypeSynonyms when they become common
    const additionalPlaneTypes = [
        'neoformed striated plane',
        'dilation band'
    ];
    
    return additionalPlaneTypes.some(type => normalizedType.includes(type));
}

/**
 * Validate plane geometry using fromAnglesToNormal
 * NOW ALSO RETURNS the calculated unit vectors for reuse!
 */
function validatePlaneGeometry(row: Record<string, any>): {
    errors: string[];
    planeVectors?: {
        n_plane: number[];
        n_strike: number[];
        n_dip: number[];
    };
} {
    const errors: string[] = [];
    
    // ... validation code ...
    
    if (dip < 90) {
        const dipDirection = row['dip direction'] || row['dipdirection'] || row['dipDirection'];
        
        if (!dipDirection || dipDirection === '') {
            errors.push('Dip direction is required for non-vertical planes');
            return { errors };
        }

        const direction = parseDipDirection(dipDirection);
        if (direction === null) {
            errors.push(`Invalid dip direction '${dipDirection}'`);
            return { errors };
        }

        try {
            const n_plane = fromAnglesToNormal({ strike, dip, dipDirection: direction });
            const { n_strike, n_dip } = calculatePlaneVectors(n_plane);
            
            return {
                errors: [],
                planeVectors: { n_plane, n_strike, n_dip }
            };
        } catch (error) {
            errors.push(`Plane geometry inconsistent: ${error.message}`);
            return { errors };
        }
    } else if (dip === 90) {
        try {
            const n_plane = fromAnglesToNormal({ strike, dip, dipDirection: Direction.UND });
            const { n_strike, n_dip } = calculatePlaneVectors(n_plane);
            
            return {
                errors: [],
                planeVectors: { n_plane, n_strike, n_dip }
            };
        } catch (error) {
            errors.push(`Plane geometry inconsistent: ${error.message}`);
            return { errors };
        }
    }

    return { errors };
}

/**
 * Parse dip direction string to Direction enum
 * Handles various input formats
 */
function parseDipDirection(dipDir: string): Direction | null {
    const normalized = dipDir.trim().toUpperCase();
    
    switch (normalized) {
        case 'N':
        case 'NORTH': return Direction.N;
        
        case 'S':
        case 'SOUTH': return Direction.S;
        
        case 'E':
        case 'EAST': return Direction.E;
        
        case 'W':
        case 'WEST': return Direction.W;
        
        case 'NE':
        case 'NORTH EAST':
        case 'NORTHEAST': return Direction.NE;
        
        case 'SE':
        case 'SOUTH EAST':
        case 'SOUTHEAST': return Direction.SE;
        
        case 'SW':
        case 'SOUTH WEST':
        case 'SOUTHWEST': return Direction.SW;
        
        case 'NW':
        case 'NORTH WEST':
        case 'NORTHWEST': return Direction.NW;
        
        default: return null;
    }
}