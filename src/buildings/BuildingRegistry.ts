/**
 * Registre des batiments : acces aux definitions et requetes de deblocage.
 *
 * S'appuie entierement sur config/buildings.ts. Centralise les questions du
 * type "quels batiments puis-je construire a cet age ?".
 */

import { BUILDINGS, BUILDING_LIST } from '@/config/buildings';
import type { BuildingDef, BuildingId } from '@/config/buildings';
import { ageAtLeast } from '@/config/ages';
import type { AgeId } from '@/config/ages';

export function getBuildingDef(id: BuildingId): BuildingDef {
  return BUILDINGS[id];
}

/** Un batiment est-il debloque a l'age donne ? */
export function isUnlocked(id: BuildingId, age: AgeId): boolean {
  return ageAtLeast(age, BUILDINGS[id].unlockedAtAge);
}

/** Batiments constructibles par le joueur a l'age donne (tries par ordre de config). */
export function buildableAtAge(age: AgeId): BuildingDef[] {
  return BUILDING_LIST.filter((def) => def.buildable && ageAtLeast(age, def.unlockedAtAge));
}
