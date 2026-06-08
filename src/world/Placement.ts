/**
 * Regles de placement des batiments sur la carte.
 *
 * Logique pure : prend la geometrie (WorldMap) et l'occupation courante
 * (ensemble de cles de secteurs occupes) et decide si un secteur est constructible.
 *
 * Croissance organique : un secteur est constructible s'il est vide et adjacent
 * a un secteur deja occupe (le feu de camp central amorce la croissance).
 */

import type { WorldMap } from './WorldMap';
import { sectorKey } from './Sector';
import type { SectorCoord } from './Sector';

export type PlacementReason = 'ok' | 'invalid' | 'center_reserved' | 'occupied' | 'not_adjacent';

export interface PlacementResult {
  readonly ok: boolean;
  readonly reason: PlacementReason;
}

const OK: PlacementResult = { ok: true, reason: 'ok' };

/** L'ensemble des cles de secteurs occupes (vue minimale de GameState). */
export type Occupancy = ReadonlySet<string>;

export function canBuildAt(
  map: WorldMap,
  occupied: Occupancy,
  coord: SectorCoord,
): PlacementResult {
  if (!map.isValidCoord(coord)) return { ok: false, reason: 'invalid' };
  if (coord.ring === 0) return { ok: false, reason: 'center_reserved' };
  if (occupied.has(sectorKey(coord))) return { ok: false, reason: 'occupied' };

  // Doit toucher un secteur occupe (croissance vers l'exterieur).
  const adjacent = map.neighbors(coord).some((n) => occupied.has(sectorKey(n)));
  if (!adjacent) return { ok: false, reason: 'not_adjacent' };

  return OK;
}

/** Tous les secteurs actuellement constructibles (utile pour surligner l'UI). */
export function buildableSectors(map: WorldMap, occupied: Occupancy): SectorCoord[] {
  const result: SectorCoord[] = [];
  for (const coord of map.sectors()) {
    if (canBuildAt(map, occupied, coord).ok) result.push(coord);
  }
  return result;
}
