/**
 * Parametres du bonheur de la population.
 */

export const HAPPINESS = {
  start: 70,
  min: 0,
  max: 100,
  /** Bonus croissance si bonheur eleve. */
  highGrowthThreshold: 75,
  highGrowthBonus: 1.25,
  /** Malus croissance si bonheur bas. */
  lowGrowthThreshold: 30,
  lowGrowthPenalty: 0.5,
  /** Gain par point de logement au-dela du minimum. */
  housingBonusPerCap: 0.02,
  /** Malus famine par seconde de famine. */
  starvationPenaltyPerSecond: 2,
  /** Bonus par marche operationnel. */
  marketBonus: 5,
  /** Bonus festival / evenements positifs deja geres ailleurs. */
} as const;

export type NpcRelation = 'hostile' | 'neutral' | 'allied';

export const DIPLOMACY = {
  /** Or requis pour passer en alliance. */
  allianceCost: 50,
  /** Tribut periodique (or) des allies. */
  tributeGold: 5,
  tributeInterval: 60,
  /** Bonus commerce avec allie. */
  alliedTradeBonus: 1.5,
} as const;
