/**
 * Parametrage des iles NPC (PNJ) autour de la carte du joueur.
 */

import type { AgeId } from './ages';
import type { ResourceAmounts } from './buildings';
import type { CivId } from './civilizations';

/** Nombre d'iles PNJ generees autour du village du joueur. */
export const NPC_ISLAND_COUNT = 6;

/** Rayon visuel / hit-test d'une ile PNJ (pixels-monde). */
export const NPC_ISLAND_RADIUS = 95;

/** Distance min/max du centre du monde pour placer les iles. */
export const NPC_ISLAND_MIN_DIST = 900;
export const NPC_ISLAND_MAX_DIST = 1600;

/** Duree d'une expedition de pillage (secondes, temps reel). */
export const EXPEDITION_BASE_DURATION = 45;

/** Recharge du butin apres pillage (secondes, temps reel). */
export const LOOT_RESPAWN_SECONDS = 300;

/** Noms de chefs PNJ (deterministe via seed). */
export const NPC_CHIEF_NAMES = [
  'Haldor',
  'Mei Lin',
  'Kael',
  'Bruna',
  'Tariq',
  'Yara',
  'Oleg',
  'Suki',
  'Ragnar',
  'Amara',
] as const;

/** Noms de villages PNJ. */
export const NPC_VILLAGE_NAMES = [
  'Port-Sable',
  'Rochenoire',
  'Brumeval',
  'Cime-Verte',
  'Lagune d Or',
  'Terra-Nova',
  'Croc-de-Fer',
  'Silence',
  'Amberyl',
  'Vent-Froid',
] as const;

/** Modeles de butin par tranche d'age. */
export const LOOT_TEMPLATES: readonly { maxAge: AgeId; loot: ResourceAmounts; weight: number }[] = [
  { maxAge: 'fire', loot: { food: 40, wood: 30 }, weight: 1 },
  { maxAge: 'stone', loot: { food: 50, wood: 40, stone: 35 }, weight: 1 },
  { maxAge: 'bronze', loot: { stone: 45, bronze: 25, tools: 15 }, weight: 1 },
  { maxAge: 'iron', loot: { iron: 30, tools: 20, gold: 15 }, weight: 1 },
  { maxAge: 'industrial', loot: { iron: 40, gold: 35, tools: 25, science: 20 }, weight: 1 },
];

/** Civilisations possibles pour les PNJ. */
export const NPC_CIV_POOL: readonly CivId[] = [
  'founders',
  'sylvans',
  'builders',
  'scholars',
  'agrarians',
  'merchants',
];
