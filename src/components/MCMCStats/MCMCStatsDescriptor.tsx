import {
    VisualizationDescriptor,
    VisualizationContext
} from '../VisualizationDescriptor';
import MCMCStatsComponent from './MCMCStatsComponent';
import {
    createMCMCStatsSettings,
    MCMCStatsCompState,
    MCMCStatsSettings,
    MCMCStatsIcon
} from './MCMCStatsParameters';

export const MCMCStatsDescriptor: VisualizationDescriptor<MCMCStatsSettings, MCMCStatsCompState> = {
    id: 'mcmcStats',
    title: 'MCMC Posterior Statistics',
    description: 'Posterior statistics from MCMC sampling: acceptance rate, stress ratio distribution, misfit summary',

    contexts: [
        VisualizationContext.RUN_ANALYSIS
    ],

    icon: MCMCStatsIcon,
    defaultLayout: { w: 8, h: 3 },

    stateType: 'mcmcStats',
    defaultSettings: createMCMCStatsSettings(),

    createInitialState: (width = 400, height = 400): MCMCStatsCompState => ({
        type: 'mcmcStats',
        open: false,
        settings: createMCMCStatsSettings(),
        selectedColumn: '',
        plotDimensions: { width, height }
    }),

    component: MCMCStatsComponent,

    version: '1.0.0',
    tags: ['mcmc', 'bayesian', 'posterior', 'statistics'],
    category: 'Stress Analysis'
};
