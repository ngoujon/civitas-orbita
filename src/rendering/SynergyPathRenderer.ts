/**
 * Chemins de synergie animes entre batiments du meme groupe de production.
 */

import { Graphics } from 'pixi.js';
import { BUILDINGS } from '@/config/buildings';
import { SYNERGY_GROUP_COLORS } from '@/config/synergy';
import type { GameState } from '@/game/GameState';
import { buildingDisplayPosition } from '@/world/Sector';
import type { WorldMap } from '@/world/WorldMap';
import { collectSynergyLinks } from '@/economy/ProductionSynergy';
import { computePathCurve, drawPathCurve, hashString, quadPoint } from './PathRenderer';

/** Dessine les chemins de synergie (appele chaque frame sur fxLayer). */
export function drawSynergyPaths(
  g: Graphics,
  state: GameState,
  map: WorldMap,
  elapsed: number,
): void {
  const links = collectSynergyLinks(state, map);

  for (const link of links) {
    const a = state.buildings[link.buildingIdA];
    const b = state.buildings[link.buildingIdB];
    if (!a || !b) continue;

    const posA = buildingWorldPos(map, a.def, a.sector);
    const posB = buildingWorldPos(map, b.def, b.sector);
    if (!posA || !posB) continue;

    const seedKey = `${link.buildingIdA}|${link.buildingIdB}`;
    const curve = computePathCurve(posA.x, posA.y, posB.x, posB.y, seedKey);
    if (!curve) continue;

    const colors = SYNERGY_GROUP_COLORS[link.group];
    const phase = hashString(seedKey) * 0.001 + elapsed * 3.2;
    const pulse = 0.55 + 0.45 * Math.sin(phase);

    drawPathCurve(g, curve, {
      outerWidth: 14 + pulse * 4,
      outerColor: colors.glow,
      outerAlpha: 0.22 + pulse * 0.18,
      innerWidth: 6 + pulse * 2,
      innerColor: colors.core,
      innerAlpha: 0.65 + pulse * 0.3,
    });

    drawFlowParticles(g, curve, seedKey, elapsed, colors.core);
  }
}

function buildingWorldPos(
  map: WorldMap,
  defId: keyof typeof BUILDINGS,
  sector: { ring: number; index: number },
): { x: number; y: number } | null {
  const geo = map.geometry(sector);
  if (!geo) return null;
  return buildingDisplayPosition(geo, BUILDINGS[defId].shoreRequired === true);
}

function drawFlowParticles(
  g: Graphics,
  curve: NonNullable<ReturnType<typeof computePathCurve>>,
  seedKey: string,
  elapsed: number,
  color: number,
): void {
  const seed = hashString(seedKey);
  const count = 3;
  for (let i = 0; i < count; i++) {
    const speed = 0.35 + (seed % 17) * 0.01;
    const t = (elapsed * speed + i / count + seed * 0.0001) % 1;
    const px = quadPoint(curve.sx, curve.cpx, curve.ex, t);
    const py = quadPoint(curve.sy, curve.cpy, curve.ey, t);
    const r = 2.2 + Math.sin(elapsed * 8 + i + seed) * 0.8;
    g.circle(px, py, r + 2).fill({ color, alpha: 0.15 });
    g.circle(px, py, r).fill({ color, alpha: 0.85 });
  }
}
