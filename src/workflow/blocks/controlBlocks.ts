// controlBlocks.ts
// ExitLoop and Conditional (§12.3, §12.4). Both hand values over unchanged: never cached, and
// evaluated even when only checking what is out of date.

import { conditionParams, describeCondition, evaluateCondition, metricValue } from '../conditions';
import { BlockDefinition } from '../types';

export const ExitLoopBlock: BlockDefinition = {
    type: 'exit-loop',
    version: 1,
    title: 'ExitLoop',
    description: 'Inside a ForLoop: stop the loop after this iteration when the condition holds',
    category: 'Control',
    role: 'computation',
    inputs: [{ id: 'in', label: 'Value', type: 'any' }],
    outputs: [],
    passThrough: true,
    params: conditionParams({ metric: 'rows', operator: '<', value: 4 }),

    async execute(ctx) {
        const payload = ctx.inputs.in[0];
        if (!ctx.loop) {
            ctx.log('warning', 'Not inside a ForLoop: this block has no effect');
            return { outputs: {} };
        }
        const exit = evaluateCondition(ctx.params, payload, ctx.loop);
        const value = metricValue(ctx.params.metric, payload, ctx.loop);
        ctx.log('info', `Iteration ${ctx.loop.iteration}: ${describeCondition(ctx.params)}` +
            ` — value ${value === undefined ? 'not available yet' : +value.toFixed(4)}` +
            (exit ? ': the loop stops' : ''));
        return { outputs: {}, exitLoop: exit };
    },
};

export const ConditionalBlock: BlockDefinition = {
    type: 'conditional',
    version: 1,
    title: 'Conditional',
    description: 'Send the value to “then” when the condition holds, to “else” otherwise',
    category: 'Control',
    role: 'computation',
    inputs: [{ id: 'in', label: 'Value', type: 'any' }],
    outputs: [
        { id: 'then', label: 'Then', type: 'any', sameAs: 'in' },
        { id: 'else', label: 'Else', type: 'any', sameAs: 'in' },
    ],
    passThrough: true,
    params: conditionParams({ metric: 'misfit', operator: '≤', value: 10 }),

    async execute(ctx) {
        const payload = ctx.inputs.in[0];
        const holds = evaluateCondition(ctx.params, payload, ctx.loop);
        const taken = holds ? 'then' : 'else';
        const value = metricValue(ctx.params.metric, payload, ctx.loop);
        ctx.log('info', `${describeCondition(ctx.params)} — value ${value === undefined ? 'not available' : +value.toFixed(4)}: “${taken}”`);
        return { outputs: { [taken]: payload }, skip: [holds ? 'else' : 'then'] };
    },
};
