import * as d3 from 'd3';

export class FractureMap2D {
    private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private g: d3.Selection<SVGGElement, unknown, null, undefined>;
    private width: number;
    private height: number;
    private margin = { top: 30, right: 30, bottom: 50, left: 60 };
    private xScale!: d3.ScaleLinear<number, number>;
    private yScale!: d3.ScaleLinear<number, number>;

    constructor(containerId: string, width: number, height: number, backgroundColor: string) {
        this.width = width;
        this.height = height;

        const container = d3.select(`#${containerId}`);
        container.selectAll('*').remove();

        this.svg = container
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('background-color', backgroundColor);

        this.g = this.svg.append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
    }

    public plot(
        data: FracturePoint[],
        settings: FractureMap2DSettings
    ): void {
        this.g.selectAll('*').remove();

        if (data.length === 0) return;

        // Calculer les domaines
        const xExtent = d3.extent(data, d => d.x) as [number, number];
        const yExtent = d3.extent(data, d => d.y) as [number, number];

        const xPadding = (xExtent[1] - xExtent[0]) * 0.1;
        const yPadding = (yExtent[1] - yExtent[0]) * 0.1;

        this.xScale = d3.scaleLinear()
            .domain([xExtent[0] - xPadding, xExtent[1] + xPadding])
            .range([0, this.width - this.margin.left - this.margin.right]);

        this.yScale = d3.scaleLinear()
            .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
            .range([this.height - this.margin.top - this.margin.bottom, 0]);

        // Grille
        if (settings.showGrid) {
            this.drawGrid(settings.gridColor);
        }

        // Axes
        this.drawAxes(settings.xAxisLabel, settings.yAxisLabel);

        // Tracer les données
        data.forEach(point => {
            const x = this.xScale(point.x);
            const y = this.yScale(point.y);

            // Point central
            this.g.append('circle')
                .attr('cx', x)
                .attr('cy', y)
                .attr('r', settings.pointSize)
                .attr('fill', '#333333')
                .attr('stroke', 'white')
                .attr('stroke-width', 1);

            // Orientation mesurée
            if (settings.showMeasured && point.strike !== undefined) {
                this.drawOrientationLine(
                    x, y,
                    point.strike,
                    settings.lineLength,
                    settings.measuredColor,
                    settings.lineWidth
                );
            }

            // Orientation prédite
            if (settings.showPredicted && point.predictedStrike !== undefined) {
                this.drawOrientationLine(
                    x, y,
                    point.predictedStrike,
                    settings.lineLength,
                    settings.predictedColor,
                    settings.lineWidth,
                    true // dashed
                );
            }

            // Label
            if (settings.showLabels && point.id !== undefined) {
                this.g.append('text')
                    .attr('x', x + settings.pointSize + 3)
                    .attr('y', y - settings.pointSize - 3)
                    .attr('font-size', `${settings.labelSize}px`)
                    .attr('fill', '#666666')
                    .text(point.id);
            }
        });

        // Légende
        this.drawLegend(settings);
    }

    private drawOrientationLine(
        cx: number,
        cy: number,
        strike: number,
        length: number,
        color: string,
        width: number,
        dashed: boolean = false
    ): void {
        // Convertir strike en angle pour SVG (0° = Nord, sens horaire)
        // En SVG: 0° = Est, sens anti-horaire
        const angleRad = (90 - strike) * Math.PI / 180;

        const halfLength = length / 2;
        const x1 = cx - halfLength * Math.cos(angleRad);
        const y1 = cy + halfLength * Math.sin(angleRad);
        const x2 = cx + halfLength * Math.cos(angleRad);
        const y2 = cy - halfLength * Math.sin(angleRad);

        const line = this.g.append('line')
            .attr('x1', x1)
            .attr('y1', y1)
            .attr('x2', x2)
            .attr('y2', y2)
            .attr('stroke', color)
            .attr('stroke-width', width)
            .attr('stroke-linecap', 'round');

        if (dashed) {
            line.attr('stroke-dasharray', '4,4');
        }
    }

    private drawGrid(color: string): void {
        const xAxis = d3.axisBottom(this.xScale).ticks(10);
        const yAxis = d3.axisLeft(this.yScale).ticks(10);

        // Lignes verticales
        this.g.append('g')
            .attr('class', 'grid')
            .attr('transform', `translate(0,${this.height - this.margin.top - this.margin.bottom})`)
            .call(xAxis.tickSize(-(this.height - this.margin.top - this.margin.bottom)).tickFormat(() => ''))
            .style('stroke', color)
            .style('stroke-opacity', 0.5);

        // Lignes horizontales
        this.g.append('g')
            .attr('class', 'grid')
            .call(yAxis.tickSize(-(this.width - this.margin.left - this.margin.right)).tickFormat(() => ''))
            .style('stroke', color)
            .style('stroke-opacity', 0.5);
    }

    private drawAxes(xLabel: string, yLabel: string): void {
        const xAxis = d3.axisBottom(this.xScale);
        const yAxis = d3.axisLeft(this.yScale);

        // Axe X
        this.g.append('g')
            .attr('transform', `translate(0,${this.height - this.margin.top - this.margin.bottom})`)
            .call(xAxis);

        this.g.append('text')
            .attr('x', (this.width - this.margin.left - this.margin.right) / 2)
            .attr('y', this.height - this.margin.top - this.margin.bottom + 40)
            .attr('text-anchor', 'middle')
            .attr('fill', '#333333')
            .text(xLabel);

        // Axe Y
        this.g.append('g')
            .call(yAxis);

        this.g.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -(this.height - this.margin.top - this.margin.bottom) / 2)
            .attr('y', -45)
            .attr('text-anchor', 'middle')
            .attr('fill', '#333333')
            .text(yLabel);
    }

    private drawLegend(settings: FractureMap2DSettings): void {
        const legendG = this.g.append('g')
            .attr('transform', `translate(${this.width - this.margin.left - this.margin.right - 150}, 10)`);

        let yOffset = 0;

        if (settings.showMeasured) {
            legendG.append('line')
                .attr('x1', 0)
                .attr('y1', yOffset)
                .attr('x2', 30)
                .attr('y2', yOffset)
                .attr('stroke', settings.measuredColor)
                .attr('stroke-width', settings.lineWidth);

            legendG.append('text')
                .attr('x', 35)
                .attr('y', yOffset + 4)
                .attr('font-size', '12px')
                .attr('fill', '#333333')
                .text('Measured');

            yOffset += 20;
        }

        if (settings.showPredicted) {
            legendG.append('line')
                .attr('x1', 0)
                .attr('y1', yOffset)
                .attr('x2', 30)
                .attr('y2', yOffset)
                .attr('stroke', settings.predictedColor)
                .attr('stroke-width', settings.lineWidth)
                .attr('stroke-dasharray', '4,4');

            legendG.append('text')
                .attr('x', 35)
                .attr('y', yOffset + 4)
                .attr('font-size', '12px')
                .attr('fill', '#333333')
                .text('Predicted');
        }
    }

    public exportSVG(): string {
        return new XMLSerializer().serializeToString(this.svg.node()!);
    }
}