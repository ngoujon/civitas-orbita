/**
 * Brouillard de nuages sur la mer inexploree.
 */

import { Container, Graphics, Sprite, type Renderer, type Texture } from 'pixi.js';
import { FOG_SEA_EXTENT, SEA_FOG_CELL, SHORE_FOG_CLEARANCE } from '@/config/exploration';
import type { GameState } from '@/game/GameState';
import { isSeaCellExplored, seaCellCenter } from '@/world/SeaExploration';
import type { Camera } from './Camera';

const CLOUD_TILE = 128;

export class SeaFogRenderer {
  private readonly layer = new Container();
  private readonly cloudTex: Texture;
  private readonly sprites = new Map<string, Sprite>();
  private readonly pool: Sprite[] = [];
  private elapsed = 0;

  constructor(parent: Container, renderer: Renderer, insertIndex: number) {
    this.cloudTex = bakeCloudTile(renderer);
    parent.addChildAt(this.layer, insertIndex);
  }

  update(state: GameState, shoreRadius: number, camera: Camera, dt: number): void {
    this.elapsed += dt;
    const bounds = camera.visibleBounds();
    const margin = SEA_FOG_CELL * 2;
    const minCx = Math.floor((bounds.minX - margin) / SEA_FOG_CELL);
    const maxCx = Math.ceil((bounds.maxX + margin) / SEA_FOG_CELL);
    const minCy = Math.floor((bounds.minY - margin) / SEA_FOG_CELL);
    const maxCy = Math.ceil((bounds.maxY + margin) / SEA_FOG_CELL);

    const seen = new Set<string>();
    const fogFreeRadius = shoreRadius + SHORE_FOG_CLEARANCE;
    const drift = Math.sin(this.elapsed * 0.25) * 4;

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const center = seaCellCenter(cx, cy);
        if (Math.hypot(center.x, center.y) < fogFreeRadius) continue;
        if (Math.hypot(center.x, center.y) > FOG_SEA_EXTENT) continue;
        if (isSeaCellExplored(state, cx, cy)) continue;

        const key = `${cx},${cy}`;
        seen.add(key);
        let sprite = this.sprites.get(key);
        if (!sprite) {
          sprite = this.pool.pop() ?? new Sprite(this.cloudTex);
          sprite.anchor.set(0.5);
          sprite.alpha = 0.88;
          this.layer.addChild(sprite);
          this.sprites.set(key, sprite);
        }

        const wobble = Math.sin(this.elapsed * 0.8 + cx * 0.7 + cy * 0.5) * 3;
        sprite.position.set(center.x + drift + wobble, center.y + drift * 0.6);
        const scale = 1.15 + ((cx * 17 + cy * 31) % 7) * 0.04;
        sprite.scale.set(scale);
        sprite.rotation = Math.sin(this.elapsed * 0.15 + cx) * 0.04;
      }
    }

    for (const [key, sprite] of this.sprites) {
      if (!seen.has(key)) {
        this.layer.removeChild(sprite);
        this.pool.push(sprite);
        this.sprites.delete(key);
      }
    }
  }

  destroy(): void {
    for (const s of this.sprites.values()) s.destroy();
    for (const s of this.pool) s.destroy();
    this.sprites.clear();
    this.pool.length = 0;
    this.cloudTex.destroy(true);
    this.layer.destroy({ children: true });
  }
}

function bakeCloudTile(renderer: Renderer): Texture {
  const g = new Graphics();
  const w = CLOUD_TILE;
  const h = CLOUD_TILE;

  g.rect(0, 0, w, h).fill({ color: 0xd8e8f8, alpha: 0.92 });

  const puffs: [number, number, number, number][] = [
    [32, 40, 28, 0.95],
    [70, 35, 34, 0.9],
    [95, 58, 22, 0.85],
    [48, 72, 26, 0.88],
    [18, 55, 20, 0.8],
    [88, 82, 18, 0.75],
  ];

  for (const [px, py, pr, alpha] of puffs) {
    g.circle(px, py, pr).fill({ color: 0xf4f8ff, alpha });
    g.circle(px - pr * 0.35, py + pr * 0.15, pr * 0.65).fill({ color: 0xffffff, alpha: alpha * 0.85 });
    g.circle(px + pr * 0.3, py + pr * 0.1, pr * 0.55).fill({ color: 0xeaf0fa, alpha: alpha * 0.7 });
  }

  for (let i = 0; i < 12; i++) {
    const x = (i * 23 + 11) % w;
    const y = (i * 19 + 7) % h;
    g.circle(x, y, 2 + (i % 3)).fill({ color: 0xffffff, alpha: 0.35 });
  }

  const tex = renderer.generateTexture({ target: g, width: w, height: h, antialias: false });
  tex.source.scaleMode = 'nearest';
  g.destroy();
  return tex;
}
