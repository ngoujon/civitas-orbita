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

export type PlacementReason =
  | 'ok'
  | 'invalid'
  | 'center_reserved'
  | 'occupied'
  | 'not_adjacent'
  | 'not_prepared'
  | 'sea_access_reserved'
  | 'not_shore'
  | 'spoke_occupied';

export interface PlacementResult {
  readonly ok: boolean;
  readonly reason: PlacementReason;
}

const OK: PlacementResult = { ok: true, reason: 'ok' };

/** L'ensemble des cles de secteurs occupes (vue minimale de GameState). */
export type Occupancy = ReadonlySet<string>;

/** Secteurs deja prepares (aplatis / defriches). */
export type PreparedSectors = Readonly<Record<string, true>>;

/** Vrai si le secteur touche un batiment ou un terrain deja prepare. */
export function isAdjacentToSettlement(
  map: WorldMap,
  occupied: Occupancy,
  prepared: PreparedSectors,
  coord: SectorCoord,
): boolean {
  return map.neighbors(coord).some((n) => {
    const key = sectorKey(n);
    return occupied.has(key) || prepared[key] === true;
  });
}

export function canBuildAt(
  map: WorldMap,
  occupied: Occupancy,
  prepared: PreparedSectors,
  coord: SectorCoord,
  seaAccessBlocked?: ReadonlySet<string>,
): PlacementResult {
  if (!map.isValidCoord(coord)) return { ok: false, reason: 'invalid' };
  if (coord.ring === 0) return { ok: false, reason: 'center_reserved' };
  if (occupied.has(sectorKey(coord))) return { ok: false, reason: 'occupied' };
  if (seaAccessBlocked?.has(sectorKey(coord))) {
    return { ok: false, reason: 'sea_access_reserved' };
  }
  if (!prepared[sectorKey(coord)]) return { ok: false, reason: 'not_prepared' };

  if (!isAdjacentToSettlement(map, occupied, prepared, coord)) {
    return { ok: false, reason: 'not_adjacent' };
  }

  return OK;
}

/** Secteurs ou l'on peut construire (terrain prepare + adjacence + acces mer). */
export function buildableSectors(
  map: WorldMap,
  occupied: Occupancy,
  prepared: PreparedSectors,
  seaAccessBlocked?: ReadonlySet<string>,
): SectorCoord[] {
  const result: SectorCoord[] = [];
  for (const coord of map.sectors()) {
    if (canBuildAt(map, occupied, prepared, coord, seaAccessBlocked).ok) result.push(coord);
  }
  return result;
}
