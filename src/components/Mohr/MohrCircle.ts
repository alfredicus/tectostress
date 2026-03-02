import * as d3 from 'd3'

/**
 * Represents a normal vector with an optional color for visualization
 * @category Mohr Circle
 */
export type NormalVector = {
    id: string
    n1: number
    n2: number
    n3: number
    color?: string
    label?: string
}

/**
 * @category Mohr Circle
 */
export type MohrParameters = {
    width?: number,
    height?: number,
    margin?: {
        top?: number,
        right?: number,
        bottom?: number,
        left?: number
    },
    draw?: {
        grid?: boolean,
        labels?: boolean,
        axes?: boolean,
        coloredArea?: boolean,
        stressPoint?: boolean
    },
    colors?: {
        circle1?: string,      // σ1-σ3 circle
        circle2?: string,      // σ1-σ2 circle
        circle3?: string,      // σ2-σ3 circle
        area?: string,         // Colored area
        stressPoint?: string,  // (σn, τ) point
        principalPoints?: string
    },
    strokeWidth?: number,
    xAxisLabel?: string,
    yAxisLabel?: string,
    title?: string
}

/**
 * @category Mohr Circle
 */
export const DefaultMohrParameters: MohrParameters = {
    width: 600,
    height: 400,
    margin: {
        top: 40,
        right: 40,
        bottom: 60,
        left: 60
    },
    draw: {
        grid: true,
        labels: true,
        axes: true,
        coloredArea: true,
        stressPoint: true
    },
    colors: {
        circle1: '#0066cc',    // Blue for σ1-σ3
        circle2: '#ff6b35',    // Red for σ1-σ2
        circle3: '#28a745',    // Green for σ2-σ3
        area: 'rgba(200, 200, 200, 0.3)',
        stressPoint: '#8e44ad',
        principalPoints: '#333333'
    },
    strokeWidth: 2,
    xAxisLabel: 'Normal Stress (σ)',
    yAxisLabel: 'Shear Stress (τ)',
    title: ''
}

/**
 * @category Mohr Circle
 */
export class MohrCircle {
    private element_: HTMLElement
    private svg_!: d3.Selection<SVGSVGElement, unknown, null, undefined>
    private chartGroup_!: d3.Selection<SVGGElement, unknown, null, undefined>
    params: MohrParameters = DefaultMohrParameters

    // Principal stresses (σ1 >= σ2 >= σ3)
    private sigma1_: number = 100
    private sigma2_: number = 60
    private sigma3_: number = 20

    // Multiple normal vectors
    private normalVectors_: NormalVector[] = []
    private nextVectorId_: number = 1

    // Default colors for stress points (cycle through these)
    private static readonly VECTOR_COLORS = [
        '#8e44ad', // Purple
        '#e74c3c', // Red
        '#27ae60', // Green
        '#f39c12', // Orange
        '#3498db', // Blue
        '#1abc9c', // Teal
        '#e91e63', // Pink
        '#9c27b0', // Deep Purple
    ]

    constructor(element: HTMLElement, params: MohrParameters = DefaultMohrParameters) {
        this.element_ = element
        this.params = { ...DefaultMohrParameters, ...params }

        // Merge nested objects properly
        if (params.margin) {
            this.params.margin = { ...DefaultMohrParameters.margin, ...params.margin }
        }
        if (params.draw) {
            this.params.draw = { ...DefaultMohrParameters.draw, ...params.draw }
        }
        if (params.colors) {
            this.params.colors = { ...DefaultMohrParameters.colors, ...params.colors }
        }

        // Validate and ensure proper stress order
        this.ensurePrincipalStressOrder()

        // Initialize with a default normal vector
        const defaultN = 1 / Math.sqrt(3)
        this.addNormalVector([defaultN, defaultN, defaultN])

        this.initializeSVG()
        this.update()
    }

    private initializeSVG(): void {
        // Clear any existing content
        d3.select(this.element_).selectAll("*").remove()

        this.svg_ = d3.select(this.element_)
            .append('svg')
            .attr('width', this.params.width!)
            .attr('height', this.params.height!)

        this.chartGroup_ = this.svg_.append('g')
            .attr('transform', `translate(${this.params.margin!.left}, ${this.params.margin!.top})`)
    }

    // Getters and setters
    set width(w: number) {
        this.params.width = w
        this.svg_.attr('width', w)
        this.update()
    }

    set height(h: number) {
        this.params.height = h
        this.svg_.attr('height', h)
        this.update()
    }

    set sigma1(value: number) {
        this.sigma1_ = value
        this.ensurePrincipalStressOrder()
        this.update()
    }

    set sigma2(value: number) {
        this.sigma2_ = value
        this.ensurePrincipalStressOrder()
        this.update()
    }

    set sigma3(value: number) {
        this.sigma3_ = value
        this.ensurePrincipalStressOrder()
        this.update()
    }

    get sigma1() { return this.sigma1_ }
    get sigma2() { return this.sigma2_ }
    get sigma3() { return this.sigma3_ }

    /**
     * Legacy setter for single normal vector - updates the first vector or adds one
     */
    set normalVector(n: [number, number, number]) {
        const [n1, n2, n3] = this.normalizeVector(n[0], n[1], n[2])
        if (this.normalVectors_.length > 0) {
            this.normalVectors_[0].n1 = n1
            this.normalVectors_[0].n2 = n2
            this.normalVectors_[0].n3 = n3
        } else {
            this.addNormalVector(n)
        }
        this.update()
    }

    /**
     * Legacy getter for single normal vector - returns the first vector
     */
    get normalVector(): [number, number, number] {
        if (this.normalVectors_.length > 0) {
            const v = this.normalVectors_[0]
            return [v.n1, v.n2, v.n3]
        }
        return [0, 0, 0]
    }

    /**
     * Add a new normal vector
     * @returns The ID of the newly added vector
     */
    addNormalVector(n: [number, number, number], color?: string, label?: string): string {
        const [n1, n2, n3] = this.normalizeVector(n[0], n[1], n[2])
        const id = `vec_${this.nextVectorId_++}`
        const vectorColor = color || MohrCircle.VECTOR_COLORS[(this.normalVectors_.length) % MohrCircle.VECTOR_COLORS.length]

        this.normalVectors_.push({
            id,
            n1,
            n2,
            n3,
            color: vectorColor,
            label: label || `n${this.normalVectors_.length + 1}`
        })
        this.update()
        return id
    }

    /**
     * Remove a normal vector by ID
     */
    removeNormalVector(id: string): boolean {
        const index = this.normalVectors_.findIndex(v => v.id === id)
        if (index !== -1) {
            this.normalVectors_.splice(index, 1)
            this.update()
            return true
        }
        return false
    }

    /**
     * Update an existing normal vector
     */
    updateNormalVector(id: string, n: [number, number, number], color?: string, label?: string): boolean {
        const vector = this.normalVectors_.find(v => v.id === id)
        if (vector) {
            const [n1, n2, n3] = this.normalizeVector(n[0], n[1], n[2])
            vector.n1 = n1
            vector.n2 = n2
            vector.n3 = n3
            if (color !== undefined) vector.color = color
            if (label !== undefined) vector.label = label
            this.update()
            return true
        }
        return false
    }

    /**
     * Get all normal vectors
     */
    get normalVectors(): NormalVector[] {
        return [...this.normalVectors_]
    }

    /**
     * Set all normal vectors at once (replaces existing vectors)
     */
    setNormalVectors(vectors: Array<{ n: [number, number, number], color?: string, label?: string }>): void {
        this.normalVectors_ = []
        this.nextVectorId_ = 1
        vectors.forEach(v => {
            this.addNormalVector(v.n, v.color, v.label)
        })
    }

    /**
     * Clear all normal vectors
     */
    clearNormalVectors(): void {
        this.normalVectors_ = []
        this.update()
    }

    setPrincipalStresses(sigma1: number, sigma2: number, sigma3: number): void {
        this.sigma1_ = sigma1
        this.sigma2_ = sigma2
        this.sigma3_ = sigma3
        this.ensurePrincipalStressOrder()
        this.update()
    }

    private ensurePrincipalStressOrder(): void {
        // The order σ1 >= σ2 >= σ3 is now managed by the React component
        // with coupled sliders. We no longer sort here to avoid
        // disconnection between sliders and display.
    }

    private normalizeVector(n1: number, n2: number, n3: number): [number, number, number] {
        const magnitude = Math.sqrt(n1 * n1 + n2 * n2 + n3 * n3)
        if (magnitude === 0) return [0, 0, 0]
        return [n1 / magnitude, n2 / magnitude, n3 / magnitude]
    }

    private calculateStressPointForVector(vector: NormalVector): { sigma_n: number, tau: number } {
        // Validate normal vector components
        if (!isFinite(vector.n1) || !isFinite(vector.n2) || !isFinite(vector.n3)) {
            console.warn('Mohr Circle: Invalid normal vector components', vector)
            return { sigma_n: 0, tau: 0 }
        }

        // Validate stress values
        if (!isFinite(this.sigma1_) || !isFinite(this.sigma2_) || !isFinite(this.sigma3_)) {
            console.warn('Mohr Circle: Invalid stress values in calculation', { sigma1: this.sigma1_, sigma2: this.sigma2_, sigma3: this.sigma3_ })
            return { sigma_n: 0, tau: 0 }
        }

        // Coordinate system: (x, y, z) = (σ1, σ3, σ2)
        // n1 → σ1, n2 → σ3, n3 → σ2
        const sigma_n = this.sigma1_ * vector.n1 * vector.n1 +
            this.sigma3_ * vector.n2 * vector.n2 +
            this.sigma2_ * vector.n3 * vector.n3

        const sigma_squared = (this.sigma1_ * vector.n1) ** 2 +
            (this.sigma3_ * vector.n2) ** 2 +
            (this.sigma2_ * vector.n3) ** 2

        const tau = Math.sqrt(Math.max(0, sigma_squared - sigma_n ** 2))

        // Validate results
        if (!isFinite(sigma_n) || !isFinite(tau)) {
            console.warn('Mohr Circle: Invalid stress point calculation result', { sigma_n, tau })
            return { sigma_n: 0, tau: 0 }
        }

        return { sigma_n, tau }
    }

    /**
     * Legacy method - calculates stress point for the first vector
     */
    private calculateStressPoint(): { sigma_n: number, tau: number } {
        if (this.normalVectors_.length === 0) {
            return { sigma_n: 0, tau: 0 }
        }
        return this.calculateStressPointForVector(this.normalVectors_[0])
    }

    /**
     * Get stress points for all normal vectors
     */
    getAllStressPoints(): Array<{ id: string, sigma_n: number, tau: number, color: string, label: string }> {
        return this.normalVectors_.map(vector => {
            const { sigma_n, tau } = this.calculateStressPointForVector(vector)
            return {
                id: vector.id,
                sigma_n,
                tau,
                color: vector.color || '#8e44ad',
                label: vector.label || vector.id
            }
        })
    }

    update(): void {
        // Validate element and parameters
        if (!this.element_ || !this.svg_ || !this.chartGroup_) {
            console.warn('Mohr Circle: Invalid element or SVG state')
            return
        }

        // Ensure stress values are valid numbers
        if (!isFinite(this.sigma1_) || !isFinite(this.sigma2_) || !isFinite(this.sigma3_)) {
            console.warn('Mohr Circle: Invalid stress values', { sigma1: this.sigma1_, sigma2: this.sigma2_, sigma3: this.sigma3_ })
            return
        }

        // Clear previous chart content
        this.chartGroup_.selectAll("*").remove()

        const chartWidth = this.params.width! - this.params.margin!.left! - this.params.margin!.right!
        const chartHeight = this.params.height! - this.params.margin!.top! - this.params.margin!.bottom!

        // Ensure minimum dimensions
        if (chartWidth <= 0 || chartHeight <= 0) {
            console.warn('Mohr Circle: Invalid chart dimensions', { chartWidth, chartHeight })
            return
        }

        // Calculate scales - optimized for upper half-plane (τ > 0)
        // Rock mechanics convention: σ3 <= σ2 <= σ1
        const minStress = Math.min(this.sigma1_, this.sigma2_, this.sigma3_)
        const maxStress = Math.max(this.sigma1_, this.sigma2_, this.sigma3_)
        const stressRange = maxStress - minStress
        const maxTau = Math.max(stressRange / 2, 1)

        // Padding
        const padding = Math.max(stressRange * 0.05, 5)

        // Data ranges
        const xDataMin = minStress - padding
        const xDataMax = maxStress + padding
        const xDataRange = xDataMax - xDataMin

        const yDataMin = -padding * 0.5
        const yDataMax = maxTau + padding
        const yDataRange = yDataMax - yDataMin

        // Calculate scale factors to maintain aspect ratio (1:1)
        // We want the same number of pixels per unit on both axes
        const xScaleFactor = chartWidth / xDataRange
        const yScaleFactor = chartHeight / yDataRange

        // Use the smaller scale factor to fit everything
        const scaleFactor = Math.min(xScaleFactor, yScaleFactor)

        // Calculate actual pixel ranges with uniform scaling
        const xPixelRange = xDataRange * scaleFactor
        const yPixelRange = yDataRange * scaleFactor

        // Center the chart if there's extra space
        const xOffset = (chartWidth - xPixelRange) / 2
        const yOffset = (chartHeight - yPixelRange) / 2

        // Create scales with uniform aspect ratio
        const xScale = d3.scaleLinear()
            .domain([xDataMin, xDataMax])
            .range([xOffset, xOffset + xPixelRange])

        const yScale = d3.scaleLinear()
            .domain([yDataMin, yDataMax])
            .range([yOffset + yPixelRange, yOffset])

        // Validate scales
        if (!xScale || !yScale) {
            console.warn('Mohr Circle: Failed to create scales')
            return
        }

        // Draw grid if enabled
        if (this.params.draw!.grid) {
            // Vertical grid lines
            this.chartGroup_.selectAll('.grid-line-x')
                .data(xScale.ticks())
                .enter()
                .append('line')
                .attr('class', 'grid-line-x')
                .attr('x1', d => xScale(d))
                .attr('x2', d => xScale(d))
                .attr('y1', 0)
                .attr('y2', chartHeight)
                .attr('stroke', '#e0e0e0')
                .attr('stroke-width', 0.5)

            // Horizontal grid lines
            this.chartGroup_.selectAll('.grid-line-y')
                .data(yScale.ticks())
                .enter()
                .append('line')
                .attr('class', 'grid-line-y')
                .attr('x1', 0)
                .attr('x2', chartWidth)
                .attr('y1', d => yScale(d))
                .attr('y2', d => yScale(d))
                .attr('stroke', '#e0e0e0')
                .attr('stroke-width', 0.5)
        }

        // Draw colored area between circles
        if (this.params.draw!.coloredArea) {
            this.drawColoredArea(xScale, yScale)
        }

        // Draw the three Mohr circles (upper half only)
        this.drawHalfCircle(xScale, yScale, this.sigma3_, this.sigma1_, this.params.colors!.circle1!) // σ1-σ3
        this.drawHalfCircle(xScale, yScale, this.sigma2_, this.sigma1_, this.params.colors!.circle2!) // σ1-σ2
        this.drawHalfCircle(xScale, yScale, this.sigma3_, this.sigma2_, this.params.colors!.circle3!) // σ2-σ3

        // Draw principal stress points with validation
        const stressValues = [this.sigma1_, this.sigma2_, this.sigma3_]
        const stressLabels = ['σ1', 'σ2', 'σ3']

        stressValues.forEach((sigma, i) => {
            if (!isFinite(sigma)) {
                console.warn(`Mohr Circle: Invalid stress value at index ${i}:`, sigma)
                return
            }

            try {
                this.chartGroup_.append('circle')
                    .attr('cx', xScale(sigma))
                    .attr('cy', yScale(0))
                    .attr('r', 4)
                    .attr('fill', this.params.colors!.principalPoints!)
                    .on('mouseover', (event) => {
                        // Show tooltip
                        const tooltip = d3.select('body').append('div')
                            .attr('class', 'mohr-tooltip')
                            .style('position', 'absolute')
                            .style('background', 'rgba(0, 0, 0, 0.8)')
                            .style('color', 'white')
                            .style('padding', '8px')
                            .style('border-radius', '4px')
                            .style('font-size', '12px')
                            .style('pointer-events', 'none')
                            .style('z-index', '1000')
                            .html(`${stressLabels[i]} = ${sigma.toFixed(2)}`)
                            .style('left', (event.pageX + 10) + 'px')
                            .style('top', (event.pageY - 10) + 'px')
                    })
                    .on('mouseout', () => {
                        d3.selectAll('.mohr-tooltip').remove()
                    })
            } catch (error) {
                console.error(`Mohr Circle: Error creating stress point ${i}:`, error)
            }
        })

        // Draw stress points (σn, τ) for all normal vectors if enabled
        if (this.params.draw!.stressPoint) {
            const stressPoints = this.getAllStressPoints()

            stressPoints.forEach((point, index) => {
                try {
                    const { sigma_n, tau, color, label } = point

                    if (isFinite(sigma_n) && isFinite(tau)) {
                        this.chartGroup_.append('circle')
                            .attr('cx', xScale(sigma_n))
                            .attr('cy', yScale(tau))
                            .attr('r', 5)
                            .attr('fill', color)
                            .attr('stroke', 'white')
                            .attr('stroke-width', 1)
                            .on('mouseover', (event) => {
                                const tooltip = d3.select('body').append('div')
                                    .attr('class', 'mohr-tooltip')
                                    .style('position', 'absolute')
                                    .style('background', 'rgba(0, 0, 0, 0.8)')
                                    .style('color', 'white')
                                    .style('padding', '8px')
                                    .style('border-radius', '4px')
                                    .style('font-size', '12px')
                                    .style('pointer-events', 'none')
                                    .style('z-index', '1000')
                                    .html(`<strong>${label}</strong><br>σn = ${sigma_n.toFixed(2)}<br>τ = ${tau.toFixed(2)}`)
                                    .style('left', (event.pageX + 10) + 'px')
                                    .style('top', (event.pageY - 10) + 'px')
                            })
                            .on('mouseout', () => {
                                d3.selectAll('.mohr-tooltip').remove()
                            })

                        // Add label for stress point
                        if (this.params.draw!.labels) {
                            this.chartGroup_.append('text')
                                .attr('x', xScale(sigma_n) + 10)
                                .attr('y', yScale(tau) - 10)
                                .text(label)
                                .attr('font-size', '11px')
                                .attr('fill', color)
                        }
                    } else {
                        console.warn('Mohr Circle: Invalid stress point values', { sigma_n, tau, label })
                    }
                } catch (error) {
                    console.error(`Mohr Circle: Error drawing stress point ${index}:`, error)
                }
            })
        }

        // Draw axes if enabled
        if (this.params.draw!.axes) {
            // X-axis
            const xAxis = d3.axisBottom(xScale)
                .tickFormat(d3.format('.1f'))

            this.chartGroup_.append('g')
                .attr('class', 'x-axis')
                .attr('transform', `translate(0, ${yScale(0)})`)
                .call(xAxis)

            // Y-axis
            const yAxis = d3.axisLeft(yScale)
                .tickFormat(d3.format('.1f'))

            this.chartGroup_.append('g')
                .attr('class', 'y-axis')
                .call(yAxis)

            // Axis labels if enabled
            if (this.params.draw!.labels) {
                // X-axis label
                this.chartGroup_.append('text')
                    .attr('class', 'x-axis-label')
                    .attr('x', chartWidth / 2)
                    .attr('y', chartHeight + 45)
                    .attr('text-anchor', 'middle')
                    .style('font-size', '14px')
                    .style('font-weight', '500')
                    .text(this.params.xAxisLabel || 'Normal Stress (σ)')

                // Y-axis label
                this.chartGroup_.append('text')
                    .attr('class', 'y-axis-label')
                    .attr('transform', 'rotate(-90)')
                    .attr('x', -chartHeight / 2)
                    .attr('y', -45)
                    .attr('text-anchor', 'middle')
                    .style('font-size', '14px')
                    .style('font-weight', '500')
                    .text(this.params.yAxisLabel || 'Shear Stress (τ)')

                // Principal stress labels
                stressLabels.forEach((label, i) => {
                    const sigma = stressValues[i]
                    if (isFinite(sigma)) {
                        this.chartGroup_.append('text')
                            .attr('x', xScale(sigma))
                            .attr('y', yScale(0) + 20)
                            .attr('text-anchor', 'middle')
                            .style('font-size', '12px')
                            .style('font-weight', 'bold')
                            .text(label)
                    }
                })
            }
        }

        // Draw title if provided
        if (this.params.title && this.params.title.length > 0) {
            this.svg_.append('text')
                .attr('class', 'chart-title')
                .attr('x', this.params.width! / 2)
                .attr('y', 25)
                .attr('text-anchor', 'middle')
                .style('font-size', '16px')
                .style('font-weight', 'bold')
                .text(this.params.title)
        }
    }

    private drawHalfCircle(
        xScale: d3.ScaleLinear<number, number>,
        yScale: d3.ScaleLinear<number, number>,
        x1: number,
        x2: number,
        color: string
    ): void {
        const centerX = (x1 + x2) / 2
        const radius = Math.abs(x2 - x1) / 2

        if (radius === 0) return

        // Correct pixel radius calculation
        const radiusPx = Math.abs(xScale(x2) - xScale(x1)) / 2

        // In SVG, y grows downward. With d3.arc: angle 0 = top (12h), clockwise
        // For τ > 0 (visually at the top of the graph), draw from left to right
        // through the top (angle 0), so from -π/2 (left) to π/2 (right)
        const arc = d3.arc()
            .innerRadius(0)
            .outerRadius(radiusPx)
            .startAngle(-Math.PI / 2)  // left (9h)
            .endAngle(Math.PI / 2)     // right (3h) - passes through top (12h = 0)

        this.chartGroup_.append('path')
            .attr('d', arc as any)
            .attr('transform', `translate(${xScale(centerX)}, ${yScale(0)})`)
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-width', this.params.strokeWidth!)
    }

    private drawColoredArea(
        xScale: d3.ScaleLinear<number, number>,
        yScale: d3.ScaleLinear<number, number>
    ): void {
        // Strategy:
        // - Upper envelope: half-circle (σ3, σ1) on τ > 0
        // - Lower envelope: half-circles (σ3, σ2) and (σ2, σ1) on τ > 0
        // The shaded area is the space between these envelopes

        const bigRadius = (this.sigma1_ - this.sigma3_) / 2
        const smallRadius1 = (this.sigma2_ - this.sigma3_) / 2  // circle σ3-σ2
        const smallRadius2 = (this.sigma1_ - this.sigma2_) / 2  // circle σ2-σ1

        if (bigRadius <= 0) return

        // Circle centers
        const bigCenterX = xScale((this.sigma1_ + this.sigma3_) / 2)
        const smallCenter1X = xScale((this.sigma2_ + this.sigma3_) / 2)
        const smallCenter2X = xScale((this.sigma1_ + this.sigma2_) / 2)
        const yCenter = yScale(0)

        // Pixel radii
        const bigRadiusPx = Math.abs(xScale(this.sigma1_) - xScale(this.sigma3_)) / 2
        const smallRadius1Px = Math.abs(xScale(this.sigma2_) - xScale(this.sigma3_)) / 2
        const smallRadius2Px = Math.abs(xScale(this.sigma1_) - xScale(this.sigma2_)) / 2

        // In SVG, y grows downward, so the y-axis is visually inverted
        // For d3.path().arc(): angle 0 = right (3h), π = left (9h)
        // Due to y inversion, anticlockwise is visually inverted:
        // - anticlockwise=false (math clockwise) → passes through TOP visually
        // - anticlockwise=true (math counterclockwise) → passes through BOTTOM visually

        const path = d3.path()

        // 1. Upper arc (big circle σ3-σ1): from σ3 to σ1 through the top (τ > 0)
        //    σ3 is at angle π, σ1 is at angle 0
        //    anticlockwise=false to pass through the top visually
        path.arc(bigCenterX, yCenter, bigRadiusPx, Math.PI, 0, false)

        // 2. Lower arc (small circle σ2-σ1): from σ1 to σ2 through the top (τ > 0)
        //    σ1 is at angle 0, σ2 is at angle π
        //    anticlockwise=true to pass through the top visually (reverse direction)
        if (smallRadius2Px > 0) {
            path.arc(smallCenter2X, yCenter, smallRadius2Px, 0, Math.PI, true)
        }

        // 3. Lower arc (small circle σ3-σ2): from σ2 to σ3 through the top (τ > 0)
        //    σ2 is at angle 0, σ3 is at angle π
        //    anticlockwise=true to pass through the top visually (reverse direction)
        if (smallRadius1Px > 0) {
            path.arc(smallCenter1X, yCenter, smallRadius1Px, 0, Math.PI, true)
        }

        path.closePath()

        this.chartGroup_.append('path')
            .attr('d', path.toString())
            .attr('fill', this.params.colors!.area!)
            .attr('stroke', 'none')
    }

    // Method to export data as CSV
    exportData(): string {
        let csv = 'Parameter,Value\n'
        csv += `sigma1,${this.sigma1_}\n`
        csv += `sigma2,${this.sigma2_}\n`
        csv += `sigma3,${this.sigma3_}\n`
        csv += `\nVector,n1,n2,n3,sigma_n,tau\n`

        const stressPoints = this.getAllStressPoints()
        this.normalVectors_.forEach((vector, i) => {
            const point = stressPoints[i]
            csv += `${vector.label || vector.id},${vector.n1},${vector.n2},${vector.n3},${point.sigma_n},${point.tau}\n`
        })

        return csv
    }

    // Method to get stress state summary
    getStressState() {
        const stressPoints = this.getAllStressPoints()
        const firstVector = this.normalVectors_[0]
        const firstPoint = stressPoints[0] || { sigma_n: 0, tau: 0 }

        return {
            principalStresses: {
                sigma1: this.sigma1_,
                sigma2: this.sigma2_,
                sigma3: this.sigma3_
            },
            // Legacy: first vector
            normalVector: firstVector ? {
                n1: firstVector.n1,
                n2: firstVector.n2,
                n3: firstVector.n3
            } : { n1: 0, n2: 0, n3: 0 },
            // Legacy: first stress point
            stressPoint: {
                sigma_n: firstPoint.sigma_n,
                tau: firstPoint.tau
            },
            // New: all vectors and their stress points
            normalVectors: this.normalVectors_,
            stressPoints,
            maxShearStress: (this.sigma1_ - this.sigma3_) / 2,
            meanStress: (this.sigma1_ + this.sigma2_ + this.sigma3_) / 3
        }
    }

    // Method to update dimensions
    updateDimensions(width: number, height: number): void {
        this.params.width = width
        this.params.height = height
        this.svg_.attr('width', width).attr('height', height)
        this.update()
    }

    // Method to update all parameters at once
    updateParameters(newParams: Partial<MohrParameters>): void {
        this.params = { ...this.params, ...newParams }

        // Merge nested objects properly
        if (newParams.margin) {
            this.params.margin = { ...this.params.margin, ...newParams.margin }
        }
        if (newParams.draw) {
            this.params.draw = { ...this.params.draw, ...newParams.draw }
        }
        if (newParams.colors) {
            this.params.colors = { ...this.params.colors, ...newParams.colors }
        }

        this.update()
    }
}
