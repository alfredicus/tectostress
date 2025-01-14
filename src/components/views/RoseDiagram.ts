import * as d3 from 'd3'

/**
 * @category Rose diagram
 */
export type RoseDiagramParameters = {
    width?: number,
    height?: number,
    draw?: {
        labels?: boolean,
        circles?: boolean,
        binBorder?: boolean,
        cardinals?: boolean
    },
    margin?: {
        top?: number,
        right?: number,
        bottom?: number,
        left?: number
    },
    is360?: boolean,
    innerR?: number,
    deltaAngle?: number,
    gradTickSpacing?: number,
    fillColor?: string,
    lineColor?: string,
    colourHover?: string,
}

/**
 * @category Rose diagram
 */
export const DefaultRoseDiagramParameters: RoseDiagramParameters = {
    width: 400,
    height: 400,
    draw: {
        labels: false,
        circles: true,
        binBorder: true,
        cardinals: true
    },
    margin: {
        top: 0,
        right: 2,
        bottom: 0,
        left: 2
    },
    is360: false,
    innerR: 5,
    deltaAngle: 10,
    fillColor: '#ff0000',
    lineColor: '#000000',
    gradTickSpacing: 7,
    colourHover: 'purple'
}

/**
 * @category Rose diagram
 */
export class RoseDiagram {
    private element_: HTMLElement = undefined
    private data_: number[] = []
    params: RoseDiagramParameters = DefaultRoseDiagramParameters

    constructor(element: HTMLElement, data: number[], params: RoseDiagramParameters = DefaultRoseDiagramParameters) {
        this.element_ = element
        this.data_ = data
        Object.assign(this.params, params)
        if (data && data.length > 0) {
            this.update()
        }
    }

    set width(w: number) {
        this.params.width = w
        this.update()
    }

    set height(w: number) {
        this.params.height = w
        this.update()
    }

    set data(d: number[]) {
        this.data_ = d
        this.update()
    }

    get data() {
        return this.data_
    }

    set is360(b: boolean) {
        this.params.is360 = b
        this.update()
    }

    set binBorder(b: boolean) {
        this.params.draw.binBorder = b
        this.update()
    }

    set labels(b: boolean) {
        this.params.draw.labels = b
        this.update()
    }

    set cardinals(b: boolean) {
        this.params.draw.cardinals = b
        this.update()
    }

    set circles(b: boolean) {
        this.params.draw.circles = b
        this.update()
    }

    set fillColor(b: string) {
        this.params.fillColor = b
        this.update()
    }

    set lineColor(b: string) {
        this.params.lineColor = b
        this.update()
    }

    set binAngle(b: number) {
        this.params.deltaAngle = b
        this.update()
    }

    set innerRadius(b: number) {
        this.params.innerR = b
        this.update()
    }

    update() {
        const data = this.data_.map(d => {
            while (d < 0) {
                d += 360
            }
            while (d > 360) {
                d -= 360
            }
            return d
        })

        // Check if the data are in [0,180] or [0,360]
        let isBetween0and360 = this.params.is360
        let min = Number.POSITIVE_INFINITY
        let max = Number.NEGATIVE_INFINITY
        data.forEach(d => {
            if (d > max) max = d
            if (d < min) min = d
        })

        // Force
        if (max > 180) {
            isBetween0and360 = true
        }

        let width = this.params.width
        let height = this.params.height

        const svg = d3
            .select(`#${this.element_}`)
            .html(null) // clear the element
            .append('svg')
            .attr('width', width)
            .attr('height', height)

        let g = svg.append('g')
            .attr('transform', `translate(${width / 2}, ${height / 2})`)

        width = width - 30
        height = height - 30

        const chartWidth = width - this.params.margin.left - this.params.margin.right
        const chartHeight = height - this.params.margin.top - this.params.margin.bottom
        const outerR = Math.min(chartWidth, chartHeight) / 2

        let angle = d3
            .scaleLinear()
            .domain([0, 12])
            .range([0, 2 * Math.PI])

        let radius = d3.scaleLinear().range([this.params.innerR, outerR])
        let y = d3.scaleLinear().range([this.params.innerR, outerR])

        // Binning...
        let dataRose: Item[] = binSerieFromAngle(data, this.params.deltaAngle, isBetween0and360)

        let children: Item[] = undefined
        if (isBetween0and360 === false) {
            let dataRoseSym = dataRose.map((d, i) => {
                return {
                    startAngle: d.startAngle + Math.PI,
                    endAngle: d.endAngle + Math.PI,
                    freq: d.freq,
                }
            })
            children = dataRose.concat(dataRoseSym)
        }
        else {
            children = dataRose
        }

        // Range and domain of the frequence for rose diagram
        let freq = d3
            .scaleLinear()
            .domain([0, d3.max(dataRose, (d: Item) => d.freq)])
            .range([this.params.innerR, outerR])

        radius.domain([0, d3.max(dataRose, (d: Item) => undefined),])

        // Plot the arc for each datum 0-360 degrees
        const gg = g.append('g')
            .selectAll('path')
            .data(children)
            .join('path')
            .attr('d', d3.arc<Item>()
                .innerRadius((d) => freq((d as Item).freq))
                .outerRadius(this.params.innerR)
                .padAngle(0.01)
                .padRadius(20)
            )

        if (this.params.draw.binBorder) {
            gg.attr('stroke', this.params.lineColor)
        }

        gg.style('fill', this.params.fillColor).join('path')

        // Add outer black circle
        g.append('circle')
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('r', outerR)
            .attr('stroke', 'black')
            .style('fill', 'none')

        // Add inner black circle
        g.append('circle')
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('r', this.params.innerR)
            .attr('stroke', 'black')
            .style('fill', 'none')

        // ------------------------------------------------------------

        if (this.params.draw.cardinals) {
            // scale of 4 cardinal points
            let labelHead = ['N', 'E', 'S', 'W']
            let x = d3
                .scaleBand()
                .domain(labelHead)
                .range([0, 2 * Math.PI])
                .align(0)

            // Add label cardinal heading NESW
            let label = g
                .append('g')
                .selectAll('g')
                .data(labelHead)
                .enter()
                .append('g')
                .attr('text-anchor', 'middle')
                .attr('transform', (d) => {
                    return (
                        'rotate(' +
                        ((x(d) * 180) / Math.PI - 90) +
                        ')translate(' +
                        (outerR + 10) +
                        ',0)'
                    )
                })
                .attr('font-family', 'Aldrich') //Aldrich

            // put upright cardinal points
            label
                .append('text')
                .attr('transform', (d) => {
                    return (x(d) * 180) / Math.PI - 90 === 90
                        ? 'rotate(-90)translate(0,0)'
                        : 'rotate(' + ((x(d) * 180) / Math.PI - 90) + ')translate(0,5)'
                })
                .text((d) => d)
                .attr("font-weight", 700)
                .style('font-size', 14)
        }

        // ------------------------------------------------------------

        // Add radius line
        g.selectAll('.axis')
            .data(d3.range(angle.domain()[1]))
            .enter()
            .append('g')
            .attr('class', 'axis')
            .attr('stroke-width', 0.5)
            .attr('transform', (d) => {
                return 'rotate(' + (angle(d) * 180) / Math.PI + ')'
            })
            .style('opacity', 1)
            .call(
                d3.axisLeft(freq).tickSizeOuter(0).scale(radius.copy().range([-this.params.innerR, -outerR])),
            )

        // Add circular tick with frequency values
        let yAxis = g.append('g').attr('text-anchor', 'middle')

        var yTick = yAxis
            .selectAll('g')
            .data(freq.ticks(this.params.gradTickSpacing).slice(1))
            .enter()
            .append('g')

        if (this.params.draw.circles) {
            yTick
                .append('circle')
                .attr('fill', 'none')
                .attr('stroke', 'gray')
                .style('opacity', 0.2)
                .attr('r', freq)
        }

        if (this.params.draw.labels) {
            yTick
                .append('text')
                .attr('y', (d) => -freq(d))
                .attr('dy', '-0.25em')
                .attr('x', function () {
                    return -15
                })
                .text(freq.tickFormat(5, 's'))
                .style('font-size', 12)
        }
    }
}

type Item = {
    startAngle: number,
    endAngle: number,
    freq: number
}

/**
 * 
 * @param {*} serie the array of data
 * @param {*} angle of a bin (in degrees)
 * @returns 
 * @category Rose diagram
 */
export function binSerieFromAngle(serie: number[], angle: number, isBetween0and360: boolean) {
    const nbBins = Math.round(180 / angle)

    const binned = new Array(nbBins)
    const MAX_RAD = isBetween0and360 ? Math.PI * 2 : Math.PI
    const MAX_DEG = isBetween0and360 ? 360 : 180
    for (let i = 0; i <= nbBins; ++i) {
        binned[i] = {
            startAngle: (i * MAX_RAD) / nbBins,
            endAngle: ((i + 1) * MAX_RAD) / nbBins,
            freq: 0
        } as Item
    }

    const step = MAX_DEG / (nbBins - 1)
    serie.forEach(v => {
        const id = Math.round(v / step)
        binned[id].freq++
    })

    return binned
}
