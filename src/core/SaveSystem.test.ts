import { describe, it, expect } from 'vitest';
import { SAVE_VERSION, deserialize, serialize } from './SaveSystem';
import { createNewGame, ensureGameMetaState } from '@/game/GameState';

describe('SaveSystem', () => {
  it('serialise et restaure une partie', () => {
    const original = createNewGame('founders', { chiefName: 'Test', villageName: 'Ville' });
    original.resources.wood = 42;
    const json = serialize(original);
    const loaded = deserialize(json);
    expect(loaded.resources.wood).toBe(42);
    expect(loaded.chiefName).toBe('Test');
  });

  it('inclut la version dans l enveloppe', () => {
    const json = serialize(createNewGame());
    const parsed = JSON.parse(json) as { version: number };
    expect(parsed.version).toBe(SAVE_VERSION);
  });

  it('migre les champs meta manquants', () => {
    const bare = createNewGame();
    delete (bare.population as { happiness?: number }).happiness;
    delete (bare as { military?: unknown }).military;
    ensureGameMetaState(bare);
    expect(bare.population.happiness).toBeDefined();
    expect(bare.military).toBeDefined();
  });
});
