/**
 * Objectifs de progression par etapes de jeu.
 */

import type { AgeId } from './ages';
import type { BuildingId } from './buildings';

export type ObjectiveId =
  | 'first_farm'
  | 'pop_10'
  | 'reach_bronze'
  | 'explore_sea'
  | 'raid_island'
  | 'reach_medieval';

export interface ObjectiveDef {
  id: ObjectiveId;
  title: string;
  description: string;
  reward: { science?: number; gold?: number; food?: number };
  check: ObjectiveCheck;
}

export type ObjectiveCheck =
  | { type: 'building_count'; building: BuildingId; min: number }
  | { type: 'population'; min: number }
  | { type: 'age'; age: AgeId }
  | { type: 'explored_cells'; min: number }
  | { type: 'expeditions_completed'; min: number };

export const OBJECTIVES: ObjectiveDef[] = [
  {
    id: 'first_farm',
    title: 'Premiere recolte',
    description: 'Construire une ferme operationnelle.',
    reward: { food: 50 },
    check: { type: 'building_count', building: 'farm', min: 1 },
  },
  {
    id: 'pop_10',
    title: 'Village prospere',
    description: 'Atteindre 10 habitants.',
    reward: { science: 15 },
    check: { type: 'population', min: 10 },
  },
  {
    id: 'reach_bronze',
    title: 'Age du bronze',
    description: 'Faire evoluer votre civilisation vers l age du bronze.',
    reward: { gold: 20 },
    check: { type: 'age', age: 'bronze' },
  },
  {
    id: 'explore_sea',
    title: 'Horizons lointains',
    description: 'Explorer au moins 50 cellules de mer.',
    reward: { science: 25 },
    check: { type: 'explored_cells', min: 50 },
  },
  {
    id: 'raid_island',
    title: 'Premier raid',
    description: 'Mener une expedition reussie vers une ile PNJ.',
    reward: { gold: 30 },
    check: { type: 'expeditions_completed', min: 1 },
  },
  {
    id: 'reach_medieval',
    title: 'Ere medievale',
    description: 'Atteindre l age medieval.',
    reward: { science: 50, gold: 40 },
    check: { type: 'age', age: 'medieval' },
  },
];

/** Ordre de deblocage des objectifs. */
export const OBJECTIVE_ORDER: ObjectiveId[] = [
  'first_farm',
  'pop_10',
  'reach_bronze',
  'explore_sea',
  'raid_island',
  'reach_medieval',
];
