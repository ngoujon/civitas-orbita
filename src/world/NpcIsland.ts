/**
 * Types et generation procedurale des iles PNJ.
 */

import { AGES } from '@/config/ages';
import type { AgeId } from '@/config/ages';
import type { ResourceAmounts } from '@/config/buildings';
import {
  EXPEDITION_BASE_DURATION,
  LOOT_TEMPLATES,
  NPC_CHIEF_NAMES,
  NPC_CIV_POOL,
  NPC_ISLAND_COUNT,
  NPC_ISLAND_MAX_DIST,
  NPC_ISLAND_MIN_DIST,
  NPC_VILLAGE_NAMES,
} from '@/config/npcIslands';
import type { CivId } from '@/config/civilizations';
import type { ResourceId } from '@/config/resources';
import type { NpcRelation } from '@/config/happiness';

export interface NpcExpedition {
  progress: number;
  duration: number;
}

export interface NpcIslandState {
  id: string;
  x: number;
  y: number;
  chiefName: string;
  villageName: string;
  civ: CivId;
  age: AgeId;
  /** Butin restant a recuperer. */
  loot: ResourceAmounts;
  /** Reference pour regenere le butin. */
  maxLoot: ResourceAmounts;
  /** Expedition en cours (null si aucune). */
  expedition: NpcExpedition | null;
  /** Secondes avant regeneration du butin (0 = butin dispo si epuise). */
  lootCooldown: number;
  /** Relation diplomatique avec le joueur. */
  relation: NpcRelation;
  /** Cooldown avant prochain tribut (allies). */
  tributeCooldown: number;
  /** Fusionnee dans l'ile principale : plus visible ni selectable. */
  absorbed?: boolean;
}

/** Genere les iles PNJ autour du village du joueur (deterministe). */
export function generateNpcIslands(seed = 42_024): NpcIslandState[] {
  const rng = mulberry32(seed);
  const islands: NpcIslandState[] = [];
  const angleStep = (Math.PI * 2) / NPC_ISLAND_COUNT;

  for (let i = 0; i < NPC_ISLAND_COUNT; i++) {
    const angle = angleStep * i + (rng() - 0.5) * 0.6;
    const dist = lerp(NPC_ISLAND_MIN_DIST, NPC_ISLAND_MAX_DIST, rng());
    const age = pickAge(rng);
    const loot = pickLoot(rng, age);
    const civ = NPC_CIV_POOL[Math.floor(rng() * NPC_CIV_POOL.length)] ?? 'founders';

    islands.push({
      id: `npc-${i}`,
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      chiefName: NPC_CHIEF_NAMES[Math.floor(rng() * NPC_CHIEF_NAMES.length)] ?? 'Chef',
      villageName: NPC_VILLAGE_NAMES[Math.floor(rng() * NPC_VILLAGE_NAMES.length)] ?? 'Ile',
      civ,
      age,
      loot: { ...loot },
      maxLoot: { ...loot },
      expedition: null,
      lootCooldown: 0,
      relation: rng() > 0.7 ? 'neutral' : 'hostile',
      tributeCooldown: 0,
    });
  }
  return islands;
}

function pickAge(rng: () => number): AgeId {
  const ages = Object.keys(AGES) as AgeId[];
  return ages[Math.floor(rng() * ages.length)] ?? 'fire';
}

function pickLoot(rng: () => number, age: AgeId): ResourceAmounts {
  const ageOrder = AGES[age].order;
  const eligible = LOOT_TEMPLATES.filter((t) => AGES[t.maxAge].order >= ageOrder);
  const pool = eligible.length > 0 ? eligible : LOOT_TEMPLATES;
  let total = 0;
  for (const t of pool) total += t.weight;
  let roll = rng() * total;
  for (const t of pool) {
    roll -= t.weight;
    if (roll <= 0) return scaleLoot(t.loot, 0.85 + rng() * 0.3);
  }
  return scaleLoot(pool[pool.length - 1]!.loot, 1);
}

function scaleLoot(loot: ResourceAmounts, factor: number): ResourceAmounts {
  const out: ResourceAmounts = {};
  for (const [res, amt] of Object.entries(loot) as [ResourceId, number][]) {
    out[res] = Math.max(1, Math.round(amt * factor));
  }
  return out;
}

export function lootIsEmpty(loot: ResourceAmounts): boolean {
  return Object.values(loot).every((v) => (v ?? 0) <= 0);
}

export function expeditionDuration(age: AgeId): number {
  const bonus = AGES[age].order * 4;
  return EXPEDITION_BASE_DURATION + bonus;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
