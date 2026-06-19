/**
 * Constantes globales du jeu.
 *
 * Source de verite unique pour les parametres moteur et d'equilibrage global.
 * Aucune logique ici : uniquement des donnees.
 */

/** Pas de simulation fixe (en secondes). 10 ticks logiques par seconde. */
export const TICK_SECONDS = 0.1;

/** Garde-fou : nombre max de ticks rattrapes par frame (anti spiral of death). */
export const MAX_TICKS_PER_FRAME = 5;

/** La simulation tourne toujours au rythme du temps reel (1 s reelle = 1 s de jeu). */
export const REALTIME_SPEED = 1 as const;

/** Resolution de design (la camera s'adapte ensuite a la fenetre reelle). */
export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;

/** Taille en pixels-monde d'une "tuile" de reference (sert au dessin des sprites). */
export const TILE_SIZE = 64;

/** Affichage des batiments poses sur la carte (textures procedurales 48x56 px). */
export const BUILDING_DISPLAY = {
  scale: 1.38,
} as const;

/** Parametres de camera. */
export const CAMERA = {
  minZoom: 0.25,
  maxZoom: 3,
  defaultZoom: 1,
  zoomStep: 1.15,
  /** Vitesse de lissage (lerp) pour pan/zoom. 0..1, plus haut = plus rapide. */
  smoothing: 0.18,
  /** Vitesse de deplacement clavier en pixels-monde par seconde. */
  panSpeed: 800,
} as const;

/** Equilibrage de la population. */
export const POPULATION = {
  /** Nourriture consommee par habitant et par seconde. */
  foodPerCapitaPerSecond: 0.05,
  /** Taux de croissance (habitants/seconde) quand nourri et logement dispo. */
  growthPerSecond: 0.15,
  /** Taux de declin (habitants/seconde) en cas de famine. */
  starvationPerSecond: 0.1,
  /** Population de depart (le chef de camp compte pour 1). */
  startCount: 1,
} as const;

/** Amelioration des batiments (productivite, logement, stockage x niveau). */
export const BUILDING_UPGRADE = {
  /** Niveau maximum par defaut. */
  maxLevel: 5,
  /** Multiplicateur du cout de base : cout = base * niveauCourant * costScale. */
  costScale: 0.85,
} as const;

/** Palette de base, ambiance Pokemon Rouge Feu (couleurs vives, chaleureuses). */
export const PALETTE = {
  grass: 0x6abe30,
  grassDark: 0x4a8a22,
  grassLight: 0x88d84a,
  dirt: 0xa86b32,
  dirtDark: 0x7a4a20,
  water: 0x3a9bdc,
  waterDeep: 0x256a9e,
  stone: 0x9badb7,
  stoneDark: 0x6b7b85,
  wood: 0xc77b3b,
  woodDark: 0x8a5224,
  roof: 0xd84a3b,
  roofDark: 0xa02c20,
  fire: 0xff9a1f,
  fireHot: 0xffe24a,
  outline: 0x202840,
  sectorGrid: 0x000000,
  highlight: 0xffe24a,
  invalid: 0xd84a3b,
  text: 0xffffff,
} as const;
