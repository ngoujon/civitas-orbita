/**
 * StartScreen : ecran d'accueil / creation de partie.
 *
 * Permet de reprendre une partie sauvegardee ou de demarrer une nouvelle partie
 * en choisissant une civilisation (chacune ayant des bonus passifs + une
 * capacite active). Overlay DOM plein ecran au-dessus du canvas et du HUD.
 *
 * Embleme des civilisations : SVG genere par le code (zero asset externe).
 */

import { CIV_LIST } from '@/config/civilizations';
import type { CivDef, CivId, EmblemShape } from '@/config/civilizations';
import type { Game } from '@/game/Game';

export class StartScreen {
  private root: HTMLElement;
  private selected: CivId | null = null;
  private startBtn!: HTMLButtonElement;
  private cards = new Map<CivId, HTMLElement>();

  constructor(
    private readonly game: Game,
    mount: HTMLElement,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'start-screen';
    mount.append(this.root);
    this.build();
    this.game.bus.on('menu:open', () => this.show());
  }

  private build(): void {
    const panel = el('div', 'start-panel');

    const title = el('h1', 'start-title');
    title.textContent = 'CIVITAS ORBITA';
    const subtitle = el('p', 'start-subtitle');
    subtitle.textContent = 'Batissez votre civilisation en anneaux, du feu de camp jusqu au futur.';

    const sectionTitle = el('h2', 'start-section-title');
    sectionTitle.textContent = 'Choisissez votre civilisation';

    const grid = el('div', 'start-grid');
    for (const civ of CIV_LIST) {
      const card = this.buildCard(civ);
      grid.append(card);
      this.cards.set(civ.id, card);
    }

    const actions = el('div', 'start-actions');

    const continueBtn = document.createElement('button');
    continueBtn.className = 'start-btn secondary';
    continueBtn.textContent = 'Continuer la partie';
    continueBtn.onclick = () => this.onContinue();
    continueBtn.style.display = this.game.hasSave() ? '' : 'none';

    this.startBtn = document.createElement('button');
    this.startBtn.className = 'start-btn primary';
    this.startBtn.textContent = 'Commencer';
    this.startBtn.disabled = true;
    this.startBtn.onclick = () => this.onStart();

    actions.append(continueBtn, this.startBtn);
    panel.append(title, subtitle, sectionTitle, grid, actions);
    this.root.append(panel);
  }

  private buildCard(civ: CivDef): HTMLElement {
    const card = el('button', 'start-card');
    card.style.setProperty('--civ-color', colorToCss(civ.themeColor));

    const emblem = el('div', 'start-emblem');
    emblem.innerHTML = emblemSVG(civ.emblem, civ.themeColor);

    const name = el('div', 'start-card-name');
    name.textContent = civ.name;
    const tag = el('div', 'start-card-tag');
    tag.textContent = civ.tagline;

    const passive = el('div', 'start-bonus passive');
    passive.innerHTML = `<span class="start-bonus-label">Passif</span> ${civ.passiveSummary}`;

    const active = el('div', 'start-bonus active');
    active.innerHTML = `<span class="start-bonus-label">Actif</span> <b>${civ.ability.name}</b> — ${civ.ability.description}`;

    card.append(emblem, name, tag, passive, active);
    card.onclick = () => this.select(civ.id);
    return card;
  }

  private select(id: CivId): void {
    this.selected = id;
    for (const [civId, card] of this.cards) {
      card.classList.toggle('selected', civId === id);
    }
    this.startBtn.disabled = false;
  }

  private onStart(): void {
    if (!this.selected) return;
    this.game.startNewGame(this.selected);
    this.hide();
  }

  private onContinue(): void {
    if (this.game.continueGame()) this.hide();
  }

  show(): void {
    this.root.classList.remove('hidden');
    this.game.setSpeed(0); // pause pendant le menu
  }

  hide(): void {
    this.root.classList.add('hidden');
    this.game.setSpeed(1);
  }
}

// --- Helpers ----------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** Genere un embleme SVG procedural (forme blanche sur pastille coloree). */
function emblemSVG(shape: EmblemShape, color: number): string {
  const c = colorToCss(color);
  const shapes: Record<EmblemShape, string> = {
    flame:
      '<path d="M32 10 C40 22 48 26 44 40 C42 50 34 54 32 54 C30 54 22 50 20 40 C16 28 26 26 32 10 Z" fill="#fff"/>' +
      '<path d="M32 26 C36 32 38 36 36 42 C35 47 33 48 32 48 C31 48 28 46 27 42 C25 36 30 33 32 26 Z" fill="' + c + '"/>',
    leaf:
      '<path d="M16 48 C20 20 44 16 50 14 C48 40 28 48 16 48 Z" fill="#fff"/>' +
      '<path d="M18 46 C30 36 42 24 48 16" stroke="' + c + '" stroke-width="3" fill="none"/>',
    hammer:
      '<rect x="29" y="26" width="6" height="26" rx="2" fill="#fff"/>' +
      '<rect x="18" y="14" width="28" height="14" rx="3" fill="#fff"/>' +
      '<rect x="22" y="18" width="20" height="6" rx="2" fill="' + c + '"/>',
    book:
      '<rect x="14" y="16" width="36" height="30" rx="3" fill="#fff"/>' +
      '<rect x="30" y="16" width="4" height="30" fill="' + c + '"/>' +
      '<line x1="20" y1="24" x2="28" y2="24" stroke="' + c + '" stroke-width="2"/>' +
      '<line x1="36" y1="24" x2="44" y2="24" stroke="' + c + '" stroke-width="2"/>',
    wheat:
      '<rect x="30" y="20" width="4" height="32" fill="#fff"/>' +
      '<path d="M32 18 C26 22 26 28 32 30 C38 28 38 22 32 18 Z" fill="#fff"/>' +
      '<path d="M32 28 C24 30 22 36 28 40 L32 36 Z" fill="#fff"/>' +
      '<path d="M32 28 C40 30 42 36 36 40 L32 36 Z" fill="#fff"/>',
    coin:
      '<circle cx="32" cy="32" r="18" fill="#fff"/>' +
      '<circle cx="32" cy="32" r="11" fill="none" stroke="' + c + '" stroke-width="3"/>' +
      '<text x="32" y="38" font-size="14" font-weight="bold" text-anchor="middle" fill="' + c + '">$</text>',
  };
  return (
    `<svg viewBox="0 0 64 64" width="64" height="64" xmlns="http://www.w3.org/2000/svg">` +
    `<circle cx="32" cy="32" r="30" fill="${c}" opacity="0.9"/>` +
    `<circle cx="32" cy="32" r="30" fill="none" stroke="#00000033" stroke-width="2"/>` +
    shapes[shape] +
    `</svg>`
  );
}
