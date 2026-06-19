/**
 * Demarrage du jeu (canvas PixiJS + HUD) apres authentification.
 */

import './ui/styles.css';
import type { CharacterProfile } from '@/api';
import { api } from '@/api';
import { getActiveWorldId } from '@/web/LobbyPage';
import { GameSyncClient } from '@/net/GameSyncClient';
import { Game } from '@/game/Game';
import { GameSaveManager } from '@/game/GameSaveManager';
import { HUD } from '@/ui/HUD';
import { StartScreen } from '@/ui/StartScreen';
import { TutorialOverlay } from '@/ui/TutorialOverlay';
import { SoundSystem } from '@/audio/SoundSystem';

export async function bootstrapGame(profile: CharacterProfile): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  const hudMount = document.getElementById('hud');
  const app = document.getElementById('app');
  if (!canvas || !hudMount || !app) {
    throw new Error('Elements DOM #app, #game-canvas ou #hud introuvables.');
  }

  const me = await api.me();
  const saveManager = new GameSaveManager(me.user.id);

  const game = new Game();
  game.setPlayerId(String(me.user.id));
  await game.init(canvas);

  const sound = new SoundSystem();
  sound.bindBus(game.bus);
  sound.attachUiClicks(document);
  sound.startAmbient();

  new HUD(game, hudMount, sound, profile);

  game.bus.on('state:changed', () => saveManager.markDirty());

  saveManager.startAutoSave(() => game.getState() as import('@/game/GameState').GameState);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void saveManager.saveNow(game.getState() as import('@/game/GameState').GameState);
    }
  });

  const startScreen = new StartScreen(game, app, profile, saveManager);
  startScreen.show();

  new TutorialOverlay(game, app);

  void saveManager.syncLocalToCloud();

  const worldId = getActiveWorldId();
  const token = api.getToken();
  if (worldId && token) {
    const sync = new GameSyncClient({
      onSnapshot: (state) => game.loadSavedState(state),
      onTick: () => {},
      onReject: (_seq, reason) => {
        game.bus.emit('notify', { message: `Commande rejetee : ${reason}`, kind: 'warn' });
      },
    });
    sync.connect(token, worldId);
  }

  (window as unknown as { game: Game }).game = game;
}
