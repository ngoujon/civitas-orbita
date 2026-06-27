/**
 * Arbre de technologies style RPG : noeuds circulaires, liens de prerequis, progression verticale.
 */

import { AGES } from '@/config/ages';
import { AGE_ABILITIES } from '@/config/abilities';
import { BUILDINGS } from '@/config/buildings';
import {
  TECH_BRANCH_LABELS,
  TECH_KIND_LABELS,
  TECH_KIND_COLORS,
  TECHNOLOGIES,
  TECH_LIST,
  type TechDef,
  type TechId,
} from '@/config/technologies';
import { RESOURCES } from '@/config/resources';
import type { ResourceId } from '@/config/resources';
import type { Game } from '@/game/Game';
import type { TechStatus } from '@/research/TechSystem';
import { formatResourceAmount, roundToCent } from '@/economy/resourceFormat';
import {
  edgePath,
  getTechTreeLayout,
  NODE_RADIUS,
  TECH_NODE_GLYPH,
} from '@/ui/techTreeLayout';

export class TechTreePanel {
  private readonly root: HTMLElement;
  private visible = false;
  private selectedId: TechId | null = null;

  constructor(
    private readonly game: Game,
    mount: HTMLElement,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'hud-tech-overlay';
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
    const layout = getTechTreeLayout();

    const panel = el('div', 'hud-tech-panel');
    panel.append(this.renderHeader());

    const body = el('div', 'hud-tech-body');
    const canvasWrap = el('div', 'hud-tech-canvas-wrap');
    canvasWrap.append(this.renderGraph(layout));
    body.append(canvasWrap, this.renderDetail());
    panel.append(body);

    this.root.append(panel);
  }

  private renderHeader(): HTMLElement {
    const header = el('div', 'hud-tech-header');
    const title = el('div', 'hud-panel-title');
    title.textContent = 'Arbre de technologies';

    const legend = el('div', 'hud-tech-legend');
    legend.innerHTML =
      '<span class="legend researched">Maitrisee</span>' +
      '<span class="legend available">Disponible</span>' +
      '<span class="legend locked">Verrouillee</span>';

    const science = el('div', 'hud-tech-science');
    science.textContent = `Science : ${formatResourceAmount(this.game.getState().resources.science)}`;

    const closeBtn = button('Fermer (Echap)', () => this.close());
    closeBtn.classList.add('hud-tech-close');

    header.append(title, legend, science, closeBtn);
    return header;
  }

  private renderGraph(layout: ReturnType<typeof getTechTreeLayout>): HTMLElement {
    const stage = el('div', 'hud-tech-stage');
    stage.style.width = `${layout.width}px`;
    stage.style.height = `${layout.height}px`;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'hud-tech-edges');
    svg.setAttribute('width', String(layout.width));
    svg.setAttribute('height', String(layout.height));
    svg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);

    for (const edge of layout.edges) {
      const from = layout.positions.get(edge.from);
      const to = layout.positions.get(edge.to);
      if (!from || !to) continue;

      const fromStatus = this.game.techStatus(edge.from);
      const toStatus = this.game.techStatus(edge.to);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', edgePath(from, to));
      path.setAttribute(
        'class',
        `hud-tech-edge ${edgeClass(fromStatus, toStatus)}`,
      );
      svg.append(path);
    }

    stage.append(svg);

    for (const def of TECH_LIST) {
      const pos = layout.positions.get(def.id);
      if (!pos) continue;
      stage.append(this.renderNode(def, pos));
    }

    return stage;
  }

  private renderNode(def: TechDef, pos: { x: number; y: number }): HTMLElement {
    const status = this.game.techStatus(def.id);
    const selected = this.selectedId === def.id;

    const wrap = el('div', 'hud-tech-node-wrap');
    wrap.style.left = `${pos.x - NODE_RADIUS}px`;
    wrap.style.top = `${pos.y - NODE_RADIUS}px`;

    const btn = el('button', `hud-tech-skill-node ${status} branch-${def.branch}${selected ? ' selected' : ''}`);
    btn.type = 'button';
    btn.title = def.name;

    const glyph = el('span', 'hud-tech-skill-glyph');
    glyph.textContent = TECH_NODE_GLYPH[def.id];

    const tier = el('span', 'hud-tech-skill-tier');
    tier.textContent = String(def.tier + 1);

    const kindBadge = el('span', 'hud-tech-kind-badge');
    kindBadge.textContent = TECH_KIND_LABELS[def.kind][0] ?? '?';
    kindBadge.style.background = TECH_KIND_COLORS[def.kind];
    kindBadge.title = TECH_KIND_LABELS[def.kind];

    btn.append(glyph, tier, kindBadge);

    if (def.scienceCost > 0) {
      const cost = el('span', 'hud-tech-skill-cost');
      cost.textContent = String(def.scienceCost);
      btn.append(cost);
    }

    const label = el('div', 'hud-tech-skill-label');
    label.textContent = def.name;
    wrap.append(btn, label);

    btn.onclick = () => {
      this.selectedId = def.id;
      if (status === 'available') {
        this.game.researchTech(def.id);
      }
      this.render();
    };

    return wrap;
  }

  private renderDetail(): HTMLElement {
    const aside = el('aside', 'hud-tech-detail');
    const def = this.selectedId ? TECHNOLOGIES[this.selectedId] : null;

    if (!def) {
      const hint = el('p', 'hud-tech-detail-hint');
      hint.textContent =
        'Selectionnez une competence pour voir ses prerequis, debloques et le cout en science.';
      aside.append(hint);
      return aside;
    }

    const status = this.game.techStatus(def.id);
    const kindTag = el('span', 'hud-tech-detail-kind');
    kindTag.textContent = TECH_KIND_LABELS[def.kind];
    kindTag.style.background = TECH_KIND_COLORS[def.kind];

    const branch = el('div', 'hud-tech-detail-branch');
    branch.append(kindTag, document.createTextNode(' ' + TECH_BRANCH_LABELS[def.branch]));

    const name = el('h3', 'hud-tech-detail-name');
    name.textContent = def.name;

    const desc = el('p', 'hud-tech-detail-desc');
    desc.textContent = def.description;

    const statusLine = el('div', `hud-tech-detail-status ${status}`);
    statusLine.textContent = this.detailStatusText(def, status);

    const prereq = el('div', 'hud-tech-detail-block');
    prereq.append(el('div', 'hud-tech-detail-label', 'Prerequis'));
    prereq.append(this.renderPrereqList(def));

    const unlocks = el('div', 'hud-tech-detail-block');
    unlocks.append(el('div', 'hud-tech-detail-label', 'Debloque'));
    const unlockList = el('ul', 'hud-tech-detail-list');
    if (def.unlocksAbility) {
      const ability = AGE_ABILITIES[def.unlocksAbility];
      const li = document.createElement('li');
      li.textContent = `Competence : ${ability.name}`;
      li.className = 'ability-unlock';
      unlockList.append(li);
    }
    for (const b of def.unlocks) {
      const li = document.createElement('li');
      li.textContent = BUILDINGS[b].name;
      unlockList.append(li);
    }
    if (def.passiveBonus) {
      for (const [res, mult] of Object.entries(def.passiveBonus) as [ResourceId, number][]) {
        const li = document.createElement('li');
        const pct = Math.round((mult - 1) * 100);
        li.textContent = `+${pct} % ${RESOURCES[res].name}`;
        li.className = 'passive-bonus-unlock';
        unlockList.append(li);
      }
    }
    if (unlockList.childElementCount === 0) {
      const li = document.createElement('li');
      li.textContent = '—';
      unlockList.append(li);
    }
    unlocks.append(unlockList);

    aside.append(branch, name, desc, statusLine, prereq, unlocks);

    const ageHint = el('div', 'hud-tech-detail-block');
    ageHint.append(el('div', 'hud-tech-detail-label', 'Age conseille'));
    const ageLine = el('p', 'hud-tech-detail-age');
    ageLine.textContent = AGES[def.requiredAge]?.name ?? def.requiredAge;
    ageHint.append(ageLine);
    aside.append(ageHint);

    if (status === 'available') {
      const action = el('button', 'hud-btn hud-tech-research-btn');
      action.type = 'button';
      action.textContent =
        def.scienceCost > 0
          ? `Rechercher (${def.scienceCost} science)`
          : 'Apprendre (gratuit)';
      action.onclick = () => {
        this.game.researchTech(def.id);
        this.render();
      };
      aside.append(action);
    }

    return aside;
  }

  private renderPrereqList(def: TechDef): HTMLElement {
    const list = el('ul', 'hud-tech-detail-list');
    if (def.prerequisites.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'Aucun (competence de base)';
      list.append(li);
      return list;
    }

    const state = this.game.getState();
    for (const pre of def.prerequisites) {
      const li = document.createElement('li');
      const preDef = TECHNOLOGIES[pre];
      const done = !!state.researchedTechs[pre];
      li.className = done ? 'done' : 'missing';
      li.textContent = `${done ? '✓' : '○'} ${preDef.name}`;
      list.append(li);
    }
    return list;
  }

  private detailStatusText(def: TechDef, status: TechStatus): string {
    if (status === 'researched') return 'Maitrisee';
    if (status === 'available') {
      return def.scienceCost > 0
        ? `Disponible — ${def.scienceCost} science`
        : 'Disponible — gratuite';
    }
    return this.lockReason(def);
  }

  private lockReason(def: TechDef): string {
    const state = this.game.getState();
    const missing = def.prerequisites.filter((p) => !state.researchedTechs[p]);
    if (missing.length > 0) {
      return `Prerequis manquants : ${missing.map((p) => TECHNOLOGIES[p].name).join(', ')}`;
    }
    if (roundToCent(state.resources.science) < def.scienceCost) {
      return `Science insuffisante (${formatResourceAmount(state.resources.science)} / ${def.scienceCost})`;
    }
    return 'Verrouillee';
  }
}

function edgeClass(fromStatus: TechStatus, toStatus: TechStatus): string {
  if (fromStatus === 'researched' && toStatus === 'researched') return 'active';
  if (fromStatus === 'researched' && toStatus === 'available') return 'ready';
  if (fromStatus === 'researched') return 'partial';
  return 'dim';
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'hud-btn';
  b.textContent = label;
  b.onclick = onClick;
  return b;
}
