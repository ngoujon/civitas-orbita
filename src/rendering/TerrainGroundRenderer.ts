/**
 * Textures de sol procedurales pour les secteurs herbeux.
 * Style pixel art : variations par case, touffes, taches, bordures douces.
 */

import { Graphics } from 'pixi.js';
import { PALETTE } from '@/config/game';

const GRASS_VARIANTS = [
  0x6abe30, 0x64b82c, 0x58a826, 0x72c838, 0x4e9620, 0x7ad04a, 0x529e24,
] as const;

const GRASS_BLADE = [0x3d7018, 0x4a8820, 0x88d84a, 0x5a9a28] as const;

/** Remplit un secteur herbeux avec texture procedurale deterministe. */
export function drawRichSectorGround(
  g: Graphics,
  inner: number,
  outer: number,
  start: number,
  end: number,
  ringIndex: number,
  sectorIndex: number,
): void {
  const seed = hashString(`${ringIndex}:${sectorIndex}`);
  const rng = mulberry32(seed);
  const base = GRASS_VARIANTS[seed % GRASS_VARIANTS.length] ?? PALETTE.grass;
  const mid = shadeColor(base, rng() > 0.5 ? 0.06 : -0.05);

  fillWedge(g, inner, outer, start, end, base);

  const midR = (inner + outer) * 0.5;
  const band = (outer - inner) * 0.22;
  fillWedge(g, midR - band, midR + band, start + 0.02, end - 0.02, mid, 0.35);

  const patchCount = 1 + (seed % 2);
  for (let p = 0; p < patchCount; p++) {
    const a = lerpAngle(start, end, 0.15 + rng() * 0.7);
    const r = lerp(inner + 14, outer - 14, rng());
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    const pr = 10 + rng() * 18;
    const patchColor = rng() > 0.45 ? shadeColor(base, 0.1) : shadeColor(base, -0.12);
    g.circle(px, py, pr).fill({ color: patchColor, alpha: 0.22 + rng() * 0.12 });
  }

  const span = outer - inner;
  const tuftCount = Math.min(14, Math.max(6, Math.floor(span * 0.08)));
  for (let i = 0; i < tuftCount; i++) {
    const a = lerpAngle(start, end, 0.06 + rng() * 0.88);
    const r = lerp(inner + 10, outer - 10, rng());
    drawGrassTuft(g, Math.cos(a) * r, Math.sin(a) * r, rng);
  }

  if (rng() > 0.72) {
    const a = lerpAngle(start, end, rng());
    const r = lerp(inner + 12, outer - 12, rng());
    drawWildFlower(g, Math.cos(a) * r, Math.sin(a) * r, rng);
  }
  if (rng() > 0.82) {
    const a = lerpAngle(start, end, rng());
    const r = lerp(inner + 12, outer - 12, rng());
    g.circle(Math.cos(a) * r, Math.sin(a) * r, 2 + rng() * 2).fill({
      color: PALETTE.stoneDark,
      alpha: 0.55,
    });
  }

  if (ringIndex > 1 && rng() > 0.88) {
    const a = lerpAngle(start, end, 0.2 + rng() * 0.6);
    const r = lerp(inner + 4, inner + span * 0.35, rng());
    g.circle(Math.cos(a) * r, Math.sin(a) * r, 5 + rng() * 6).fill({ color: 0x9a7048, alpha: 0.35 });
  }

  strokeWedge(g, inner, outer, start, end, 0x2a5018, 0.28, 1.2);
}

/** Secteur prepare : herbe tondue avec stries et taches plus claires. */
export function drawPreparedSectorGround(
  g: Graphics,
  inner: number,
  outer: number,
  start: number,
  end: number,
  ringIndex: number,
  sectorIndex: number,
): void {
  const seed = hashString(`prep:${ringIndex}:${sectorIndex}`);
  const rng = mulberry32(seed);

  fillWedge(g, inner, outer, start, end, PALETTE.grassLight, 0.14);

  const stripes = 4 + (seed % 3);
  for (let s = 0; s < stripes; s++) {
    const t = (s + 0.5) / stripes;
    const a = lerpAngle(start, end, t);
    const r0 = inner + 8;
    const r1 = outer - 8;
    g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    g.stroke({ width: 1.5, color: 0xa8e860, alpha: 0.12 + rng() * 0.08 });
  }

  const specks = 5 + (seed % 4);
  for (let i = 0; i < specks; i++) {
    const a = lerpAngle(start, end, rng());
    const r = lerp(inner + 10, outer - 10, rng());
    g.circle(Math.cos(a) * r, Math.sin(a) * r, 1.5 + rng()).fill({ color: 0xc8f070, alpha: 0.35 });
  }
}

/** Plage / sable avec grain procederal. */
export function drawBeachGround(g: Graphics, outerRadius: number): void {
  g.circle(0, 0, outerRadius + 22).fill(0xe8d39a);
  g.circle(0, 0, outerRadius + 8).fill(0xd4bc82);

  const rng = mulberry32(hashString(`beach:${Math.floor(outerRadius)}`));
  const grains = Math.min(120, Math.floor(outerRadius * 0.15));
  for (let i = 0; i < grains; i++) {
    const a = rng() * Math.PI * 2;
    const r = outerRadius + 4 + rng() * 20;
    const shade = rng() > 0.5 ? 0xc9a86a : 0xf0dfa8;
    g.rect(Math.cos(a) * r - 1, Math.sin(a) * r - 1, 2 + rng() * 2, 2).fill({ color: shade, alpha: 0.45 });
  }
}

function drawGrassTuft(g: Graphics, x: number, y: number, rng: () => number): void {
  const blades = 2 + Math.floor(rng() * 3);
  for (let b = 0; b < blades; b++) {
    const ox = (b - (blades - 1) * 0.5) * 3 + (rng() - 0.5) * 2;
    const h = 4 + rng() * 7;
    const color = GRASS_BLADE[Math.floor(rng() * GRASS_BLADE.length)] ?? PALETTE.grassDark;
    g.rect(x + ox - 1, y - h, 2, h).fill({ color, alpha: 0.75 + rng() * 0.2 });
  }
}

function drawWildFlower(g: Graphics, x: number, y: number, rng: () => number): void {
  const petal = rng() > 0.5 ? 0xffe566 : 0xff9a9a;
  g.circle(x, y - 3, 2.5).fill({ color: petal, alpha: 0.85 });
  g.circle(x, y - 3, 1).fill({ color: 0xffe24a, alpha: 0.95 });
  g.rect(x - 0.5, y - 2, 1, 4).fill({ color: 0x4a8820, alpha: 0.8 });
}

function fillWedge(
  g: Graphics,
  inner: number,
  outer: number,
  start: number,
  end: number,
  color: number,
  alpha = 1,
): void {
  g.moveTo(Math.cos(start) * inner, Math.sin(start) * inner);
  g.lineTo(Math.cos(start) * outer, Math.sin(start) * outer);
  g.arc(0, 0, outer, start, end);
  g.lineTo(Math.cos(end) * inner, Math.sin(end) * inner);
  g.arc(0, 0, inner, end, start, true);
  g.closePath();
  g.fill({ color, alpha });
}

function strokeWedge(
  g: Graphics,
  inner: number,
  outer: number,
  start: number,
  end: number,
  color: number,
  alpha: number,
  width: number,
): void {
  g.moveTo(Math.cos(start) * inner, Math.sin(start) * inner);
  g.lineTo(Math.cos(start) * outer, Math.sin(start) * outer);
  g.arc(0, 0, outer, start, end);
  g.lineTo(Math.cos(end) * inner, Math.sin(end) * inner);
  g.arc(0, 0, inner, end, start, true);
  g.closePath();
  g.stroke({ width, color, alpha, join: 'round' });
}

function shadeColor(color: number, factor: number): number {
  const r = ((color >> 16) & 0xff) * (1 + factor);
  const gv = ((color >> 8) & 0xff) * (1 + factor);
  const b = (color & 0xff) * (1 + factor);
  return (
    ((Math.min(255, Math.max(0, r)) << 16) |
      (Math.min(255, Math.max(0, gv)) << 8) |
      Math.min(255, Math.max(0, b))) >>>
    0
  );
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

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
