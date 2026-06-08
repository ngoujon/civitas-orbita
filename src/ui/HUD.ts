/**
 * HUD : interface utilisateur (overlay DOM au-dessus du canvas).
 *
 * Lit l'etat via l'API publique de Game et declenche les actions joueur.
 * Le DOM est construit une fois ; les valeurs sont rafraichies a intervalle
 * regulier (peu couteux), les listes sont reconstruites sur evenement (age).
 *
 * Affiche : ressources, population, age, vitesse, FPS, panneau de construction,
 * panneau de selection (demolition), recherche d'age, sauvegarde, notifications.
 */

import { AGES, ageAtLeast, nextAge } from '@/config/ages';
import type { AgeId } from '@/config/ages';
import { RESOURCE_LIST } from '@/config/resources';
import type { ResourceId } from '@/config/resources';
import { BUILDINGS } from '@/config/buildings';
import type { BuildingCategory, BuildingDef, BuildingId, ResourceAmounts } from '@/config/buildings';
import { buildableAtAge } from '@/buildings/BuildingRegistry';
import { GAME_SPEEDS } from '@/config/game';
import type { GameSpeed } from '@/config/game';
import { getCivDef } from '@/config/civilizations';
import type { Game } from '@/game/Game';
import type { SoundSystem } from '@/audio/SoundSystem';

export class HUD {
  private root: HTMLElement;
  private topBar!: HTMLElement;
  private resourceEls = new Map<ResourceId, { row: HTMLElement; value: HTMLElement }>();
  private popValue!: HTMLElement;
  private ageValue!: HTMLElement;
  private civValue!: HTMLElement;
  private fpsValue!: HTMLElement;
  private speedButtons = new Map<GameSpeed, HTMLButtonElement>();

  private buildPanel!: HTMLElement;
  private buildList!: HTMLElement;
  private selectionPanel!: HTMLElement;
  private researchPanel!: HTMLElement;
  private abilityPanel!: HTMLElement;
  private abilityBtn!: HTMLButtonElement;
  private abilityCd!: HTMLElement;
  private tooltip!: HTMLElement;
  private toastHost!: HTMLElement;

  private lastAge: AgeId | null = null;

  constructor(
    private readonly game: Game,
    mount: HTMLElement,
    private readonly sound?: SoundSystem,
  ) {
    this.root = mount;
    this.build();
    this.bindEvents();
    this.refresh();
    window.setInterval(() => this.refresh(), 100);
  }

  // --- Construction du DOM --------------------------------------------------

  private build(): void {
    this.root.innerHTML = '';

    this.topBar = el('div', 'hud-topbar');
    const resBox = el('div', 'hud-resources');
    for (const def of RESOURCE_LIST) {
      const row = el('div', 'hud-res');
      const swatch = el('span', 'hud-swatch');
      swatch.style.background = colorToCss(def.color);
      const value = el('span', 'hud-res-value');
      value.textContent = '0';
      row.title = def.name;
      row.append(swatch, value);
      resBox.append(row);
      this.resourceEls.set(def.id, { row, value });
      row.style.display = 'none';
    }

    const stats = el('div', 'hud-stats');
    this.popValue = el('span', 'hud-stat');
    this.ageValue = el('span', 'hud-stat hud-age');
    this.civValue = el('span', 'hud-stat hud-civ');
    this.fpsValue = el('span', 'hud-stat hud-fps');
    stats.append(this.civValue, iconLabel('Pop', this.popValue), this.ageValue, this.fpsValue);

    const speedBox = el('div', 'hud-speed');
    for (const s of GAME_SPEEDS) {
      const btn = document.createElement('button');
      btn.className = 'hud-speed-btn';
      btn.textContent = s === 0 ? 'II' : `${s}x`;
      btn.onclick = () => this.game.setSpeed(s);
      speedBox.append(btn);
      this.speedButtons.set(s, btn);
    }

    this.topBar.append(resBox, stats, speedBox);

    // Panneau construction (a gauche).
    this.buildPanel = el('div', 'hud-panel hud-build');
    const buildTitle = el('div', 'hud-panel-title');
    buildTitle.textContent = 'Construction';
    this.buildList = el('div', 'hud-build-list');
    this.buildPanel.append(buildTitle, this.buildList);

    // Panneau selection (a droite).
    this.selectionPanel = el('div', 'hud-panel hud-selection');
    this.selectionPanel.style.display = 'none';

    // Panneau recherche (bas).
    this.researchPanel = el('div', 'hud-panel hud-research');

    // Panneau capacite active (bas gauche).
    this.abilityPanel = el('div', 'hud-panel hud-ability');
    this.abilityBtn = document.createElement('button');
    this.abilityBtn.className = 'hud-btn hud-ability-btn';
    this.abilityBtn.onclick = () => this.game.activateAbility();
    this.abilityCd = el('div', 'hud-ability-cd');
    const abilityTitle = el('div', 'hud-panel-title');
    abilityTitle.textContent = 'Capacite';
    this.abilityPanel.append(abilityTitle, this.abilityBtn, this.abilityCd);

    // Boutons systeme (sauvegarde).
    const sysBox = el('div', 'hud-system');
    sysBox.append(
      button('Sauver', () => this.game.save()),
      button('Charger', () => this.game.load()),
      button('Menu', () => this.confirmNew()),
      button('Recentrer (C)', () => this.game.recenter()),
    );
    if (this.sound) {
      const snd = this.sound;
      const muteBtn = button('', () => {
        const muted = snd.toggleMute();
        muteBtn.textContent = muted ? 'Son: OFF' : 'Son: ON';
      });
      muteBtn.textContent = snd.isMuted ? 'Son: OFF' : 'Son: ON';
      sysBox.append(muteBtn);
    }

    // Infobulle de batiment (survol des cartes de construction).
    this.tooltip = el('div', 'hud-tooltip');
    this.tooltip.style.display = 'none';

    // Toasts.
    this.toastHost = el('div', 'hud-toasts');

    this.root.append(
      this.topBar,
      this.buildPanel,
      this.selectionPanel,
      this.researchPanel,
      this.abilityPanel,
      sysBox,
      this.tooltip,
      this.toastHost,
    );
  }

  private bindEvents(): void {
    this.game.bus.on('notify', ({ message, kind }) => this.toast(message, kind));
    this.game.bus.on('age:advanced', () => {
      this.rebuildBuildList();
      this.toast('Votre civilisation evolue !', 'info');
    });
    this.game.bus.on('buildmode:changed', () => this.refreshBuildSelection());
    this.game.bus.on('building:selected', () => this.refreshSelectionPanel());
  }

  // --- Rafraichissement -----------------------------------------------------

  private refresh(): void {
    const state = this.game.getState();

    if (this.lastAge !== state.age) {
      this.lastAge = state.age;
      this.rebuildBuildList();
    }

    // Ressources (uniquement celles debloquees a l'age courant).
    for (const def of RESOURCE_LIST) {
      const entry = this.resourceEls.get(def.id);
      if (!entry) continue;
      const unlocked = ageAtLeast(state.age, def.unlockedAtAge);
      entry.row.style.display = unlocked ? '' : 'none';
      if (unlocked) {
        const cap = state.capacities[def.id];
        const amount = Math.floor(state.resources[def.id]);
        entry.value.textContent = def.id === 'science' ? `${amount}` : `${amount}/${Math.floor(cap)}`;
      }
    }

    const pop = state.population;
    this.popValue.textContent = `${Math.floor(pop.count)}/${Math.floor(pop.capacity)} (${pop.assigned} au travail)`;
    this.ageValue.textContent = AGES[state.age].name;
    const civDef = getCivDef(state.civ);
    this.civValue.textContent = civDef.name;
    this.civValue.style.color = colorToCss(civDef.themeColor);
    this.fpsValue.textContent = `${this.game.getFps()} FPS`;

    this.refreshAbilityPanel();

    const speed = this.game.getSpeed();
    for (const [s, btn] of this.speedButtons) {
      btn.classList.toggle('active', s === speed);
    }

    this.refreshBuildAffordability();
    this.refreshResearchPanel();
    this.refreshSelectionPanel();
  }

  private rebuildBuildList(): void {
    this.buildList.innerHTML = '';
    const age = this.game.getState().age;
    for (const def of buildableAtAge(age)) {
      const card = el('button', 'hud-build-card');
      card.dataset.building = def.id;

      const name = el('div', 'hud-build-name');
      name.textContent = def.name;
      const cost = el('div', 'hud-build-cost');
      cost.textContent = formatCost(def.cost);

      card.append(name, cost);
      card.onclick = () => this.toggleBuild(def.id);
      card.onmouseenter = () => this.showTooltip(def.id, card);
      card.onmouseleave = () => this.hideTooltip();
      this.buildList.append(card);
    }
    this.refreshBuildSelection();
  }

  private refreshBuildSelection(): void {
    const active = this.game.currentBuildMode;
    for (const card of this.buildList.querySelectorAll<HTMLElement>('.hud-build-card')) {
      card.classList.toggle('active', card.dataset.building === active);
    }
  }

  private refreshBuildAffordability(): void {
    const state = this.game.getState();
    for (const card of this.buildList.querySelectorAll<HTMLElement>('.hud-build-card')) {
      const id = card.dataset.building as BuildingId;
      const cost = BUILDINGS[id].cost;
      const affordable = canAfford(state.resources, cost);
      card.classList.toggle('cannot-afford', !affordable);
    }
  }

  private toggleBuild(id: BuildingId): void {
    this.game.setBuildMode(this.game.currentBuildMode === id ? null : id);
  }

  // --- Infobulle d'utilite (survol) -----------------------------------------

  private showTooltip(id: BuildingId, anchor: HTMLElement): void {
    this.tooltip.innerHTML = buildingTooltipHTML(BUILDINGS[id]);
    this.tooltip.style.display = '';

    const rect = anchor.getBoundingClientRect();
    const tipW = this.tooltip.offsetWidth;
    const tipH = this.tooltip.offsetHeight;

    // A droite de la carte par defaut ; bascule a gauche si pas de place.
    let left = rect.right + 12;
    if (left + tipW > window.innerWidth - 8) left = rect.left - tipW - 12;
    left = Math.max(8, left);

    let top = rect.top;
    if (top + tipH > window.innerHeight - 8) top = window.innerHeight - tipH - 8;
    top = Math.max(8, top);

    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
  }

  private hideTooltip(): void {
    this.tooltip.style.display = 'none';
  }

  // --- Panneau selection ----------------------------------------------------

  private refreshSelectionPanel(): void {
    const id = this.game.selectedBuilding;
    if (!id) {
      this.selectionPanel.style.display = 'none';
      return;
    }
    const state = this.game.getState();
    const b = state.buildings[id];
    if (!b) {
      this.selectionPanel.style.display = 'none';
      return;
    }
    const def = BUILDINGS[b.def];
    this.selectionPanel.style.display = '';
    this.selectionPanel.innerHTML = '';

    const title = el('div', 'hud-panel-title');
    title.textContent = def.name;

    const status = el('div', 'hud-sel-line');
    if (!b.complete) {
      const pct = Math.min(100, Math.floor((b.buildProgress / def.buildTime) * 100));
      status.textContent = `Chantier : ${pct}%`;
    } else {
      status.textContent = 'Operationnel';
    }

    const info = el('div', 'hud-sel-line');
    const parts: string[] = [];
    if (def.jobs) parts.push(`Emplois : ${b.workers}/${def.jobs}`);
    if (def.housing) parts.push(`Logements : ${def.housing}`);
    if (def.produces) parts.push(`Produit : ${formatRates(def.produces)}`);
    if (def.consumes) parts.push(`Consomme : ${formatRates(def.consumes)}`);
    info.textContent = parts.join(' | ') || 'Batiment central';

    const actions = el('div', 'hud-sel-actions');
    if (def.id !== 'campfire') {
      const label = b.complete ? 'Demolir' : 'Annuler (remboursе)';
      actions.append(button(label, () => this.game.demolishSelected()));
    }
    actions.append(button('Fermer', () => this.game.selectBuilding(null)));

    this.selectionPanel.append(title, status, info, actions);
  }

  // --- Panneau recherche ----------------------------------------------------

  private refreshResearchPanel(): void {
    const state = this.game.getState();
    const next = nextAge(state.age);
    this.researchPanel.innerHTML = '';

    const title = el('div', 'hud-panel-title');
    if (!next) {
      title.textContent = 'Apogee : dernier age atteint';
      this.researchPanel.append(title);
      return;
    }

    const def = AGES[next];
    title.textContent = `Recherche : ${def.name}`;

    const req = el('div', 'hud-sel-line');
    req.textContent = `Science ${Math.floor(state.resources.science)}/${def.scienceCost} | Population requise ${def.requiredPopulation}`;

    const bar = el('div', 'hud-progress');
    const fill = el('div', 'hud-progress-fill');
    fill.style.width = `${Math.floor(this.game.ageProgress() * 100)}%`;
    bar.append(fill);

    const btn = button('Evoluer', () => this.game.researchNextAge());
    btn.classList.add('hud-research-btn');
    (btn as HTMLButtonElement).disabled = !this.game.canResearch();

    this.researchPanel.append(title, req, bar, btn);
  }

  // --- Panneau capacite active ----------------------------------------------

  private refreshAbilityPanel(): void {
    const civ = getCivDef(this.game.getState().civ);
    const status = this.game.getAbilityStatus();
    this.abilityBtn.textContent = status.name;
    this.abilityBtn.disabled = !status.ready;
    this.abilityBtn.title = civ.ability.description;

    if (status.buffRemaining > 0) {
      this.abilityCd.textContent = `Actif : ${Math.ceil(status.buffRemaining)} s`;
      this.abilityCd.className = 'hud-ability-cd active';
    } else if (status.ready) {
      this.abilityCd.textContent = 'Prete';
      this.abilityCd.className = 'hud-ability-cd ready';
    } else {
      this.abilityCd.textContent = `Recharge : ${Math.ceil(status.remaining)} s`;
      this.abilityCd.className = 'hud-ability-cd';
    }
  }

  // --- Divers ---------------------------------------------------------------

  private confirmNew(): void {
    this.game.openMenu();
  }

  private toast(message: string, kind: 'info' | 'warn'): void {
    const t = el('div', `hud-toast ${kind}`);
    t.textContent = message;
    this.toastHost.append(t);
    window.setTimeout(() => t.classList.add('show'), 10);
    window.setTimeout(() => {
      t.classList.remove('show');
      window.setTimeout(() => t.remove(), 300);
    }, 2500);
  }
}

// --- Helpers DOM ------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'hud-btn';
  b.textContent = label;
  b.onclick = onClick;
  return b;
}

function iconLabel(label: string, valueEl: HTMLElement): HTMLElement {
  const wrap = el('span', 'hud-stat');
  const k = el('span', 'hud-stat-key');
  k.textContent = `${label}:`;
  wrap.append(k, valueEl);
  return wrap;
}

function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function formatCost(cost: ResourceAmounts): string {
  const parts = Object.entries(cost).map(([res, amt]) => `${amt} ${shortRes(res as ResourceId)}`);
  return parts.length ? parts.join(', ') : 'Gratuit';
}

function formatRates(rates: ResourceAmounts): string {
  return Object.entries(rates)
    .map(([res, amt]) => `${amt}/s ${shortRes(res as ResourceId)}`)
    .join(', ');
}

function shortRes(res: ResourceId): string {
  const map: Record<ResourceId, string> = {
    food: 'Nour.',
    wood: 'Bois',
    stone: 'Pierre',
    tools: 'Outils',
    bronze: 'Bronze',
    iron: 'Fer',
    gold: 'Or',
    science: 'Sci.',
  };
  return map[res];
}

function canAfford(resources: Record<ResourceId, number>, cost: ResourceAmounts): boolean {
  for (const [res, amt] of Object.entries(cost) as [ResourceId, number][]) {
    if (resources[res] < amt) return false;
  }
  return true;
}

const CATEGORY_LABELS: Record<BuildingCategory, string> = {
  special: 'Special',
  production: 'Production',
  housing: 'Logement',
  storage: 'Stockage',
  research: 'Recherche',
  military: 'Militaire',
  trade: 'Commerce',
};

/** Contenu HTML de l'infobulle d'un batiment (utilite + effets). */
function buildingTooltipHTML(def: BuildingDef): string {
  const rows: string[] = [];
  if (def.produces) rows.push(effectRow('Produit', formatRates(def.produces), 'pos'));
  if (def.consumes) rows.push(effectRow('Consomme', formatRates(def.consumes), 'neg'));
  if (def.jobs) rows.push(effectRow('Emplois', `${def.jobs} travailleurs`, ''));
  if (def.housing) rows.push(effectRow('Logements', `+${def.housing}`, 'pos'));
  if (def.storage) rows.push(effectRow('Stockage', `+ ${formatCost(def.storage)}`, 'pos'));
  const build = def.buildTime > 0 ? `${def.buildTime}s` : 'instantanee';
  rows.push(effectRow('Construction', `${build} — ${formatCost(def.cost)}`, ''));

  return (
    `<div class="tip-head">` +
    `<span class="tip-name">${def.name}</span>` +
    `<span class="tip-cat">${CATEGORY_LABELS[def.category]}</span>` +
    `</div>` +
    `<div class="tip-desc">${def.description}</div>` +
    `<div class="tip-effects">${rows.join('')}</div>`
  );
}

function effectRow(label: string, value: string, cls: string): string {
  return (
    `<div class="tip-row">` +
    `<span class="tip-label">${label}</span>` +
    `<span class="tip-val ${cls}">${value}</span>` +
    `</div>`
  );
}
