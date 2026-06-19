/**
 * Definition des ressources du jeu (data-driven).
 *
 * Ajouter une ressource = ajouter une entree ici. Aucun code moteur a toucher.
 */

import type { AgeId } from './ages';

/** Identifiants stables de ressources. Etendre au fil des ages. */
export type ResourceId =
  | 'food'
  | 'wood'
  | 'stone'
  | 'bronze'
  | 'iron'
  | 'gold'
  | 'tools'
  | 'science';

export interface ResourceDef {
  readonly id: ResourceId;
  readonly name: string;
  readonly color: number;
  /** Ordre d'affichage dans le HUD. */
  readonly order: number;
  /** Age a partir duquel la ressource apparait dans l'UI. */
  readonly unlockedAtAge: AgeId;
  /** Stock initial accorde au demarrage d'une nouvelle partie. */
  readonly startAmount: number;
  /** Capacite de stockage de base (avant entrepots). */
  readonly baseCapacity: number;
}

export const RESOURCES: Readonly<Record<ResourceId, ResourceDef>> = {
  food: {
    id: 'food',
    name: 'Nourriture',
    color: 0xe85d4a,
    order: 0,
    unlockedAtAge: 'fire',
    startAmount: 50,
    baseCapacity: 200,
  },
  wood: {
    id: 'wood',
    name: 'Bois',
    color: 0xc77b3b,
    order: 1,
    unlockedAtAge: 'fire',
    startAmount: 40,
    baseCapacity: 200,
  },
  stone: {
    id: 'stone',
    name: 'Pierre',
    color: 0x9badb7,
    order: 2,
    unlockedAtAge: 'fire',
    startAmount: 20,
    baseCapacity: 200,
  },
  tools: {
    id: 'tools',
    name: 'Outils',
    color: 0xd8c84a,
    order: 3,
    unlockedAtAge: 'bronze',
    startAmount: 0,
    baseCapacity: 100,
  },
  bronze: {
    id: 'bronze',
    name: 'Bronze',
    color: 0xb87333,
    order: 4,
    unlockedAtAge: 'bronze',
    startAmount: 0,
    baseCapacity: 100,
  },
  iron: {
    id: 'iron',
    name: 'Fer',
    color: 0xb0b0c0,
    order: 5,
    unlockedAtAge: 'iron',
    startAmount: 0,
    baseCapacity: 100,
  },
  gold: {
    id: 'gold',
    name: 'Or',
    color: 0xf5c542,
    order: 6,
    unlockedAtAge: 'medieval',
    startAmount: 0,
    baseCapacity: 100,
  },
  science: {
    id: 'science',
    name: 'Science',
    color: 0x4ab0e8,
    order: 7,
    unlockedAtAge: 'fire',
    startAmount: 0,
    baseCapacity: 9_999_999,
  },
};

/** Liste triee pour l'UI. */
export const RESOURCE_LIST: readonly ResourceDef[] = Object.values(RESOURCES).sort(
  (a, b) => a.order - b.order,
);

/** Cree un enregistrement de stocks initialise a 0 pour toutes les ressources. */
export function emptyResourceRecord(): Record<ResourceId, number> {
  const rec = {} as Record<ResourceId, number>;
  for (const id of Object.keys(RESOURCES) as ResourceId[]) rec[id] = 0;
  return rec;
}
