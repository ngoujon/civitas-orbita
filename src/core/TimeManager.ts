/**
 * Gestion du temps de simulation.
 *
 * Accumulateur a pas fixe : decouple la logique (deterministe, pas fixe)
 * du rendu (variable, 60 FPS). Gere la vitesse du jeu et la pause.
 */

import { DEFAULT_SPEED, GAME_SPEEDS, MAX_TICKS_PER_FRAME, TICK_SECONDS } from '@/config/game';
import type { GameSpeed } from '@/config/game';

export class TimeManager {
  /** Vitesse courante (0 = pause). */
  private speed: GameSpeed = DEFAULT_SPEED;
  /** Temps de simulation accumule non encore consomme (en secondes). */
  private accumulator = 0;
  /** Nombre total de ticks logiques ecoules depuis le debut de la partie. */
  private totalTicks = 0;

  get currentSpeed(): GameSpeed {
    return this.speed;
  }

  get tickCount(): number {
    return this.totalTicks;
  }

  get isPaused(): boolean {
    return this.speed === 0;
  }

  setSpeed(speed: GameSpeed): void {
    this.speed = speed;
  }

  /** Passe a la vitesse suivante dans GAME_SPEEDS (cycle hors pause). */
  cycleSpeed(): GameSpeed {
    const playable = GAME_SPEEDS.filter((s) => s !== 0);
    const idx = playable.indexOf(this.speed as Exclude<GameSpeed, 0>);
    const next = playable[(idx + 1) % playable.length] ?? DEFAULT_SPEED;
    this.speed = next;
    return next;
  }

  togglePause(): void {
    this.speed = this.speed === 0 ? DEFAULT_SPEED : 0;
  }

  /**
   * Avance le temps reel ecoule. Renvoie le nombre de ticks logiques a executer.
   * Borne par MAX_TICKS_PER_FRAME pour eviter la spirale de la mort.
   */
  advance(realDeltaSeconds: number): number {
    if (this.speed === 0) return 0;

    this.accumulator += realDeltaSeconds * this.speed;
    let ticks = 0;
    while (this.accumulator >= TICK_SECONDS && ticks < MAX_TICKS_PER_FRAME) {
      this.accumulator -= TICK_SECONDS;
      ticks++;
      this.totalTicks++;
    }
    // Si on a atteint la borne, on jette le surplus pour rester reactif.
    if (ticks >= MAX_TICKS_PER_FRAME) this.accumulator = 0;
    return ticks;
  }

  /** Facteur d'interpolation [0..1] pour lisser le rendu entre deux ticks. */
  get interpolation(): number {
    return this.accumulator / TICK_SECONDS;
  }

  /** Restaure le compteur de ticks (chargement de sauvegarde). */
  restore(totalTicks: number): void {
    this.totalTicks = totalTicks;
    this.accumulator = 0;
  }
}
