/**
 * GameState : la SEULE source de verite runtime.
 *
 * Structure de donnees PURE et serialisable (aucune classe Pixi, aucune
 * fonction, aucune reference circulaire). Synchronisation serveur = JSON du state.
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
import type { SectorPrepJob } from '@/world/TerrainSystem';
import { generateNpcIslands } from '@/world/NpcIsland';
import type { NpcIslandState } from '@/world/NpcIsland';
import type { FishingBoatState } from '@/world/FishingBoat';
import type { ScoutBoatState } from '@/world/ScoutBoat';
import { seedInitialSeaExploration } from '@/world/SeaExploration';
import { ringOuterRadius } from '@/config/rings';
import { startingTechs, syncUnlockedAbilitiesFromTechs } from '@/config/technologies';
import type { TechId } from '@/config/technologies';
import type { AgeAbilityId } from '@/config/abilities';
import { cloneDefaultWorkerShares, type WorkerSector } from '@/config/workers';
import type { ObjectiveId } from '@/config/objectives';
import type { RandomEventId } from '@/config/events';
import { HAPPINESS } from '@/config/happiness';
import type { BuildingId } from '@/config/buildings';

export interface PopulationState {
  /** Habitants vivants (valeur reelle, fractionnaire pendant la croissance). */
  count: number;
  /** Capacite de logement totale (derivee des batiments). */
  capacity: number;
  /** Travailleurs affectes a des emplois. */
  assigned: number;
  /** Repartition manuelle par secteur (% ; somme = 100). */
  workerSectorShare: Record<WorkerSector, number>;
  /** Si true, les curseurs du joueur pilotent l affectation. */
  manualWorkerAllocation: boolean;
  /** Bonheur global (0–100). */
  happiness: number;
}

export interface MilitaryState {
  soldiers: number;
  maxSoldiers: number;
  /** Raid en cours (progression 0–1). */
  activeRaid: { strength: number; progress: number } | null;
}

export interface TutorialState {
  stepIndex: number;
  completed: boolean;
}

export interface ObjectivesState {
  completed: Partial<Record<ObjectiveId, true>>;
  expeditionsCompleted: number;
}

export interface ActiveRandomEvent {
  id: RandomEventId;
  remaining: number;
}

export interface RandomEventsState {
  cooldown: number;
  active: ActiveRandomEvent | null;
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

/** Identite du joueur dans le monde (chef de village). */
export interface PlayerIdentity {
  chiefName: string;
  villageName: string;
}

export interface GameState {
  /** Nom du chef de village. */
  chiefName: string;
  /** Nom du village fonde par le joueur. */
  villageName: string;
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
  /** Secteurs prepares (defriches / aplatit), cles sectorKey. */
  preparedSectors: Record<string, true>;
  /** Chantiers de preparation du terrain en cours. */
  prepJobs: Record<string, SectorPrepJob>;
  /** Iles PNJ autour du village (butins pillables). */
  npcIslands: NpcIslandState[];
  /** Technologies deja recherchees. */
  researchedTechs: Record<TechId, true>;
  /** Competences d ere debloquees via l arbre de technologies. */
  unlockedAbilities: Partial<Record<AgeAbilityId, true>>;
  /** Bateaux de peche actifs en mer. */
  fishingBoats: Record<string, FishingBoatState>;
  /** Compteur d ids de bateaux de peche. */
  nextBoatId: number;
  /** Cellules de mer deja explorees (cles grille). */
  exploredSea: Record<string, true>;
  /** Bateaux eclaireurs en mer. */
  scoutBoats: Record<string, ScoutBoatState>;
  nextScoutId: number;
  /** Bonheur, militaire, tutoriel, objectifs, evenements. */
  military: MilitaryState;
  tutorial: TutorialState;
  objectives: ObjectivesState;
  randomEvents: RandomEventsState;
  /** File de construction (types en attente). */
  constructionQueue: BuildingId[];
}

/** Cree l'etat d'une nouvelle partie pour la civilisation choisie. */
export function createNewGame(
  civ: CivId = DEFAULT_CIV,
  identity: PlayerIdentity = { chiefName: 'Chef', villageName: 'Village' },
): GameState {
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
    chiefName: identity.chiefName,
    villageName: identity.villageName,
    civ,
    age: STARTING_AGE,
    ability: { cooldownRemaining: 0, buffRemaining: 0, buffMultiplier: 1 },
    totalTicks: 0,
    resources,
    capacities: emptyResourceRecord(),
    population: {
      count: startPop,
      capacity: 0,
      assigned: 0,
      workerSectorShare: cloneDefaultWorkerShares(),
      manualWorkerAllocation: false,
      happiness: HAPPINESS.start,
    },
    buildings: { [campfire.id]: campfire },
    ringCount: INITIAL_RINGS,
    nextBuildingId: 1,
    preparedSectors: {},
    prepJobs: {},
    npcIslands: generateNpcIslands(),
    researchedTechs: startingTechs(),
    unlockedAbilities: {},
    fishingBoats: {},
    nextBoatId: 0,
    exploredSea: {},
    scoutBoats: {},
    nextScoutId: 0,
    military: { soldiers: 0, maxSoldiers: 0, activeRaid: null },
    tutorial: { stepIndex: 0, completed: false },
    objectives: { completed: {}, expeditionsCompleted: 0 },
    randomEvents: { cooldown: 60, active: null },
    constructionQueue: [],
  };
  seedInitialSeaExploration(state, ringOuterRadius(state.ringCount));
  syncUnlockedAbilitiesFromTechs(state);
  return state;
}

/** Migre les champs ajoutes apres une sauvegarde ancienne. */
export function ensureGameMetaState(state: GameState): void {
  if (state.population.happiness === undefined) {
    state.population.happiness = HAPPINESS.start;
  }
  if (!state.military) {
    state.military = { soldiers: 0, maxSoldiers: 0, activeRaid: null };
  }
  if (!state.tutorial) {
    state.tutorial = { stepIndex: 0, completed: false };
  }
  if (!state.objectives) {
    state.objectives = { completed: {}, expeditionsCompleted: 0 };
  }
  if (!state.randomEvents) {
    state.randomEvents = { cooldown: 60, active: null };
  }
  if (!state.constructionQueue) {
    state.constructionQueue = [];
  }
  for (const island of state.npcIslands) {
    if (!island.relation) island.relation = 'hostile';
    if (island.tributeCooldown === undefined) island.tributeCooldown = 0;
  }
}

/** Ensemble des cles de secteurs occupes (derive, pour le placement/hit-test). */
export function computeOccupancy(state: GameState): Set<string> {
  const set = new Set<string>();
  for (const b of Object.values(state.buildings)) {
    set.add(sectorKey(b.sector));
  }
  return set;
}
