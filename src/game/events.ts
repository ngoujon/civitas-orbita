/**
 * Carte des evenements de jeu (typage du bus d'evenements).
 *
 * Permet aux systemes et a l'UI de reagir sans couplage direct.
 */

import type { AgeId } from '@/config/ages';
import type { BuildingId } from '@/config/buildings';
import type { SectorCoord } from '@/world/Sector';

export interface GameEvents {
  'building:placed': { id: string; def: BuildingId; sector: SectorCoord };
  'building:completed': { id: string; def: BuildingId };
  'building:cancelled': { id: string };
  'building:selected': { id: string | null };
  'age:advanced': { from: AgeId; to: AgeId };
  'buildmode:changed': { building: BuildingId | null };
  'ability:used': { name: string };
  'menu:open': Record<string, never>;
  'notify': { message: string; kind: 'info' | 'warn' };
  [key: string]: unknown;
}
