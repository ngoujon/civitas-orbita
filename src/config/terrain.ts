/**
 * Preparation du terrain avant construction (data-driven).
 *
 * Chaque secteur sauvage est soit couvert (a defricher) soit rocheux (a aplatir).
 * Le type est derive du secteur ; seul l'etat de preparation est en GameState.
 */

import type { ResourceAmounts } from './buildings';

export type TerrainKind = 'overgrown' | 'rocky';

export interface TerrainPrepDef {
  readonly id: TerrainKind;
  readonly name: string;
  readonly verb: string;
  readonly description: string;
  readonly time: number;
  readonly cost: ResourceAmounts;
  /** Ressources recoltees une fois le terrain prepare (science = experience de recherche). */
  readonly yields: ResourceAmounts;
}

export const TERRAIN_PREP: Readonly<Record<TerrainKind, TerrainPrepDef>> = {
  overgrown: {
    id: 'overgrown',
    name: 'Vegetation',
    verb: 'Defricher',
    description: 'Abattre arbres et broussailles pour degager le terrain, recuperer du bois et un peu de science.',
    time: 10,
    cost: { wood: 8 },
    yields: { wood: 15, food: 4, science: 3 },
  },
  rocky: {
    id: 'rocky',
    name: 'Roche',
    verb: 'Aplatir',
    description: 'Niveler la roche pour un sol constructible, extraire de la pierre et de l experience.',
    time: 14,
    cost: { stone: 10, wood: 4 },
    yields: { stone: 22, wood: 3, science: 5 },
  },
};
