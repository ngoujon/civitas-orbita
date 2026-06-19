/**
 * Competences actives par ere (debloquees via l arbre de technologies).
 */

import type { AgeId } from './ages';
import { AGES } from './ages';
import type { ResourceAmounts } from './buildings';

export type AgeAbilityId = AgeId;

/** Effet d'une competence active. */
export type AbilityEffect =
  | { kind: 'grant'; resources: ResourceAmounts }
  | { kind: 'complete_constructions' }
  | { kind: 'production_buff'; multiplier: number; duration: number };

export interface AgeAbilityDef {
  readonly id: AgeAbilityId;
  readonly name: string;
  readonly description: string;
  readonly cooldown: number;
  readonly effect: AbilityEffect;
}

export const AGE_ABILITIES: Readonly<Record<AgeAbilityId, AgeAbilityDef>> = {
  fire: {
    id: 'fire',
    name: 'Flamme du clan',
    description: 'Booste toute la production x1,75 pendant 20 s.',
    cooldown: 90,
    effect: { kind: 'production_buff', multiplier: 1.75, duration: 20 },
  },
  stone: {
    id: 'stone',
    name: 'Corvee des pierres',
    description: 'Octroie 80 pierre et 60 bois.',
    cooldown: 85,
    effect: { kind: 'grant', resources: { stone: 80, wood: 60 } },
  },
  bronze: {
    id: 'bronze',
    name: 'Fournaise ardente',
    description: 'Double la production pendant 18 s.',
    cooldown: 95,
    effect: { kind: 'production_buff', multiplier: 2, duration: 18 },
  },
  iron: {
    id: 'iron',
    name: 'Heurtoir minier',
    description: 'Octroie 50 fer et 20 outils.',
    cooldown: 100,
    effect: { kind: 'grant', resources: { iron: 50, tools: 20 } },
  },
  medieval: {
    id: 'medieval',
    name: 'Mobilisation generale',
    description: 'Octroie 150 nourriture et 30 or.',
    cooldown: 90,
    effect: { kind: 'grant', resources: { food: 150, gold: 30 } },
  },
  renaissance: {
    id: 'renaissance',
    name: 'Eclair de genie',
    description: 'Octroie 40 science immediatement.',
    cooldown: 110,
    effect: { kind: 'grant', resources: { science: 40 } },
  },
  industrial: {
    id: 'industrial',
    name: 'Chaine acceleree',
    description: 'Termine instantanement tous les chantiers en cours.',
    cooldown: 120,
    effect: { kind: 'complete_constructions' },
  },
  modern: {
    id: 'modern',
    name: 'Surproduction',
    description: 'Booste toute la production x2,5 pendant 30 s.',
    cooldown: 130,
    effect: { kind: 'production_buff', multiplier: 2.5, duration: 30 },
  },
  future: {
    id: 'future',
    name: 'Override quantique',
    description: 'Triple la production pendant 25 s.',
    cooldown: 100,
    effect: { kind: 'production_buff', multiplier: 3, duration: 25 },
  },
};

/** Competence active de l ere courante si debloquee. */
export function activeAgeAbility(state: {
  age: AgeId;
  unlockedAbilities: Partial<Record<AgeAbilityId, true>>;
}): AgeAbilityDef | null {
  if (!state.unlockedAbilities[state.age]) return null;
  return AGE_ABILITIES[state.age];
}

export function abilityThemeColor(abilityId: AgeAbilityId): number {
  return AGES[abilityId].themeColor;
}
