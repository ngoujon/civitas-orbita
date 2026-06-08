/**
 * Point d'entree de Civitas Orbita.
 *
 * Cree le jeu, initialise le rendu PixiJS, monte le HUD, et charge
 * automatiquement une sauvegarde existante le cas echeant.
 */

import './ui/styles.css';
import { Game } from '@/game/Game';
import { HUD } from '@/ui/HUD';
import { StartScreen } from '@/ui/StartScreen';
import { SoundSystem } from '@/audio/SoundSystem';

async function bootstrap(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  const hudMount = document.getElementById('hud');
  const app = document.getElementById('app');
  if (!canvas || !hudMount || !app) {
    throw new Error('Elements DOM #app, #game-canvas ou #hud introuvables.');
  }

  const game = new Game();
  await game.init(canvas);

  // SFX procedural : branche les sons sur les evenements et les clics d'UI.
  const sound = new SoundSystem();
  sound.bindBus(game.bus);
  sound.attachUiClicks(document);

  new HUD(game, hudMount, sound);

  // Ecran d'accueil : creation de partie / reprise. Affiche au demarrage.
  const startScreen = new StartScreen(game, app);
  startScreen.show();

  // Sauvegarde automatique periodique (toutes les 60 s).
  window.setInterval(() => game.save(), 60_000);

  // Expose pour le debug en console.
  (window as unknown as { game: Game }).game = game;
}

bootstrap().catch((err) => {
  console.error('Echec du demarrage :', err);
});
