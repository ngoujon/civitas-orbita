/**
 * Definition des ages et de leur progression (data-driven).
 *
 * Chaque age debloque des batiments/ressources et possede un cout de recherche
 * (en science) ainsi que d'eventuels prerequis (population, etc.).
 */

export type AgeId =
  | 'fire'
  | 'stone'
  | 'bronze'
  | 'iron'
  | 'medieval'
  | 'renaissance'
  | 'industrial'
  | 'modern'
  | 'future';

export interface AgeDef {
  readonly id: AgeId;
  readonly name: string;
  /** Index ordinal (0 = age du Feu). */
  readonly order: number;
  /** Couleur d'ambiance (UI, herbe, lumiere). */
  readonly themeColor: number;
  /** Cout en science pour debloquer cet age (0 pour l'age de depart). */
  readonly scienceCost: number;
  /** Population minimale requise pour pouvoir rechercher cet age. */
  readonly requiredPopulation: number;
}

/** Ordre canonique des ages. */
export const AGE_ORDER: readonly AgeId[] = [
  'fire',
  'stone',
  'bronze',
  'iron',
  'medieval',
  'renaissance',
  'industrial',
  'modern',
  'future',
];

export const AGES: Readonly<Record<AgeId, AgeDef>> = {
  fire: { id: 'fire', name: 'Age du Feu', order: 0, themeColor: 0xff9a1f, scienceCost: 0, requiredPopulation: 0 },
  stone: { id: 'stone', name: 'Age de Pierre', order: 1, themeColor: 0x9badb7, scienceCost: 50, requiredPopulation: 5 },
  bronze: { id: 'bronze', name: 'Age du Bronze', order: 2, themeColor: 0xb87333, scienceCost: 150, requiredPopulation: 12 },
  iron: { id: 'iron', name: 'Age du Fer', order: 3, themeColor: 0xb0b0c0, scienceCost: 350, requiredPopulation: 25 },
  medieval: { id: 'medieval', name: 'Moyen Age', order: 4, themeColor: 0x7a5230, scienceCost: 700, requiredPopulation: 45 },
  renaissance: { id: 'renaissance', name: 'Renaissance', order: 5, themeColor: 0xa8743b, scienceCost: 1400, requiredPopulation: 75 },
  industrial: { id: 'industrial', name: 'Revolution Industrielle', order: 6, themeColor: 0x6b6b6b, scienceCost: 2800, requiredPopulation: 120 },
  modern: { id: 'modern', name: 'Ere Moderne', order: 7, themeColor: 0x4ab0e8, scienceCost: 5600, requiredPopulation: 200 },
  future: { id: 'future', name: 'Futur', order: 8, themeColor: 0x9a4ae8, scienceCost: 11200, requiredPopulation: 350 },
};

/** Age de depart d'une nouvelle partie. */
export const STARTING_AGE: AgeId = 'fire';

/** Renvoie l'age suivant, ou null si c'est le dernier. */
export function nextAge(current: AgeId): AgeId | null {
  const idx = AGES[current].order;
  return AGE_ORDER[idx + 1] ?? null;
}

/** Vrai si `a` est atteint ou depasse par `b` (b >= a dans l'ordre). */
export function ageAtLeast(current: AgeId, required: AgeId): boolean {
  return AGES[current].order >= AGES[required].order;
}
