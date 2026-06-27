/**
 * WorldRenderer : rend l'etat du jeu via PixiJS.
 *
 * OBSERVATEUR de GameState : il lit l'etat, ne le mute JAMAIS.
 *
 * Couches (Containers) pour minimiser les draw calls :
 *  - seaLayer     : mer procedurale animee (tuiles + vagues au rivage)
 *  - terrainLayer     : anneaux/secteurs (Graphics statique, redessine si la carte change)
 *  - terrainPrepLayer : etat sauvage / preparation / sol pret
 *  - pathsLayer       : chemins de terre entre batiments voisins
 *  - overlayLayer : surbrillance du secteur survole (apercu de construction)
 *  - entityLayer  : batiments, decor (props) et villageois, tries en profondeur par y
 *  - fxLayer      : effets animes (flammes, lueur, fumee), redessine chaque frame
 *
 * Optimisations : textures procedurales cachees, culling par viewport,
 * tri en profondeur (zIndex = y), reutilisation/diff des sprites, decor
 * deterministe (seede par secteur) regenere uniquement au besoin.
 */

import { Application, Container, Graphics, Sprite } from 'pixi.js';
import { BUILDING_DISPLAY, PALETTE } from '@/config/game';
import type { BuildingId } from '@/config/buildings';
import { BUILDINGS } from '@/config/buildings';
import { TERRAIN_PREP } from '@/config/terrain';
import type { GameState } from '@/game/GameState';
import type { WorldMap } from '@/world/WorldMap';
import { terrainKindAt } from '@/world/Terrain';
import type { SectorCoord } from '@/world/Sector';
import { sectorKey, buildingDisplayPosition } from '@/world/Sector';
import { blockedSeaAccessKeys } from '@/world/SeaAccess';
import { Camera } from './Camera';
import { BASE_ANCHOR, ProceduralSprites } from './ProceduralSprites';
import type { PropName } from './ProceduralSprites';
import { drawBuildingPaths, pathsSignature } from './PathRenderer';
import { drawSynergyPaths } from './SynergyPathRenderer';
import { SeaRenderer } from './SeaRenderer';
import { SeaFogRenderer } from './SeaFogRenderer';
import { VillagerRenderer } from './VillagerRenderer';
import { FishingBoatRenderer } from './FishingBoatRenderer';
import { ScoutBoatRenderer } from './ScoutBoatRenderer';
import { NpcIslandRenderer } from './NpcIslandRenderer';
import { drawBeachGround, drawPreparedSectorGround, drawRichSectorGround } from './TerrainGroundRenderer';

interface HighlightState {
  coord: SectorCoord | null;
  valid: boolean;
}

const DEMOLISH_TINT = 0xff2222;

const PROP_NAMES: PropName[] = ['tree', 'pine', 'rock', 'bush', 'flower', 'grass'];
const POP_DURATION = 0.35; // secondes pour l'animation d'apparition

export class WorldRenderer {
  readonly app: Application;
  readonly camera: Camera;

  private readonly world = new Container();
  private readonly terrainLayer = new Graphics();
  private readonly terrainPrepLayer = new Graphics();
  private readonly pathsLayer = new Graphics();
  private readonly overlayLayer = new Graphics();
  private readonly entityLayer = new Container();
  private readonly fxLayer = new Graphics();

  private readonly sprites: ProceduralSprites;
  private readonly sea: SeaRenderer;
  private readonly seaFog: SeaFogRenderer;
  private readonly npcIslands: NpcIslandRenderer;
  private readonly fishingBoats: FishingBoatRenderer;
  private readonly scoutBoats: ScoutBoatRenderer;
  private readonly villagers: VillagerRenderer;
  private readonly buildingSprites = new Map<string, Sprite>();
  private readonly spawnTime = new Map<string, number>();
  private propSprites: Sprite[] = [];

  private highlight: HighlightState = { coord: null, valid: true };
  private demolishMarked: ReadonlySet<string> = new Set();
  private lastTerrainRings = -1;
  private lastPropSig = '';
  private lastPathSig = '';
  private elapsed = 0;
  private readonly buildingIconCache = new Map<string, string>();

  constructor(app: Application) {
    this.app = app;
    this.sprites = new ProceduralSprites(app.renderer);

    this.entityLayer.sortableChildren = true;
    app.stage.addChild(this.world);

    this.sea = new SeaRenderer(this.world, app.renderer);
    this.seaFog = new SeaFogRenderer(this.world, app.renderer, 3);
    this.npcIslands = new NpcIslandRenderer(this.world);
    this.fishingBoats = new FishingBoatRenderer(this.sprites, this.entityLayer);
    this.scoutBoats = new ScoutBoatRenderer(this.sprites, this.entityLayer);
    this.world.addChild(
      this.terrainLayer,
      this.terrainPrepLayer,
      this.pathsLayer,
      this.overlayLayer,
      this.entityLayer,
      this.fxLayer,
    );

    this.camera = new Camera(this.world);
    this.camera.resize(app.screen.width, app.screen.height);
    this.villagers = new VillagerRenderer(this.sprites, this.entityLayer);
  }

  resize(width: number, height: number): void {
    this.camera.resize(width, height);
  }

  setHighlight(coord: SectorCoord | null, valid: boolean): void {
    this.highlight = { coord, valid };
  }

  setDemolishMarked(ids: ReadonlySet<string>): void {
    this.demolishMarked = ids;
  }

  setSelectedNpcIsland(id: string | null): void {
    this.npcIslands.setSelected(id);
  }

  /** Boucle de rendu. dt en secondes (temps reel) pour le lissage / animations. */
  render(state: GameState, map: WorldMap, dt: number): void {
    this.elapsed += dt;
    this.camera.update(dt);
    this.sea.update(this.elapsed, map.outerRadius);
    this.seaFog.update(state, map.outerRadius, this.camera, dt);

    if (this.lastTerrainRings !== map.ringCount) {
      this.drawTerrain(map);
      this.lastTerrainRings = map.ringCount;
    }

    const propSig = terrainPropSignature(state, map);
    if (this.lastPropSig !== propSig) {
      this.rebuildProps(state, map);
      this.lastPropSig = propSig;
    }

    this.drawTerrainPrep(state, map);

    const pathSig = pathsSignature(state);
    if (this.lastPathSig !== pathSig) {
      drawBuildingPaths(this.pathsLayer, state, map);
      this.lastPathSig = pathSig;
    }

    this.syncBuildings(state, map);
    this.npcIslands.update(state, dt);
    this.fishingBoats.update(state, dt);
    this.scoutBoats.update(state, dt);
    this.villagers.update(state, map, this.elapsed);
    this.cullEntities();
    this.drawOverlay(map);
    this.drawFx(state, map);
  }

  // --- Terrain --------------------------------------------------------------

  private drawTerrain(map: WorldMap): void {
    const g = this.terrainLayer;
    g.clear();

    drawBeachGround(g, map.outerRadius);

    for (let r = 1; r <= map.ringCount; r++) {
      const ring = map.getRing(r);
      if (!ring) continue;
      for (let i = 0; i < ring.sectorCount; i++) {
        drawRichSectorGround(
          g,
          ring.innerRadius,
          ring.outerRadius,
          ring.startAngle(i),
          ring.endAngle(i),
          r,
          i,
        );
      }
    }

    const center = map.getRing(0);
    if (center) {
      g.circle(0, 0, center.outerRadius).fill(PALETTE.dirt).stroke({ width: 3, color: PALETTE.dirtDark });
      g.circle(0, 0, center.outerRadius * 0.62).fill(0xb87a40);
      const rng = mulberry32(hashString('camp:dirt'));
      for (let i = 0; i < 24; i++) {
        const a = rng() * Math.PI * 2;
        const rr = center.outerRadius * (0.25 + rng() * 0.55);
        g.circle(Math.cos(a) * rr, Math.sin(a) * rr, 1.5 + rng() * 2.5).fill({
          color: rng() > 0.5 ? 0x8a5224 : 0xc99250,
          alpha: 0.4,
        });
      }
      const stones = 10;
      for (let i = 0; i < stones; i++) {
        const a = (i / stones) * Math.PI * 2;
        const rr = center.outerRadius * 0.78;
        g.circle(Math.cos(a) * rr, Math.sin(a) * rr, 4).fill(PALETTE.stone).stroke({ width: 1.5, color: PALETTE.outline });
      }
    }
  }

  private drawWedge(
    g: Graphics,
    inner: number,
    outer: number,
    start: number,
    end: number,
    color: number,
    gridAlpha: number,
  ): void {
    g.moveTo(Math.cos(start) * inner, Math.sin(start) * inner);
    g.lineTo(Math.cos(start) * outer, Math.sin(start) * outer);
    g.arc(0, 0, outer, start, end);
    g.lineTo(Math.cos(end) * inner, Math.sin(end) * inner);
    g.arc(0, 0, inner, end, start, true);
    g.closePath();
    g.fill(color).stroke({ width: 1.5, color: PALETTE.sectorGrid, alpha: gridAlpha });
  }

  /** Affiche l'etat du terrain : sauvage, en preparation, ou sol plat. */
  private drawTerrainPrep(state: GameState, map: WorldMap): void {
    const g = this.terrainPrepLayer;
    g.clear();

    const occupied = new Set<string>();
    for (const b of Object.values(state.buildings)) occupied.add(sectorKey(b.sector));
    const seaAccess = blockedSeaAccessKeys(map, state.buildings);

    for (const coord of map.sectors()) {
      if (coord.ring === 0) continue;
      const key = sectorKey(coord);
      if (occupied.has(key)) continue;

      const ring = map.getRing(coord.ring);
      if (!ring) continue;
      const start = ring.startAngle(coord.index);
      const end = ring.endAngle(coord.index);

      if (seaAccess.has(key)) {
        this.drawWedge(g, ring.innerRadius, ring.outerRadius, start, end, 0xc9b87a, 0.12);
        if (coord.ring === map.ringCount) {
          g.moveTo(Math.cos(start) * ring.innerRadius, Math.sin(start) * ring.innerRadius);
          g.lineTo(Math.cos(start) * ring.outerRadius, Math.sin(start) * ring.outerRadius);
          g.lineTo(Math.cos(end) * ring.outerRadius, Math.sin(end) * ring.outerRadius);
          g.lineTo(Math.cos(end) * ring.innerRadius, Math.sin(end) * ring.innerRadius);
          g.closePath();
          g.stroke({ width: 2, color: PALETTE.water, alpha: 0.45 });
        }
        continue;
      }

      if (state.preparedSectors[key]) {
        drawPreparedSectorGround(
          g,
          ring.innerRadius,
          ring.outerRadius,
          start,
          end,
          coord.ring,
          coord.index,
        );
        continue;
      }

      const job = state.prepJobs[key];
      if (job) {
        const def = TERRAIN_PREP[job.kind];
        const pct = Math.min(1, job.progress / def.time);
        this.drawWedge(g, ring.innerRadius, ring.outerRadius, start, end, 0x8a7a50, 0.35);
        this.drawPrepProgress(g, ring.innerRadius, ring.outerRadius, start, end, pct);
        this.drawTerrainIcon(g, ring, coord, job.kind, 0.5);
        continue;
      }

      const kind = terrainKindAt(coord);
      const wildBase = kind === 'rocky' ? 0x6a7a88 : 0x3d6a28;
      this.drawWedge(g, ring.innerRadius, ring.outerRadius, start, end, wildBase, 0.42);
      if (kind === 'overgrown') {
        this.drawWildSectorTexture(g, ring, coord, start, end);
      }
      this.drawTerrainIcon(g, ring, coord, kind, 1);
    }
  }

  /** Broussailles sur secteurs sauvages (par-dessus l'herbe de base). */
  private drawWildSectorTexture(
    g: Graphics,
    ring: NonNullable<ReturnType<WorldMap['getRing']>>,
    coord: SectorCoord,
    start: number,
    end: number,
  ): void {
    const seed = hashString(`wild:${sectorKey(coord)}`);
    const rng = mulberry32(seed);
    const inner = ring.innerRadius;
    const outer = ring.outerRadius;
    const clumps = 4 + (seed % 5);
    for (let i = 0; i < clumps; i++) {
      const a = start + (end - start) * (0.1 + rng() * 0.8);
      const r = lerp(inner + 12, outer - 12, rng());
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      const w = 8 + rng() * 10;
      g.ellipse(x, y, w, w * 0.55).fill({ color: 0x2d5018, alpha: 0.35 });
      g.ellipse(x, y - 4, w * 0.6, w * 0.35).fill({ color: 0x3a6820, alpha: 0.4 });
    }
  }

  private drawPrepProgress(
    g: Graphics,
    inner: number,
    outer: number,
    start: number,
    end: number,
    pct: number,
  ): void {
    if (pct <= 0) return;
    const mid = (start + end) * 0.5;
    const span = (end - start) * pct;
    const s = mid - span * 0.5;
    const e = mid + span * 0.5;
    this.drawWedge(g, inner, outer, s, e, PALETTE.grassLight, 0);
    g.stroke({ width: 3, color: PALETTE.highlight, alpha: 0.85 });
  }

  private drawTerrainIcon(
    g: Graphics,
    ring: NonNullable<ReturnType<WorldMap['getRing']>>,
    coord: SectorCoord,
    kind: 'overgrown' | 'rocky',
    alpha: number,
  ): void {
    const geo = ring.geometry(coord.index);
    const x = geo.cx;
    const y = geo.cy;
    if (kind === 'rocky') {
      g.circle(x - 6, y + 2, 5).fill({ color: PALETTE.stone, alpha }).stroke({ width: 1.5, color: PALETTE.outline, alpha });
      g.circle(x + 5, y + 4, 4).fill({ color: PALETTE.stoneDark, alpha }).stroke({ width: 1.5, color: PALETTE.outline, alpha });
    } else {
      g.rect(x - 1, y + 2, 2, 8).fill({ color: PALETTE.woodDark, alpha });
      g.circle(x, y - 2, 7).fill({ color: PALETTE.grassDark, alpha }).stroke({ width: 1.5, color: PALETTE.outline, alpha });
    }
  }

  // --- Decor (props) deterministe -------------------------------------------

  private rebuildProps(state: GameState, map: WorldMap): void {
    for (const s of this.propSprites) s.destroy();
    this.propSprites = [];

    const occupied = new Set<string>();
    for (const b of Object.values(state.buildings)) occupied.add(sectorKey(b.sector));

    for (const coord of map.sectors()) {
      if (coord.ring === 0) continue;
      const key = sectorKey(coord);
      if (occupied.has(key)) continue;
      if (state.preparedSectors[key]) continue;
      if (state.prepJobs[key]) continue;
      if (blockedSeaAccessKeys(map, state.buildings).has(key)) continue;

      const ring = map.getRing(coord.ring);
      if (!ring) continue;
      const rng = mulberry32(hashString(sectorKey(coord)));

      const count = 1 + Math.floor(rng() * 2); // 1 a 2 elements
      for (let n = 0; n < count; n++) {
        const a = lerp(ring.startAngle(coord.index), ring.endAngle(coord.index), 0.2 + 0.6 * rng());
        const rr = lerp(ring.innerRadius, ring.outerRadius, 0.3 + 0.45 * rng());
        const name = PROP_NAMES[Math.floor(rng() * PROP_NAMES.length)] ?? 'tree';
        const sprite = new Sprite(this.sprites.getPropTexture(name));
        sprite.anchor.set(BASE_ANCHOR.x, BASE_ANCHOR.y);
        sprite.position.set(Math.cos(a) * rr, Math.sin(a) * rr);
        sprite.zIndex = sprite.y;
        sprite.scale.set(0.7 + rng() * 0.35);
        this.entityLayer.addChild(sprite);
        this.propSprites.push(sprite);
      }
    }
  }

  // --- Batiments ------------------------------------------------------------

  private syncBuildings(state: GameState, map: WorldMap): void {
    const seen = new Set<string>();

    for (const b of Object.values(state.buildings)) {
      seen.add(b.id);
      const geo = map.geometry(b.sector);
      if (!geo) continue;

      let sprite = this.buildingSprites.get(b.id);
      if (!sprite) {
        sprite = new Sprite(this.sprites.getBuildingTexture(b.def));
        sprite.anchor.set(BASE_ANCHOR.x, BASE_ANCHOR.y);
        this.entityLayer.addChild(sprite);
        this.buildingSprites.set(b.id, sprite);
        this.spawnTime.set(b.id, this.elapsed);
      }

      const pos = buildingDisplayPosition(geo, BUILDINGS[b.def].shoreRequired === true);
      sprite.position.set(pos.x, pos.y);
      sprite.zIndex = pos.y + 1; // legerement au-dessus du decor a y egal
      const marked = this.demolishMarked.has(b.id);
      sprite.alpha = marked ? 0.75 : (b.complete ? 1 : 0.6);
      sprite.tint = marked ? DEMOLISH_TINT : 0xffffff;

      // Animation d'apparition (pop avec rebond).
      const age = this.elapsed - (this.spawnTime.get(b.id) ?? this.elapsed);
      const pop = easeOutBack(Math.min(1, age / POP_DURATION));
      const levelScale = 1 + (b.level - 1) * 0.07;
      sprite.scale.set(pop * levelScale * BUILDING_DISPLAY.scale);
    }

    for (const [id, sprite] of this.buildingSprites) {
      if (!seen.has(id)) {
        sprite.destroy();
        this.buildingSprites.delete(id);
        this.spawnTime.delete(id);
      }
    }
  }

  /** Culling : masque les entites hors du viewport. */
  private cullEntities(): void {
    const b = this.camera.visibleBounds();
    const m = 90;
    for (const child of this.entityLayer.children) {
      child.visible =
        child.x >= b.minX - m && child.x <= b.maxX + m && child.y >= b.minY - m && child.y <= b.maxY + m;
    }
  }

  // --- Overlay (surbrillance pulsee) ---------------------------------------

  private drawOverlay(map: WorldMap): void {
    const g = this.overlayLayer;
    g.clear();
    const coord = this.highlight.coord;
    if (!coord || coord.ring === 0) return;
    const ring = map.getRing(coord.ring);
    if (!ring) return;

    const color = this.highlight.valid ? PALETTE.highlight : PALETTE.invalid;
    const start = ring.startAngle(coord.index);
    const end = ring.endAngle(coord.index);
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 5);

    // Remplissage pulse (amplitude plus large qu'avant).
    this.drawWedge(g, ring.innerRadius, ring.outerRadius, start, end, color, 0);
    g.alpha = 0.3 + 0.25 * pulse;

    // Contour lumineux supplementaire (halo blanc).
    g.moveTo(Math.cos(start) * ring.innerRadius, Math.sin(start) * ring.innerRadius);
    g.lineTo(Math.cos(start) * ring.outerRadius, Math.sin(start) * ring.outerRadius);
    g.arc(0, 0, ring.outerRadius, start, end);
    g.lineTo(Math.cos(end) * ring.innerRadius, Math.sin(end) * ring.innerRadius);
    g.arc(0, 0, ring.innerRadius, end, start, true);
    g.closePath();
    g.stroke({ width: 2.5 + pulse * 1.5, color: 0xffffff, alpha: 0.28 + 0.32 * pulse });
  }

  // --- Effets animes (feu, lueur, fumee) -----------------------------------

  private drawFx(state: GameState, map: WorldMap): void {
    const g = this.fxLayer;
    g.clear();
    const t = this.elapsed;

    drawSynergyPaths(g, state, map, t);

    // Barres de progression des chantiers en cours.
    for (const b of Object.values(state.buildings)) {
      if (b.complete) continue;
      const geo = map.geometry(b.sector);
      if (!geo) continue;
      const def = BUILDINGS[b.def];
      const pct = def.buildTime > 0 ? Math.min(1, b.buildProgress / def.buildTime) : 1;
      const pos = buildingDisplayPosition(geo, def.shoreRequired === true);
      const BW = 38, BH = 5, BR = 2.5;
      const bx = pos.x - BW / 2;
      const by = pos.y + 8;
      // Fond sombre
      g.roundRect(bx - 1, by - 1, BW + 2, BH + 2, BR + 1).fill({ color: 0x000000, alpha: 0.55 });
      // Remplissage progression (gradient vert → jaune selon avancement)
      const fillColor = pct < 0.5 ? 0x4caf50 : pct < 0.85 ? 0xffc107 : 0x66bb6a;
      if (pct > 0) {
        g.roundRect(bx, by, BW * pct, BH, BR).fill({ color: fillColor, alpha: 0.92 });
      }
      // Hachures d'échafaudage (trait oblique animé)
      const phase = (t * 0.6) % 1;
      for (let i = -1; i <= 2; i++) {
        const ox = ((i + phase) * 12) % (BW + 12) - 6;
        g.moveTo(bx + ox, by).lineTo(bx + ox + 6, by + BH);
        g.stroke({ width: 1.5, color: 0xffffff, alpha: 0.12 });
      }
    }

    for (const b of Object.values(state.buildings)) {
      if (!b.complete) continue;
      const geo = map.geometry(b.sector);
      if (!geo) continue;

      if (b.def === 'campfire') {
        this.drawFire(g, geo.cx, geo.cy - 6, t);
        this.drawSmoke(g, geo.cx, geo.cy - 26, t, 0.6);
      } else if (b.def === 'factory') {
        this.drawSmoke(g, geo.cx + 9, geo.cy - 44, t, 1);
      }
    }
  }

  private drawFire(g: Graphics, x: number, y: number, t: number): void {
    const flick = Math.sin(t * 12) * 0.5 + Math.sin(t * 7.3 + 1) * 0.5; // -1..1
    const h = 24 + flick * 5;
    g.circle(x, y - 4, 22 + flick * 3).fill({ color: 0xff8a1f, alpha: 0.14 }); // lueur
    g.poly([x - 9, y, x, y - h, x + 9, y]).fill({ color: PALETTE.fire, alpha: 0.95 });
    g.poly([x - 5, y, x + flick * 2, y - h * 0.65, x + 5, y]).fill({ color: PALETTE.fireHot, alpha: 0.95 });
  }

  private drawSmoke(g: Graphics, x: number, y: number, t: number, intensity: number): void {
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.4 + i * 0.34) % 1;
      const py = y - p * 38;
      const px = x + Math.sin((t + i) * 2) * 4;
      const r = (2.5 + p * 5) * intensity;
      g.circle(px, py, r).fill({ color: 0xcfcfcf, alpha: 0.4 * (1 - p) * intensity });
    }
  }

  /** Miniature procedurale pour le panneau de construction (cachee par batiment). */
  getBuildingIconDataUrl(id: BuildingId, size = 40): string {
    const key = `${id}:${size}`;
    const cached = this.buildingIconCache.get(key);
    if (cached) return cached;

    const texture = this.sprites.getBuildingTexture(id);
    const sourceCanvas = this.app.renderer.extract.canvas({
      target: texture,
      clearColor: [0, 0, 0, 0],
    }) as HTMLCanvasElement;

    const out = document.createElement('canvas');
    out.width = size;
    out.height = size;
    const ctx = out.getContext('2d');
    if (!ctx) return '';

    ctx.imageSmoothingEnabled = false;
    const tw = texture.width;
    const th = texture.height;
    const scale = size / Math.max(tw, th);
    const dw = tw * scale;
    const dh = th * scale;
    ctx.drawImage(sourceCanvas, (size - dw) / 2, (size - dh) / 2, dw, dh);

    const url = out.toDataURL('image/png');
    this.buildingIconCache.set(key, url);
    return url;
  }

  destroy(): void {
    this.sea.destroy();
    this.seaFog.destroy();
    this.npcIslands.destroy();
    this.fishingBoats.destroy();
    this.scoutBoats.destroy();
    this.villagers.destroy();
    for (const sprite of this.buildingSprites.values()) sprite.destroy();
    for (const s of this.propSprites) s.destroy();
    this.buildingSprites.clear();
    this.propSprites = [];
    this.sprites.destroy();
    this.world.destroy({ children: true });
  }
}

function terrainPropSignature(state: GameState, map: WorldMap): string {
  const prep = Object.keys(state.prepJobs).sort().join(',');
  const done = Object.keys(state.preparedSectors).sort().join(',');
  return `${map.ringCount}:${Object.keys(state.buildings).length}:${prep}|${done}`;
}

// --- Utilitaires ------------------------------------------------------------

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/** Hash deterministe d'une chaine (pour seeder le RNG par secteur). */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Generateur pseudo-aleatoire deterministe (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
