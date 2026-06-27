/**
 * Disposition de l arbre de technologies (graphe prerequis -> noeud).
 * Tier 0 en bas, tiers superieurs au-dessus (style RPG).
 */

import { TECH_LIST, type TechId } from '@/config/technologies';

export interface TechTreeEdge {
  readonly from: TechId;
  readonly to: TechId;
}

export interface TechTreeLayout {
  readonly positions: ReadonlyMap<TechId, { x: number; y: number }>;
  readonly edges: readonly TechTreeEdge[];
  readonly width: number;
  readonly height: number;
}

const ROW_HEIGHT = 112;
const COL_WIDTH = 108;
const NODE_RADIUS = 36;
const PADDING_X = 56;
const PADDING_Y = 40;

/** Abreviation affichee dans le cercle du noeud. */
export const TECH_NODE_GLYPH: Readonly<Record<TechId, string>> = {
  forestry: 'BF',
  agriculture: 'AG',
  shelter: 'AB',
  stonework: 'PI',
  storage_tech: 'ST',
  craftsmanship: 'AR',
  mining: 'MI',
  industrialization: 'IN',
  writing: 'EC',
  architecture: 'MA',
  trade_routes: 'CO',
  military_doctrine: 'ML',
  harbor: 'PT',
  academia: 'UN',
  photovoltaics: 'PV',
  arcology: 'AO',
  quantum_minds: 'QN',
  orbital_logistics: 'OR',
  mastery_fire: 'MF',
  mastery_stone: 'MS',
  mastery_bronze: 'MB',
  mastery_iron: 'Fe',
  mastery_medieval: 'MM',
  mastery_renaissance: 'MR',
  mastery_industrial: 'Id',
  mastery_modern: 'Mo',
  mastery_future: 'Fu',
  // Passifs
  irrigation: 'IR',
  geology: 'GE',
  metallurgy: 'ME',
  guilds: 'CP',
  mass_production: 'MP',
  // Batiments supplementaires
  sawmill_tech: 'SC',
  banking_tech: 'BQ',
  printing_press: 'IP',
};

let cachedLayout: TechTreeLayout | null = null;

/** Placement manuel pour un arbre lisible (colonne x tier). */
const TECH_GRID: Readonly<Record<TechId, { col: number; tier: number }>> = {
  forestry: { col: 0, tier: 0 },
  agriculture: { col: 1, tier: 0 },
  shelter: { col: 3, tier: 0 },
  mastery_fire: { col: 4, tier: 0 },
  stonework: { col: 0, tier: 1 },
  writing: { col: 2, tier: 1 },
  mastery_stone: { col: 4, tier: 1 },
  storage_tech: { col: 0, tier: 2 },
  craftsmanship: { col: 1, tier: 2 },
  trade_routes: { col: 2, tier: 2 },
  architecture: { col: 3, tier: 2 },
  mastery_bronze: { col: 4, tier: 2 },
  mining: { col: 1, tier: 3 },
  military_doctrine: { col: 2, tier: 3 },
  harbor: { col: 3, tier: 3 },
  mastery_iron: { col: 4, tier: 3 },
  industrialization: { col: 1, tier: 4 },
  academia: { col: 2, tier: 4 },
  mastery_medieval: { col: 4, tier: 4 },
  photovoltaics: { col: 0, tier: 5 },
  arcology: { col: 1, tier: 5 },
  quantum_minds: { col: 2, tier: 5 },
  orbital_logistics: { col: 3, tier: 5 },
  mastery_renaissance: { col: 4, tier: 5 },
  mastery_industrial: { col: 4, tier: 6 },
  mastery_modern: { col: 4, tier: 7 },
  mastery_future: { col: 4, tier: 8 },
  // Passifs (col 5) et bâtiments supplémentaires (col 6)
  irrigation: { col: 5, tier: 0 },
  sawmill_tech: { col: 5, tier: 1 },
  geology: { col: 5, tier: 2 },
  metallurgy: { col: 5, tier: 3 },
  mass_production: { col: 5, tier: 5 },
  banking_tech: { col: 6, tier: 2 },
  guilds: { col: 6, tier: 3 },
  printing_press: { col: 6, tier: 4 },
};

export function getTechTreeLayout(): TechTreeLayout {
  if (cachedLayout) return cachedLayout;
  cachedLayout = buildLayout();
  return cachedLayout;
}

function buildLayout(): TechTreeLayout {
  const maxTier = Math.max(...TECH_LIST.map((t) => TECH_GRID[t.id]?.tier ?? t.tier));
  let maxCol = 0;
  for (const def of TECH_LIST) {
    maxCol = Math.max(maxCol, TECH_GRID[def.id]?.col ?? 0);
  }

  const gridWidth = (maxCol + 1) * COL_WIDTH;
  const positions = new Map<TechId, { x: number; y: number }>();

  for (const def of TECH_LIST) {
    const grid = TECH_GRID[def.id] ?? { col: 0, tier: def.tier };
    positions.set(def.id, {
      x: PADDING_X + grid.col * COL_WIDTH + COL_WIDTH / 2,
      y: PADDING_Y + NODE_RADIUS + (maxTier - grid.tier) * ROW_HEIGHT,
    });
  }

  const edges: TechTreeEdge[] = [];
  for (const def of TECH_LIST) {
    for (const from of def.prerequisites) {
      edges.push({ from, to: def.id });
    }
  }

  return {
    positions,
    edges,
    width: PADDING_X * 2 + gridWidth,
    height: PADDING_Y * 2 + NODE_RADIUS * 2 + maxTier * ROW_HEIGHT + 24,
  };
}

/** Courbe entre deux noeuds (parent en bas, enfant au-dessus). */
export function edgePath(
  from: { x: number; y: number },
  to: { x: number; y: number },
): string {
  const dy = to.y - from.y;
  const c1y = from.y + dy * 0.45;
  const c2y = to.y - dy * 0.45;
  return `M ${from.x} ${from.y} C ${from.x} ${c1y}, ${to.x} ${c2y}, ${to.x} ${to.y}`;
}

export { NODE_RADIUS };
