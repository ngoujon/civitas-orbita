/**
 * Chemins de terre entre batiments voisins.
 *
 * Pure rendu : lit GameState + WorldMap, dessine des sentiers proceduraux
 * entre centres de secteurs adjacents occupes par des batiments complets.
 */

import { Graphics } from 'pixi.js';
import { BUILDINGS } from '@/config/buildings';
import { PALETTE } from '@/config/game';
import type { GameState } from '@/game/GameState';
import { buildingDisplayPosition } from '@/world/Sector';
import type { WorldMap } from '@/world/WorldMap';
import { sectorKey } from '@/world/Sector';

const PATH_INSET = 20;
const PATH_WIDTH_OUTER = 10;
const PATH_WIDTH_INNER = 5;

export interface PathCurve {
  readonly sx: number;
  readonly sy: number;
  readonly cpx: number;
  readonly cpy: number;
  readonly ex: number;
  readonly ey: number;
}

export interface PathCurveStyle {
  outerWidth: number;
  outerColor: number;
  outerAlpha: number;
  innerWidth: number;
  innerColor: number;
  innerAlpha: number;
}

/** Dessine tous les chemins sur le Graphics fourni (clear inclus). */
export function drawBuildingPaths(g: Graphics, state: GameState, map: WorldMap): void {
  g.clear();

  const sectorToBuilding = new Map<string, string>();
  for (const b of Object.values(state.buildings)) {
    if (!b.complete) continue;
    sectorToBuilding.set(sectorKey(b.sector), b.id);
  }

  const drawn = new Set<string>();

  for (const b of Object.values(state.buildings)) {
    if (!b.complete) continue;
    const posA = buildingWorldPos(map, b);
    if (!posA) continue;

    for (const neighbor of map.neighbors(b.sector)) {
      const otherId = sectorToBuilding.get(sectorKey(neighbor));
      if (!otherId || otherId === b.id) continue;

      const edgeKey = b.id < otherId ? `${b.id}|${otherId}` : `${otherId}|${b.id}`;
      if (drawn.has(edgeKey)) continue;
      drawn.add(edgeKey);

      const other = state.buildings[otherId];
      if (!other) continue;
      const posB = buildingWorldPos(map, other);
      if (!posB) continue;

      const curve = computePathCurve(posA.x, posA.y, posB.x, posB.y, edgeKey);
      if (!curve) continue;

      drawPathCurve(g, curve, {
        outerWidth: PATH_WIDTH_OUTER,
        outerColor: PALETTE.dirtDark,
        outerAlpha: 0.88,
        innerWidth: PATH_WIDTH_INNER,
        innerColor: 0xc9a86a,
        innerAlpha: 0.92,
      });

      drawPathStones(g, curve, edgeKey);
    }
  }
}

function buildingWorldPos(
  map: WorldMap,
  b: { def: keyof typeof BUILDINGS; sector: { ring: number; index: number } },
): { x: number; y: number } | null {
  const geo = map.geometry(b.sector);
  if (!geo) return null;
  return buildingDisplayPosition(geo, BUILDINGS[b.def].shoreRequired === true);
}

export function computePathCurve(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  seedKey: string,
): PathCurve | null {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < PATH_INSET * 2) return null;

  const ux = dx / len;
  const uy = dy / len;
  const sx = x1 + ux * PATH_INSET;
  const sy = y1 + uy * PATH_INSET;
  const ex = x2 - ux * PATH_INSET;
  const ey = y2 - uy * PATH_INSET;

  const mx = (sx + ex) * 0.5;
  const my = (sy + ey) * 0.5;
  const nx = -uy;
  const ny = ux;
  const seed = hashString(seedKey);
  const curve = ((seed % 100) / 100) * 8 - 4;
  const cpx = mx + nx * curve;
  const cpy = my + ny * curve;

  return { sx, sy, cpx, cpy, ex, ey };
}

export function drawPathCurve(g: Graphics, curve: PathCurve, style: PathCurveStyle): void {
  strokeCurve(
    g,
    curve.sx,
    curve.sy,
    curve.cpx,
    curve.cpy,
    curve.ex,
    curve.ey,
    style.outerWidth,
    style.outerColor,
    style.outerAlpha,
  );
  strokeCurve(
    g,
    curve.sx,
    curve.sy,
    curve.cpx,
    curve.cpy,
    curve.ex,
    curve.ey,
    style.innerWidth,
    style.innerColor,
    style.innerAlpha,
  );
}

function drawPathStones(g: Graphics, curve: PathCurve, seedKey: string): void {
  const seed = hashString(seedKey);
  const segLen = Math.hypot(curve.ex - curve.sx, curve.ey - curve.sy);
  const steps = Math.max(1, Math.floor(segLen / 22));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = quadPoint(curve.sx, curve.cpx, curve.ex, t);
    const py = quadPoint(curve.sy, curve.cpy, curve.ey, t);
    const jitter = mulberry32(seed + i * 7919);
    const ox = (jitter() - 0.5) * 6;
    const oy = (jitter() - 0.5) * 4;
    const r = 1.2 + jitter() * 1.5;
    g.circle(px + ox, py + oy, r)
      .fill({ color: jitter() > 0.5 ? PALETTE.stone : PALETTE.stoneDark, alpha: 0.55 });
  }
}

function strokeCurve(
  g: Graphics,
  x1: number,
  y1: number,
  cpx: number,
  cpy: number,
  x2: number,
  y2: number,
  width: number,
  color: number,
  alpha: number,
): void {
  g.moveTo(x1, y1);
  g.quadraticCurveTo(cpx, cpy, x2, y2);
  g.stroke({ width, color, alpha, cap: 'round', join: 'round' });
}

export function quadPoint(a: number, c: number, b: number, t: number): number {
  const u = 1 - t;
  return u * u * a + 2 * u * t * c + t * t * b;
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
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

/** Signature pour savoir si les chemins doivent etre regeneres. */
export function pathsSignature(state: GameState): string {
  const parts: string[] = [];
  for (const b of Object.values(state.buildings)) {
    if (!b.complete) continue;
    parts.push(`${b.id}:${b.sector.ring}:${b.sector.index}`);
  }
  parts.sort();
  return parts.join(';');
}
