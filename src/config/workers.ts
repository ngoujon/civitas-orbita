/**
 * Secteurs economiques pour la repartition manuelle de la main-d'oeuvre.
 *
 * Seules les categories de batiments avec emplois sont concernées.
 */

import type { BuildingCategory } from './buildings';
import { BUILDING_CATEGORY_LABELS } from './buildings';

export type WorkerSector = 'production' | 'trade' | 'research' | 'military';

export const WORKER_SECTOR_ORDER: readonly WorkerSector[] = [
  'production',
  'trade',
  'research',
  'military',
];

export const WORKER_SECTOR_LABELS: Record<WorkerSector, string> = {
  production: BUILDING_CATEGORY_LABELS.production,
  trade: BUILDING_CATEGORY_LABELS.trade,
  research: BUILDING_CATEGORY_LABELS.research,
  military: BUILDING_CATEGORY_LABELS.military,
};

const WORKER_SECTOR_SET = new Set<string>(WORKER_SECTOR_ORDER);

export function isWorkerSector(category: BuildingCategory): category is WorkerSector {
  return WORKER_SECTOR_SET.has(category);
}

/** Repartition par defaut lorsque le joueur active le mode manuel. */
export const DEFAULT_WORKER_SECTOR_SHARE: Readonly<Record<WorkerSector, number>> = {
  production: 60,
  trade: 10,
  research: 25,
  military: 5,
};

export function cloneDefaultWorkerShares(): Record<WorkerSector, number> {
  return { ...DEFAULT_WORKER_SECTOR_SHARE };
}
