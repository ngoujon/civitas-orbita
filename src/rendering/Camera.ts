/**
 * Camera 2D : zoom, pan, recentrage, lissage.
 *
 * Applique une transformation a un conteneur-monde Pixi. Le centre du monde
 * (feu de camp) est a (0,0). La camera vise un point-monde affiche au centre
 * de l'ecran, avec un facteur de zoom. Les transitions sont lissees (lerp)
 * pour rester fluides a 60 FPS.
 */

import type { Container } from 'pixi.js';
import { CAMERA } from '@/config/game';

export class Camera {
  /** Point-monde affiche au centre de l'ecran (cible). */
  private targetX = 0;
  private targetY = 0;
  private targetZoom: number = CAMERA.defaultZoom;

  /** Valeurs courantes lissees. */
  private x = 0;
  private y = 0;
  private zoom: number = CAMERA.defaultZoom;

  private screenW = 1;
  private screenH = 1;

  constructor(private readonly world: Container) {}

  resize(width: number, height: number): void {
    this.screenW = width;
    this.screenH = height;
  }

  get currentZoom(): number {
    return this.zoom;
  }

  /** Deplace la cible de la camera d'un delta en pixels-ecran. */
  panByScreen(dxScreen: number, dyScreen: number): void {
    this.targetX -= dxScreen / this.zoom;
    this.targetY -= dyScreen / this.zoom;
  }

  /** Deplace la cible d'un delta en pixels-monde (ex: clavier). */
  panByWorld(dx: number, dy: number): void {
    this.targetX += dx;
    this.targetY += dy;
  }

  /** Zoom centre sur un point-ecran (molette). */
  zoomAt(screenX: number, screenY: number, factor: number): void {
    const before = this.screenToWorld(screenX, screenY);
    this.targetZoom = clamp(this.targetZoom * factor, CAMERA.minZoom, CAMERA.maxZoom);
    // On applique immediatement pour calculer l'ancrage, puis on corrige la cible.
    const afterZoom = clamp(this.zoom * factor, CAMERA.minZoom, CAMERA.maxZoom);
    const after = this.screenToWorldWithZoom(screenX, screenY, afterZoom);
    this.targetX += before.x - after.x;
    this.targetY += before.y - after.y;
  }

  /** Recentre en douceur sur le feu de camp (0,0) au zoom par defaut. */
  recenter(): void {
    this.targetX = 0;
    this.targetY = 0;
    this.targetZoom = CAMERA.defaultZoom;
  }

  /** Saut instantane (chargement de partie). */
  snapTo(x: number, y: number, zoom: number = CAMERA.defaultZoom): void {
    this.targetX = this.x = x;
    this.targetY = this.y = y;
    this.targetZoom = this.zoom = clamp(zoom, CAMERA.minZoom, CAMERA.maxZoom);
    this.apply();
  }

  /** Lissage + application de la transform. dt en secondes. */
  update(dt: number): void {
    // Lerp framerate-independant.
    const t = 1 - Math.pow(1 - CAMERA.smoothing, dt * 60);
    this.x += (this.targetX - this.x) * t;
    this.y += (this.targetY - this.y) * t;
    this.zoom += (this.targetZoom - this.zoom) * t;
    this.apply();
  }

  private apply(): void {
    this.world.scale.set(this.zoom);
    this.world.position.set(
      this.screenW / 2 - this.x * this.zoom,
      this.screenH / 2 - this.y * this.zoom,
    );
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return this.screenToWorldWithZoom(screenX, screenY, this.zoom);
  }

  private screenToWorldWithZoom(
    screenX: number,
    screenY: number,
    zoom: number,
  ): { x: number; y: number } {
    return {
      x: (screenX - this.screenW / 2) / zoom + this.x,
      y: (screenY - this.screenH / 2) / zoom + this.y,
    };
  }

  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: (worldX - this.x) * this.zoom + this.screenW / 2,
      y: (worldY - this.y) * this.zoom + this.screenH / 2,
    };
  }

  /** Bornes-monde visibles (pour le culling). */
  visibleBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    const tl = this.screenToWorld(0, 0);
    const br = this.screenToWorld(this.screenW, this.screenH);
    return { minX: tl.x, minY: tl.y, maxX: br.x, maxY: br.y };
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
