/**
 * Carte des evenements de jeu (typage du bus d'evenements).
 *
 * Permet aux systemes et a l'UI de reagir sans couplage direct.
 */

import type { AgeId } from '@/config/ages';
import type { BuildingId } from '@/config/buildings';
import type { SectorCoord } from '@/world/Sector';
import type { ResourceAmounts } from '@/config/buildings';
import type { TechId } from '@/config/technologies';

export interface GameEvents {
  'building:placed': { id: string; def: BuildingId; sector: SectorCoord };
  'building:completed': { id: string; def: BuildingId };
  'building:upgraded': { id: string; def: BuildingId; level: number };
  'building:cancelled': { id: string };
  'building:moved': { id: string; def: BuildingId; from: SectorCoord; to: SectorCoord };
  'building:selected': { id: string | null };
  'age:advanced': { from: AgeId; to: AgeId };
  'buildmode:changed': { building: BuildingId | null };
  'ability:used': { name: string };
  'terrain:prep_started': { sector: SectorCoord; kind: import('@/config/terrain').TerrainKind };
  'terrain:prepared': { key: string; yields: import('@/config/buildings').ResourceAmounts };
  'npcIsland:selected': { id: string | null };
  'expedition:started': { islandId: string; villageName: string };
  'expedition:completed': { islandId: string; villageName: string; loot: ResourceAmounts };
  'expedition:loot_respawned': { islandId: string; villageName: string };
  'tech:researched': { id: TechId; name: string; unlocks: string[] };
  'menu:open': Record<string, never>;
  'state:changed': Record<string, never>;
  'tutorial:step': { title: string; message: string };
  'objective:completed': { id: string; title: string };
  'random:event': { title: string; message: string };
  'notify': { message: string; kind: 'info' | 'warn' };
  'demolish:mode': { active: boolean };
  'demolish:marked': { ids: string[] };
  'demolish:confirmed': { count: number };
  [key: string]: unknown;
}
