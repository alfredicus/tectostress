// index.ts
// The block catalogue (§5, §11).

import { BlockRegistry } from '../registry';
import { DataBlock } from './dataBlock';
import { FilterBlock, MisfitFilterBlock } from './filterBlocks';
import { InversionBlock } from './inversionBlock';
import { AddTagsBlock } from './tagBlock';
import { AggregateBlock } from './aggregateBlock';
import { ReportBlock } from './reportBlock';
import { ConditionalBlock, ExitLoopBlock } from './controlBlocks';
import { DashboardBlock, VIEW_BLOCKS } from './viewBlocks';

export function createDefaultRegistry(): BlockRegistry {
    const registry = new BlockRegistry()
        .register(DataBlock)
        .register(FilterBlock)
        .register(MisfitFilterBlock)
        .register(InversionBlock)
        .register(AggregateBlock)
        .register(AddTagsBlock)
        .register(ReportBlock)
        .register(ConditionalBlock)
        .register(ExitLoopBlock)
        .register(DashboardBlock);
    VIEW_BLOCKS.forEach(v => registry.register(v));
    return registry;
}

export {
    DataBlock, FilterBlock, MisfitFilterBlock, InversionBlock, AggregateBlock, AddTagsBlock, ReportBlock,
    ConditionalBlock, ExitLoopBlock, DashboardBlock, VIEW_BLOCKS,
};
