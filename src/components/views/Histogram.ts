import * as d3 from 'd3'

/**
 * @category Histogram
 */
export type HistogramParameters = {
    width?: number,
    height?: number,
    margin?: {
        top?: number,
        right?: number,
        bottom?: number,
        left?: number
    },
    bins?: number,
    draw?: {
        grid?: boolean,
        labels?: boolean,
        axes?: boolean,
        density?: boolean // Show density curve overlay
    },
    fillColor?: string,
    strokeColor?: string,
    strokeWidth?: number,
    densityColor?: string,
    xAxisLabel?: string,
    yAxisLabel?: string,
    title?: string
}

/**
 * @category Histogram
 */
export const DefaultHistogramParameters: HistogramParameters = {
    width: 500,
    height: 300,
    margin: {
        top: 40,
        right: 30,
        bottom: 60,
        left: 60
    },
    bins: 20,
    draw: {
        grid: true,
        labels: true,
        axes: true,
        density: false
    },
    fillColor: '#3498db',
    strokeColor: '#2c3e50',
    strokeWidth: 1,
    densityColor: '#e74c3c',
    xAxisLabel: 'Value',
    yAxisLabel: 'Frequency',
    title: ''
}

/**
 * @category Histogram
 */
export class Histogram {
    private element_: HTMLElement = undefined
    private data_: number[] = []
    private svg_: d3.Selection<SVGSVGElement, unknown, null, undefined> = undefined
    private chartGroup_: d3.Selection<SVGGElement, unknown, null, undefined> = undefined
    params: HistogramParameters = DefaultHistogramParameters

    constructor(element: HTMLElement, data: number[], params: HistogramParameters = DefaultHistogramParameters) {
        this.element_ = element
        this.data_ = data.filter(d => !isNaN(d) && isFinite(d)) // Filter out invalid values
        this.params = { ...DefaultHistogramParameters, ...params }
        
        // Merge margin objects properly
        if (params.margin) {
            this.params.margin = { ...DefaultHistogramParameters.margin, ...params.margin }
        }
        
        // Merge draw objects properly
        if (params.draw) {
            this.params.draw = { ...DefaultHistogramParameters.draw, ...params.draw }
        }
        
        this.initializeSVG()
        if (this.data_ && this.data_.length > 0) {
            this.update()
        }
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

    // Getters and setters for dynamic updates
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

    set data(d: number[]) {
        this.data_ = d.filter(val => !isNaN(val) && isFinite(val))
        this.update()
    }

    get data() {
        return this.data_
    }

    set bins(b: number) {
        this.params.bins = b
        this.update()
    }

    set fillColor(color: string) {
        this.params.fillColor = color
        this.update()
    }

    set strokeColor(color: string) {
        this.params.strokeColor = color
        this.update()
    }

    set title(t: string) {
        this.params.title = t
        this.update()
    }

    set xAxisLabel(label: string) {
        this.params.xAxisLabel = label
        this.update()
    }

    set yAxisLabel(label: string) {
        this.params.yAxisLabel = label
        this.update()
    }

    set showGrid(show: boolean) {
        this.params.draw!.grid = show
        this.update()
    }

    set showDensity(show: boolean) {
        this.params.draw!.density = show
        this.update()
    }

    update(): void {
        if (!this.data_ || this.data_.length === 0) {
            this.chartGroup_.selectAll("*").remove()
            // Show "No data" message
            this.chartGroup_.append('text')
                .attr('x', (this.params.width! - this.params.margin!.left! - this.params.margin!.right!) / 2)
                .attr('y', (this.params.height! - this.params.margin!.top! - this.params.margin!.bottom!) / 2)
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'central')
                .style('font-size', '16px')
                .style('fill', '#999')
                .text('No data available')
            return
        }

        // Clear previous chart content
        this.chartGroup_.selectAll("*").remove()

        const chartWidth = this.params.width! - this.params.margin!.left! - this.params.margin!.right!
        const chartHeight = this.params.height! - this.params.margin!.top! - this.params.margin!.bottom!

        // Ensure minimum dimensions
        if (chartWidth <= 0 || chartHeight <= 0) return

        // Calculate data statistics
        const extent = d3.extent(this.data_) as [number, number]
        const mean = d3.mean(this.data_)
        const stdDev = d3.deviation(this.data_)

        // Create scales
        const xScale = d3.scaleLinear()
            .domain(extent)
            .range([0, chartWidth])

        // Create histogram bins
        const histogram = d3.histogram<number, number>()
            .value(d => d)
            .domain(xScale.domain() as [number, number])
            .thresholds(this.params.bins!)

        const bins = histogram(this.data_)

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(bins, d => d.length) || 1])
            .range([chartHeight, 0])

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

        // Draw histogram bars
        this.chartGroup_.selectAll('.bar')
            .data(bins)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', d => xScale(d.x0!))
            .attr('y', d => yScale(d.length))
            .attr('width', d => Math.max(0, xScale(d.x1!) - xScale(d.x0!) - 1))
            .attr('height', d => chartHeight - yScale(d.length))
            .attr('fill', this.params.fillColor)
            .attr('stroke', this.params.strokeColor)
            .attr('stroke-width', this.params.strokeWidth)
            .on('mouseover', (event, d) => {
                // Highlight bar on hover
                d3.select(event.currentTarget).attr('opacity', 0.8)
                
                // Show tooltip
                const tooltip = d3.select('body').append('div')
                    .attr('class', 'histogram-tooltip')
                    .style('position', 'absolute')
                    .style('background', 'rgba(0, 0, 0, 0.8)')
                    .style('color', 'white')
                    .style('padding', '8px')
                    .style('border-radius', '4px')
                    .style('font-size', '12px')
                    .style('pointer-events', 'none')
                    .style('z-index', '1000')
                
                tooltip.html(`
                    <div>Range: ${d.x0!.toFixed(2)} - ${d.x1!.toFixed(2)}</div>
                    <div>Count: ${d.length}</div>
                    <div>Percentage: ${(d.length / this.data_.length * 100).toFixed(1)}%</div>
                `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px')
            })
            .on('mouseout', (event) => {
                d3.select(event.currentTarget).attr('opacity', 1)
                d3.selectAll('.histogram-tooltip').remove()
            })

        // Draw density curve if enabled
        if (this.params.draw!.density && mean !== undefined && stdDev !== undefined && stdDev > 0) {
            const densityData = d3.range(extent[0], extent[1], (extent[1] - extent[0]) / 100)
                .map(x => {
                    const density = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * 
                                   Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2))
                    return { x, density }
                })

            const maxDensity = d3.max(densityData, d => d.density) || 1
            const maxCount = d3.max(bins, d => d.length) || 1
            
            // Scale density to match histogram scale
            const densityScale = maxCount / maxDensity

            const line = d3.line<{x: number, density: number}>()
                .x(d => xScale(d.x))
                .y(d => yScale(d.density * densityScale))
                .curve(d3.curveCardinal)

            this.chartGroup_.append('path')
                .datum(densityData)
                .attr('class', 'density-curve')
                .attr('fill', 'none')
                .attr('stroke', this.params.densityColor)
                .attr('stroke-width', 2)
                .attr('d', line)
        }

        // Draw axes if enabled
        if (this.params.draw!.axes) {
            // X-axis
            const xAxis = d3.axisBottom(xScale)
                .tickFormat(d3.format('.2f'))

            this.chartGroup_.append('g')
                .attr('class', 'x-axis')
                .attr('transform', `translate(0, ${chartHeight})`)
                .call(xAxis)

            // Y-axis
            const yAxis = d3.axisLeft(yScale)

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
                    .text(this.params.xAxisLabel || 'Value')

                // Y-axis label
                this.chartGroup_.append('text')
                    .attr('class', 'y-axis-label')
                    .attr('transform', 'rotate(-90)')
                    .attr('x', -chartHeight / 2)
                    .attr('y', -45)
                    .attr('text-anchor', 'middle')
                    .style('font-size', '14px')
                    .style('font-weight', '500')
                    .text(this.params.yAxisLabel || 'Frequency')
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

        // Add statistics text if there's space
        if (mean !== undefined && stdDev !== undefined && chartWidth > 300) {
            const statsGroup = this.chartGroup_.append('g')
                .attr('class', 'statistics')
                .attr('transform', `translate(${Math.max(chartWidth - 150, 10)}, 20)`)

            const statsData = [
                `N: ${this.data_.length}`,
                `Mean: ${mean.toFixed(3)}`,
                `Std Dev: ${stdDev.toFixed(3)}`,
                `Min: ${extent[0].toFixed(3)}`,
                `Max: ${extent[1].toFixed(3)}`
            ]

            statsGroup.selectAll('.stat-line')
                .data(statsData)
                .enter()
                .append('text')
                .attr('class', 'stat-line')
                .attr('x', 0)
                .attr('y', (d, i) => i * 15)
                .style('font-size', '11px')
                .style('fill', '#666')
                .text(d => d)
        }
    }

    // Method to export data as CSV
    exportData(): string {
        if (!this.data_ || this.data_.length === 0) {
            return 'Bin_Start,Bin_End,Count,Percentage\n'
        }

        const histogram = d3.histogram<number, number>()
            .value(d => d)
            .domain(d3.extent(this.data_) as [number, number])
            .thresholds(this.params.bins!)

        const bins = histogram(this.data_)
        
        let csv = 'Bin_Start,Bin_End,Count,Percentage\n'
        bins.forEach(bin => {
            const percentage = (bin.length / this.data_.length * 100).toFixed(2)
            csv += `${bin.x0},${bin.x1},${bin.length},${percentage}\n`
        })
        
        return csv
    }

    // Method to get statistical summary
    getStatistics() {
        if (!this.data_ || this.data_.length === 0) return null

        const sorted = [...this.data_].sort((a, b) => a - b)
        const mean = d3.mean(this.data_)
        const median = d3.median(this.data_)
        const stdDev = d3.deviation(this.data_)
        const extent = d3.extent(this.data_)
        
        return {
            count: this.data_.length,
            mean,
            median,
            stdDev,
            min: extent[0],
            max: extent[1],
            q1: d3.quantile(sorted, 0.25),
            q3: d3.quantile(sorted, 0.75)
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
    updateParameters(newParams: Partial<HistogramParameters>): void {
        this.params = { ...this.params, ...newParams }
        
        // Merge nested objects properly
        if (newParams.margin) {
            this.params.margin = { ...this.params.margin, ...newParams.margin }
        }
        if (newParams.draw) {
            this.params.draw = { ...this.params.draw, ...newParams.draw }
        }
        
        this.update()
    }
}