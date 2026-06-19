/**
 * Objectifs / quetes : recompenses quand conditions remplies.
 */

import { OBJECTIVE_ORDER, OBJECTIVES, type ObjectiveCheck } from '@/config/objectives';
import type { ObjectiveId } from '@/config/objectives';
import { ageAtLeast } from '@/config/ages';
import { credit } from '@/economy/ResourceManager';
import type { GameState } from '@/game/GameState';
import type { ResourceId } from '@/config/resources';

export class ObjectiveSystem {
  update(state: GameState): { completed: ObjectiveId; title: string } | null {
    for (const id of OBJECTIVE_ORDER) {
      if (state.objectives.completed[id]) continue;
      const def = OBJECTIVES.find((o) => o.id === id);
      if (!def) continue;
      if (!checkObjective(state, def.check)) continue;

      state.objectives.completed[id] = true;
      for (const [res, amt] of Object.entries(def.reward) as [ResourceId, number][]) {
        if (amt > 0) credit(state, res, amt);
      }
      return { completed: id, title: def.title };
    }
    return null;
  }

  activeObjective(state: GameState): { id: ObjectiveId; title: string; description: string } | null {
    for (const id of OBJECTIVE_ORDER) {
      if (state.objectives.completed[id]) continue;
      const def = OBJECTIVES.find((o) => o.id === id);
      if (def) return { id, title: def.title, description: def.description };
    }
    return null;
  }
}

function checkObjective(state: GameState, check: ObjectiveCheck): boolean {
  switch (check.type) {
    case 'building_count': {
      let n = 0;
      for (const b of Object.values(state.buildings)) {
        if (b.def === check.building && b.complete) n++;
      }
      return n >= check.min;
    }
    case 'population':
      return state.population.count >= check.min;
    case 'age':
      return ageAtLeast(state.age, check.age);
    case 'explored_cells':
      return Object.keys(state.exploredSea).length >= check.min;
    case 'expeditions_completed':
      return state.objectives.expeditionsCompleted >= check.min;
    default:
      return false;
  }
}
