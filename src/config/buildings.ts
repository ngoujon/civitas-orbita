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
import type { SynergyGroupId } from './synergy';
import { BUILDING_UPGRADE } from './game';

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
  | 'port'
  | 'barracks'
  | 'university'
  | 'factory'
  | 'habitat_dome'
  | 'solar_array'
  | 'quantum_lab'
  | 'orbital_depot'
  | 'sawmill'
  | 'bank'
  | 'printing_house';

export type BuildingCategory =
  | 'special'
  | 'production'
  | 'housing'
  | 'storage'
  | 'research'
  | 'military'
  | 'trade';

/** Ordre d'affichage des categories dans le panneau de construction. */
export const BUILDING_CATEGORY_ORDER: readonly BuildingCategory[] = [
  'housing',
  'production',
  'storage',
  'trade',
  'research',
  'military',
  'special',
];

/** Libelles francais des categories (UI). */
export const BUILDING_CATEGORY_LABELS: Record<BuildingCategory, string> = {
  housing: 'Habitation',
  production: 'Economie',
  storage: 'Stockage',
  trade: 'Commerce',
  research: 'Recherche',
  military: 'Militaire',
  special: 'Special',
};

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
  /** Doit etre construit sur l anneau exterieur (lisiere / mer). */
  readonly shoreRequired?: boolean;
  /** Reserve toute la ligne radiale vers la mer (acces maritime). */
  readonly reservesSeaAccess?: boolean;
  /** Niveau maximum (defaut : BUILDING_UPGRADE.maxLevel). */
  readonly maxLevel?: number;
  /** Desactive les ameliorations (defaut : active si production/logement/stockage). */
  readonly upgradeable?: boolean;
  /** Cout de base d une amelioration (defaut : cost de construction). */
  readonly upgradeCost?: ResourceAmounts;
  /** Groupe de synergie : voisins du meme groupe augmentent la production. */
  readonly synergyGroup?: SynergyGroupId;
}

export const BUILDINGS: Readonly<Record<BuildingId, BuildingDef>> = {
  campfire: {
    id: 'campfire',
    name: 'Feu de camp',
    description:
      'Coeur de votre colonie. Ameliorable pour booster production, logement et stockage. Indestructible.',
    category: 'special',
    unlockedAtAge: 'fire',
    cost: {},
    buildTime: 0,
    produces: { food: 0.02, wood: 0.015, stone: 0.01, science: 0.05 },
    housing: 3,
    storage: { food: 50, wood: 50 },
    upgradeable: true,
    upgradeCost: { wood: 25, stone: 18, food: 12 },
    sprite: 'campfire',
    buildable: false,
    unique: true,
  },

  // --- Age du Feu / Pierre : prototype jouable ---
  lumberjack: {
    id: 'lumberjack',
    name: 'Cabane de bucheron',
    description:
      'Recolte du bois en continu. Regroupez plusieurs cabanes voisines pour un bonus de production (chemins lumineux).',
    category: 'production',
    unlockedAtAge: 'fire',
    cost: { wood: 20 },
    buildTime: 3,
    produces: { wood: 0.8 },
    jobs: 2,
    sprite: 'lumberjack',
    buildable: true,
    synergyGroup: 'wood',
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
    synergyGroup: 'food',
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
    synergyGroup: 'stone',
  },
  warehouse: {
    id: 'warehouse',
    name: 'Entrepot',
    description:
      'Augmente la capacite de stockage de toutes les ressources. Evite le gaspillage quand les stocks sont pleins.',
    category: 'storage',
    unlockedAtAge: 'stone',
    cost: { wood: 40, stone: 20 },
    buildTime: 5,
    storage: { food: 300, wood: 300, stone: 300, iron: 100, gold: 100, tools: 50 },
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
    synergyGroup: 'tools',
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
    synergyGroup: 'science',
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
    synergyGroup: 'iron',
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
    synergyGroup: 'gold',
  },
  port: {
    id: 'port',
    name: 'Port',
    description:
      'Quai sur la lisiere. Envoie des bateaux de peche et un eclaireur qui disperse les nuages pour reveler la mer inexploree.',
    category: 'trade',
    unlockedAtAge: 'medieval',
    cost: { wood: 100, stone: 60 },
    buildTime: 10,
    produces: { food: 0.1 },
    jobs: 2,
    sprite: 'port',
    buildable: true,
    shoreRequired: true,
    reservesSeaAccess: true,
  },
  barracks: {
    id: 'barracks',
    name: 'Caserne',
    description:
      'Entraine des miliciens pour defendre le village contre les raids.',
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
    synergyGroup: 'science',
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
    synergyGroup: 'tools',
  },

  // --- Ere Futuriste ---
  habitat_dome: {
    id: 'habitat_dome',
    name: 'Dome d habitation',
    description:
      'Arcologie sous cloche energisee : logement dense pour l ere futuriste (25 habitants).',
    category: 'housing',
    unlockedAtAge: 'future',
    cost: { iron: 120, gold: 80, stone: 100 },
    buildTime: 18,
    housing: 25,
    sprite: 'habitat_dome',
    buildable: true,
  },
  solar_array: {
    id: 'solar_array',
    name: 'Ferme solaire',
    description:
      'Panneaux a haut rendement produisant science et outils avances (consomme de l or).',
    category: 'production',
    unlockedAtAge: 'future',
    cost: { iron: 150, gold: 60, tools: 40 },
    buildTime: 16,
    produces: { science: 1.8, tools: 0.4 },
    consumes: { gold: 0.15 },
    jobs: 4,
    sprite: 'solar_array',
    buildable: true,
    synergyGroup: 'science',
  },
  quantum_lab: {
    id: 'quantum_lab',
    name: 'Labo quantique',
    description:
      'Recherche de pointe : production massive de science pour repousser les limites.',
    category: 'research',
    unlockedAtAge: 'future',
    cost: { iron: 180, gold: 100, tools: 60 },
    buildTime: 20,
    produces: { science: 3.0 },
    consumes: { gold: 0.2, tools: 0.1 },
    jobs: 8,
    sprite: 'quantum_lab',
    buildable: true,
    synergyGroup: 'science',
  },
  orbital_depot: {
    id: 'orbital_depot',
    name: 'Silo orbital',
    description:
      'Stockage orbital etendu pour toutes les ressources de la colonie avancee.',
    category: 'storage',
    unlockedAtAge: 'future',
    cost: { iron: 200, gold: 120, stone: 80 },
    buildTime: 18,
    storage: { food: 800, wood: 800, stone: 800, iron: 400, gold: 400, tools: 200 },
    sprite: 'orbital_depot',
    buildable: true,
  },
  sawmill: {
    id: 'sawmill',
    name: 'Scierie',
    description: 'Transforme le bois brut en planches ; produit du bois a un rythme soutenu.',
    category: 'production',
    unlockedAtAge: 'stone',
    cost: { wood: 30, stone: 15 },
    buildTime: 5,
    produces: { wood: 0.5 },
    jobs: 2,
    sprite: 'lumberjack',
    buildable: true,
    synergyGroup: 'wood',
  },
  bank: {
    id: 'bank',
    name: 'Banque',
    description: 'Institution financiere qui genere de l or passivement grace aux echanges commerciaux.',
    category: 'trade',
    unlockedAtAge: 'medieval',
    cost: { stone: 50, gold: 20 },
    buildTime: 8,
    produces: { gold: 0.25 },
    jobs: 3,
    sprite: 'market',
    buildable: true,
    synergyGroup: 'gold',
  },
  printing_house: {
    id: 'printing_house',
    name: "Maison d'edition",
    description: 'Diffuse le savoir a grande echelle ; produit de la science supplementaire.',
    category: 'research',
    unlockedAtAge: 'renaissance',
    cost: { wood: 50, stone: 40 },
    buildTime: 10,
    produces: { science: 0.4 },
    jobs: 3,
    sprite: 'library',
    buildable: true,
    synergyGroup: 'science',
  },
};

export const BUILDING_LIST: readonly BuildingDef[] = Object.values(BUILDINGS);

/** Total des couts (utile pour l'UI). */
export function buildingCost(id: BuildingId): ResourceAmounts {
  return BUILDINGS[id].cost;
}

export function maxLevelFor(def: BuildingDef): number {
  return def.maxLevel ?? BUILDING_UPGRADE.maxLevel;
}

/** Seul le feu de camp peut etre ameliore (productivite, logement, stockage x niveau). */
export function isUpgradeable(def: BuildingDef): boolean {
  return def.id === 'campfire' && def.upgradeable !== false && maxLevelFor(def) > 1;
}

/** Cout pour passer du niveau courant au suivant. */
export function upgradeCostAtLevel(def: BuildingDef, currentLevel: number): ResourceAmounts {
  if (currentLevel >= maxLevelFor(def)) return {};

  const base = def.upgradeCost ?? def.cost;
  const scale = currentLevel * BUILDING_UPGRADE.costScale;
  const out: ResourceAmounts = {};
  let hasCost = false;

  for (const [res, amount] of Object.entries(base) as [ResourceId, number][]) {
    if (!amount || amount <= 0) continue;
    out[res] = Math.max(1, Math.ceil(amount * scale));
    hasCost = true;
  }

  if (!hasCost) {
    return {
      wood: Math.max(1, Math.ceil(20 * scale)),
      stone: Math.max(1, Math.ceil(14 * scale)),
      food: Math.max(1, Math.ceil(10 * scale)),
    };
  }

  return out;
}

/** Applique le multiplicateur de niveau a des taux ou montants. */
export function scaleByLevel(values: ResourceAmounts, level: number): ResourceAmounts {
  const out: ResourceAmounts = {};
  for (const [res, rate] of Object.entries(values) as [ResourceId, number][]) {
    if (!rate) continue;
    out[res] = rate * level;
  }
  return out;
}
