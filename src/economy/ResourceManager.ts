/**
 * Gestion des stocks de ressources.
 *
 * Fonctions pures operant sur GameState : capacite, affordabilite, depense,
 * credit avec ecretage a la capacite. Pas d'etat propre.
 */

import { RESOURCES } from '@/config/resources';
import type { ResourceId } from '@/config/resources';
import type { ResourceAmounts } from '@/config/buildings';
import { BUILDINGS } from '@/config/buildings';
import { getCivModifiers } from '@/config/civilizations';
import type { GameState } from '@/game/GameState';

/** Recalcule les capacites de stockage a partir des batiments termines. */
export function recomputeCapacities(state: GameState): void {
  const cap = state.capacities;
  for (const id of Object.keys(RESOURCES) as ResourceId[]) {
    cap[id] = RESOURCES[id].baseCapacity;
  }
  for (const b of Object.values(state.buildings)) {
    if (!b.complete) continue;
    const storage = BUILDINGS[b.def].storage;
    if (!storage) continue;
    for (const [res, amount] of Object.entries(storage) as [ResourceId, number][]) {
      cap[res] += amount * b.level;
    }
  }
  // Bonus passif de stockage de la civilisation (la science reste illimitee).
  const storageMult = getCivModifiers(state.civ).storageMultiplier;
  if (storageMult !== 1) {
    for (const id of Object.keys(RESOURCES) as ResourceId[]) {
      if (id === 'science') continue;
      cap[id] = Math.round(cap[id] * storageMult);
    }
  }
}

/** Peut-on payer un cout donne ? */
export function canAfford(state: GameState, cost: ResourceAmounts): boolean {
  for (const [res, amount] of Object.entries(cost) as [ResourceId, number][]) {
    if (state.resources[res] < amount) return false;
  }
  return true;
}

/** Depense un cout (suppose canAfford verifie). Renvoie false si insuffisant. */
export function spend(state: GameState, cost: ResourceAmounts): boolean {
  if (!canAfford(state, cost)) return false;
  for (const [res, amount] of Object.entries(cost) as [ResourceId, number][]) {
    state.resources[res] -= amount;
  }
  return true;
}

/** Rembourse un cout (annulation de construction). */
export function refund(state: GameState, cost: ResourceAmounts): void {
  for (const [res, amount] of Object.entries(cost) as [ResourceId, number][]) {
    credit(state, res, amount);
  }
}

/** Credite une ressource en ecretant a la capacite. Renvoie la quantite reellement ajoutee. */
export function credit(state: GameState, res: ResourceId, amount: number): number {
  const cap = state.capacities[res];
  const before = state.resources[res];
  const after = Math.min(before + amount, cap);
  state.resources[res] = after;
  return after - before;
}

/** Retire une ressource sans descendre sous 0. Renvoie la quantite reellement retiree. */
export function withdraw(state: GameState, res: ResourceId, amount: number): number {
  const before = state.resources[res];
  const removed = Math.min(before, amount);
  state.resources[res] = before - removed;
  return removed;
}
