/**
 * Acces a la mer : ligne radiale (spoke) reservee par les ports.
 *
 * Un port sur le rivage bloque toute sa colonne angulaire (du centre
 * vers la mer) pour garantir un chemin libre vers l eau.
 */

import type { GameState } from '@/game/GameState';
import type { BuildingInstance } from '@/buildings/BuildingInstance';
import { BUILDINGS } from '@/config/buildings';
import type { WorldMap } from './WorldMap';
import { sectorKey } from './Sector';
import type { SectorCoord } from './Sector';

/** Secteurs alignes angulairement avec `anchor` (tous anneaux, hors centre). */
export function spokeSectors(map: WorldMap, anchor: SectorCoord): SectorCoord[] {
  if (anchor.ring === 0) return [];
  const ring = map.getRing(anchor.ring);
  if (!ring) return [];

  const result: SectorCoord[] = [];
  for (let r = 1; r <= map.ringCount; r++) {
    const other = map.getRing(r);
    if (!other) continue;
    if (r === anchor.ring) {
      result.push({ ring: r, index: anchor.index });
      continue;
    }
    for (const i of ring.overlappingSectors(anchor.index, other)) {
      result.push({ ring: r, index: i });
    }
  }
  return result;
}

export function spokeKeys(map: WorldMap, anchor: SectorCoord): string[] {
  return spokeSectors(map, anchor).map(sectorKey);
}

/** Ports posés qui reservent une ligne d acces mer (des la pose). */
export function seaAccessPorts(buildings: Record<string, BuildingInstance>): BuildingInstance[] {
  return Object.values(buildings).filter((b) => BUILDINGS[b.def].reservesSeaAccess);
}

/** Cles de secteurs bloques par les ports existants (corridor mer). */
export function blockedSeaAccessKeys(
  map: WorldMap,
  buildings: Record<string, BuildingInstance>,
): Set<string> {
  const blocked = new Set<string>();
  for (const port of seaAccessPorts(buildings)) {
    for (const key of spokeKeys(map, port.sector)) {
      blocked.add(key);
    }
  }
  return blocked;
}

export function isSeaAccessBlocked(
  map: WorldMap,
  buildings: Record<string, BuildingInstance>,
  coord: SectorCoord,
): boolean {
  return blockedSeaAccessKeys(map, buildings).has(sectorKey(coord));
}

/** Marge de clic au-dela du rivage (zone sable) → snap sur l anneau exterieur. */
export { BEACH_SNAP_MARGIN } from '@/config/rings';
export function isShoreSector(map: WorldMap, coord: SectorCoord): boolean {
  return coord.ring === map.ringCount && coord.ring > 0;
}

/**
 * Pour le port : si le joueur vise l anneau interieur adjacent a la mer,
 * bascule vers le secteur de lisiere libre sur la meme colonne angulaire.
 */
export function resolvePortPlacementSector(
  map: WorldMap,
  coord: SectorCoord,
  occupied: ReadonlySet<string>,
  prepared: Readonly<Record<string, true>>,
): SectorCoord {
  if (coord.ring <= 0) return coord;
  if (isShoreSector(map, coord)) return coord;

  if (coord.ring !== map.ringCount - 1) return coord;

  const inner = map.getRing(coord.ring);
  const outer = map.getRing(map.ringCount);
  if (!inner || !outer) return coord;

  for (const oi of inner.overlappingSectors(coord.index, outer)) {
    const candidate = { ring: map.ringCount, index: oi };
    const key = sectorKey(candidate);
    if (occupied.has(key)) continue;
    if (!prepared[key]) continue;
    return candidate;
  }

  return coord;
}

/** La ligne radiale est libre de batiments (pour poser un port). */
export function isSpokeClearForPort(
  map: WorldMap,
  occupied: ReadonlySet<string>,
  portCoord: SectorCoord,
): boolean {
  for (const key of spokeKeys(map, portCoord)) {
    if (key === sectorKey(portCoord)) continue;
    if (occupied.has(key)) return false;
  }
  return true;
}

/** Ports dont la ligne intersecte `coord` (hors le port lui-meme). */
export function portsBlockingCoord(
  map: WorldMap,
  state: GameState,
  coord: SectorCoord,
): BuildingInstance[] {
  const key = sectorKey(coord);
  return seaAccessPorts(state.buildings).filter((p) => {
    if (sectorKey(p.sector) === key) return false;
    return spokeKeys(map, p.sector).includes(key);
  });
}
