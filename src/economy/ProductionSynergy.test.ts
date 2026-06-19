import { describe, expect, it } from 'vitest';
import { createNewGame } from '@/game/GameState';
import { WorldMap } from '@/world/WorldMap';
import { countSynergyNeighbors, synergyMultiplier } from '@/economy/ProductionSynergy';
import { PRODUCTION_SYNERGY } from '@/config/synergy';

describe('ProductionSynergy', () => {
  it('accorde un bonus quand deux batiments du meme groupe sont voisins', () => {
    const state = createNewGame('sylvans', {
      chiefName: 'Test',
      villageName: 'Synergie',
    });
    const map = new WorldMap(state.ringCount);

    state.buildings['a'] = {
      id: 'a',
      def: 'lumberjack',
      sector: { ring: 1, index: 0 },
      complete: true,
      level: 1,
      workers: 2,
      buildProgress: 0,
    };
    state.buildings['b'] = {
      id: 'b',
      def: 'lumberjack',
      sector: { ring: 1, index: 1 },
      complete: true,
      level: 1,
      workers: 2,
      buildProgress: 0,
    };

    expect(countSynergyNeighbors(state, map, 'a')).toBe(1);
    expect(synergyMultiplier(state, map, 'a')).toBeCloseTo(1 + PRODUCTION_SYNERGY.bonusPerNeighbor);
  });

  it('ignore les voisins d un autre groupe', () => {
    const state = createNewGame('sylvans', {
      chiefName: 'Test',
      villageName: 'Mixte',
    });
    const map = new WorldMap(state.ringCount);

    state.buildings['a'] = {
      id: 'a',
      def: 'lumberjack',
      sector: { ring: 1, index: 0 },
      complete: true,
      level: 1,
      workers: 2,
      buildProgress: 0,
    };
    state.buildings['b'] = {
      id: 'b',
      def: 'farm',
      sector: { ring: 1, index: 1 },
      complete: true,
      level: 1,
      workers: 3,
      buildProgress: 0,
    };

    expect(countSynergyNeighbors(state, map, 'a')).toBe(0);
    expect(synergyMultiplier(state, map, 'a')).toBe(1);
  });
});
