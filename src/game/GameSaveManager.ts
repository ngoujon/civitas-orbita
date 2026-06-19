/**
 * Orchestration des sauvegardes : cloud API + fallback localStorage.
 */

import { api } from '@/api';
import { SAVE_VERSION, deserialize, serialize } from '@/core/SaveSystem';
import type { GameState } from './GameState';

const LOCAL_KEY_PREFIX = 'civitas-orbita:save:';

export interface SaveLoadResult {
  state: GameState;
  source: 'cloud' | 'local';
}

export class GameSaveManager {
  private saveTimer: number | null = null;
  private pendingSave: Promise<void> | null = null;
  private dirty = false;

  constructor(private readonly userId: number) {}

  private localKey(): string {
    return `${LOCAL_KEY_PREFIX}${this.userId}`;
  }

  /** Charge depuis le cloud, sinon localStorage. */
  async load(): Promise<SaveLoadResult | null> {
    try {
      const { save } = await api.loadSave();
      const state = deserialize(save.stateJson);
      this.writeLocal(save.stateJson);
      return { state, source: 'cloud' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('404') && !msg.includes('Aucune sauvegarde')) {
        console.warn('[Save] Cloud indisponible, tentative locale.', err);
      }
    }

    const local = localStorage.getItem(this.localKey());
    if (!local) return null;

    try {
      return { state: deserialize(local), source: 'local' };
    } catch (err) {
      console.error('[Save] Sauvegarde locale corrompue.', err);
      return null;
    }
  }

  markDirty(): void {
    this.dirty = true;
  }

  /** Sauvegarde immediate (debounce bypass). */
  async saveNow(state: GameState): Promise<void> {
    if (this.pendingSave) await this.pendingSave;
    this.pendingSave = this.doSave(state);
    await this.pendingSave;
    this.pendingSave = null;
  }

  private async doSave(state: GameState): Promise<void> {
    const json = serialize(state);
    this.writeLocal(json);
    try {
      await api.saveSave(json, SAVE_VERSION);
      this.dirty = false;
    } catch (err) {
      console.warn('[Save] Echec cloud, sauvegarde locale conservee.', err);
    }
  }

  private writeLocal(json: string): void {
    try {
      localStorage.setItem(this.localKey(), json);
    } catch {
      // Quota depasse — ignorer silencieusement.
    }
  }

  /** Sync locale vers cloud si des changements non synchronises. */
  async syncLocalToCloud(): Promise<void> {
    if (!this.dirty) return;
    const local = localStorage.getItem(this.localKey());
    if (!local) return;
    try {
      await api.saveSave(local, SAVE_VERSION);
      this.dirty = false;
    } catch {
      // Retry au prochain cycle.
    }
  }

  async deleteSave(): Promise<void> {
    localStorage.removeItem(this.localKey());
    try {
      await api.deleteSave();
    } catch {
      // Ignore si pas de save cloud.
    }
  }

  startAutoSave(getState: () => GameState, intervalMs = 45_000): void {
    this.stopAutoSave();
    this.saveTimer = window.setInterval(() => {
      if (!this.dirty) return;
      void this.saveNow(getState());
    }, intervalMs);

    window.addEventListener('beforeunload', this.onBeforeUnload);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  stopAutoSave(): void {
    if (this.saveTimer !== null) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  private onBeforeUnload = (): void => {
    // La sauvegarde locale est ecrite a chaque saveNow ; pas de sendBeacon (auth JWT).
  };

  private onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden' && this.dirty) {
      // Best-effort : la sauvegarde locale est deja ecrite dans saveNow.
    }
  };

  static isValidSave(raw: string): boolean {
    try {
      deserialize(raw);
      return true;
    } catch {
      return false;
    }
  }
}
