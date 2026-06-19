/**
 * Repartition des travailleurs par secteur economique.
 *
 * Mode auto : remplissage greedy par id de batiment (comportement historique).
 * Mode manuel : quotas par secteur selon les pourcentages du joueur.
 */

import { BUILDINGS } from '@/config/buildings';
import {
  DEFAULT_WORKER_SECTOR_SHARE,
  isWorkerSector,
  WORKER_SECTOR_LABELS,
  WORKER_SECTOR_ORDER,
  type WorkerSector,
} from '@/config/workers';
import type { BuildingInstance } from '@/buildings/BuildingInstance';
import type { GameState } from '@/game/GameState';

export interface WorkerSectorStats {
  readonly sector: WorkerSector;
  readonly label: string;
  readonly sharePct: number;
  readonly jobSlots: number;
  readonly workers: number;
  readonly buildingCount: number;
}

function jobBuildingsBySector(state: GameState): Map<WorkerSector, BuildingInstance[]> {
  const groups = new Map<WorkerSector, BuildingInstance[]>();
  for (const sector of WORKER_SECTOR_ORDER) {
    groups.set(sector, []);
  }

  for (const b of Object.values(state.buildings)) {
    if (!b.complete) continue;
    const def = BUILDINGS[b.def];
    if (!def.jobs || def.jobs <= 0) continue;
    if (!isWorkerSector(def.category)) continue;
    groups.get(def.category)!.push(b);
  }

  for (const list of groups.values()) {
    list.sort((a, b) => a.id.localeCompare(b.id));
  }
  return groups;
}

function sectorJobSlots(buildings: readonly BuildingInstance[]): number {
  let total = 0;
  for (const b of buildings) {
    total += BUILDINGS[b.def].jobs ?? 0;
  }
  return total;
}

function fillSectorBuildings(buildings: readonly BuildingInstance[], quota: number): number {
  let remaining = quota;
  let placed = 0;
  for (const b of buildings) {
    const jobs = BUILDINGS[b.def].jobs ?? 0;
    const take = Math.max(0, Math.min(jobs, remaining));
    b.workers = take;
    placed += take;
    remaining -= take;
  }
  return placed;
}

function assignWorkersAuto(state: GameState): void {
  const available = Math.floor(state.population.count);
  let remaining = available;

  const jobBuildings = Object.values(state.buildings)
    .filter((b) => b.complete && (BUILDINGS[b.def].jobs ?? 0) > 0)
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const b of jobBuildings) {
    const jobs = BUILDINGS[b.def].jobs ?? 0;
    const take = Math.max(0, Math.min(jobs, remaining));
    b.workers = take;
    remaining -= take;
  }

  state.population.assigned = available - remaining;
}

function assignWorkersManual(state: GameState): void {
  const available = Math.floor(state.population.count);
  const shares = normalizeWorkerShares(state.population.workerSectorShare);
  state.population.workerSectorShare = shares;

  const groups = jobBuildingsBySector(state);

  for (const b of Object.values(state.buildings)) {
    if (!b.complete) continue;
    if ((BUILDINGS[b.def].jobs ?? 0) > 0) b.workers = 0;
  }

  const targets = new Map<WorkerSector, number>();
  let allocatedTarget = 0;
  for (let i = 0; i < WORKER_SECTOR_ORDER.length; i++) {
    const sector = WORKER_SECTOR_ORDER[i]!;
    const isLast = i === WORKER_SECTOR_ORDER.length - 1;
    const target = isLast
      ? Math.max(0, available - allocatedTarget)
      : Math.round((available * shares[sector]) / 100);
    targets.set(sector, target);
    allocatedTarget += target;
  }

  let overflow = 0;
  for (const sector of WORKER_SECTOR_ORDER) {
    const cap = sectorJobSlots(groups.get(sector)!);
    const target = targets.get(sector)!;
    if (target > cap) {
      overflow += target - cap;
      targets.set(sector, cap);
    }
  }

  while (overflow > 0) {
    let distributed = false;
    for (const sector of WORKER_SECTOR_ORDER) {
      const cap = sectorJobSlots(groups.get(sector)!);
      const current = targets.get(sector)!;
      if (current >= cap) continue;
      const add = Math.min(overflow, cap - current);
      targets.set(sector, current + add);
      overflow -= add;
      distributed = true;
      if (overflow <= 0) break;
    }
    if (!distributed) break;
  }

  let assigned = 0;
  for (const sector of WORKER_SECTOR_ORDER) {
    assigned += fillSectorBuildings(groups.get(sector)!, targets.get(sector)!);
  }

  state.population.assigned = assigned;
}

/** Repartit les travailleurs selon le mode choisi par le joueur. */
export function assignWorkers(state: GameState): void {
  if (state.population.manualWorkerAllocation) {
    assignWorkersManual(state);
  } else {
    assignWorkersAuto(state);
  }
}

/** Stats par secteur pour l'UI de repartition. */
export function workerSectorStats(state: GameState): WorkerSectorStats[] {
  const shares = normalizeWorkerShares(state.population.workerSectorShare);
  const groups = jobBuildingsBySector(state);

  return WORKER_SECTOR_ORDER.map((sector) => {
    const buildings = groups.get(sector)!;
    let workers = 0;
    for (const b of buildings) workers += b.workers;
    return {
      sector,
      label: WORKER_SECTOR_LABELS[sector],
      sharePct: shares[sector],
      jobSlots: sectorJobSlots(buildings),
      workers,
      buildingCount: buildings.length,
    };
  });
}

/** Ajuste un pourcentage de secteur en reequilibrant les autres (somme = 100). */
export function adjustWorkerShare(
  shares: Record<WorkerSector, number>,
  changed: WorkerSector,
  newValue: number,
): Record<WorkerSector, number> {
  const next = { ...normalizeWorkerShares(shares) };
  const clamped = Math.max(0, Math.min(100, Math.round(newValue)));
  const delta = clamped - next[changed];
  next[changed] = clamped;

  if (delta === 0) return normalizeWorkerShares(next);

  const others = WORKER_SECTOR_ORDER.filter((s) => s !== changed);
  const othersSum = others.reduce((sum, s) => sum + next[s], 0);

  if (othersSum <= 0) {
    const perOther = Math.floor((100 - clamped) / others.length);
    for (let i = 0; i < others.length; i++) {
      const sector = others[i]!;
      next[sector] = i === others.length - 1 ? 100 - clamped - perOther * (others.length - 1) : perOther;
    }
    return normalizeWorkerShares(next);
  }

  for (const sector of others) {
    const weight = next[sector] / othersSum;
    next[sector] = Math.max(0, Math.round(next[sector] - delta * weight));
  }

  return normalizeWorkerShares(next);
}

/** Garantit des parts valides (0–100, somme = 100). */
export function normalizeWorkerShares(
  shares: Partial<Record<WorkerSector, number>> | undefined,
): Record<WorkerSector, number> {
  const base = { ...DEFAULT_WORKER_SECTOR_SHARE };
  if (shares) {
    for (const sector of WORKER_SECTOR_ORDER) {
      const v = shares[sector];
      if (typeof v === 'number' && Number.isFinite(v)) {
        base[sector] = Math.max(0, Math.min(100, Math.round(v)));
      }
    }
  }

  let total = WORKER_SECTOR_ORDER.reduce((sum, s) => sum + base[s], 0);
  if (total <= 0) return { ...DEFAULT_WORKER_SECTOR_SHARE };

  if (total !== 100) {
    for (const sector of WORKER_SECTOR_ORDER) {
      base[sector] = Math.round((base[sector] * 100) / total);
    }
    total = WORKER_SECTOR_ORDER.reduce((sum, s) => sum + base[s], 0);
    const drift = 100 - total;
    if (drift !== 0) {
      base.production = Math.max(0, base.production + drift);
    }
  }

  return base;
}

/** Assure la presence des champs de repartition sur un etat charge. */
export function ensureWorkerAllocationState(state: GameState): void {
  state.population.workerSectorShare = normalizeWorkerShares(state.population.workerSectorShare);
  if (state.population.manualWorkerAllocation === undefined) {
    state.population.manualWorkerAllocation = false;
  }
}
