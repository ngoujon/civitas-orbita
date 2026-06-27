/**
 * Evenements aleatoires pour dynamiser la partie solo.
 */

import type { ResourceId } from './resources';

export type RandomEventId = 'drought' | 'caravan' | 'npc_raid' | 'discovery' | 'festival';

export interface RandomEventDef {
  id: RandomEventId;
  title: string;
  message: string;
  /** Duree en secondes de jeu (0 = instantane). */
  duration: number;
  /** Poids relatif pour le tirage aleatoire. */
  weight: number;
  /** Age minimum requis. */
  minAge?: import('./ages').AgeId;
  effects: RandomEventEffect[];
}

export type RandomEventEffect =
  | { type: 'food_delta'; amount: number }
  | { type: 'resource_delta'; resource: ResourceId; amount: number }
  | { type: 'happiness_delta'; amount: number }
  | { type: 'spawn_raid'; strength: number };

export const RANDOM_EVENTS: RandomEventDef[] = [
  {
    id: 'drought',
    title: 'Secheresse',
    message: 'Les recoltes souffrent d un manque d eau. Production alimentaire reduite.',
    duration: 30,
    weight: 3,
    effects: [
      { type: 'food_delta', amount: -30 },
      { type: 'happiness_delta', amount: -10 },
    ],
  },
  {
    id: 'caravan',
    title: 'Caravane marchande',
    message: 'Des marchands échangent de l\'or contre vos surplus.',
    duration: 0,
    weight: 4,
    minAge: 'bronze',
    effects: [
      { type: 'resource_delta', resource: 'gold', amount: 25 },
      { type: 'food_delta', amount: -15 },
      { type: 'happiness_delta', amount: 5 },
    ],
  },
  {
    id: 'npc_raid',
    title: 'Raid voisin',
    message: 'Des pillards attaquent votre village ! La garnison doit defendre.',
    duration: 15,
    weight: 2,
    minAge: 'medieval',
    effects: [{ type: 'spawn_raid', strength: 1 }],
  },
  {
    id: 'discovery',
    title: 'Decouverte',
    message: 'Vos eclaireurs trouvent des ressources enfouies.',
    duration: 0,
    weight: 3,
    effects: [
      { type: 'resource_delta', resource: 'stone', amount: 40 },
      { type: 'resource_delta', resource: 'science', amount: 10 },
    ],
  },
  {
    id: 'festival',
    title: 'Festival du village',
    message: 'La population celebre — le moral est au beau fixe.',
    duration: 20,
    weight: 4,
    effects: [{ type: 'happiness_delta', amount: 15 }],
  },
];

/** Intervalle minimum entre deux evenements (secondes de jeu). */
export const RANDOM_EVENT_COOLDOWN = 120;

/** Chance par tick de declencher un evenement quand le cooldown est ecoule. */
export const RANDOM_EVENT_CHANCE_PER_TICK = 0.002;
