/**
 * Panneau de reglages (volume, vitesse, deconnexion).
 */

import { api } from '@/api';
import type { Game } from '@/game/Game';
import type { SoundSystem } from '@/audio/SoundSystem';
import type { SpeedMultiplier } from '@/core/TimeManager';
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

    const speedRow = el('div', 'settings-row');
    const speedLabel = el('span', 'settings-label', 'Vitesse du jeu');
    const speedBtns = el('div', 'settings-speed-btns');
    for (const spd of [1, 2, 3] as SpeedMultiplier[]) {
      const btn = document.createElement('button');
      btn.className = 'settings-speed-btn';
      btn.textContent = `${spd}x`;
      btn.onclick = () => {
        this.game.setSpeed(spd);
        this.updateSpeedButtons(speedBtns, spd);
      };
      speedBtns.append(btn);
    }
    speedRow.append(speedLabel, speedBtns);

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

    this.root.append(title, volumeRow, speedRow, pauseBtn, logoutBtn, closeBtn);
    this.updateSpeedButtons(speedBtns, this.game.getSpeed());
  }

  private updateSpeedButtons(container: HTMLElement, active: SpeedMultiplier): void {
    for (const btn of container.querySelectorAll('.settings-speed-btn')) {
      const spd = Number((btn as HTMLButtonElement).textContent?.replace('x', '')) as SpeedMultiplier;
      btn.classList.toggle('active', spd === active && !this.game.isPaused());
    }
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
