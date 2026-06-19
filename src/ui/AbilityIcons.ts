/**
 * Icones SVG procedurales des competences actives par ere (zero asset externe).
 */

import type { AgeAbilityId } from '@/config/abilities';
import { abilityThemeColor } from '@/config/abilities';
import { colorToCss } from '@/web/helpers';

type IconDrawer = (accent: string) => string;

const OUTLINE = '#202840';

/** SVG complet de l'icone de competence d ere (48x48). */
export function ageAbilityIconSVG(abilityId: AgeAbilityId, size = 44): string {
  const accent = colorToCss(abilityThemeColor(abilityId));
  const draw = AGE_ABILITY_ICONS[abilityId] ?? drawBoost;
  return (
    `<svg viewBox="0 0 48 48" width="${size}" height="${size}" class="ability-icon-svg" ` +
    `xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
    `<circle cx="24" cy="24" r="21" fill="${accent}" opacity="0.18"/>` +
    `<circle cx="24" cy="24" r="21" fill="none" stroke="${accent}" stroke-width="2.5" opacity="0.85"/>` +
    draw(accent) +
    `</svg>`
  );
}

function drawBoost(accent: string): string {
  return (
    `<path d="M24 10 L30 22 L27 22 L27 34 L21 34 L21 22 L18 22 Z" fill="${accent}" stroke="${OUTLINE}" stroke-width="1.5"/>`
  );
}

function drawStoneGrant(accent: string): string {
  return (
    `<rect x="14" y="28" width="10" height="8" rx="2" fill="#9badb7" stroke="${OUTLINE}" stroke-width="1.5"/>` +
    `<rect x="24" y="24" width="10" height="12" rx="2" fill="${accent}" stroke="${OUTLINE}" stroke-width="1.5"/>`
  );
}

function drawFurnace(accent: string): string {
  return (
    `<rect x="16" y="20" width="16" height="18" rx="2" fill="#5a3820" stroke="${OUTLINE}" stroke-width="1.5"/>` +
    `<path d="M20 20 L24 12 L28 20 Z" fill="${accent}" stroke="${OUTLINE}" stroke-width="1.5"/>`
  );
}

function drawPickaxe(accent: string): string {
  return (
    `<rect x="22" y="14" width="4" height="20" fill="#8a5224" stroke="${OUTLINE}" stroke-width="1.5"/>` +
    `<path d="M14 18 L34 14 L32 22 L16 24 Z" fill="${accent}" stroke="${OUTLINE}" stroke-width="1.5"/>`
  );
}

function drawMobilize(accent: string): string {
  return (
    `<circle cx="18" cy="16" r="5" fill="#ffe0b0" stroke="${OUTLINE}" stroke-width="1.5"/>` +
    `<circle cx="30" cy="16" r="5" fill="#ffe0b0" stroke="${OUTLINE}" stroke-width="1.5"/>` +
    `<rect x="14" y="24" width="20" height="10" rx="2" fill="${accent}" stroke="${OUTLINE}" stroke-width="1.5"/>`
  );
}

function drawScience(accent: string): string {
  return (
    `<path d="M24 8 C18 8 14 14 14 20 C14 24 16 27 18 29 L18 34 L30 34 L30 29 C32 27 34 24 34 20 C34 14 30 8 24 8 Z" ` +
    `fill="${accent}" stroke="${OUTLINE}" stroke-width="1.5"/>`
  );
}

function drawBuildRush(accent: string): string {
  return (
    `<rect x="12" y="14" width="20" height="8" rx="2" fill="${accent}" stroke="${OUTLINE}" stroke-width="1.5"/>` +
    `<rect x="20" y="18" width="5" height="18" rx="1" fill="#8a5224" stroke="${OUTLINE}" stroke-width="1.5"/>`
  );
}

function drawSurge(accent: string): string {
  return (
    `<path d="M12 32 L20 20 L28 28 L36 14" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="36" cy="14" r="3" fill="#ffe24a" stroke="${OUTLINE}" stroke-width="1.2"/>`
  );
}

function drawQuantum(accent: string): string {
  return (
    `<circle cx="24" cy="24" r="10" fill="none" stroke="${accent}" stroke-width="2.5"/>` +
    `<circle cx="24" cy="24" r="3" fill="${accent}"/>` +
    `<ellipse cx="24" cy="24" rx="14" ry="5" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.8"/>`
  );
}

const AGE_ABILITY_ICONS: Record<AgeAbilityId, IconDrawer> = {
  fire: drawBoost,
  stone: drawStoneGrant,
  bronze: drawFurnace,
  iron: drawPickaxe,
  medieval: drawMobilize,
  renaissance: drawScience,
  industrial: drawBuildRush,
  modern: drawSurge,
  future: drawQuantum,
};
