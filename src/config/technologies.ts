/**
 * Arbre de technologies (data-driven).
 *
 * Chaque technologie a un type (kind) :
 *   'batiment' — debloque un ou plusieurs batiments
 *   'sort'     — debloque une competence active (mastery)
 *   'passif'   — bonus permanent de production (passiveBonus)
 */

import type { AgeId } from './ages';
import type { AgeAbilityId } from './abilities';
import type { BuildingId } from './buildings';
import type { ResourceId } from './resources';

export type TechId =
  | 'forestry'
  | 'agriculture'
  | 'shelter'
  | 'stonework'
  | 'storage_tech'
  | 'craftsmanship'
  | 'mining'
  | 'industrialization'
  | 'writing'
  | 'architecture'
  | 'trade_routes'
  | 'military_doctrine'
  | 'harbor'
  | 'academia'
  | 'photovoltaics'
  | 'arcology'
  | 'quantum_minds'
  | 'orbital_logistics'
  | 'mastery_fire'
  | 'mastery_stone'
  | 'mastery_bronze'
  | 'mastery_iron'
  | 'mastery_medieval'
  | 'mastery_renaissance'
  | 'mastery_industrial'
  | 'mastery_modern'
  | 'mastery_future'
  // Passifs
  | 'irrigation'
  | 'geology'
  | 'metallurgy'
  | 'guilds'
  | 'mass_production'
  // Batiments supplementaires
  | 'sawmill_tech'
  | 'banking_tech'
  | 'printing_press';

export type TechBranch = 'economy' | 'society' | 'mastery';
export type TechKind = 'batiment' | 'sort' | 'passif';

export interface TechDef {
  readonly id: TechId;
  readonly name: string;
  readonly description: string;
  readonly branch: TechBranch;
  readonly tier: number;
  readonly scienceCost: number;
  readonly requiredAge: AgeId;
  readonly prerequisites: readonly TechId[];
  readonly unlocks: readonly BuildingId[];
  readonly kind: TechKind;
  /** Bonus multiplicatif permanent sur la production (passif uniquement). */
  readonly passiveBonus?: Partial<Record<ResourceId, number>>;
  /** Competence d ere debloquee par cette recherche. */
  readonly unlocksAbility?: AgeAbilityId;
  /** Deja recherche au demarrage d'une nouvelle partie. */
  readonly starting?: boolean;
}

export const TECH_BRANCH_LABELS: Record<TechBranch, string> = {
  economy: 'Economie',
  society: 'Societe',
  mastery: 'Maitrises d ere',
};

export const TECH_KIND_LABELS: Record<TechKind, string> = {
  batiment: 'Bâtiment',
  sort: 'Sort',
  passif: 'Passif',
};

export const TECH_KIND_COLORS: Record<TechKind, string> = {
  batiment: '#4a90d9',
  sort: '#9b59b6',
  passif: '#27ae60',
};

export const TECH_BRANCH_ORDER: readonly TechBranch[] = ['economy', 'society', 'mastery'];

export const TECHNOLOGIES: Readonly<Record<TechId, TechDef>> = {
  // ── Age du Feu (tier 0) ───────────────────────────────────────────────────
  forestry: {
    id: 'forestry',
    name: 'Exploitation forestiere',
    description: 'Debloque la cabane de bucheron pour recolter du bois.',
    branch: 'economy',
    tier: 0,
    scienceCost: 0,
    requiredAge: 'fire',
    prerequisites: [],
    unlocks: ['lumberjack'],
    kind: 'batiment',
    starting: true,
  },
  agriculture: {
    id: 'agriculture',
    name: 'Agriculture',
    description: 'Debloque la ferme pour produire de la nourriture.',
    branch: 'economy',
    tier: 0,
    scienceCost: 0,
    requiredAge: 'fire',
    prerequisites: [],
    unlocks: ['farm'],
    kind: 'batiment',
    starting: true,
  },
  shelter: {
    id: 'shelter',
    name: 'Abri primitif',
    description: 'Debloque la hutte pour loger vos premiers villageois.',
    branch: 'society',
    tier: 0,
    scienceCost: 0,
    requiredAge: 'fire',
    prerequisites: [],
    unlocks: ['hut'],
    kind: 'batiment',
    starting: true,
  },
  mastery_fire: {
    id: 'mastery_fire',
    name: 'Maitrise : Age du Feu',
    description: 'Debloque la competence Flamme du clan pour l ere actuelle.',
    branch: 'mastery',
    tier: 0,
    scienceCost: 0,
    requiredAge: 'fire',
    prerequisites: [],
    unlocks: [],
    kind: 'sort',
    unlocksAbility: 'fire',
    starting: true,
  },

  // ── Age de Pierre (tier 1) ────────────────────────────────────────────────
  stonework: {
    id: 'stonework',
    name: 'Taille de pierre',
    description: 'Debloque la carriere pour extraire de la pierre.',
    branch: 'economy',
    tier: 1,
    scienceCost: 15,
    requiredAge: 'fire',
    prerequisites: ['forestry'],
    unlocks: ['quarry'],
    kind: 'batiment',
  },
  mastery_stone: {
    id: 'mastery_stone',
    name: 'Maitrise : Age de Pierre',
    description: 'Debloque la competence Corvee des pierres.',
    branch: 'mastery',
    tier: 1,
    scienceCost: 25,
    requiredAge: 'stone',
    prerequisites: ['mastery_fire'],
    unlocks: [],
    kind: 'sort',
    unlocksAbility: 'stone',
  },
  irrigation: {
    id: 'irrigation',
    name: 'Irrigation',
    description: 'Canaux et rigoles doublent le rendement des fermes. +25 % de production de nourriture.',
    branch: 'economy',
    tier: 1,
    scienceCost: 20,
    requiredAge: 'stone',
    prerequisites: ['agriculture'],
    unlocks: [],
    kind: 'passif',
    passiveBonus: { food: 1.25 },
  },
  sawmill_tech: {
    id: 'sawmill_tech',
    name: 'Scierie',
    description: 'Debloque la scierie, atelier de transformation du bois brut en planches.',
    branch: 'economy',
    tier: 1,
    scienceCost: 20,
    requiredAge: 'stone',
    prerequisites: ['forestry'],
    unlocks: ['sawmill'],
    kind: 'batiment',
  },

  // ── Age du Bronze (tier 2) ────────────────────────────────────────────────
  storage_tech: {
    id: 'storage_tech',
    name: 'Stockage organise',
    description: 'Debloque l entrepot pour augmenter vos capacites de stockage.',
    branch: 'economy',
    tier: 2,
    scienceCost: 35,
    requiredAge: 'stone',
    prerequisites: ['stonework'],
    unlocks: ['warehouse'],
    kind: 'batiment',
  },
  craftsmanship: {
    id: 'craftsmanship',
    name: 'Artisanat',
    description: 'Debloque l atelier pour fabriquer des outils.',
    branch: 'economy',
    tier: 2,
    scienceCost: 45,
    requiredAge: 'bronze',
    prerequisites: ['stonework'],
    unlocks: ['workshop'],
    kind: 'batiment',
  },
  writing: {
    id: 'writing',
    name: 'Ecriture',
    description: 'Debloque la bibliotheque pour produire de la science.',
    branch: 'society',
    tier: 1,
    scienceCost: 40,
    requiredAge: 'bronze',
    prerequisites: ['agriculture'],
    unlocks: ['library'],
    kind: 'batiment',
  },
  mastery_bronze: {
    id: 'mastery_bronze',
    name: 'Maitrise : Age du Bronze',
    description: 'Debloque la competence Fournaise ardente.',
    branch: 'mastery',
    tier: 2,
    scienceCost: 50,
    requiredAge: 'bronze',
    prerequisites: ['mastery_stone', 'craftsmanship'],
    unlocks: [],
    kind: 'sort',
    unlocksAbility: 'bronze',
  },
  geology: {
    id: 'geology',
    name: 'Geologie',
    description: 'Connaissance des roches et strates rocheuses. +20 % de production de pierre.',
    branch: 'economy',
    tier: 2,
    scienceCost: 30,
    requiredAge: 'bronze',
    prerequisites: ['stonework'],
    unlocks: [],
    kind: 'passif',
    passiveBonus: { stone: 1.20 },
  },

  // ── Age du Fer (tier 3) ───────────────────────────────────────────────────
  mining: {
    id: 'mining',
    name: 'Extraction miniere',
    description: 'Debloque la mine pour extraire du fer.',
    branch: 'economy',
    tier: 3,
    scienceCost: 80,
    requiredAge: 'iron',
    prerequisites: ['craftsmanship'],
    unlocks: ['mine'],
    kind: 'batiment',
  },
  mastery_iron: {
    id: 'mastery_iron',
    name: 'Maitrise : Age du Fer',
    description: 'Debloque la competence Heurtoir minier.',
    branch: 'mastery',
    tier: 3,
    scienceCost: 90,
    requiredAge: 'iron',
    prerequisites: ['mastery_bronze', 'mining'],
    unlocks: [],
    kind: 'sort',
    unlocksAbility: 'iron',
  },
  metallurgy: {
    id: 'metallurgy',
    name: 'Metallurgie',
    description: 'Maitrise des alliages et des fourneaux. +20 % de production de fer.',
    branch: 'economy',
    tier: 3,
    scienceCost: 85,
    requiredAge: 'iron',
    prerequisites: ['mining'],
    unlocks: [],
    kind: 'passif',
    passiveBonus: { iron: 1.20 },
  },
  military_doctrine: {
    id: 'military_doctrine',
    name: 'Doctrine militaire',
    description: 'Debloque la caserne pour former des soldats.',
    branch: 'society',
    tier: 3,
    scienceCost: 90,
    requiredAge: 'medieval',
    prerequisites: ['craftsmanship'],
    unlocks: ['barracks'],
    kind: 'batiment',
  },
  trade_routes: {
    id: 'trade_routes',
    name: 'Routes commerciales',
    description: 'Debloque le marche pour convertir nourriture en or.',
    branch: 'society',
    tier: 2,
    scienceCost: 70,
    requiredAge: 'medieval',
    prerequisites: ['agriculture'],
    unlocks: ['market'],
    kind: 'batiment',
  },
  architecture: {
    id: 'architecture',
    name: 'Architecture',
    description: 'Debloque la maison pour un logement dense.',
    branch: 'society',
    tier: 2,
    scienceCost: 60,
    requiredAge: 'medieval',
    prerequisites: ['shelter', 'stonework'],
    unlocks: ['house'],
    kind: 'batiment',
  },
  harbor: {
    id: 'harbor',
    name: 'Port maritime',
    description: 'Debloque le port sur la lisiere ; reserve un acces permanent a la mer.',
    branch: 'society',
    tier: 3,
    scienceCost: 85,
    requiredAge: 'medieval',
    prerequisites: ['trade_routes', 'stonework'],
    unlocks: ['port'],
    kind: 'batiment',
  },
  banking_tech: {
    id: 'banking_tech',
    name: 'Banque',
    description: 'Debloque la banque, institution qui genere de l or passivement.',
    branch: 'society',
    tier: 3,
    scienceCost: 90,
    requiredAge: 'medieval',
    prerequisites: ['trade_routes', 'architecture'],
    unlocks: ['bank'],
    kind: 'batiment',
  },
  mastery_medieval: {
    id: 'mastery_medieval',
    name: 'Maitrise : Moyen Age',
    description: 'Debloque la competence Mobilisation generale.',
    branch: 'mastery',
    tier: 4,
    scienceCost: 120,
    requiredAge: 'medieval',
    prerequisites: ['mastery_iron', 'trade_routes'],
    unlocks: [],
    kind: 'sort',
    unlocksAbility: 'medieval',
  },
  guilds: {
    id: 'guilds',
    name: 'Corporations',
    description: 'Guildes de marchands et artisans. +25 % de production d or.',
    branch: 'economy',
    tier: 3,
    scienceCost: 100,
    requiredAge: 'medieval',
    prerequisites: ['trade_routes'],
    unlocks: [],
    kind: 'passif',
    passiveBonus: { gold: 1.25 },
  },

  // ── Renaissance (tier 4-5) ────────────────────────────────────────────────
  academia: {
    id: 'academia',
    name: 'Academie',
    description: 'Debloque l universite pour une science de pointe.',
    branch: 'society',
    tier: 4,
    scienceCost: 150,
    requiredAge: 'renaissance',
    prerequisites: ['writing', 'trade_routes'],
    unlocks: ['university'],
    kind: 'batiment',
  },
  printing_press: {
    id: 'printing_press',
    name: 'Imprimerie',
    description: 'Debloque la maison d edition ; democratise le savoir et booste la science.',
    branch: 'society',
    tier: 4,
    scienceCost: 140,
    requiredAge: 'renaissance',
    prerequisites: ['writing', 'academia'],
    unlocks: ['printing_house'],
    kind: 'batiment',
  },
  mastery_renaissance: {
    id: 'mastery_renaissance',
    name: 'Maitrise : Renaissance',
    description: 'Debloque la competence Eclair de genie.',
    branch: 'mastery',
    tier: 5,
    scienceCost: 160,
    requiredAge: 'renaissance',
    prerequisites: ['mastery_medieval', 'writing'],
    unlocks: [],
    kind: 'sort',
    unlocksAbility: 'renaissance',
  },

  // ── Ere Industrielle (tier 5-6) ───────────────────────────────────────────
  industrialization: {
    id: 'industrialization',
    name: 'Industrialisation',
    description: 'Debloque l usine pour la production de masse.',
    branch: 'economy',
    tier: 4,
    scienceCost: 200,
    requiredAge: 'industrial',
    prerequisites: ['mining'],
    unlocks: ['factory'],
    kind: 'batiment',
  },
  mastery_industrial: {
    id: 'mastery_industrial',
    name: 'Maitrise : Revolution Industrielle',
    description: 'Debloque la competence Chaine acceleree.',
    branch: 'mastery',
    tier: 6,
    scienceCost: 220,
    requiredAge: 'industrial',
    prerequisites: ['mastery_renaissance', 'industrialization'],
    unlocks: [],
    kind: 'sort',
    unlocksAbility: 'industrial',
  },
  mass_production: {
    id: 'mass_production',
    name: 'Production de masse',
    description: 'Standardisation et chaines d assemblage. +30 % de production d outils.',
    branch: 'economy',
    tier: 5,
    scienceCost: 210,
    requiredAge: 'industrial',
    prerequisites: ['industrialization'],
    unlocks: [],
    kind: 'passif',
    passiveBonus: { tools: 1.30 },
  },

  // ── Ere Futuriste (tier 7-8) ──────────────────────────────────────────────
  photovoltaics: {
    id: 'photovoltaics',
    name: 'Photovoltaique',
    description: 'Debloque la ferme solaire pour l ere futuriste.',
    branch: 'economy',
    tier: 5,
    scienceCost: 280,
    requiredAge: 'future',
    prerequisites: ['industrialization'],
    unlocks: ['solar_array'],
    kind: 'batiment',
  },
  arcology: {
    id: 'arcology',
    name: 'Arcologie',
    description: 'Debloque les domes d habitation futuristes.',
    branch: 'society',
    tier: 5,
    scienceCost: 260,
    requiredAge: 'future',
    prerequisites: ['academia'],
    unlocks: ['habitat_dome'],
    kind: 'batiment',
  },
  mastery_modern: {
    id: 'mastery_modern',
    name: 'Maitrise : Ere Moderne',
    description: 'Debloque la competence Surproduction.',
    branch: 'mastery',
    tier: 7,
    scienceCost: 280,
    requiredAge: 'modern',
    prerequisites: ['mastery_industrial'],
    unlocks: [],
    kind: 'sort',
    unlocksAbility: 'modern',
  },
  quantum_minds: {
    id: 'quantum_minds',
    name: 'Intelligence quantique',
    description: 'Debloque le labo quantique.',
    branch: 'society',
    tier: 5,
    scienceCost: 320,
    requiredAge: 'future',
    prerequisites: ['photovoltaics', 'writing'],
    unlocks: ['quantum_lab'],
    kind: 'batiment',
  },
  orbital_logistics: {
    id: 'orbital_logistics',
    name: 'Logistique orbitale',
    description: 'Debloque le silo orbital de stockage.',
    branch: 'economy',
    tier: 5,
    scienceCost: 300,
    requiredAge: 'future',
    prerequisites: ['arcology', 'photovoltaics'],
    unlocks: ['orbital_depot'],
    kind: 'batiment',
  },
  mastery_future: {
    id: 'mastery_future',
    name: 'Maitrise : Ere Futuriste',
    description: 'Debloque la competence Surcharge quantique.',
    branch: 'mastery',
    tier: 8,
    scienceCost: 350,
    requiredAge: 'future',
    prerequisites: ['mastery_modern', 'photovoltaics'],
    unlocks: [],
    kind: 'sort',
    unlocksAbility: 'future',
  },
};

export const TECH_LIST: readonly TechDef[] = Object.values(TECHNOLOGIES);

/** Technologies deja maitrisees au demarrage. */
export function startingTechs(): Record<TechId, true> {
  const out = {} as Record<TechId, true>;
  for (const def of TECH_LIST) {
    if (def.starting) out[def.id] = true;
  }
  return out;
}

/** Technologie requise pour construire un batiment (null si aucune). */
export function techForBuilding(buildingId: BuildingId): TechId | null {
  for (const def of TECH_LIST) {
    if (def.unlocks.includes(buildingId)) return def.id;
  }
  return null;
}

/** Technologie qui debloque une competence d ere (null si aucune). */
export function techForAbility(abilityId: AgeAbilityId): TechId | null {
  for (const def of TECH_LIST) {
    if (def.unlocksAbility === abilityId) return def.id;
  }
  return null;
}

/** Technologies d'une branche triees par tier puis nom. */
export function techsInBranch(branch: TechBranch): TechDef[] {
  return TECH_LIST.filter((t) => t.branch === branch).sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
}

/** Synchronise les competences debloquees depuis les techs maitrisees. */
export function syncUnlockedAbilitiesFromTechs(state: {
  researchedTechs: Partial<Record<TechId, true>>;
  unlockedAbilities: Partial<Record<AgeAbilityId, true>>;
}): void {
  for (const def of TECH_LIST) {
    if (def.unlocksAbility && state.researchedTechs[def.id]) {
      state.unlockedAbilities[def.unlocksAbility] = true;
    }
  }
}

/**
 * Calcule les multiplicateurs passifs cumulatifs issus des techs recherchees.
 * Retourne un objet { resource: multiplier } (1.0 si aucun bonus).
 */
export function computeTechBonuses(
  researchedTechs: Partial<Record<TechId, true>>,
): Partial<Record<ResourceId, number>> {
  const out: Partial<Record<ResourceId, number>> = {};
  for (const def of TECH_LIST) {
    if (!researchedTechs[def.id] || !def.passiveBonus) continue;
    for (const [res, mult] of Object.entries(def.passiveBonus) as [ResourceId, number][]) {
      out[res] = (out[res] ?? 1) * mult;
    }
  }
  return out;
}
