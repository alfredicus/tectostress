/**
 * Stress Field Computation Module
 *
 * Implements theoretical slip lines and equipotentials from the Python implementation.
 * Based on: Taboada, A., 1993, Stress and strain from striated pebbles.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Vendored verbatim from the `slip-lines` project (src/sphere_utils.ts) so the
 * two stay diffable. Do not edit here: change it upstream and re-copy.
 *
 * Axis convention used throughout: (lambda_x, lambda_y, lambda_z) = (σ1, σ3, σ2),
 * with the values ordered algebraically σ1 < σ2 < σ3 (σ1 = most compressive).
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ============================================================================
// TYPES
// ============================================================================

export interface Point3D {
    x: number;
    y: number;
    z: number;
}

export interface SlipLineCurve {
    x: number[];
    y: number[];
    z: number[];
    normal_stress: number[];
    shear_stress: number[];
    friction: number[];
    type: 'slip_line' | 'meridian';
    isSpecial?: boolean;
    specialType?: 'great_circle_xy' | 'great_circle_xz' | 'great_circle_yz';
}

export interface EquipotentialCurve {
    x: number[];
    y: number[];
    z: number[];
    iso_level: number;
    normal_stress: number[];
    type: 'equipotential' | 'sigma2_meridian';
}

export interface PrincipalAxis {
    axis: Point3D;
    value: number;
    colorHex: number;
}

export interface ComputeConfig {
    nCurves?: number;
    nIsoCurves?: number;
    curveResolution?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const REVOLUTION_TOLERANCE = 1e-6;
const DEFAULT_N_CURVES = 12;
const DEFAULT_N_ISO = 8;
const DEFAULT_CURVE_RESOLUTION = 200;

// ============================================================================
// COORDINATE TRANSFORMATIONS
// ============================================================================

/**
 * Convert spherical coordinates (phi, theta) to Cartesian (x, y, z)
 * 
 * phi: azimuth angle in degrees [0, 360]
 * theta: colatitude angle in degrees [0, 180]
 * r: radius (default 1.0)
 */
export function sphericalToCartesian(
    phi_deg: number,
    theta_deg: number,
    r: number = 1.0
): Point3D {
    const phi_rad = (phi_deg * Math.PI) / 180;
    const theta_rad = (theta_deg * Math.PI) / 180;

    return {
        x: r * Math.sin(theta_rad) * Math.cos(phi_rad),
        y: r * Math.sin(theta_rad) * Math.sin(phi_rad),
        z: r * Math.cos(theta_rad)
    };
}

/**
 * Convert multiple spherical coordinates to Cartesian (vectorized)
 */
function sphericalToCartesianVec(
    phi_deg: number[],
    theta_deg: number[]
): { x: number[]; y: number[]; z: number[] } {
    const x: number[] = [];
    const y: number[] = [];
    const z: number[] = [];

    for (let i = 0; i < phi_deg.length; i++) {
        const pt = sphericalToCartesian(phi_deg[i], theta_deg[i]);
        x.push(pt.x);
        y.push(pt.y);
        z.push(pt.z);
    }

    return { x, y, z };
}

// ============================================================================
// STRESS CALCULATIONS
// ============================================================================

/**
 * Calculate normal stress magnitude on sphere surface
 * 
 * Formula: Fn = (Î»x*cosÂ²Ï† + Î»y*sinÂ²Ï†)*sinÂ²Î¸ + Î»z*cosÂ²Î¸
 */
export function calculateNormalStress(
    phi_deg: number,
    theta_deg: number,
    lambda_x: number,
    lambda_y: number,
    lambda_z: number
): number {
    const phi_rad = (phi_deg * Math.PI) / 180;
    const theta_rad = (theta_deg * Math.PI) / 180;

    const cos_phi = Math.cos(phi_rad);
    const sin_phi = Math.sin(phi_rad);
    const cos_theta = Math.cos(theta_rad);
    const sin_theta = Math.sin(theta_rad);

    return (
        (lambda_x * cos_phi * cos_phi + lambda_y * sin_phi * sin_phi) * sin_theta * sin_theta +
        lambda_z * cos_theta * cos_theta
    );
}

/**
 * Calculate normal stress magnitude (vectorized)
 */
function calculateNormalStressVec(
    phi_deg: number[],
    theta_deg: number[],
    lambda_x: number,
    lambda_y: number,
    lambda_z: number
): number[] {
    const result: number[] = [];
    for (let i = 0; i < phi_deg.length; i++) {
        result.push(calculateNormalStress(phi_deg[i], theta_deg[i], lambda_x, lambda_y, lambda_z));
    }
    return result;
}

/**
 * Calculate shear stress magnitude on sphere surface
 */
function calculateShearStress(
    phi_deg: number,
    theta_deg: number,
    lambda_x: number,
    lambda_y: number,
    lambda_z: number
): number {
    const phi_rad = (phi_deg * Math.PI) / 180;
    const theta_rad = (theta_deg * Math.PI) / 180;

    const cos_phi = Math.cos(phi_rad);
    const sin_phi = Math.sin(phi_rad);
    const cos_theta = Math.cos(theta_rad);
    const sin_theta = Math.sin(theta_rad);

    // Unit normal vector
    const nx = sin_theta * cos_phi;
    const ny = sin_theta * sin_phi;
    const nz = cos_theta;

    // Stress vector: ÏƒÂ·n
    const sx = lambda_x * nx;
    const sy = lambda_y * ny;
    const sz = lambda_z * nz;

    // Normal stress component
    const normal = lambda_x * nx * nx + lambda_y * ny * ny + lambda_z * nz * nz;

    // Shear vector = stress vector - normal component
    const shear_x = sx - normal * nx;
    const shear_y = sy - normal * ny;
    const shear_z = sz - normal * nz;

    return Math.sqrt(shear_x * shear_x + shear_y * shear_y + shear_z * shear_z);
}

/**
 * Calculate shear stress magnitude (vectorized)
 */
function calculateShearStressVec(
    phi_deg: number[],
    theta_deg: number[],
    lambda_x: number,
    lambda_y: number,
    lambda_z: number
): number[] {
    const result: number[] = [];
    for (let i = 0; i < phi_deg.length; i++) {
        result.push(calculateShearStress(phi_deg[i], theta_deg[i], lambda_x, lambda_y, lambda_z));
    }
    return result;
}

/**
 * Calculate friction coefficient (shear/normal stress ratio)
 */
function calculateFriction(
    phi_deg: number,
    theta_deg: number,
    lambda_x: number,
    lambda_y: number,
    lambda_z: number
): number {
    const normal = calculateNormalStress(phi_deg, theta_deg, lambda_x, lambda_y, lambda_z);
    const shear = calculateShearStress(phi_deg, theta_deg, lambda_x, lambda_y, lambda_z);

    if (Math.abs(normal) < 1e-10) return 0;
    return shear / Math.abs(normal);
}

/**
 * Calculate friction coefficient (vectorized)
 */
function calculateFrictionVec(
    phi_deg: number[],
    theta_deg: number[],
    lambda_x: number,
    lambda_y: number,
    lambda_z: number
): number[] {
    const result: number[] = [];
    for (let i = 0; i < phi_deg.length; i++) {
        result.push(calculateFriction(phi_deg[i], theta_deg[i], lambda_x, lambda_y, lambda_z));
    }
    return result;
}

// ============================================================================
// SLIP LINE EQUATION
// ============================================================================

/**
 * Slip line equation: tan(Î¸) = k1 * (sin Ï†)^exp_sin * (cos Ï†)^exp_cos
 * 
 * Returns theta in degrees given phi in degrees
 */
export function slipLineEquation(
    phi_deg: number,
    lambda_x: number,
    lambda_y: number,
    lambda_z: number,
    k1: number = 1.0
): number {
    // Check for revolution case
    if (Math.abs(lambda_y - lambda_x) < REVOLUTION_TOLERANCE) {
        return 45.0; // Special case: meridians
    }

    const phi_rad = (phi_deg * Math.PI) / 180;

    // Stress ratios
    const exp_sin = (lambda_x - lambda_z) / (lambda_y - lambda_x);
    const exp_cos = (lambda_z - lambda_y) / (lambda_y - lambda_x);

    // Trigonometric components with numerical stability
    const sin_phi = Math.max(Math.abs(Math.sin(phi_rad)), 1e-10);
    const cos_phi = Math.max(Math.abs(Math.cos(phi_rad)), 1e-10);

    // Slip line equation
    const tan_theta = k1 * Math.pow(sin_phi, exp_sin) * Math.pow(cos_phi, exp_cos);
    const theta_rad = Math.atan(tan_theta);
    const theta_deg = (theta_rad * 180) / Math.PI;

    return theta_deg;
}

/**
 * Slip line equation (vectorized)
 */
function slipLineEquationVec(
    phi_deg: number[],
    lambda_x: number,
    lambda_y: number,
    lambda_z: number,
    k1: number = 1.0
): number[] {
    const result: number[] = [];
    for (let i = 0; i < phi_deg.length; i++) {
        result.push(slipLineEquation(phi_deg[i], lambda_x, lambda_y, lambda_z, k1));
    }
    return result;
}

// ============================================================================
// CURVE REFLECTION
// ============================================================================

/**
 * Reflect curve from one octant to all 8 octants using symmetry
 */
function reflectCurveToAllOctants(
    phi_deg: number[],
    theta_deg: number[]
): Array<{ phi: number[]; theta: number[]; x: number[]; y: number[]; z: number[] }> {
    const { x: x_base, y: y_base, z: z_base } = sphericalToCartesianVec(phi_deg, theta_deg);

    const reflections = [
        { sx: 1, sy: 1, sz: 1 },   // Original
        { sx: -1, sy: 1, sz: 1 },  // Reflect X
        { sx: 1, sy: -1, sz: 1 },  // Reflect Y
        { sx: 1, sy: 1, sz: -1 },  // Reflect Z
        { sx: -1, sy: -1, sz: 1 }, // Reflect X, Y
        { sx: -1, sy: 1, sz: -1 }, // Reflect X, Z
        { sx: 1, sy: -1, sz: -1 }, // Reflect Y, Z
        { sx: -1, sy: -1, sz: -1 } // Reflect X, Y, Z
    ];

    const curves: Array<{ phi: number[]; theta: number[]; x: number[]; y: number[]; z: number[] }> = [];

    for (const { sx, sy, sz } of reflections) {
        const x_refl = x_base.map((v) => sx * v);
        const y_refl = y_base.map((v) => sy * v);
        const z_refl = z_base.map((v) => sz * v);

        const phi_refl: number[] = [];
        const theta_refl: number[] = [];

        for (let i = 0; i < x_refl.length; i++) {
            const r = Math.sqrt(x_refl[i] * x_refl[i] + y_refl[i] * y_refl[i] + z_refl[i] * z_refl[i]);
            theta_refl.push((Math.acos(Math.max(-1, Math.min(1, z_refl[i] / r))) * 180) / Math.PI);

            let phi = (Math.atan2(y_refl[i], x_refl[i]) * 180) / Math.PI;
            if (phi < 0) phi += 360;
            phi_refl.push(phi);
        }

        curves.push({
            phi: phi_refl,
            theta: theta_refl,
            x: x_refl,
            y: y_refl,
            z: z_refl
        });
    }

    return curves;
}

// ============================================================================
// HELPER FUNCTIONS FOR SLIP LINE GENERATION
// ============================================================================

/**
 * Solve for the integration constant k at a specific point on the slip line (general case)
 * tan(θ) = k × sin(φ)^exp_sin × cos(φ)^exp_cos
 */
function solveForKFromPoint(
    phi_deg: number,
    theta_deg: number,
    lambda_x: number,
    lambda_y: number,
    lambda_z: number
): number {
    const phi_rad = (phi_deg * Math.PI) / 180;
    const theta_rad = (theta_deg * Math.PI) / 180;
    
    const exp_sin = (lambda_x - lambda_z) / (lambda_y - lambda_x);
    const exp_cos = (lambda_z - lambda_y) / (lambda_y - lambda_x);
    
    const sin_phi = Math.max(Math.abs(Math.sin(phi_rad)), 1e-10);
    const cos_phi = Math.max(Math.abs(Math.cos(phi_rad)), 1e-10);
    const tan_theta = Math.tan(theta_rad);
    
    const denominator = Math.pow(sin_phi, exp_sin) * Math.pow(cos_phi, exp_cos);
    const k = Math.abs(tan_theta) / Math.max(denominator, 1e-10);
    
    return k;
}

/**
 * Solve for k at a point on R=0 meridian using simplified equation
 * R=0: exp_cos=0, so cos_phi^0=1 (avoid undefined)
 * Simplified: tan(θ) = k × sin(φ)^exp_sin
 */
function solveForKFromPointR0(
    phi_deg: number,
    theta_deg: number,
    lambda_x: number,
    lambda_y: number,
    lambda_z: number
): number {
    const phi_rad = (phi_deg * Math.PI) / 180;
    const theta_rad = (theta_deg * Math.PI) / 180;
    
    const exp_sin = (lambda_x - lambda_z) / (lambda_y - lambda_x); // = -1 for R=0
    
    const sin_phi = Math.max(Math.abs(Math.sin(phi_rad)), 1e-10);
    const tan_theta = Math.tan(theta_rad);
    
    // Only sin_phi term: k = tan(θ) / sin(φ)^exp_sin
    const denominator = Math.pow(sin_phi, exp_sin);
    const k = Math.abs(tan_theta) / Math.max(denominator, 1e-10);
    
    return k;
}

/**
 * Solve for k at a point on R=1 meridian using simplified equation
 * R=1: exp_sin=0, so sin_phi^0=1 (avoid undefined)
 * Simplified: tan(θ) = k × cos(φ)^exp_cos
 */
function solveForKFromPointR1(
    phi_deg: number,
    theta_deg: number,
    lambda_x: number,
    lambda_y: number,
    lambda_z: number
): number {
    const phi_rad = (phi_deg * Math.PI) / 180;
    const theta_rad = (theta_deg * Math.PI) / 180;
    
    const exp_cos = (lambda_z - lambda_y) / (lambda_y - lambda_x); // = -1 for R=1
    
    const cos_phi = Math.max(Math.abs(Math.cos(phi_rad)), 1e-10);
    const tan_theta = Math.tan(theta_rad);
    
    // Only cos_phi term: k = tan(θ) / cos(φ)^exp_cos
    const denominator = Math.pow(cos_phi, exp_cos);
    const k = Math.abs(tan_theta) / Math.max(denominator, 1e-10);
    
    return k;
}

/**
 * Compute slip line equation for R=0 (only sin_phi term)
 * Simplified: tan(θ) = k × sin(φ)^exp_sin
 */
function slipLineEquationR0(
    phi_deg: number,
    lambda_x: number,
    lambda_y: number,
    lambda_z: number,
    k: number = 1.0
): number {
    const phi_rad = (phi_deg * Math.PI) / 180;
    const exp_sin = (lambda_x - lambda_z) / (lambda_y - lambda_x);
    
    const sin_phi = Math.max(Math.abs(Math.sin(phi_rad)), 1e-10);
    const tan_theta = k * Math.pow(sin_phi, exp_sin);
    const theta_rad = Math.atan(tan_theta);
    
    return (theta_rad * 180) / Math.PI;
}

/**
 * Compute slip line equation for R=1 (only cos_phi term)
 * Simplified: tan(θ) = k × cos(φ)^exp_cos
 */
function slipLineEquationR1(
    phi_deg: number,
    lambda_x: number,
    lambda_y: number,
    lambda_z: number,
    k: number = 1.0
): number {
    const phi_rad = (phi_deg * Math.PI) / 180;
    const exp_cos = (lambda_z - lambda_y) / (lambda_y - lambda_x);
    
    const cos_phi = Math.max(Math.abs(Math.cos(phi_rad)), 1e-10);
    const tan_theta = k * Math.pow(cos_phi, exp_cos);
    const theta_rad = Math.atan(tan_theta);
    
    return (theta_rad * 180) / Math.PI;
}

/**
 * Vectorized version of slipLineEquationR0
 */
function slipLineEquationVecR0(
    phi_deg: number[],
    lambda_x: number,
    lambda_y: number,
    lambda_z: number,
    k: number = 1.0
): number[] {
    return phi_deg.map(phi => slipLineEquationR0(phi, lambda_x, lambda_y, lambda_z, k));
}

/**
 * Vectorized version of slipLineEquationR1
 */
function slipLineEquationVecR1(
    phi_deg: number[],
    lambda_x: number,
    lambda_y: number,
    lambda_z: number,
    k: number = 1.0
): number[] {
    return phi_deg.map(phi => slipLineEquationR1(phi, lambda_x, lambda_y, lambda_z, k));
}

// ============================================================================
// SLIP LINE GENERATION
// ============================================================================


/**
 * Generate slip lines for the sphere
 * Handles three cases: R=0 (σ2=σ3), R=1 (σ2=σ1), and general case
 * Uses equidistant meridian points with solved k values for homogeneous distribution
 */
export function generateSlipLines(
    lambda_x: number,
    lambda_y: number,
    lambda_z: number,
    config?: Partial<ComputeConfig>
): SlipLineCurve[] {
    const cfg = {
        nCurves: config?.nCurves ?? DEFAULT_N_CURVES,
        curveResolution: config?.curveResolution ?? DEFAULT_CURVE_RESOLUTION
    };

    const allCurves: SlipLineCurve[] = [];

    // CASE 1: R = 0 (σ2 = σ3, i.e., lambda_z ≈ lambda_y)
    // Revolution around σ1 (x-axis), meridians at φ=90° (y,z plane)
    if (Math.abs(lambda_z - lambda_y) < REVOLUTION_TOLERANCE) {
        // console.log('[Slip Lines] R=0 case: σ2 ≈ σ3');
        // console.log(`  lambda_z=${lambda_z}, lambda_y=${lambda_y}, diff=${Math.abs(lambda_z - lambda_y)}`);
        
        // Generate equidistant theta points on (y,z) meridian
        const theta_meridian: number[] = [];
        for (let i = 1; i < cfg.nCurves; i++) {
            const t = i / cfg.nCurves;
            theta_meridian.push(t * 90); // θ from 0° to 90°
        }
        // console.log(`  Generated ${theta_meridian.length} equidistant meridian points:`, theta_meridian.map(t => t.toFixed(1)));
        
        // Fixed azimuth for revolution case: φ = 90° (y,z plane)
        const phi_fixed = 90;
        
        // Solve for k at each equidistant theta point using R=0 simplified equation
        for (const theta_point of theta_meridian) {
            const k = solveForKFromPointR0(phi_fixed, theta_point, lambda_x, lambda_y, lambda_z);
            // console.log(`  At θ=${theta_point.toFixed(1)}°, φ=${phi_fixed}°: k=${k.toFixed(6)}`);
            
            // Generate slip line with this k value using R=0 simplified equation
            const phi_vals = [];
            for (let j = 0; j < cfg.curveResolution; j++) {
                phi_vals.push(0.1 + (j / (cfg.curveResolution - 1)) * 89.8);
            }
            
            // Use simplified R=0 equation (only sin_phi term)
            const theta_vals = slipLineEquationVecR0(phi_vals, lambda_x, lambda_y, lambda_z, k);
            const valid: boolean[] = theta_vals.map(t => t >= 0.1 && t <= 89.9);
            const validCount = valid.filter(v => v).length;
            // console.log(`    Generated ${theta_vals.length} theta values, ${validCount} valid (θ in [0.1, 89.9])°`);
            if (validCount < 5) {
                // console.log(`    Skipping: too few valid points`);
                continue;
            }

            const phi_valid: number[] = [];
            const theta_valid: number[] = [];
            for (let i = 0; i < valid.length; i++) {
                if (valid[i]) {
                    phi_valid.push(phi_vals[i]);
                    theta_valid.push(theta_vals[i]);
                }
            }

            const { x, y, z } = sphericalToCartesianVec(phi_valid, theta_valid);
            const normal_stress = calculateNormalStressVec(phi_valid, theta_valid, lambda_x, lambda_y, lambda_z);
            const shear_stress = calculateShearStressVec(phi_valid, theta_valid, lambda_x, lambda_y, lambda_z);
            const friction = calculateFrictionVec(phi_valid, theta_valid, lambda_x, lambda_y, lambda_z);

            const reflected = reflectCurveToAllOctants(phi_valid, theta_valid);
            // console.log(`    Created ${reflected.length} reflected curves (8 octants)`);
            for (const curve of reflected) {
                allCurves.push({
                    x: curve.x,
                    y: curve.y,
                    z: curve.z,
                    normal_stress,
                    shear_stress,
                    friction,
                    type: 'meridian'
                });
            }
        }

        // Add special slip lines: great circles (x,y) and (x,z)
        const specialCurves = generateSpecialSlipLinesR0(lambda_x, lambda_y, lambda_z, cfg.curveResolution);
        // console.log(`  Added ${specialCurves.length} special slip lines (great circles)`);
        allCurves.push(...specialCurves);

    // CASE 2: R = 1 (σ2 = σ1, i.e., lambda_z ≈ lambda_x)
    // Revolution around σ3 (y-axis), meridians at φ=0° (x,z plane)
    } else if (Math.abs(lambda_z - lambda_x) < REVOLUTION_TOLERANCE) {
        // console.log('[Slip Lines] R=1 case: σ2 ≈ σ1');
        // console.log(`  lambda_z=${lambda_z}, lambda_x=${lambda_x}, diff=${Math.abs(lambda_z - lambda_x)}`);
        
        // Generate equidistant theta points on (x,z) meridian
        const theta_meridian: number[] = [];
        for (let i = 1; i < cfg.nCurves; i++) {
            const t = i / cfg.nCurves;
            theta_meridian.push(t * 90); // θ from 0° to 90°
        }
        // console.log(`  Generated ${theta_meridian.length} equidistant meridian points:`, theta_meridian.map(t => t.toFixed(1)));
        
        // Fixed azimuth for revolution case: φ = 0° (x,z plane)
        const phi_fixed = 0;
        
        // Solve for k at each equidistant theta point using R=1 simplified equation
        for (const theta_point of theta_meridian) {
            const k = solveForKFromPointR1(phi_fixed, theta_point, lambda_x, lambda_y, lambda_z);
            // console.log(`  At θ=${theta_point.toFixed(1)}°, φ=${phi_fixed}°: k=${k.toFixed(6)}`);
            
            // Generate slip line with this k value using R=1 simplified equation
            const phi_vals = [];
            for (let j = 0; j < cfg.curveResolution; j++) {
                phi_vals.push(0.1 + (j / (cfg.curveResolution - 1)) * 89.8);
            }
            
            // Use simplified R=1 equation (only cos_phi term)
            const theta_vals = slipLineEquationVecR1(phi_vals, lambda_x, lambda_y, lambda_z, k);
            const valid: boolean[] = theta_vals.map(t => t >= 0.1 && t <= 89.9);
            const validCount = valid.filter(v => v).length;
            // console.log(`    Generated ${theta_vals.length} theta values, ${validCount} valid (θ in [0.1, 89.9])°`);
            if (validCount < 5) {
                // console.log(`    Skipping: too few valid points`);
                continue;
            }

            const phi_valid: number[] = [];
            const theta_valid: number[] = [];
            for (let i = 0; i < valid.length; i++) {
                if (valid[i]) {
                    phi_valid.push(phi_vals[i]);
                    theta_valid.push(theta_vals[i]);
                }
            }

            const { x, y, z } = sphericalToCartesianVec(phi_valid, theta_valid);
            const normal_stress = calculateNormalStressVec(phi_valid, theta_valid, lambda_x, lambda_y, lambda_z);
            const shear_stress = calculateShearStressVec(phi_valid, theta_valid, lambda_x, lambda_y, lambda_z);
            const friction = calculateFrictionVec(phi_valid, theta_valid, lambda_x, lambda_y, lambda_z);

            const reflected = reflectCurveToAllOctants(phi_valid, theta_valid);
            // console.log(`    Created ${reflected.length} reflected curves (8 octants)`);
            for (const curve of reflected) {
                allCurves.push({
                    x: curve.x,
                    y: curve.y,
                    z: curve.z,
                    normal_stress,
                    shear_stress,
                    friction,
                    type: 'meridian'
                });
            }
        }

        // Add special slip lines: great circles (x,y) and (y,z)
        const specialCurves = generateSpecialSlipLinesR1(lambda_x, lambda_y, lambda_z, cfg.curveResolution);
        // console.log(`  Added ${specialCurves.length} special slip lines (great circles)`);
        allCurves.push(...specialCurves);

    // CASE 3: General case (0 < R < 1)
    // Use equidistant points on sigma2 meridian with solved k values
    } else {
        // console.log('[Slip Lines] General case');
        
        // Calculate sigma2 meridian azimuth
        const R = (lambda_z - lambda_y) / (lambda_x - lambda_y);
        const phi_sigma2 = Math.acos(Math.sqrt(Math.max(0, Math.min(1, R)))) * 180 / Math.PI;
        
        // Generate equidistant theta points on sigma2 meridian
        const theta_meridian: number[] = [];
        for (let i = 1; i < cfg.nCurves; i++) {
            const t = i / cfg.nCurves;
            theta_meridian.push(t * 90); // θ from 0° to 90°
        }
        
        // Solve for k at each equidistant theta point
        for (const theta_point of theta_meridian) {
            const k = solveForKFromPoint(phi_sigma2, theta_point, lambda_x, lambda_y, lambda_z);
            
            // Generate slip line with this k value, dense sampling near poles
            const phi_vals = [];
            for (let i = 0; i < 50; i++) phi_vals.push(0.5 + (i / 50) * 9.5);
            for (let i = 0; i < cfg.curveResolution - 100; i++) phi_vals.push(10 + (i / (cfg.curveResolution - 100)) * 70);
            for (let i = 0; i < 50; i++) phi_vals.push(80 + (i / 50) * 9.5);
            
            const theta_vals = slipLineEquationVec(phi_vals, lambda_x, lambda_y, lambda_z, k);
            const valid: boolean[] = theta_vals.map(t => t >= 0.1 && t <= 89.9);
            const validCount = valid.filter(v => v).length;
            if (validCount < 5) continue;

            const phi_valid: number[] = [];
            const theta_valid: number[] = [];
            for (let i = 0; i < valid.length; i++) {
                if (valid[i]) {
                    phi_valid.push(phi_vals[i]);
                    theta_valid.push(theta_vals[i]);
                }
            }

            const { x, y, z } = sphericalToCartesianVec(phi_valid, theta_valid);
            const normal_stress = calculateNormalStressVec(phi_valid, theta_valid, lambda_x, lambda_y, lambda_z);
            const shear_stress = calculateShearStressVec(phi_valid, theta_valid, lambda_x, lambda_y, lambda_z);
            const friction = calculateFrictionVec(phi_valid, theta_valid, lambda_x, lambda_y, lambda_z);

            const reflected = reflectCurveToAllOctants(phi_valid, theta_valid);
            for (const curve of reflected) {
                allCurves.push({
                    x: curve.x,
                    y: curve.y,
                    z: curve.z,
                    normal_stress,
                    shear_stress,
                    friction,
                    type: 'slip_line'
                });
            }
        }

        // Add special slip lines: great circles (x,y), (x,z), and (y,z)
        const specialCurves = generateSpecialSlipLinesGeneral(lambda_x, lambda_y, lambda_z, cfg.curveResolution);
        // console.log(`  Added ${specialCurves.length} special slip lines (great circles)`);
        allCurves.push(...specialCurves);
    }

    // console.log(`[Slip Lines] Total curves generated: ${allCurves.length}`);
    return allCurves;
}

/**
 * Reflect a special slip line to relevant octants
 * For vertical planes: 4 reflections (specific axes)
 * For horizontal plane: 8 reflections (all octants)
 */
function reflectSpecialSlipLine(
    x: number[],
    y: number[],
    z: number[],
    planeType: 'great_circle_xy' | 'great_circle_xz' | 'great_circle_yz'
): Array<{ x: number[]; y: number[]; z: number[] }> {
    const curves: Array<{ x: number[]; y: number[]; z: number[] }> = [];
    
    if (planeType === 'great_circle_xy') {
        // Horizontal plane (z=0): All 8 octant reflections
        const reflections = [
            { sx: 1, sy: 1, sz: 1 },
            { sx: -1, sy: 1, sz: 1 },
            { sx: 1, sy: -1, sz: 1 },
            { sx: 1, sy: 1, sz: -1 },
            { sx: -1, sy: -1, sz: 1 },
            { sx: -1, sy: 1, sz: -1 },
            { sx: 1, sy: -1, sz: -1 },
            { sx: -1, sy: -1, sz: -1 }
        ];
        
        for (const { sx, sy, sz } of reflections) {
            curves.push({
                x: x.map(v => sx * v),
                y: y.map(v => sy * v),
                z: z.map(v => sz * v)
            });
        }
    } else if (planeType === 'great_circle_xz') {
        // Vertical plane (y=0): 4 reflections along x,z axes only (no y reflection)
        const reflections = [
            { sx: 1, sy: 1, sz: 1 },
            { sx: -1, sy: 1, sz: 1 },
            { sx: 1, sy: 1, sz: -1 },
            { sx: -1, sy: 1, sz: -1 }
        ];
        
        for (const { sx, sy, sz } of reflections) {
            curves.push({
                x: x.map(v => sx * v),
                y: y.map(v => sy * v),
                z: z.map(v => sz * v)
            });
        }
    } else if (planeType === 'great_circle_yz') {
        // Vertical plane (x=0): 4 reflections along y,z axes only (no x reflection)
        const reflections = [
            { sx: 1, sy: 1, sz: 1 },
            { sx: 1, sy: -1, sz: 1 },
            { sx: 1, sy: 1, sz: -1 },
            { sx: 1, sy: -1, sz: -1 }
        ];
        
        for (const { sx, sy, sz } of reflections) {
            curves.push({
                x: x.map(v => sx * v),
                y: y.map(v => sy * v),
                z: z.map(v => sz * v)
            });
        }
    }
    
    return curves;
}

/**
 * Generate special slip lines for general case (0 < R < 1)
 * Three great circles: (x,y), (x,z), and (y,z) planes
 */
function generateSpecialSlipLinesGeneral(
    lambda_x: number,
    lambda_y: number,
    lambda_z: number,
    resolution: number
): SlipLineCurve[] {
    const curves: SlipLineCurve[] = [];

    // Great circle (x,y) plane: z = 0, φ ∈ [0, 360°], θ = 90°
    const xy_x: number[] = [];
    const xy_y: number[] = [];
    const xy_z: number[] = [];
    for (let i = 0; i < resolution; i++) {
        const phi = (i / resolution) * 360;
        const pt = sphericalToCartesian(phi, 90);
        xy_x.push(pt.x);
        xy_y.push(pt.y);
        xy_z.push(pt.z);
    }

    const xy_normal = calculateNormalStressVec(
        Array(resolution).fill(0).map((_, i) => (i / resolution) * 360),
        Array(resolution).fill(90),
        lambda_x, lambda_y, lambda_z
    );
    const xy_shear = calculateShearStressVec(
        Array(resolution).fill(0).map((_, i) => (i / resolution) * 360),
        Array(resolution).fill(90),
        lambda_x, lambda_y, lambda_z
    );
    const xy_friction = xy_normal.map((n, i) => Math.abs(n) > 1e-10 ? xy_shear[i] / Math.abs(n) : 0);

    // Reflect (x,y) to 8 octants
    const xy_reflected = reflectSpecialSlipLine(xy_x, xy_y, xy_z, 'great_circle_xy');
    for (const curve of xy_reflected) {
        curves.push({
            x: curve.x,
            y: curve.y,
            z: curve.z,
            normal_stress: xy_normal,
            shear_stress: xy_shear,
            friction: xy_friction,
            type: 'slip_line',
            isSpecial: true,
            specialType: 'great_circle_xy'
        });
    }

    // Great circle (x,z) plane: y = 0, φ = 0°, varies θ
    const xz_x: number[] = [];
    const xz_y: number[] = [];
    const xz_z: number[] = [];
    const xz_phi: number[] = [];
    const xz_theta: number[] = [];
    for (let i = 0; i < resolution; i++) {
        const theta = (i / (resolution - 1)) * 180;
        const pt = sphericalToCartesian(0, theta);
        xz_x.push(pt.x);
        xz_y.push(pt.y);
        xz_z.push(pt.z);
        xz_phi.push(0);
        xz_theta.push(theta);
    }

    const xz_normal = calculateNormalStressVec(xz_phi, xz_theta, lambda_x, lambda_y, lambda_z);
    const xz_shear = calculateShearStressVec(xz_phi, xz_theta, lambda_x, lambda_y, lambda_z);
    const xz_friction = xz_normal.map((n, i) => Math.abs(n) > 1e-10 ? xz_shear[i] / Math.abs(n) : 0);

    // Reflect (x,z) to 4 octants (x,z reflections only)
    const xz_reflected = reflectSpecialSlipLine(xz_x, xz_y, xz_z, 'great_circle_xz');
    for (const curve of xz_reflected) {
        curves.push({
            x: curve.x,
            y: curve.y,
            z: curve.z,
            normal_stress: xz_normal,
            shear_stress: xz_shear,
            friction: xz_friction,
            type: 'slip_line',
            isSpecial: true,
            specialType: 'great_circle_xz'
        });
    }

    // Great circle (y,z) plane: x = 0, φ = 90°, varies θ
    const yz_x: number[] = [];
    const yz_y: number[] = [];
    const yz_z: number[] = [];
    const yz_phi: number[] = [];
    const yz_theta: number[] = [];
    for (let i = 0; i < resolution; i++) {
        const theta = (i / (resolution - 1)) * 180;
        const pt = sphericalToCartesian(90, theta);
        yz_x.push(pt.x);
        yz_y.push(pt.y);
        yz_z.push(pt.z);
        yz_phi.push(90);
        yz_theta.push(theta);
    }

    const yz_normal = calculateNormalStressVec(yz_phi, yz_theta, lambda_x, lambda_y, lambda_z);
    const yz_shear = calculateShearStressVec(yz_phi, yz_theta, lambda_x, lambda_y, lambda_z);
    const yz_friction = yz_normal.map((n, i) => Math.abs(n) > 1e-10 ? yz_shear[i] / Math.abs(n) : 0);

    // Reflect (y,z) to 4 octants (y,z reflections only)
    const yz_reflected = reflectSpecialSlipLine(yz_x, yz_y, yz_z, 'great_circle_yz');
    for (const curve of yz_reflected) {
        curves.push({
            x: curve.x,
            y: curve.y,
            z: curve.z,
            normal_stress: yz_normal,
            shear_stress: yz_shear,
            friction: yz_friction,
            type: 'slip_line',
            isSpecial: true,
            specialType: 'great_circle_yz'
        });
    }

    return curves;
}

/**
 * Generate special slip lines for R=0 case (σ2 = σ3)
 * Two great circles: (x,y) and (x,z) planes
 */
function generateSpecialSlipLinesR0(
    lambda_x: number,
    lambda_y: number,
    lambda_z: number,
    resolution: number
): SlipLineCurve[] {
    const curves: SlipLineCurve[] = [];

    // Great circle (x,y) plane: z = 0, φ ∈ [0, 360°], θ = 90°
    const xy_x: number[] = [];
    const xy_y: number[] = [];
    const xy_z: number[] = [];
    for (let i = 0; i < resolution; i++) {
        const phi = (i / resolution) * 360;
        const pt = sphericalToCartesian(phi, 90);
        xy_x.push(pt.x);
        xy_y.push(pt.y);
        xy_z.push(pt.z);
    }

    const xy_normal = calculateNormalStressVec(
        Array(resolution).fill(0).map((_, i) => (i / resolution) * 360),
        Array(resolution).fill(90),
        lambda_x, lambda_y, lambda_z
    );
    const xy_shear = calculateShearStressVec(
        Array(resolution).fill(0).map((_, i) => (i / resolution) * 360),
        Array(resolution).fill(90),
        lambda_x, lambda_y, lambda_z
    );
    const xy_friction = xy_normal.map((n, i) => Math.abs(n) > 1e-10 ? xy_shear[i] / Math.abs(n) : 0);

    // Reflect (x,y) to 8 octants
    const xy_reflected = reflectSpecialSlipLine(xy_x, xy_y, xy_z, 'great_circle_xy');
    for (const curve of xy_reflected) {
        curves.push({
            x: curve.x,
            y: curve.y,
            z: curve.z,
            normal_stress: xy_normal,
            shear_stress: xy_shear,
            friction: xy_friction,
            type: 'slip_line',
            isSpecial: true,
            specialType: 'great_circle_xy'
        });
    }

    // Great circle (x,z) plane: y = 0, φ = 0°, varies θ
    const xz_x: number[] = [];
    const xz_y: number[] = [];
    const xz_z: number[] = [];
    const xz_phi: number[] = [];
    const xz_theta: number[] = [];
    for (let i = 0; i < resolution; i++) {
        const theta = (i / (resolution - 1)) * 180;
        const pt = sphericalToCartesian(0, theta);
        xz_x.push(pt.x);
        xz_y.push(pt.y);
        xz_z.push(pt.z);
        xz_phi.push(0);
        xz_theta.push(theta);
    }

    const xz_normal = calculateNormalStressVec(xz_phi, xz_theta, lambda_x, lambda_y, lambda_z);
    const xz_shear = calculateShearStressVec(xz_phi, xz_theta, lambda_x, lambda_y, lambda_z);
    const xz_friction = xz_normal.map((n, i) => Math.abs(n) > 1e-10 ? xz_shear[i] / Math.abs(n) : 0);

    // Reflect (x,z) to 4 octants (x,z reflections only)
    const xz_reflected = reflectSpecialSlipLine(xz_x, xz_y, xz_z, 'great_circle_xz');
    for (const curve of xz_reflected) {
        curves.push({
            x: curve.x,
            y: curve.y,
            z: curve.z,
            normal_stress: xz_normal,
            shear_stress: xz_shear,
            friction: xz_friction,
            type: 'slip_line',
            isSpecial: true,
            specialType: 'great_circle_xz'
        });
    }

    return curves;
}

/**
 * Generate special slip lines for R=1 case (σ2 = σ1)
 * Two great circles: (x,y) and (y,z) planes
 */
function generateSpecialSlipLinesR1(
    lambda_x: number,
    lambda_y: number,
    lambda_z: number,
    resolution: number
): SlipLineCurve[] {
    const curves: SlipLineCurve[] = [];

    // Great circle (x,y) plane: z = 0, φ ∈ [0, 360°], θ = 90°
    const xy_x: number[] = [];
    const xy_y: number[] = [];
    const xy_z: number[] = [];
    for (let i = 0; i < resolution; i++) {
        const phi = (i / resolution) * 360;
        const pt = sphericalToCartesian(phi, 90);
        xy_x.push(pt.x);
        xy_y.push(pt.y);
        xy_z.push(pt.z);
    }

    const xy_normal = calculateNormalStressVec(
        Array(resolution).fill(0).map((_, i) => (i / resolution) * 360),
        Array(resolution).fill(90),
        lambda_x, lambda_y, lambda_z
    );
    const xy_shear = calculateShearStressVec(
        Array(resolution).fill(0).map((_, i) => (i / resolution) * 360),
        Array(resolution).fill(90),
        lambda_x, lambda_y, lambda_z
    );
    const xy_friction = xy_normal.map((n, i) => Math.abs(n) > 1e-10 ? xy_shear[i] / Math.abs(n) : 0);

    // Reflect (x,y) to 8 octants
    const xy_reflected = reflectSpecialSlipLine(xy_x, xy_y, xy_z, 'great_circle_xy');
    for (const curve of xy_reflected) {
        curves.push({
            x: curve.x,
            y: curve.y,
            z: curve.z,
            normal_stress: xy_normal,
            shear_stress: xy_shear,
            friction: xy_friction,
            type: 'slip_line',
            isSpecial: true,
            specialType: 'great_circle_xy'
        });
    }

    // Great circle (y,z) plane: x = 0, φ = 90°, varies θ
    const yz_x: number[] = [];
    const yz_y: number[] = [];
    const yz_z: number[] = [];
    const yz_phi: number[] = [];
    const yz_theta: number[] = [];
    for (let i = 0; i < resolution; i++) {
        const theta = (i / (resolution - 1)) * 180;
        const pt = sphericalToCartesian(90, theta);
        yz_x.push(pt.x);
        yz_y.push(pt.y);
        yz_z.push(pt.z);
        yz_phi.push(90);
        yz_theta.push(theta);
    }

    const yz_normal = calculateNormalStressVec(yz_phi, yz_theta, lambda_x, lambda_y, lambda_z);
    const yz_shear = calculateShearStressVec(yz_phi, yz_theta, lambda_x, lambda_y, lambda_z);
    const yz_friction = yz_normal.map((n, i) => Math.abs(n) > 1e-10 ? yz_shear[i] / Math.abs(n) : 0);

    // Reflect (y,z) to 4 octants (y,z reflections only)
    const yz_reflected = reflectSpecialSlipLine(yz_x, yz_y, yz_z, 'great_circle_yz');
    for (const curve of yz_reflected) {
        curves.push({
            x: curve.x,
            y: curve.y,
            z: curve.z,
            normal_stress: yz_normal,
            shear_stress: yz_shear,
            friction: yz_friction,
            type: 'slip_line',
            isSpecial: true,
            specialType: 'great_circle_yz'
        });
    }

    return curves;
}

// ============================================================================
// EQUIPOTENTIAL GENERATION
// ============================================================================

/**
 * Generate equipotential curves (iso-normal stress)
 */
export function generateEquipotentials(
    lambda_x: number,
    lambda_y: number,
    lambda_z: number,
    config?: Partial<ComputeConfig>
): EquipotentialCurve[] {
    const cfg = {
        nIsoCurves: config?.nIsoCurves ?? DEFAULT_N_ISO,
        curveResolution: config?.curveResolution ?? DEFAULT_CURVE_RESOLUTION
    };

    const allCurves: EquipotentialCurve[] = [];

    // Sort stress values
    const stresses = [lambda_x, lambda_y, lambda_z].sort((a, b) => a - b);
    const sigma1 = stresses[0]; // minimum (most compressive)
    const sigma3 = stresses[2]; // maximum (most extensional)

    // Generate iso levels with linear spacing
    const fn_levels: number[] = [];
    for (let i = 0; i <= cfg.nIsoCurves; i++) {
        const fn = sigma3 + ((sigma1 - sigma3) * i) / cfg.nIsoCurves;
        fn_levels.push(fn);
    }

    // Generate equipotential curves
    for (const target_fn of fn_levels) {
        // Skip endpoints (singular points)
        if (Math.abs(target_fn - sigma3) < 1e-6 || Math.abs(target_fn - sigma1) < 1e-6) {
            continue;
        }

        // Generate by sweeping through theta and finding phi values
        const theta_range: number[] = [];
        for (let i = 0; i < cfg.curveResolution; i++) {
            theta_range.push((i / (cfg.curveResolution - 1)) * 179.8 + 0.1);
        }

        const phi_values: number[] = [];
        const valid_theta: number[] = [];
        const valid_phi: number[] = [];

        for (const theta of theta_range) {
            // Binary search for phi where stress equals target_fn
            let phi_low = 0;
            let phi_high = 90;

            for (let iter = 0; iter < 30; iter++) {
                const phi_mid = (phi_low + phi_high) / 2;
                const stress = calculateNormalStress(phi_mid, theta, lambda_x, lambda_y, lambda_z);

                if (stress < target_fn) {
                    phi_low = phi_mid;
                } else {
                    phi_high = phi_mid;
                }
            }

            const phi = (phi_low + phi_high) / 2;
            const final_stress = calculateNormalStress(phi, theta, lambda_x, lambda_y, lambda_z);

            // Accept if close enough to target
            if (Math.abs(final_stress - target_fn) < Math.abs(sigma1 - sigma3) * 1e-3) {
                valid_theta.push(theta);
                valid_phi.push(phi);
            }
        }

        if (valid_theta.length > 5) {
            const { x, y, z } = sphericalToCartesianVec(valid_phi, valid_theta);
            const normal_stress = calculateNormalStressVec(valid_phi, valid_theta, lambda_x, lambda_y, lambda_z);

            allCurves.push({
                x,
                y,
                z,
                iso_level: target_fn,
                normal_stress,
                type: 'equipotential'
            });
        }
    }

    return allCurves;
}

// ============================================================================
// OCTANT REFLECTION HELPER FUNCTIONS
// ============================================================================

/**
 * Determine reflection pattern based on stress ratio R
 * 
 * R = (σ₂ - σ₃) / (σ₁ - σ₃)
 * - R ≈ 0: σ₂ = σ₃ → Great circle in (y,z) plane (x=0) → 4 reflections
 * - R ≈ 1: σ₁ = σ₂ → Great circle in (x,z) plane (y=0) → 4 reflections
 * - 0 < R < 1: General case → 8 reflections
 */
function getReflectionPattern(R: number): Array<{ sx: number; sy: number; sz: number }> {
    const tolerance = 1e-6;
    
    if (Math.abs(R) < tolerance) {
        // R = 0: x = 0 plane → reflect only y,z
        return [
            { sx: 1, sy: 1, sz: 1 },
            { sx: 1, sy: -1, sz: 1 },
            { sx: 1, sy: 1, sz: -1 },
            { sx: 1, sy: -1, sz: -1 }
        ];
    } else if (Math.abs(R - 1) < tolerance) {
        // R = 1: y = 0 plane → reflect only x,z
        return [
            { sx: 1, sy: 1, sz: 1 },
            { sx: -1, sy: 1, sz: 1 },
            { sx: 1, sy: 1, sz: -1 },
            { sx: -1, sy: 1, sz: -1 }
        ];
    } else {
        // General case: 8 reflections
        const reflections: Array<{ sx: number; sy: number; sz: number }> = [];
        for (let sx of [-1, 1]) {
            for (let sy of [-1, 1]) {
                for (let sz of [-1, 1]) {
                    reflections.push({ sx, sy, sz });
                }
            }
        }
        return reflections;
    }
}

/**
 * Apply octant reflections to a single curve
 */
function reflectCurveToOctants(
    x: number[],
    y: number[],
    z: number[],
    reflections: Array<{ sx: number; sy: number; sz: number }>
): Array<{ x: number[]; y: number[]; z: number[] }> {
    return reflections.map(({ sx, sy, sz }) => ({
        x: x.map(v => sx * v),
        y: y.map(v => sy * v),
        z: z.map(v => sz * v)
    }));
}

// ============================================================================
// MOHR CIRCLE HELPER FUNCTIONS FOR PARAMETRIC EQUIPOTENTIALS
// ============================================================================

/**
 * Calculate maximum shear stress (radius) on Mohr circle for two principal stresses
 * 
 * Circle centered at (sigmaA + sigmaB)/2 with radius (sigmaB - sigmaA)/2
 * At normal stress σ_n, maximum τ is: τ_max = √[R² - (σ_n - center)²]
 */
function calculateTauOnCircle(
    sigma_n: number,
    sigmaA: number,
    sigmaB: number
): number {
    const center = (sigmaA + sigmaB) / 2;
    const radius = Math.abs(sigmaB - sigmaA) / 2;
    const deltaSigma = sigma_n - center;
    
    const tau_squared = radius * radius - deltaSigma * deltaSigma;
    return tau_squared >= 0 ? Math.sqrt(tau_squared) : NaN;
}

/**
 * Parametric equations converting Mohr circle point (σ_n, τ) to direction cosines
 * 
 * Based on: Jaeger & Cook (1979) Equations
 * 
 * l² = [(σ₂ - σ_n)(σ₃ - σ_n) + τ²] / [(σ₂ - σ₁)(σ₃ - σ₁)]
 * m² = [(σ₃ - σ_n)(σ₁ - σ_n) + τ²] / [(σ₃ - σ₂)(σ₁ - σ₂)]
 * n² = [(σ₁ - σ_n)(σ₂ - σ_n) + τ²] / [(σ₁ - σ₃)(σ₂ - σ₃)]
 */
function calculateDirectionCosinesSquared(
    sigma_n: number,
    tau: number,
    sigma1: number,
    sigma2: number,
    sigma3: number
): { l_sq: number; m_sq: number; n_sq: number } {
    const l_sq = ((sigma2 - sigma_n) * (sigma3 - sigma_n) + tau * tau) / 
                 ((sigma2 - sigma1) * (sigma3 - sigma1));
    const m_sq = ((sigma3 - sigma_n) * (sigma1 - sigma_n) + tau * tau) / 
                 ((sigma3 - sigma2) * (sigma1 - sigma2));
    const n_sq = ((sigma1 - sigma_n) * (sigma2 - sigma_n) + tau * tau) / 
                 ((sigma1 - sigma3) * (sigma2 - sigma3));
    
    return { l_sq, m_sq, n_sq };
}

// ============================================================================
// EQUIPOTENTIAL GENERATION - REVOLUTION CASES (R=0, R=1)
// ============================================================================

/**
 * Generate equipotentials for R = 0 (σ₂ = σ₃) revolution case
 * 
 * Only l parameter varies. Equipotentials are circles from cone around σ₁.
 * Parametrization: (x, y, z) = (l, sin(arccos(l))·sin(θ), sin(arccos(l))·cos(θ))
 * θ ∈ [0°, 90°]
 * 
 * Endpoints:
 * - θ=0: (l, 0, sin(arccos(l))) in (σ₁,σ₂) plane
 * - θ=90°: (l, sin(arccos(l)), 0) in (σ₁,σ₃) plane
 */
export function generateEquipotentialsRevolutionR0(
    lambda_1: number,  // σ₁
    lambda_2: number,  // σ₂ = σ₃
    config?: Partial<ComputeConfig>
): EquipotentialCurve[] {
    const cfg = {
        nIsoCurves: config?.nIsoCurves ?? DEFAULT_N_ISO,
        curveResolution: config?.curveResolution ?? DEFAULT_CURVE_RESOLUTION
    };

    const allCurves: EquipotentialCurve[] = [];

    // Generate sigma_n levels (same spacing as general case)
    for (let i = 1; i < cfg.nIsoCurves; i++) {
        const sigma_n = lambda_1 + (i / cfg.nIsoCurves) * (lambda_2 - lambda_1);
        
        // Calculate l from sigma_n: l = sqrt((sigma_n - lambda_2)/(lambda_1 - lambda_2))
        const l = Math.sqrt(Math.max(0, (sigma_n - lambda_2) / (lambda_1 - lambda_2)));
        
        const apexAngleRad = Math.acos(Math.max(-1, Math.min(1, l)));
        const sinApex = Math.sin(apexAngleRad);
        
        const x: number[] = [];
        const y: number[] = [];
        const z: number[] = [];
        const normal_stress_vals: number[] = [];

        // Generate quarter circle: θ ∈ [0°, 90°]
        for (let j = 0; j < cfg.curveResolution; j++) {
            const theta_deg = (j / (cfg.curveResolution - 1)) * 90;
            const theta_rad = (theta_deg * Math.PI) / 180;
            
            const x_val = l;
            const y_val = sinApex * Math.sin(theta_rad);
            const z_val = sinApex * Math.cos(theta_rad);
            
            // Store as (x, y, z) display coords = (l, z_val, y_val) mapping
            x.push(x_val);
            y.push(z_val);
            z.push(y_val);
            
            // Calculate normal stress at this point
            const sigma_n = lambda_1 * x_val * x_val + lambda_2 * (y_val * y_val + z_val * z_val);
            normal_stress_vals.push(sigma_n);
        }

        allCurves.push({
            x,
            y,
            z,
            iso_level: sigma_n,
            normal_stress: normal_stress_vals,
            type: 'equipotential'
        });
    }

    // Special equipotential at σ_n = σ₃
    // Great circle (σ₂, σ₃) in (y,z) plane: (x, y, z) = (0, sin(θ), cos(θ))
    {
        const x: number[] = [];
        const y: number[] = [];
        const z: number[] = [];
        const normal_stress_vals: number[] = [];

        for (let j = 0; j < cfg.curveResolution; j++) {
            const theta_deg = (j / (cfg.curveResolution - 1)) * 90;
            const theta_rad = (theta_deg * Math.PI) / 180;
            
            const x_val = 0;
            const y_val = Math.sin(theta_rad);
            const z_val = Math.cos(theta_rad);
            
            x.push(x_val);
            y.push(y_val);
            z.push(z_val);
            
            // σ_n = σ₃ (constant along this great circle)
            normal_stress_vals.push(lambda_2);
        }

        allCurves.push({
            x,
            y,
            z,
            iso_level: lambda_2,
            normal_stress: normal_stress_vals,
            type: 'equipotential'
        });
    }

    // Apply octant reflections with correct patterns
    const reflectedCurves: EquipotentialCurve[] = [];
    
    for (let i = 0; i < allCurves.length; i++) {
        const curve = allCurves[i];
        const isSpecial = Math.abs(curve.iso_level - lambda_2) < 1e-10; // Special at σ_n = σ₃
        
        // Special curve (x=0): 4-way reflections (sy, sz)
        // Regular curves: 8-way reflections
        const reflections = isSpecial ? getReflectionPattern(0) : getReflectionPattern(0.5);
        const reflected = reflectCurveToOctants(curve.x, curve.y, curve.z, reflections);
        
        for (const r of reflected) {
            reflectedCurves.push({
                x: r.x,
                y: r.y,
                z: r.z,
                iso_level: curve.iso_level,
                normal_stress: curve.normal_stress,
                type: curve.type
            });
        }
    }

    return reflectedCurves;
}

/**
 * Generate equipotentials for R = 1 (σ₂ = σ₁) revolution case
 * 
 * Only n parameter varies. Equipotentials are circles from cone around σ₃.
 * Parametrization: (x, y, z) = (sin(arccos(n))·sin(θ), n, sin(arccos(n))·cos(θ))
 * θ ∈ [0°, 90°]
 * 
 * Endpoints:
 * - θ=0: (0, n, sin(arccos(n))) in (σ₂,σ₃) plane
 * - θ=90°: (sin(arccos(n)), n, 0) in (σ₁,σ₃) plane
 */
export function generateEquipotentialsRevolutionR1(
    lambda_3: number,  // σ₃
    lambda_1: number,  // σ₁ = σ₂
    config?: Partial<ComputeConfig>
): EquipotentialCurve[] {
    const cfg = {
        nIsoCurves: config?.nIsoCurves ?? DEFAULT_N_ISO,
        curveResolution: config?.curveResolution ?? DEFAULT_CURVE_RESOLUTION
    };

    const allCurves: EquipotentialCurve[] = [];

    // Generate sigma_n levels (same spacing as general case)
    for (let i = 1; i < cfg.nIsoCurves; i++) {
        const sigma_n = lambda_1 + (i / cfg.nIsoCurves) * (lambda_3 - lambda_1);
        
        // Calculate n from sigma_n: n = sqrt((sigma_n - lambda_1)/(lambda_3 - lambda_1))
        const n = Math.sqrt(Math.max(0, (sigma_n - lambda_1) / (lambda_3 - lambda_1)));
        
        const apexAngleRad = Math.acos(Math.max(-1, Math.min(1, n)));
        const sinApex = Math.sin(apexAngleRad);
        
        const x: number[] = [];
        const y: number[] = [];
        const z: number[] = [];
        const normal_stress_vals: number[] = [];

        // Generate quarter circle: θ ∈ [0°, 90°]
        for (let j = 0; j < cfg.curveResolution; j++) {
            const theta_deg = (j / (cfg.curveResolution - 1)) * 90;
            const theta_rad = (theta_deg * Math.PI) / 180;
            
            const x_val = sinApex * Math.sin(theta_rad);
            const y_val = n;
            const z_val = sinApex * Math.cos(theta_rad);
            
            // Cone around y-axis (σ₃): keep y fixed, x and z vary
            x.push(x_val);
            y.push(y_val);
            z.push(z_val);
            
            // Calculate normal stress at this point
            const sigma_n = lambda_1 * (x_val * x_val + y_val * y_val) + lambda_3 * z_val * z_val;
            normal_stress_vals.push(sigma_n);
        }

        allCurves.push({
            x,
            y,
            z,
            iso_level: sigma_n,
            normal_stress: normal_stress_vals,
            type: 'equipotential'
        });
    }

    // Special equipotential at σ_n = σ₁
    // Great circle (σ₁, σ₂) in (x,z) plane: (x, y, z) = (sin(θ), 0, cos(θ))
    {
        const x: number[] = [];
        const y: number[] = [];
        const z: number[] = [];
        const normal_stress_vals: number[] = [];

        for (let j = 0; j < cfg.curveResolution; j++) {
            const theta_deg = (j / (cfg.curveResolution - 1)) * 90;
            const theta_rad = (theta_deg * Math.PI) / 180;
            
            const x_val = Math.sin(theta_rad);
            const y_val = 0;
            const z_val = Math.cos(theta_rad);
            
            x.push(x_val);
            y.push(y_val);
            z.push(z_val);
            
            // σ_n = σ₁ (constant along this great circle)
            normal_stress_vals.push(lambda_1);
        }

        allCurves.push({
            x,
            y,
            z,
            iso_level: lambda_1,
            normal_stress: normal_stress_vals,
            type: 'equipotential'
        });
    }

    // Apply octant reflections with correct patterns
    const reflectedCurves: EquipotentialCurve[] = [];
    
    for (let i = 0; i < allCurves.length; i++) {
        const curve = allCurves[i];
        const isSpecial = Math.abs(curve.iso_level - lambda_1) < 1e-10; // Special at σ_n = σ₁
        
        // Special curve (y=0): 4-way reflections (sx, sz)
        // Regular curves: 8-way reflections
        const reflections = isSpecial ? getReflectionPattern(1) : getReflectionPattern(0.5);
        const reflected = reflectCurveToOctants(curve.x, curve.y, curve.z, reflections);
        
        for (const r of reflected) {
            reflectedCurves.push({
                x: r.x,
                y: r.y,
                z: r.z,
                iso_level: curve.iso_level,
                normal_stress: curve.normal_stress,
                type: curve.type
            });
        }
    }

    return reflectedCurves;
}

// ============================================================================
// EQUIPOTENTIAL GENERATION - PARAMETRIC METHOD (GENERAL CASE)
// ============================================================================

/**
 * Generate equipotential curves using parametric method
 * Based on Mohr circle approach with proper τ sampling
 * 
 * Three cases:
 * a) σ₁ < σ_n < σ₂: Active circles (σ₁,σ₂) and (σ₁,σ₃)
 * b) σ₂ < σ_n < σ₃: Active circles (σ₂,σ₃) and (σ₁,σ₃)  
 * c) σ_n = σ₂: Special meridian (separate function)
 */
export function generateEquipotentialsParametric(
    lambda_x: number,  // σ₁ (minimum/most compressive)
    lambda_y: number,  // σ₃ (maximum/most extensional)
    lambda_z: number,  // σ₂ (intermediate)
    config?: Partial<ComputeConfig>
): EquipotentialCurve[] {
    const cfg = {
        nIsoCurves: config?.nIsoCurves ?? DEFAULT_N_ISO,
        curveResolution: config?.curveResolution ?? DEFAULT_CURVE_RESOLUTION
    };

    // Identify principal stresses
    const stresses = [lambda_x, lambda_y, lambda_z];
    stresses.sort((a, b) => a - b);
    const sigma1 = stresses[0];
    const sigma2 = stresses[1];
    const sigma3 = stresses[2];

    // Check for revolution cases
    const tolerance = 1e-6;
    if (Math.abs(sigma2 - sigma3) < tolerance) {
        // R = 0: σ₂ = σ₃ (revolution around σ₁)
        return generateEquipotentialsRevolutionR0(sigma1, sigma2, config);
    } else if (Math.abs(sigma1 - sigma2) < tolerance) {
        // R = 1: σ₁ = σ₂ (revolution around σ₃)
        return generateEquipotentialsRevolutionR1(sigma3, sigma1, config);
    }

    // General case: 0 < R < 1
    const allCurves: EquipotentialCurve[] = [];

    // Generate sigma_n levels
    const sigma_n_values: number[] = [];
    for (let i = 1; i < cfg.nIsoCurves; i++) {
        const sigma_n = sigma1 + (i / cfg.nIsoCurves) * (sigma3 - sigma1);
        sigma_n_values.push(sigma_n);
    }

    // Generate curves for each sigma_n level
    for (const sigma_n of sigma_n_values) {
        const x: number[] = [];
        const y: number[] = [];
        const z: number[] = [];
        const normal_stress_vals: number[] = [];

        if (sigma_n < sigma2 - 1e-10) {
            // CASE a: σ₁ < σ_n < σ₂
            // Line segment from (σ_n, tau_12, n=0) to (σ_n, tau_13, m=0)
            const tau_12 = calculateTauOnCircle(sigma_n, sigma1, sigma2);
            const tau_13 = calculateTauOnCircle(sigma_n, sigma1, sigma3);
            
            if (!isNaN(tau_12) && !isNaN(tau_13) && tau_12 < tau_13) {
                for (let i = 0; i < cfg.curveResolution; i++) {
                    const t = i / (cfg.curveResolution - 1);
                    const tau = tau_12 + t * (tau_13 - tau_12);
                    
                    if (i === 0) {
                        // Exact endpoint: tau_12 with n=0 (circle σ₁,σ₂)
                        const dc = calculateDirectionCosinesSquared(sigma_n, tau_12, sigma1, sigma2, sigma3);
                        const l = Math.sqrt(Math.max(0, dc.l_sq));
                        const m = Math.sqrt(Math.max(0, dc.m_sq));
                        const n = 0;
                        x.push(l);
                        y.push(n);  // (l, n, m) mapping
                        z.push(m);
                        normal_stress_vals.push(sigma_n);
                    } else if (i === cfg.curveResolution - 1) {
                        // Exact endpoint: tau_13 with m=0 (circle σ₁,σ₃)
                        const dc = calculateDirectionCosinesSquared(sigma_n, tau_13, sigma1, sigma2, sigma3);
                        const l = Math.sqrt(Math.max(0, dc.l_sq));
                        const n = Math.sqrt(Math.max(0, dc.n_sq));
                        const m = 0;
                        x.push(l);
                        y.push(n);  // (l, n, m) mapping
                        z.push(m);
                        normal_stress_vals.push(sigma_n);
                    } else {
                        // Interior points
                        const dc = calculateDirectionCosinesSquared(sigma_n, tau, sigma1, sigma2, sigma3);
                        if (dc.l_sq >= 0 && dc.m_sq >= 0 && dc.n_sq >= 0) {
                            const l = Math.sqrt(dc.l_sq);
                            const m = Math.sqrt(dc.m_sq);
                            const n = Math.sqrt(dc.n_sq);
                            x.push(l);
                            y.push(n);  // (l, n, m) mapping
                            z.push(m);
                            normal_stress_vals.push(sigma_n);
                        }
                    }
                }
            }
        } else if (sigma_n > sigma2 + 1e-10) {
            // CASE b: σ₂ < σ_n < σ₃
            // Line segment from (σ_n, tau_23, l=0) to (σ_n, tau_13, m=0)
            const tau_23 = calculateTauOnCircle(sigma_n, sigma2, sigma3);
            const tau_13 = calculateTauOnCircle(sigma_n, sigma1, sigma3);
            
            if (!isNaN(tau_23) && !isNaN(tau_13) && tau_23 < tau_13) {
                for (let i = 0; i < cfg.curveResolution; i++) {
                    const t = i / (cfg.curveResolution - 1);
                    const tau = tau_23 + t * (tau_13 - tau_23);
                    
                    if (i === 0) {
                        // Exact endpoint: tau_23 with l=0 (circle σ₂,σ₃)
                        const dc = calculateDirectionCosinesSquared(sigma_n, tau_23, sigma1, sigma2, sigma3);
                        const m = Math.sqrt(Math.max(0, dc.m_sq));
                        const n = Math.sqrt(Math.max(0, dc.n_sq));
                        const l = 0;
                        x.push(l);
                        y.push(n);  // (l, n, m) mapping
                        z.push(m);
                        normal_stress_vals.push(sigma_n);
                    } else if (i === cfg.curveResolution - 1) {
                        // Exact endpoint: tau_13 with m=0 (circle σ₁,σ₃)
                        const dc = calculateDirectionCosinesSquared(sigma_n, tau_13, sigma1, sigma2, sigma3);
                        const l = Math.sqrt(Math.max(0, dc.l_sq));
                        const n = Math.sqrt(Math.max(0, dc.n_sq));
                        const m = 0;
                        x.push(l);
                        y.push(n);  // (l, n, m) mapping
                        z.push(m);
                        normal_stress_vals.push(sigma_n);
                    } else {
                        // Interior points
                        const dc = calculateDirectionCosinesSquared(sigma_n, tau, sigma1, sigma2, sigma3);
                        if (dc.l_sq >= 0 && dc.m_sq >= 0 && dc.n_sq >= 0) {
                            const l = Math.sqrt(dc.l_sq);
                            const m = Math.sqrt(dc.m_sq);
                            const n = Math.sqrt(dc.n_sq);
                            x.push(l);
                            y.push(n);  // (l, n, m) mapping
                            z.push(m);
                            normal_stress_vals.push(sigma_n);
                        }
                    }
                }
            }
        } else {
            // CASE c: σ_n = σ₂ (special meridian)
            // Line segment from (σ₂, 0, (0,1,0)) to (σ₂, tau_13, m=0)
            const tau_13 = calculateTauOnCircle(sigma_n, sigma1, sigma3);
            
            if (!isNaN(tau_13)) {
                for (let i = 0; i < cfg.curveResolution; i++) {
                    const t = i / (cfg.curveResolution - 1);
                    const tau = t * tau_13;
                    
                    if (i === 0) {
                        // Exact endpoint: (l,m,n)=(0,1,0) → (x,y,z)=(0,0,1)
                        x.push(0);
                        y.push(0);  // (l, n, m) mapping
                        z.push(1);
                        normal_stress_vals.push(sigma_n);
                    } else if (i === cfg.curveResolution - 1) {
                        // Exact endpoint: tau_13 with m=0 (circle σ₁,σ₃)
                        const dc = calculateDirectionCosinesSquared(sigma_n, tau_13, sigma1, sigma2, sigma3);
                        const l = Math.sqrt(Math.max(0, dc.l_sq));
                        const n = Math.sqrt(Math.max(0, dc.n_sq));
                        const m = 0;
                        x.push(l);
                        y.push(n);  // (l, n, m) mapping
                        z.push(m);
                        normal_stress_vals.push(sigma_n);
                    } else {
                        // Interior points
                        const dc = calculateDirectionCosinesSquared(sigma_n, tau, sigma1, sigma2, sigma3);
                        if (dc.l_sq >= 0 && dc.m_sq >= 0 && dc.n_sq >= 0) {
                            const l = Math.sqrt(dc.l_sq);
                            const m = Math.sqrt(dc.m_sq);
                            const n = Math.sqrt(dc.n_sq);
                            x.push(l);
                            y.push(n);  // (l, n, m) mapping
                            z.push(m);
                            normal_stress_vals.push(sigma_n);
                        }
                    }
                }
            }
        }

        if (x.length > 5) {
            allCurves.push({
                x,
                y,
                z,
                iso_level: sigma_n,
                normal_stress: normal_stress_vals,
                type: 'equipotential'
            });
        }
    }

    // Apply octant reflections
    const R = (lambda_z - lambda_y) / (lambda_x - lambda_y);
    const reflections = getReflectionPattern(R);
    const reflectedCurves: EquipotentialCurve[] = [];
    
    for (const curve of allCurves) {
        const reflected = reflectCurveToOctants(curve.x, curve.y, curve.z, reflections);
        for (const r of reflected) {
            reflectedCurves.push({
                x: r.x,
                y: r.y,
                z: r.z,
                iso_level: curve.iso_level,
                normal_stress: curve.normal_stress,
                type: curve.type
            });
        }
    }

    return reflectedCurves;
}

/**
 * Generate special equipotential meridian at σ_n = σ₂
 * 
 * Three cases:
 * 1) General (0 < R < 1): R = cos²(φ), meridian at azimuth φ = arccos(√R)
 * 2) R = 0: Great circle (σ₂,σ₃) in (y,z) plane
 * 3) R = 1: Great circle (σ₁,σ₂) in (x,z) plane
 * 
 * Returns array of reflected curves for all 8 octants (or 4 for revolution cases)
 */
export function generateSpecialEquipotentialMeridian(
    lambda_x: number,  // σ₁
    lambda_y: number,  // σ₃
    lambda_z: number,  // σ₂
    config?: Partial<ComputeConfig>
): EquipotentialCurve[] {
    const cfg = {
        curveResolution: config?.curveResolution ?? DEFAULT_CURVE_RESOLUTION
    };

    // Identify principal stresses
    const stresses = [lambda_x, lambda_y, lambda_z];
    stresses.sort((a, b) => a - b);
    const sigma1 = stresses[0];
    const sigma2 = stresses[1];
    const sigma3 = stresses[2];

    const x: number[] = [];
    const y: number[] = [];
    const z: number[] = [];
    const normal_stress_vals: number[] = [];

    const tolerance = 1e-6;
    let R = 0.5;  // Default for general case
    
    if (Math.abs(sigma2 - sigma3) < tolerance) {
        // R = 0: Great circle (σ₂,σ₃) in (y,z) plane
        // (x, y, z) = (0, sin(θ), cos(θ))
        R = 0;
        for (let i = 0; i < cfg.curveResolution; i++) {
            const theta_deg = (i / (cfg.curveResolution - 1)) * 90;
            const theta_rad = (theta_deg * Math.PI) / 180;
            x.push(0);
            y.push(Math.sin(theta_rad));
            z.push(Math.cos(theta_rad));
            normal_stress_vals.push(sigma2);
        }
    } else if (Math.abs(sigma1 - sigma2) < tolerance) {
        // R = 1: Great circle (σ₁,σ₂) in (x,z) plane
        // (x, y, z) = (sin(θ), 0, cos(θ))
        R = 1;
        for (let i = 0; i < cfg.curveResolution; i++) {
            const theta_deg = (i / (cfg.curveResolution - 1)) * 90;
            const theta_rad = (theta_deg * Math.PI) / 180;
            x.push(Math.sin(theta_rad));
            y.push(0);
            z.push(Math.cos(theta_rad));
            normal_stress_vals.push(sigma2);
        }
    } else {
        // General case: 0 < R < 1
        // R = cos²(φ) → φ = arccos(√R)
        R = (sigma2 - sigma3) / (sigma1 - sigma3);
        const phi_rad = Math.acos(Math.sqrt(Math.max(0, Math.min(1, R))));
        
        // Meridian at fixed azimuth φ, θ ∈ [0, 90°]
        // (x, y, z) = (sin(θ)cos(φ), sin(θ)sin(φ), cos(θ))
        for (let i = 0; i < cfg.curveResolution; i++) {
            const theta_deg = (i / (cfg.curveResolution - 1)) * 90;
            const theta_rad = (theta_deg * Math.PI) / 180;
            
            const sin_theta = Math.sin(theta_rad);
            const cos_theta = Math.cos(theta_rad);
            const cos_phi = Math.cos(phi_rad);
            const sin_phi = Math.sin(phi_rad);
            
            x.push(sin_theta * cos_phi);
            y.push(sin_theta * sin_phi);
            z.push(cos_theta);
            normal_stress_vals.push(sigma2);
        }
    }

    // Apply octant reflections
    const reflections = getReflectionPattern(R);
    const reflectedCurves: EquipotentialCurve[] = [];
    
    const reflected = reflectCurveToOctants(x, y, z, reflections);
    for (const r of reflected) {
        reflectedCurves.push({
            x: r.x,
            y: r.y,
            z: r.z,
            iso_level: sigma2,
            normal_stress: normal_stress_vals,
            type: 'equipotential'
        });
    }

    return reflectedCurves;
}

/**
 * Generate equipotentials using binary search method (original)
 */
export function generateEquipotentialsBinary(
    lambda_x: number,
    lambda_y: number,
    lambda_z: number,
    config?: Partial<ComputeConfig>
): EquipotentialCurve[] {
    const cfg = {
        nIsoCurves: config?.nIsoCurves ?? DEFAULT_N_ISO,
        curveResolution: config?.curveResolution ?? DEFAULT_CURVE_RESOLUTION
    };

    const allCurves: EquipotentialCurve[] = [];

    // Sort stress values
    const stresses = [lambda_x, lambda_y, lambda_z].sort((a, b) => a - b);
    const sigma1 = stresses[0];
    const sigma3 = stresses[2];

    // Generate iso levels
    const fn_levels: number[] = [];
    for (let i = 0; i <= cfg.nIsoCurves; i++) {
        const fn = sigma3 + ((sigma1 - sigma3) * i) / cfg.nIsoCurves;
        fn_levels.push(fn);
    }

    // Generate equipotential curves
    for (const target_fn of fn_levels) {
        if (Math.abs(target_fn - sigma3) < 1e-6 || Math.abs(target_fn - sigma1) < 1e-6) {
            continue;
        }

        const theta_range: number[] = [];
        for (let i = 0; i < cfg.curveResolution; i++) {
            theta_range.push((i / (cfg.curveResolution - 1)) * 179.8 + 0.1);
        }

        const valid_theta: number[] = [];
        const valid_phi: number[] = [];

        for (const theta of theta_range) {
            let phi_low = 0;
            let phi_high = 90;

            for (let iter = 0; iter < 30; iter++) {
                const phi_mid = (phi_low + phi_high) / 2;
                const stress = calculateNormalStress(phi_mid, theta, lambda_x, lambda_y, lambda_z);

                if (stress < target_fn) {
                    phi_low = phi_mid;
                } else {
                    phi_high = phi_mid;
                }
            }

            const phi = (phi_low + phi_high) / 2;
            const final_stress = calculateNormalStress(phi, theta, lambda_x, lambda_y, lambda_z);

            if (Math.abs(final_stress - target_fn) < Math.abs(sigma1 - sigma3) * 1e-3) {
                valid_theta.push(theta);
                valid_phi.push(phi);
            }
        }

        if (valid_theta.length > 5) {
            const { x, y, z } = sphericalToCartesianVec(valid_phi, valid_theta);
            const normal_stress = calculateNormalStressVec(valid_phi, valid_theta, lambda_x, lambda_y, lambda_z);

            allCurves.push({
                x,
                y,
                z,
                iso_level: target_fn,
                normal_stress,
                type: 'equipotential'
            });
        }
    }

    return allCurves;
}

// ============================================================================
// PRINCIPAL AXES
// ============================================================================

/**
 * Generate principal stress axes
 */
export function generatePrincipalAxes(
    sigma_x: number,
    sigma_y: number,
    sigma_z: number
): PrincipalAxis[] {
    const stresses = [
        { value: sigma_x, axis: { x: 1, y: 0, z: 0 } },
        { value: sigma_y, axis: { x: 0, y: 1, z: 0 } },
        { value: sigma_z, axis: { x: 0, y: 0, z: 1 } }
    ];

    // Sort by magnitude (descending)
    stresses.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

    const colors = [0xff0000, 0x00ff00, 0x0000ff]; // Red, Green, Blue

    return stresses.map((stress, i) => ({
        axis: stress.axis,
        value: stress.value,
        colorHex: colors[i]
    }));
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Mohr coordinates (Fn, Ftau) of a direction on the sphere.
 *
 * With the traction F = T·n on the plane of normal n, expressed in the principal frame,
 *     Fn   = lambda_x nx² + lambda_y ny² + lambda_z nz²
 *     |F|² = lambda_x² nx² + lambda_y² ny² + lambda_z² nz²
 *     Ftau = sqrt(|F|² - Fn²)
 * This is the projection used in Taboada (1993), fig. 8b: it sends every point of the sphere into
 * the region bounded by the three Mohr circles, iso-Fn curves onto vertical lines and integral
 * curves onto the curves that cross them.
 */
export function getMohrPoint(
    point: Point3D,
    lambda_x: number,
    lambda_y: number,
    lambda_z: number
): { sigma_n: number; tau: number } {
    const r = Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z);
    if (r < 1e-10) return { sigma_n: 0, tau: 0 };

    const nx = point.x / r;
    const ny = point.y / r;
    const nz = point.z / r;

    const sigma_n = lambda_x * nx * nx + lambda_y * ny * ny + lambda_z * nz * nz;
    const f2 =
        lambda_x * lambda_x * nx * nx +
        lambda_y * lambda_y * ny * ny +
        lambda_z * lambda_z * nz * nz;

    return { sigma_n, tau: Math.sqrt(Math.max(0, f2 - sigma_n * sigma_n)) };
}

/**
 * Calculate normal stress at a point on the sphere surface (for coloring)
 * Converts Cartesian to spherical and computes stress value
 */
export function getEquipotentialPoint(
    point: Point3D,
    lambda_x: number,
    lambda_y: number,
    lambda_z: number
): number {
    const r = Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z);
    if (r < 1e-10) return 0;

    // Convert to spherical
    const theta_rad = Math.acos(Math.max(-1, Math.min(1, point.z / r)));
    let phi_rad = Math.atan2(point.y, point.x);
    if (phi_rad < 0) phi_rad += 2 * Math.PI;

    const theta_deg = (theta_rad * 180) / Math.PI;
    const phi_deg = (phi_rad * 180) / Math.PI;

    return calculateNormalStress(phi_deg, theta_deg, lambda_x, lambda_y, lambda_z);
}