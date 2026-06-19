/**
 * Creation de personnage : chef de village, nom du village, civilisation.
 */

import { CIV_LIST } from '@/config/civilizations';
import type { CivDef, CivId } from '@/config/civilizations';
import { api } from '@/api';
import { navigate } from './router';
import { colorToCss, el, emblemSVG } from './helpers';

export class CharacterPage {
  private root: HTMLElement;
  private selected: CivId | null = null;
  private errorEl!: HTMLElement;
  private submitBtn!: HTMLButtonElement;
  private cards = new Map<CivId, HTMLElement>();

  constructor(mount: HTMLElement) {
    this.root = el('div', 'site-page character-page');
    mount.append(this.root);
    this.build();
  }

  private build(): void {
    const panel = el('div', 'site-panel character-panel');

    const title = el('h1', 'site-panel-title', 'Fondez votre village');
    const subtitle = el(
      'p',
      'site-panel-subtitle',
      'Vous etes le chef. Donnez un nom a votre peuple et choisissez la civilisation qui le guidera.',
    );

    this.errorEl = el('div', 'site-error hidden');

    const form = document.createElement('form');
    form.className = 'character-form';
    form.noValidate = true;

    const namesRow = el('div', 'character-names');
    namesRow.append(
      this.textField('Nom du chef', 'chiefName', 'Ex. Aria le Sage'),
      this.textField('Nom du village', 'villageName', 'Ex. Lumina'),
    );

    const civTitle = el('h2', 'character-section-title', 'Votre civilisation');
    const grid = el('div', 'start-grid compact');
    for (const civ of CIV_LIST) {
      const card = this.buildCivCard(civ);
      grid.append(card);
      this.cards.set(civ.id, card);
    }

    this.submitBtn = el('button', 'site-btn primary full', 'Fonder le village') as HTMLButtonElement;
    this.submitBtn.type = 'submit';
    this.submitBtn.disabled = true;

    form.append(namesRow, civTitle, grid, this.submitBtn);
    form.onsubmit = (e) => {
      e.preventDefault();
      void this.submit(form);
    };

    form.addEventListener('input', () => this.updateSubmitState(form));

    panel.append(title, subtitle, this.errorEl, form);
    this.root.append(panel);
  }

  private textField(label: string, name: string, placeholder: string): HTMLElement {
    const group = el('div', 'form-group');
    const lbl = el('label', '', label);
    lbl.htmlFor = name;
    const input = document.createElement('input');
    input.id = name;
    input.name = name;
    input.type = 'text';
    input.placeholder = placeholder;
    input.required = true;
    input.maxLength = name === 'chiefName' ? 24 : 32;
    group.append(lbl, input);
    return group;
  }

  private buildCivCard(civ: CivDef): HTMLElement {
    const card = el('button', 'start-card compact');
    card.type = 'button';
    card.style.setProperty('--civ-color', colorToCss(civ.themeColor));

    const emblem = el('div', 'start-emblem small');
    emblem.innerHTML = emblemSVG(civ.emblem, civ.themeColor);

    const name = el('div', 'start-card-name', civ.name);
    const tag = el('div', 'start-card-tag', civ.tagline);

    card.append(emblem, name, tag);
    card.onclick = () => this.select(civ.id);
    return card;
  }

  private select(id: CivId): void {
    this.selected = id;
    for (const [civId, card] of this.cards) {
      card.classList.toggle('selected', civId === id);
    }
    const form = this.root.querySelector('form');
    if (form) this.updateSubmitState(form);
  }

  private updateSubmitState(form: HTMLFormElement): void {
    const fd = new FormData(form);
    const chief = String(fd.get('chiefName') ?? '').trim();
    const village = String(fd.get('villageName') ?? '').trim();
    this.submitBtn.disabled = !(chief.length >= 2 && village.length >= 2 && this.selected);
  }

  private async submit(form: HTMLFormElement): Promise<void> {
    if (!this.selected) return;
    this.hideError();

    const fd = new FormData(form);
    const chiefName = String(fd.get('chiefName') ?? '').trim();
    const villageName = String(fd.get('villageName') ?? '').trim();

    try {
      await api.createCharacter(chiefName, villageName, this.selected);
      navigate('play', true);
    } catch (err) {
      this.showError(err instanceof Error ? err.message : 'Erreur inattendue.');
    }
  }

  private showError(msg: string): void {
    this.errorEl.textContent = msg;
    this.errorEl.classList.remove('hidden');
  }

  private hideError(): void {
    this.errorEl.classList.add('hidden');
  }

  show(): void {
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
  }
}
