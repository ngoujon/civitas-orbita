/**
 * Generation procedurale des sprites (ZERO asset externe).
 *
 * Tous les visuels sont dessines via PIXI.Graphics puis cuits en RenderTexture
 * (genere UNE fois, reutilise ensuite). Style pixel art "Pokemon Rouge Feu" :
 * formes geometriques, couleurs vives, contours sombres, ombrage a 3 tons
 * (haut clair / base sombre), petits details.
 *
 * Convention : chaque element est dessine dans une boite [0..W, 0..H] avec la
 * base au sol en bas. Le sprite utilise une ancre (0.5, BASE_ANCHOR.y) pour
 * "poser" l'objet sur le centre de son secteur.
 */

import { Graphics, type Renderer, type Texture } from 'pixi.js';
import { PALETTE } from '@/config/game';
import type { BuildingId } from '@/config/buildings';
import { BUILDINGS } from '@/config/buildings';

const W = 48;
const H = 56;
const OUTLINE = PALETTE.outline;
const OUTLINE_W = 3;

/** Ancre verticale : la base de l'objet tombe sur le centre du secteur. */
export const BASE_ANCHOR = { x: 0.5, y: 0.82 };

export type PropName = 'tree' | 'pine' | 'rock' | 'bush' | 'flower' | 'grass';

type DrawFn = (g: Graphics) => void;

export class ProceduralSprites {
  private readonly cache = new Map<string, Texture>();

  constructor(private readonly renderer: Renderer) {}

  getBuildingTexture(id: BuildingId): Texture {
    const key = `b:${id}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const draw = BUILDING_DRAWERS[BUILDINGS[id].sprite] ?? drawGeneric;
    const g = new Graphics();
    addGroundShadow(g, W * 0.42, 7);
    draw(g);
    const tex = this.bake(g);
    this.cache.set(key, tex);
    return tex;
  }

  getPropTexture(name: PropName): Texture {
    const key = `p:${name}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const g = new Graphics();
    addGroundShadow(g, 12, 4);
    PROP_DRAWERS[name](g);
    const tex = this.bake(g);
    this.cache.set(key, tex);
    return tex;
  }

  getColonistTexture(): Texture {
    const key = 'colonist';
    const cached = this.cache.get(key);
    if (cached) return cached;
    const g = new Graphics();
    g.circle(6, 6, 5).fill(0xffe0b0).stroke({ width: 2, color: OUTLINE });
    g.rect(3, 8, 6, 6).fill(0x3a6ea5).stroke({ width: 1.5, color: OUTLINE });
    const tex = this.bake(g);
    this.cache.set(key, tex);
    return tex;
  }

  private bake(g: Graphics): Texture {
    const tex = this.renderer.generateTexture({ target: g, antialias: false });
    tex.source.scaleMode = 'nearest';
    g.destroy();
    return tex;
  }

  destroy(): void {
    for (const tex of this.cache.values()) tex.destroy(true);
    this.cache.clear();
  }
}

// --- Outils couleur / primitives ------------------------------------------

/** Eclaircit (f>1) ou assombrit (f<1) une couleur hex. */
function shade(hex: number, f: number): number {
  const r = clamp255(((hex >> 16) & 0xff) * f);
  const g = clamp255(((hex >> 8) & 0xff) * f);
  const b = clamp255((hex & 0xff) * f);
  return (r << 16) | (g << 8) | b;
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function addGroundShadow(g: Graphics, rx: number, ry: number): void {
  g.ellipse(W / 2, H - 4, rx, ry).fill({ color: 0x000000, alpha: 0.2 });
}

/** Corps de batiment : 3 tons (haut clair, milieu, base sombre) + contour. */
function body(g: Graphics, x: number, y: number, w: number, h: number, color: number): void {
  g.rect(x, y, w, h).fill(color);
  g.rect(x, y, w, Math.max(3, h * 0.26)).fill(shade(color, 1.18));
  g.rect(x, y + h * 0.74, w, h * 0.26).fill(shade(color, 0.78));
  g.rect(x, y, w, h).stroke({ width: OUTLINE_W, color: OUTLINE, alignment: 0.5 });
}

/** Toit triangulaire bicolore (face eclairee + ombre) + contour. */
function roof(g: Graphics, cx: number, apexY: number, halfW: number, baseY: number, color: number): void {
  const left = cx - halfW;
  const right = cx + halfW;
  g.poly([left, baseY, cx, apexY, right, baseY]).fill(color);
  g.poly([cx, apexY, right, baseY, cx, baseY]).fill(shade(color, 0.8)); // versant droit ombre
  g.poly([left, baseY, cx, apexY, right, baseY]).stroke({ width: OUTLINE_W, color: OUTLINE });
}

function poly(g: Graphics, pts: number[], color: number): void {
  g.poly(pts).fill(color).stroke({ width: OUTLINE_W, color: OUTLINE, alignment: 0.5 });
}

function windowPane(g: Graphics, x: number, y: number, w: number, h: number): void {
  g.rect(x, y, w, h).fill(PALETTE.water);
  g.rect(x, y, w * 0.45, h * 0.45).fill(shade(PALETTE.water, 1.4)); // reflet
  g.rect(x, y, w, h).stroke({ width: 2, color: OUTLINE });
}

function door(g: Graphics, x: number, y: number, w: number, h: number, color: number): void {
  g.rect(x, y, w, h).fill(color).stroke({ width: 2, color: OUTLINE });
  g.circle(x + w * 0.78, y + h * 0.5, 1.3).fill(0xffe24a); // poignee
}

// --- Dessins de batiments --------------------------------------------------

function drawGeneric(g: Graphics): void {
  body(g, 10, 24, 28, 26, PALETTE.stone);
  roof(g, 24, 8, 20, 24, PALETTE.roof);
}

function drawCampfire(g: Graphics): void {
  // Buches croisees (les flammes sont animees dans WorldRenderer).
  poly(g, [12, 50, 38, 38, 40, 44, 14, 56], PALETTE.woodDark);
  poly(g, [12, 38, 38, 50, 36, 56, 10, 44], PALETTE.wood);
  // Cercle de pierres.
  for (const px of [10, 24, 38]) {
    g.circle(px, 50, 4).fill(PALETTE.stone).stroke({ width: 2, color: OUTLINE });
    g.circle(px, 50, 1.5).fill(shade(PALETTE.stone, 1.3));
  }
  // Petites braises.
  g.circle(22, 46, 3).fill(PALETTE.fire);
  g.circle(27, 47, 2).fill(PALETTE.fireHot);
}

function drawHut(g: Graphics): void {
  roof(g, 24, 12, 19, 46, PALETTE.wood);
  body(g, 17, 40, 14, 10, PALETTE.woodDark);
  door(g, 21, 42, 6, 8, shade(PALETTE.woodDark, 0.7));
}

function drawLumberjack(g: Graphics): void {
  body(g, 8, 28, 24, 22, PALETTE.wood);
  roof(g, 20, 14, 18, 30, PALETTE.roofDark);
  door(g, 16, 38, 8, 12, shade(PALETTE.woodDark, 0.8));
  windowPane(g, 24, 32, 6, 6);
  // Souche + hache.
  g.ellipse(40, 46, 5, 3).fill(PALETTE.woodDark).stroke({ width: 2, color: OUTLINE });
  g.rect(39, 30, 2, 14).fill(shade(PALETTE.wood, 0.7));
  poly(g, [37, 30, 44, 28, 43, 33], PALETTE.stone);
}

function drawFarm(g: Graphics): void {
  // Champ laboure.
  g.rect(6, 34, 36, 16).fill(PALETTE.dirt).stroke({ width: 2, color: OUTLINE });
  for (let i = 0; i < 4; i++) {
    g.rect(9 + i * 9, 36, 4, 12).fill(PALETTE.grassLight);
    g.rect(9 + i * 9, 36, 4, 3).fill(shade(PALETTE.grassLight, 1.2));
  }
  // Grange.
  body(g, 30, 26, 14, 12, PALETTE.roof);
  roof(g, 37, 16, 9, 26, shade(PALETTE.roof, 0.85));
  windowPane(g, 34, 29, 6, 6);
}

function drawQuarry(g: Graphics): void {
  g.ellipse(24, 46, 18, 6).fill(PALETTE.dirtDark).stroke({ width: 2, color: OUTLINE });
  const rocks: [number, number, number, number][] = [
    [16, 40, 9, PALETTE.stone],
    [30, 43, 7, PALETTE.stoneDark],
    [23, 31, 6, PALETTE.stone],
    [34, 35, 5, PALETTE.stoneDark],
  ];
  for (const [x, y, r, c] of rocks) {
    g.circle(x, y, r).fill(c).stroke({ width: OUTLINE_W, color: OUTLINE });
    g.circle(x - r * 0.3, y - r * 0.3, r * 0.4).fill(shade(c, 1.3));
  }
}

function drawWarehouse(g: Graphics): void {
  body(g, 8, 26, 32, 24, PALETTE.wood);
  roof(g, 24, 12, 21, 26, PALETTE.woodDark);
  // Caisses empilees.
  for (const [x, y] of [[12, 36], [26, 36], [19, 24]] as [number, number][]) {
    g.rect(x, y, 10, 12).fill(PALETTE.dirt).stroke({ width: 2, color: OUTLINE });
    g.rect(x, y, 10, 3).fill(shade(PALETTE.dirt, 1.2));
    g.moveTo(x, y).lineTo(x + 10, y + 12).stroke({ width: 1.5, color: shade(PALETTE.dirt, 0.7) });
  }
}

function drawWorkshop(g: Graphics): void {
  body(g, 8, 28, 32, 22, PALETTE.stoneDark);
  roof(g, 24, 16, 20, 30, PALETTE.roof);
  windowPane(g, 12, 34, 7, 7);
  // Enclume.
  g.rect(24, 40, 12, 5).fill(OUTLINE);
  g.rect(28, 45, 4, 4).fill(OUTLINE);
  g.rect(24, 40, 4, 2).fill(shade(0x888888, 1));
}

function drawLibrary(g: Graphics): void {
  body(g, 8, 26, 32, 24, 0xe8d8b0);
  roof(g, 24, 12, 21, 26, PALETTE.roofDark);
  for (const x of [12, 22, 32]) {
    g.rect(x, 32, 4, 18).fill(0xffffff).stroke({ width: 1.5, color: OUTLINE });
  }
  g.rect(8, 30, 32, 3).fill(shade(0xe8d8b0, 0.8));
}

function drawMine(g: Graphics): void {
  poly(g, [4, 50, 24, 16, 44, 50], PALETTE.stoneDark);
  poly(g, [24, 16, 44, 50, 24, 50], shade(PALETTE.stoneDark, 0.8));
  g.ellipse(24, 44, 9, 11).fill(OUTLINE);
  g.ellipse(24, 44, 9, 11).stroke({ width: OUTLINE_W, color: shade(PALETTE.wood, 0.8) });
  g.rect(19, 30, 10, 4).fill(PALETTE.wood).stroke({ width: 2, color: OUTLINE });
  // Wagonnet.
  g.rect(30, 46, 9, 6).fill(0x6b5040).stroke({ width: 2, color: OUTLINE });
  g.circle(32, 52, 2).fill(OUTLINE);
  g.circle(37, 52, 2).fill(OUTLINE);
}

function drawHouse(g: Graphics): void {
  body(g, 10, 28, 28, 22, 0xf0e0c0);
  roof(g, 24, 12, 21, 30, PALETTE.roof);
  door(g, 20, 38, 8, 12, PALETTE.woodDark);
  windowPane(g, 13, 32, 6, 6);
  windowPane(g, 29, 32, 6, 6);
}

function drawMarket(g: Graphics): void {
  body(g, 9, 34, 30, 16, PALETTE.wood);
  // Auvent raye.
  for (let i = 0; i < 6; i++) {
    g.rect(6 + i * 6, 24, 6, 10).fill(i % 2 === 0 ? PALETTE.roof : 0xffffff);
  }
  g.rect(6, 24, 36, 10).stroke({ width: OUTLINE_W, color: OUTLINE });
  // Etals.
  g.rect(13, 38, 8, 6).fill(PALETTE.fire);
  g.rect(27, 38, 8, 6).fill(PALETTE.grassLight);
}

function drawBarracks(g: Graphics): void {
  body(g, 8, 26, 32, 24, PALETTE.stoneDark);
  // Creneaux.
  for (let i = 0; i < 4; i++) {
    g.rect(7 + i * 9, 20, 6, 8).fill(PALETTE.stone).stroke({ width: 2, color: OUTLINE });
  }
  door(g, 19, 38, 10, 12, shade(PALETTE.stoneDark, 0.7));
  // Drapeau.
  g.rect(23, 6, 2, 16).fill(OUTLINE);
  poly(g, [25, 6, 38, 10, 25, 14], PALETTE.roof);
}

function drawUniversity(g: Graphics): void {
  body(g, 6, 30, 36, 20, 0xe8d8b0);
  roof(g, 24, 18, 23, 30, PALETTE.roofDark);
  g.circle(24, 14, 8).fill(0xf5c542).stroke({ width: OUTLINE_W, color: OUTLINE });
  g.circle(21, 11, 3).fill(shade(0xf5c542, 1.3));
  for (const x of [11, 22, 33]) {
    g.rect(x, 34, 4, 16).fill(0xffffff).stroke({ width: 1.5, color: OUTLINE });
  }
}

function drawFactory(g: Graphics): void {
  body(g, 6, 30, 34, 20, 0x8a8a8a);
  for (let i = 0; i < 3; i++) {
    poly(g, [6 + i * 11, 30, 6 + i * 11, 22, 17 + i * 11, 30], 0x6b6b6b);
  }
  // Cheminee (la fumee est animee dans WorldRenderer).
  g.rect(31, 12, 7, 20).fill(0x5a4a40).stroke({ width: 2, color: OUTLINE });
  g.rect(31, 12, 7, 4).fill(0x3a2e28);
  windowPane(g, 12, 38, 6, 6);
  windowPane(g, 24, 38, 6, 6);
}

const BUILDING_DRAWERS: Record<string, DrawFn> = {
  campfire: drawCampfire,
  hut: drawHut,
  lumberjack: drawLumberjack,
  farm: drawFarm,
  quarry: drawQuarry,
  warehouse: drawWarehouse,
  workshop: drawWorkshop,
  library: drawLibrary,
  mine: drawMine,
  house: drawHouse,
  market: drawMarket,
  barracks: drawBarracks,
  university: drawUniversity,
  factory: drawFactory,
};

// --- Dessins de decor (props) ----------------------------------------------

function drawTree(g: Graphics): void {
  g.rect(22, 36, 4, 14).fill(PALETTE.woodDark).stroke({ width: 2, color: OUTLINE });
  const leaves: [number, number, number][] = [
    [24, 24, 11],
    [17, 30, 8],
    [31, 30, 8],
  ];
  for (const [x, y, r] of leaves) {
    g.circle(x, y, r).fill(PALETTE.grassDark).stroke({ width: 2, color: OUTLINE });
  }
  g.circle(20, 20, 5).fill(shade(PALETTE.grass, 1.1)); // reflet
}

function drawPine(g: Graphics): void {
  g.rect(22, 40, 4, 10).fill(PALETTE.woodDark).stroke({ width: 2, color: OUTLINE });
  const tiers: [number, number][] = [
    [42, 14],
    [34, 12],
    [26, 10],
  ];
  for (const [baseY, halfW] of tiers) {
    poly(g, [24 - halfW, baseY, 24, baseY - 14, 24 + halfW, baseY], 0x2f6b28);
  }
}

function drawRock(g: Graphics): void {
  g.circle(20, 42, 8).fill(PALETTE.stone).stroke({ width: OUTLINE_W, color: OUTLINE });
  g.circle(30, 45, 6).fill(PALETTE.stoneDark).stroke({ width: OUTLINE_W, color: OUTLINE });
  g.circle(17, 39, 3).fill(shade(PALETTE.stone, 1.3));
}

function drawBush(g: Graphics): void {
  g.circle(18, 44, 7).fill(PALETTE.grassDark).stroke({ width: 2, color: OUTLINE });
  g.circle(28, 44, 8).fill(PALETTE.grassDark).stroke({ width: 2, color: OUTLINE });
  g.circle(16, 41, 3).fill(shade(PALETTE.grass, 1.1));
}

function drawFlower(g: Graphics): void {
  g.rect(23, 42, 2, 8).fill(PALETTE.grassDark);
  const colors = [PALETTE.roof, 0xffe24a, 0xffffff];
  for (let i = 0; i < 3; i++) {
    const x = 16 + i * 8;
    g.rect(x, 44, 2, 6).fill(PALETTE.grassDark);
    g.circle(x + 1, 42, 3).fill(colors[i] ?? PALETTE.roof).stroke({ width: 1.5, color: OUTLINE });
    g.circle(x + 1, 42, 1).fill(0xffe24a);
  }
}

function drawGrass(g: Graphics): void {
  for (let i = 0; i < 4; i++) {
    const x = 16 + i * 5;
    poly(g, [x, 50, x - 2, 42, x + 1, 50], shade(PALETTE.grass, 0.95));
  }
}

const PROP_DRAWERS: Record<PropName, DrawFn> = {
  tree: drawTree,
  pine: drawPine,
  rock: drawRock,
  bush: drawBush,
  flower: drawFlower,
  grass: drawGrass,
};
