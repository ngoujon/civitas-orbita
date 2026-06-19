/** Icones SVG procedurales pour les boutons systeme (zero asset externe). */

const OUTLINE = '#202840';
const ACCENT = '#ffe24a';
const ACCENT_2 = '#6abe30';
const MUTED = '#9badb7';

function svgWrap(size: number, cls: string, body: string): string {
  return (
    `<svg viewBox="0 0 48 48" width="${size}" height="${size}" class="${cls}" ` +
    `xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`
  );
}

/** Arbre de technologies / recherche. */
export function techTreeIconSVG(size = 22): string {
  return svgWrap(
    size,
    'hud-sys-icon',
    `<rect x="4" y="4" width="40" height="40" rx="8" fill="${ACCENT}" opacity="0.12"/>` +
      `<circle cx="24" cy="34" r="5" fill="${ACCENT_2}" stroke="${OUTLINE}" stroke-width="1.5"/>` +
      `<circle cx="14" cy="22" r="4.5" fill="#b8a0ff" stroke="${OUTLINE}" stroke-width="1.5"/>` +
      `<circle cx="34" cy="22" r="4.5" fill="#b8a0ff" stroke="${OUTLINE}" stroke-width="1.5"/>` +
      `<circle cx="24" cy="12" r="4.5" fill="${ACCENT}" stroke="${OUTLINE}" stroke-width="1.5"/>` +
      `<line x1="24" y1="16" x2="24" y2="29" stroke="${OUTLINE}" stroke-width="2"/>` +
      `<line x1="18" y1="24" x2="24" y2="30" stroke="${OUTLINE}" stroke-width="2"/>` +
      `<line x1="30" y1="24" x2="24" y2="30" stroke="${OUTLINE}" stroke-width="2"/>` +
      `<line x1="24" y1="12" x2="24" y2="16" stroke="${OUTLINE}" stroke-width="2"/>`,
  );
}

/** Menu / accueil. */
export function menuIconSVG(size = 22): string {
  return svgWrap(
    size,
    'hud-sys-icon',
    `<rect x="8" y="10" width="32" height="28" rx="4" fill="#c77b3b" stroke="${OUTLINE}" stroke-width="2"/>` +
      `<rect x="14" y="18" width="20" height="3" rx="1" fill="${ACCENT}"/>` +
      `<rect x="14" y="25" width="20" height="3" rx="1" fill="${ACCENT}"/>` +
      `<rect x="14" y="32" width="14" height="3" rx="1" fill="${ACCENT}"/>`,
  );
}

/** Recentrer la camera sur le village. */
export function recenterIconSVG(size = 22): string {
  return svgWrap(
    size,
    'hud-sys-icon',
    `<circle cx="24" cy="24" r="14" fill="none" stroke="${MUTED}" stroke-width="2" opacity="0.7"/>` +
      `<circle cx="24" cy="24" r="4" fill="${ACCENT}" stroke="${OUTLINE}" stroke-width="1.5"/>` +
      `<line x1="24" y1="6" x2="24" y2="14" stroke="${ACCENT}" stroke-width="2.5" stroke-linecap="round"/>` +
      `<line x1="24" y1="34" x2="24" y2="42" stroke="${ACCENT}" stroke-width="2.5" stroke-linecap="round"/>` +
      `<line x1="6" y1="24" x2="14" y2="24" stroke="${ACCENT}" stroke-width="2.5" stroke-linecap="round"/>` +
      `<line x1="34" y1="24" x2="42" y2="24" stroke="${ACCENT}" stroke-width="2.5" stroke-linecap="round"/>`,
  );
}

/** Son active. */
export function soundOnIconSVG(size = 22): string {
  return svgWrap(
    size,
    'hud-sys-icon',
    `<rect x="12" y="16" width="8" height="16" rx="1" fill="${ACCENT_2}" stroke="${OUTLINE}" stroke-width="1.5"/>` +
      `<polygon points="20,18 28,12 28,36 20,30" fill="${ACCENT_2}" stroke="${OUTLINE}" stroke-width="1.5"/>` +
      `<path d="M32 18 Q38 24 32 30" fill="none" stroke="${ACCENT}" stroke-width="2.5" stroke-linecap="round"/>` +
      `<path d="M36 14 Q44 24 36 34" fill="none" stroke="${ACCENT}" stroke-width="2.5" stroke-linecap="round" opacity="0.85"/>`,
  );
}

/** Reglages (engrenage). */
export function settingsIconSVG(size = 22): string {
  return svgWrap(
    size,
    'hud-sys-icon',
    `<circle cx="24" cy="24" r="10" fill="none" stroke="${MUTED}" stroke-width="2.5"/>` +
      `<circle cx="24" cy="24" r="4" fill="${ACCENT}" stroke="${OUTLINE}" stroke-width="1.5"/>` +
      `<rect x="22" y="6" width="4" height="8" rx="1" fill="${MUTED}"/>` +
      `<rect x="22" y="34" width="4" height="8" rx="1" fill="${MUTED}"/>` +
      `<rect x="6" y="22" width="8" height="4" rx="1" fill="${MUTED}"/>` +
      `<rect x="34" y="22" width="8" height="4" rx="1" fill="${MUTED}"/>`,
  );
}

/** Son coupe. */
export function soundOffIconSVG(size = 22): string {
  return svgWrap(
    size,
    'hud-sys-icon',
    `<rect x="12" y="16" width="8" height="16" rx="1" fill="${MUTED}" stroke="${OUTLINE}" stroke-width="1.5"/>` +
      `<polygon points="20,18 28,12 28,36 20,30" fill="${MUTED}" stroke="${OUTLINE}" stroke-width="1.5"/>` +
      `<line x1="30" y1="16" x2="40" y2="32" stroke="#d84a3b" stroke-width="3" stroke-linecap="round"/>` +
      `<line x1="40" y1="16" x2="30" y2="32" stroke="#d84a3b" stroke-width="3" stroke-linecap="round"/>`,
  );
}
