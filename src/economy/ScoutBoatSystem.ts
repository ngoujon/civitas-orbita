/**
 * Bateaux eclaireurs : revelent le brouillard de nuages puis reviennent au port.
 */

import {
  MAX_SCOUTS_PER_PORT,
  SCOUT_ARRIVE_DIST,
  SCOUT_SPEED,
  SCOUT_WAYPOINT_PAUSE,
} from '@/config/exploration';
import type { GameState } from '@/game/GameState';
import { moveBoatToward, portDockPosition } from '@/world/FishingBoat';
import {
  hasUnexploredSeaFog,
  pickScoutTarget,
  revealAround,
  scoutRevealRadius,
} from '@/world/SeaExploration';
import type { ScoutBoatPhase, ScoutBoatState } from '@/world/ScoutBoat';
import type { WorldMap } from '@/world/WorldMap';
import type { SectorCoord } from '@/world/Sector';

export interface ScoutUpdateResult {
  readonly revealed: number;
  readonly explorationFinished: boolean;
}

export class ScoutBoatSystem {
  update(state: GameState, map: WorldMap, dt: number): ScoutUpdateResult {
    this.syncFleet(state, map);
    let revealed = 0;
    let explorationFinished = false;
    for (const scout of Object.values(state.scoutBoats)) {
      const result = this.tickScout(state, map, scout, dt);
      revealed += result.revealed;
      if (result.finished) explorationFinished = true;
    }
    return { revealed, explorationFinished };
  }

  private syncFleet(state: GameState, map: WorldMap): void {
    const desired = new Map<string, number>();
    for (const b of Object.values(state.buildings)) {
      if (!b.complete || b.def !== 'port' || b.workers <= 0) continue;
      desired.set(b.id, MAX_SCOUTS_PER_PORT);
    }

    const byPort = new Map<string, ScoutBoatState[]>();
    for (const scout of Object.values(state.scoutBoats)) {
      const list = byPort.get(scout.portId) ?? [];
      list.push(scout);
      byPort.set(scout.portId, list);
    }

    for (const [portId, scouts] of byPort) {
      const need = desired.get(portId) ?? 0;
      if (need === 0) {
        for (const s of scouts) delete state.scoutBoats[s.id];
        continue;
      }
      while (scouts.length > need) {
        const extra = scouts.pop()!;
        delete state.scoutBoats[extra.id];
      }
      while (scouts.length < need) {
        const port = state.buildings[portId];
        if (!port) break;
        scouts.push(this.spawnScout(state, map, portId, port.sector));
      }
    }

    for (const [portId] of desired) {
      if (byPort.has(portId)) continue;
      const port = state.buildings[portId];
      if (!port) continue;
      this.spawnScout(state, map, portId, port.sector);
    }
  }

  private spawnScout(
    state: GameState,
    map: WorldMap,
    portId: string,
    portSector: SectorCoord,
  ): ScoutBoatState {
    const dock = portDockPosition(map, portSector);
    const id = `sc${state.nextScoutId++}`;
    const shoreR = map.outerRadius;
    const fogRemaining = hasUnexploredSeaFog(state, shoreR);
    const phase: ScoutBoatPhase = fogRemaining ? 'exploring' : 'docked';

    let targetX = dock.x;
    let targetY = dock.y;
    if (phase === 'exploring') {
      const target = pickScoutTarget(state, shoreR, dock.x, dock.y, state.nextScoutId * 4099);
      if (target) {
        targetX = target.x;
        targetY = target.y;
      }
    }

    const scout: ScoutBoatState = {
      id,
      portId,
      x: dock.x,
      y: dock.y,
      heading: dock.angle,
      targetX,
      targetY,
      phase,
      waitTimer: 0,
      trip: 0,
    };
    state.scoutBoats[id] = scout;
    return scout;
  }

  private tickScout(
    state: GameState,
    map: WorldMap,
    scout: ScoutBoatState,
    dt: number,
  ): { revealed: number; finished: boolean } {
    const port = state.buildings[scout.portId];
    if (!port?.complete || port.def !== 'port') {
      delete state.scoutBoats[scout.id];
      return { revealed: 0, finished: false };
    }

    const dock = portDockPosition(map, port.sector);
    const shoreR = map.outerRadius;
    const fogRemaining = hasUnexploredSeaFog(state, shoreR);

    if (!scout.phase) {
      scout.phase = fogRemaining ? 'exploring' : 'docked';
    }

    let revealed = 0;
    if (scout.phase !== 'docked') {
      revealed = revealAround(state, scout.x, scout.y, scoutRevealRadius());
    }

    if (scout.phase === 'docked') {
      scout.x = dock.x;
      scout.y = dock.y;
      scout.heading = dock.angle;
      if (fogRemaining) {
        scout.phase = 'exploring';
        scout.waitTimer = 0;
        const next = pickScoutTarget(
          state,
          shoreR,
          scout.x,
          scout.y,
          state.nextScoutId + scout.trip * 7919 + scout.id.length,
        );
        if (next) {
          scout.targetX = next.x;
          scout.targetY = next.y;
        }
      }
      return { revealed, finished: false };
    }

    if (scout.waitTimer > 0) {
      scout.waitTimer -= dt;
      return { revealed, finished: false };
    }

    if (scout.phase === 'exploring' && !fogRemaining) {
      scout.phase = 'returning';
      scout.targetX = dock.x;
      scout.targetY = dock.y;
    }

    const dist = Math.hypot(scout.targetX - scout.x, scout.targetY - scout.y);

    if (dist <= SCOUT_ARRIVE_DIST) {
      if (scout.phase === 'returning') {
        scout.phase = 'docked';
        scout.x = dock.x;
        scout.y = dock.y;
        scout.heading = dock.angle;
        scout.waitTimer = 0;
        return { revealed, finished: true };
      }

      scout.trip++;
      scout.waitTimer = SCOUT_WAYPOINT_PAUSE;

      if (!fogRemaining) {
        scout.phase = 'returning';
        scout.targetX = dock.x;
        scout.targetY = dock.y;
        return { revealed, finished: false };
      }

      const next = pickScoutTarget(
        state,
        shoreR,
        scout.x,
        scout.y,
        state.nextScoutId + scout.trip * 7919 + scout.id.length,
      );
      if (next) {
        scout.targetX = next.x;
        scout.targetY = next.y;
      } else {
        scout.phase = 'returning';
        scout.targetX = dock.x;
        scout.targetY = dock.y;
      }
      return { revealed, finished: false };
    }

    moveBoatToward(scout, scout.targetX, scout.targetY, SCOUT_SPEED, dt);
    revealed += revealAround(state, scout.x, scout.y, scoutRevealRadius());

    const r = Math.hypot(scout.x, scout.y);
    const minR = map.outerRadius + 8;
    if (r < minR && r > 0) {
      scout.x = (scout.x / r) * minR;
      scout.y = (scout.y / r) * minR;
    }

    return { revealed, finished: false };
  }
}
