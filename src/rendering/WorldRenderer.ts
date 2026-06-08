/**
 * WorldRenderer : rend l'etat du jeu via PixiJS.
 *
 * OBSERVATEUR de GameState : il lit l'etat, ne le mute JAMAIS.
 *
 * Couches (Containers) pour minimiser les draw calls :
 *  - terrainLayer : anneaux/secteurs (Graphics statique, redessine si la carte change)
 *  - overlayLayer : surbrillance du secteur survole (apercu de construction)
 *  - entityLayer  : batiments ET decor (props), tries en profondeur par y
 *  - fxLayer      : effets animes (flammes, lueur, fumee), redessine chaque frame
 *
 * Optimisations : textures procedurales cachees, culling par viewport,
 * tri en profondeur (zIndex = y), reutilisation/diff des sprites, decor
 * deterministe (seede par secteur) regenere uniquement au besoin.
 */

import { Application, Container, Graphics, Sprite } from 'pixi.js';
import { PALETTE } from '@/config/game';
import type { GameState } from '@/game/GameState';
import type { WorldMap } from '@/world/WorldMap';
import type { SectorCoord } from '@/world/Sector';
import { sectorKey } from '@/world/Sector';
import { Camera } from './Camera';
import { BASE_ANCHOR, ProceduralSprites } from './ProceduralSprites';
import type { PropName } from './ProceduralSprites';

interface HighlightState {
  coord: SectorCoord | null;
  valid: boolean;
}

const PROP_NAMES: PropName[] = ['tree', 'pine', 'rock', 'bush', 'flower', 'grass'];
const POP_DURATION = 0.35; // secondes pour l'animation d'apparition

export class WorldRenderer {
  readonly app: Application;
  readonly camera: Camera;

  private readonly world = new Container();
  private readonly terrainLayer = new Graphics();
  private readonly overlayLayer = new Graphics();
  private readonly entityLayer = new Container();
  private readonly fxLayer = new Graphics();

  private readonly sprites: ProceduralSprites;
  private readonly buildingSprites = new Map<string, Sprite>();
  private readonly spawnTime = new Map<string, number>();
  private propSprites: Sprite[] = [];

  private highlight: HighlightState = { coord: null, valid: true };
  private lastTerrainRings = -1;
  private lastPropSig = '';
  private elapsed = 0;

  constructor(app: Application) {
    this.app = app;
    this.sprites = new ProceduralSprites(app.renderer);

    this.entityLayer.sortableChildren = true;
    this.world.addChild(this.terrainLayer, this.overlayLayer, this.entityLayer, this.fxLayer);
    app.stage.addChild(this.world);

    this.camera = new Camera(this.world);
    this.camera.resize(app.screen.width, app.screen.height);
  }

  resize(width: number, height: number): void {
    this.camera.resize(width, height);
  }

  setHighlight(coord: SectorCoord | null, valid: boolean): void {
    this.highlight = { coord, valid };
  }

  /** Boucle de rendu. dt en secondes (temps reel) pour le lissage / animations. */
  render(state: GameState, map: WorldMap, dt: number): void {
    this.elapsed += dt;
    this.camera.update(dt);

    if (this.lastTerrainRings !== map.ringCount) {
      this.drawTerrain(map);
      this.lastTerrainRings = map.ringCount;
    }

    const sig = `${map.ringCount}:${Object.keys(state.buildings).length}`;
    if (this.lastPropSig !== sig) {
      this.rebuildProps(state, map);
      this.lastPropSig = sig;
    }

    this.syncBuildings(state, map);
    this.cullEntities();
    this.drawOverlay(map);
    this.drawFx(state, map);
  }

  // --- Terrain --------------------------------------------------------------

  private drawTerrain(map: WorldMap): void {
    const g = this.terrainLayer;
    g.clear();

    // Plage / sable a la lisiere exterieure (sur le fond eau).
    const outer = map.outerRadius;
    g.circle(0, 0, outer + 22).fill(0xe8d39a);
    g.circle(0, 0, outer + 8).fill(PALETTE.grassDark);

    // Secteurs herbeux (damier subtil).
    for (let r = 1; r <= map.ringCount; r++) {
      const ring = map.getRing(r);
      if (!ring) continue;
      for (let i = 0; i < ring.sectorCount; i++) {
        const shadeColor = (r + i) % 2 === 0 ? PALETTE.grass : PALETTE.grassDark;
        this.drawWedge(g, ring.innerRadius, ring.outerRadius, ring.startAngle(i), ring.endAngle(i), shadeColor, 0.18);
      }
    }

    // Clairiere centrale en terre, avec un anneau de pierres autour du foyer.
    const center = map.getRing(0);
    if (center) {
      g.circle(0, 0, center.outerRadius).fill(PALETTE.dirt).stroke({ width: 3, color: PALETTE.dirtDark });
      g.circle(0, 0, center.outerRadius * 0.62).fill(0xb87a40);
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

  // --- Decor (props) deterministe -------------------------------------------

  private rebuildProps(state: GameState, map: WorldMap): void {
    for (const s of this.propSprites) s.destroy();
    this.propSprites = [];

    const occupied = new Set<string>();
    for (const b of Object.values(state.buildings)) occupied.add(sectorKey(b.sector));

    for (const coord of map.sectors()) {
      if (coord.ring === 0) continue;
      if (occupied.has(sectorKey(coord))) continue;

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

      sprite.position.set(geo.cx, geo.cy);
      sprite.zIndex = geo.cy + 1; // legerement au-dessus du decor a y egal
      sprite.alpha = b.complete ? 1 : 0.6;

      // Animation d'apparition (pop avec rebond).
      const age = this.elapsed - (this.spawnTime.get(b.id) ?? this.elapsed);
      const pop = easeOutBack(Math.min(1, age / POP_DURATION));
      sprite.scale.set(pop);
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
    this.drawWedge(g, ring.innerRadius, ring.outerRadius, ring.startAngle(coord.index), ring.endAngle(coord.index), color, 0);
    g.alpha = 0.3 + 0.15 * Math.sin(this.elapsed * 6);
  }

  // --- Effets animes (feu, lueur, fumee) -----------------------------------

  private drawFx(state: GameState, map: WorldMap): void {
    const g = this.fxLayer;
    g.clear();
    const t = this.elapsed;

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

  destroy(): void {
    for (const sprite of this.buildingSprites.values()) sprite.destroy();
    for (const s of this.propSprites) s.destroy();
    this.buildingSprites.clear();
    this.propSprites = [];
    this.sprites.destroy();
    this.world.destroy({ children: true });
  }
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
