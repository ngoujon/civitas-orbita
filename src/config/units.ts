/**
 * Unites militaires et equilibrage defense.
 */

export type UnitId = 'militia' | 'guard';

export interface UnitDef {
  id: UnitId;
  name: string;
  /** Puissance de combat par soldat. */
  power: number;
  /** Soldats entraineables par travailleur de caserne et par seconde. */
  trainRate: number;
  /** Cout d entrainement par soldat. */
  cost: { food: number; iron?: number; gold?: number };
}

export const UNITS: Record<UnitId, UnitDef> = {
  militia: {
    id: 'militia',
    name: 'Milice',
    power: 1,
    trainRate: 0.02,
    cost: { food: 5 },
  },
  guard: {
    id: 'guard',
    name: 'Garde',
    power: 3,
    trainRate: 0.01,
    cost: { food: 8, iron: 2 },
  },
};

export const MILITARY = {
  /** Soldats max par caserne operationnelle. */
  soldiersPerBarracks: 20,
  /** Bonus de defense quand bonheur > seuil. */
  happinessDefenseBonus: 0.2,
  happinessDefenseThreshold: 60,
} as const;
