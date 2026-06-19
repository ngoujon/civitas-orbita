/**
 * Systeme de population.
 *
 * Gere : capacite de logement (derivee des batiments), affectation automatique
 * des travailleurs aux emplois, croissance si nourriture + logement disponibles,
 * declin en cas de famine, et consommation de nourriture.
 */

import { POPULATION } from '@/config/game';
import { BUILDINGS } from '@/config/buildings';
import { HAPPINESS } from '@/config/happiness';
import { getCivModifiers } from '@/config/civilizations';
import type { GameState } from '@/game/GameState';
import { withdraw } from '@/economy/ResourceManager';
import { assignWorkers } from '@/population/WorkerAllocation';

export class PopulationSystem {
  update(state: GameState, dt: number): void {
    const pop = state.population;
    const mods = getCivModifiers(state.civ);

    // 1) Capacite de logement.
    let capacity = 0;
    for (const b of Object.values(state.buildings)) {
      if (!b.complete) continue;
      const housing = BUILDINGS[b.def].housing;
      if (housing) capacity += housing * b.level;
    }
    pop.capacity = capacity;

    // 1b) Bonheur : logement, marches, famine.
    let happiness = state.population.happiness ?? HAPPINESS.start;
    if (capacity > 0 && pop.count >= capacity * 0.9) {
      happiness += HAPPINESS.housingBonusPerCap * dt * 10;
    }
    for (const b of Object.values(state.buildings)) {
      if (b.complete && b.def === 'market') happiness += 0.01 * dt;
    }
    // 2) Consommation de nourriture (proportionnelle a la population vivante).
    const headcount = Math.floor(pop.count);
    const foodNeeded =
      headcount * POPULATION.foodPerCapitaPerSecond * mods.foodConsumptionMultiplier * dt;
    const foodEaten = withdraw(state, 'food', foodNeeded);
    const starving = foodEaten < foodNeeded - 1e-9;
    if (starving) {
      happiness -= HAPPINESS.starvationPenaltyPerSecond * dt;
    }

    pop.happiness = Math.max(HAPPINESS.min, Math.min(HAPPINESS.max, happiness));

    // 3) Croissance ou famine.
    let growthMult = 1;
    if (pop.happiness >= HAPPINESS.highGrowthThreshold) growthMult = HAPPINESS.highGrowthBonus;
    else if (pop.happiness <= HAPPINESS.lowGrowthThreshold) growthMult = HAPPINESS.lowGrowthPenalty;

    if (starving) {
      pop.count = Math.max(0, pop.count - POPULATION.starvationPerSecond * dt);
    } else if (pop.count < pop.capacity) {
      const growth = POPULATION.growthPerSecond * mods.populationGrowthMultiplier * growthMult * dt;
      pop.count = Math.min(pop.capacity, pop.count + growth);
    }

    // 4) Affectation des travailleurs (auto ou manuelle par secteur).
    assignWorkers(state);
  }
}
