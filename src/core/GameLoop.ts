/**
 * Boucle de jeu basee sur requestAnimationFrame.
 *
 * Appelle `onUpdate(realDt)` chaque frame (pour la simulation a pas fixe gere
 * en aval par TimeManager) puis `onRender(alpha)` pour le rendu interpole.
 * Mesure le FPS pour le suivi de performance.
 */

export interface GameLoopCallbacks {
  /** Mise a jour logique. realDt en secondes (temps reel ecoule). */
  onUpdate: (realDt: number) => void;
  /** Rendu. alpha = facteur d'interpolation [0..1]. */
  onRender: (alpha: number) => void;
}

export class GameLoop {
  private rafId = 0;
  private running = false;
  private lastTime = 0;
  private getAlpha: () => number = () => 0;

  // Mesure FPS (moyenne glissante).
  private fps = 0;
  private frameAccum = 0;
  private frameCount = 0;

  constructor(private readonly callbacks: GameLoopCallbacks) {}

  /** Fournit la source du facteur d'interpolation (ex: TimeManager.interpolation). */
  setAlphaSource(fn: () => number): void {
    this.getAlpha = fn;
  }

  get currentFps(): number {
    return this.fps;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private tick = (now: number): void => {
    if (!this.running) return;

    // Clamp du delta pour absorber les pertes de focus / longues frames.
    const realDt = Math.min((now - this.lastTime) / 1000, 0.25);
    this.lastTime = now;

    this.callbacks.onUpdate(realDt);
    this.callbacks.onRender(this.getAlpha());

    this.updateFps(realDt);
    this.rafId = requestAnimationFrame(this.tick);
  };

  private updateFps(realDt: number): void {
    this.frameAccum += realDt;
    this.frameCount++;
    if (this.frameAccum >= 0.5) {
      this.fps = Math.round(this.frameCount / this.frameAccum);
      this.frameAccum = 0;
      this.frameCount = 0;
    }
  }
}
