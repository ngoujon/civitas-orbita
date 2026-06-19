/**
 * Registre des batiments : acces aux definitions et requetes de deblocage.
 *
 * S'appuie sur config/buildings.ts et config/technologies.ts.
 * Un batiment est constructible si l age ET la technologie requise sont atteints.
 */

import { BUILDINGS, BUILDING_LIST, BUILDING_CATEGORY_ORDER } from '@/config/buildings';
import type { BuildingCategory, BuildingDef, BuildingId } from '@/config/buildings';
import { ageAtLeast } from '@/config/ages';
import { techForBuilding } from '@/config/technologies';
import type { GameState } from '@/game/GameState';

export function getBuildingDef(id: BuildingId): BuildingDef {
  return BUILDINGS[id];
}

/** Un batiment est-il debloque (age + technologie) ? */
export function isUnlocked(id: BuildingId, state: Pick<GameState, 'age' | 'researchedTechs'>): boolean {
  const def = BUILDINGS[id];
  if (!ageAtLeast(state.age, def.unlockedAtAge)) return false;
  if (!def.buildable) return false;
  const tech = techForBuilding(id);
  if (!tech) return true;
  return !!state.researchedTechs[tech];
}

/** Batiments constructibles par le joueur (tries par ordre de config). */
export function buildableForState(state: GameState): BuildingDef[] {
  return BUILDING_LIST.filter((def) => def.buildable && isUnlocked(def.id, state));
}

/** Batiments constructibles regroupes par categorie (sections du panneau UI). */
export function buildableGroupedByCategory(state: GameState): Map<BuildingCategory, BuildingDef[]> {
  const groups = new Map<BuildingCategory, BuildingDef[]>();
  for (const def of buildableForState(state)) {
    const list = groups.get(def.category) ?? [];
    list.push(def);
    groups.set(def.category, list);
  }
  return groups;
}

/** Categories ayant au moins un batiment constructible. */
export function buildableCategoriesForState(state: GameState): BuildingCategory[] {
  const groups = buildableGroupedByCategory(state);
  return BUILDING_CATEGORY_ORDER.filter((cat) => (groups.get(cat)?.length ?? 0) > 0);
}
