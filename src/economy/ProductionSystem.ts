/**
 * Systeme de production / consommation.
 *
 * A chaque tick : recalcule les capacites, fait avancer les chaines de
 * production de chaque batiment termine selon son effectif et la disponibilite
 * de ses intrants, puis credite/debite les ressources (avec ecretage).
 */

import { BUILDINGS } from '@/config/buildings';
import { getCivModifiers } from '@/config/civilizations';
import type { ResourceId } from '@/config/resources';
import type { GameState } from '@/game/GameState';
import { credit, recomputeCapacities, withdraw } from './ResourceManager';

export class ProductionSystem {
  /** dt en secondes (duree d'un tick logique). */
  update(state: GameState, dt: number): void {
    recomputeCapacities(state);

    const mods = getCivModifiers(state.civ);
    // Buff de capacite active : multiplie toute la production tant qu'il est actif.
    const buff = state.ability.buffRemaining > 0 ? state.ability.buffMultiplier : 1;

    for (const b of Object.values(state.buildings)) {
      if (!b.complete) continue;
      const def = BUILDINGS[b.def];
      if (!def.produces && !def.consumes) continue;

      // Taux d'activite : effectif rempli (1 pour les batiments passifs).
      let activity = b.level;
      if (def.jobs && def.jobs > 0) {
        const staffing = Math.min(b.workers / def.jobs, 1);
        activity *= staffing;
        if (staffing <= 0) continue;
      }

      // Limite par la disponibilite des intrants (chaine de production).
      let inputRatio = 1;
      if (def.consumes) {
        for (const [res, rate] of Object.entries(def.consumes) as [ResourceId, number][]) {
          const need = rate * activity * dt;
          if (need <= 0) continue;
          const available = state.resources[res];
          inputRatio = Math.min(inputRatio, available / need);
        }
        inputRatio = Math.max(0, Math.min(1, inputRatio));
      }

      const effective = activity * inputRatio;
      if (effective <= 0) continue;

      if (def.consumes) {
        for (const [res, rate] of Object.entries(def.consumes) as [ResourceId, number][]) {
          withdraw(state, res, rate * effective * dt);
        }
      }
      if (def.produces) {
        for (const [res, rate] of Object.entries(def.produces) as [ResourceId, number][]) {
          // Bonus passifs de civilisation (global + par ressource) et buff actif.
          const civBonus = mods.productionMultiplier * (mods.productionByResource[res] ?? 1) * buff;
          credit(state, res, rate * effective * dt * civBonus);
        }
      }
    }
  }
}
