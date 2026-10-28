// methods.ts
// Search methods offered for a stress inversion, with their parameters and default values.
// Shared by the Run tab and the workflow Inversion block.

export interface ParamConfig {
    name: string;
    display: string;
    value: number;
    min: number;
    max: number;
}

export interface SearchMethodConfig {
    name: string;
    active: boolean;
    params: ParamConfig[];
}

export interface ConfigData {
    search: {
        display: string;
        type: string;
        list: SearchMethodConfig[];
    };
}

export const CONFIG_DATA: ConfigData = {
    search: {
        display: "Search method",
        type: "combobox",
        list: [
            {
                name: "Monte Carlo (Euler)",
                active: true,
                params: [
                    {
                        name: "rotAngleHalfInterval",
                        display: "Rotation angle interval",
                        value: 90,
                        min: 0,
                        max: 90
                    },
                    {
                        name: "nbRandomTrials",
                        display: "Nb simulations",
                        value: 20000,
                        min: 10,
                        max: 1e6
                    },
                    {
                        name: "stressRatio",
                        display: "Stress ratio",
                        value: 0.5,
                        min: 0,
                        max: 1
                    },
                    {
                        name: "stressRatioHalfInterval",
                        display: "Stress ratio interval",
                        value: 1,
                        min: 0,
                        max: 1
                    }
                ]
            },
            {
                name: "Monte Carlo (Quaternion)",
                active: true,
                params: [
                    {
                        name: "nbRandomTrials",
                        display: "Nb simulations",
                        value: 20000,
                        min: 10,
                        max: 1e6
                    },
                    {
                        name: "topFraction",
                        display: "Top fraction kept",
                        value: 0.05,
                        min: 0.001,
                        max: 0.5
                    }
                ]
            },
            {
                name: "MCMC (Euler)",
                active: true,
                params: [
                    {
                        name: "nbIterations",
                        display: "Nb iterations",
                        value: 50000,
                        min: 1000,
                        max: 85000
                    },
                    {
                        name: "burnIn",
                        display: "Burn-in fraction",
                        value: 0.2,
                        min: 0,
                        max: 0.5
                    },
                    {
                        name: "temperature",
                        display: "Temperature",
                        value: 0.05,
                        min: 0.001,
                        max: 1
                    },
                    {
                        name: "rotAngleStepSize",
                        display: "Rotation step (deg)",
                        value: 5,
                        min: 0.1,
                        max: 45
                    },
                    {
                        name: "stressRatioStepSize",
                        display: "Stress ratio step",
                        value: 0.05,
                        min: 0.001,
                        max: 0.5
                    },
                    {
                        name: "stressRatio",
                        display: "Stress ratio",
                        value: 0.5,
                        min: 0,
                        max: 1
                    }
                ]
            },
            {
                name: "MCMC (Quaternion)",
                active: true,
                params: [
                    {
                        name: "nbIterations",
                        display: "Nb iterations",
                        value: 50000,
                        min: 1000,
                        max: 500000
                    },
                    {
                        name: "burnIn",
                        display: "Burn-in fraction",
                        value: 0.2,
                        min: 0,
                        max: 0.5
                    },
                    {
                        name: "sigmaNoise",
                        display: "σ noise (rad)",
                        value: parseFloat((Math.PI / 18).toFixed(4)),
                        min: 0.01,
                        max: 0.5
                    },
                    {
                        name: "sigmaRot",
                        display: "σ rot (rad)",
                        value: 0.1,
                        min: 0.01,
                        max: 0.5
                    },
                    {
                        name: "sigmaR",
                        display: "σ R",
                        value: 0.05,
                        min: 0.001,
                        max: 0.5
                    },
                    {
                        name: "stressRatio",
                        display: "Stress ratio",
                        value: 0.5,
                        min: 0,
                        max: 1
                    }
                ]
            },
            {
                name: "Grid Search",
                active: false,
                params: [
                    {
                        name: "dimension",
                        display: "Dimension (2/3/4)",
                        value: 4,
                        min: 2,
                        max: 4
                    },
                    {
                        name: "deltaGridAngle",
                        display: "Grid angle delta (°)",
                        value: 2,
                        min: 0.01,
                        max: 90
                    },
                    {
                        name: "GridAngleHalfIntervalS",
                        display: "Angle half-interval (°)",
                        value: 30,
                        min: 1,
                        max: 180
                    },
                    {
                        name: "deltaStressRatio",
                        display: "Stress ratio delta",
                        value: 0.01,
                        min: 0.001,
                        max: 0.5
                    },
                    {
                        name: "stressRatioHalfInterval",
                        display: "Stress ratio half-interval",
                        value: 0.2,
                        min: 0,
                        max: 1
                    },
                    {
                        name: "sweepPhi",
                        display: "Sweep φ (0=fix, 1=free)",
                        value: 1,
                        min: 0,
                        max: 1
                    },
                    {
                        name: "sweepTheta",
                        display: "Sweep θ (0=fix, 1=free)",
                        value: 1,
                        min: 0,
                        max: 1
                    },
                    {
                        name: "sweepAlpha",
                        display: "Sweep α (0=fix, 1=free)",
                        value: 1,
                        min: 0,
                        max: 1
                    },
                    {
                        name: "sweepR",
                        display: "Sweep R (0=fix, 1=free)",
                        value: 1,
                        min: 0,
                        max: 1
                    }
                ]
            },
            {
                name: "Manually",
                active: false,
                params: []
            }
        ]
    }
};

/** Default parameter values of a search method (empty when the method is unknown) */
export function defaultMethodParams(methodName: string): Record<string, number> {
    const method = CONFIG_DATA.search.list.find(m => m.name === methodName);
    return Object.fromEntries((method?.params ?? []).map(p => [p.name, p.value]));
}
