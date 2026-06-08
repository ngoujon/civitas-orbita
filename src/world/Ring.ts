/**
 * Anneau concentrique : ensemble de secteurs a une distance donnee du centre.
 *
 * Geometrie pure et deterministe, derivee de config/rings.ts.
 * Aucune logique de gameplay ici.
 */

import {
  ringInnerRadius,
  ringOuterRadius,
  sectorsInRing,
} from '@/config/rings';
import type { SectorCoord, SectorGeometry } from './Sector';

const TAU = Math.PI * 2;

export class Ring {
  readonly index: number;
  readonly sectorCount: number;
  readonly innerRadius: number;
  readonly outerRadius: number;

  constructor(index: number) {
    this.index = index;
    this.sectorCount = sectorsInRing(index);
    this.innerRadius = ringInnerRadius(index);
    this.outerRadius = ringOuterRadius(index);
  }

  /** Rayon median (ou placer le centre d'un secteur / batiment). */
  get midRadius(): number {
    return (this.innerRadius + this.outerRadius) / 2;
  }

  /** Angle de debut d'un secteur (radians). Le centre (ring 0) couvre tout le cercle. */
  startAngle(index: number): number {
    if (this.index === 0) return 0;
    return (index / this.sectorCount) * TAU;
  }

  endAngle(index: number): number {
    if (this.index === 0) return TAU;
    return ((index + 1) / this.sectorCount) * TAU;
  }

  centerAngle(index: number): number {
    if (this.index === 0) return 0;
    return ((index + 0.5) / this.sectorCount) * TAU;
  }

  /** Geometrie complete d'un secteur de cet anneau. */
  geometry(index: number): SectorGeometry {
    const coord: SectorCoord = { ring: this.index, index };
    if (this.index === 0) {
      return {
        coord,
        cx: 0,
        cy: 0,
        innerRadius: 0,
        outerRadius: this.outerRadius,
        startAngle: 0,
        endAngle: TAU,
      };
    }
    const angle = this.centerAngle(index);
    const r = this.midRadius;
    return {
      coord,
      cx: Math.cos(angle) * r,
      cy: Math.sin(angle) * r,
      innerRadius: this.innerRadius,
      outerRadius: this.outerRadius,
      startAngle: this.startAngle(index),
      endAngle: this.endAngle(index),
    };
  }

  /** Vrai si un rayon (distance au centre) tombe dans cet anneau. */
  containsRadius(radius: number): boolean {
    if (this.index === 0) return radius <= this.outerRadius;
    return radius > this.innerRadius && radius <= this.outerRadius;
  }

  /** Index de secteur correspondant a un angle donne (radians, normalise). */
  sectorAtAngle(angle: number): number {
    if (this.index === 0) return 0;
    const a = ((angle % TAU) + TAU) % TAU;
    return Math.floor((a / TAU) * this.sectorCount) % this.sectorCount;
  }

  /** Indices des secteurs de l'anneau `other` chevauchant angulairement le secteur `index`. */
  overlappingSectors(index: number, other: Ring): number[] {
    if (this.index === 0) {
      // Le centre touche tous les secteurs de l'anneau 1.
      return Array.from({ length: other.sectorCount }, (_, i) => i);
    }
    if (other.index === 0) return [0];

    const start = this.startAngle(index);
    const end = this.endAngle(index);
    const result: number[] = [];
    for (let i = 0; i < other.sectorCount; i++) {
      const os = other.startAngle(i);
      const oe = other.endAngle(i);
      // Chevauchement d'intervalles angulaires (memes bornes 0..TAU, pas de wrap ici).
      if (os < end && oe > start) result.push(i);
    }
    return result;
  }
}
