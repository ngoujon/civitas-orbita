/**
 * Etat d une colonie joueur (extrait pour multijoueur).
 *
 * En mode solo, ColonyState est la source de verite runtime (alias GameState).
 */

export type { GameState as ColonyState } from './GameState';
export {
  createNewGame,
  computeOccupancy,
  ensureGameMetaState,
  type PlayerIdentity,
  type PopulationState,
  type MilitaryState,
  type TutorialState,
  type ObjectivesState,
  type ActiveRandomEvent,
  type RandomEventsState,
  type AbilityState,
} from './GameState';
