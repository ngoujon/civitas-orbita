/**
 * Systeme de construction : pose, annulation et progression des chantiers.
 *
 * Valide (deblocage d'age + placement + cout), debite les ressources, cree
 * l'instance, fait avancer la construction au fil du temps, et signale les
 * chantiers termines (le Game se charge d'emettre les evenements).
 */

import { BUILDINGS } from '@/config/buildings';
import type { BuildingId, ResourceAmounts } from '@/config/buildings';
import { applyCostMultiplier, getCivModifiers } from '@/config/civilizations';
import { canAfford, refund, spend } from '@/economy/ResourceManager';
import type { GameState } from '@/game/GameState';
import { createBuildingInstance } from './BuildingInstance';
import { isUnlocked } from './BuildingRegistry';
import { canBuildAt } from '@/world/Placement';
import type { WorldMap } from '@/world/WorldMap';
import { blockedSeaAccessKeys, isShoreSector, isSpokeClearForPort, resolvePortPlacementSector, spokeKeys } from '@/world/SeaAccess';
import { sectorKey } from '@/world/Sector';
import type { SectorCoord } from '@/world/Sector';

export type PlaceFailure =
  | 'locked'
  | 'not_buildable'
  | 'placement_invalid'
  | 'cannot_afford'
  | 'not_prepared'
  | 'terrain_preparing'
  | 'sea_access_reserved'
  | 'not_shore'
  | 'spoke_occupied';

export type PlaceResult =
  | { ok: true; id: string }
  | { ok: false; reason: PlaceFailure };

export type MoveFailure =
  | 'not_found'
  | 'immovable'
  | 'same_sector'
  | 'not_shore'
  | 'spoke_occupied'
  | 'placement_invalid'
  | 'not_prepared'
  | 'terrain_preparing'
  | 'sea_access_reserved';

export type MoveResult =
  | { ok: true; from: SectorCoord; to: SectorCoord }
  | { ok: false; reason: MoveFailure };

export class ConstructionSystem {
  /** Secteur effectif pour la validation (ex. port → lisiere sur la meme colonne). */
  private placementCoord(
    state: GameState,
    map: WorldMap,
    occupied: ReadonlySet<string>,
    buildingId: BuildingId,
    coord: SectorCoord,
  ): SectorCoord {
    const def = BUILDINGS[buildingId];
    if (!def.shoreRequired) return coord;
    return resolvePortPlacementSector(map, coord, occupied, state.preparedSectors);
  }

  /** Verifie sans muter si l'on peut construire ici. */
  canPlace(
    state: GameState,
    map: WorldMap,
    occupied: ReadonlySet<string>,
    buildingId: BuildingId,
    coord: SectorCoord,
  ): PlaceResult {
    coord = this.placementCoord(state, map, occupied, buildingId, coord);
    const def = BUILDINGS[buildingId];
    if (!def.buildable) return { ok: false, reason: 'not_buildable' };
    if (!isUnlocked(buildingId, state)) return { ok: false, reason: 'locked' };

    if (def.shoreRequired && !isShoreSector(map, coord)) {
      return { ok: false, reason: 'not_shore' };
    }
    if (def.reservesSeaAccess && !isSpokeClearForPort(map, occupied, coord)) {
      return { ok: false, reason: 'spoke_occupied' };
    }

    const key = sectorKey(coord);
    if (state.prepJobs[key]) return { ok: false, reason: 'terrain_preparing' };
    if (!state.preparedSectors[key]) return { ok: false, reason: 'not_prepared' };

    const seaBlocked = blockedSeaAccessKeys(map, state.buildings);
    const placement = canBuildAt(map, occupied, state.preparedSectors, coord, seaBlocked);
    if (!placement.ok) {
      if (placement.reason === 'sea_access_reserved') return { ok: false, reason: 'sea_access_reserved' };
      return { ok: false, reason: 'placement_invalid' };
    }
    if (!canAfford(state, this.effectiveCost(state, buildingId))) {
      return { ok: false, reason: 'cannot_afford' };
    }
    return { ok: true, id: '' };
  }

  /** Cout reel apres bonus passif de la civilisation. */
  effectiveCost(state: GameState, buildingId: BuildingId): ResourceAmounts {
    const mult = getCivModifiers(state.civ).buildCostMultiplier;
    return applyCostMultiplier(BUILDINGS[buildingId].cost, mult);
  }

  /** Pose un batiment (debite le cout). Renvoie l'id d'instance ou l'echec. */
  place(
    state: GameState,
    map: WorldMap,
    occupied: ReadonlySet<string>,
    buildingId: BuildingId,
    coord: SectorCoord,
  ): PlaceResult {
    coord = this.placementCoord(state, map, occupied, buildingId, coord);
    const check = this.canPlace(state, map, occupied, buildingId, coord);
    if (!check.ok) return check;

    const def = BUILDINGS[buildingId];
    spend(state, this.effectiveCost(state, buildingId));

    const id = `b${state.nextBuildingId++}`;
    const instant = def.buildTime <= 0;
    const instance = createBuildingInstance(id, buildingId, coord, instant);
    state.buildings[id] = instance;
    return { ok: true, id };
  }

  /** Verifie si un batiment existant peut etre deplace vers ce secteur. */
  canMove(
    state: GameState,
    map: WorldMap,
    occupied: ReadonlySet<string>,
    instanceId: string,
    toCoord: SectorCoord,
  ): MoveResult {
    const instance = state.buildings[instanceId];
    if (!instance) return { ok: false, reason: 'not_found' };
    toCoord = this.placementCoord(state, map, occupied, instance.def, toCoord);

    if (instance.def === 'campfire') return { ok: false, reason: 'immovable' };

    const fromCoord = instance.sector;
    if (sectorKey(fromCoord) === sectorKey(toCoord)) {
      return { ok: false, reason: 'same_sector' };
    }

    const def = BUILDINGS[instance.def];
    const occ = new Set(occupied);
    occ.delete(sectorKey(fromCoord));

    if (def.shoreRequired && !isShoreSector(map, toCoord)) {
      return { ok: false, reason: 'not_shore' };
    }
    if (def.reservesSeaAccess && !isSpokeClearForPort(map, occ, toCoord)) {
      return { ok: false, reason: 'spoke_occupied' };
    }

    const toKey = sectorKey(toCoord);
    if (state.prepJobs[toKey]) return { ok: false, reason: 'terrain_preparing' };
    if (!state.preparedSectors[toKey]) return { ok: false, reason: 'not_prepared' };

    const seaBlocked = blockedSeaAccessKeys(map, state.buildings);
    if (def.reservesSeaAccess) {
      for (const key of spokeKeys(map, fromCoord)) seaBlocked.delete(key);
    }

    const placement = canBuildAt(map, occ, state.preparedSectors, toCoord, seaBlocked);
    if (!placement.ok) {
      if (placement.reason === 'sea_access_reserved') {
        return { ok: false, reason: 'sea_access_reserved' };
      }
      return { ok: false, reason: 'placement_invalid' };
    }

    return { ok: true, from: fromCoord, to: toCoord };
  }

  /** Secteur cible effectif pour un batiment (port → lisiere). */
  effectivePlacementSector(buildingId: BuildingId, coord: SectorCoord, state: GameState, map: WorldMap, occupied: ReadonlySet<string>): SectorCoord {
    return this.placementCoord(state, map, occupied, buildingId, coord);
  }

  /** Deplace un batiment vers un secteur valide (sans cout). */
  move(
    state: GameState,
    map: WorldMap,
    occupied: ReadonlySet<string>,
    instanceId: string,
    toCoord: SectorCoord,
  ): MoveResult {
    const instance = state.buildings[instanceId];
    if (!instance) return { ok: false, reason: 'not_found' };
    toCoord = this.placementCoord(state, map, occupied, instance.def, toCoord);
    const check = this.canMove(state, map, occupied, instanceId, toCoord);
    if (!check.ok) return check;

    state.buildings[instanceId]!.sector = toCoord;
    return check;
  }

  /** Annule/demolit un batiment. Rembourse integralement si encore en chantier. */
  cancel(state: GameState, instanceId: string): boolean {
    const instance = state.buildings[instanceId];
    if (!instance) return false;
    if (instance.def === 'campfire') return false; // le centre est indestructible

    if (!instance.complete) {
      refund(state, this.effectiveCost(state, instance.def));
    }
    delete state.buildings[instanceId];
    return true;
  }

  /**
   * Fait progresser les chantiers. Renvoie les ids termines durant ce tick.
   * dt en secondes.
   */
  update(state: GameState, dt: number): string[] {
    const completed: string[] = [];
    // buildTimeMultiplier < 1 => chantiers plus rapides (progression acceleree).
    const timeMult = getCivModifiers(state.civ).buildTimeMultiplier;
    const step = timeMult > 0 ? dt / timeMult : dt;
    for (const b of Object.values(state.buildings)) {
      if (b.complete) continue;
      b.buildProgress += step;
      if (b.buildProgress >= BUILDINGS[b.def].buildTime) {
        b.complete = true;
        completed.push(b.id);
      }
    }
    return completed;
  }

  /** Termine instantanement tous les chantiers (capacite active). Renvoie les ids. */
  completeAll(state: GameState): string[] {
    const completed: string[] = [];
    for (const b of Object.values(state.buildings)) {
      if (b.complete) continue;
      b.complete = true;
      b.buildProgress = BUILDINGS[b.def].buildTime;
      completed.push(b.id);
    }
    return completed;
  }

  /** Cle de secteur d'une instance (utilitaire). */
  static sectorKeyOf(coord: SectorCoord): string {
    return sectorKey(coord);
  }
}
