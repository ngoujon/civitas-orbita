/**
 * Diplomatie avec les iles PNJ : alliance, tribut, commerce.
 */

import { DIPLOMACY } from '@/config/happiness';
import { credit, withdraw } from '@/economy/ResourceManager';
import type { GameState } from '@/game/GameState';
import type { NpcIslandState } from '@/world/NpcIsland';

export class DiplomacySystem {
  update(state: GameState, dt: number): string | null {
    const messages: string[] = [];
    for (const island of state.npcIslands) {
      if (island.absorbed || island.relation !== 'allied') continue;
      island.tributeCooldown = Math.max(0, island.tributeCooldown - dt);
      if (island.tributeCooldown <= 0) {
        credit(state, 'gold', DIPLOMACY.tributeGold);
        island.tributeCooldown = DIPLOMACY.tributeInterval;
        messages.push(`${island.villageName} vous envoie un tribut de ${DIPLOMACY.tributeGold} or.`);
      }
    }
    return messages.length > 0 ? messages.join(' ') : null;
  }

  /** Tente d etablir une alliance (coute de l or). */
  proposeAlliance(state: GameState, islandId: string): { ok: boolean; message: string } {
    const island = state.npcIslands.find((i) => i.id === islandId);
    if (!island || island.absorbed) {
      return { ok: false, message: 'Ile introuvable.' };
    }
    if (island.relation === 'allied') {
      return { ok: false, message: 'Deja allie.' };
    }
    if (island.relation === 'hostile' && island.expedition) {
      return { ok: false, message: 'Expedition en cours — impossible de negocier.' };
    }
    const paid = withdraw(state, 'gold', DIPLOMACY.allianceCost);
    if (paid < DIPLOMACY.allianceCost) {
      return { ok: false, message: `${DIPLOMACY.allianceCost} or requis pour l alliance.` };
    }
    island.relation = 'allied';
    island.tributeCooldown = DIPLOMACY.tributeInterval;
    return { ok: true, message: `Alliance conclue avec ${island.villageName} !` };
  }

  /** Commerce avec une ile alliee. */
  tradeWithAlly(state: GameState, island: NpcIslandState): { ok: boolean; message: string } {
    if (island.relation !== 'allied') {
      return { ok: false, message: 'Commerce reserve aux allies.' };
    }
    const foodCost = 30;
    if (state.resources.food < foodCost) {
      return { ok: false, message: 'Nourriture insuffisante pour le commerce.' };
    }
    withdraw(state, 'food', foodCost);
    const goldGain = Math.floor(15 * DIPLOMACY.alliedTradeBonus);
    credit(state, 'gold', goldGain);
    return { ok: true, message: `Echange avec ${island.villageName} : +${goldGain} or.` };
  }
}
