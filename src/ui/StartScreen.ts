/**
 * StartScreen : ecran d'accueil en jeu (entree / nouvelle ere).
 *
 * Charge la sauvegarde cloud ou locale au premier entree ; « Nouvelle ere »
 * demande confirmation et efface la progression.
 */

import { getCivDef } from '@/config/civilizations';
import type { CivId } from '@/config/civilizations';
import type { CharacterProfile } from '@/api';
import type { Game } from '@/game/Game';
import type { GameSaveManager } from '@/game/GameSaveManager';
import { el } from '@/web/helpers';

export class StartScreen {
  private root: HTMLElement;
  private sessionStarted = false;
  private hasSave = false;

  constructor(
    private readonly game: Game,
    mount: HTMLElement,
    private readonly profile: CharacterProfile,
    private readonly saveManager: GameSaveManager,
  ) {
    this.root = el('div', 'start-screen');
    mount.append(this.root);
    this.build(false);
    void this.checkSave();
    this.game.bus.on('menu:open', () => this.show());
  }

  private async checkSave(): Promise<void> {
    const loaded = await this.saveManager.load();
    this.hasSave = loaded !== null;
    this.build(this.hasSave);
  }

  private build(hasSave: boolean): void {
    this.root.innerHTML = '';
    const panel = el('div', 'start-panel');

    const civ = getCivDef(this.profile.civId as CivId);

    const title = el('h1', 'start-title', this.profile.villageName.toUpperCase());
    const subtitle = el('p', 'start-subtitle');
    subtitle.textContent = `Chef ${this.profile.chiefName} — ${civ.name}`;

    const desc = el('p', 'start-welcome-text');
    desc.textContent = hasSave
      ? 'Votre village vous attend. Reprenez la session en cours ou fondez une nouvelle ere.'
      : 'Fondez votre village et commencez l aventure.';

    const actions = el('div', 'start-actions');

    const enterBtn = document.createElement('button');
    enterBtn.className = 'start-btn secondary';
    enterBtn.textContent = hasSave ? 'Reprendre la session' : 'Entrer dans le village';
    enterBtn.onclick = () => void this.onEnter();

    const newEraBtn = document.createElement('button');
    newEraBtn.className = 'start-btn primary';
    newEraBtn.textContent = 'Nouvelle ere';
    newEraBtn.onclick = () => void this.onNewEra();

    actions.append(enterBtn, newEraBtn);
    panel.append(title, subtitle, desc, actions);
    this.root.append(panel);
  }

  private async onEnter(): Promise<void> {
    if (!this.sessionStarted) {
      if (this.hasSave) {
        const loaded = await this.saveManager.load();
        if (loaded) {
          this.game.loadSavedState(loaded.state);
        } else {
          this.startFresh();
        }
      } else {
        this.startFresh();
      }
      this.sessionStarted = true;
    }
    this.hide();
  }

  private startFresh(): void {
    this.game.startNewGame(this.profile.civId as CivId, {
      chiefName: this.profile.chiefName,
      villageName: this.profile.villageName,
    });
  }

  private async onNewEra(): Promise<void> {
    if (this.hasSave || this.sessionStarted) {
      const ok = window.confirm(
        'Fonder une nouvelle ere efface votre progression actuelle. Continuer ?',
      );
      if (!ok) return;
      await this.saveManager.deleteSave();
    }
    this.hasSave = false;
    this.startFresh();
    this.sessionStarted = true;
    this.hide();
  }

  show(): void {
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
  }
}
