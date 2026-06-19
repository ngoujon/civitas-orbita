/**
 * Amelioration du feu de camp : montee de niveau pour booster productivite,
 * logement et stockage (le niveau multiplie les effets dans les systemes).
 */

import {
  BUILDINGS,
  isUpgradeable,
  maxLevelFor,
  upgradeCostAtLevel,
  type BuildingId,
  type ResourceAmounts,
} from '@/config/buildings';
import { applyCostMultiplier, getCivModifiers } from '@/config/civilizations';
import { canAfford, spend } from '@/economy/ResourceManager';
import type { GameState } from '@/game/GameState';

export type UpgradeFailure =
  | 'not_found'
  | 'incomplete'
  | 'not_upgradeable'
  | 'max_level'
  | 'cannot_afford';

export type UpgradeResult = { ok: true; level: number } | { ok: false; reason: UpgradeFailure };

export class UpgradeSystem {
  canUpgrade(state: GameState, instanceId: string): UpgradeResult {
    const instance = state.buildings[instanceId];
    if (!instance) return { ok: false, reason: 'not_found' };
    if (!instance.complete) return { ok: false, reason: 'incomplete' };

    const def = BUILDINGS[instance.def];
    if (!isUpgradeable(def)) return { ok: false, reason: 'not_upgradeable' };
    if (instance.level >= maxLevelFor(def)) return { ok: false, reason: 'max_level' };
    if (!canAfford(state, this.effectiveCost(state, instance.def, instance.level))) {
      return { ok: false, reason: 'cannot_afford' };
    }
    return { ok: true, level: instance.level + 1 };
  }

  effectiveCost(state: GameState, buildingId: BuildingId, currentLevel: number): ResourceAmounts {
    const def = BUILDINGS[buildingId];
    const base = upgradeCostAtLevel(def, currentLevel);
    const mult = getCivModifiers(state.civ).buildCostMultiplier;
    return applyCostMultiplier(base, mult);
  }

  upgrade(state: GameState, instanceId: string): UpgradeResult {
    const check = this.canUpgrade(state, instanceId);
    if (!check.ok) return check;

    const instance = state.buildings[instanceId]!;
    const cost = this.effectiveCost(state, instance.def, instance.level);
    spend(state, cost);
    instance.level += 1;
    return { ok: true, level: instance.level };
  }
}
