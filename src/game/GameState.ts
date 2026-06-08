/**
 * GameState : la SEULE source de verite runtime.
 *
 * Structure de donnees PURE et serialisable (aucune classe Pixi, aucune
 * fonction, aucune reference circulaire). Sauvegarde = JSON.stringify(state).
 *
 * Tous les systemes lisent/mutent cet objet a pas de temps fixe.
 */

import { STARTING_AGE } from '@/config/ages';
import type { AgeId } from '@/config/ages';
import { INITIAL_RINGS } from '@/config/rings';
import { emptyResourceRecord, RESOURCES } from '@/config/resources';
import type { ResourceId } from '@/config/resources';
import { DEFAULT_CIV, getCivDef } from '@/config/civilizations';
import type { CivId } from '@/config/civilizations';
import { POPULATION } from '@/config/game';
import type { BuildingInstance } from '@/buildings/BuildingInstance';
import { createBuildingInstance } from '@/buildings/BuildingInstance';
import { sectorKey } from '@/world/Sector';

export interface PopulationState {
  /** Habitants vivants (valeur reelle, fractionnaire pendant la croissance). */
  count: number;
  /** Capacite de logement totale (derivee des batiments). */
  capacity: number;
  /** Travailleurs affectes a des emplois. */
  assigned: number;
}

/** Etat runtime de la capacite active de la civilisation. */
export interface AbilityState {
  /** Secondes restantes avant de pouvoir reutiliser la capacite (0 = prete). */
  cooldownRemaining: number;
  /** Secondes restantes du buff de production actif (0 = aucun). */
  buffRemaining: number;
  /** Multiplicateur de production tant que le buff est actif. */
  buffMultiplier: number;
}

export interface GameState {
  /** Civilisation choisie a la creation de la partie. */
  civ: CivId;
  /** Age courant de la civilisation. */
  age: AgeId;
  /** Etat de la capacite active. */
  ability: AbilityState;
  /** Nombre total de ticks logiques (pour restaurer le temps). */
  totalTicks: number;
  /** Stocks de ressources. */
  resources: Record<ResourceId, number>;
  /** Capacites de stockage (derivees des batiments, recalculees par tick). */
  capacities: Record<ResourceId, number>;
  /** Population. */
  population: PopulationState;
  /** Batiments poses, indexes par id d'instance. */
  buildings: Record<string, BuildingInstance>;
  /** Nombre d'anneaux generes (hors centre). */
  ringCount: number;
  /** Compteur pour generer des ids d'instance uniques. */
  nextBuildingId: number;
}

/** Cree l'etat d'une nouvelle partie pour la civilisation choisie. */
export function createNewGame(civ: CivId = DEFAULT_CIV): GameState {
  const civDef = getCivDef(civ);
  const mods = civDef.modifiers;

  const resources = emptyResourceRecord();
  for (const def of Object.values(RESOURCES)) {
    resources[def.id] = def.startAmount;
  }
  // Bonus de ressources de depart propre a la civilisation.
  if (mods.startingResources) {
    for (const [res, amount] of Object.entries(mods.startingResources) as [ResourceId, number][]) {
      resources[res] += amount;
    }
  }

  const campfire = createBuildingInstance('b0', 'campfire', { ring: 0, index: 0 }, true);
  const startPop = POPULATION.startCount + (mods.startingPopulationBonus ?? 0);

  const state: GameState = {
    civ,
    age: STARTING_AGE,
    ability: { cooldownRemaining: 0, buffRemaining: 0, buffMultiplier: 1 },
    totalTicks: 0,
    resources,
    capacities: emptyResourceRecord(),
    population: { count: startPop, capacity: 0, assigned: 0 },
    buildings: { [campfire.id]: campfire },
    ringCount: INITIAL_RINGS,
    nextBuildingId: 1,
  };
  return state;
}

/** Ensemble des cles de secteurs occupes (derive, pour le placement/hit-test). */
export function computeOccupancy(state: GameState): Set<string> {
  const set = new Set<string>();
  for (const b of Object.values(state.buildings)) {
    set.add(sectorKey(b.sector));
  }
  return set;
}
