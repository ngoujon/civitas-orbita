/**
 * File de construction : pose automatique quand ressources disponibles.
 */

import type { BuildingId } from '@/config/buildings';
import type { GameState } from '@/game/GameState';
import type { WorldMap } from '@/world/WorldMap';
import { ConstructionSystem } from '@/buildings/ConstructionSystem';
import { sectorKey } from '@/world/Sector';
import type { SectorCoord } from '@/world/Sector';

export class ConstructionQueueSystem {
  private readonly construction = new ConstructionSystem();

  /** Ajoute un type de batiment a la file. */
  enqueue(state: GameState, buildingId: BuildingId): void {
    if (state.constructionQueue.length >= 5) return;
    state.constructionQueue.push(buildingId);
  }

  /** Retire le premier element de la file. */
  dequeue(state: GameState): BuildingId | null {
    return state.constructionQueue.shift() ?? null;
  }

  /**
   * Tente de placer le prochain batiment en file sur le premier secteur valide libre.
   * Appele periodiquement depuis Game.
   */
  tryProcessNext(
    state: GameState,
    map: WorldMap,
    occupied: Set<string>,
    findSector: (buildingId: BuildingId) => SectorCoord | null,
  ): { placed: BuildingId; id: string } | null {
    if (state.constructionQueue.length === 0) return null;

    const next = state.constructionQueue[0]!;
    const sector = findSector(next);
    if (!sector) return null;

    const result = this.construction.place(state, map, occupied, next, sector);
    if (!result.ok) return null;

    state.constructionQueue.shift();
    occupied.add(sectorKey(sector));
    return { placed: next, id: result.id };
  }
}
