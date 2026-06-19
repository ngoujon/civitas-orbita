/**
 * Rendu des bateaux eclaireurs (decouverte de la mer).
 */

import { Container, Sprite } from 'pixi.js';
import type { GameState } from '@/game/GameState';
import { ProceduralSprites } from './ProceduralSprites';

export class ScoutBoatRenderer {
  private readonly sprites = new Map<string, Sprite>();
  private readonly pool: Sprite[] = [];
  private elapsed = 0;

  constructor(
    private readonly spritesLib: ProceduralSprites,
    private readonly layer: Container,
  ) {}

  update(state: GameState, dt: number): void {
    this.elapsed += dt;
    const seen = new Set<string>();

    for (const scout of Object.values(state.scoutBoats)) {
      seen.add(scout.id);
      let sprite = this.sprites.get(scout.id);
      if (!sprite) {
        sprite = this.pool.pop() ?? new Sprite(this.spritesLib.getScoutBoatTexture());
        sprite.anchor.set(0.5, 0.5);
        this.sprites.set(scout.id, sprite);
        this.layer.addChild(sprite);
      }

      const pulse = Math.sin(this.elapsed * 4 + scout.trip) * 0.06;
      sprite.position.set(scout.x, scout.y);
      sprite.rotation = scout.heading;
      sprite.scale.set(1 + pulse);
      sprite.zIndex = scout.y + 5000;
      sprite.alpha = 1;
    }

    for (const [id, sprite] of this.sprites) {
      if (!seen.has(id)) {
        this.layer.removeChild(sprite);
        this.pool.push(sprite);
        this.sprites.delete(id);
      }
    }
  }

  destroy(): void {
    for (const s of this.sprites.values()) s.destroy();
    for (const s of this.pool) s.destroy();
    this.sprites.clear();
    this.pool.length = 0;
  }
}
