/**
 * Parametrage de l exploration de la mer (brouillard / nuages).
 */

/** Taille d une cellule de brouillard (pixels-monde). */
export const SEA_FOG_CELL = 160;

/** Rayon de revelation autour d un bateau eclaireur. */
export const SCOUT_REVEAL_RADIUS = 140;

/** Mer connue au demarrage (au-dela du rivage). */
export const INITIAL_SEA_EXPLORE = 400;

/** Bande de mer sans nuages autour du rivage (visuel + zone cotiere). */
export const SHORE_FOG_CLEARANCE = 220;

/** Portee max d exploration depuis le centre de l ile. */
export const SCOUT_MAX_RANGE = 2800;

/** Vitesse du bateau eclaireur. */
export const SCOUT_SPEED = 65;

/** Bateaux eclaireurs max par port. */
export const MAX_SCOUTS_PER_PORT = 1;

/** Pause sur zone decouverte avant nouvelle route (s). */
export const SCOUT_WAYPOINT_PAUSE = 1.5;

/** Distance d arrivee sur waypoint. */
export const SCOUT_ARRIVE_DIST = 14;

/** Etendue maximale du brouillard (alignee sur la mer). */
export const FOG_SEA_EXTENT = 12_000;
