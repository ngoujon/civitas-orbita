/**
 * Mer procedurale animee (vagues, ecume au rivage).
 *
 * OBSERVATEUR : ne lit que la geometrie de la carte pour le rivage.
 * Couche sous le terrain, dans le conteneur-monde (suit pan/zoom).
 */

import { Container, Graphics, TilingSprite, type Renderer, type Texture } from 'pixi.js';
import { PALETTE } from '@/config/game';

const TILE = 128;
const SEA_EXTENT = 24_000;

const WATER_DEEP = 0x256a9e;
const WATER_MID = PALETTE.water;
const WATER_LIGHT = 0x5ec8f0;
const WATER_FOAM = 0xa8e8ff;

export class SeaRenderer {
  private readonly base: TilingSprite;
  private readonly shimmer: TilingSprite;
  private readonly waves: Graphics;

  constructor(parent: Container, renderer: Renderer) {
    const deepTex = bakeWaterTile(renderer, 'deep');
    const shimmerTex = bakeWaterTile(renderer, 'shimmer');

    this.base = new TilingSprite({ texture: deepTex, width: SEA_EXTENT, height: SEA_EXTENT });
    this.base.anchor.set(0.5);
    this.base.position.set(0, 0);

    this.shimmer = new TilingSprite({ texture: shimmerTex, width: SEA_EXTENT, height: SEA_EXTENT });
    this.shimmer.anchor.set(0.5);
    this.shimmer.position.set(0, 0);
    this.shimmer.alpha = 0.42;
    this.shimmer.blendMode = 'screen';

    this.waves = new Graphics();

    parent.addChildAt(this.base, 0);
    parent.addChildAt(this.shimmer, 1);
    parent.addChildAt(this.waves, 2);
  }

  /** Met a jour l'animation de la mer (appele chaque frame de rendu). */
  update(elapsed: number, shoreRadius: number): void {
    const t = elapsed;

    // Derive lente des tuiles = courants.
    this.base.tilePosition.set(t * 14 + Math.sin(t * 0.2) * 6, t * 10 + Math.cos(t * 0.17) * 5);
    this.shimmer.tilePosition.set(-t * 22, t * 16 + Math.sin(t * 0.35) * 8);

    this.drawWaves(t, shoreRadius);
  }

  private drawWaves(t: number, shoreR: number): void {
    const g = this.waves;
    g.clear();

    // Vagues concentriques autour de l'ile (mer qui vient frapper le rivage).
    for (let i = 0; i < 6; i++) {
      const phase = (t * 0.55 + i * 0.85) % (Math.PI * 2);
      const r = shoreR + 28 + i * 22 + Math.sin(phase) * 6;
      const alpha = 0.32 - i * 0.04;
      g.circle(0, 0, r).stroke({ width: 2.5, color: WATER_LIGHT, alpha: Math.max(0.08, alpha) });
    }

    // Ecume au contact du sable.
    const foamR = shoreR + 14 + Math.sin(t * 1.4) * 3;
    g.circle(0, 0, foamR).stroke({ width: 4, color: WATER_FOAM, alpha: 0.45 });
    g.circle(0, 0, foamR + 6).stroke({ width: 2, color: WATER_FOAM, alpha: 0.22 });

    // Ondulations directionnelles dans la mer (visible au zoom).
    const bands = 5;
    for (let b = 0; b < bands; b++) {
      const baseR = shoreR + 60 + b * 48;
      const segments = 48 + b * 4;
      const amp = 5 + b * 1.5;
      const speed = 1.1 + b * 0.25;

      g.moveTo(0, 0);
      for (let s = 0; s <= segments; s++) {
        const a = (s / segments) * Math.PI * 2;
        const wobble = Math.sin(a * 5 + t * speed + b) * amp + Math.sin(a * 9 - t * speed * 0.7) * amp * 0.4;
        const r = baseR + wobble;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (s === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
      g.stroke({ width: 1.5 + b * 0.3, color: WATER_MID, alpha: 0.14 + b * 0.03 });
    }
  }

  destroy(): void {
    this.base.destroy(true);
    this.shimmer.destroy(true);
    this.waves.destroy();
  }
}

function bakeWaterTile(renderer: Renderer, variant: 'deep' | 'shimmer'): Texture {
  const g = new Graphics();

  for (let y = 0; y < TILE; y++) {
    const wave =
      Math.sin(y * 0.11) * 0.07 +
      Math.sin(y * 0.27 + 1.2) * 0.04 +
      Math.sin(y * 0.05) * 0.03;
    const base = variant === 'deep' ? WATER_DEEP : WATER_MID;
    g.rect(0, y, TILE, 1).fill(shade(base, 1 + wave));
  }

  // Cretes horizontales (vaguelette dans la tuile).
  for (let i = 0; i < 5; i++) {
    const cy = 14 + i * 24;
    const rx = TILE * (0.45 + (i % 2) * 0.08);
    const alpha = variant === 'shimmer' ? 0.55 : 0.28;
    g.ellipse(TILE / 2, cy, rx, 3.5).fill({ color: WATER_LIGHT, alpha });
    g.ellipse(TILE / 2 + 18, cy + 8, rx * 0.7, 2.5).fill({ color: WATER_FOAM, alpha: alpha * 0.6 });
  }

  // Petites ecumes pixelisees.
  if (variant === 'shimmer') {
    for (let i = 0; i < 8; i++) {
      const x = (i * 17 + 9) % TILE;
      const y = (i * 13 + 5) % TILE;
      g.circle(x, y, 1.2 + (i % 2)).fill({ color: WATER_FOAM, alpha: 0.35 });
    }
  }

  const tex = renderer.generateTexture({ target: g, width: TILE, height: TILE, antialias: false });
  tex.source.scaleMode = 'nearest';
  g.destroy();
  return tex;
}

function shade(hex: number, f: number): number {
  const r = clamp255(((hex >> 16) & 0xff) * f);
  const g = clamp255(((hex >> 8) & 0xff) * f);
  const b = clamp255((hex & 0xff) * f);
  return (r << 16) | (g << 8) | b;
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}
