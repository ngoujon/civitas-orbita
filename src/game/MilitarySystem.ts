/**
 * Entrainement de soldats et defense contre les raids.
 */

import { MILITARY, UNITS } from '@/config/units';
import { HAPPINESS } from '@/config/happiness';
import { canAfford, spend, withdraw } from '@/economy/ResourceManager';
import type { GameState } from '@/game/GameState';

export class MilitarySystem {
  update(state: GameState, dt: number): { defended: boolean; lostFood: number } | null {
    let barracksWorkers = 0;
    let barracksCount = 0;
    for (const b of Object.values(state.buildings)) {
      if (b.complete && b.def === 'barracks') {
        barracksCount++;
        barracksWorkers += b.workers;
      }
    }

    state.military.maxSoldiers = barracksCount * MILITARY.soldiersPerBarracks;

    if (barracksWorkers > 0 && state.military.soldiers < state.military.maxSoldiers) {
      const unit = UNITS.militia;
      const train = unit.trainRate * barracksWorkers * dt;
      if (canAfford(state, { food: unit.cost.food * train })) {
        spend(state, { food: unit.cost.food * train });
        state.military.soldiers = Math.min(
          state.military.maxSoldiers,
          state.military.soldiers + train,
        );
      }
    }

    const raid = state.military.activeRaid;
    if (!raid) return null;

    raid.progress += dt;
    let defense =
      state.military.soldiers * UNITS.militia.power +
      state.military.soldiers * 0.5 * UNITS.guard.power;
    if (state.population.happiness >= HAPPINESS.highGrowthThreshold) {
      defense *= 1 + MILITARY.happinessDefenseBonus;
    }

    if (defense >= raid.strength) {
      state.military.activeRaid = null;
      state.military.soldiers = Math.max(0, state.military.soldiers - raid.strength * 0.1);
      return { defended: true, lostFood: 0 };
    }

    if (raid.progress >= 15) {
      const lost = withdraw(state, 'food', 20);
      state.military.activeRaid = null;
      state.population.happiness = Math.max(0, state.population.happiness - 15);
      return { defended: false, lostFood: lost };
    }

    return null;
  }
}
