// Groups made by the user (My blocks): unique name, description, palette, removal

import { createDefaultRegistry } from '../blocks';
import { groupAsComposite, registryFor } from '../composite';
import {
    describeGroup, forgetUnusedGroup, groupTooltip, libraryGroupsContaining, newGroupProblem, paletteGroups, removeFromLibrary,
} from '../library';
import { CompositeDefinition, Workflow } from '../types';
import { edge, node, workflow } from './fixtures';

const base = createDefaultRegistry();
let counter = 0;
const makeId = () => `n${++counter}`;

/** Inversion → [ Misfit histogram, [ Stereonet, Mohr ] ], the inner group made first */
function nested() {
    const wf0 = workflow(
        [node('i', 'inversion'), node('h', 'view.misfit-histogram'), node('s', 'view.stereonet'), node('m', 'view.mohr')],
        [edge('i', 'out', 'h'), edge('i', 'out', 's', 'result'), edge('i', 'out', 'm')]);
    const inner = describeGroup(groupAsComposite(wf0, base, ['s', 'm'], 'x', makeId), 'Stereonet + Mohr', 'Both views of a result');
    const outer = describeGroup(groupAsComposite(inner.workflow, registryFor(inner.workflow, base), ['h', inner.nodeId], 'x', makeId),
        'All views', 'Histogram, stereonet and Mohr');
    return { inner, outer, library: [inner.definition, outer.definition] as CompositeDefinition[] };
}

describe('a new group needs a unique name and a description', () => {
    test('the problems, in the order the user meets them', () => {
        const { outer, library } = nested();
        const registry = registryFor(outer.workflow, base, library);
        expect(newGroupProblem('  ', 'd', registry)).toBe('Give the new block a name.');
        expect(newGroupProblem('stereonet  +  MOHR', 'd', registry)).toBe('“Stereonet + Mohr” is already the name of a block: choose another name.');
        expect(newGroupProblem('Inversion', 'd', registry)).toMatch(/already the name of a block/);
        expect(newGroupProblem('Clean data', ' ', registry)).toMatch(/Describe what the block does/);
        expect(newGroupProblem('Clean data', 'Removes outliers', registry)).toBeNull();
    });

    test('the description is kept in the library and in the workflow, and is the tooltip', () => {
        const { inner, outer } = nested();
        expect(inner.definition.title).toBe('Stereonet + Mohr');
        expect(outer.workflow.composites!.find(c => c.type === inner.definition.type)!.description).toBe('Both views of a result');
        expect(groupTooltip(outer.definition, base)).toBe('Histogram, stereonet and Mohr');
        // An older group, without description, lists what it contains
        const old = { ...inner.definition, description: undefined };
        expect(groupTooltip(old, base)).toBe('Group of: Stereonet, Mohr diagram');
    });
});

describe('removing a group', () => {
    test('a group inside another library group goes with it, after saying which', () => {
        const { inner, outer, library } = nested();
        expect(libraryGroupsContaining(inner.definition.type, library).map(c => c.title)).toEqual(['All views']);
        expect(removeFromLibrary(inner.definition.type, library)).toEqual([]);
        expect(removeFromLibrary(outer.definition.type, library).map(c => c.title)).toEqual(['Stereonet + Mohr']);
    });

    test('the palette shows a group still on the canvas even when removed from the library', () => {
        const { inner, outer, library } = nested();
        const afterRemoval = removeFromLibrary(inner.definition.type, library);
        const shown = paletteGroups(outer.workflow, afterRemoval);
        expect(shown.map(g => [g.def.title, g.inLibrary, g.usedInWorkflow])).toEqual([
            ['Stereonet + Mohr', false, true], ['All views', false, true],
        ]);
        // Used: the workflow keeps it
        expect(forgetUnusedGroup(outer.workflow, inner.definition.type)).toBe(outer.workflow);
    });

    test('a group no longer on the canvas can be forgotten by the workflow', () => {
        const { outer } = nested();
        const wf: Workflow = { ...outer.workflow, nodes: outer.workflow.nodes.filter(n => n.id === 'i') };
        expect(paletteGroups(wf, []).every(g => !g.usedInWorkflow)).toBe(true);
        const type = outer.definition.type;
        expect(forgetUnusedGroup(wf, type).composites!.map(c => c.type)).not.toContain(type);
    });
});
