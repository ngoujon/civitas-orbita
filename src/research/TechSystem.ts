/**
 * Systeme de recherche technologique.
 *
 * Debloque les batiments via l arbre de technologies (config/technologies.ts).
 * Consomme de la science a la validation.
 */

import { ageAtLeast } from '@/config/ages';
import { TECHNOLOGIES, TECH_LIST, type TechId } from '@/config/technologies';
import { roundToCent } from '@/economy/resourceFormat';
import type { GameState } from '@/game/GameState';

export type TechFailure =
  | 'not_found'
  | 'already_researched'
  | 'age_locked'
  | 'prerequisites'
  | 'cannot_afford';

export type TechResult = { ok: true; id: TechId } | { ok: false; reason: TechFailure };

export type TechStatus = 'researched' | 'available' | 'locked';

export class TechSystem {
  isResearched(state: GameState, techId: TechId): boolean {
    return !!state.researchedTechs[techId];
  }

  status(state: GameState, techId: TechId): TechStatus {
    if (this.isResearched(state, techId)) return 'researched';
    if (this.canResearch(state, techId).ok) return 'available';
    return 'locked';
  }

  canResearch(state: GameState, techId: TechId): TechResult {
    const def = TECHNOLOGIES[techId];
    if (!def) return { ok: false, reason: 'not_found' };
    if (this.isResearched(state, techId)) return { ok: false, reason: 'already_researched' };
    if (!ageAtLeast(state.age, def.requiredAge)) return { ok: false, reason: 'age_locked' };
    for (const pre of def.prerequisites) {
      if (!this.isResearched(state, pre)) return { ok: false, reason: 'prerequisites' };
    }
    if (roundToCent(state.resources.science) < def.scienceCost) {
      return { ok: false, reason: 'cannot_afford' };
    }
    return { ok: true, id: techId };
  }

  research(state: GameState, techId: TechId): TechResult {
    const check = this.canResearch(state, techId);
    if (!check.ok) return check;
    const def = TECHNOLOGIES[techId];
    state.resources.science -= def.scienceCost;
    state.researchedTechs[techId] = true;
    return { ok: true, id: techId };
  }

  /** Accorde toutes les technologies eligibles selon l age et les prerequis (migration). */
  grantEligibleTechs(state: GameState): TechId[] {
    const granted: TechId[] = [];
    let changed = true;
    while (changed) {
      changed = false;
      for (const def of TECH_LIST) {
        if (this.isResearched(state, def.id)) continue;
        if (!ageAtLeast(state.age, def.requiredAge)) continue;
        if (!def.prerequisites.every((p) => this.isResearched(state, p))) continue;
        state.researchedTechs[def.id] = true;
        granted.push(def.id);
        changed = true;
      }
    }
    return granted;
  }
}
