/**
 * Commandes joueur typées — base du protocole reseau multijoueur.
 */

import type { BuildingId } from '@/config/buildings';
import type { TechId } from '@/config/technologies';
import type { SectorCoord } from '@/world/Sector';
import type { WorkerSector } from '@/config/workers';

export type GameCommand =
  | { type: 'build'; building: BuildingId; sector: SectorCoord }
  | { type: 'demolish'; buildingId: string }
  | { type: 'move'; buildingId: string; sector: SectorCoord }
  | { type: 'upgrade'; buildingId: string }
  | { type: 'research_tech'; techId: TechId }
  | { type: 'research_age' }
  | { type: 'start_expedition'; islandId: string }
  | { type: 'propose_alliance'; islandId: string }
  | { type: 'trade'; islandId: string }
  | { type: 'set_worker_share'; sector: WorkerSector; pct: number }
  | { type: 'enqueue_build'; building: BuildingId }
  | { type: 'activate_ability' };

export interface CommandResult {
  ok: boolean;
  reason?: string;
  events?: string[];
}
