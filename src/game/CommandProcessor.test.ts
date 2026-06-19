import { describe, it, expect } from 'vitest';
import { CommandProcessor } from './CommandProcessor';
import { createNewGame } from './GameState';
import { WorldMap } from '@/world/WorldMap';

describe('CommandProcessor', () => {
  it('enqueue_build ajoute a la file', () => {
    const state = createNewGame();
    const map = new WorldMap(state.ringCount);
    const proc = new CommandProcessor();
    const result = proc.apply(state, map, { type: 'enqueue_build', building: 'farm' });
    expect(result.ok).toBe(true);
    expect(state.constructionQueue).toContain('farm');
  });

  it('rejette une file pleine', () => {
    const state = createNewGame();
    state.constructionQueue = ['farm', 'hut', 'farm', 'hut', 'farm'];
    const map = new WorldMap(state.ringCount);
    const proc = new CommandProcessor();
    const result = proc.apply(state, map, { type: 'enqueue_build', building: 'quarry' });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('queue_full');
  });
});
