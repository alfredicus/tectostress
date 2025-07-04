import * as d3 from 'd3';

// Types for geological data
export interface Point3D {
    x: number;
    y: number;
    z: number;
}

export interface PlaneData {
    strike: number;
    dip: number;
    dipDirection?: string;
}

export interface StriatedPlaneData extends PlaneData {
    rake: number;
    strikeDirection?: string;
    typeOfMovement?: string;
    id?: number | string;
}

export interface PoleData {
    trend: number;
    plunge: number;
    id?: number | string;
}

export interface ExtensionFractureData extends PlaneData {
    id?: number | string;
}

export interface LineData {
    trend: number;
    plunge: number;
    id?: number | string;
}

// Styling options
export interface StereonetStyle {
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
    showLabels?: boolean;
}

// Configuration options
export interface WulffStereonetOptions {
    width?: number;
    height?: number;
    margin?: number;
    gridInterval?: number;
    showGrid?: boolean;
    showDirections?: boolean;
    showLabels?: boolean;
    stereonetStyle?: StereonetStyle;
    defaultDataStyle?: DataStyle;
}

/**
 * WulffStereonet class for plotting geological data on a stereographic projection
 * Supports striated fault planes, poles, extension fractures, and other geological structures
 */
export class WulffStereonet {
    private svg: d3.Selection<SVGGElement, unknown, null, undefined>;
    private container: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private width: number;
    private height: number;
    private radius: number;
    private centerX: number;
    private centerY: number;
    private options: WulffStereonetOptions;

    constructor(containerId: string, options: WulffStereonetOptions = {}) {
        // Set default options
        this.options = {
            width: 400,
            height: 400,
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
                arrowSize: 15,
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

    private initializeSVG(containerId: string): void {
        // Remove any existing SVG
        d3.select(`#${containerId}`).select('svg').remove();

        this.container = d3.select(`#${containerId}`)
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .style('background-color', this.options.stereonetStyle!.backgroundColor);

        this.svg = this.container
            .append('g')
            .attr('transform', `translate(${this.centerX}, ${this.centerY})`);
    }

    private drawBaseStereonet(): void {
        const style = this.options.stereonetStyle!;

        // Draw outer circle
        this.svg.append('circle')
            .attr('r', this.radius)
            .attr('fill', 'none')
            .attr('stroke', style.borderColor)
            .attr('stroke-width', style.borderWidth)
            .classed('axis', true)

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
            .attr('stroke', style.borderColor)
            .attr('stroke-width', style.borderWidth)
            .classed('axis', true)

        this.svg.append('line')
            .attr('x1', 0)
            .attr('y1', -this.radius)
            .attr('x2', 0)
            .attr('y2', this.radius)
            .attr('stroke', style.borderColor)
            .attr('stroke-width', style.borderWidth)
            .classed('axis', true)
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
                    .attr('stroke', style.gridColor)
                    .attr('stroke-width', style.gridWidth)
                    .attr('stroke-dasharray', style.gridDashArray)
                    .classed('grid', true)
            }
        }

        // Draw longitude lines (great circles)
        for (let long = 0; long < 360; long += interval) {
            if (long !== 0 && long !== 90 && long !== 180 && long !== 270) {
                this.drawGreatCircle(long, 90, {
                    color: style.gridColor,
                    width: style.gridWidth,
                    opacity: 0.5
                }, style.gridDashArray).classed('grid', true)
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
            .attr('font-size', style.labelSize)
            .attr('fill', style.labelColor);
    }

    /**
     * Convert spherical coordinates to stereographic projection
     */
    private projectPoint(longitude: number, latitude: number): [number, number] {
        const r = this.radius * Math.tan((90 - latitude) * Math.PI / 360);
        const longRad = longitude * Math.PI / 180 - Math.PI / 2;
        const x = r * Math.cos(longRad);
        const y = r * Math.sin(longRad);
        return [x, y];
    }

    /**
     * Convert plane orientation to pole coordinates
     */
    private planeTopole(strike: number, dip: number): { trend: number; plunge: number } {
        const trend = (strike + 90) % 360;
        const plunge = 90 - dip;
        return { trend, plunge };
    }

    /**
     * Draw a great circle for a plane
     */
    private drawGreatCircle(strike: number, dip: number, style: DataStyle = {}, dashArray?: string): d3.Selection<SVGPathElement, unknown, null, undefined> {
        const defaultStyle = { ...this.options.defaultDataStyle, ...style };

        const strikeRad = strike * Math.PI / 180;
        const dipRad = dip * Math.PI / 180;

        const points: [number, number][] = [];

        for (let t = -90; t <= 90; t += 1) {
            const tRad = t * Math.PI / 180;

            // Calculate point on the plane
            let x = Math.cos(tRad);
            let y = Math.sin(tRad);
            let z = 0;

            // Rotate to align with strike and dip
            const tempX = x;
            x = tempX * Math.cos(dipRad) + z * Math.sin(dipRad);
            z = -tempX * Math.sin(dipRad) + z * Math.cos(dipRad);

            const tempX2 = x;
            x = tempX2 * Math.cos(strikeRad) + y * Math.sin(strikeRad);
            y = -tempX2 * Math.sin(strikeRad) + y * Math.cos(strikeRad);

            // Project points in lower hemisphere
            if (z <= 0) {
                const zAbs = Math.abs(z);
                const r = this.radius * Math.sqrt((1 - zAbs) / (1 + zAbs));
                const norm = Math.sqrt(x * x + y * y);
                if (norm > 0) {
                    points.push([r * x / norm, -r * y / norm]);
                }
            }
        }

        const lineGenerator = d3.line<[number, number]>()
            .x(d => d[0])
            .y(d => d[1]);

        const path = this.svg.append('path')
            .attr('d', lineGenerator(points))
            .attr('fill', 'none')
            .attr('stroke', defaultStyle.color)
            .attr('stroke-width', defaultStyle.width)
            .attr('opacity', defaultStyle.opacity);

        if (dashArray) {
            path.attr('stroke-dasharray', dashArray);
        }

        return path;
    }

    /**
     * Draw an arrow for striation direction
     */
    private drawStriation(strike: number, dip: number, rake: number, style: DataStyle = {}, label?: string | number): void {
        const defaultStyle = { ...this.options.defaultDataStyle, ...style };

        const strikeRad = strike * Math.PI / 180;
        const dipRad = dip * Math.PI / 180;
        const rakeRad = rake * Math.PI / 180;

        // Calculate striation vector on the fault plane
        let sx = Math.cos(rakeRad);
        let sy = Math.sin(rakeRad);
        let sz = 0;

        // Rotate to fault plane orientation
        const tempSx = sx;
        sx = tempSx * Math.cos(dipRad) + sz * Math.sin(dipRad);
        sz = -tempSx * Math.sin(dipRad) + sz * Math.cos(dipRad);

        const tempSx2 = sx;
        sx = tempSx2 * Math.cos(strikeRad) + sy * Math.sin(strikeRad);
        sy = -tempSx2 * Math.sin(strikeRad) + sy * Math.cos(strikeRad);

        // Project to lower hemisphere if necessary
        if (sz > 0) {
            sx = -sx;
            sy = -sy;
            sz = -sz;
        }

        // Stereographic projection
        const zAbs = Math.abs(sz);
        const r = this.radius * Math.sqrt((1 - zAbs) / (1 + zAbs));
        const norm = Math.sqrt(sx * sx + sy * sy);

        if (norm > 0) {
            const startX = r * sx / norm;
            const startY = -r * sy / norm;

            // Calculate arrow direction
            const arrowLength = defaultStyle.arrowSize!;
            const angle = Math.atan2(-sy, sx);

            const endX = startX + arrowLength * Math.cos(angle);
            const endY = startY + arrowLength * Math.sin(angle);

            // Draw arrow shaft
            this.svg.append('line')
                .attr('x1', startX)
                .attr('y1', startY)
                .attr('x2', endX)
                .attr('y2', endY)
                .attr('stroke', defaultStyle.color)
                .attr('stroke-width', defaultStyle.width)
                .attr('opacity', defaultStyle.opacity);

            // Draw arrow head
            const headSize = defaultStyle.arrowSize! * 0.6;
            const head1X = endX - headSize * Math.cos(angle - Math.PI / 6);
            const head1Y = endY - headSize * Math.sin(angle - Math.PI / 6);
            const head2X = endX - headSize * Math.cos(angle + Math.PI / 6);
            const head2Y = endY - headSize * Math.sin(angle + Math.PI / 6);

            this.svg.append('path')
                .attr('d', `M${endX},${endY} L${head1X},${head1Y} L${head2X},${head2Y} Z`)
                .attr('fill', defaultStyle.color)
                .attr('opacity', defaultStyle.opacity);

            // Add label if provided
            if (label !== undefined && defaultStyle.showLabels) {
                const distanceFromCenter = Math.sqrt(startX * startX + startY * startY);

                if (distanceFromCenter > 0.8 * this.radius) {
                    // Place label outside the circle
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
                        .attr('fill', defaultStyle.color)
                        .attr('font-size', '12px');
                } else {
                    // Place label in a circle at the arrow start
                    this.svg.append('circle')
                        .attr('cx', startX)
                        .attr('cy', startY)
                        .attr('r', 8)
                        .attr('fill', 'white')
                        .attr('stroke', defaultStyle.color)
                        .attr('stroke-width', 1);

                    this.svg.append('text')
                        .attr('x', startX)
                        .attr('y', startY)
                        .attr('text-anchor', 'middle')
                        .attr('dominant-baseline', 'central')
                        .text(label.toString())
                        .attr('fill', defaultStyle.color)
                        .attr('font-size', '10px');
                }
            }
        }
    }

    /**
     * Draw a point (pole) on the stereonet
     */
    private drawPoint(trend: number, plunge: number, style: DataStyle = {}, symbol: string = 'circle', label?: string | number): void {
        const defaultStyle = { ...this.options.defaultDataStyle, ...style };
        const [x, y] = this.projectPoint(trend, plunge);

        let element: d3.Selection<any, unknown, null, undefined>;

        switch (symbol) {
            case 'circle':
                element = this.svg.append('circle')
                    .attr('cx', x)
                    .attr('cy', y)
                    .attr('r', defaultStyle.size)
                    .attr('fill', defaultStyle.fillColor || defaultStyle.color)
                    .attr('stroke', defaultStyle.strokeColor || 'black')
                    .attr('stroke-width', 1);
                break;
            case 'square':
                element = this.svg.append('rect')
                    .attr('x', x - defaultStyle.size!)
                    .attr('y', y - defaultStyle.size!)
                    .attr('width', defaultStyle.size! * 2)
                    .attr('height', defaultStyle.size! * 2)
                    .attr('fill', defaultStyle.fillColor || defaultStyle.color)
                    .attr('stroke', defaultStyle.strokeColor || 'black')
                    .attr('stroke-width', 1);
                break;
            case 'triangle':
                const size = defaultStyle.size!;
                element = this.svg.append('path')
                    .attr('d', `M${x},${y - size} L${x - size},${y + size} L${x + size},${y + size} Z`)
                    .attr('fill', defaultStyle.fillColor || defaultStyle.color)
                    .attr('stroke', defaultStyle.strokeColor || 'black')
                    .attr('stroke-width', 1);
                break;
            case 'cross':
                const g = this.svg.append('g');
                g.append('line')
                    .attr('x1', x - defaultStyle.size!)
                    .attr('y1', y)
                    .attr('x2', x + defaultStyle.size!)
                    .attr('y2', y)
                    .attr('stroke', defaultStyle.color)
                    .attr('stroke-width', defaultStyle.width);
                g.append('line')
                    .attr('x1', x)
                    .attr('y1', y - defaultStyle.size!)
                    .attr('x2', x)
                    .attr('y2', y + defaultStyle.size!)
                    .attr('stroke', defaultStyle.color)
                    .attr('stroke-width', defaultStyle.width);
                element = g;
                break;
            default:
                element = this.svg.append('circle')
                    .attr('cx', x)
                    .attr('cy', y)
                    .attr('r', defaultStyle.size)
                    .attr('fill', defaultStyle.fillColor || defaultStyle.color);
        }

        element.attr('opacity', defaultStyle.opacity);

        // Add label if provided
        if (label !== undefined && defaultStyle.showLabels) {
            this.svg.append('text')
                .attr('x', x + defaultStyle.size! + 5)
                .attr('y', y + 3)
                .text(label.toString())
                .attr('fill', defaultStyle.color)
                .attr('font-size', '10px');
        }
    }

    // Public methods for adding different types of geological data

    /**
     * Add a striated fault plane
     */
    public addStriatedPlane(data: StriatedPlaneData, style: DataStyle = {}): void {
        // Draw the fault plane as a great circle
        this.drawGreatCircle(data.strike, data.dip, { ...style, opacity: 0.7 });

        // Draw the striation arrow
        this.drawStriation(data.strike, data.dip, data.rake, style, data.id);
    }

    /**
     * Add multiple striated fault planes
     */
    public addStriatedPlanes(data: StriatedPlaneData[], style: DataStyle = {}): void {
        data.forEach(plane => this.addStriatedPlane(plane, style));
    }

    /**
     * Add an extension fracture (great circle)
     */
    public addExtensionFracture(data: ExtensionFractureData, style: DataStyle = {}): void {
        this.drawGreatCircle(data.strike, data.dip, style);

        // Optionally add pole point
        const pole = this.planeTopole(data.strike, data.dip);
        this.drawPoint(pole.trend, pole.plunge, {
            ...style,
            size: (style.size || 4) / 2,
            fillColor: 'white',
            strokeColor: style.color || 'blue'
        }, 'circle', data.id);
    }

    /**
     * Add multiple extension fractures
     */
    public addExtensionFractures(data: ExtensionFractureData[], style: DataStyle = {}): void {
        data.forEach(fracture => this.addExtensionFracture(fracture, style));
    }

    /**
     * Add a stylolite pole
     */
    public addStylolitePole(data: PoleData, style: DataStyle = {}): void {
        this.drawPoint(data.trend, data.plunge, style, 'cross', data.id);
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
        this.drawPoint(data.trend, data.plunge, style, 'triangle', data.id);
    }

    /**
     * Add multiple lineations
     */
    public addLineations(data: LineData[], style: DataStyle = {}): void {
        data.forEach(line => this.addLineation(line, style));
    }

    /**
     * Add a generic pole point
     */
    public addPole(data: PoleData, style: DataStyle = {}, symbol: string = 'circle'): void {
        this.drawPoint(data.trend, data.plunge, style, symbol, data.id);
    }

    /**
     * Add multiple poles
     */
    public addPoles(data: PoleData[], style: DataStyle = {}, symbol: string = 'circle'): void {
        data.forEach(pole => this.addPole(pole, style, symbol));
    }

    /**
     * Clear all data from the stereonet (keeping the base grid)
     */
    public clearData(): void {
        this.svg.selectAll('*:not(.grid):not(.axis):not(.direction)')
            .filter(function () {
                const element = d3.select(this);
                return !element.classed('grid') &&
                    !element.classed('axis') &&
                    !element.classed('direction') &&
                    element.node()?.tagName !== 'circle' ||
                    (element.node()?.tagName === 'circle' &&
                        parseFloat(element.attr('r')) !== this.radius);
            })
            .remove();
        // this.svg.selectAll('path:not(.grid)')
        //     .filter(function () {
        //         return !d3.select(this).classed('grid');
        //     })
        //     .remove();
        // this.svg.selectAll('circle:not(.grid)')
        //     .filter(function () {
        //         return !d3.select(this).classed('grid');
        //     })
        //     .remove();
        // this.svg.selectAll('rect').remove();
        // this.svg.selectAll('line:not(.grid)')
        //     .filter(function () {
        //         return !d3.select(this).classed('grid');
        //     })
        //     .remove();
        // this.svg.selectAll('text:not(.direction)').remove();
    }

    /**
     * Update stereonet options
     */
    public updateOptions(newOptions: Partial<WulffStereonetOptions>): void {
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
}
