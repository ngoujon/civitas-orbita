/**
 * Overlay tutoriel : affiche l etape courante.
 */

import type { Game } from '@/game/Game';
import { el } from '@/web/helpers';

export class TutorialOverlay {
  private root: HTMLElement;
  private titleEl!: HTMLElement;
  private msgEl!: HTMLElement;

  constructor(
    private readonly game: Game,
    mount: HTMLElement,
  ) {
    this.root = el('div', 'tutorial-overlay');
    this.build();
    mount.append(this.root);

    this.game.bus.on('tutorial:step', ({ title, message }) => this.show(title, message));
    const current = this.game.getTutorialStep();
    if (current) this.show(current.title, current.message);
  }

  private build(): void {
    this.titleEl = el('div', 'tutorial-title');
    this.msgEl = el('div', 'tutorial-msg');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tutorial-dismiss';
    closeBtn.textContent = 'Compris';
    closeBtn.onclick = () => this.hide();
    this.root.append(this.titleEl, this.msgEl, closeBtn);
  }

  show(title: string, message: string): void {
    this.titleEl.textContent = title;
    this.msgEl.textContent = message;
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
  }
}
