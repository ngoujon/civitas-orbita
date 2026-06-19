/**
 * Expeditions vers les iles PNJ pour recuperer le butin.
 */

import { LOOT_RESPAWN_SECONDS } from '@/config/npcIslands';
import type { ResourceAmounts } from '@/config/buildings';
import { credit, recomputeCapacities } from '@/economy/ResourceManager';
import type { GameState } from '@/game/GameState';
import type { ResourceId } from '@/config/resources';
import {
  expeditionDuration,
  lootIsEmpty,
  type NpcIslandState,
} from './NpcIsland';
import { isNpcIslandActive } from './NpcIslandAbsorption';

export type ExpeditionFailure =
  | 'not_found'
  | 'already_raiding'
  | 'expedition_active'
  | 'no_loot'
  | 'on_cooldown';

export type ExpeditionResult = { ok: true } | { ok: false; reason: ExpeditionFailure };

export type ExpeditionCompletedEvent = {
  islandId: string;
  villageName: string;
  loot: ResourceAmounts;
};

export class IslandExpeditionSystem {
  /** Ile PNJ sous le point monde (null si aucune). */
  islandAt(state: GameState, worldX: number, worldY: number, radius: number): NpcIslandState | null {
    for (const island of state.npcIslands) {
      if (!isNpcIslandActive(island)) continue;
      if (Math.hypot(worldX - island.x, worldY - island.y) <= radius) return island;
    }
    return null;
  }

  hasActiveExpedition(state: GameState): boolean {
    return state.npcIslands.some((i) => isNpcIslandActive(i) && i.expedition !== null);
  }

  canStartExpedition(state: GameState, islandId: string): ExpeditionResult {
    const island = state.npcIslands.find((i) => i.id === islandId);
    if (!island || !isNpcIslandActive(island)) return { ok: false, reason: 'not_found' };
    if (this.hasActiveExpedition(state)) return { ok: false, reason: 'expedition_active' };
    if (island.expedition) return { ok: false, reason: 'already_raiding' };
    if (lootIsEmpty(island.loot) && island.lootCooldown > 0) {
      return { ok: false, reason: 'on_cooldown' };
    }
    if (lootIsEmpty(island.loot)) return { ok: false, reason: 'no_loot' };
    return { ok: true };
  }

  startExpedition(state: GameState, islandId: string): ExpeditionResult {
    const check = this.canStartExpedition(state, islandId);
    if (!check.ok) return check;

    const island = state.npcIslands.find((i) => i.id === islandId)!;
    island.expedition = { progress: 0, duration: expeditionDuration(island.age) };
    return { ok: true };
  }

  update(state: GameState, dt: number): {
    completed: ExpeditionCompletedEvent[];
    respawned: string[];
  } {
    const completed: ExpeditionCompletedEvent[] = [];
    const respawned: string[] = [];

    for (const island of state.npcIslands) {
      if (!isNpcIslandActive(island)) continue;
      if (island.lootCooldown > 0) {
        island.lootCooldown = Math.max(0, island.lootCooldown - dt);
        if (island.lootCooldown === 0 && lootIsEmpty(island.loot)) {
          island.loot = { ...island.maxLoot };
          respawned.push(island.id);
        }
      }

      if (!island.expedition) continue;
      island.expedition.progress += dt;
      if (island.expedition.progress >= island.expedition.duration) {
        const loot = this.completeExpedition(state, island);
        island.expedition = null;
        completed.push({ islandId: island.id, villageName: island.villageName, loot });
      }
    }

    return { completed, respawned };
  }

  private completeExpedition(state: GameState, island: NpcIslandState): ResourceAmounts {
    recomputeCapacities(state);
    const taken: ResourceAmounts = {};
    for (const [res, amount] of Object.entries(island.loot) as [ResourceId, number][]) {
      if (!amount || amount <= 0) continue;
      const got = credit(state, res, amount);
      if (got > 0) taken[res] = got;
      island.loot[res] = Math.max(0, amount - got);
    }
    island.lootCooldown = LOOT_RESPAWN_SECONDS;
    return taken;
  }
}
