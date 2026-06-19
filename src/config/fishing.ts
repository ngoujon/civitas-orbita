/**
 * Parametrage des bateaux de peche du port.
 */

/** Bateaux max par port (limite superieure ; plafonne par les travailleurs). */
export const MAX_BOATS_PER_PORT = 2;

/** Vitesse de navigation (pixels-monde / seconde). */
export const BOAT_SPEED = 55;

/** Duree de peche sur zone avant retour (secondes). */
export const FISHING_DURATION = 10;

/** Nourriture apportee au port a chaque tour complet. */
export const FOOD_PER_CATCH = 4;

/** Distance du quai par rapport au rivage. */
export const FISHING_DOCK_OFFSET = 18;

/** Zone de peche : min/max au-dela du rivage. */
export const FISHING_SEA_MIN = 35;
export const FISHING_SEA_MAX = 320;

/** Distance d arrivee (pixels). */
export const BOAT_ARRIVE_DIST = 8;
