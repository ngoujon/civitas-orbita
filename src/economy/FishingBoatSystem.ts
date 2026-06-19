/**
 * Flotte de bateaux de peche : spawn depuis les ports, navigation autonome en mer.
 */

import {
  BOAT_SPEED,
  FISHING_DURATION,
  FOOD_PER_CATCH,
  MAX_BOATS_PER_PORT,
} from '@/config/fishing';
import { credit, recomputeCapacities } from '@/economy/ResourceManager';
import type { GameState } from '@/game/GameState';
import {
  moveBoatToward,
  pickFishingSpot,
  portDockPosition,
  type FishingBoatState,
} from '@/world/FishingBoat';
import type { WorldMap } from '@/world/WorldMap';
import type { SectorCoord } from '@/world/Sector';

export class FishingBoatSystem {
  update(state: GameState, map: WorldMap, dt: number): void {
    this.syncFleet(state, map);
    for (const boat of Object.values(state.fishingBoats)) {
      this.tickBoat(state, map, boat, dt);
    }
  }

  private syncFleet(state: GameState, map: WorldMap): void {
    const desired = new Map<string, number>();
    for (const b of Object.values(state.buildings)) {
      if (!b.complete || b.def !== 'port' || b.workers <= 0) continue;
      desired.set(b.id, Math.min(b.workers, MAX_BOATS_PER_PORT));
    }

    const byPort = new Map<string, FishingBoatState[]>();
    for (const boat of Object.values(state.fishingBoats)) {
      const list = byPort.get(boat.portId) ?? [];
      list.push(boat);
      byPort.set(boat.portId, list);
    }

    for (const [portId, boats] of byPort) {
      const need = desired.get(portId) ?? 0;
      if (need === 0) {
        for (const boat of boats) delete state.fishingBoats[boat.id];
        continue;
      }
      while (boats.length > need) {
        const extra = boats.pop()!;
        delete state.fishingBoats[extra.id];
      }
      while (boats.length < need) {
        const port = state.buildings[portId];
        if (!port) break;
        const boat = this.spawnBoat(state, map, portId, port.sector, boats.length);
        boats.push(boat);
      }
    }

    for (const [portId, count] of desired) {
      if (byPort.has(portId)) continue;
      const port = state.buildings[portId];
      if (!port) continue;
      for (let i = 0; i < count; i++) {
        this.spawnBoat(state, map, portId, port.sector, i);
      }
    }
  }

  private spawnBoat(
    state: GameState,
    map: WorldMap,
    portId: string,
    portSector: SectorCoord,
    slot: number,
  ): FishingBoatState {
    const dock = portDockPosition(map, portSector);
    const spot = pickFishingSpot(map, portSector, state.nextBoatId * 997 + slot * 131);
    const id = `fb${state.nextBoatId++}`;
    const boat: FishingBoatState = {
      id,
      portId,
      x: dock.x,
      y: dock.y,
      heading: dock.angle,
      targetX: spot.x,
      targetY: spot.y,
      phase: 'outbound',
      fishTimer: 0,
      variant: slot % 3,
    };
    state.fishingBoats[id] = boat;
    return boat;
  }

  private tickBoat(state: GameState, map: WorldMap, boat: FishingBoatState, dt: number): void {
    const port = state.buildings[boat.portId];
    if (!port?.complete || port.def !== 'port') {
      delete state.fishingBoats[boat.id];
      return;
    }

    const dock = portDockPosition(map, port.sector);

    switch (boat.phase) {
      case 'outbound': {
        if (moveBoatToward(boat, boat.targetX, boat.targetY, BOAT_SPEED, dt)) {
          boat.phase = 'fishing';
          boat.fishTimer = 0;
        }
        break;
      }
      case 'fishing': {
        boat.fishTimer += dt;
        // Leger derive sur place (visible en mer).
        boat.x += Math.sin(boat.fishTimer * 2.1) * 0.15;
        boat.y += Math.cos(boat.fishTimer * 1.7) * 0.12;
        if (boat.fishTimer >= FISHING_DURATION) {
          boat.phase = 'returning';
        }
        break;
      }
      case 'returning': {
        if (moveBoatToward(boat, dock.x, dock.y, BOAT_SPEED * 1.1, dt)) {
          recomputeCapacities(state);
          credit(state, 'food', FOOD_PER_CATCH);
          const spot = pickFishingSpot(map, port.sector, state.nextBoatId + boat.id.length);
          boat.targetX = spot.x;
          boat.targetY = spot.y;
          boat.phase = 'outbound';
          boat.fishTimer = 0;
        }
        break;
      }
    }

    // Securite : repousser hors de l ile si collision numerique.
    const r = Math.hypot(boat.x, boat.y);
    const minR = map.outerRadius + 8;
    if (r < minR && r > 0) {
      boat.x = (boat.x / r) * minR;
      boat.y = (boat.y / r) * minR;
    }
  }
}
