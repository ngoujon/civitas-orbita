/**
 * Carte du monde : ensemble des anneaux et services geometriques.
 *
 * Purement derive de la config (ring count). Fournit : iteration des secteurs,
 * conversion point-monde -> secteur (hit testing), voisinage, geometrie.
 *
 * La carte ne stocke PAS l'occupation (qui vit dans GameState) afin de rester
 * une vue geometrique reutilisable et peu couteuse.
 */

import { MAX_RINGS, BEACH_SNAP_MARGIN } from '@/config/rings';
import { Ring } from './Ring';
import type { SectorCoord, SectorGeometry } from './Sector';

const TAU = Math.PI * 2;

export class WorldMap {
  private rings: Ring[] = [];

  constructor(ringCount: number) {
    this.setRingCount(ringCount);
  }

  /** Nombre d'anneaux hors centre (le centre est l'anneau 0, toujours present). */
  get ringCount(): number {
    return this.rings.length - 1;
  }

  /** Nombre total de secteurs sur la carte. */
  get totalSectors(): number {
    return this.rings.reduce((sum, r) => sum + r.sectorCount, 0);
  }

  setRingCount(ringCount: number): void {
    const target = Math.min(Math.max(ringCount, 0), MAX_RINGS);
    this.rings = [];
    for (let i = 0; i <= target; i++) this.rings.push(new Ring(i));
  }

  /** Ajoute un anneau supplementaire a l'exterieur. */
  expand(): void {
    if (this.ringCount >= MAX_RINGS) return;
    this.rings.push(new Ring(this.rings.length));
  }

  getRing(index: number): Ring | undefined {
    return this.rings[index];
  }

  get outerRadius(): number {
    return this.rings[this.rings.length - 1]?.outerRadius ?? 0;
  }

  isValidCoord(coord: SectorCoord): boolean {
    const ring = this.rings[coord.ring];
    return !!ring && coord.index >= 0 && coord.index < ring.sectorCount;
  }

  geometry(coord: SectorCoord): SectorGeometry | undefined {
    const ring = this.rings[coord.ring];
    if (!ring || coord.index < 0 || coord.index >= ring.sectorCount) return undefined;
    return ring.geometry(coord.index);
  }

  /** Itere toutes les coordonnees de secteurs (centre inclus). */
  *sectors(): IterableIterator<SectorCoord> {
    for (const ring of this.rings) {
      for (let i = 0; i < ring.sectorCount; i++) {
        yield { ring: ring.index, index: i };
      }
    }
  }

  /** Convertit un point-monde en secteur. Null si hors carte. */
  sectorAtPoint(x: number, y: number): SectorCoord | null {
    const radius = Math.hypot(x, y);
    const angle = Math.atan2(y, x);

    const outer = this.rings[this.rings.length - 1];
    if (outer && outer.index > 0) {
      const snapLimit = outer.outerRadius + BEACH_SNAP_MARGIN;
      if (radius > outer.outerRadius && radius <= snapLimit) {
        return { ring: outer.index, index: outer.sectorAtAngle(angle) };
      }
    }

    for (const ring of this.rings) {
      if (ring.containsRadius(radius)) {
        if (ring.index === 0) return { ring: 0, index: 0 };
        return { ring: ring.index, index: ring.sectorAtAngle(angle) };
      }
    }
    return null;
  }

  /**
   * Voisins d'un secteur : adjacents dans le meme anneau (avec wrap) + secteurs
   * radialement adjacents (anneaux interieur/exterieur) chevauchant en angle.
   */
  neighbors(coord: SectorCoord): SectorCoord[] {
    const ring = this.rings[coord.ring];
    if (!ring) return [];
    const result: SectorCoord[] = [];

    if (ring.index === 0) {
      // Le centre est voisin de tout l'anneau 1.
      const r1 = this.rings[1];
      if (r1) for (let i = 0; i < r1.sectorCount; i++) result.push({ ring: 1, index: i });
      return result;
    }

    // Intra-anneau (wrap circulaire).
    const n = ring.sectorCount;
    result.push({ ring: ring.index, index: (coord.index - 1 + n) % n });
    result.push({ ring: ring.index, index: (coord.index + 1) % n });

    // Anneau interieur.
    const inner = this.rings[ring.index - 1];
    if (inner) {
      for (const i of ring.overlappingSectors(coord.index, inner)) {
        result.push({ ring: inner.index, index: i });
      }
    }
    // Anneau exterieur.
    const outer = this.rings[ring.index + 1];
    if (outer) {
      for (const i of ring.overlappingSectors(coord.index, outer)) {
        result.push({ ring: outer.index, index: i });
      }
    }
    return result;
  }

  /** Normalise un angle dans [0..TAU). Expose pour le rendu. */
  static normalizeAngle(angle: number): number {
    return ((angle % TAU) + TAU) % TAU;
  }
}
