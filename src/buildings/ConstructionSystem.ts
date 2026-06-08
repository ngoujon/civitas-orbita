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
import { sectorKey } from '@/world/Sector';
import type { SectorCoord } from '@/world/Sector';

export type PlaceFailure =
  | 'locked'
  | 'not_buildable'
  | 'placement_invalid'
  | 'cannot_afford';

export type PlaceResult =
  | { ok: true; id: string }
  | { ok: false; reason: PlaceFailure };

export class ConstructionSystem {
  /** Verifie sans muter si l'on peut construire ici. */
  canPlace(
    state: GameState,
    map: WorldMap,
    occupied: ReadonlySet<string>,
    buildingId: BuildingId,
    coord: SectorCoord,
  ): PlaceResult {
    const def = BUILDINGS[buildingId];
    if (!def.buildable) return { ok: false, reason: 'not_buildable' };
    if (!isUnlocked(buildingId, state.age)) return { ok: false, reason: 'locked' };
    if (!canBuildAt(map, occupied, coord).ok) return { ok: false, reason: 'placement_invalid' };
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
