import { describe, it, expect } from 'vitest';
import { ProductionSystem } from './ProductionSystem';
import { createNewGame } from '@/game/GameState';
import { WorldMap } from '@/world/WorldMap';
import { createBuildingInstance } from '@/buildings/BuildingInstance';

describe('ProductionSystem', () => {
  it('produit du bois avec un bucheron', () => {
    const state = createNewGame();
    const map = new WorldMap(state.ringCount);
    const lumberjack = createBuildingInstance('b1', 'lumberjack', { ring: 1, index: 0 }, true);
    lumberjack.workers = 1;
    state.buildings[lumberjack.id] = lumberjack;
    state.resources.wood = 0;

    const prod = new ProductionSystem();
    prod.update(state, map, 1);

    expect(state.resources.wood).toBeGreaterThan(0);
  });
});
