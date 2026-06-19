/**
 * Evenements aleatoires periodiques.
 */

import { ageAtLeast } from '@/config/ages';
import {
  RANDOM_EVENT_CHANCE_PER_TICK,
  RANDOM_EVENT_COOLDOWN,
  RANDOM_EVENTS,
  type RandomEventEffect,
} from '@/config/events';
import { credit, withdraw } from '@/economy/ResourceManager';
import { HAPPINESS } from '@/config/happiness';
import type { GameState } from '@/game/GameState';

export class RandomEventSystem {
  update(state: GameState, dt: number): { title: string; message: string } | null {
    const ev = state.randomEvents;

    if (ev.active) {
      ev.active.remaining -= dt;
      if (ev.active.remaining <= 0) {
        ev.active = null;
      }
      return null;
    }

    ev.cooldown = Math.max(0, ev.cooldown - dt);
    if (ev.cooldown > 0) return null;
    if (Math.random() > RANDOM_EVENT_CHANCE_PER_TICK) return null;

    const pool = RANDOM_EVENTS.filter(
      (e) => !e.minAge || ageAtLeast(state.age, e.minAge),
    );
    if (pool.length === 0) return null;

    const totalWeight = pool.reduce((s, e) => s + e.weight, 0);
    let roll = Math.random() * totalWeight;
    let picked = pool[0]!;
    for (const e of pool) {
      roll -= e.weight;
      if (roll <= 0) {
        picked = e;
        break;
      }
    }

    applyEffects(state, picked.effects);
    if (picked.duration > 0) {
      ev.active = { id: picked.id, remaining: picked.duration };
    }
    ev.cooldown = RANDOM_EVENT_COOLDOWN;

    return { title: picked.title, message: picked.message };
  }
}

function applyEffects(state: GameState, effects: RandomEventEffect[]): void {
  for (const fx of effects) {
    switch (fx.type) {
      case 'food_delta':
        if (fx.amount >= 0) credit(state, 'food', fx.amount);
        else withdraw(state, 'food', -fx.amount);
        break;
      case 'resource_delta':
        if (fx.amount >= 0) credit(state, fx.resource, fx.amount);
        else withdraw(state, fx.resource, -fx.amount);
        break;
      case 'happiness_delta':
        state.population.happiness = clamp(
          state.population.happiness + fx.amount,
          HAPPINESS.min,
          HAPPINESS.max,
        );
        break;
      case 'spawn_raid':
        if (!state.military.activeRaid) {
          state.military.activeRaid = { strength: fx.strength * 10, progress: 0 };
        }
        break;
    }
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
