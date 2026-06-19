/**
 * Applique une commande sur l etat colonie (pur, testable sans Pixi).
 */

import type { GameCommand, CommandResult } from './commands';
import type { ColonyState } from './ColonyState';
import { TechSystem } from '@/research/TechSystem';
import { AgeSystem } from '@/research/AgeSystem';
import { ConstructionSystem } from '@/buildings/ConstructionSystem';
import { UpgradeSystem } from '@/buildings/UpgradeSystem';
import { IslandExpeditionSystem } from '@/world/IslandExpeditionSystem';
import { DiplomacySystem } from './DiplomacySystem';
import { adjustWorkerShare } from '@/population/WorkerAllocation';
import { computeOccupancy } from './GameState';
import type { WorldMap } from '@/world/WorldMap';
import { sectorKey } from '@/world/Sector';

export class CommandProcessor {
  private readonly tech = new TechSystem();
  private readonly ages = new AgeSystem();
  private readonly construction = new ConstructionSystem();
  private readonly upgrades = new UpgradeSystem();
  private readonly expeditions = new IslandExpeditionSystem();
  private readonly diplomacy = new DiplomacySystem();

  apply(state: ColonyState, map: WorldMap, cmd: GameCommand): CommandResult {
    const occupied = computeOccupancy(state);
    const events: string[] = [];

    switch (cmd.type) {
      case 'build': {
        const result = this.construction.place(state, map, occupied, cmd.building, cmd.sector);
        if (!result.ok) return { ok: false, reason: result.reason };
        occupied.add(sectorKey(cmd.sector));
        events.push(`building:placed:${result.id}`);
        return { ok: true, events };
      }
      case 'demolish': {
        if (!this.construction.cancel(state, cmd.buildingId)) {
          return { ok: false, reason: 'not_found' };
        }
        events.push(`building:cancelled:${cmd.buildingId}`);
        return { ok: true, events };
      }
      case 'move': {
        const result = this.construction.move(state, map, occupied, cmd.buildingId, cmd.sector);
        if (!result.ok) return { ok: false, reason: result.reason };
        events.push(`building:moved:${cmd.buildingId}`);
        return { ok: true, events };
      }
      case 'upgrade': {
        const result = this.upgrades.upgrade(state, cmd.buildingId);
        if (!result.ok) return { ok: false, reason: result.reason };
        events.push(`building:upgraded:${cmd.buildingId}`);
        return { ok: true, events };
      }
      case 'research_tech': {
        const result = this.tech.research(state, cmd.techId);
        if (!result.ok) return { ok: false, reason: result.reason };
        events.push(`tech:researched:${cmd.techId}`);
        return { ok: true, events };
      }
      case 'research_age': {
        const result = this.ages.advance(state);
        if (!result.advanced) return { ok: false, reason: 'cannot_advance' };
        events.push(`age:advanced:${result.to}`);
        return { ok: true, events };
      }
      case 'start_expedition': {
        const result = this.expeditions.startExpedition(state, cmd.islandId);
        if (!result.ok) return { ok: false, reason: result.reason };
        events.push(`expedition:started:${cmd.islandId}`);
        return { ok: true, events };
      }
      case 'propose_alliance': {
        const result = this.diplomacy.proposeAlliance(state, cmd.islandId);
        return { ok: result.ok, reason: result.ok ? undefined : result.message, events };
      }
      case 'trade': {
        const island = state.npcIslands.find((i) => i.id === cmd.islandId);
        if (!island) return { ok: false, reason: 'island_not_found' };
        const result = this.diplomacy.tradeWithAlly(state, island);
        return { ok: result.ok, reason: result.ok ? undefined : result.message };
      }
      case 'set_worker_share': {
        state.population.manualWorkerAllocation = true;
        state.population.workerSectorShare = adjustWorkerShare(
          state.population.workerSectorShare,
          cmd.sector,
          cmd.pct,
        );
        return { ok: true };
      }
      case 'enqueue_build': {
        if (state.constructionQueue.length >= 5) {
          return { ok: false, reason: 'queue_full' };
        }
        state.constructionQueue.push(cmd.building);
        return { ok: true };
      }
      case 'activate_ability':
        return { ok: false, reason: 'use_game_activate_ability' };
      default:
        return { ok: false, reason: 'unknown_command' };
    }
  }
}
