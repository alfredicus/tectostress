// registry.ts
// The block types a workflow can use.

import { BlockDefinition, PortDefinition, WorkflowNode } from './types';

export class BlockRegistry {
    private readonly blocks = new Map<string, BlockDefinition>();

    register(definition: BlockDefinition): this {
        if (this.blocks.has(definition.type)) {
            throw new Error(`Block type "${definition.type}" is already registered`);
        }
        this.blocks.set(definition.type, definition);
        return this;
    }

    get(type: string): BlockDefinition | undefined {
        return this.blocks.get(type);
    }

    has(type: string): boolean {
        return this.blocks.has(type);
    }

    list(): BlockDefinition[] {
        return Array.from(this.blocks.values());
    }
}

export function findPort(ports: PortDefinition[], id: string): PortDefinition | undefined {
    return ports.find(p => p.id === id);
}

/** Default value of every parameter of a scope, overridden by what the node stores */
export function paramsWithDefaults(
    definition: BlockDefinition,
    node: WorkflowNode,
    scope: 'scientific' | 'presentation'
): Record<string, any> {
    const stored = scope === 'scientific' ? node.scientificParams : node.presentationParams;
    const out: Record<string, any> = {};
    definition.params
        .filter(p => p.scope === scope)
        .forEach(p => {
            out[p.key] = stored?.[p.key] !== undefined ? stored[p.key] : structuredCloneSafe(p.default);
        });
    return out;
}

// Defaults are plain JSON values; copy them so a node never shares a default array/object.
function structuredCloneSafe<T>(value: T): T {
    return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

/** A new node of the given type, with default parameters */
export function createNode(
    definition: BlockDefinition,
    id: string,
    position = { x: 0, y: 0 },
    overrides: { scientific?: Record<string, any>; presentation?: Record<string, any>; label?: string } = {}
): WorkflowNode {
    const node: WorkflowNode = {
        id,
        type: definition.type,
        typeVersion: definition.version,
        label: overrides.label,
        active: true,
        scientificParams: {},
        presentationParams: {},
        position,
    };
    node.scientificParams = { ...paramsWithDefaults(definition, node, 'scientific'), ...overrides.scientific };
    node.presentationParams = { ...paramsWithDefaults(definition, node, 'presentation'), ...overrides.presentation };
    return node;
}
