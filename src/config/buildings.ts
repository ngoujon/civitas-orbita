/**
 * Definition des batiments (data-driven).
 *
 * Ajouter un batiment = ajouter une entree ici. Le moteur itere sur cette table,
 * il ne hardcode jamais un batiment precis.
 *
 * Modele de production : un batiment, lorsqu'il est dote de travailleurs,
 * produit `produces` et consomme `consumes` (taux par seconde a plein effectif),
 * proportionnellement au taux de dotation (workers / jobs).
 * Les batiments sans `jobs` (ex: maisons, entrepots) fonctionnent passivement.
 */

import type { AgeId } from './ages';
import type { ResourceId } from './resources';

export type BuildingId =
  | 'campfire'
  | 'lumberjack'
  | 'quarry'
  | 'hut'
  | 'warehouse'
  | 'farm'
  | 'mine'
  | 'workshop'
  | 'library'
  | 'house'
  | 'market'
  | 'barracks'
  | 'university'
  | 'factory';

export type BuildingCategory =
  | 'special'
  | 'production'
  | 'housing'
  | 'storage'
  | 'research'
  | 'military'
  | 'trade';

/** Cout / production : sous-ensemble partiel de ressources. */
export type ResourceAmounts = Partial<Record<ResourceId, number>>;

export interface BuildingDef {
  readonly id: BuildingId;
  readonly name: string;
  /** Description de l'utilite du batiment (affichee en infobulle). */
  readonly description: string;
  readonly category: BuildingCategory;
  readonly unlockedAtAge: AgeId;
  /** Cout de construction (retire des stocks a la pose). */
  readonly cost: ResourceAmounts;
  /** Duree de construction en secondes (0 = instantane). */
  readonly buildTime: number;
  /** Production par seconde a plein effectif. */
  readonly produces?: ResourceAmounts;
  /** Consommation par seconde a plein effectif (entrants de chaine de prod). */
  readonly consumes?: ResourceAmounts;
  /** Emplois fournis (travailleurs requis pour produire a plein regime). */
  readonly jobs?: number;
  /** Capacite de population fournie (logement). */
  readonly housing?: number;
  /** Bonus de capacite de stockage par ressource. */
  readonly storage?: ResourceAmounts;
  /** Cle de dessin procedural (rendering/ProceduralSprites). */
  readonly sprite: string;
  /** Peut-on construire ce batiment (faux pour les batiments uniques/centraux) ? */
  readonly buildable: boolean;
  /** Unicite : un seul exemplaire autorise (ex: feu de camp). */
  readonly unique?: boolean;
}

export const BUILDINGS: Readonly<Record<BuildingId, BuildingDef>> = {
  campfire: {
    id: 'campfire',
    name: 'Feu de camp',
    description:
      'Coeur de votre colonie. Abrite quelques habitants, stocke un peu de ressources et genere une faible science. Indestructible.',
    category: 'special',
    unlockedAtAge: 'fire',
    cost: {},
    buildTime: 0,
    produces: { science: 0.05 },
    housing: 3,
    storage: { food: 50, wood: 50 },
    sprite: 'campfire',
    buildable: false,
    unique: true,
  },

  // --- Age du Feu / Pierre : prototype jouable ---
  lumberjack: {
    id: 'lumberjack',
    name: 'Cabane de bucheron',
    description:
      'Recolte du bois en continu. Le bois est la ressource de base pour construire la plupart des batiments.',
    category: 'production',
    unlockedAtAge: 'fire',
    cost: { wood: 20 },
    buildTime: 3,
    produces: { wood: 0.8 },
    jobs: 2,
    sprite: 'lumberjack',
    buildable: true,
  },
  hut: {
    id: 'hut',
    name: 'Hutte',
    description:
      'Loge 4 habitants. Augmentez votre logement pour faire croitre la population et donc la main d oeuvre.',
    category: 'housing',
    unlockedAtAge: 'fire',
    cost: { wood: 15 },
    buildTime: 2,
    housing: 4,
    sprite: 'hut',
    buildable: true,
  },
  farm: {
    id: 'farm',
    name: 'Ferme',
    description:
      'Produit de la nourriture. Sans nourriture suffisante, votre population cesse de croitre puis decline (famine).',
    category: 'production',
    unlockedAtAge: 'fire',
    cost: { wood: 25 },
    buildTime: 4,
    produces: { food: 1.0 },
    jobs: 3,
    sprite: 'farm',
    buildable: true,
  },
  quarry: {
    id: 'quarry',
    name: 'Carriere',
    description:
      'Extrait de la pierre, indispensable aux batiments avances et aux structures durables.',
    category: 'production',
    unlockedAtAge: 'stone',
    cost: { wood: 30 },
    buildTime: 5,
    produces: { stone: 0.6 },
    jobs: 2,
    sprite: 'quarry',
    buildable: true,
  },
  warehouse: {
    id: 'warehouse',
    name: 'Entrepot',
    description:
      'Augmente fortement la capacite de stockage (nourriture, bois, pierre). Evite le gaspillage quand les stocks sont pleins.',
    category: 'storage',
    unlockedAtAge: 'stone',
    cost: { wood: 40, stone: 20 },
    buildTime: 5,
    storage: { food: 300, wood: 300, stone: 300 },
    sprite: 'warehouse',
    buildable: true,
  },

  // --- Bronze : chaines de production + science ---
  workshop: {
    id: 'workshop',
    name: 'Atelier',
    description:
      'Transforme le bois en outils. Les outils ameliorent les chaines de production avancees (mines, usines).',
    category: 'production',
    unlockedAtAge: 'bronze',
    cost: { wood: 50, stone: 30 },
    buildTime: 6,
    produces: { tools: 0.3 },
    consumes: { wood: 0.4 },
    jobs: 3,
    sprite: 'workshop',
    buildable: true,
  },
  library: {
    id: 'library',
    name: 'Bibliotheque',
    description:
      'Genere de la science, la ressource cle pour rechercher et debloquer les ages suivants.',
    category: 'research',
    unlockedAtAge: 'bronze',
    cost: { wood: 60, stone: 40 },
    buildTime: 7,
    produces: { science: 0.4 },
    jobs: 2,
    sprite: 'library',
    buildable: true,
  },

  // --- Fer ---
  mine: {
    id: 'mine',
    name: 'Mine',
    description:
      'Extrait du fer en consommant des outils. Le fer ouvre la voie aux armes, aux usines et aux constructions modernes.',
    category: 'production',
    unlockedAtAge: 'iron',
    cost: { wood: 60, stone: 60 },
    buildTime: 8,
    produces: { iron: 0.4 },
    consumes: { tools: 0.05 },
    jobs: 4,
    sprite: 'mine',
    buildable: true,
  },

  // --- Moyen Age ---
  house: {
    id: 'house',
    name: 'Maison',
    description:
      'Logement dense : abrite 10 habitants, bien plus efficace qu une hutte pour les grandes villes.',
    category: 'housing',
    unlockedAtAge: 'medieval',
    cost: { wood: 50, stone: 40 },
    buildTime: 6,
    housing: 10,
    sprite: 'house',
    buildable: true,
  },
  market: {
    id: 'market',
    name: 'Marche',
    description:
      'Convertit de la nourriture en or. L or sert au commerce, aux universites et aux batiments de prestige.',
    category: 'trade',
    unlockedAtAge: 'medieval',
    cost: { wood: 80, stone: 40 },
    buildTime: 8,
    produces: { gold: 0.3 },
    consumes: { food: 0.2 },
    jobs: 3,
    sprite: 'market',
    buildable: true,
  },
  barracks: {
    id: 'barracks',
    name: 'Caserne',
    description:
      'Fournit des emplois militaires et prepare la defense de votre cite (unites a venir).',
    category: 'military',
    unlockedAtAge: 'medieval',
    cost: { wood: 100, stone: 80, iron: 20 },
    buildTime: 10,
    jobs: 4,
    sprite: 'barracks',
    buildable: true,
  },

  // --- Renaissance / Moderne ---
  university: {
    id: 'university',
    name: 'Universite',
    description:
      'Production de science massive (consomme un peu d or). Accelere fortement la progression vers les ages avances.',
    category: 'research',
    unlockedAtAge: 'renaissance',
    cost: { wood: 150, stone: 120, gold: 30 },
    buildTime: 12,
    produces: { science: 1.2 },
    consumes: { gold: 0.1 },
    jobs: 6,
    sprite: 'university',
    buildable: true,
  },
  factory: {
    id: 'factory',
    name: 'Usine',
    description:
      'Production industrielle d outils a partir de fer. Le moteur economique de l ere moderne.',
    category: 'production',
    unlockedAtAge: 'industrial',
    cost: { wood: 200, stone: 150, iron: 100 },
    buildTime: 15,
    produces: { tools: 1.5 },
    consumes: { iron: 0.5 },
    jobs: 10,
    sprite: 'factory',
    buildable: true,
  },
};

export const BUILDING_LIST: readonly BuildingDef[] = Object.values(BUILDINGS);

/** Total des couts (utile pour l'UI). */
export function buildingCost(id: BuildingId): ResourceAmounts {
  return BUILDINGS[id].cost;
}
