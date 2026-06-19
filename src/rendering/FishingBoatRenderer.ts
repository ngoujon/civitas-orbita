/**
 * Rendu des bateaux de peche naviguant en mer (zone bleue).
 */

import { Container, Sprite } from 'pixi.js';
import type { GameState } from '@/game/GameState';
import { isWorldPointExplored } from '@/world/SeaExploration';
import { ProceduralSprites } from './ProceduralSprites';

export class FishingBoatRenderer {
  private readonly sprites = new Map<string, Sprite>();
  private readonly pool: Sprite[] = [];
  private elapsed = 0;

  constructor(
    private readonly spritesLib: ProceduralSprites,
    private readonly layer: Container,
  ) {
    this.layer.sortableChildren = true;
  }

  update(state: GameState, dt: number): void {
    this.elapsed += dt;
    const seen = new Set<string>();

    for (const boat of Object.values(state.fishingBoats)) {
      seen.add(boat.id);
      let sprite = this.sprites.get(boat.id);
      if (!sprite) {
        sprite = this.acquireSprite(boat.variant);
        this.sprites.set(boat.id, sprite);
        this.layer.addChild(sprite);
      }

      const bob = boat.phase === 'fishing' ? Math.sin(this.elapsed * 3 + boat.variant) * 2 : 0;
      sprite.position.set(boat.x, boat.y + bob);
      sprite.rotation = boat.heading;
      sprite.zIndex = boat.y;
      sprite.alpha = boat.phase === 'fishing' ? 0.95 : 1;
      sprite.visible = isWorldPointExplored(state, boat.x, boat.y);
    }

    for (const [id, sprite] of this.sprites) {
      if (!seen.has(id)) {
        this.layer.removeChild(sprite);
        this.pool.push(sprite);
        this.sprites.delete(id);
      }
    }
  }

  private acquireSprite(variant: number): Sprite {
    const sprite = this.pool.pop() ?? new Sprite(this.spritesLib.getFishingBoatTexture(variant));
    sprite.anchor.set(0.5, 0.5);
    sprite.texture = this.spritesLib.getFishingBoatTexture(variant);
    return sprite;
  }

  destroy(): void {
    for (const sprite of this.sprites.values()) sprite.destroy();
    for (const sprite of this.pool) sprite.destroy();
    this.sprites.clear();
    this.pool.length = 0;
  }
}
