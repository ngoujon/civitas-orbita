/**
 * Fusion des iles PNJ dans l'ile principale quand le rivage les atteint.
 */

import { NPC_ISLAND_RADIUS } from '@/config/npcIslands';
import type { GameState } from '@/game/GameState';

/** Marge : l'ile PNJ est absorbee quand le rivage touche son littoral. */
const ABSORB_SHORE_INSET = NPC_ISLAND_RADIUS * 0.5;

/** Vrai si l'ile PNJ est encore independante (selectable, pillable). */
export function isNpcIslandActive(island: { absorbed?: boolean }): boolean {
  return !island.absorbed;
}

/** Iles PNJ encore interactives. */
export function activeNpcIslands(state: GameState) {
  return state.npcIslands.filter(isNpcIslandActive);
}

/**
 * Marque comme absorbees les iles dont le rivage principal les a rejoints.
 * Retourne les ids nouvellement absorbes.
 */
export function absorbNpcIslandsByShore(state: GameState, shoreRadius: number): string[] {
  const newly: string[] = [];
  const limit = shoreRadius + ABSORB_SHORE_INSET;

  for (const island of state.npcIslands) {
    if (island.absorbed) continue;
    const dist = Math.hypot(island.x, island.y);
    if (dist > limit) continue;
    island.absorbed = true;
    island.expedition = null;
    newly.push(island.id);
  }

  return newly;
}

/** Migration / chargement : applique l'absorption selon le rivage actuel. */
export function syncNpcIslandAbsorption(state: GameState, shoreRadius: number): string[] {
  return absorbNpcIslandsByShore(state, shoreRadius);
}
