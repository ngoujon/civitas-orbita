/**
 * Systeme de recherche / progression des ages.
 *
 * Decide quand la civilisation peut passer a l'age suivant (cout en science +
 * population requise) et applique la transition. Les batiments/ressources
 * debloques sont determines par la config (unlockedAtAge), interroges ailleurs.
 */

import { AGES, nextAge } from '@/config/ages';
import type { AgeId } from '@/config/ages';
import type { GameState } from '@/game/GameState';

export interface AgeAdvanceResult {
  advanced: boolean;
  from: AgeId;
  to?: AgeId;
}

export class AgeSystem {
  /** Age suivant, ou null si dernier age atteint. */
  nextAge(state: GameState): AgeId | null {
    return nextAge(state.age);
  }

  /** Conditions reunies pour rechercher l'age suivant ? */
  canAdvance(state: GameState): boolean {
    const next = nextAge(state.age);
    if (!next) return false;
    const def = AGES[next];
    return (
      state.population.count >= def.requiredPopulation && state.resources.science >= def.scienceCost
    );
  }

  /** Progression [0..1] vers l'age suivant (en science). */
  scienceProgress(state: GameState): number {
    const next = nextAge(state.age);
    if (!next) return 1;
    const cost = AGES[next].scienceCost;
    if (cost <= 0) return 1;
    return Math.min(1, state.resources.science / cost);
  }

  /** Tente la transition. Consomme la science requise et avance l'age. */
  advance(state: GameState): AgeAdvanceResult {
    const from = state.age;
    if (!this.canAdvance(state)) return { advanced: false, from };
    const next = nextAge(from)!;
    state.resources.science -= AGES[next].scienceCost;
    state.age = next;
    return { advanced: true, from, to: next };
  }
}
