export class Color {
    r: number = 0
    g: number = 0
    b: number = 0

    constructor(colorOrRgb?: Color | [number, number, number] | String) {
        if (!colorOrRgb) {
            // Default to black
            this.r = 0
            this.g = 0
            this.b = 0
        } else if (Array.isArray(colorOrRgb)) {
            // Array of 3 numbers
            if (colorOrRgb.length !== 3) {
                throw new Error('RGB array must have exactly 3 elements')
            }
            this.r = colorOrRgb[0]
            this.g = colorOrRgb[1]
            this.b = colorOrRgb[2]
        } else if (typeof colorOrRgb === 'string') {
            // Hex string
            if (!/^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(colorOrRgb)) {
                throw new Error('Invalid hex color format')
            }
            this.setHex(colorOrRgb);
        } else if (typeof colorOrRgb === 'number') {
            // Color object
            // this.r = (colorOrRgb as Color).r
            // this.g = (colorOrRgb as Color).g
            // this.b = (colorOrRgb as Color).b
            // throw new Error('Invalid hex color format')
            this.setHex(Color.toHexString(colorOrRgb))
        } else if (typeof colorOrRgb === 'number') {
            // Color object
            // this.r = (colorOrRgb as Color).r
            // this.g = (colorOrRgb as Color).g
            // this.b = (colorOrRgb as Color).b
            // throw new Error('Invalid hex color format')
            this.setHex(Color.toHexString(colorOrRgb))
        } else if (typeof colorOrRgb === 'object') {
            // Color object
            this.r = (colorOrRgb as Color).r
            this.g = (colorOrRgb as Color).g
            this.b = (colorOrRgb as Color).b
        }
        else {
            throw new Error(`Invalid color format. Must be an array of 3 numbers, a hex string, or a Color instance. Got ${colorOrRgb}`)
        }
    }

    lerp(color: Color, t: number): Color {
        // console.log(this.r, this.g, this.b, color.r, color.g, color.b, t)
        // console.log(this.r + (color.r - this.r) * t, this.g + (color.g - this.g) * t, this.b + (color.b - this.b) * t)
        // console.log('---')
        if (t < 0 || t > 1) {
            throw new Error('Interpolation factor t must be between 0 and 1')
        }
        if (!(color instanceof Color)) {
            throw new Error('Argument must be an instance of Color')
        }
        return new Color({
            r: this.r + (color.r - this.r) * t,
            g: this.g + (color.g - this.g) * t,
            b: this.b + (color.b - this.b) * t
        } as Color)
    }

    static toHexString(color: number): string {
        return '#' + (color & 0xFFFFFF).toString(16).padStart(6, '0').toUpperCase();
    }

    toHex(): string {
        const r = Math.round(this.r * 255).toString(16).padStart(2, '0')
        const g = Math.round(this.g * 255).toString(16).padStart(2, '0')
        const b = Math.round(this.b * 255).toString(16).padStart(2, '0')
        return `#${r}${g}${b}`
    }

    /**
     * Set from hex string
     */
    setHex(hex: string): this {
        hex = hex.replace('#', '');
        if (hex.length !== 6) {
            throw new Error('Invalid hex color format');
        }

        this.r = parseInt(hex.substring(0, 2), 16) / 255;
        this.g = parseInt(hex.substring(2, 4), 16) / 255;
        this.b = parseInt(hex.substring(4, 6), 16) / 255;
        return this;
    }
}

