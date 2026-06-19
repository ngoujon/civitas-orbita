/**
 * Bonus de production lorsque des batiments du meme groupe sont adjacents.
 */

/** Groupes de synergie (meme groupe = bonus si voisins sur la carte). */
export type SynergyGroupId = 'wood' | 'food' | 'stone' | 'tools' | 'iron' | 'science' | 'gold';

export const PRODUCTION_SYNERGY = {
  /** Bonus additif par voisin du meme groupe (+12 % par lien). */
  bonusPerNeighbor: 0.12,
  /** Plafond du bonus total (+48 %). */
  maxBonus: 0.48,
} as const;

export const SYNERGY_GROUP_LABELS: Record<SynergyGroupId, string> = {
  wood: 'Bois',
  food: 'Nourriture',
  stone: 'Pierre',
  tools: 'Outillage',
  iron: 'Fer',
  science: 'Science',
  gold: 'Or',
};

/** Couleurs des chemins de synergie (lueur + trait central). */
export const SYNERGY_GROUP_COLORS: Record<SynergyGroupId, { glow: number; core: number }> = {
  wood: { glow: 0x3d9e40, core: 0x9ef08a },
  food: { glow: 0xc9a012, core: 0xffe566 },
  stone: { glow: 0x6b8494, core: 0xc8d8e8 },
  tools: { glow: 0xb86a28, core: 0xffb86a },
  iron: { glow: 0x5a6478, core: 0xa8b8d8 },
  science: { glow: 0x6848c8, core: 0xb8a0ff },
  gold: { glow: 0xc89818, core: 0xffe080 },
};
