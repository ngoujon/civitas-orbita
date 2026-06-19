/**
 * Panneau de repartition manuelle de la main-d'oeuvre par secteur economique.
 */

import type { Game } from '@/game/Game';
import type { WorkerSectorStats } from '@/population/WorkerAllocation';
import { workerIconSVG } from '@/ui/WorkerIcons';

export class WorkerAllocationPanel {
  private readonly root: HTMLElement;
  private visible = false;

  constructor(
    private readonly game: Game,
    mount: HTMLElement,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'hud-worker-overlay';
    this.root.style.display = 'none';
    mount.append(this.root);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.root.style.display = this.visible ? '' : 'none';
    if (this.visible) this.render();
  }

  open(): void {
    this.visible = true;
    this.root.style.display = '';
    this.render();
  }

  close(): void {
    this.visible = false;
    this.root.style.display = 'none';
  }

  isOpen(): boolean {
    return this.visible;
  }

  refresh(): void {
    if (this.visible) this.render();
  }

  private render(): void {
    this.root.innerHTML = '';
    const state = this.game.getState();
    const pop = state.population;
    const stats = this.game.getWorkerSectorStats();
    const manual = pop.manualWorkerAllocation;
    const headcount = Math.floor(pop.count);
    const idle = Math.max(0, headcount - pop.assigned);

    const panel = el('div', 'hud-worker-panel');

    const header = el('div', 'hud-worker-header');
    const titleRow = el('div', 'hud-worker-title-row');
    titleRow.innerHTML = workerIconSVG(28);
    const title = el('div', 'hud-worker-title');
    title.textContent = 'Repartition main-d oeuvre';
    titleRow.append(title);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'hud-btn hud-worker-close';
    closeBtn.textContent = 'Fermer';
    closeBtn.onclick = () => this.close();
    header.append(titleRow, closeBtn);

    const summary = el('div', 'hud-worker-summary');
    summary.textContent = `${headcount} habitants · ${pop.assigned} au travail · ${idle} inactifs`;

    const modeRow = el('label', 'hud-worker-mode');
    const autoCheck = document.createElement('input');
    autoCheck.type = 'checkbox';
    autoCheck.checked = !manual;
    autoCheck.onchange = () => {
      this.game.setManualWorkerAllocation(!autoCheck.checked);
      this.render();
    };
    const modeText = document.createElement('span');
    modeText.textContent = 'Repartition automatique';
    modeRow.append(autoCheck, modeText);

    const sectors = el('div', 'hud-worker-sectors');
    for (const row of stats) {
      sectors.append(this.renderSectorRow(row, manual));
    }

    const hint = el('div', 'hud-worker-hint');
    hint.textContent = manual
      ? 'Deplacez les curseurs pour allouer la population par secteur. Les batiments sont remplis dans l ordre de construction.'
      : 'Activez la repartition manuelle pour controler les curseurs par secteur.';

    panel.append(header, summary, modeRow, sectors, hint);
    this.root.append(panel);

    this.root.onclick = (e) => {
      if (e.target === this.root) this.close();
    };
  }

  private renderSectorRow(row: WorkerSectorStats, manual: boolean): HTMLElement {
    const wrap = el('div', 'hud-worker-sector');
    if (row.jobSlots <= 0) wrap.classList.add('inactive');

    const top = el('div', 'hud-worker-sector-top');
    const name = el('span', 'hud-worker-sector-name');
    name.textContent = row.label;
    const meta = el('span', 'hud-worker-sector-meta');
    meta.textContent =
      row.jobSlots > 0
        ? `${row.workers}/${row.jobSlots} emplois · ${row.buildingCount} bat.`
        : 'Aucun emploi';
    top.append(name, meta);

    const sliderRow = el('div', 'hud-worker-slider-row');
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.step = '1';
    slider.value = String(row.sharePct);
    slider.disabled = !manual;
    slider.className = 'hud-worker-slider';
    slider.oninput = () => {
      this.game.setWorkerSectorShare(row.sector, Number(slider.value));
      this.syncPanelValues();
    };

    const pct = el('span', 'hud-worker-pct');
    pct.textContent = `${row.sharePct} %`;

    sliderRow.append(slider, pct);
    wrap.append(top, sliderRow);
    return wrap;
  }

  /** Met a jour resume, pourcentages et compteurs sans reconstruire le panneau. */
  private syncPanelValues(): void {
    const stats = this.game.getWorkerSectorStats();
    const state = this.game.getState();
    const pop = state.population;
    const headcount = Math.floor(pop.count);
    const idle = Math.max(0, headcount - pop.assigned);

    const summary = this.root.querySelector('.hud-worker-summary');
    if (summary) {
      summary.textContent = `${headcount} habitants · ${pop.assigned} au travail · ${idle} inactifs`;
    }

    const rows = this.root.querySelectorAll<HTMLElement>('.hud-worker-sector');
    rows.forEach((rowEl, i) => {
      const row = stats[i];
      if (!row) return;

      const meta = rowEl.querySelector('.hud-worker-sector-meta');
      if (meta) {
        meta.textContent =
          row.jobSlots > 0
            ? `${row.workers}/${row.jobSlots} emplois · ${row.buildingCount} bat.`
            : 'Aucun emploi';
      }

      const slider = rowEl.querySelector<HTMLInputElement>('.hud-worker-slider');
      if (slider && document.activeElement !== slider) {
        slider.value = String(row.sharePct);
      }

      const pct = rowEl.querySelector('.hud-worker-pct');
      if (pct) pct.textContent = `${row.sharePct} %`;

      rowEl.classList.toggle('inactive', row.jobSlots <= 0);
    });
  }
}

function el(tag: string, className?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}
