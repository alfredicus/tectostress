// index.ts
// Workflow engine: public API (see doc/workflow-spec.md).

export * from './types';
export { BlockRegistry, createNode, paramsWithDefaults } from './registry';
export { validateWorkflow, canConnect, resolveOutputType, topologicalOrder, upstreamOf } from './validate';
export type { ValidationIssue, ResolvedType } from './validate';
export { runWorkflow, planWorkflow, WorkflowCache, WorkflowValidationError } from './executor';
export type { RunOptions } from './executor';
export { serializeWorkflow, parseWorkflow, WorkflowFormatError, WORKFLOW_SCHEMA_VERSION } from './persistence';
export { PREDEFINED_WORKFLOWS, instantiateTemplate } from './templates';
export type { WorkflowTemplate } from './templates';
export { createDefaultRegistry } from './blocks';
export {
    registryFor, groupAsComposite, ungroupComposite, expandComposites, isCompositeType, outerId, innerPresentation,
    usedComposites, compositeWithDependencies, leafIds,
    valueAtIteration, bodyForIteration,
    CompositeError, COMPOSITE_PREFIX, makeLoop, loopOptions, LOOP_COLLECTED,
} from './composite';
export { METRICS, OPERATORS, describeCondition } from './conditions';
export type { InnerParams, PerIteration } from './composite';
export { fileRef } from './blocks/datasetUtils';
export { POPULATION_STYLE, populationOf, classification, selectPopulation, inversionData } from './populations';
export type { Population, ShowPopulation } from './populations';
