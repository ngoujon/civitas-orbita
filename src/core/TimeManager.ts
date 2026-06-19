/**
 * Gestion du temps de simulation.
 *
 * Accumulateur a pas fixe : decouple la logique (deterministe, pas fixe)
 * du rendu (variable, 60 FPS). Supporte pause et multiplicateur de vitesse.
 */

import { MAX_TICKS_PER_FRAME, REALTIME_SPEED, TICK_SECONDS } from '@/config/game';

export type SpeedMultiplier = 0 | 1 | 2 | 3;

export class TimeManager {
  /** Temps de simulation accumule non encore consomme (en secondes). */
  private accumulator = 0;
  /** Nombre total de ticks logiques ecoules depuis le debut de la partie. */
  private totalTicks = 0;
  private paused = false;
  private speedMultiplier: SpeedMultiplier = 1;

  get tickCount(): number {
    return this.totalTicks;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get speed(): SpeedMultiplier {
    return this.speedMultiplier;
  }

  /** Met en pause ou reprend la simulation. */
  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  togglePause(): boolean {
    this.paused = !this.paused;
    return this.paused;
  }

  /** Change la vitesse (0 = pause implicite via setPaused). */
  setSpeed(multiplier: SpeedMultiplier): void {
    this.speedMultiplier = multiplier;
    if (multiplier === 0) {
      this.paused = true;
    } else {
      this.paused = false;
    }
  }

  /** Cycle 1x → 2x → 3x → 1x. */
  cycleSpeed(): SpeedMultiplier {
    const next: SpeedMultiplier =
      this.speedMultiplier === 1 ? 2 : this.speedMultiplier === 2 ? 3 : 1;
    this.setSpeed(next);
    return next;
  }

  /**
   * Avance le temps reel ecoule. Renvoie le nombre de ticks logiques a executer.
   * Borne par MAX_TICKS_PER_FRAME pour eviter la spirale de la mort.
   */
  advance(realDeltaSeconds: number): number {
    if (this.paused || this.speedMultiplier === 0) return 0;

    this.accumulator += realDeltaSeconds * REALTIME_SPEED * this.speedMultiplier;
    let ticks = 0;
    while (this.accumulator >= TICK_SECONDS && ticks < MAX_TICKS_PER_FRAME) {
      this.accumulator -= TICK_SECONDS;
      ticks++;
      this.totalTicks++;
    }
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
