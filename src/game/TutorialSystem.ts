/**
 * Tutoriel guide : avance automatiquement selon les conditions de jeu.
 */

import { TUTORIAL_STEPS, type TutorialCheck } from '@/config/tutorial';
import type { GameState } from '@/game/GameState';

export class TutorialSystem {
  update(state: GameState): { advanced: boolean; title?: string; message?: string } {
    if (state.tutorial.completed) return { advanced: false };

    const step = TUTORIAL_STEPS[state.tutorial.stepIndex];
    if (!step) {
      state.tutorial.completed = true;
      return { advanced: false };
    }

    if (!checkCondition(state, step.check)) return { advanced: false };

    state.tutorial.stepIndex++;
    const next = TUTORIAL_STEPS[state.tutorial.stepIndex];
    if (!next || state.tutorial.stepIndex >= TUTORIAL_STEPS.length) {
      state.tutorial.completed = true;
      return {
        advanced: true,
        title: step.title,
        message: 'Tutoriel termine ! Bonne chance, chef.',
      };
    }

    return { advanced: true, title: next.title, message: next.message };
  }

  currentStep(state: GameState): { title: string; message: string } | null {
    if (state.tutorial.completed) return null;
    const step = TUTORIAL_STEPS[state.tutorial.stepIndex];
    if (!step) return null;
    return { title: step.title, message: step.message };
  }
}

function checkCondition(state: GameState, check: TutorialCheck): boolean {
  switch (check.type) {
    case 'always':
      return true;
    case 'building_count': {
      let n = 0;
      for (const b of Object.values(state.buildings)) {
        if (b.def === check.building && b.complete) n++;
      }
      return n >= check.min;
    }
    case 'building_exists':
      return Object.values(state.buildings).some((b) => b.def === check.building && b.complete);
    case 'prepared_sectors':
      return Object.keys(state.preparedSectors).length >= check.min;
    case 'tech_researched':
      return !!state.researchedTechs[check.tech];
    default:
      return false;
  }
}
