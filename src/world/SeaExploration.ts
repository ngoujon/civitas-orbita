/**
 * Grille d exploration de la mer (cellules de brouillard).
 */

import {
  INITIAL_SEA_EXPLORE,
  SCOUT_MAX_RANGE,
  SCOUT_REVEAL_RADIUS,
  SEA_FOG_CELL,
  SHORE_FOG_CLEARANCE,
  FOG_SEA_EXTENT,
} from '@/config/exploration';
import type { GameState } from '@/game/GameState';

const TAU = Math.PI * 2;

export function seaCellCoord(wx: number, wy: number): { cx: number; cy: number } {
  return {
    cx: Math.floor(wx / SEA_FOG_CELL),
    cy: Math.floor(wy / SEA_FOG_CELL),
  };
}

export function seaCellKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

export function seaCellCenter(cx: number, cy: number): { x: number; y: number } {
  return {
    x: (cx + 0.5) * SEA_FOG_CELL,
    y: (cy + 0.5) * SEA_FOG_CELL,
  };
}

export function isSeaCellExplored(state: GameState, cx: number, cy: number): boolean {
  return state.exploredSea[seaCellKey(cx, cy)] === true;
}

export function isWorldPointExplored(state: GameState, x: number, y: number): boolean {
  const { cx, cy } = seaCellCoord(x, y);
  return isSeaCellExplored(state, cx, cy);
}

/** Marque les cellules couvertes par un disque de revelation. */
export function revealAround(state: GameState, x: number, y: number, radius: number): number {
  const { cx: cx0, cy: cy0 } = seaCellCoord(x - radius, y - radius);
  const { cx: cx1, cy: cy1 } = seaCellCoord(x + radius, y + radius);
  const r2 = radius * radius;
  let added = 0;

  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cy = cy0; cy <= cy1; cy++) {
      const center = seaCellCenter(cx, cy);
      const dx = center.x - x;
      const dy = center.y - y;
      if (dx * dx + dy * dy > r2 + SEA_FOG_CELL * SEA_FOG_CELL * 0.5) continue;
      const key = seaCellKey(cx, cy);
      if (!state.exploredSea[key]) {
        state.exploredSea[key] = true;
        added++;
      }
    }
  }
  return added;
}

/** Marque toutes les cellules de mer dans un disque autour du centre. */
export function revealSeaWithinRadius(state: GameState, radius: number): number {
  const cells = Math.ceil(radius / SEA_FOG_CELL);
  let added = 0;
  for (let cx = -cells; cx <= cells; cx++) {
    for (let cy = -cells; cy <= cells; cy++) {
      const center = seaCellCenter(cx, cy);
      if (Math.hypot(center.x, center.y) > radius) continue;
      const key = seaCellKey(cx, cy);
      if (!state.exploredSea[key]) {
        state.exploredSea[key] = true;
        added++;
      }
    }
  }
  return added;
}

/** Rayon de mer exploree autour du rivage actuel. */
export function shoreExplorationRadius(shoreRadius: number): number {
  return shoreRadius + INITIAL_SEA_EXPLORE;
}

/** Met a jour la mer connue quand l ile s agrandit (ou au demarrage). */
export function refreshShoreSeaExploration(state: GameState, shoreRadius: number): number {
  return revealSeaWithinRadius(state, shoreExplorationRadius(shoreRadius));
}

/** Zone de peche / rivage deja connue au demarrage ou apres migration. */
export function seedInitialSeaExploration(state: GameState, shoreRadius: number): void {
  refreshShoreSeaExploration(state, shoreRadius);
}

/** Rayon interieur sans brouillard (aligne sur SeaFogRenderer). */
export function fogInnerRadius(shoreRadius: number): number {
  return shoreRadius + SHORE_FOG_CLEARANCE;
}

/** Vrai s il reste des cellules de brouillard a explorer dans la portee de l eclaireur. */
export function hasUnexploredSeaFog(state: GameState, shoreRadius: number): boolean {
  const minR = fogInnerRadius(shoreRadius);
  const maxR = SCOUT_MAX_RANGE;
  const ringCells = Math.ceil(maxR / SEA_FOG_CELL);

  for (let ring = 1; ring <= ringCells; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
        const center = seaCellCenter(dx, dy);
        const dist = Math.hypot(center.x, center.y);
        if (dist < minR || dist > maxR) continue;
        if (dist > FOG_SEA_EXTENT) continue;
        if (!isSeaCellExplored(state, dx, dy)) return true;
      }
    }
  }
  return false;
}

/** Choisit un point de mer inexplore pour le bateau eclaireur. */
export function pickScoutTarget(
  state: GameState,
  shoreRadius: number,
  _fromX: number,
  _fromY: number,
  seed: number,
): { x: number; y: number } | null {
  const minR = fogInnerRadius(shoreRadius);
  const rng = mulberry32(seed);

  for (let i = 0; i < 32; i++) {
    const angle = rng() * TAU;
    const dist = minR + rng() * (SCOUT_MAX_RANGE - minR);
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;
    if (!isWorldPointExplored(state, x, y)) return { x, y };
  }

  const ringCells = Math.ceil(SCOUT_MAX_RANGE / SEA_FOG_CELL);
  for (let ring = 1; ring <= ringCells; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
        const center = seaCellCenter(dx, dy);
        const dist = Math.hypot(center.x, center.y);
        if (dist < minR || dist > SCOUT_MAX_RANGE) continue;
        if (!isSeaCellExplored(state, dx, dy)) return center;
      }
    }
  }

  return null;
}

export function scoutRevealRadius(): number {
  return SCOUT_REVEAL_RADIUS;
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
