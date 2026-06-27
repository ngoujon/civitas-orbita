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
import { BUILDINGS, BUILDING_CATEGORY_LABELS, isUpgradeable, maxLevelFor, scaleByLevel } from '@/config/buildings';
import type { BuildingCategory, BuildingDef, BuildingId, ResourceAmounts } from '@/config/buildings';
import { buildableCategoriesForState, buildableGroupedByCategory } from '@/buildings/BuildingRegistry';
import { getCivDef } from '@/config/civilizations';
import type { CharacterProfile } from '@/api';
import type { Game } from '@/game/Game';
import type { SoundSystem } from '@/audio/SoundSystem';
import { ageAbilityIconSVG } from '@/ui/AbilityIcons';
import { AGE_ABILITIES, AGE_ABILITY_ORDER } from '@/config/abilities';
import type { AgeAbilityId } from '@/config/abilities';
import { TechTreePanel } from '@/ui/TechTreePanel';
import { WorkerAllocationPanel } from '@/ui/WorkerAllocationPanel';
import { SettingsPanel } from '@/ui/SettingsPanel';
import { workerIconSVG } from '@/ui/WorkerIcons';
import {
  menuIconSVG,
  recenterIconSVG,
  settingsIconSVG,
  soundOffIconSVG,
  soundOnIconSVG,
  techTreeIconSVG,
} from '@/ui/SystemIcons';
import { GameChatLog } from '@/ui/GameChatLog';
import { isNpcIslandActive } from '@/world/NpcIslandAbsorption';
import { formatResourceAmount } from '@/economy/resourceFormat';
import type { ResourceFlowSnapshot } from '@/economy/ResourceFlow';
import { RESOURCES } from '@/config/resources';
import { showConfirm } from '@/ui/ConfirmDialog';

export class HUD {
  private root: HTMLElement;
  private topBar!: HTMLElement;
  private resourceEls = new Map<ResourceId, { row: HTMLElement; value: HTMLElement }>();
  private popValue!: HTMLElement;
  private popAllocBtn!: HTMLButtonElement;
  private ageValue!: HTMLElement;
  private civValue!: HTMLElement;
  private villageValue!: HTMLElement;
  private fpsValue!: HTMLElement;
  private speedValue!: HTMLElement;

  private buildPanel!: HTMLElement;
  private buildList!: HTMLElement;
  /** Categories du panneau construction repliees par le joueur. */
  private collapsedBuildCategories = new Set<BuildingCategory>();
  private selectionPanel!: HTMLElement;
  private npcIslandPanel!: HTMLElement;
  private researchPanel!: HTMLElement;
  private abilityBar!: HTMLElement;
  private abilitySlots: Array<{ el: HTMLButtonElement; cdEl: HTMLElement }> = [];
  private tooltip!: HTMLElement;
  private resourceTooltipSource: ResourceId | null = null;
  private chatLog!: GameChatLog;
  private muteBtn: HTMLButtonElement | null = null;
  private objectivesPanel!: HTMLElement;

  private lastAge: AgeId | null = null;
  private techTree!: TechTreePanel;
  private workerPanel!: WorkerAllocationPanel;
  private settingsPanel!: SettingsPanel;
  private demolishBar!: HTMLElement;
  private demolishCount!: HTMLElement;
  private demolishBtn!: HTMLButtonElement;

  constructor(
    private readonly game: Game,
    mount: HTMLElement,
    private readonly sound?: SoundSystem,
    private readonly profile?: CharacterProfile,
  ) {
    this.root = mount;
    this.build();
    this.techTree = new TechTreePanel(this.game, this.root);
    this.workerPanel = new WorkerAllocationPanel(this.game, this.root);
    this.settingsPanel = new SettingsPanel(this.game, this.root, this.sound);
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
      row.append(swatch, value);
      resBox.append(row);
      this.resourceEls.set(def.id, { row, value });
      row.style.display = 'none';
      row.classList.add('hud-res-hover');
      row.onmouseenter = () => this.showResourceTooltip(def.id, row);
      row.onmouseleave = () => this.hideResourceTooltip();
    }

    const stats = el('div', 'hud-stats');
    this.popValue = el('span', 'hud-stat');
    this.popAllocBtn = document.createElement('button');
    this.popAllocBtn.className = 'hud-worker-trigger';
    this.popAllocBtn.title = "Repartition main-d'oeuvre (W)";
    this.popAllocBtn.innerHTML = workerIconSVG(18);
    this.popAllocBtn.onclick = () => this.workerPanel.toggle();
    const popWrap = el('span', 'hud-pop-wrap');
    popWrap.append(iconLabel('Hab.', this.popValue), this.popAllocBtn);
    this.ageValue = el('span', 'hud-stat hud-age');
    this.civValue = el('span', 'hud-stat hud-civ');
    this.villageValue = el('span', 'hud-stat hud-village');
    this.fpsValue = el('span', 'hud-stat hud-fps');
    this.speedValue = el('span', 'hud-stat hud-speed');
    stats.append(this.villageValue, this.civValue, popWrap, this.ageValue, this.speedValue, this.fpsValue);

    this.topBar.append(resBox, stats);

    // Panneau construction (a gauche).
    this.buildPanel = el('div', 'hud-panel hud-build');
    const buildTitle = el('div', 'hud-panel-title');
    buildTitle.textContent = 'Construction';
    this.buildList = el('div', 'hud-build-list');
    this.demolishBtn = document.createElement('button');
    this.demolishBtn.className = 'hud-btn hud-demolish-btn';
    this.demolishBtn.textContent = '🔨 Démolir';
    this.demolishBtn.title = 'Mode démolition (cliquez sur les bâtiments à démolir)';
    this.demolishBtn.onclick = () => this.game.setDemolishMode(!this.game.isDemolishMode);
    this.buildPanel.append(buildTitle, this.demolishBtn, this.buildList);

    // Panneau selection (a droite).
    this.selectionPanel = el('div', 'hud-panel hud-selection');
    this.selectionPanel.style.display = 'none';

    this.npcIslandPanel = el('div', 'hud-panel hud-selection hud-npc-island');
    this.npcIslandPanel.style.display = 'none';

    // Panneau recherche (bas).
    this.researchPanel = el('div', 'hud-panel hud-research');

    // Barre d'abilities (bas, centre) — 9 slots numerotes 1-9.
    this.abilityBar = el('div', 'hud-ability-bar');
    this.abilitySlots = [];
    for (let i = 0; i < AGE_ABILITY_ORDER.length; i++) {
      const abilityId = AGE_ABILITY_ORDER[i] as AgeAbilityId;
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'hud-ability-slot locked';

      const numEl = el('span', 'hud-ability-slot-num');
      numEl.textContent = String(i + 1);

      const iconEl = el('div', 'hud-ability-slot-icon');
      iconEl.innerHTML = ageAbilityIconSVG(abilityId, 32);

      const cdEl = el('div', 'hud-ability-slot-cd');
      cdEl.style.display = 'none';

      slot.append(numEl, iconEl, cdEl);
      slot.onclick = () => this.game.activateAbilityById(abilityId);

      this.abilitySlots.push({ el: slot, cdEl });
      this.abilityBar.append(slot);
    }

    // Boutons systeme (bas droite, colonne d icones).
    const sysBox = el('div', 'hud-system');
    sysBox.append(
      iconButton(techTreeIconSVG(), 'Technologies (T)', () => this.techTree.toggle()),
      iconButton(settingsIconSVG(), 'Reglages', () => this.settingsPanel.toggle()),
      iconButton(menuIconSVG(), 'Menu', () => this.confirmNew()),
      iconButton(recenterIconSVG(), 'Recentrer (C)', () => this.game.recenter()),
    );
    if (this.sound) {
      const snd = this.sound;
      this.muteBtn = iconButton(
        snd.isMuted ? soundOffIconSVG() : soundOnIconSVG(),
        snd.isMuted ? 'Activer le son' : 'Couper le son',
        () => {
          const muted = snd.toggleMute();
          this.muteBtn!.innerHTML = muted ? soundOffIconSVG() : soundOnIconSVG();
          this.muteBtn!.title = muted ? 'Activer le son' : 'Couper le son';
        },
      );
      sysBox.append(this.muteBtn);
    }

    // Bandeau de confirmation de démolition.
    this.demolishBar = el('div', 'hud-demolish-bar');
    this.demolishBar.style.display = 'none';
    this.demolishCount = el('span', 'hud-demolish-count');
    this.demolishCount.textContent = '0 bâtiment sélectionné';
    const demolishConfirm = document.createElement('button');
    demolishConfirm.className = 'hud-btn hud-demolish-confirm';
    demolishConfirm.textContent = 'Confirmer la démolition';
    demolishConfirm.onclick = () => this.game.confirmDemolish();
    const demolishCancel = document.createElement('button');
    demolishCancel.className = 'hud-btn';
    demolishCancel.textContent = 'Annuler';
    demolishCancel.onclick = () => this.game.setDemolishMode(false);
    this.demolishBar.append(
      Object.assign(el('span', 'hud-demolish-label'), { textContent: '🔨 Mode démolition —' }),
      this.demolishCount,
      demolishConfirm,
      demolishCancel,
    );

    // Infobulle de batiment (survol des cartes de construction).
    this.tooltip = el('div', 'hud-tooltip');
    this.tooltip.style.display = 'none';

    this.chatLog = new GameChatLog(this.root);

    this.objectivesPanel = el('div', 'hud-objectives');
    this.objectivesPanel.style.display = 'none';

    this.root.append(
      this.topBar,
      this.buildPanel,
      this.selectionPanel,
      this.npcIslandPanel,
      this.researchPanel,
      this.abilityBar,
      this.objectivesPanel,
      this.demolishBar,
      sysBox,
      this.tooltip,
    );
  }

  private bindEvents(): void {
    this.game.bus.on('notify', ({ message, kind }) => this.chatLog.add(message, kind));
    this.game.bus.on('demolish:mode', ({ active }) => {
      this.demolishBar.style.display = active ? '' : 'none';
      this.demolishBtn.classList.toggle('active', active);
      if (!active) this.demolishCount.textContent = '0 bâtiment sélectionné';
    });
    this.game.bus.on('demolish:marked', ({ ids }) => {
      const n = ids.length;
      this.demolishCount.textContent = `${n} bâtiment${n > 1 ? 's' : ''} sélectionné${n > 1 ? 's' : ''}`;
    });
    this.game.bus.on('age:advanced', () => {
      this.rebuildBuildList();
      this.techTree.refresh();
    });
    this.game.bus.on('buildmode:changed', () => this.refreshBuildSelection());
    this.game.bus.on('building:selected', () => this.refreshSelectionPanel());
    this.game.bus.on('building:upgraded', () => this.refreshSelectionPanel());
    this.game.bus.on('npcIsland:selected', () => this.refreshNpcIslandPanel());
    this.game.bus.on('tech:researched', () => {
      this.rebuildBuildList();
      this.techTree.refresh();
    });

    window.addEventListener('keydown', (e) => {
      if (isTypingTarget(e.target)) return;

      if (e.key === 'Escape' && this.techTree.isOpen()) {
        e.preventDefault();
        this.techTree.close();
        return;
      }

      if (e.key === 'Escape' && this.workerPanel.isOpen()) {
        e.preventDefault();
        this.workerPanel.close();
        return;
      }

      if (e.key === 'Escape' && this.settingsPanel.isOpen()) {
        e.preventDefault();
        this.settingsPanel.close();
        return;
      }

      if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        this.techTree.toggle();
      }

      if (e.key.toLowerCase() === 'w') {
        e.preventDefault();
        this.workerPanel.toggle();
      }
    });
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
        entry.value.textContent =
          def.id === 'science'
            ? formatResourceAmount(state.resources[def.id])
            : `${Math.floor(state.resources[def.id])}/${Math.floor(cap)}`;
        // Coloration selon flux net.
        const flow = this.game.getResourceFlow(def.id);
        entry.value.classList.toggle('positive', flow.netPerSec > 0.005);
        entry.value.classList.toggle('negative', flow.netPerSec < -0.005);
      }
    }

    const pop = state.population;
    const happy = Math.floor(pop.happiness ?? 70);
    this.popValue.textContent = `${Math.floor(pop.count)}/${Math.floor(pop.capacity)} (${pop.assigned} trav.) · ${happy}%`;
    this.ageValue.textContent = AGES[state.age].name;
    const civDef = getCivDef(state.civ);
    this.civValue.textContent = civDef.name;
    this.civValue.style.color = colorToCss(civDef.themeColor);
    const village = state.villageName || this.profile?.villageName || 'Village';
    const chief = state.chiefName || this.profile?.chiefName || 'Chef';
    this.villageValue.textContent = `${village} · ${chief}`;
    this.fpsValue.textContent = `${this.game.getFps()} FPS`;
    const paused = this.game.isPaused();
    const spd = this.game.getSpeed();
    this.speedValue.textContent = paused ? 'Pause' : `${spd}x`;
    this.speedValue.classList.toggle('hud-paused', paused);

    this.refreshAbilityBar();

    this.refreshBuildAffordability();
    this.refreshResearchPanel();
    this.refreshSelectionPanel();
    this.refreshNpcIslandPanel();
    this.techTree.refresh();
    this.workerPanel.refresh();

    this.refreshObjectivesPanel();

    if (this.resourceTooltipSource && this.tooltip.style.display !== 'none') {
      const flow = this.game.getResourceFlow(this.resourceTooltipSource);
      this.tooltip.innerHTML = resourceTooltipHTML(this.resourceTooltipSource, flow);
    }
  }

  private rebuildBuildList(): void {
    this.buildList.innerHTML = '';
    const state = this.game.getState();
    const groups = buildableGroupedByCategory(state);

    for (const category of buildableCategoriesForState(state)) {
      const defs = groups.get(category);
      if (!defs?.length) continue;

      const section = el('div', 'hud-build-category');
      const collapsed = this.collapsedBuildCategories.has(category);
      if (collapsed) section.classList.add('collapsed');

      const header = el('button', 'hud-build-category-title');
      header.type = 'button';
      header.setAttribute('aria-expanded', String(!collapsed));

      const toggle = el('span', 'hud-build-category-toggle');
      toggle.textContent = collapsed ? '\u25B6' : '\u25BC';
      toggle.setAttribute('aria-hidden', 'true');

      const label = el('span', 'hud-build-category-label');
      label.textContent = BUILDING_CATEGORY_LABELS[category];

      header.append(toggle, label);
      header.onclick = () => {
        if (this.collapsedBuildCategories.has(category)) {
          this.collapsedBuildCategories.delete(category);
        } else {
          this.collapsedBuildCategories.add(category);
        }
        this.rebuildBuildList();
      };

      const cards = el('div', 'hud-build-category-cards');

      for (const def of defs) {
        cards.append(this.createBuildCard(def));
      }

      section.append(header, cards);
      this.buildList.append(section);
    }

    this.refreshBuildSelection();
  }

  private createBuildCard(def: BuildingDef): HTMLButtonElement {
    const card = el('button', 'hud-build-card');
    card.dataset.building = def.id;

    const row = el('div', 'hud-build-card-row');

    const icon = document.createElement('img');
    icon.className = 'hud-build-icon';
    icon.alt = '';
    icon.width = 40;
    icon.height = 40;
    icon.src = this.game.getBuildingIconUrl(def.id);

    const info = el('div', 'hud-build-info');
    const name = el('div', 'hud-build-name');
    name.textContent = def.name;
    const cost = el('div', 'hud-build-cost');
    cost.textContent = formatCost(def.cost);
    info.append(name, cost);

    row.append(icon, info);
    card.append(row);
    card.onclick = (e) => {
      if (e.shiftKey) {
        this.game.enqueueBuilding(def.id);
      } else {
        this.toggleBuild(def.id);
      }
    };
    card.onmouseenter = () => this.showTooltip(def.id, card);
    card.onmouseleave = () => this.hideTooltip();
    return card;
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
    this.resourceTooltipSource = null;
    this.tooltip.innerHTML = buildingTooltipHTML(BUILDINGS[id]);
    this.tooltip.style.display = '';

    this.positionTooltip(anchor);
  }

  private hideTooltip(): void {
    this.tooltip.style.display = 'none';
    this.resourceTooltipSource = null;
  }

  private showResourceTooltip(id: ResourceId, anchor: HTMLElement): void {
    this.resourceTooltipSource = id;
    const flow = this.game.getResourceFlow(id);
    this.tooltip.innerHTML = resourceTooltipHTML(id, flow);
    this.tooltip.style.display = '';
    this.positionTooltip(anchor);
  }

  private hideResourceTooltip(): void {
    if (this.resourceTooltipSource === null) return;
    this.hideTooltip();
  }

  private positionTooltip(anchor: HTMLElement): void {
    const rect = anchor.getBoundingClientRect();
    const tipW = this.tooltip.offsetWidth;
    const tipH = this.tooltip.offsetHeight;

    let left = rect.left + rect.width / 2 - tipW / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));

    let top = rect.bottom + 8;
    if (top + tipH > window.innerHeight - 8) top = rect.top - tipH - 8;
    top = Math.max(8, top);

    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
  }

  // --- Panneau selection ----------------------------------------------------

  private refreshSelectionPanel(): void {
    const id = this.game.selectedBuilding;
    if (!id) {
      this.selectionPanel.style.display = 'none';
      return;
    }
    if (this.game.selectedNpcIsland) {
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
    const upgradeable = isUpgradeable(def);
    title.textContent = upgradeable ? `${def.name} — Niv. ${b.level}` : def.name;

    const status = el('div', 'hud-sel-line');
    if (!b.complete) {
      const pct = Math.min(1, b.buildProgress / def.buildTime);
      const remaining = Math.ceil(def.buildTime - b.buildProgress);
      const bar = el('div', 'hud-construction-bar');
      const fill = el('div', 'hud-construction-fill');
      fill.style.width = `${Math.round(pct * 100)}%`;
      const label = el('div', 'hud-construction-label');
      label.textContent = `Construction — ${Math.round(pct * 100)}% (${remaining}s)`;
      bar.append(fill);
      status.append(label, bar);
    } else if (upgradeable && b.level >= maxLevelFor(def)) {
      status.textContent = 'Niveau maximum';
    } else {
      status.textContent = 'Operationnel';
    }

    const info = el('div', 'hud-sel-line');
    const parts: string[] = [];
    if (def.jobs) parts.push(`Emplois : ${b.workers}/${def.jobs}`);
    if (def.housing) parts.push(`Logements : ${def.housing * b.level}`);
    if (def.produces) parts.push(`Produit : ${formatRates(scaleByLevel(def.produces, b.level))}`);
    if (def.consumes) parts.push(`Consomme : ${formatRates(scaleByLevel(def.consumes, b.level))}`);
    if (def.storage) parts.push(`Stockage : +${formatCost(scaleByLevel(def.storage, b.level))}`);
    const synergy = this.game.getBuildingSynergyInfo(id);
    if (synergy && synergy.neighbors > 0) {
      parts.push(`Synergie ${synergy.groupLabel} : +${synergy.bonusPct}%`);
    }
    info.textContent = parts.join(' | ') || 'Batiment central';

    const extras: HTMLElement[] = [];
    if (b.def !== 'campfire') {
      const moveHint = el('div', 'hud-sel-line hud-sel-hint');
      moveHint.textContent = 'Cliquez sur une case libre pour deplacer ce batiment.';
      extras.push(moveHint);
    }
    if (b.def === 'port' && b.complete) {
      const scout = el('div', 'hud-sel-line');
      const linked = Object.values(state.scoutBoats).find((s) => s.portId === b.id);
      if (!linked) {
        scout.textContent =
          b.workers > 0
            ? 'Eclaireur pret au depart'
            : 'Assignez des travailleurs au port pour lancer l eclaireur';
      } else if (linked.phase === 'docked') {
        scout.textContent = 'Eclaireur au port — mer entierement exploree';
      } else if (linked.phase === 'returning') {
        scout.textContent = 'Eclaireur en route vers le port';
      } else {
        scout.textContent = 'Eclaireur en mer — disperse les nuages';
      }
      extras.push(scout);
    }

    const actions = el('div', 'hud-sel-actions');
    if (b.complete && upgradeable && b.level < maxLevelFor(def)) {
      const cost = this.game.upgradeCostSelected();
      const affordable = canAfford(state.resources, cost);
      const upgradeBtn = button(
        `Ameliorer (niv. ${b.level + 1}) — ${formatCost(cost)}`,
        () => this.game.upgradeSelected(),
      );
      upgradeBtn.className = 'hud-btn hud-upgrade-btn';
      if (!affordable) upgradeBtn.classList.add('cannot-afford');
      actions.append(upgradeBtn);
    }
    if (def.id !== 'campfire') {
      const label = b.complete ? 'Demolir' : 'Annuler (rembourse)';
      actions.append(
        button(label, async () => {
          const msg = b.complete
            ? `Demolir ${def.name} ? Cette action est irreversible.`
            : `Annuler la construction de ${def.name} ?`;
          if (await showConfirm(msg)) this.game.demolishSelected();
        }),
      );
    }
    actions.append(button('Fermer', () => this.game.selectBuilding(null)));

    this.selectionPanel.append(title, status, info, ...extras, actions);
  }

  // --- Panneau ile PNJ ------------------------------------------------------

  private refreshNpcIslandPanel(): void {
    const id = this.game.selectedNpcIsland;
    if (!id) {
      this.npcIslandPanel.style.display = 'none';
      return;
    }
    const state = this.game.getState();
    const island = state.npcIslands.find((i) => i.id === id);
    if (!island || !isNpcIslandActive(island)) {
      this.npcIslandPanel.style.display = 'none';
      return;
    }

    this.npcIslandPanel.style.display = '';
    this.npcIslandPanel.innerHTML = '';

    const civDef = getCivDef(island.civ);
    const title = el('div', 'hud-panel-title');
    title.textContent = island.villageName;

    const chief = el('div', 'hud-sel-line');
    chief.textContent = `Chef ${island.chiefName} · ${civDef.name} · ${AGES[island.age].name} · ${island.relation}`;

    const lootLine = el('div', 'hud-sel-line');
    const lootEmpty = Object.values(island.loot).every((v) => (v ?? 0) <= 0);
    if (island.expedition) {
      const pct = Math.min(100, Math.floor((island.expedition.progress / island.expedition.duration) * 100));
      lootLine.textContent = `Expedition en cours : ${pct} %`;
    } else if (lootEmpty && island.lootCooldown > 0) {
      lootLine.textContent = `Butin epuise — regeneration dans ${Math.ceil(island.lootCooldown)} s`;
    } else if (lootEmpty) {
      lootLine.textContent = 'Butin epuise';
    } else {
      lootLine.textContent = `Butin : ${formatCost(island.loot)}`;
    }

    const actions = el('div', 'hud-sel-actions');
    if (island.relation === 'hostile' || island.relation === 'neutral') {
      actions.append(
        button('Proposer alliance', () => this.game.proposeAlliance(island.id)),
      );
    }
    if (island.relation === 'allied') {
      actions.append(button('Commerce', () => this.game.tradeWithIsland(island.id)));
    }
    const raidBtn = button('Lancer une expedition', () => this.game.startExpedition(island.id));
    raidBtn.disabled = !this.game.canStartExpedition(island.id);
    actions.append(raidBtn, button('Fermer', () => this.game.selectNpcIsland(null)));

    this.npcIslandPanel.append(title, chief, lootLine, actions);
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

  // --- Barre de competences actives ----------------------------------------

  private refreshAbilityBar(): void {
    const state = this.game.getState();
    const buffRemaining = state.ability.buffRemaining;

    for (let i = 0; i < AGE_ABILITY_ORDER.length; i++) {
      const abilityId = AGE_ABILITY_ORDER[i] as AgeAbilityId;
      const slot = this.abilitySlots[i];
      if (!slot) continue;

      const unlocked = !!state.unlockedAbilities[abilityId];
      const cd = state.abilityCooldowns[abilityId] ?? 0;
      const def = AGE_ABILITIES[abilityId];
      const ready = unlocked && cd <= 0;

      slot.el.classList.toggle('locked', !unlocked);
      slot.el.classList.toggle('ready', ready);
      slot.el.disabled = !ready;

      // Detecter si le buff actif provient de cette ability.
      const isActiveBuff =
        buffRemaining > 0 &&
        def.effect.kind === 'production_buff' &&
        cd > 0;
      slot.el.classList.toggle('active-buff', isActiveBuff);

      slot.el.title = !unlocked
        ? `${def.name} — Verrouillee. Recherchez la maitrise de ${AGES[abilityId].name} (T).`
        : `${def.name} — ${def.description} (Refroidissement : ${def.cooldown}s)`;

      // Overlay de recharge.
      if (!unlocked) {
        slot.cdEl.style.display = 'none';
        slot.cdEl.textContent = '';
      } else if (isActiveBuff) {
        slot.cdEl.style.display = '';
        slot.cdEl.textContent = `${Math.ceil(buffRemaining)}s`;
      } else if (cd > 0) {
        slot.cdEl.style.display = '';
        slot.cdEl.textContent = `${Math.ceil(cd)}s`;
      } else {
        slot.cdEl.style.display = 'none';
        slot.cdEl.textContent = '';
      }
    }
  }

  // --- Divers ---------------------------------------------------------------

  private refreshObjectivesPanel(): void {
    const obj = this.game.getActiveObjective();
    if (!obj) {
      this.objectivesPanel.style.display = 'none';
      return;
    }
    this.objectivesPanel.style.display = '';
    this.objectivesPanel.innerHTML = '';
    const title = el('div', 'hud-objectives-title');
    title.textContent = 'Objectif';
    const desc = el('div', 'hud-objectives-desc');
    desc.textContent = `${obj.title} — ${obj.description}`;
    this.objectivesPanel.append(title, desc);
  }

  private confirmNew(): void {
    this.game.openMenu();
  }
}

// --- Helpers DOM ------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function iconButton(svg: string, title: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'hud-icon-btn';
  b.title = title;
  b.innerHTML = svg;
  b.onclick = onClick;
  return b;
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
    `<span class="tip-cat">${BUILDING_CATEGORY_LABELS[def.category]}</span>` +
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

function resourceTooltipHTML(id: ResourceId, flow: ResourceFlowSnapshot): string {
  const def = RESOURCES[id];
  const stockLabel =
    id === 'science'
      ? formatResourceAmount(flow.stock)
      : `${Math.floor(flow.stock)} / ${Math.floor(flow.capacity)}`;

  const rows: string[] = [
    effectRow('Stock', stockLabel, ''),
    effectRow('Entree', formatFlowRate(flow.inPerSec), flow.inPerSec > 0 ? 'pos' : ''),
    effectRow('Sortie', formatOutRate(flow.outPerSec), flow.outPerSec > 0 ? 'neg' : ''),
    effectRow(
      'Bilan net',
      formatFlowRate(flow.netPerSec),
      flow.netPerSec > 0.005 ? 'pos' : flow.netPerSec < -0.005 ? 'neg' : '',
    ),
  ];

  if (Math.abs(flow.maxInPerSec - flow.inPerSec) > 0.01) {
    rows.push(effectRow('Entree max', formatFlowRate(flow.maxInPerSec), 'tip-dim'));
  }
  if (Math.abs(flow.maxOutPerSec - flow.outPerSec) > 0.01) {
    rows.push(effectRow('Sortie max', formatOutRate(flow.maxOutPerSec), 'tip-dim'));
  }

  return (
    `<div class="tip-head">` +
    `<span class="tip-name">${def.name}</span>` +
    `<span class="tip-cat">Flux / s</span>` +
    `</div>` +
    `<div class="tip-desc">Entrees et sorties effectives compte tenu des batiments, travailleurs et stocks d intrants.</div>` +
    `<div class="tip-effects">${rows.join('')}</div>`
  );
}

function formatFlowRate(perSec: number): string {
  if (Math.abs(perSec) < 0.005) return '0/s';
  const sign = perSec > 0 ? '+' : '';
  return `${sign}${formatResourceAmount(perSec)}/s`;
}

function formatOutRate(perSec: number): string {
  if (perSec <= 0.005) return '0/s';
  return `-${formatResourceAmount(perSec)}/s`;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}
