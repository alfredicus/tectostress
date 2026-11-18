// library.ts
// Rules for the groups the user creates ("My blocks"): a unique name and a description when they
// are made, which groups the palette offers, and what removing one implies.

import { compositeWithDependencies, usedComposites } from './composite';
import { BlockRegistry } from './registry';
import { CompositeDefinition, Workflow } from './types';

const normalised = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Why a new group cannot be created with this name and description, or null. The name must differ
 * (ignoring case and spaces) from every block of the palette: built-in blocks, the groups of the
 * workflow and of the library. The description is shown when the mouse is over the block.
 */
export function newGroupProblem(name: string, description: string, registry: BlockRegistry): string | null {
    if (!name.trim()) return 'Give the new block a name.';
    const taken = registry.list().find(b => normalised(b.title) === normalised(name));
    if (taken) return `“${taken.title}” is already the name of a block: choose another name.`;
    if (!description.trim()) return 'Describe what the block does: it is shown when the mouse is over it.';
    return null;
}

/** The group just created, with its name tidied and its description, in the workflow too */
export function describeGroup<R extends { workflow: Workflow; definition: CompositeDefinition }>(
    r: R, name: string, description: string
): R {
    const definition = { ...r.definition, title: name.trim().replace(/\s+/g, ' '), description: description.trim() };
    return {
        ...r,
        definition,
        workflow: { ...r.workflow, composites: r.workflow.composites?.map(c => c.type === definition.type ? definition : c) },
    };
}

/** Tooltip of a group: its description, or (older groups) what it contains */
export function groupTooltip(def: CompositeDefinition, registry: BlockRegistry): string {
    if (def.description?.trim()) return def.description;
    const names = def.nodes.map(n => n.label || registry.get(n.type)?.title || n.type);
    return `${def.loop ? 'Loop over' : 'Group of'}: ${names.join(', ')}`;
}

export interface PaletteGroup {
    def: CompositeDefinition;
    /** In the library of this browser (removable) */
    inLibrary: boolean;
    /** Placed on the canvas (directly or inside another group): the workflow needs its definition */
    usedInWorkflow: boolean;
}

/** Groups the palette offers: the library's, then those only in the workflow (e.g. from a file) */
export function paletteGroups(workflow: Workflow, library: CompositeDefinition[]): PaletteGroup[] {
    const used = new Set(usedComposites(workflow).map(c => c.type));
    return [
        ...library.map(def => ({ def, inLibrary: true, usedInWorkflow: used.has(def.type) })),
        ...(workflow.composites ?? [])
            .filter(def => !library.some(l => l.type === def.type))
            .map(def => ({ def, inLibrary: false, usedInWorkflow: used.has(def.type) })),
    ];
}

/** Library groups containing `type` (at any depth): removing it removes them too */
export function libraryGroupsContaining(type: string, library: CompositeDefinition[]): CompositeDefinition[] {
    return library.filter(c => c.type !== type && compositeWithDependencies(c.type, library).some(d => d.type === type));
}

/** The library without `type` and the groups containing it */
export function removeFromLibrary(type: string, library: CompositeDefinition[]): CompositeDefinition[] {
    const gone = new Set([type, ...libraryGroupsContaining(type, library).map(c => c.type)]);
    return library.filter(c => !gone.has(c.type));
}

/** The workflow without the definition of a group it no longer uses */
export function forgetUnusedGroup(workflow: Workflow, type: string): Workflow {
    if (usedComposites(workflow).some(c => c.type === type)) return workflow;
    return { ...workflow, composites: workflow.composites?.filter(c => c.type !== type) };
}
