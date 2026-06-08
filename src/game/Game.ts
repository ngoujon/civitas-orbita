/**
 * Game : orchestrateur central.
 *
 * Assemble l'etat (GameState), les systemes de simulation, la carte du monde,
 * le rendu (PixiJS) et la boucle de jeu. Gere les entrees (souris/clavier) et
 * la sauvegarde. C'est la seule classe qui connait toutes les couches.
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
import type { GameSpeed } from '@/config/game';
import type { BuildingId } from '@/config/buildings';
import { BUILDINGS } from '@/config/buildings';
import { DEFAULT_CIV, getCivDef } from '@/config/civilizations';
import type { CivId } from '@/config/civilizations';

import { EventBus, GameLoop, SaveSystem, TimeManager } from '@/core';
import { WorldMap } from '@/world/WorldMap';
import { sectorKey } from '@/world/Sector';
import type { SectorCoord } from '@/world/Sector';

import { ProductionSystem } from '@/economy/ProductionSystem';
import { PopulationSystem } from '@/population/PopulationSystem';
import { credit, recomputeCapacities } from '@/economy/ResourceManager';
import { AgeSystem } from '@/research/AgeSystem';
import { ConstructionSystem } from '@/buildings/ConstructionSystem';

import { WorldRenderer } from '@/rendering/WorldRenderer';

import { computeOccupancy, createNewGame } from './GameState';
import type { GameState } from './GameState';
import type { GameEvents } from './events';

const SAVE_VERSION = 2;
const SAVE_KEY = 'civitas-orbita:save';

/** Migration v1 -> v2 : ajoute la civilisation et l'etat de capacite active. */
function migrateV1toV2(raw: unknown): unknown {
  const s = raw as Record<string, unknown>;
  return {
    ...s,
    civ: DEFAULT_CIV,
    ability: { cooldownRemaining: 0, buffRemaining: 0, buffMultiplier: 1 },
  };
}

export class Game {
  readonly bus = new EventBus<GameEvents>();
  readonly time = new TimeManager();

  private state: GameState;
  private map: WorldMap;
  private occupied: Set<string>;

  private readonly production = new ProductionSystem();
  private readonly population = new PopulationSystem();
  private readonly ages = new AgeSystem();
  private readonly construction = new ConstructionSystem();

  private readonly saveSystem = new SaveSystem<GameState>({
    storageKey: SAVE_KEY,
    currentVersion: SAVE_VERSION,
    migrations: { 1: migrateV1toV2 },
  });

  private renderer!: WorldRenderer;
  private loop!: GameLoop;
  private lastDt = 0;

  // Entrees.
  private buildMode: BuildingId | null = null;
  private selectedId: string | null = null;
  private pointerDown = false;
  private dragged = false;
  private lastPointer = { x: 0, y: 0 };
  private readonly keys = new Set<string>();

  constructor() {
    this.state = createNewGame();
    this.map = new WorldMap(this.state.ringCount);
    this.occupied = computeOccupancy(this.state);
  }

  /** Initialise PixiJS et demarre la boucle. */
  async init(canvas: HTMLCanvasElement): Promise<void> {
    const app = new Application();
    await app.init({
      canvas,
      resizeTo: window,
      background: PALETTE.water,
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
    this.production.update(this.state, dt);
    this.population.update(this.state, dt);
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
    const sector = this.screenToSector(screenX, screenY);
    if (!sector) return;

    if (this.buildMode) {
      this.tryPlace(this.buildMode, sector);
      return;
    }
    // Selection d'un batiment (pour demolir / infos).
    const found = this.buildingAt(sector);
    this.selectBuilding(found);
  }

  // --- Entrees : clavier ----------------------------------------------------

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.key.toLowerCase());
    switch (e.key.toLowerCase()) {
      case ' ':
        this.time.togglePause();
        break;
      case 'c':
        this.renderer.camera.recenter();
        break;
      case 'escape':
        this.setBuildMode(null);
        this.selectBuilding(null);
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
    if (this.keys.has('arrowleft') || this.keys.has('a')) dx -= speed;
    if (this.keys.has('arrowright') || this.keys.has('d')) dx += speed;
    if (this.keys.has('arrowup') || this.keys.has('w')) dy -= speed;
    if (this.keys.has('arrowdown') || this.keys.has('s')) dy += speed;
    if (dx !== 0 || dy !== 0) this.renderer.camera.panByWorld(dx, dy);
  }

  // --- Survol / surbrillance ------------------------------------------------

  private updateHover(): void {
    const sector = this.screenToSector(this.lastPointer.x, this.lastPointer.y);
    if (!sector || !this.buildMode) {
      this.renderer.setHighlight(sector, true);
      return;
    }
    const valid = this.construction.canPlace(this.state, this.map, this.occupied, this.buildMode, sector).ok;
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
    if (building) this.selectBuilding(null);
    this.bus.emit('buildmode:changed', { building });
  }

  get currentBuildMode(): BuildingId | null {
    return this.buildMode;
  }

  selectBuilding(id: string | null): void {
    this.selectedId = id;
    this.bus.emit('building:selected', { id });
  }

  get selectedBuilding(): string | null {
    return this.selectedId;
  }

  private tryPlace(building: BuildingId, sector: SectorCoord): void {
    const result = this.construction.place(this.state, this.map, this.occupied, building, sector);
    if (!result.ok) {
      this.notifyPlaceFailure(result.reason);
      return;
    }
    this.occupied.add(sectorKey(sector));
    this.expandIfNeeded(sector);
    this.bus.emit('building:placed', { id: result.id, def: building, sector });
  }

  private notifyPlaceFailure(reason: string): void {
    const messages: Record<string, string> = {
      cannot_afford: 'Ressources insuffisantes.',
      placement_invalid: 'Emplacement invalide (doit toucher la ville).',
      locked: 'Batiment non debloque a cet age.',
      not_buildable: 'Ce batiment ne peut pas etre construit.',
    };
    this.bus.emit('notify', { message: messages[reason] ?? 'Construction impossible.', kind: 'warn' });
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

  /** Genere un anneau de plus si on construit sur l'avant-dernier anneau. */
  private expandIfNeeded(sector: SectorCoord): void {
    if (sector.ring >= this.state.ringCount) {
      this.state.ringCount += 1;
      this.map.setRingCount(this.state.ringCount);
    }
  }

  /** Recherche : passage a l'age suivant si conditions remplies. */
  researchNextAge(): void {
    const result = this.ages.advance(this.state);
    if (result.advanced && result.to) {
      this.bus.emit('age:advanced', { from: result.from, to: result.to });
      this.bus.emit('notify', { message: `Nouvel age : ${result.to} !`, kind: 'info' });
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

  // --- Capacite active de la civilisation -----------------------------------

  /** Declenche la capacite active si elle est rechargee. */
  activateAbility(): void {
    const ab = this.state.ability;
    if (ab.cooldownRemaining > 0) {
      this.bus.emit('notify', { message: 'Capacite en recharge.', kind: 'warn' });
      return;
    }
    const civ = getCivDef(this.state.civ);
    const effect = civ.ability.effect;

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

    ab.cooldownRemaining = civ.ability.cooldown;
    this.bus.emit('ability:used', { name: civ.ability.name });
    this.bus.emit('notify', { message: `${civ.ability.name} activee !`, kind: 'info' });
  }

  /** Etat de la capacite active pour l'UI. */
  getAbilityStatus(): { name: string; ready: boolean; remaining: number; total: number; buffRemaining: number } {
    const civ = getCivDef(this.state.civ);
    const ab = this.state.ability;
    return {
      name: civ.ability.name,
      ready: ab.cooldownRemaining <= 0,
      remaining: ab.cooldownRemaining,
      total: civ.ability.cooldown,
      buffRemaining: ab.buffRemaining,
    };
  }

  getCiv(): CivId {
    return this.state.civ;
  }

  // --- Vitesse / camera -----------------------------------------------------

  setSpeed(speed: GameSpeed): void {
    this.time.setSpeed(speed);
  }

  togglePause(): void {
    this.time.togglePause();
  }

  recenter(): void {
    this.renderer.camera.recenter();
  }

  // --- Sauvegarde -----------------------------------------------------------

  save(): void {
    this.saveSystem.save(this.state);
    this.bus.emit('notify', { message: 'Partie sauvegardee.', kind: 'info' });
  }

  load(): void {
    const loaded = this.saveSystem.load();
    if (!loaded) {
      this.bus.emit('notify', { message: 'Aucune sauvegarde trouvee.', kind: 'warn' });
      return;
    }
    this.adoptState(loaded);
    this.bus.emit('notify', { message: 'Partie chargee.', kind: 'info' });
  }

  hasSave(): boolean {
    return this.saveSystem.hasSave();
  }

  /** Demarre une nouvelle partie avec la civilisation choisie. */
  startNewGame(civ: CivId): void {
    this.adoptState(createNewGame(civ));
    this.save();
    this.bus.emit('notify', { message: `${getCivDef(civ).name} : nouvelle partie !`, kind: 'info' });
  }

  /** Charge la sauvegarde existante (reprise de partie). */
  continueGame(): boolean {
    const loaded = this.saveSystem.load();
    if (!loaded) return false;
    this.adoptState(loaded);
    return true;
  }

  /** Demande l'ouverture de l'ecran d'accueil (gere par main/StartScreen). */
  openMenu(): void {
    this.bus.emit('menu:open', {});
  }

  private adoptState(state: GameState): void {
    this.state = state;
    this.map.setRingCount(state.ringCount);
    this.occupied = computeOccupancy(state);
    this.time.restore(state.totalTicks);
    this.setBuildMode(null);
    this.selectBuilding(null);
    this.renderer.camera.recenter();
  }

  // --- Acces lecture (pour l'UI) -------------------------------------------

  getState(): Readonly<GameState> {
    return this.state;
  }

  getFps(): number {
    return this.loop.currentFps;
  }

  getSpeed(): GameSpeed {
    return this.time.currentSpeed;
  }

  getZoom(): number {
    return this.renderer.camera.currentZoom;
  }

  /** Cout d'un batiment (pour l'affichage UI). */
  costOf(building: BuildingId): Readonly<Record<string, number>> {
    return BUILDINGS[building].cost as Record<string, number>;
  }

  private onResize = (): void => {
    this.renderer.resize(window.innerWidth, window.innerHeight);
  };

  /** Resolution de design (reference). */
  get designSize(): { width: number; height: number } {
    return { width: DESIGN_WIDTH, height: DESIGN_HEIGHT };
  }
}
