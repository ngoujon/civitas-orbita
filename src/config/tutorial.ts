/**
 * Etapes du tutoriel guidant le nouveau joueur.
 */

import type { BuildingId } from './buildings';
import type { TechId } from './technologies';

export type TutorialStepId =
  | 'welcome'
  | 'build_farm'
  | 'build_hut'
  | 'prepare_terrain'
  | 'research_tech'
  | 'build_port'
  | 'complete';

export interface TutorialStepDef {
  id: TutorialStepId;
  title: string;
  message: string;
  /** Condition de validation automatique. */
  check: TutorialCheck;
}

export type TutorialCheck =
  | { type: 'always' }
  | { type: 'building_count'; building: BuildingId; min: number }
  | { type: 'prepared_sectors'; min: number }
  | { type: 'tech_researched'; tech: TechId }
  | { type: 'building_exists'; building: BuildingId };

export const TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    id: 'welcome',
    title: 'Bienvenue',
    message:
      'Fondez votre village autour du feu de camp. Commencez par nourrir et loger votre population.',
    check: { type: 'always' },
  },
  {
    id: 'build_farm',
    title: 'Agriculture',
    message: 'Construisez une Ferme sur l anneau 1 pour produire de la nourriture.',
    check: { type: 'building_count', building: 'farm', min: 1 },
  },
  {
    id: 'build_hut',
    title: 'Logement',
    message: 'Ajoutez une Hutte pour accueillir de nouveaux villageois.',
    check: { type: 'building_count', building: 'hut', min: 1 },
  },
  {
    id: 'prepare_terrain',
    title: 'Terrain',
    message: 'Defrichez ou aplatissez au moins 2 secteurs avant de construire dessus.',
    check: { type: 'prepared_sectors', min: 2 },
  },
  {
    id: 'research_tech',
    title: 'Technologie',
    message: 'Ouvrez l arbre de technologies (T) et recherchez une amelioration.',
    check: { type: 'tech_researched', tech: 'agriculture' },
  },
  {
    id: 'build_port',
    title: 'Mer',
    message: 'Construisez un Port sur la lisiere pour explorer la mer.',
    check: { type: 'building_exists', building: 'port' },
  },
  {
    id: 'complete',
    title: 'Bravo !',
    message: 'Vous maitrisez les bases. Explorez, progressez et etendez votre civilisation !',
    check: { type: 'always' },
  },
];
