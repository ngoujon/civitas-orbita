/**
 * Secteur : plus petite unite constructible du monde.
 *
 * Un secteur est identifie par (ring, index). Sa geometrie est DERIVEE
 * de la config des anneaux (pas stockee) ; seule l'occupation est en GameState.
 */

export interface SectorCoord {
  /** Index de l'anneau (0 = centre). */
  readonly ring: number;
  /** Index du secteur dans l'anneau (0..N-1, sens trigonometrique). */
  readonly index: number;
}

/** Geometrie calculee d'un secteur, en coordonnees-monde (origine = feu de camp). */
export interface SectorGeometry {
  readonly coord: SectorCoord;
  /** Position du centre du secteur. */
  readonly cx: number;
  readonly cy: number;
  /** Rayons interne/externe de l'anneau. */
  readonly innerRadius: number;
  readonly outerRadius: number;
  /** Bornes angulaires (radians, [0..2PI)). */
  readonly startAngle: number;
  readonly endAngle: number;
}

const KEY_SEP = ':';

/** Cle string stable d'un secteur (pour les Map d'occupation, serialisable). */
export function sectorKey(coord: SectorCoord): string {
  return `${coord.ring}${KEY_SEP}${coord.index}`;
}

export function parseSectorKey(key: string): SectorCoord {
  const [ring, index] = key.split(KEY_SEP);
  return { ring: Number(ring), index: Number(index) };
}

export function sameSector(a: SectorCoord, b: SectorCoord): boolean {
  return a.ring === b.ring && a.index === b.index;
}
