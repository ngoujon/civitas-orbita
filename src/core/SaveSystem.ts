/**
 * Serialisation / deserialisation versionnee de GameState.
 *
 * Format JSON pur pour persistance locale ou cloud. Les migrations permettent
 * de charger des sauvegardes plus anciennes apres evolution du schema.
 */

import type { GameState } from '@/game/GameState';
import { ensureGameMetaState } from '@/game/GameState';
import { cloneDefaultWorkerShares } from '@/config/workers';
import { HAPPINESS } from '@/config/happiness';
import { startingTechs } from '@/config/technologies';

/** Version courante du format de sauvegarde. */
export const SAVE_VERSION = 1;

export interface SaveEnvelope {
  version: number;
  savedAt: string;
  state: GameState;
}

export class SaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveError';
  }
}

/** Enveloppe l'etat avec metadonnees de version. */
export function serialize(state: GameState): string {
  const envelope: SaveEnvelope = {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    state: cloneState(state),
  };
  return JSON.stringify(envelope);
}

/** Parse et migre une sauvegarde vers la version courante. */
export function deserialize(raw: string): GameState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new SaveError('Fichier de sauvegarde invalide (JSON corrompu).');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new SaveError('Format de sauvegarde invalide.');
  }

  const obj = parsed as Record<string, unknown>;

  // Ancien format sans enveloppe (etat brut).
  if (!('version' in obj) && 'civ' in obj && 'buildings' in obj) {
    return migrateState(obj as unknown as GameState, 0);
  }

  const version = typeof obj.version === 'number' ? obj.version : 0;
  if (!obj.state || typeof obj.state !== 'object') {
    throw new SaveError('Sauvegarde sans etat de jeu.');
  }

  return migrateState(obj.state as GameState, version);
}

/** Applique les migrations incrementales depuis une version source. */
function migrateState(state: GameState, fromVersion: number): GameState {
  let s = cloneState(state);

  if (fromVersion < 1) {
    s = migrateToV1(s);
  }

  if (fromVersion > SAVE_VERSION) {
    throw new SaveError(`Sauvegarde trop recente (v${fromVersion}). Mettez le jeu a jour.`);
  }

  ensureGameMetaState(s);
  return s;
}

/** v0 → v1 : champs optionnels ajoutes au fil du dev. */
function migrateToV1(state: GameState): GameState {
  if (!state.exploredSea) state.exploredSea = {};
  if (!state.scoutBoats) state.scoutBoats = {};
  if (state.nextScoutId === undefined) state.nextScoutId = 0;
  if (!state.fishingBoats) state.fishingBoats = {};
  if (state.nextBoatId === undefined) state.nextBoatId = 0;
  if (!state.unlockedAbilities) state.unlockedAbilities = {};
  if (!state.researchedTechs) state.researchedTechs = startingTechs();
  if (!state.preparedSectors) state.preparedSectors = {};
  if (!state.prepJobs) state.prepJobs = {};
  if (!state.npcIslands) state.npcIslands = [];
  if (!state.ability) {
    state.ability = { cooldownRemaining: 0, buffRemaining: 0, buffMultiplier: 1 };
  }
  if (!state.abilityCooldowns) {
    state.abilityCooldowns = {};
  }
  if (state.totalTicks === undefined) state.totalTicks = 0;
  if (!state.population?.workerSectorShare) {
    const count = state.population?.count ?? 1;
    state.population = {
      count,
      capacity: state.population?.capacity ?? 0,
      assigned: state.population?.assigned ?? 0,
      workerSectorShare: cloneDefaultWorkerShares(),
      manualWorkerAllocation: state.population?.manualWorkerAllocation ?? false,
      happiness: state.population?.happiness ?? HAPPINESS.start,
    };
  } else if (state.population.happiness === undefined) {
    state.population.happiness = HAPPINESS.start;
  }
  return state;
}

function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}
