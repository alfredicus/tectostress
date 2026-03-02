import * as d3 from 'd3';

/**
 * 3D Vector type for defining planes and directions
 */
export interface Vector3D {
    x: number;
    y: number;
    z: number;
}

/**
 * Plane defined by its normal vector (pointing upward)
 */
export interface PlaneData {
    normal: Vector3D;
    id?: number | string;
}

/**
 * Extension fracture - synonymous with PlaneData
 */
export type ExtensionFractureData = PlaneData;

/**
 * Striated fault plane: plane normal + striation unit vector
 */
export interface StriatedPlaneData {
    normal: Vector3D;
    striation: Vector3D;
    typeOfMovement?: string;
    id?: number | string;
}

/**
 * Pole data: vector representing the normal to a plane
 * The pole is the intersection of this line with the hemisphere
 */
export interface PoleData {
    vector: Vector3D;
    id?: number | string;
}

/**
 * Line data: direction vector
 */
export interface LineData {
    vector: Vector3D;
    id?: number | string;
}

// Styling options
export interface WulffStyle {
    gridColor?: string;
    gridWidth?: number;
    gridDashArray?: string;
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    labelColor?: string;
    labelSize?: string;
}

export interface DataStyle {
    color?: string;
    width?: number;
    size?: number;
    opacity?: number;
    fillColor?: string;
    strokeColor?: string;
    arrowSize?: number;
    arrowLength?: number;
    showLabels?: boolean;
}

// Configuration options
export interface WulffOptions {
    width?: number;
    height?: number;
    margin?: number;
    gridInterval?: number;
    showGrid?: boolean;
    showDirections?: boolean;
    showLabels?: boolean;
    stereonetStyle?: WulffStyle;
    defaultDataStyle?: DataStyle;
}

/**
 * WulffStereonet class for plotting geological data on a stereographic projection
 * Uses vector-based input for planes and lines
 *
 * Coordinate system:
 * - x: East
 * - y: North
 * - z: Up (vertical)
 */
export class Wulff {
    private svg!: d3.Selection<SVGGElement, unknown, null, undefined>;
    private container!: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private width: number;
    private height: number;
    private radius: number;
    private centerX: number;
    private centerY: number;
    private options: WulffOptions;
    private labelPositions: { x: number; y: number; radius: number }[] = [];
    private storedLabelPositions: Map<string | number, { x: number; y: number }> = new Map();

    constructor(containerId: string, options: WulffOptions = {}) {
        this.options = {
            width: 600,
            height: 600,
            margin: 50,
            gridInterval: 10,
            showGrid: true,
            showDirections: true,
            showLabels: true,
            stereonetStyle: {
                gridColor: 'gray',
                gridWidth: 1,
                gridDashArray: '2,2',
                backgroundColor: 'white',
                borderColor: 'black',
                borderWidth: 2,
                labelColor: 'black',
                labelSize: '14px'
            },
            defaultDataStyle: {
                color: 'blue',
                width: 2,
                size: 4,
                opacity: 1,
                arrowSize: 8,
                arrowLength: 15,
                showLabels: true
            },
            ...options
        };

        this.width = this.options.width!;
        this.height = this.options.height!;
        this.radius = (Math.min(this.width, this.height) - 2 * this.options.margin!) / 2;
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;

        this.initializeSVG(containerId);
        this.drawBaseStereonet();
    }

    // ===================== Public Methods =====================

    /**
     * Add a plane (great circle) defined by its normal vector
     */
    public addPlane(data: PlaneData, style: DataStyle = {}): void {
        this.drawGreatCircleFromNormal(data.normal, style);
    }

    /**
     * Add multiple planes
     */
    public addPlanes(data: PlaneData[], style: DataStyle = {}): void {
        data.forEach(plane => this.addPlane(plane, style));
    }

    /**
     * Add an extension fracture (synonymous with plane)
     */
    public addExtensionFracture(data: ExtensionFractureData, style: DataStyle = {}): void {
        this.addPlane(data, style);
    }

    /**
     * Add multiple extension fractures
     */
    public addExtensionFractures(data: ExtensionFractureData[], style: DataStyle = {}): void {
        data.forEach(fracture => this.addExtensionFracture(fracture, style));
    }

    /**
     * Add a striated fault plane (plane + arrow + label)
     */
    public addStriatedPlane(data: StriatedPlaneData, style: DataStyle = {}): void {
        this.drawGreatCircleFromNormal(data.normal, { ...style, opacity: 0.7 });
        this.drawStriationVector(data.normal, data.striation, style, data.id);
    }

    /**
     * Add only the striation arrow (without the plane)
     */
    public addStriationArrow(data: StriatedPlaneData, style: DataStyle = {}): void {
        this.drawStriationVector(data.normal, data.striation, { ...style, showLabels: false }, undefined);
    }

    /**
     * Add only the striation label
     */
    public addStriationLabel(data: StriatedPlaneData, style: DataStyle = {}): void {
        this.drawStriationLabel(data.normal, data.striation, style, data.id);
    }

    /**
     * Add a label for a plane (positioned at the edge of the great circle)
     */
    public addPlaneLabel(data: PlaneData, style: DataStyle = {}): void {
        if (data.id === undefined) return;
        this.drawPlaneLabel(data.normal, style, data.id);
    }

    /**
     * Add multiple striated fault planes
     */
    public addStriatedPlanes(data: StriatedPlaneData[], style: DataStyle = {}): void {
        data.forEach(plane => this.addStriatedPlane(plane, style));
    }

    /**
     * Add a pole (intersection of vector with hemisphere)
     */
    public addPole(data: PoleData, style: DataStyle = {}, symbol: string = 'circle'): void {
        this.drawPointFromVector(data.vector, style, symbol, data.id);
    }

    /**
     * Add multiple poles
     */
    public addPoles(data: PoleData[], style: DataStyle = {}, symbol: string = 'circle'): void {
        data.forEach(pole => this.addPole(pole, style, symbol));
    }

    /**
     * Add a stylolite pole
     */
    public addStylolitePole(data: PoleData, style: DataStyle = {}): void {
        this.drawPointFromVector(data.vector, style, 'cross', data.id);
    }

    /**
     * Add multiple stylolite poles
     */
    public addStylolitePoles(data: PoleData[], style: DataStyle = {}): void {
        data.forEach(pole => this.addStylolitePole(pole, style));
    }

    /**
     * Add a lineation
     */
    public addLineation(data: LineData, style: DataStyle = {}): void {
        this.drawPointFromVector(data.vector, style, 'triangle', data.id);
    }

    /**
     * Add multiple lineations
     */
    public addLineations(data: LineData[], style: DataStyle = {}): void {
        data.forEach(line => this.addLineation(line, style));
    }

    /**
     * Clear all data from the stereonet (keeping the base grid)
     */
    public clearData(): void {
        this.svg.selectAll('.data-element').remove();
        this.labelPositions = [];
    }

    /**
     * Update stereonet options
     */
    public updateOptions(newOptions: Partial<WulffOptions>): void {
        this.options = { ...this.options, ...newOptions };
        this.container.remove();
        this.initializeSVG(this.container.node()!.parentElement!.id);
        this.drawBaseStereonet();
    }

    /**
     * Export stereonet as SVG string
     */
    public exportSVG(): string {
        return new XMLSerializer().serializeToString(this.container.node()!);
    }

    /**
     * Get the SVG element for further manipulation
     */
    public getSVG(): d3.Selection<SVGSVGElement, unknown, null, undefined> {
        return this.container;
    }

    // ===================== Private Methods =====================

    private initializeSVG(containerId: string): void {
        d3.select(`#${containerId}`).select('svg').remove();

        this.container = d3.select(`#${containerId}`)
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .style('background-color', this.options.stereonetStyle!.backgroundColor!) as any;

        this.svg = this.container
            .append('g')
            .attr('transform', `translate(${this.centerX}, ${this.centerY})`) as any;
    }

    private drawBaseStereonet(): void {
        const style = this.options.stereonetStyle!;

        // Draw outer circle
        this.svg.append('circle')
            .attr('r', this.radius)
            .attr('fill', 'none')
            .attr('stroke', style.borderColor!)
            .attr('stroke-width', style.borderWidth!)
            .classed('axis', true);

        if (this.options.showGrid) {
            this.drawGrid();
        }

        if (this.options.showDirections) {
            this.drawDirections();
        }

        // Draw main axes
        this.svg.append('line')
            .attr('x1', -this.radius)
            .attr('y1', 0)
            .attr('x2', this.radius)
            .attr('y2', 0)
            .attr('stroke', style.borderColor!)
            .attr('stroke-width', style.borderWidth!)
            .classed('axis', true);

        this.svg.append('line')
            .attr('x1', 0)
            .attr('y1', -this.radius)
            .attr('x2', 0)
            .attr('y2', this.radius)
            .attr('stroke', style.borderColor!)
            .attr('stroke-width', style.borderWidth!)
            .classed('axis', true);
    }

    private drawGrid(): void {
        const style = this.options.stereonetStyle!;
        const interval = this.options.gridInterval!;

        // Draw latitude lines (small circles)
        for (let lat = interval; lat < 90; lat += interval) {
            const r = this.radius * Math.tan(Math.PI * lat / 360);
            if (r <= this.radius) {
                this.svg.append('circle')
                    .attr('r', r)
                    .attr('fill', 'none')
                    .attr('stroke', style.gridColor!)
                    .attr('stroke-width', style.gridWidth!)
                    .attr('stroke-dasharray', style.gridDashArray!)
                    .classed('grid', true);
            }
        }

        // Draw longitude lines (great circles) using vertical plane normals
        for (let angle = 0; angle < 360; angle += interval) {
            if (angle !== 0 && angle !== 90 && angle !== 180 && angle !== 270) {
                const angleRad = angle * Math.PI / 180;
                // Normal to a vertical plane at this azimuth
                const normal: Vector3D = {
                    x: Math.sin(angleRad),
                    y: Math.cos(angleRad),
                    z: 0
                };
                this.drawGreatCircleFromNormal(normal, {
                    color: style.gridColor,
                    width: style.gridWidth,
                    opacity: 0.5
                }, style.gridDashArray).classed('grid', true);
            }
        }
    }

    private drawDirections(): void {
        const style = this.options.stereonetStyle!;
        const directions = [
            { label: 'N', angle: 0 },
            { label: 'E', angle: 90 },
            { label: 'S', angle: 180 },
            { label: 'W', angle: 270 }
        ];

        this.svg.selectAll('.direction')
            .data(directions)
            .enter()
            .append('text')
            .attr('class', 'direction')
            .attr('x', d => (this.radius + 15) * Math.sin(d.angle * Math.PI / 180))
            .attr('y', d => -(this.radius + 15) * Math.cos(d.angle * Math.PI / 180))
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .text(d => d.label)
            .attr('font-weight', 'bold')
            .attr('font-size', style.labelSize!)
            .attr('fill', style.labelColor!);
    }

    /**
     * Project a 3D point to stereographic coordinates
     * Lower hemisphere projection: if z > 0, we flip the point
     */
    private projectVector(v: Vector3D): [number, number] {
        let { x, y, z } = normalize(v);

        // Project to lower hemisphere
        if (z > 0) {
            x = -x;
            y = -y;
            z = -z;
        }

        // Stereographic projection from lower hemisphere
        // Formula: (x', y') = R * (x, y) / (1 - z) for lower hemisphere
        const denom = 1 - z;
        if (denom === 0) {
            return [0, 0];
        }

        const projX = this.radius * x / denom;
        const projY = this.radius * y / denom;

        // Transform to screen coordinates (y points up in geology, down on screen)
        // x: East (right), y: North (up on stereonet = down in SVG)
        return [projX, -projY];
    }

    /**
     * Draw a great circle for a plane defined by its normal vector
     */
    private drawGreatCircleFromNormal(
        normal: Vector3D,
        style: DataStyle = {},
        dashArray?: string
    ): d3.Selection<SVGPathElement, unknown, null, undefined> {
        const defaultStyle = { ...this.options.defaultDataStyle, ...style };
        const n = normalize(normal);

        // Find two orthogonal vectors in the plane
        let u: Vector3D;
        if (Math.abs(n.z) < 0.9) {
            u = normalize(cross(n, { x: 0, y: 0, z: 1 }));
        } else {
            u = normalize(cross(n, { x: 1, y: 0, z: 0 }));
        }
        const v = cross(n, u);

        // Collect segments (each segment is a continuous arc in the lower hemisphere)
        const segments: [number, number][][] = [];
        let currentSegment: [number, number][] = [];

        // Helper to get point on circle at angle t
        const getPoint = (t: number): Vector3D => {
            const theta = t * Math.PI / 180;
            return {
                x: u.x * Math.cos(theta) + v.x * Math.sin(theta),
                y: u.y * Math.cos(theta) + v.y * Math.sin(theta),
                z: u.z * Math.cos(theta) + v.z * Math.sin(theta)
            };
        };

        // Helper to find the crossing point where z = 0 between two angles
        const findZeroCrossing = (t1: number, t2: number): [number, number] => {
            // Binary search for the angle where z = 0
            let low = t1;
            let high = t2;
            for (let i = 0; i < 20; i++) {
                const mid = (low + high) / 2;
                const p = getPoint(mid);
                if (Math.abs(p.z) < 1e-10) {
                    const len = Math.sqrt(p.x * p.x + p.y * p.y);
                    // Point is on equatorial plane, project to equatorial circle
                    return [this.radius * p.x / len, -this.radius * p.y / len];
                }
                const pLow = getPoint(low);
                if ((pLow.z > 0) === (p.z > 0)) {
                    low = mid;
                } else {
                    high = mid;
                }
            }
            // Return the midpoint projection
            const mid = (low + high) / 2;
            const p = getPoint(mid);
            const len = Math.sqrt(p.x * p.x + p.y * p.y);
            return [this.radius * p.x / len, -this.radius * p.y / len];
        };

        let prevT = 0;
        let prevP = getPoint(0);
        let prevInLower = prevP.z <= 0;

        if (prevInLower) {
            const [sx, sy] = this.projectVector(prevP);
            currentSegment.push([sx, sy]);
        }

        // Trace the great circle
        for (let t = 2; t <= 360; t += 2) {
            const p = getPoint(t);
            const inLower = p.z <= 0;

            if (inLower !== prevInLower) {
                // Crossing the equatorial plane
                const crossing = findZeroCrossing(prevT, t);

                if (prevInLower) {
                    // Exiting lower hemisphere: add crossing point and finish segment
                    currentSegment.push(crossing);
                    if (currentSegment.length > 1) {
                        segments.push(currentSegment);
                    }
                    currentSegment = [];
                } else {
                    // Entering lower hemisphere: start new segment with crossing point
                    currentSegment = [crossing];
                }
            }

            if (inLower) {
                const [sx, sy] = this.projectVector(p);
                currentSegment.push([sx, sy]);
            }

            prevT = t;
            prevP = p;
            prevInLower = inLower;
        }

        // Close the last segment if needed
        if (currentSegment.length > 1) {
            segments.push(currentSegment);
        }

        // If there are multiple segments, try to merge them if they form a continuous arc
        // (this happens when the circle wraps around 360°)
        if (segments.length === 2) {
            const first = segments[0];
            const last = segments[1];
            const firstStart = first[0];
            const lastEnd = last[last.length - 1];
            const dist = Math.sqrt(
                Math.pow(firstStart[0] - lastEnd[0], 2) +
                Math.pow(firstStart[1] - lastEnd[1], 2)
            );
            if (dist < 5) {
                // Merge: append first segment to end of last segment
                segments[1] = [...last, ...first];
                segments.shift();
            }
        }

        const lineGenerator = d3.line<[number, number]>()
            .x(d => d[0])
            .y(d => d[1]);

        // Draw all segments
        const pathData = segments.map(seg => lineGenerator(seg)).join(' ');

        const path = this.svg.append('path')
            .attr('d', pathData)
            .attr('fill', 'none')
            .attr('stroke', defaultStyle.color!)
            .attr('stroke-width', defaultStyle.width!)
            .attr('opacity', defaultStyle.opacity!)
            .classed('data-element', true);

        if (dashArray) {
            path.attr('stroke-dasharray', dashArray);
        }

        return path as any;
    }

    /**
     * Draw striation arrow from striation unit vector
     */
    private drawStriationVector(
        normal: Vector3D,
        striation: Vector3D,
        style: DataStyle = {},
        label?: string | number
    ): void {
        const defaultStyle = { ...this.options.defaultDataStyle, ...style };

        // Normalize vectors
        const n = normalize(normal);
        let s = normalize(striation);

        // Ensure striation is in the plane (project onto plane if not exactly)
        const sDotN = dot(s, n);
        s = normalize({
            x: s.x - sDotN * n.x,
            y: s.y - sDotN * n.y,
            z: s.z - sDotN * n.z
        });

        // Remember original z to determine arrow direction
        const originalZ = s.z;
        const horizontalThreshold = 0.01; // Threshold for considering striation as horizontal

        // Project to lower hemisphere if needed (but keep original z for direction)
        let projectedS = s;
        if (s.z > 0) {
            projectedS = { x: -s.x, y: -s.y, z: -s.z };
        }

        // Project the striation point to get start position
        const [startX, startY] = this.projectVector(projectedS);

        const arrowLength = defaultStyle.arrowLength!;
        const headSize = defaultStyle.arrowSize!;
        let endX: number, endY: number, angle: number;

        if (Math.abs(originalZ) < horizontalThreshold) {
            // Case 3: Striation is approximately horizontal
            // Arrow points in the direction of the striation vector (which is radial)
            // The striation's x,y components define the direction
            const dirX = s.x;
            const dirY = s.y;
            const dirLen = Math.sqrt(dirX * dirX + dirY * dirY);
            if (dirLen > 0) {
                // Transform to screen coordinates (y is flipped)
                angle = Math.atan2(-dirY, dirX);
            } else {
                angle = 0;
            }
            endX = startX + arrowLength * Math.cos(angle);
            endY = startY + arrowLength * Math.sin(angle);
        } else {
            // Calculate radial direction from the start point
            const radialLen = Math.sqrt(startX * startX + startY * startY);

            if (radialLen > 0) {
                // Unit vector pointing outward (away from center)
                const outwardX = startX / radialLen;
                const outwardY = startY / radialLen;

                if (originalZ > 0) {
                    // Case 1: Striation points upward - arrow points INWARD (toward center)
                    endX = startX - arrowLength * outwardX;
                    endY = startY - arrowLength * outwardY;
                    angle = Math.atan2(-outwardY, -outwardX);
                } else {
                    // Case 2: Striation points downward - arrow points OUTWARD (away from center)
                    endX = startX + arrowLength * outwardX;
                    endY = startY + arrowLength * outwardY;
                    angle = Math.atan2(outwardY, outwardX);
                }
            } else {
                // Start point is at center, default to pointing right
                angle = 0;
                endX = startX + arrowLength;
                endY = startY;
            }
        }

        // Draw arrow shaft
        this.svg.append('line')
            .attr('x1', startX)
            .attr('y1', startY)
            .attr('x2', endX)
            .attr('y2', endY)
            .attr('stroke', defaultStyle.color!)
            .attr('stroke-width', defaultStyle.width!)
            .attr('opacity', defaultStyle.opacity!)
            .classed('data-element', true);

        // Draw arrow head
        const head1X = endX - headSize * Math.cos(angle - Math.PI / 6);
        const head1Y = endY - headSize * Math.sin(angle - Math.PI / 6);
        const head2X = endX - headSize * Math.cos(angle + Math.PI / 6);
        const head2Y = endY - headSize * Math.sin(angle + Math.PI / 6);

        this.svg.append('path')
            .attr('d', `M${endX},${endY} L${head1X},${head1Y} L${head2X},${head2Y} Z`)
            .attr('fill', defaultStyle.color!)
            .attr('opacity', defaultStyle.opacity!)
            .classed('data-element', true);

        // Add label if provided
        if (label !== undefined && defaultStyle.showLabels) {
            const distanceFromCenter = Math.sqrt(startX * startX + startY * startY);

            if (distanceFromCenter > 0.8 * this.radius) {
                const labelAngle = Math.atan2(startY, startX);
                const labelRadius = this.radius + 20;
                const labelX = labelRadius * Math.cos(labelAngle);
                const labelY = labelRadius * Math.sin(labelAngle);

                this.svg.append('text')
                    .attr('x', labelX)
                    .attr('y', labelY)
                    .attr('text-anchor', 'middle')
                    .attr('dominant-baseline', 'central')
                    .text(label.toString())
                    .attr('fill', defaultStyle.color!)
                    .attr('font-size', '12px')
                    .classed('data-element', true);
            } else {
                this.svg.append('circle')
                    .attr('cx', startX)
                    .attr('cy', startY)
                    .attr('r', 8)
                    .attr('fill', 'white')
                    .attr('stroke', defaultStyle.color!)
                    .attr('stroke-width', 1)
                    .classed('data-element', true);

                this.svg.append('text')
                    .attr('x', startX)
                    .attr('y', startY)
                    .attr('text-anchor', 'middle')
                    .attr('dominant-baseline', 'central')
                    .text(label.toString())
                    .attr('fill', defaultStyle.color!)
                    .attr('font-size', '10px')
                    .classed('data-element', true);
            }
        }
    }

    /**
     * Check if a label position collides with existing labels
     */
    private checkLabelCollision(x: number, y: number, radius: number): boolean {
        for (const pos of this.labelPositions) {
            const dist = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
            if (dist < radius + pos.radius + 2) {
                return true; // Collision
            }
        }
        return false;
    }

    /**
     * Draw a circled label at a position with collision avoidance
     */
    private drawCircledLabel(
        x: number,
        y: number,
        label: string | number,
        color: string,
        labelRadius: number = 8
    ): void {
        // Register label position
        this.labelPositions.push({ x, y, radius: labelRadius });

        // Draw background circle
        this.svg.append('circle')
            .attr('cx', x)
            .attr('cy', y)
            .attr('r', labelRadius)
            .attr('fill', 'white')
            .attr('stroke', color)
            .attr('stroke-width', 1)
            .classed('data-element', true);

        // Draw label text
        this.svg.append('text')
            .attr('x', x)
            .attr('y', y)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .text(label.toString())
            .attr('fill', color)
            .attr('font-size', '10px')
            .classed('data-element', true);
    }

    /**
     * Draw a label for a plane (randomly positioned on the great circle)
     */
    private drawPlaneLabel(
        normal: Vector3D,
        style: DataStyle = {},
        label: string | number
    ): void {
        const defaultStyle = { ...this.options.defaultDataStyle, ...style };
        const n = normalize(normal);
        const labelRadius = 8;

        // Find two orthogonal vectors in the plane
        let u: Vector3D;
        if (Math.abs(n.z) < 0.9) {
            u = normalize(cross(n, { x: 0, y: 0, z: 1 }));
        } else {
            u = normalize(cross(n, { x: 1, y: 0, z: 0 }));
        }
        const v = cross(n, u);

        // Collect all candidate positions on the great circle (in lower hemisphere)
        const candidates: [number, number][] = [];
        for (let t = 0; t <= 360; t += 15) {
            const theta = t * Math.PI / 180;
            const px = u.x * Math.cos(theta) + v.x * Math.sin(theta);
            const py = u.y * Math.cos(theta) + v.y * Math.sin(theta);
            const pz = u.z * Math.cos(theta) + v.z * Math.sin(theta);

            if (pz <= 0) {
                const [sx, sy] = this.projectVector({ x: px, y: py, z: pz });
                // Only consider points inside the stereonet with some margin
                const dist = Math.sqrt(sx * sx + sy * sy);
                if (dist < this.radius * 0.9) {
                    candidates.push([sx, sy]);
                }
            }
        }

        if (candidates.length === 0) return;

        // Shuffle candidates for randomness
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }

        // Find a non-colliding position
        let labelPoint: [number, number] | null = null;
        for (const candidate of candidates) {
            if (!this.checkLabelCollision(candidate[0], candidate[1], labelRadius)) {
                labelPoint = candidate;
                break;
            }
        }

        // If all positions collide, use the first candidate anyway
        if (!labelPoint && candidates.length > 0) {
            labelPoint = candidates[0];
        }

        if (labelPoint) {
            this.drawCircledLabel(
                labelPoint[0],
                labelPoint[1],
                label,
                defaultStyle.color!,
                labelRadius
            );
        }
    }

    /**
     * Draw only the striation label (for separate rendering pass)
     */
    private drawStriationLabel(
        normal: Vector3D,
        striation: Vector3D,
        style: DataStyle = {},
        label?: string | number
    ): void {
        if (label === undefined) return;

        const defaultStyle = { ...this.options.defaultDataStyle, ...style };
        const labelRadius = 8;

        // Normalize vectors
        const n = normalize(normal);
        let s = normalize(striation);

        // Ensure striation is in the plane
        const sDotN = dot(s, n);
        s = normalize({
            x: s.x - sDotN * n.x,
            y: s.y - sDotN * n.y,
            z: s.z - sDotN * n.z
        });

        // Project to lower hemisphere if needed
        if (s.z > 0) {
            s = { x: -s.x, y: -s.y, z: -s.z };
        }

        // Project the striation point
        const [startX, startY] = this.projectVector(s);

        // Try the striation point first, then nearby offsets
        const offsets = [
            [0, 0],
            [15, 0], [-15, 0], [0, 15], [0, -15],
            [10, 10], [-10, 10], [10, -10], [-10, -10],
            [20, 0], [-20, 0], [0, 20], [0, -20],
        ];

        let labelX = startX;
        let labelY = startY;

        for (const [dx, dy] of offsets) {
            const testX = startX + dx;
            const testY = startY + dy;
            const dist = Math.sqrt(testX * testX + testY * testY);

            // Stay inside stereonet
            if (dist < this.radius * 0.95 && !this.checkLabelCollision(testX, testY, labelRadius)) {
                labelX = testX;
                labelY = testY;
                break;
            }
        }

        this.drawCircledLabel(labelX, labelY, label, defaultStyle.color!, labelRadius);
    }

    /**
     * Draw a point from a vector (pole = intersection with hemisphere)
     */
    private drawPointFromVector(
        vector: Vector3D,
        style: DataStyle = {},
        symbol: string = 'circle',
        label?: string | number
    ): void {
        const defaultStyle = { ...this.options.defaultDataStyle, ...style };
        const innerStyle = this.options.stereonetStyle!;

        const [x, y] = this.projectVector(vector);

        let element: d3.Selection<any, unknown, null, undefined>;

        switch (symbol) {
            case 'circle':
                element = this.svg.append('circle')
                    .attr('cx', x)
                    .attr('cy', y)
                    .attr('r', defaultStyle.size!)
                    .attr('fill', defaultStyle.fillColor || defaultStyle.color!)
                    .attr('stroke', defaultStyle.strokeColor || 'black')
                    .attr('stroke-width', 1);
                break;
            case 'square':
                element = this.svg.append('rect')
                    .attr('x', x - defaultStyle.size!)
                    .attr('y', y - defaultStyle.size!)
                    .attr('width', defaultStyle.size! * 2)
                    .attr('height', defaultStyle.size! * 2)
                    .attr('fill', defaultStyle.fillColor || defaultStyle.color!)
                    .attr('stroke', defaultStyle.strokeColor || 'black')
                    .attr('stroke-width', 1);
                break;
            case 'triangle': {
                const size = defaultStyle.size!;
                element = this.svg.append('path')
                    .attr('d', `M${x},${y - size} L${x - size},${y + size} L${x + size},${y + size} Z`)
                    .attr('fill', defaultStyle.fillColor || defaultStyle.color!)
                    .attr('stroke', defaultStyle.strokeColor || 'black')
                    .attr('stroke-width', 1);
                break;
            }
            case 'cross': {
                const g = this.svg.append('g');
                g.append('line')
                    .attr('x1', x - defaultStyle.size!)
                    .attr('y1', y)
                    .attr('x2', x + defaultStyle.size!)
                    .attr('y2', y)
                    .attr('stroke', defaultStyle.color!)
                    .attr('stroke-width', defaultStyle.width!);
                g.append('line')
                    .attr('x1', x)
                    .attr('y1', y - defaultStyle.size!)
                    .attr('x2', x)
                    .attr('y2', y + defaultStyle.size!)
                    .attr('stroke', defaultStyle.color!)
                    .attr('stroke-width', defaultStyle.width!);
                element = g;
                break;
            }
            default:
                element = this.svg.append('circle')
                    .attr('cx', x)
                    .attr('cy', y)
                    .attr('r', defaultStyle.size!)
                    .attr('fill', defaultStyle.fillColor || defaultStyle.color!);
        }

        element.attr('opacity', defaultStyle.opacity!).classed('data-element', true);

        const fontSize = parseFloat(innerStyle.labelSize as string) * 0.8;

        if (label !== undefined && defaultStyle.showLabels) {
            this.svg.append('text')
                .attr('x', x + defaultStyle.size! + 5)
                .attr('y', y + 3)
                .text(label.toString())
                .attr('fill', defaultStyle.color!)
                .attr('font-size', `${fontSize}px`)
                .classed('data-element', true);
        }
    }
}

// ---------------------------- PRIVATE ----------------------------

// Vector utility functions
function normalize(v: Vector3D): Vector3D {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (len === 0) return { x: 0, y: 0, z: 1 };
    return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function cross(a: Vector3D, b: Vector3D): Vector3D {
    return {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x
    };
}

function dot(a: Vector3D, b: Vector3D): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}
