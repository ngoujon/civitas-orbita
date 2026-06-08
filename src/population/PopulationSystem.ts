/**
 * Systeme de population.
 *
 * Gere : capacite de logement (derivee des batiments), affectation automatique
 * des travailleurs aux emplois, croissance si nourriture + logement disponibles,
 * declin en cas de famine, et consommation de nourriture.
 */

import { POPULATION } from '@/config/game';
import { BUILDINGS } from '@/config/buildings';
import { getCivModifiers } from '@/config/civilizations';
import type { GameState } from '@/game/GameState';
import { withdraw } from '@/economy/ResourceManager';

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

    // 2) Consommation de nourriture (proportionnelle a la population vivante).
    const headcount = Math.floor(pop.count);
    const foodNeeded =
      headcount * POPULATION.foodPerCapitaPerSecond * mods.foodConsumptionMultiplier * dt;
    const foodEaten = withdraw(state, 'food', foodNeeded);
    const starving = foodEaten < foodNeeded - 1e-9;

    // 3) Croissance ou famine.
    if (starving) {
      pop.count = Math.max(0, pop.count - POPULATION.starvationPerSecond * dt);
    } else if (pop.count < pop.capacity) {
      const growth = POPULATION.growthPerSecond * mods.populationGrowthMultiplier * dt;
      pop.count = Math.min(pop.capacity, pop.count + growth);
    }

    // 4) Affectation des travailleurs aux emplois (greedy, stable).
    this.assignWorkers(state);
  }

  /**
   * Repartit les habitants disponibles sur les emplois ouverts.
   * Strategie simple et deterministe : on remplit les batiments par ordre d'id.
   * (Extensible plus tard : priorites, metiers, distance au logement.)
   */
  private assignWorkers(state: GameState): void {
    const available = Math.floor(state.population.count);
    let remaining = available;

    const jobBuildings = Object.values(state.buildings)
      .filter((b) => b.complete && (BUILDINGS[b.def].jobs ?? 0) > 0)
      .sort((a, b) => (a.id < b.id ? -1 : 1));

    for (const b of jobBuildings) {
      const jobs = BUILDINGS[b.def].jobs ?? 0;
      const take = Math.max(0, Math.min(jobs, remaining));
      b.workers = take;
      remaining -= take;
    }

    state.population.assigned = available - remaining;
  }
}
