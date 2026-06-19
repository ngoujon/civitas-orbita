/**
 * Synergie de production : batiments du meme groupe adjacents se boostent mutuellement.
 */

import { BUILDINGS } from '@/config/buildings';
import type { SynergyGroupId } from '@/config/synergy';
import { PRODUCTION_SYNERGY } from '@/config/synergy';
import type { GameState } from '@/game/GameState';
import type { BuildingInstance } from '@/buildings/BuildingInstance';
import { sectorKey } from '@/world/Sector';
import type { WorldMap } from '@/world/WorldMap';

export interface SynergyPathLink {
  readonly buildingIdA: string;
  readonly buildingIdB: string;
  readonly group: SynergyGroupId;
}

function buildingAtSector(
  state: GameState,
  sectorToBuilding: Map<string, string>,
  key: string,
): BuildingInstance | null {
  const id = sectorToBuilding.get(key);
  if (!id) return null;
  const b = state.buildings[id];
  return b?.complete ? b : null;
}

/** Nombre de voisins complets appartenant au meme groupe de synergie. */
export function countSynergyNeighbors(
  state: GameState,
  map: WorldMap,
  buildingId: string,
): number {
  const b = state.buildings[buildingId];
  if (!b?.complete) return 0;
  const group = BUILDINGS[b.def].synergyGroup;
  if (!group) return 0;

  const sectorToBuilding = new Map<string, string>();
  for (const other of Object.values(state.buildings)) {
    if (!other.complete) continue;
    sectorToBuilding.set(sectorKey(other.sector), other.id);
  }

  let count = 0;
  for (const neighbor of map.neighbors(b.sector)) {
    const other = buildingAtSector(state, sectorToBuilding, sectorKey(neighbor));
    if (!other || other.id === b.id) continue;
    if (BUILDINGS[other.def].synergyGroup === group) count++;
  }
  return count;
}

/** Multiplicateur de production (1 + bonus plafonne). */
export function synergyMultiplier(state: GameState, map: WorldMap, buildingId: string): number {
  const neighbors = countSynergyNeighbors(state, map, buildingId);
  if (neighbors <= 0) return 1;
  const bonus = Math.min(
    neighbors * PRODUCTION_SYNERGY.bonusPerNeighbor,
    PRODUCTION_SYNERGY.maxBonus,
  );
  return 1 + bonus;
}

/** Liens de synergie actifs (une arete par paire de voisins du meme groupe). */
export function collectSynergyLinks(state: GameState, map: WorldMap): SynergyPathLink[] {
  const sectorToBuilding = new Map<string, string>();
  for (const b of Object.values(state.buildings)) {
    if (!b.complete) continue;
    sectorToBuilding.set(sectorKey(b.sector), b.id);
  }

  const links: SynergyPathLink[] = [];
  const drawn = new Set<string>();

  for (const b of Object.values(state.buildings)) {
    if (!b.complete) continue;
    const group = BUILDINGS[b.def].synergyGroup;
    if (!group) continue;

    for (const neighbor of map.neighbors(b.sector)) {
      const other = buildingAtSector(state, sectorToBuilding, sectorKey(neighbor));
      if (!other || other.id === b.id) continue;
      if (BUILDINGS[other.def].synergyGroup !== group) continue;

      const edgeKey = b.id < other.id ? `${b.id}|${other.id}` : `${other.id}|${b.id}`;
      if (drawn.has(edgeKey)) continue;
      drawn.add(edgeKey);

      links.push({
        buildingIdA: b.id < other.id ? b.id : other.id,
        buildingIdB: b.id < other.id ? other.id : b.id,
        group,
      });
    }
  }

  return links;
}
