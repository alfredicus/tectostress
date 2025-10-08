import * as d3 from 'd3'

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
    private element_: HTMLElement = undefined
    private svg_: d3.Selection<SVGSVGElement, unknown, null, undefined> = undefined
    private chartGroup_: d3.Selection<SVGGElement, unknown, null, undefined> = undefined
    params: MohrParameters = DefaultMohrParameters

    // Principal stresses (σ1 >= σ2 >= σ3)
    private sigma1_: number = 100
    private sigma2_: number = 60
    private sigma3_: number = 20

    // Normal vector components (n1, n2, n3)
    private n1_: number = 1 / Math.sqrt(3)
    private n2_: number = 1 / Math.sqrt(3)
    private n3_: number = 1 / Math.sqrt(3)

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

        this.initializeSVG()
        this.update()
    }

    private initializeSVG(): void {
        // Clear any existing content
        d3.select(this.element_).selectAll("*").remove()

        this.svg_ = d3.select(this.element_)
            .append('svg')
            .attr('width', this.params.width)
            .attr('height', this.params.height)

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

    set normalVector(n: [number, number, number]) {
        const [n1, n2, n3] = this.normalizeVector(n[0], n[1], n[2])
        this.n1_ = n1
        this.n2_ = n2
        this.n3_ = n3
        this.update()
    }

    get normalVector(): [number, number, number] {
        return [this.n1_, this.n2_, this.n3_]
    }

    setPrincipalStresses(sigma1: number, sigma2: number, sigma3: number): void {
        this.sigma1_ = sigma1
        this.sigma2_ = sigma2
        this.sigma3_ = sigma3
        this.ensurePrincipalStressOrder()
        this.update()
    }

    private ensurePrincipalStressOrder(): void {
        // Ensure σ1 >= σ2 >= σ3
        const stresses = [this.sigma1_, this.sigma2_, this.sigma3_].sort((a, b) => b - a)
        this.sigma1_ = stresses[0]
        this.sigma2_ = stresses[1]
        this.sigma3_ = stresses[2]
    }

    private normalizeVector(n1: number, n2: number, n3: number): [number, number, number] {
        const magnitude = Math.sqrt(n1 * n1 + n2 * n2 + n3 * n3)
        if (magnitude === 0) return [0, 0, 0]
        return [n1 / magnitude, n2 / magnitude, n3 / magnitude]
    }

    private calculateStressPoint(): { sigma_n: number, tau: number } {
        // Validate normal vector components
        if (!isFinite(this.n1_) || !isFinite(this.n2_) || !isFinite(this.n3_)) {
            console.warn('Mohr Circle: Invalid normal vector components', { n1: this.n1_, n2: this.n2_, n3: this.n3_ })
            return { sigma_n: 0, tau: 0 }
        }

        // Validate stress values
        if (!isFinite(this.sigma1_) || !isFinite(this.sigma2_) || !isFinite(this.sigma3_)) {
            console.warn('Mohr Circle: Invalid stress values in calculation', { sigma1: this.sigma1_, sigma2: this.sigma2_, sigma3: this.sigma3_ })
            return { sigma_n: 0, tau: 0 }
        }

        const sigma_n = this.sigma1_ * this.n1_ * this.n1_ +
            this.sigma2_ * this.n2_ * this.n2_ +
            this.sigma3_ * this.n3_ * this.n3_

        const sigma_squared = (this.sigma1_ * this.n1_) ** 2 +
            (this.sigma2_ * this.n2_) ** 2 +
            (this.sigma3_ * this.n3_) ** 2

        const tau = Math.sqrt(Math.max(0, sigma_squared - sigma_n ** 2))

        // Validate results
        if (!isFinite(sigma_n) || !isFinite(tau)) {
            console.warn('Mohr Circle: Invalid stress point calculation result', { sigma_n, tau })
            return { sigma_n: 0, tau: 0 }
        }

        return { sigma_n, tau }
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

        // Calculate scales - ensure we have valid values
        const maxStress = Math.max(Math.abs(this.sigma1_), Math.abs(this.sigma2_), Math.abs(this.sigma3_), 1)
        const maxTau = Math.max((this.sigma1_ - this.sigma3_) / 2, 1)

        // Create scales maintaining aspect ratio
        const xScale = d3.scaleLinear()
            .domain([0, maxStress * 1.1])
            .range([0, chartWidth])
            .clamp(true)

        const yScale = d3.scaleLinear()
            .domain([-maxTau * 1.1, maxTau * 1.1])
            .range([chartHeight, 0])
            .clamp(true)

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
                    .attr('fill', this.params.colors!.principalPoints)
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

        // Draw stress point (σn, τ) if enabled
        if (this.params.draw!.stressPoint) {
            try {
                const { sigma_n, tau } = this.calculateStressPoint()

                if (isFinite(sigma_n) && isFinite(tau)) {
                    this.chartGroup_.append('circle')
                        .attr('cx', xScale(sigma_n))
                        .attr('cy', yScale(tau))
                        .attr('r', 5)
                        .attr('fill', this.params.colors!.stressPoint)
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
                                .html(`σn = ${sigma_n.toFixed(2)}<br>τ = ${tau.toFixed(2)}`)
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
                            .text('(σn, τ)')
                            .attr('font-size', '12px')
                            .attr('fill', this.params.colors!.stressPoint)
                    }
                } else {
                    console.warn('Mohr Circle: Invalid stress point values', { sigma_n, tau })
                }
            } catch (error) {
                console.error('Mohr Circle: Error calculating or drawing stress point:', error)
            }
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

        const arc = d3.arc()
            .innerRadius(0)
            .outerRadius(Math.abs(xScale(radius) - xScale(0)))
            .startAngle(-Math.PI / 2)
            .endAngle(Math.PI / 2)

        this.chartGroup_.append('path')
            .attr('d', arc as any)
            .attr('transform', `translate(${xScale(centerX)}, ${yScale(0)})`)
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-width', this.params.strokeWidth)
    }

    private drawColoredArea(
        xScale: d3.ScaleLinear<number, number>,
        yScale: d3.ScaleLinear<number, number>
    ): void {
        const bigRadius = (this.sigma1_ - this.sigma3_) / 2
        const smallRadius1 = (this.sigma2_ - this.sigma3_) / 2
        const smallRadius2 = (this.sigma1_ - this.sigma2_) / 2

        const bigCenter = (this.sigma1_ + this.sigma3_) / 2
        const smallCenter1 = (this.sigma2_ + this.sigma3_) / 2
        const smallCenter2 = (this.sigma1_ + this.sigma2_) / 2

        if (bigRadius === 0) return

        const path = d3.path()

        // Outer arc (big circle)
        path.arc(
            xScale(bigCenter),
            yScale(0),
            Math.abs(xScale(bigRadius) - xScale(0)),
            -Math.PI / 2,
            Math.PI / 2,
            false
        )

        // Inner arcs (small circles) - subtract these areas
        if (smallRadius1 > 0) {
            path.arc(
                xScale(smallCenter1),
                yScale(0),
                Math.abs(xScale(smallRadius1) - xScale(0)),
                Math.PI / 2,
                -Math.PI / 2,
                true
            )
        }

        if (smallRadius2 > 0) {
            path.arc(
                xScale(smallCenter2),
                yScale(0),
                Math.abs(xScale(smallRadius2) - xScale(0)),
                Math.PI / 2,
                -Math.PI / 2,
                true
            )
        }

        path.closePath()

        this.chartGroup_.append('path')
            .attr('d', path.toString())
            .attr('fill', this.params.colors!.area)
            .attr('stroke', 'none')
    }

    // Method to export data as CSV
    exportData(): string {
        const { sigma_n, tau } = this.calculateStressPoint()

        let csv = 'Parameter,Value\n'
        csv += `sigma1,${this.sigma1_}\n`
        csv += `sigma2,${this.sigma2_}\n`
        csv += `sigma3,${this.sigma3_}\n`
        csv += `n1,${this.n1_}\n`
        csv += `n2,${this.n2_}\n`
        csv += `n3,${this.n3_}\n`
        csv += `sigma_n,${sigma_n}\n`
        csv += `tau,${tau}\n`

        return csv
    }

    // Method to get stress state summary
    getStressState() {
        const { sigma_n, tau } = this.calculateStressPoint()

        return {
            principalStresses: {
                sigma1: this.sigma1_,
                sigma2: this.sigma2_,
                sigma3: this.sigma3_
            },
            normalVector: {
                n1: this.n1_,
                n2: this.n2_,
                n3: this.n3_
            },
            stressPoint: {
                sigma_n,
                tau
            },
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