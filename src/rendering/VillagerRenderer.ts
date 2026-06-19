/**
 * Villageois proceduraux travaillant pres de leurs batiments.
 *
 * OBSERVATEUR : lit workers/population depuis GameState, ne mute rien.
 * Pool de sprites reutilises, animation deterministe par batiment + slot.
 */

import { Container, Sprite } from 'pixi.js';
import { BUILDINGS } from '@/config/buildings';
import type { BuildingId } from '@/config/buildings';
import type { GameState } from '@/game/GameState';
import type { WorldMap } from '@/world/WorldMap';
import { ProceduralSprites, BASE_ANCHOR } from './ProceduralSprites';

const MAX_VILLAGERS_PER_BUILDING = 3;
const CAMPFIRE_IDLE_MAX = 2;

interface VillagerSlot {
  sprite: Sprite;
  buildingId: string;
  slot: number;
  workIntensity: number;
  baseAngle: number;
  radius: number;
  speed: number;
}

export class VillagerRenderer {
  private readonly slots = new Map<string, VillagerSlot>();
  private readonly pool: Sprite[] = [];

  constructor(
    private readonly sprites: ProceduralSprites,
    private readonly layer: Container,
  ) {}

  /** Met a jour les villageois visibles et leurs positions animees. */
  update(state: GameState, map: WorldMap, elapsed: number): void {
    const needed = this.collectNeeded(state);
    this.syncSlots(needed, state, map);
    this.animateAll(state, map, elapsed);
  }

  private collectNeeded(
    state: GameState,
  ): Map<string, { buildingId: string; slot: number; def: BuildingId }> {
    const needed = new Map<string, { buildingId: string; slot: number; def: BuildingId }>();

    for (const b of Object.values(state.buildings)) {
      if (!b.complete) continue;
      const def = BUILDINGS[b.def];
      let count = 0;

      if ((def.jobs ?? 0) > 0 && b.workers > 0) {
        count = Math.min(b.workers, MAX_VILLAGERS_PER_BUILDING);
      } else if (b.def === 'campfire' && state.population.count >= 1) {
        count = Math.min(CAMPFIRE_IDLE_MAX, Math.ceil(state.population.count / 4));
      }

      for (let slot = 0; slot < count; slot++) {
        needed.set(`${b.id}:${slot}`, { buildingId: b.id, slot, def: b.def });
      }
    }

    return needed;
  }

  private syncSlots(
    needed: Map<string, { buildingId: string; slot: number; def: BuildingId }>,
    state: GameState,
    map: WorldMap,
  ): void {
    for (const [key, slot] of this.slots) {
      if (!needed.has(key)) {
        this.layer.removeChild(slot.sprite);
        this.pool.push(slot.sprite);
        this.slots.delete(key);
      }
    }

    for (const [key, info] of needed) {
      if (this.slots.has(key)) continue;

      const b = state.buildings[info.buildingId];
      if (!b) continue;
      const geo = map.geometry(b.sector);
      if (!geo) continue;

      const seed = hashString(key);
      const sprite = this.pool.pop() ?? new Sprite(this.sprites.getVillagerTexture(seed % 3));
      sprite.anchor.set(BASE_ANCHOR.x, BASE_ANCHOR.y);

      this.slots.set(key, {
        sprite,
        buildingId: info.buildingId,
        slot: info.slot,
        workIntensity: workIntensity(info.def),
        baseAngle: (seed % 360) * (Math.PI / 180),
        radius: 14 + (info.slot % 3) * 5,
        speed: 2.2 + (seed % 7) * 0.15,
      });
      this.layer.addChild(sprite);
    }
  }

  private animateAll(state: GameState, map: WorldMap, elapsed: number): void {
    for (const slot of this.slots.values()) {
      const b = state.buildings[slot.buildingId];
      if (!b) continue;
      const geo = map.geometry(b.sector);
      if (!geo) continue;

      const t = elapsed * slot.speed + slot.slot * 1.7;
      const angle = slot.baseAngle + slot.slot * 1.2;
      const orbit = Math.sin(t * 0.6) * 4;
      const bob = Math.abs(Math.sin(t * 2.8)) * 3;

      const cx = geo.cx + Math.cos(angle) * (slot.radius + orbit);
      const cy = geo.cy + Math.sin(angle) * (slot.radius * 0.55) + bob;

      slot.sprite.position.set(cx, cy);
      slot.sprite.zIndex = cy + 2;
      const facing = Math.cos(angle) >= 0 ? 1 : -1;
      slot.sprite.scale.set(1.1 * facing, 1.1);
      slot.sprite.rotation = Math.sin(t * 3.5) * 0.12 * slot.workIntensity;
    }
  }

  destroy(): void {
    for (const slot of this.slots.values()) slot.sprite.destroy();
    for (const s of this.pool) s.destroy();
    this.slots.clear();
    this.pool.length = 0;
  }
}

function workIntensity(def: BuildingId): number {
  switch (def) {
    case 'farm':
    case 'quarry':
    case 'mine':
    case 'lumberjack':
    case 'workshop':
    case 'factory':
      return 1;
    default:
      return 0.4;
  }
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
