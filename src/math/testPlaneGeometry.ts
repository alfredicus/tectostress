/**
 * Test file for plane geometry functions
 * This verifies that the calculations are correct
 */

import { calculateStrikeVector, calculateDipVector, calculatePlaneVectors, generateGreatCirclePoints } from './math';

/**
 * Test helper: Check if two vectors are approximately equal
 */
function vectorsEqual(v1: { x: number; y: number; z: number }, v2: { x: number; y: number; z: number }, tolerance: number = 1e-6): boolean {
    return Math.abs(v1.x - v2.x) < tolerance &&
           Math.abs(v1.y - v2.y) < tolerance &&
           Math.abs(v1.z - v2.z) < tolerance;
}

/**
 * Test helper: Check if vector is unit length
 */
function isUnitVector(v: { x: number; y: number; z: number }, tolerance: number = 1e-6): boolean {
    const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    return Math.abs(length - 1.0) < tolerance;
}

/**
 * Test helper: Check if two vectors are perpendicular
 */
function arePerpendicular(v1: { x: number; y: number; z: number }, v2: { x: number; y: number; z: number }, tolerance: number = 1e-6): boolean {
    const dotProduct = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    return Math.abs(dotProduct) < tolerance;
}

/**
 * Run all tests
 */
export function runPlaneGeometryTests(): void {
    console.log('========================================');
    console.log('TESTING PLANE GEOMETRY FUNCTIONS');
    console.log('========================================');

    let testsPassed = 0;
    let testsFailed = 0;

    // TEST 1: Horizontal plane (normal pointing up)
    console.log('\n--- Test 1: Horizontal Plane ---');
    const n_plane_horizontal = { x: 0, y: 0, z: 1 };
    const { n_strike: strike1, n_dip: dip1 } = calculatePlaneVectors(n_plane_horizontal);
    
    console.log('n_plane:', n_plane_horizontal);
    console.log('n_strike:', strike1);
    console.log('n_dip:', dip1);
    
    if (isUnitVector(strike1) && isUnitVector(dip1)) {
        console.log('✅ Vectors are unit length');
        testsPassed++;
    } else {
        console.log('❌ Vectors are NOT unit length');
        testsFailed++;
    }
    
    if (arePerpendicular(strike1, n_plane_horizontal) && arePerpendicular(dip1, n_plane_horizontal)) {
        console.log('✅ Vectors are perpendicular to normal');
        testsPassed++;
    } else {
        console.log('❌ Vectors are NOT perpendicular to normal');
        testsFailed++;
    }

    // TEST 2: Vertical plane (normal horizontal, pointing East)
    console.log('\n--- Test 2: Vertical Plane (East) ---');
    const n_plane_vertical_E = { x: 1, y: 0, z: 0 };
    const { n_strike: strike2, n_dip: dip2 } = calculatePlaneVectors(n_plane_vertical_E);
    
    console.log('n_plane:', n_plane_vertical_E);
    console.log('n_strike:', strike2);
    console.log('n_dip:', dip2);
    
    if (isUnitVector(strike2) && isUnitVector(dip2)) {
        console.log('✅ Vectors are unit length');
        testsPassed++;
    } else {
        console.log('❌ Vectors are NOT unit length');
        testsFailed++;
    }
    
    if (arePerpendicular(strike2, dip2)) {
        console.log('✅ Strike and dip are perpendicular');
        testsPassed++;
    } else {
        console.log('❌ Strike and dip are NOT perpendicular');
        testsFailed++;
    }

    // TEST 3: 45-degree dipping plane
    console.log('\n--- Test 3: 45° Dipping Plane ---');
    const sqrt2 = Math.sqrt(2);
    const n_plane_45deg = { x: 1/sqrt2, y: 0, z: 1/sqrt2 };  // Dips 45° to East
    const { n_strike: strike3, n_dip: dip3 } = calculatePlaneVectors(n_plane_45deg);
    
    console.log('n_plane:', n_plane_45deg);
    console.log('n_strike:', strike3);
    console.log('n_dip:', dip3);
    
    if (isUnitVector(strike3) && isUnitVector(dip3)) {
        console.log('✅ Vectors are unit length');
        testsPassed++;
    } else {
        console.log('❌ Vectors are NOT unit length');
        testsFailed++;
    }
    
    if (Math.abs(strike3.z) < 1e-6) {
        console.log('✅ Strike is horizontal (z ≈ 0)');
        testsPassed++;
    } else {
        console.log('❌ Strike is NOT horizontal');
        testsFailed++;
    }

    // TEST 4: Great circle generation
    console.log('\n--- Test 4: Great Circle Points ---');
    const points = generateGreatCirclePoints(strike3, dip3, 10);
    
    console.log(`Generated ${points.length} points`);
    
    if (points.length === 11) {  // 0 to 10 inclusive
        console.log('✅ Correct number of points');
        testsPassed++;
    } else {
        console.log('❌ Wrong number of points');
        testsFailed++;
    }
    
    // Check first and last points
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    
    console.log('First point (α=0):', firstPoint);
    console.log('Last point (α=π):', lastPoint);
    
    if (vectorsEqual(firstPoint, strike3, 1e-6)) {
        console.log('✅ First point equals n_strike');
        testsPassed++;
    } else {
        console.log('❌ First point does NOT equal n_strike');
        testsFailed++;
    }
    
    const expectedLast = { x: -strike3.x, y: -strike3.y, z: -strike3.z };
    if (vectorsEqual(lastPoint, expectedLast, 1e-6)) {
        console.log('✅ Last point equals -n_strike');
        testsPassed++;
    } else {
        console.log('❌ Last point does NOT equal -n_strike');
        testsFailed++;
    }

    // TEST 5: Check all points are on the plane
    console.log('\n--- Test 5: Points lie on plane ---');
    let allOnPlane = true;
    for (const point of points) {
        // Dot product with normal should be zero (point on plane)
        const dotProduct = point.x * n_plane_45deg.x + point.y * n_plane_45deg.y + point.z * n_plane_45deg.z;
        if (Math.abs(dotProduct) > 1e-6) {
            allOnPlane = false;
            break;
        }
    }
    
    if (allOnPlane) {
        console.log('✅ All points lie on the plane');
        testsPassed++;
    } else {
        console.log('❌ Some points do NOT lie on the plane');
        testsFailed++;
    }

    // SUMMARY
    console.log('\n========================================');
    console.log('TEST SUMMARY');
    console.log('========================================');
    console.log(`✅ Tests passed: ${testsPassed}`);
    console.log(`❌ Tests failed: ${testsFailed}`);
    console.log('========================================\n');
}