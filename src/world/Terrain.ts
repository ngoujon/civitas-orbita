/**
 * Type de terrain par secteur (deterministe, derive de la geometrie).
 */

import type { TerrainKind } from '@/config/terrain';
import { sectorKey } from './Sector';
import type { SectorCoord } from './Sector';

/** Type de terrain naturel d'un secteur (non modifie par la preparation). */
export function terrainKindAt(coord: SectorCoord): TerrainKind {
  if (coord.ring === 0) return 'overgrown';
  const h = hashString(sectorKey(coord));
  // Anneaux exterieurs : proportion de roche croissante.
  const rockyChance = Math.min(0.55, 0.18 + coord.ring * 0.07);
  return h % 1000 < rockyChance * 1000 ? 'rocky' : 'overgrown';
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
