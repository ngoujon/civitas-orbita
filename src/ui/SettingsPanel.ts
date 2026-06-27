/**
 * Panneau de reglages (volume, vitesse, deconnexion).
 */

import { api } from '@/api';
import type { Game } from '@/game/Game';
import type { SoundSystem } from '@/audio/SoundSystem';
import { el } from '@/web/helpers';

export class SettingsPanel {
  private root: HTMLElement;
  private overlay: HTMLElement;
  private volumeSlider!: HTMLInputElement;
  private open = false;

  constructor(
    private readonly game: Game,
    mount: HTMLElement,
    private readonly sound?: SoundSystem,
  ) {
    this.overlay = el('div', 'settings-overlay hidden');
    this.root = el('div', 'settings-panel');
    this.build();
    this.overlay.append(this.root);
    mount.append(this.overlay);
  }

  private build(): void {
    const title = el('h2', 'settings-title', 'Reglages');

    const volumeRow = el('div', 'settings-row');
    const volumeLabel = el('label', 'settings-label');
    volumeLabel.textContent = 'Volume';
    this.volumeSlider = document.createElement('input');
    this.volumeSlider.type = 'range';
    this.volumeSlider.min = '0';
    this.volumeSlider.max = '100';
    this.volumeSlider.value = String(Math.round((this.sound?.masterVolume ?? 0.35) * 100));
    this.volumeSlider.className = 'settings-slider';
    this.volumeSlider.oninput = () => {
      const v = Number(this.volumeSlider.value) / 100;
      this.sound?.setMasterVolume(v);
    };
    volumeRow.append(volumeLabel, this.volumeSlider);

    const pauseBtn = document.createElement('button');
    pauseBtn.className = 'hud-btn settings-action';
    pauseBtn.textContent = 'Pause / Reprendre (Espace)';
    pauseBtn.onclick = () => this.game.togglePause();

    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'hud-btn settings-action settings-logout';
    logoutBtn.textContent = 'Se deconnecter';
    logoutBtn.onclick = () => {
      api.logout();
      window.location.href = '/';
    };

    const closeBtn = document.createElement('button');
    closeBtn.className = 'hud-btn settings-close';
    closeBtn.textContent = 'Fermer';
    closeBtn.onclick = () => this.close();

    this.root.append(title, volumeRow, pauseBtn, logoutBtn, closeBtn);
  }

  toggle(): void {
    if (this.open) this.close();
    else this.openPanel();
  }

  openPanel(): void {
    this.open = true;
    this.overlay.classList.remove('hidden');
  }

  close(): void {
    this.open = false;
    this.overlay.classList.add('hidden');
  }

  isOpen(): boolean {
    return this.open;
  }
}
