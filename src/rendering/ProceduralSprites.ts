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

  getVillagerTexture(variant: number): Texture {
    const key = `villager:${variant % 3}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const g = new Graphics();
    drawVillager(g, variant % 3);
    const tex = this.bake(g);
    this.cache.set(key, tex);
    return tex;
  }

  getFishingBoatTexture(variant: number): Texture {
    const key = `boat:${variant % 3}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const g = new Graphics();
    drawFishingBoat(g, variant % 3);
    const tex = this.bake(g);
    this.cache.set(key, tex);
    return tex;
  }

  getScoutBoatTexture(): Texture {
    const key = 'scout';
    const cached = this.cache.get(key);
    if (cached) return cached;
    const g = new Graphics();
    drawScoutBoat(g);
    const tex = this.bake(g);
    this.cache.set(key, tex);
    return tex;
  }

  /** @deprecated Utiliser getVillagerTexture. */
  getColonistTexture(): Texture {
    return this.getVillagerTexture(0);
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
  // Sol charbonneux.
  g.ellipse(24, 50, 15, 5).fill({ color: 0x3a1a00, alpha: 0.55 });
  // Buches croisees plus epaisses.
  poly(g, [10, 52, 38, 39, 40, 45, 12, 57], PALETTE.woodDark);
  poly(g, [10, 40, 38, 53, 36, 57, 8, 45], PALETTE.wood);
  // Veines du bois.
  g.moveTo(12, 42).lineTo(37, 53).stroke({ width: 1, color: shade(PALETTE.wood, 0.7) });
  g.moveTo(11, 52).lineTo(37, 41).stroke({ width: 1, color: shade(PALETTE.woodDark, 0.7) });
  // Anneau de 5 pierres.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const px = 24 + Math.cos(a) * 11;
    const py = 50 + Math.sin(a) * 4;
    const c = i % 2 === 0 ? PALETTE.stone : PALETTE.stoneDark;
    g.circle(px, py, 3.5).fill(c).stroke({ width: 1.5, color: OUTLINE });
    g.circle(px - 0.8, py - 0.8, 1.2).fill(shade(PALETTE.stone, 1.35));
  }
  // Braises vives (les flammes sont animees dans WorldRenderer).
  g.circle(20, 47, 3).fill(PALETTE.fire);
  g.circle(26, 46, 2.5).fill(PALETTE.fireHot);
  g.circle(23, 44, 1.5).fill(0xffeebb);
}

function drawHut(g: Graphics): void {
  // Base en pierre (soubassement).
  g.rect(13, 43, 22, 7).fill(PALETTE.stone).stroke({ width: 2, color: OUTLINE });
  g.rect(13, 43, 22, 2).fill(shade(PALETTE.stone, 1.2));
  // Corps en rondins.
  body(g, 14, 35, 20, 10, PALETTE.woodDark);
  // Texture rondins horizontaux.
  for (let i = 1; i < 3; i++) {
    g.moveTo(14, 35 + i * 3).lineTo(34, 35 + i * 3).stroke({ width: 0.8, color: shade(PALETTE.woodDark, 0.72) });
  }
  // Toit en chaume (plus large, plus detaille).
  roof(g, 24, 9, 22, 36, PALETTE.wood);
  // Lignes de chaume.
  for (let i = 0; i < 3; i++) {
    g.moveTo(24 - (i + 1) * 5, 36 - i * 6).lineTo(24, 9 + i * 9).stroke({ width: 0.8, color: shade(PALETTE.wood, 0.78) });
    g.moveTo(24 + (i + 1) * 5, 36 - i * 6).lineTo(24, 9 + i * 9).stroke({ width: 0.8, color: shade(PALETTE.wood, 0.78) });
  }
  // Porte.
  door(g, 20, 38, 8, 12, shade(PALETTE.woodDark, 0.65));
  // Trou de fumee au sommet.
  g.ellipse(24, 12, 3, 1.5).fill({ color: 0x2a1a00, alpha: 0.6 });
}

function drawLumberjack(g: Graphics): void {
  // Pile de rondins (cote gauche du batiment).
  for (let i = 0; i < 3; i++) {
    g.rect(2, 34 + i * 5, 7, 4).fill(PALETTE.wood).stroke({ width: 1.5, color: OUTLINE });
    g.ellipse(5.5, 34 + i * 5, 3, 1.5).fill(shade(PALETTE.woodDark, 1.15));
  }
  // Batiment.
  body(g, 9, 28, 24, 22, PALETTE.wood);
  roof(g, 21, 14, 18, 30, PALETTE.roofDark);
  door(g, 17, 38, 8, 12, shade(PALETTE.woodDark, 0.8));
  windowPane(g, 25, 32, 6, 6);
  // Sciure de sol.
  g.ellipse(40, 48, 6, 3).fill({ color: PALETTE.dirt, alpha: 0.5 });
  // Souche + hache.
  g.ellipse(40, 48, 5.5, 3.5).fill(PALETTE.woodDark).stroke({ width: 2, color: OUTLINE });
  g.ellipse(40, 46, 4, 2).fill(shade(PALETTE.woodDark, 1.25));
  g.rect(38.5, 32, 2.5, 14).fill(shade(PALETTE.wood, 0.65)).stroke({ width: 1, color: OUTLINE });
  poly(g, [36, 30, 44, 27, 43, 34], PALETTE.stone);
  g.circle(43, 28.5, 1.5).fill(shade(PALETTE.stone, 1.4));
}

function drawFarm(g: Graphics): void {
  // Champ laboure avec sillons.
  g.rect(5, 34, 24, 16).fill(PALETTE.dirt).stroke({ width: 2, color: OUTLINE });
  for (let i = 0; i < 4; i++) {
    const x = 7 + i * 5;
    g.rect(x, 36, 3, 10).fill(PALETTE.grassLight);
    // Epis de ble.
    g.rect(x, 34, 3, 4).fill(0xdda020);
    g.rect(x, 36, 3, 2).fill(shade(PALETTE.grassLight, 1.25));
    // Grain sur epi.
    g.circle(x + 1, 33, 1.2).fill(0xf0c040);
    g.circle(x + 2.2, 34, 1.2).fill(0xf0c040);
  }
  // Grange (rouge typique).
  body(g, 29, 23, 16, 16, PALETTE.roof);
  roof(g, 37, 11, 10, 23, shade(PALETTE.roof, 0.82));
  // Croix de grange.
  g.moveTo(30, 25).lineTo(44, 37).stroke({ width: 2, color: shade(PALETTE.roof, 0.6) });
  g.moveTo(44, 25).lineTo(30, 37).stroke({ width: 2, color: shade(PALETTE.roof, 0.6) });
  g.rect(30, 25, 14, 12).stroke({ width: 1.5, color: OUTLINE });
  windowPane(g, 33, 27, 5, 5);
}

function drawQuarry(g: Graphics): void {
  // Excavation (plus profonde).
  g.ellipse(22, 46, 20, 8).fill(PALETTE.dirtDark).stroke({ width: 2, color: OUTLINE });
  g.ellipse(22, 46, 13, 5).fill(shade(PALETTE.dirtDark, 0.8));
  const rocks: [number, number, number, number][] = [
    [14, 42, 8.5, PALETTE.stone],
    [28, 44, 7, PALETTE.stoneDark],
    [21, 31, 7, PALETTE.stone],
    [33, 36, 5.5, PALETTE.stoneDark],
    [10, 36, 5, shade(PALETTE.stone, 1.1)],
  ];
  for (const [x, y, r, c] of rocks) {
    g.circle(x, y, r).fill(c).stroke({ width: OUTLINE_W, color: OUTLINE });
    g.circle(x - r * 0.35, y - r * 0.35, r * 0.38).fill(shade(c, 1.35));
    // Fissure dans le rocher.
    g.moveTo(x + r * 0.2, y + r * 0.1).lineTo(x - r * 0.3, y + r * 0.5).stroke({ width: 1, color: shade(c, 0.65) });
  }
  // Mini wagonnet de mine.
  g.rect(33, 47, 9, 5).fill(0x7a5840).stroke({ width: 1.5, color: OUTLINE });
  g.rect(33, 47, 9, 2).fill(PALETTE.stoneDark);
  g.circle(35, 52, 1.5).fill(OUTLINE);
  g.circle(40, 52, 1.5).fill(OUTLINE);
}

function drawWarehouse(g: Graphics): void {
  body(g, 7, 24, 34, 26, PALETTE.wood);
  roof(g, 24, 10, 22, 24, PALETTE.woodDark);
  // Texture bois horizontale.
  for (let i = 1; i < 4; i++) {
    g.moveTo(7, 24 + i * 6).lineTo(41, 24 + i * 6).stroke({ width: 0.8, color: shade(PALETTE.wood, 0.82) });
  }
  // Grande porte double.
  g.rect(16, 35, 14, 15).fill(shade(PALETTE.woodDark, 0.7)).stroke({ width: 2, color: OUTLINE });
  g.moveTo(23, 35).lineTo(23, 50).stroke({ width: 1.5, color: shade(PALETTE.woodDark, 0.55) });
  g.moveTo(16, 40).lineTo(30, 40).stroke({ width: 1, color: shade(PALETTE.woodDark, 0.6) });
  g.moveTo(16, 46).lineTo(30, 46).stroke({ width: 1, color: shade(PALETTE.woodDark, 0.6) });
  // Caisses empilees (droite).
  for (const [x, y] of [[32, 36], [32, 28]] as [number, number][]) {
    g.rect(x, y, 8, 8).fill(PALETTE.dirt).stroke({ width: 1.5, color: OUTLINE });
    g.rect(x, y, 8, 2).fill(shade(PALETTE.dirt, 1.2));
    g.moveTo(x, y).lineTo(x + 8, y + 8).stroke({ width: 1, color: shade(PALETTE.dirt, 0.72) });
  }
  // Tonneau (gauche).
  g.rect(5, 38, 8, 10).fill(0x8b5a2b).stroke({ width: 1.5, color: OUTLINE });
  g.ellipse(9, 38, 4, 2).fill(shade(0x8b5a2b, 1.2)).stroke({ width: 1, color: OUTLINE });
  g.ellipse(9, 48, 4, 2).fill(shade(0x8b5a2b, 0.85)).stroke({ width: 1, color: OUTLINE });
  g.moveTo(5, 41).lineTo(13, 41).stroke({ width: 1.5, color: OUTLINE });
  g.moveTo(5, 45).lineTo(13, 45).stroke({ width: 1.5, color: OUTLINE });
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

function drawPort(g: Graphics): void {
  // Quai en pierre sur l eau.
  body(g, 4, 36, 40, 14, PALETTE.stone);
  g.rect(4, 44, 40, 6).fill(0x6a8aa8).stroke({ width: OUTLINE_W, color: OUTLINE });
  // Poteaux d amarrage.
  g.rect(10, 30, 3, 14).fill(PALETTE.woodDark).stroke({ width: 2, color: OUTLINE });
  g.rect(35, 30, 3, 14).fill(PALETTE.woodDark).stroke({ width: 2, color: OUTLINE });
  // Grue simple.
  g.rect(22, 14, 2, 22).fill(PALETTE.woodDark);
  g.rect(22, 14, 14, 2).fill(PALETTE.wood);
  g.circle(36, 15, 3).fill(PALETTE.stoneDark);
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

const FUTURE_CYAN = 0x4ae8ff;
const FUTURE_GLOW = 0x8af4ff;
const FUTURE_PURPLE = 0x9a4ae8;
const FUTURE_METAL = 0x3a3a4a;

function drawHabitatDome(g: Graphics): void {
  body(g, 8, 42, 32, 8, FUTURE_METAL);
  g.arc(24, 42, 16, Math.PI, 0).fill(FUTURE_CYAN).stroke({ width: OUTLINE_W, color: OUTLINE });
  g.arc(24, 42, 11, Math.PI, 0).fill(FUTURE_GLOW);
  g.ellipse(24, 42, 17, 3).fill({ color: FUTURE_CYAN, alpha: 0.35 });
  g.rect(20, 36, 8, 8).fill(0x2a3040).stroke({ width: 2, color: OUTLINE });
  windowPane(g, 14, 32, 4, 4);
  windowPane(g, 30, 32, 4, 4);
}

function drawSolarArray(g: Graphics): void {
  body(g, 6, 44, 36, 6, 0x4a4a50);
  for (let i = 0; i < 3; i++) {
    const x = 8 + i * 12;
    poly(g, [x, 44, x + 8, 28, x + 11, 28, x + 3, 44], 0x1a3a5a);
    for (let j = 0; j < 3; j++) {
      g.rect(x + 2 + j * 2.5, 32, 2, 10).fill(0x2a5080).stroke({ width: 1, color: FUTURE_CYAN });
    }
  }
  g.rect(22, 20, 4, 10).fill(0x6a6a70).stroke({ width: 2, color: OUTLINE });
  g.circle(24, 18, 3).fill(FUTURE_GLOW).stroke({ width: 2, color: OUTLINE });
}

function drawQuantumLab(g: Graphics): void {
  body(g, 10, 38, 28, 12, FUTURE_METAL);
  g.rect(20, 8, 8, 32).fill(FUTURE_PURPLE).stroke({ width: OUTLINE_W, color: OUTLINE });
  g.circle(24, 10, 5).fill(FUTURE_GLOW).stroke({ width: 2, color: OUTLINE });
  g.circle(24, 10, 2).fill(0xffffff);
  for (const x of [14, 34]) {
    g.rect(x, 28, 3, 14).fill(FUTURE_CYAN).stroke({ width: 2, color: OUTLINE });
  }
  g.ellipse(24, 44, 14, 4).fill({ color: FUTURE_PURPLE, alpha: 0.25 });
}

function drawOrbitalDepot(g: Graphics): void {
  body(g, 8, 40, 32, 10, FUTURE_METAL);
  g.rect(18, 14, 12, 28).fill(0x5a5a68).stroke({ width: OUTLINE_W, color: OUTLINE });
  g.ellipse(24, 16, 14, 4).fill(FUTURE_CYAN).stroke({ width: 2, color: OUTLINE });
  g.ellipse(24, 16, 10, 2).fill(FUTURE_GLOW);
  g.rect(14, 22, 20, 3).fill(0x7a7a88).stroke({ width: 2, color: OUTLINE });
  g.circle(10, 24, 4).fill(FUTURE_CYAN).stroke({ width: 2, color: OUTLINE });
  g.circle(38, 24, 4).fill(FUTURE_CYAN).stroke({ width: 2, color: OUTLINE });
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
  port: drawPort,
  barracks: drawBarracks,
  university: drawUniversity,
  factory: drawFactory,
  habitat_dome: drawHabitatDome,
  solar_array: drawSolarArray,
  quantum_lab: drawQuantumLab,
  orbital_depot: drawOrbitalDepot,
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

// --- Bateaux de peche -------------------------------------------------------

const BOAT_HULLS: readonly number[] = [0x8b5a2b, 0x7a4a30, 0x5a6848];

/** Barque vue de dessus, orientee vers la droite (+X = cap 0). */
function drawFishingBoat(g: Graphics, variant: number): void {
  const hull = BOAT_HULLS[variant % BOAT_HULLS.length]!;
  g.ellipse(24, 28, 14, 5).fill({ color: 0x000000, alpha: 0.18 });
  g.poly([10, 28, 38, 24, 38, 32, 10, 32]).fill(hull).stroke({ width: 2, color: OUTLINE });
  g.poly([10, 28, 14, 26, 14, 34, 10, 32]).fill(shade(hull, 1.12));
  g.rect(20, 14, 2, 14).fill(PALETTE.woodDark).stroke({ width: 1.5, color: OUTLINE });
  g.poly([22, 16, 34, 20, 22, 24]).fill(0xf8f8f0).stroke({ width: 2, color: OUTLINE });
  g.poly([22, 16, 26, 18, 22, 20]).fill(shade(0xf8f8f0, 0.9));
  if (variant === 1) {
    g.rect(12, 27, 8, 3).fill(PALETTE.wood).stroke({ width: 1.5, color: OUTLINE });
  }
  if (variant === 2) {
    g.circle(32, 26, 2).fill(0xffe24a).stroke({ width: 1.5, color: OUTLINE });
  }
}

/** Bateau eclaireur : coque bleue, voile doree, lunette. */
function drawScoutBoat(g: Graphics): void {
  g.ellipse(24, 28, 13, 4).fill({ color: 0x000000, alpha: 0.16 });
  g.poly([12, 28, 36, 25, 36, 31, 12, 31]).fill(0x3a6ea5).stroke({ width: 2, color: OUTLINE });
  g.poly([12, 28, 15, 26, 15, 32, 12, 31]).fill(shade(0x3a6ea5, 1.15));
  g.rect(21, 12, 2, 13).fill(PALETTE.woodDark);
  g.poly([23, 14, 33, 18, 23, 22]).fill(0xffe24a).stroke({ width: 2, color: OUTLINE });
  g.circle(30, 24, 3).fill(0x2a2a40).stroke({ width: 1.5, color: 0xffe24a });
  g.rect(29, 23, 4, 1.5).fill(0xffe24a);
}

// --- Villageois -------------------------------------------------------------

const VILLAGER_SHIRTS: readonly [number, number, number] = [0x3a6ea5, 0x6abe30, 0xd84a3b];

/** Sprite de villageois pixel art (24x32), 3 variantes de couleur. */
function drawVillager(g: Graphics, variant: number): void {
  const shirt = VILLAGER_SHIRTS[(variant % 3) as 0 | 1 | 2];
  addGroundShadow(g, 6, 2.5);

  // Jambes.
  g.rect(8, 22, 3, 6).fill(0x4a3020).stroke({ width: 1.5, color: OUTLINE });
  g.rect(13, 22, 3, 6).fill(0x4a3020).stroke({ width: 1.5, color: OUTLINE });

  // Torse.
  g.rect(7, 14, 10, 9).fill(shirt).stroke({ width: 2, color: OUTLINE });
  g.rect(7, 14, 10, 3).fill(shade(shirt, 1.15));

  // Bras (leger ecart pour posture de travail).
  g.rect(4, 15, 3, 7).fill(shade(shirt, 0.85)).stroke({ width: 1.5, color: OUTLINE });
  g.rect(17, 15, 3, 7).fill(shade(shirt, 0.85)).stroke({ width: 1.5, color: OUTLINE });

  // Tete.
  g.circle(12, 9, 5.5).fill(0xffe0b0).stroke({ width: 2, color: OUTLINE });
  g.circle(10, 8.5, 1.2).fill(OUTLINE);
  g.circle(14, 8.5, 1.2).fill(OUTLINE);

  // Cheveux.
  g.arc(12, 8, 5.5, Math.PI, 0).fill(0x5a3820).stroke({ width: 1.5, color: OUTLINE });

  // Outil selon variante.
  if (variant === 0) {
    g.rect(18, 12, 2, 10).fill(PALETTE.wood).stroke({ width: 1.5, color: OUTLINE });
    g.rect(16, 10, 6, 3).fill(PALETTE.stone).stroke({ width: 1.5, color: OUTLINE });
  } else if (variant === 1) {
    g.rect(3, 14, 2, 12).fill(PALETTE.woodDark).stroke({ width: 1.5, color: OUTLINE });
    poly(g, [1, 14, 7, 12, 6, 16], PALETTE.stoneDark);
  } else {
    g.rect(18, 16, 2, 8).fill(PALETTE.wood).stroke({ width: 1.5, color: OUTLINE });
    g.circle(19, 14, 3).fill(PALETTE.grassLight).stroke({ width: 1.5, color: OUTLINE });
  }
}
