/**
 * Parametrage des anneaux concentriques.
 *
 * Le monde est une serie d'anneaux autour du feu de camp central.
 * - Anneau 0 : le centre (1 secteur, le feu de camp).
 * - Anneau 1 : 4 secteurs.
 * - Anneau 2 : 8 secteurs.
 * - Anneau 3 : 12 secteurs.
 * - Anneau n : SECTORS_PER_RING_BASE * n secteurs.
 *
 * Entierement parametrable pour supporter des centaines d'anneaux.
 */

/** Increment de secteurs par anneau (4, 8, 12, 16, ...). */
export const SECTORS_PER_RING_BASE = 4;

/** Rayon interieur de l'anneau central (le centre), en pixels-monde. */
export const CENTER_RADIUS = 90;

/** Epaisseur (radiale) d'un anneau, en pixels-monde. */
export const RING_THICKNESS = 120;

/** Nombre d'anneaux generes au demarrage (hors centre). Extensible a chaud. */
export const INITIAL_RINGS = 4;

/** Borne dure pour eviter les abus (le moteur peut techniquement aller plus loin). */
export const MAX_RINGS = 500;

/**
 * Nombre de secteurs pour un index d'anneau donne.
 * Anneau 0 = centre = 1 secteur unique.
 */
export function sectorsInRing(ringIndex: number): number {
  if (ringIndex <= 0) return 1;
  return SECTORS_PER_RING_BASE * ringIndex;
}

/** Rayon interieur d'un anneau (depuis le centre du monde). */
export function ringInnerRadius(ringIndex: number): number {
  if (ringIndex <= 0) return 0;
  return CENTER_RADIUS + (ringIndex - 1) * RING_THICKNESS;
}

/** Rayon exterieur d'un anneau. */
export function ringOuterRadius(ringIndex: number): number {
  if (ringIndex <= 0) return CENTER_RADIUS;
  return CENTER_RADIUS + ringIndex * RING_THICKNESS;
}
