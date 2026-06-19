/**
 * Preparation du terrain : defrichage / aplatissement avant construction.
 */

import { TERRAIN_PREP } from '@/config/terrain';
import type { TerrainKind } from '@/config/terrain';
import { canAfford, credit, recomputeCapacities, spend } from '@/economy/ResourceManager';
import { roundToCent } from '@/economy/resourceFormat';
import type { ResourceAmounts } from '@/config/buildings';
import type { ResourceId } from '@/config/resources';
import type { GameState } from '@/game/GameState';
import { terrainKindAt } from './Terrain';
import type { WorldMap } from './WorldMap';
import { isAdjacentToSettlement } from './Placement';
import { blockedSeaAccessKeys } from './SeaAccess';
import { sectorKey } from './Sector';
import type { SectorCoord } from './Sector';

export interface SectorPrepJob {
  kind: TerrainKind;
  progress: number;
}

export type PrepFailure =
  | 'invalid'
  | 'center_reserved'
  | 'occupied'
  | 'already_prepared'
  | 'already_preparing'
  | 'not_adjacent'
  | 'cannot_afford'
  | 'sea_access_reserved';

export type PrepResult = { ok: true } | { ok: false; reason: PrepFailure };

export type PrepCompleted = { key: string; yields: ResourceAmounts };

export class TerrainSystem {
  isPrepared(state: GameState, coord: SectorCoord): boolean {
    return state.preparedSectors[sectorKey(coord)] === true;
  }

  isPreparing(state: GameState, coord: SectorCoord): boolean {
    return sectorKey(coord) in state.prepJobs;
  }

  prepJobAt(state: GameState, coord: SectorCoord): SectorPrepJob | undefined {
    return state.prepJobs[sectorKey(coord)];
  }

  terrainKindAt(coord: SectorCoord): TerrainKind {
    return terrainKindAt(coord);
  }

  /** Peut-on lancer une preparation sur ce secteur ? */
  canPrepare(
    state: GameState,
    map: WorldMap,
    occupied: ReadonlySet<string>,
    coord: SectorCoord,
  ): PrepResult {
    if (!map.isValidCoord(coord)) return { ok: false, reason: 'invalid' };
    if (coord.ring === 0) return { ok: false, reason: 'center_reserved' };
    const key = sectorKey(coord);
    if (occupied.has(key)) return { ok: false, reason: 'occupied' };
    if (state.preparedSectors[key]) return { ok: false, reason: 'already_prepared' };
    if (state.prepJobs[key]) return { ok: false, reason: 'already_preparing' };
    if (blockedSeaAccessKeys(map, state.buildings).has(key)) {
      return { ok: false, reason: 'sea_access_reserved' };
    }
    if (!isAdjacentToSettlement(map, occupied, state.preparedSectors, coord)) {
      return { ok: false, reason: 'not_adjacent' };
    }
    const kind = terrainKindAt(coord);
    if (!canAfford(state, TERRAIN_PREP[kind].cost)) {
      return { ok: false, reason: 'cannot_afford' };
    }
    return { ok: true };
  }

  /** Demarre la preparation (debite le cout). */
  startPrepare(
    state: GameState,
    map: WorldMap,
    occupied: ReadonlySet<string>,
    coord: SectorCoord,
  ): PrepResult {
    const check = this.canPrepare(state, map, occupied, coord);
    if (!check.ok) return check;

    const key = sectorKey(coord);
    const kind = terrainKindAt(coord);
    spend(state, TERRAIN_PREP[kind].cost);
    state.prepJobs[key] = { kind, progress: 0 };
    return { ok: true };
  }

  /** Fait avancer les preparations en cours. Renvoie les secteurs termines et leurs gains. */
  update(state: GameState, dt: number): PrepCompleted[] {
    recomputeCapacities(state);
    const done: PrepCompleted[] = [];
    for (const [key, job] of Object.entries(state.prepJobs)) {
      job.progress += dt;
      if (job.progress >= TERRAIN_PREP[job.kind].time) {
        delete state.prepJobs[key];
        state.preparedSectors[key] = true;
        const yields = this.grantPrepYields(state, job.kind);
        done.push({ key, yields });
      }
    }
    return done;
  }

  private grantPrepYields(state: GameState, kind: TerrainKind): ResourceAmounts {
    const def = TERRAIN_PREP[kind];
    const taken: ResourceAmounts = {};
    for (const [res, amount] of Object.entries(def.yields) as [ResourceId, number][]) {
      if (!amount || amount <= 0) continue;
      const capped = roundToCent(amount);
      const got = roundToCent(credit(state, res, capped));
      if (got > 0) taken[res] = got;
    }
    return taken;
  }
}
