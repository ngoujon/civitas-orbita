/**
 * Bilan entrees / sorties par ressource (/s), pour l infobulle HUD.
 * Reprend la logique de ProductionSystem + consommation population + peche.
 */

import { BUILDINGS } from '@/config/buildings';
import { POPULATION } from '@/config/game';
import { getCivModifiers } from '@/config/civilizations';
import {
  BOAT_SPEED,
  FISHING_DURATION,
  FISHING_SEA_MAX,
  FISHING_SEA_MIN,
  FOOD_PER_CATCH,
} from '@/config/fishing';
import type { ResourceId } from '@/config/resources';
import { RESOURCE_LIST, RESOURCES } from '@/config/resources';
import type { GameState } from '@/game/GameState';
import type { WorldMap } from '@/world/WorldMap';
import { synergyMultiplier } from './ProductionSynergy';

export interface ResourceFlowSnapshot {
  readonly stock: number;
  readonly capacity: number;
  /** Production effective (/s) avec effectifs et intrants actuels. */
  readonly inPerSec: number;
  /** Consommation effective (/s). */
  readonly outPerSec: number;
  /** inPerSec - outPerSec */
  readonly netPerSec: number;
  /** Production max (/s) a plein effectif sans limite d intrants. */
  readonly maxInPerSec: number;
  /** Consommation max (/s) a plein effectif. */
  readonly maxOutPerSec: number;
}

export type ResourceFlowMap = Record<ResourceId, ResourceFlowSnapshot>;

export function computeResourceFlows(state: GameState, map: WorldMap): ResourceFlowMap {
  const mods = getCivModifiers(state.civ);
  const buff = state.ability.buffRemaining > 0 ? state.ability.buffMultiplier : 1;

  const inSec = emptyRates();
  const outSec = emptyRates();
  const maxIn = emptyRates();
  const maxOut = emptyRates();

  for (const b of Object.values(state.buildings)) {
    if (!b.complete) continue;
    const def = BUILDINGS[b.def];
    if (!def.produces && !def.consumes) continue;

    let activity = b.level;
    if (def.jobs && def.jobs > 0) {
      const staffing = Math.min(b.workers / def.jobs, 1);
      activity *= staffing;
      if (staffing <= 0) continue;
    }

    let inputRatio = 1;
    if (def.consumes) {
      for (const [res, rate] of Object.entries(def.consumes) as [ResourceId, number][]) {
        const need = rate * activity;
        if (need <= 0) continue;
        inputRatio = Math.min(inputRatio, state.resources[res] / need);
      }
      inputRatio = Math.max(0, Math.min(1, inputRatio));
    }

    const effective = activity * inputRatio;
    const synergy = synergyMultiplier(state, map, b.id);

    if (def.consumes) {
      for (const [res, rate] of Object.entries(def.consumes) as [ResourceId, number][]) {
        if (!rate) continue;
        outSec[res] += rate * effective;
        maxOut[res] += rate * activity;
      }
    }
    if (def.produces) {
      for (const [res, rate] of Object.entries(def.produces) as [ResourceId, number][]) {
        if (!rate) continue;
        const civBonus = mods.productionMultiplier * (mods.productionByResource[res] ?? 1) * buff;
        const amount = rate * effective * civBonus * synergy;
        inSec[res] += amount;
        maxIn[res] += rate * activity * civBonus * synergy;
      }
    }
  }

  const headcount = Math.floor(state.population.count);
  const foodDemand =
    headcount * POPULATION.foodPerCapitaPerSecond * mods.foodConsumptionMultiplier;
  outSec.food += Math.min(foodDemand, state.resources.food);
  maxOut.food += foodDemand;

  const fishingFood = estimateFishingFoodPerSec(state);
  inSec.food += fishingFood;
  maxIn.food += fishingFood;

  const result = {} as ResourceFlowMap;
  for (const def of RESOURCE_LIST) {
    const id = def.id;
    result[id] = {
      stock: state.resources[id],
      capacity: state.capacities[id] ?? def.baseCapacity,
      inPerSec: inSec[id],
      outPerSec: outSec[id],
      netPerSec: inSec[id] - outSec[id],
      maxInPerSec: maxIn[id],
      maxOutPerSec: maxOut[id],
    };
  }
  return result;
}

function estimateFishingFoodPerSec(state: GameState): number {
  const boatCount = Object.keys(state.fishingBoats).length;
  if (boatCount <= 0) return 0;
  const avgSeaDist = (FISHING_SEA_MIN + FISHING_SEA_MAX) * 0.5;
  const travelOneWay = avgSeaDist / BOAT_SPEED;
  const cycleSec = travelOneWay * 2 + FISHING_DURATION;
  if (cycleSec <= 0) return 0;
  return (boatCount * FOOD_PER_CATCH) / cycleSec;
}

function emptyRates(): Record<ResourceId, number> {
  const r = {} as Record<ResourceId, number>;
  for (const id of Object.keys(RESOURCES) as ResourceId[]) r[id] = 0;
  return r;
}
