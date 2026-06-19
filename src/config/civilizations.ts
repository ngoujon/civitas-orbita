/**
 * Definition des civilisations (data-driven).
 *
 * Chaque civilisation apporte des bonus passifs permanents.
 * Les competences actives viennent des maitrises d ere (technologies).
 */

import type { ResourceId } from './resources';
import type { ResourceAmounts } from './buildings';
import type { AbilityEffect } from './abilities';

export type { AbilityEffect } from './abilities';

export type CivId = 'founders' | 'sylvans' | 'builders' | 'scholars' | 'agrarians' | 'merchants';

/** Forme d'embleme (dessine en SVG procedural dans l'UI, zero asset externe). */
export type EmblemShape = 'flame' | 'leaf' | 'hammer' | 'book' | 'wheat' | 'coin';

/** @deprecated Conserve pour la fiche civilisation ; le jeu utilise les competences d ere. */
export interface CivAbility {
  readonly name: string;
  readonly description: string;
  /** Temps de recharge en secondes. */
  readonly cooldown: number;
  readonly effect: AbilityEffect;
}

/** Modificateurs passifs (tous optionnels ; defaut neutre = 1 / 0). */
export interface CivModifiers {
  /** Multiplicateur global sur toute la production. */
  readonly productionMultiplier?: number;
  /** Multiplicateurs de production par ressource (ex: { wood: 1.3 }). */
  readonly productionByResource?: Partial<Record<ResourceId, number>>;
  /** Multiplicateur sur le cout de construction (0.8 = -20%). */
  readonly buildCostMultiplier?: number;
  /** Multiplicateur sur le temps de construction (0.6 = -40%). */
  readonly buildTimeMultiplier?: number;
  /** Multiplicateur sur la croissance de population. */
  readonly populationGrowthMultiplier?: number;
  /** Multiplicateur sur la consommation de nourriture (0.9 = -10%). */
  readonly foodConsumptionMultiplier?: number;
  /** Multiplicateur sur la capacite de stockage. */
  readonly storageMultiplier?: number;
  /** Ressources supplementaires au demarrage. */
  readonly startingResources?: ResourceAmounts;
  /** Population de depart supplementaire. */
  readonly startingPopulationBonus?: number;
}

export interface CivDef {
  readonly id: CivId;
  readonly name: string;
  readonly tagline: string;
  readonly description: string;
  readonly themeColor: number;
  readonly emblem: EmblemShape;
  /** Resume lisible du bonus passif (UI). */
  readonly passiveSummary: string;
  readonly modifiers: CivModifiers;
  readonly ability: CivAbility;
}

export const CIVILIZATIONS: Readonly<Record<CivId, CivDef>> = {
  founders: {
    id: 'founders',
    name: 'Les Fondateurs',
    tagline: 'Polyvalents et resilients',
    description:
      'Un peuple equilibre, ideal pour decouvrir le jeu. Tout progresse un peu plus vite.',
    themeColor: 0xff9a1f,
    emblem: 'flame',
    passiveSummary: '+10% production globale, +10% croissance',
    modifiers: {
      productionMultiplier: 1.1,
      populationGrowthMultiplier: 1.1,
    },
    ability: {
      name: 'Elan Pionnier',
      description: 'Double toute la production pendant 25 s.',
      cooldown: 100,
      effect: { kind: 'production_buff', multiplier: 2, duration: 25 },
    },
  },

  sylvans: {
    id: 'sylvans',
    name: 'Les Sylvains',
    tagline: 'Enfants de la foret',
    description:
      'Maitres du bois, ils batissent a moindre cout grace a leur connaissance des arbres.',
    themeColor: 0x4a8a22,
    emblem: 'leaf',
    passiveSummary: '+35% bois, -15% cout de construction',
    modifiers: {
      productionByResource: { wood: 1.35 },
      buildCostMultiplier: 0.85,
      startingResources: { wood: 60 },
    },
    ability: {
      name: 'Grande Recolte',
      description: 'Octroie immediatement 200 bois et 100 nourriture.',
      cooldown: 90,
      effect: { kind: 'grant', resources: { wood: 200, food: 100 } },
    },
  },

  builders: {
    id: 'builders',
    name: 'Les Batisseurs',
    tagline: 'Architectes infatigables',
    description:
      'Leurs chantiers sont rapides et economes. Une ville sort de terre en un clin d oeil.',
    themeColor: 0x9badb7,
    emblem: 'hammer',
    passiveSummary: '-25% cout, -45% temps de construction',
    modifiers: {
      buildCostMultiplier: 0.75,
      buildTimeMultiplier: 0.55,
    },
    ability: {
      name: 'Corvee Generale',
      description: 'Termine instantanement tous les chantiers en cours.',
      cooldown: 120,
      effect: { kind: 'complete_constructions' },
    },
  },

  scholars: {
    id: 'scholars',
    name: 'Les Erudits',
    tagline: 'Soif de connaissance',
    description:
      'Ils accumulent la science a une vitesse prodigieuse et traversent les ages rapidement.',
    themeColor: 0x4ab0e8,
    emblem: 'book',
    passiveSummary: '+45% science, +5% production globale',
    modifiers: {
      productionByResource: { science: 1.45 },
      productionMultiplier: 1.05,
      startingResources: { science: 30 },
    },
    ability: {
      name: 'Eureka',
      description: 'Octroie immediatement 150 science.',
      cooldown: 90,
      effect: { kind: 'grant', resources: { science: 150 } },
    },
  },

  agrarians: {
    id: 'agrarians',
    name: 'Les Agrariens',
    tagline: 'Le ventre plein',
    description:
      'Champs genereux et familles nombreuses : leur population explose tant que la table est garnie.',
    themeColor: 0x6abe30,
    emblem: 'wheat',
    passiveSummary: '+30% nourriture, +40% croissance, -10% appetit',
    modifiers: {
      productionByResource: { food: 1.3 },
      populationGrowthMultiplier: 1.4,
      foodConsumptionMultiplier: 0.9,
      startingResources: { food: 80 },
      startingPopulationBonus: 2,
    },
    ability: {
      name: 'Grand Festin',
      description: 'Double toute la production pendant 20 s.',
      cooldown: 110,
      effect: { kind: 'production_buff', multiplier: 2, duration: 20 },
    },
  },

  merchants: {
    id: 'merchants',
    name: 'Les Marchands',
    tagline: 'L or avant tout',
    description:
      'Entrepots vastes et coffres pleins : ils stockent plus et transforment tout en richesse.',
    themeColor: 0xf5c542,
    emblem: 'coin',
    passiveSummary: '+50% stockage, +40% or',
    modifiers: {
      storageMultiplier: 1.5,
      productionByResource: { gold: 1.4 },
      startingResources: { stone: 30 },
    },
    ability: {
      name: 'Grande Caravane',
      description: 'Octroie immediatement 80 or et 40 outils.',
      cooldown: 100,
      effect: { kind: 'grant', resources: { gold: 80, tools: 40 } },
    },
  },
};

export const CIV_LIST: readonly CivDef[] = Object.values(CIVILIZATIONS);

/** Civilisation par defaut (parties existantes migrees, valeur de repli). */
export const DEFAULT_CIV: CivId = 'founders';

export function getCivDef(id: CivId): CivDef {
  return CIVILIZATIONS[id] ?? CIVILIZATIONS[DEFAULT_CIV];
}

/** Modificateurs normalises : tous les champs presents avec leur valeur neutre. */
export interface NormalizedModifiers {
  productionMultiplier: number;
  productionByResource: Partial<Record<ResourceId, number>>;
  buildCostMultiplier: number;
  buildTimeMultiplier: number;
  populationGrowthMultiplier: number;
  foodConsumptionMultiplier: number;
  storageMultiplier: number;
}

/** Renvoie les modificateurs passifs normalises d'une civilisation. */
export function getCivModifiers(id: CivId): NormalizedModifiers {
  const m = getCivDef(id).modifiers;
  return {
    productionMultiplier: m.productionMultiplier ?? 1,
    productionByResource: m.productionByResource ?? {},
    buildCostMultiplier: m.buildCostMultiplier ?? 1,
    buildTimeMultiplier: m.buildTimeMultiplier ?? 1,
    populationGrowthMultiplier: m.populationGrowthMultiplier ?? 1,
    foodConsumptionMultiplier: m.foodConsumptionMultiplier ?? 1,
    storageMultiplier: m.storageMultiplier ?? 1,
  };
}

/** Multiplie un cout par un facteur (arrondi au superieur, jamais negatif). */
export function applyCostMultiplier(cost: ResourceAmounts, multiplier: number): ResourceAmounts {
  if (multiplier === 1) return cost;
  const out: ResourceAmounts = {};
  for (const [res, amount] of Object.entries(cost) as [ResourceId, number][]) {
    out[res] = Math.max(0, Math.ceil(amount * multiplier));
  }
  return out;
}
