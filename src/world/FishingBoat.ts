/**
 * Types et helpers pour les bateaux de peche (navigation en mer).
 */

import {
  BOAT_ARRIVE_DIST,
  FISHING_DOCK_OFFSET,
  FISHING_SEA_MAX,
  FISHING_SEA_MIN,
} from '@/config/fishing';
import type { WorldMap } from './WorldMap';
import type { SectorCoord } from './Sector';

export type FishingBoatPhase = 'outbound' | 'fishing' | 'returning';

export interface FishingBoatState {
  id: string;
  /** Batiment port d attache. */
  portId: string;
  x: number;
  y: number;
  /** Cap en radians (0 = est). */
  heading: number;
  targetX: number;
  targetY: number;
  phase: FishingBoatPhase;
  /** Compteur de peche (secondes) en phase fishing. */
  fishTimer: number;
  /** Variante visuelle. */
  variant: number;
}

export function isInSeaZone(map: WorldMap, x: number, y: number, margin = 0): boolean {
  return Math.hypot(x, y) > map.outerRadius + margin;
}

/** Position de depart / retour au quai du port. */
export function portDockPosition(
  map: WorldMap,
  portSector: SectorCoord,
): { x: number; y: number; angle: number } {
  const geo = map.geometry(portSector);
  if (!geo) return { x: 0, y: 0, angle: 0 };
  const angle = Math.atan2(geo.cy, geo.cx);
  const r = map.outerRadius + FISHING_DOCK_OFFSET;
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r, angle };
}

/** Point de peche aleatoire en mer le long du spoke du port. */
export function pickFishingSpot(
  map: WorldMap,
  portSector: SectorCoord,
  seed: number,
): { x: number; y: number } {
  const dock = portDockPosition(map, portSector);
  const rng = mulberry32(seed);
  const spread = (rng() - 0.5) * 0.35;
  const angle = dock.angle + spread;
  const r = map.outerRadius + FISHING_SEA_MIN + rng() * (FISHING_SEA_MAX - FISHING_SEA_MIN);
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
}

export function moveBoatToward(
  boat: Pick<FishingBoatState, 'x' | 'y' | 'heading'>,
  tx: number,
  ty: number,
  speed: number,
  dt: number,
): boolean {
  const dx = tx - boat.x;
  const dy = ty - boat.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= BOAT_ARRIVE_DIST) return true;
  const step = Math.min(speed * dt, dist);
  boat.x += (dx / dist) * step;
  boat.y += (dy / dist) * step;
  boat.heading = Math.atan2(dy, dx);
  return false;
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
