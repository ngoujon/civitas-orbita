/**
 * Etat du monde partage (multijoueur) ou encapsulation solo.
 */

import type { ColonyState } from './ColonyState';
import type { NpcIslandState } from '@/world/NpcIsland';
import type { RandomEventId } from '@/config/events';

export type PlayerId = string;

export interface GlobalEvent {
  id: string;
  type: RandomEventId;
  remaining: number;
}

export interface SharedSeaState {
  exploredSea: Record<string, true>;
  npcIslands: NpcIslandState[];
}

export interface WorldState {
  worldId: string;
  tick: number;
  /** Colonies indexees par identifiant joueur. */
  colonies: Record<PlayerId, ColonyState>;
  /** Mer et entites partagees entre joueurs. */
  sharedSea: SharedSeaState;
  globalEvents: GlobalEvent[];
}

/** Cree un monde solo avec une seule colonie. */
export function createSoloWorld(playerId: PlayerId, colony: ColonyState): WorldState {
  return {
    worldId: `solo-${playerId}`,
    tick: colony.totalTicks,
    colonies: { [playerId]: colony },
    sharedSea: {
      exploredSea: { ...colony.exploredSea },
      npcIslands: colony.npcIslands,
    },
    globalEvents: [],
  };
}

/** Lit la colonie locale dans un monde. */
export function getColony(world: WorldState, playerId: PlayerId): ColonyState | null {
  return world.colonies[playerId] ?? null;
}

/** Synchronise tick monde depuis colonie locale (solo). */
export function syncWorldTick(world: WorldState, playerId: PlayerId): void {
  const colony = world.colonies[playerId];
  if (colony) world.tick = colony.totalTicks;
}

/** Applique l etat colonie vers le monde (solo save). */
export function pushColonyToWorld(world: WorldState, playerId: PlayerId, colony: ColonyState): void {
  world.colonies[playerId] = colony;
  world.sharedSea.exploredSea = { ...colony.exploredSea };
  world.sharedSea.npcIslands = colony.npcIslands;
  world.tick = colony.totalTicks;
}
