/**
 * Game : orchestrateur central.
 *
 * Assemble l'etat (GameState), les systemes de simulation, la carte du monde,
 * le rendu (PixiJS) et la boucle de jeu. Gere les entrees (souris/clavier).
 *
 * Separation stricte : la simulation tourne a pas fixe (runTick), le rendu
 * observe l'etat a 60 FPS. Le rendu ne mute jamais l'etat.
 */

import { Application } from 'pixi.js';
import {
  CAMERA,
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  PALETTE,
  TICK_SECONDS,
} from '@/config/game';
import type { BuildingId, ResourceAmounts } from '@/config/buildings';
import { BUILDINGS } from '@/config/buildings';
import { SYNERGY_GROUP_LABELS } from '@/config/synergy';
import type { CivId } from '@/config/civilizations';

import { EventBus, GameLoop, TimeManager } from '@/core';
import { WorldMap } from '@/world/WorldMap';
import { sectorKey } from '@/world/Sector';
import type { SectorCoord } from '@/world/Sector';

import { ProductionSystem } from '@/economy/ProductionSystem';
import { countSynergyNeighbors, synergyMultiplier } from '@/economy/ProductionSynergy';
import { PopulationSystem } from '@/population/PopulationSystem';
import {
  adjustWorkerShare,
  assignWorkers,
  ensureWorkerAllocationState,
  workerSectorStats,
  type WorkerSectorStats,
} from '@/population/WorkerAllocation';
import type { WorkerSector } from '@/config/workers';
import { credit, recomputeCapacities } from '@/economy/ResourceManager';
import { computeResourceFlows, type ResourceFlowSnapshot } from '@/economy/ResourceFlow';
import type { ResourceId } from '@/config/resources';
import { AgeSystem } from '@/research/AgeSystem';
import { TechSystem } from '@/research/TechSystem';
import { TECHNOLOGIES } from '@/config/technologies';
import type { TechId } from '@/config/technologies';
import { syncUnlockedAbilitiesFromTechs } from '@/config/technologies';
import {
  activeAgeAbility,
  AGE_ABILITIES,
  abilityThemeColor,
  type AgeAbilityId,
} from '@/config/abilities';
import { AGES } from '@/config/ages';
import type { TechStatus } from '@/research/TechSystem';
import { ConstructionSystem } from '@/buildings/ConstructionSystem';
import { UpgradeSystem } from '@/buildings/UpgradeSystem';
import { TerrainSystem } from '@/world/TerrainSystem';
import { TERRAIN_PREP } from '@/config/terrain';
import { NPC_ISLAND_RADIUS } from '@/config/npcIslands';
import { IslandExpeditionSystem } from '@/world/IslandExpeditionSystem';
import { isWorldPointExplored } from '@/world/SeaExploration';
import { FishingBoatSystem } from '@/economy/FishingBoatSystem';
import { ScoutBoatSystem } from '@/economy/ScoutBoatSystem';
import { seedInitialSeaExploration, refreshShoreSeaExploration } from '@/world/SeaExploration';
import { ringOuterRadius } from '@/config/rings';
import { syncNpcIslandAbsorption, isNpcIslandActive } from '@/world/NpcIslandAbsorption';
import { TutorialSystem } from './TutorialSystem';
import { ObjectiveSystem } from './ObjectiveSystem';
import { RandomEventSystem } from './RandomEventSystem';
import { MilitarySystem } from './MilitarySystem';
import { DiplomacySystem } from './DiplomacySystem';
import { ConstructionQueueSystem } from '@/buildings/ConstructionQueueSystem';
import { CommandProcessor } from './CommandProcessor';
import type { GameCommand } from './commands';
import { createSoloWorld, pushColonyToWorld, type WorldState } from './WorldState';
import type { PlayerId } from './WorldState';

import { WorldRenderer } from '@/rendering/WorldRenderer';

import { computeOccupancy, createNewGame, ensureGameMetaState } from './GameState';
import type { GameState, PlayerIdentity } from './GameState';
import type { GameEvents } from './events';
import { formatResourceAmount } from '@/economy/resourceFormat';

export class Game {
  readonly bus = new EventBus<GameEvents>();
  readonly time = new TimeManager();

  private state: GameState;
  private map: WorldMap;
  private occupied: Set<string>;

  private readonly production = new ProductionSystem();
  private readonly population = new PopulationSystem();
  private readonly ages = new AgeSystem();
  private readonly tech = new TechSystem();
  private readonly construction = new ConstructionSystem();
  private readonly upgrades = new UpgradeSystem();
  private readonly terrain = new TerrainSystem();
  private readonly expeditions = new IslandExpeditionSystem();
  private readonly fishingBoats = new FishingBoatSystem();
  private readonly scouts = new ScoutBoatSystem();
  private readonly tutorial = new TutorialSystem();
  private readonly objectives = new ObjectiveSystem();
  private readonly randomEvents = new RandomEventSystem();
  private readonly military = new MilitarySystem();
  private readonly diplomacy = new DiplomacySystem();
  private readonly buildQueue = new ConstructionQueueSystem();
  private readonly commandProcessor = new CommandProcessor();
  private world: WorldState;
  private playerId: PlayerId = 'local';

  private renderer!: WorldRenderer;
  private loop!: GameLoop;
  private lastDt = 0;

  // Entrees.
  private buildMode: BuildingId | null = null;
  private selectedId: string | null = null;
  private selectedNpcIslandId: string | null = null;
  private pointerDown = false;
  private dragged = false;
  private lastPointer = { x: 0, y: 0 };
  private readonly keys = new Set<string>();

  constructor() {
    this.state = createNewGame();
    this.map = new WorldMap(this.state.ringCount);
    this.occupied = computeOccupancy(this.state);
    this.world = createSoloWorld(this.playerId, this.state);
  }

  /** Identifiant joueur pour le monde partage (defini au bootstrap). */
  setPlayerId(id: PlayerId): void {
    this.playerId = id;
    this.world = createSoloWorld(id, this.state);
  }

  /** Execute une commande typée (preparation multijoueur). */
  executeCommand(cmd: GameCommand): boolean {
    const result = this.commandProcessor.apply(this.state, this.map, cmd);
    if (result.ok) {
      this.occupied = computeOccupancy(this.state);
      pushColonyToWorld(this.world, this.playerId, this.state);
      this.bus.emit('state:changed', {});
    }
    return result.ok;
  }

  getWorldState(): Readonly<WorldState> {
    return this.world;
  }

  /** Initialise PixiJS et demarre la boucle. */
  async init(canvas: HTMLCanvasElement): Promise<void> {
    const app = new Application();
    await app.init({
      canvas,
      resizeTo: window,
      background: PALETTE.waterDeep,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    this.renderer = new WorldRenderer(app);
    this.renderer.camera.snapTo(0, 0, CAMERA.defaultZoom);

    this.bindInput(canvas);
    window.addEventListener('resize', this.onResize);

    this.loop = new GameLoop({
      onUpdate: (dt) => this.onUpdate(dt),
      onRender: () => this.onRender(),
    });
    this.loop.start();
  }

  // --- Boucle ---------------------------------------------------------------

  private onUpdate(realDt: number): void {
    this.lastDt = realDt;
    this.applyKeyboardPan(realDt);

    const ticks = this.time.advance(realDt);
    for (let i = 0; i < ticks; i++) this.runTick(TICK_SECONDS);
    if (ticks > 0) this.state.totalTicks = this.time.tickCount;
  }

  /** Un pas de simulation deterministe. */
  private runTick(dt: number): void {
    this.tickAbility(dt);

    const completed = this.construction.update(this.state, dt);
    for (const id of completed) {
      const b = this.state.buildings[id];
      if (b) this.bus.emit('building:completed', { id, def: b.def });
    }
    const prepped = this.terrain.update(this.state, dt);
    for (const { key, yields } of prepped) {
      this.bus.emit('terrain:prepared', { key, yields });
      const loot = formatLoot(yields);
      this.bus.emit('notify', {
        message: loot
          ? `Terrain pret — recolte : ${loot}`
          : 'Terrain pret a construire !',
        kind: 'info',
      });
    }
    this.production.update(this.state, this.map, dt);
    this.population.update(this.state, dt);
    this.fishingBoats.update(this.state, this.map, dt);
    const scoutResult = this.scouts.update(this.state, this.map, dt);
    if (scoutResult.revealed >= 10) {
      this.bus.emit('notify', { message: 'Nouvelles eaux explorees !', kind: 'info' });
    }
    if (scoutResult.explorationFinished) {
      this.bus.emit('notify', {
        message: 'Exploration terminee — l eclaireur est de retour au port.',
        kind: 'info',
      });
    }

    const exp = this.expeditions.update(this.state, dt);
    for (const ev of exp.completed) {
      this.bus.emit('expedition:completed', ev);
      this.state.objectives.expeditionsCompleted++;
      const lootText = formatLoot(ev.loot);
      this.bus.emit('notify', {
        message: lootText ? `Butin recupere a ${ev.villageName} : ${lootText}` : `Raid sur ${ev.villageName} termine.`,
        kind: 'info',
      });
    }
    for (const id of exp.respawned) {
      const island = this.state.npcIslands.find((i) => i.id === id);
      if (island) {
        this.bus.emit('expedition:loot_respawned', { islandId: id, villageName: island.villageName });
      }
    }

    const milResult = this.military.update(this.state, dt);
    if (milResult?.defended) {
      this.bus.emit('notify', { message: 'Raid repousse ! La garnison a tenu.', kind: 'info' });
    } else if (milResult && !milResult.defended) {
      this.bus.emit('notify', {
        message: `Raid reussi par l ennemi — ${milResult.lostFood} nourriture perdue.`,
        kind: 'warn',
      });
    }

    const dipMsg = this.diplomacy.update(this.state, dt);
    if (dipMsg) this.bus.emit('notify', { message: dipMsg, kind: 'info' });

    const tut = this.tutorial.update(this.state);
    if (tut.advanced && tut.message) {
      this.bus.emit('tutorial:step', { title: tut.title ?? '', message: tut.message });
      this.bus.emit('notify', { message: tut.message, kind: 'info' });
    }

    const obj = this.objectives.update(this.state);
    if (obj) {
      this.bus.emit('objective:completed', { id: obj.completed, title: obj.title });
      this.bus.emit('notify', { message: `Objectif accompli : ${obj.title}`, kind: 'info' });
    }

    const rnd = this.randomEvents.update(this.state, dt);
    if (rnd) {
      this.bus.emit('random:event', rnd);
      this.bus.emit('notify', { message: `${rnd.title} — ${rnd.message}`, kind: 'warn' });
    }

    const queued = this.buildQueue.tryProcessNext(
      this.state,
      this.map,
      this.occupied,
      (buildingId) => this.findAutoBuildSector(buildingId),
    );
    if (queued) {
      this.bus.emit('building:placed', {
        id: queued.id,
        def: queued.placed,
        sector: this.state.buildings[queued.id]!.sector,
      });
    }

    this.bus.emit('state:changed', {});
  }

  /** Decremente la recharge et la duree du buff de la capacite active. */
  private tickAbility(dt: number): void {
    const ab = this.state.ability;
    if (ab.cooldownRemaining > 0) ab.cooldownRemaining = Math.max(0, ab.cooldownRemaining - dt);
    if (ab.buffRemaining > 0) ab.buffRemaining = Math.max(0, ab.buffRemaining - dt);
  }

  private onRender(): void {
    this.updateHover();
    this.renderer.render(this.state, this.map, this.lastDt);
  }

  // --- Entrees : souris -----------------------------------------------------

  private bindInput(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.pointerDown = true;
    this.dragged = false;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    // Clic droit : sortir du mode construction.
    if (e.button === 2) this.setBuildMode(null);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.pointerDown) {
      const dx = e.movementX;
      const dy = e.movementY;
      if (dx !== 0 || dy !== 0) {
        // Pan tant que le bouton est maintenu (sauf mode construction, ou le clic
        // sert a viser ; le bouton du milieu permet quand meme de se deplacer).
        if (this.buildMode === null || e.buttons === 4) {
          this.dragged = true;
          this.renderer.camera.panByScreen(dx, dy);
        }
      }
    }
    this.lastPointer = { x: e.clientX, y: e.clientY };
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.pointerDown) return;
    this.pointerDown = false;
    if (!this.dragged) this.handleClick(e.clientX, e.clientY);
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? CAMERA.zoomStep : 1 / CAMERA.zoomStep;
    this.renderer.camera.zoomAt(e.clientX, e.clientY, factor);
  };

  private handleClick(screenX: number, screenY: number): void {
    const world = this.renderer.camera.screenToWorld(screenX, screenY);
    const npcIsland = this.expeditions.islandAt(this.state, world.x, world.y, NPC_ISLAND_RADIUS);
    if (npcIsland && isWorldPointExplored(this.state, npcIsland.x, npcIsland.y)) {
      this.selectNpcIsland(npcIsland.id);
      return;
    }

    const sector = this.map.sectorAtPoint(world.x, world.y);
    if (!sector) {
      this.selectNpcIsland(null);
      return;
    }

    if (this.buildMode) {
      this.tryPlace(this.buildMode, sector);
      return;
    }
    const found = this.buildingAt(sector);
    if (found) {
      this.selectBuilding(found);
      return;
    }
    if (this.selectedId && this.tryMoveSelected(sector)) {
      return;
    }
    this.selectNpcIsland(null);
    this.tryPrepare(sector);
  }

  // --- Entrees : clavier ----------------------------------------------------

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.key.toLowerCase());
    switch (e.key.toLowerCase()) {
      case 'c':
        this.renderer.camera.recenter();
        break;
      case 'escape':
        this.setBuildMode(null);
        this.selectBuilding(null);
        this.selectNpcIsland(null);
        break;
      case ' ':
        e.preventDefault();
        this.togglePause();
        break;
      case '+':
      case '=':
        this.renderer.camera.zoomAt(window.innerWidth / 2, window.innerHeight / 2, CAMERA.zoomStep);
        break;
      case '-':
        this.renderer.camera.zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1 / CAMERA.zoomStep);
        break;
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase());
  };

  private applyKeyboardPan(dt: number): void {
    const speed = CAMERA.panSpeed * dt;
    let dx = 0;
    let dy = 0;
    if (this.keys.has('arrowleft') || this.keys.has('q')) dx -= speed;
    if (this.keys.has('arrowright') || this.keys.has('d')) dx += speed;
    if (this.keys.has('arrowup') || this.keys.has('z')) dy -= speed;
    if (this.keys.has('arrowdown') || this.keys.has('s')) dy -= speed;
    if (dx !== 0 || dy !== 0) this.renderer.camera.panByWorld(dx, dy);
  }

  // --- Survol / surbrillance ------------------------------------------------

  private updateHover(): void {
    const sector = this.screenToSector(this.lastPointer.x, this.lastPointer.y);
    if (!sector) {
      this.renderer.setHighlight(null, true);
      return;
    }
    if (this.buildMode) {
      const target = this.construction.effectivePlacementSector(
        this.buildMode,
        sector,
        this.state,
        this.map,
        this.occupied,
      );
      const valid = this.construction.canPlace(this.state, this.map, this.occupied, this.buildMode, target).ok;
      this.renderer.setHighlight(target, valid);
      return;
    }
    if (this.selectedId) {
      const selected = this.state.buildings[this.selectedId];
      if (selected && sectorKey(selected.sector) !== sectorKey(sector)) {
        const target = this.construction.effectivePlacementSector(
          selected.def,
          sector,
          this.state,
          this.map,
          this.occupied,
        );
        const valid = this.construction
          .canMove(this.state, this.map, this.occupied, this.selectedId, target)
          .ok;
        this.renderer.setHighlight(target, valid);
        return;
      }
    }
    if (this.buildingAt(sector)) {
      this.renderer.setHighlight(sector, true);
      return;
    }
    const valid =
      this.terrain.canPrepare(this.state, this.map, this.occupied, sector).ok ||
      this.terrain.isPrepared(this.state, sector);
    this.renderer.setHighlight(sector, valid);
  }

  private screenToSector(screenX: number, screenY: number): SectorCoord | null {
    const world = this.renderer.camera.screenToWorld(screenX, screenY);
    return this.map.sectorAtPoint(world.x, world.y);
  }

  private buildingAt(sector: SectorCoord): string | null {
    const key = sectorKey(sector);
    for (const b of Object.values(this.state.buildings)) {
      if (sectorKey(b.sector) === key) return b.id;
    }
    return null;
  }

  // --- Actions de jeu (API publique pour l'UI) ------------------------------

  setBuildMode(building: BuildingId | null): void {
    this.buildMode = building;
    if (building) {
      this.selectBuilding(null);
      this.selectNpcIsland(null);
    }
    this.bus.emit('buildmode:changed', { building });
  }

  get currentBuildMode(): BuildingId | null {
    return this.buildMode;
  }

  selectBuilding(id: string | null): void {
    this.selectedId = id;
    if (id) this.selectNpcIsland(null);
    this.bus.emit('building:selected', { id });
  }

  get selectedBuilding(): string | null {
    return this.selectedId;
  }

  selectNpcIsland(id: string | null): void {
    if (id) {
      const island = this.state.npcIslands.find((i) => i.id === id);
      if (!island || !isNpcIslandActive(island)) id = null;
    }
    this.selectedNpcIslandId = id;
    if (id) this.selectBuilding(null);
    this.renderer.setSelectedNpcIsland(id);
    this.bus.emit('npcIsland:selected', { id });
  }

  get selectedNpcIsland(): string | null {
    return this.selectedNpcIslandId;
  }

  startExpedition(islandId: string): void {
    const island = this.state.npcIslands.find((i) => i.id === islandId);
    const result = this.expeditions.startExpedition(this.state, islandId);
    if (!result.ok) {
      this.notifyExpeditionFailure(result.reason);
      return;
    }
    this.bus.emit('expedition:started', { islandId, villageName: island?.villageName ?? 'Ile' });
    this.bus.emit('notify', {
      message: `Expedition lancee vers ${island?.villageName ?? "l'ile"} !`,
      kind: 'info',
    });
  }

  canStartExpedition(islandId: string): boolean {
    return this.expeditions.canStartExpedition(this.state, islandId).ok;
  }

  private notifyExpeditionFailure(reason: string): void {
    const messages: Record<string, string> = {
      not_found: 'Ile introuvable.',
      already_raiding: 'Raid deja en cours sur cette ile.',
      expedition_active: 'Une expedition est deja en cours.',
      no_loot: 'Aucun butin disponible sur cette ile.',
      on_cooldown: 'Butin epuise — regeneration en cours.',
    };
    this.bus.emit('notify', { message: messages[reason] ?? 'Expedition impossible.', kind: 'warn' });
  }

  private tryPlace(building: BuildingId, sector: SectorCoord): void {
    sector = this.construction.effectivePlacementSector(
      building,
      sector,
      this.state,
      this.map,
      this.occupied,
    );
    const result = this.construction.place(this.state, this.map, this.occupied, building, sector);
    if (!result.ok) {
      this.notifyPlaceFailure(result.reason);
      return;
    }
    this.occupied.add(sectorKey(sector));
    this.state.preparedSectors[sectorKey(sector)] = true;
    this.expandIfNeeded(sector, building);
    this.bus.emit('building:placed', { id: result.id, def: building, sector });
  }

  private notifyPlaceFailure(reason: string): void {
    const messages: Record<string, string> = {
      cannot_afford: 'Ressources insuffisantes.',
      placement_invalid: 'Emplacement invalide (doit toucher la ville).',
      locked: 'Technologie ou age requis — ouvrez l arbre (T).',
      not_buildable: 'Ce batiment ne peut pas etre construit.',
      not_prepared: 'Terrain non prepare : cliquez pour defricher ou aplatir.',
      terrain_preparing: 'Preparation du terrain en cours.',
      sea_access_reserved: 'Acces a la mer reserve par un port.',
      not_shore: 'Le port doit etre construit sur la lisiere (dernier anneau).',
      spoke_occupied: 'La ligne vers la mer doit etre libre de batiments.',
    };
    this.bus.emit('notify', { message: messages[reason] ?? 'Construction impossible.', kind: 'warn' });
  }

  private tryPrepare(sector: SectorCoord): void {
    if (this.terrain.isPrepared(this.state, sector)) {
      this.bus.emit('notify', { message: 'Terrain pret — choisissez un batiment.', kind: 'info' });
      return;
    }
    if (this.terrain.isPreparing(this.state, sector)) {
      const job = this.terrain.prepJobAt(this.state, sector)!;
      const def = TERRAIN_PREP[job.kind];
      const pct = Math.min(100, Math.floor((job.progress / def.time) * 100));
      this.bus.emit('notify', { message: `${def.verb} en cours (${pct} %).`, kind: 'info' });
      return;
    }
    const result = this.terrain.startPrepare(this.state, this.map, this.occupied, sector);
    if (!result.ok) {
      this.notifyPrepFailure(result.reason);
      return;
    }
    const kind = this.terrain.terrainKindAt(sector);
    const def = TERRAIN_PREP[kind];
    const loot = formatLoot(def.yields);
    this.bus.emit('terrain:prep_started', { sector, kind });
    this.bus.emit('notify', {
      message: loot ? `${def.verb} lance — recolte prevue : ${loot}` : `${def.verb} lance !`,
      kind: 'info',
    });
  }

  private notifyPrepFailure(reason: string): void {
    const messages: Record<string, string> = {
      invalid: 'Secteur invalide.',
      center_reserved: 'Le centre est reserve.',
      occupied: 'Secteur deja occupe.',
      already_prepared: 'Terrain deja prepare.',
      already_preparing: 'Preparation deja en cours.',
      not_adjacent: 'Doit toucher un terrain prepare ou un batiment.',
      cannot_afford: 'Ressources insuffisantes pour preparer le terrain.',
      sea_access_reserved: 'Corridor maritime reserve — acces au port.',
    };
    this.bus.emit('notify', { message: messages[reason] ?? 'Preparation impossible.', kind: 'warn' });
  }

  /** Deplace le batiment selectionne vers un secteur libre valide. */
  private tryMoveSelected(sector: SectorCoord): boolean {
    if (!this.selectedId) return false;
    const b = this.state.buildings[this.selectedId];
    if (!b) return false;

    const fromKey = sectorKey(b.sector);
    const result = this.construction.move(this.state, this.map, this.occupied, this.selectedId, sector);
    if (!result.ok) {
      this.notifyMoveFailure(result.reason);
      return false;
    }

    this.occupied.delete(fromKey);
    this.occupied.add(sectorKey(result.to));
    this.expandIfNeeded(result.to, b.def);

    const def = BUILDINGS[b.def];
    this.bus.emit('building:moved', {
      id: this.selectedId,
      def: b.def,
      from: result.from,
      to: result.to,
    });
    this.bus.emit('notify', {
      message: `${def.name} deplace.`,
      kind: 'info',
    });
    return true;
  }

  private notifyMoveFailure(reason: string): void {
    const messages: Record<string, string> = {
      not_found: 'Batiment introuvable.',
      immovable: 'Ce batiment ne peut pas etre deplace.',
      same_sector: 'Deja sur cette case.',
      not_shore: 'Doit etre pose sur la lisiere (mer).',
      spoke_occupied: 'L acces a la mer est bloque sur cette colonne.',
      placement_invalid: 'Emplacement invalide pour deplacer ici.',
      not_prepared: 'Terrain non prepare.',
      terrain_preparing: 'Terrain en cours de preparation.',
      sea_access_reserved: 'Corridor maritime reserve — acces au port.',
    };
    this.bus.emit('notify', { message: messages[reason] ?? 'Deplacement impossible.', kind: 'warn' });
  }

  /** Annule/demolit le batiment selectionne. */
  demolishSelected(): void {
    if (!this.selectedId) return;
    const b = this.state.buildings[this.selectedId];
    if (!b) return;
    const sector = b.sector;
    if (this.construction.cancel(this.state, this.selectedId)) {
      this.occupied.delete(sectorKey(sector));
      this.bus.emit('building:cancelled', { id: this.selectedId });
      this.selectBuilding(null);
    }
  }

  /** Ameliore le batiment selectionne (niveau + productivite). */
  upgradeSelected(): void {
    if (!this.selectedId) return;
    const b = this.state.buildings[this.selectedId];
    if (!b) return;
    const result = this.upgrades.upgrade(this.state, this.selectedId);
    if (!result.ok) {
      this.notifyUpgradeFailure(result.reason);
      return;
    }
    const def = BUILDINGS[b.def];
    this.bus.emit('building:upgraded', { id: this.selectedId, def: b.def, level: result.level });
    this.bus.emit('notify', {
      message: `${def.name} ameliore — niveau ${result.level}`,
      kind: 'info',
    });
  }

  canUpgradeSelected(): boolean {
    if (!this.selectedId) return false;
    return this.upgrades.canUpgrade(this.state, this.selectedId).ok;
  }

  upgradeCostSelected(): ResourceAmounts {
    if (!this.selectedId) return {};
    const b = this.state.buildings[this.selectedId];
    if (!b) return {};
    return this.upgrades.effectiveCost(this.state, b.def, b.level);
  }

  private notifyUpgradeFailure(reason: string): void {
    const messages: Record<string, string> = {
      not_found: 'Batiment introuvable.',
      incomplete: 'Chantier non termine.',
      not_upgradeable: 'Ce batiment ne peut pas etre ameliore.',
      max_level: 'Niveau maximum atteint.',
      cannot_afford: 'Ressources insuffisantes pour ameliorer.',
    };
    this.bus.emit('notify', { message: messages[reason] ?? 'Amelioration impossible.', kind: 'warn' });
  }

  /** Genere un anneau de plus si on construit sur l'avant-dernier anneau. */
  private expandIfNeeded(sector: SectorCoord, buildingId?: BuildingId): void {
    if (buildingId && BUILDINGS[buildingId].shoreRequired) return;
    if (sector.ring >= this.state.ringCount) {
      this.state.ringCount += 1;
      this.map.setRingCount(this.state.ringCount);
      refreshShoreSeaExploration(this.state, ringOuterRadius(this.state.ringCount));
      this.applyNpcIslandAbsorption();
    }
  }

  /** Fusionne les iles PNJ touchees par l'expansion du rivage. */
  private applyNpcIslandAbsorption(): void {
    const absorbed = syncNpcIslandAbsorption(this.state, this.map.outerRadius);
    for (const id of absorbed) {
      if (this.selectedNpcIslandId === id) this.selectNpcIsland(null);
      const island = this.state.npcIslands.find((i) => i.id === id);
      this.bus.emit('notify', {
        message: `${island?.villageName ?? 'Une ile'} a rejoint votre territoire.`,
        kind: 'info',
      });
    }
  }

  /** Recherche : passage a l'age suivant si conditions remplies. */
  researchNextAge(): void {
    const result = this.ages.advance(this.state);
    if (result.advanced && result.to) {
      this.bus.emit('age:advanced', { from: result.from, to: result.to });
      const ability = AGE_ABILITIES[result.to];
      this.bus.emit('notify', {
        message: `Nouvel age : ${AGES[result.to].name} ! Recherchez la maitrise pour debloquer ${ability.name} (T).`,
        kind: 'info',
      });
    } else {
      this.bus.emit('notify', { message: 'Conditions non remplies pour evoluer.', kind: 'warn' });
    }
  }

  canResearch(): boolean {
    return this.ages.canAdvance(this.state);
  }

  ageProgress(): number {
    return this.ages.scienceProgress(this.state);
  }

  // --- Technologies ---------------------------------------------------------

  techStatus(techId: TechId): TechStatus {
    return this.tech.status(this.state, techId);
  }

  canResearchTech(techId: TechId): boolean {
    return this.tech.canResearch(this.state, techId).ok;
  }

  researchTech(techId: TechId): void {
    const result = this.tech.research(this.state, techId);
    if (!result.ok) {
      this.notifyTechFailure(result.reason);
      return;
    }
    const def = TECHNOLOGIES[techId];
    syncUnlockedAbilitiesFromTechs(this.state);
    const names = def.unlocks.map((b) => BUILDINGS[b].name);
    if (def.unlocksAbility) {
      const ability = AGE_ABILITIES[def.unlocksAbility];
      this.bus.emit('tech:researched', { id: techId, name: def.name, unlocks: [ability.name] });
      this.bus.emit('notify', {
        message: `${def.name} maitrisee — competence debloquee : ${ability.name}`,
        kind: 'info',
      });
      return;
    }
    this.bus.emit('tech:researched', { id: techId, name: def.name, unlocks: names });
    this.bus.emit('notify', {
      message: `${def.name} maitrisee — debloque : ${names.join(', ') || '—'}`,
      kind: 'info',
    });
  }

  private notifyTechFailure(reason: string): void {
    const messages: Record<string, string> = {
      not_found: 'Technologie introuvable.',
      already_researched: 'Technologie deja maitrisee.',
      age_locked: 'Age insuffisant pour cette recherche.',
      prerequisites: 'Prerequis technologiques manquants.',
      cannot_afford: 'Science insuffisante.',
    };
    this.bus.emit('notify', { message: messages[reason] ?? 'Recherche impossible.', kind: 'warn' });
  }

  // --- Capacite active de la civilisation -----------------------------------

  /** Declenche la competence active de l ere courante si debloquee. */
  activateAbility(): void {
    const ability = activeAgeAbility(this.state);
    if (!ability) {
      this.bus.emit('notify', {
        message: 'Competence verrouillee — recherchez la maitrise de votre ere (T).',
        kind: 'warn',
      });
      return;
    }

    const ab = this.state.ability;
    if (ab.cooldownRemaining > 0) {
      this.bus.emit('notify', { message: 'Competence en recharge.', kind: 'warn' });
      return;
    }

    const effect = ability.effect;

    switch (effect.kind) {
      case 'grant': {
        recomputeCapacities(this.state);
        for (const [res, amount] of Object.entries(effect.resources)) {
          credit(this.state, res as keyof GameState['resources'], amount as number);
        }
        break;
      }
      case 'complete_constructions': {
        const done = this.construction.completeAll(this.state);
        for (const id of done) {
          const b = this.state.buildings[id];
          if (b) this.bus.emit('building:completed', { id, def: b.def });
        }
        break;
      }
      case 'production_buff': {
        ab.buffRemaining = effect.duration;
        ab.buffMultiplier = effect.multiplier;
        break;
      }
    }

    ab.cooldownRemaining = ability.cooldown;
    this.bus.emit('ability:used', { name: ability.name });
    this.bus.emit('notify', { message: `${ability.name} activee !`, kind: 'info' });
  }

  /** Etat de la competence active de l ere courante pour l'UI. */
  getAbilityStatus(): {
    name: string;
    description: string;
    ready: boolean;
    locked: boolean;
    ageId: AgeAbilityId;
    themeColor: number;
    remaining: number;
    total: number;
    buffRemaining: number;
  } {
    const ab = this.state.ability;
    const ageId = this.state.age;
    const def = AGE_ABILITIES[ageId];
    const unlocked = !!this.state.unlockedAbilities[ageId];

    return {
      name: def.name,
      description: def.description,
      locked: !unlocked,
      ready: unlocked && ab.cooldownRemaining <= 0,
      ageId,
      themeColor: abilityThemeColor(ageId),
      remaining: ab.cooldownRemaining,
      total: def.cooldown,
      buffRemaining: ab.buffRemaining,
    };
  }

  getCiv(): CivId {
    return this.state.civ;
  }

  // --- Camera -------------------------------------------------------------

  recenter(): void {
    this.renderer.camera.recenter();
  }

  // --- Temps ---------------------------------------------------------------

  togglePause(): boolean {
    const paused = this.time.togglePause();
    this.bus.emit('notify', {
      message: paused ? 'Jeu en pause.' : 'Jeu repris.',
      kind: 'info',
    });
    return paused;
  }

  isPaused(): boolean {
    return this.time.isPaused;
  }

  setSpeed(multiplier: import('@/core/TimeManager').SpeedMultiplier): void {
    this.time.setSpeed(multiplier);
    if (multiplier > 0) {
      this.bus.emit('notify', { message: `Vitesse ${multiplier}x`, kind: 'info' });
    }
  }

  getSpeed(): import('@/core/TimeManager').SpeedMultiplier {
    return this.time.speed;
  }

  cycleSpeed(): import('@/core/TimeManager').SpeedMultiplier {
    const spd = this.time.cycleSpeed();
    this.bus.emit('notify', { message: `Vitesse ${spd}x`, kind: 'info' });
    return spd;
  }

  // --- Partie -------------------------------------------------------------

  /** Demarre une nouvelle session avec la civilisation et l'identite du joueur. */
  startNewGame(civ: CivId, identity?: PlayerIdentity): void {
    const id = identity ?? {
      chiefName: this.state.chiefName,
      villageName: this.state.villageName,
    };
    this.adoptState(createNewGame(civ, id));
    this.bus.emit('notify', {
      message: `${id.villageName} : nouvelle ere sous ${id.chiefName} !`,
      kind: 'info',
    });
    this.bus.emit('state:changed', {});
  }

  /** Restaure une partie depuis une sauvegarde. */
  loadSavedState(state: GameState): void {
    this.adoptState(state);
    this.bus.emit('notify', {
      message: `${state.villageName} : session reprise.`,
      kind: 'info',
    });
    this.bus.emit('state:changed', {});
  }

  /** Demande l'ouverture de l'ecran d'accueil (gere par main/StartScreen). */
  openMenu(): void {
    this.bus.emit('menu:open', {});
  }

  private adoptState(state: GameState): void {
    if (!state.exploredSea || Object.keys(state.exploredSea).length === 0) {
      state.exploredSea = state.exploredSea ?? {};
      seedInitialSeaExploration(state, ringOuterRadius(state.ringCount));
    }
    if (!state.scoutBoats) state.scoutBoats = {};
    if (state.nextScoutId === undefined) state.nextScoutId = 0;
    ensureWorkerAllocationState(state);
    ensureGameMetaState(state);
    if (!state.unlockedAbilities) state.unlockedAbilities = {};
    syncUnlockedAbilitiesFromTechs(state);
    this.state = state;
    this.map.setRingCount(state.ringCount);
    syncNpcIslandAbsorption(state, ringOuterRadius(state.ringCount));
    this.occupied = computeOccupancy(state);
    this.time.restore(state.totalTicks);
    this.setBuildMode(null);
    this.selectBuilding(null);
    this.selectNpcIsland(null);
    if (this.renderer) this.renderer.camera.recenter();
    pushColonyToWorld(this.world, this.playerId, this.state);
  }

  // --- Main-d'oeuvre --------------------------------------------------------

  /** Statistiques de repartition par secteur economique. */
  getWorkerSectorStats(): WorkerSectorStats[] {
    return workerSectorStats(this.state);
  }

  /** Active ou desactive la repartition manuelle par curseurs. */
  setManualWorkerAllocation(manual: boolean): void {
    this.state.population.manualWorkerAllocation = manual;
    assignWorkers(this.state);
  }

  /** Modifie le pourcentage cible d'un secteur (reequilibre les autres). */
  setWorkerSectorShare(sector: WorkerSector, pct: number): void {
    this.state.population.manualWorkerAllocation = true;
    this.state.population.workerSectorShare = adjustWorkerShare(
      this.state.population.workerSectorShare,
      sector,
      pct,
    );
    assignWorkers(this.state);
  }

  /** Ajoute un batiment a la file de construction. */
  enqueueBuilding(buildingId: BuildingId): void {
    if (
      this.executeCommand({ type: 'enqueue_build', building: buildingId })
    ) {
      this.bus.emit('notify', {
        message: `${BUILDINGS[buildingId].name} ajoute a la file.`,
        kind: 'info',
      });
    }
  }

  proposeAlliance(islandId: string): void {
    const result = this.diplomacy.proposeAlliance(this.state, islandId);
    this.bus.emit('notify', { message: result.message, kind: result.ok ? 'info' : 'warn' });
  }

  tradeWithIsland(islandId: string): void {
    const island = this.state.npcIslands.find((i) => i.id === islandId);
    if (!island) return;
    const result = this.diplomacy.tradeWithAlly(this.state, island);
    this.bus.emit('notify', { message: result.message, kind: result.ok ? 'info' : 'warn' });
  }

  getTutorialStep(): { title: string; message: string } | null {
    return this.tutorial.currentStep(this.state);
  }

  getActiveObjective(): { id: string; title: string; description: string } | null {
    return this.objectives.activeObjective(this.state);
  }

  /** Trouve un secteur libre pour construction automatique (file). */
  private findAutoBuildSector(buildingId: BuildingId): SectorCoord | null {
    for (let ring = 1; ring <= this.state.ringCount; ring++) {
      const ringDef = this.map.getRing(ring);
      if (!ringDef) continue;
      for (let index = 0; index < ringDef.sectorCount; index++) {
        const sector = { ring, index };
        const target = this.construction.effectivePlacementSector(
          buildingId,
          sector,
          this.state,
          this.map,
          this.occupied,
        );
        if (this.construction.canPlace(this.state, this.map, this.occupied, buildingId, target).ok) {
          return target;
        }
      }
    }
    return null;
  }

  // --- Acces lecture (pour l'UI) -------------------------------------------

  getState(): Readonly<GameState> {
    return this.state;
  }

  /** Bilan entrees / sorties d une ressource (infobulle HUD). */
  getResourceFlow(id: ResourceId): ResourceFlowSnapshot {
    recomputeCapacities(this.state);
    return computeResourceFlows(this.state, this.map)[id];
  }

  /** Bonus de synergie pour un batiment selectionne (UI). */
  getBuildingSynergyInfo(
    buildingId: string,
  ): { groupLabel: string; neighbors: number; bonusPct: number } | null {
    const b = this.state.buildings[buildingId];
    if (!b?.complete) return null;
    const group = BUILDINGS[b.def].synergyGroup;
    if (!group) return null;
    const neighbors = countSynergyNeighbors(this.state, this.map, buildingId);
    const mult = synergyMultiplier(this.state, this.map, buildingId);
    return {
      groupLabel: SYNERGY_GROUP_LABELS[group],
      neighbors,
      bonusPct: Math.round((mult - 1) * 100),
    };
  }

  getFps(): number {
    return this.loop.currentFps;
  }

  getZoom(): number {
    return this.renderer.camera.currentZoom;
  }

  /** Cout d'un batiment (pour l'affichage UI). */
  costOf(building: BuildingId): Readonly<Record<string, number>> {
    return BUILDINGS[building].cost as Record<string, number>;
  }

  /** Icone procedurale du batiment pour le menu construction. */
  getBuildingIconUrl(building: BuildingId): string {
    return this.renderer.getBuildingIconDataUrl(building);
  }

  private onResize = (): void => {
    this.renderer.resize(window.innerWidth, window.innerHeight);
  };

  /** Resolution de design (reference). */
  get designSize(): { width: number; height: number } {
    return { width: DESIGN_WIDTH, height: DESIGN_HEIGHT };
  }
}

function formatLoot(loot: Record<string, number>): string {
  const parts: string[] = [];
  for (const [res, amt] of Object.entries(loot)) {
    if (amt > 0) parts.push(`${formatResourceAmount(amt)} ${res}`);
  }
  return parts.join(', ');
}
