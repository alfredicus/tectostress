
export class SphericalCoords {
    private theta_ = 0
    private phi_   = 0

    constructor(
        {phi=0, theta=0}:
        {phi?: number, theta?: number} = {})
    {
        // check bounds of theta and phi if any
        this.theta_ = theta ? theta : 0
        this.phi_   = phi   ? phi   : 0
    }

    /**
     * @see constructor
     */
    static create(
        {phi=0, theta=0}:
        {phi?: number, theta?: number} = {})
    {
        return new SphericalCoords({phi, theta})
    }

    get theta() {
        return this.theta_
    }
    set theta(v: number) {
        // check bounds of theta
        this.theta_ = v
    }

    get phi() {
        return this.phi_
    }
    set phi(v: number) {
        this.phi_ = v
    }
}
