/**
 * Emblemes SVG proceduraux partages entre le site web et le jeu.
 */

import type { EmblemShape } from '@/config/civilizations';

export function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export function emblemSVG(shape: EmblemShape, color: number): string {
  const c = colorToCss(color);
  const shapes: Record<EmblemShape, string> = {
    flame:
      '<path d="M32 10 C40 22 48 26 44 40 C42 50 34 54 32 54 C30 54 22 50 20 40 C16 28 26 26 32 10 Z" fill="#fff"/>' +
      '<path d="M32 26 C36 32 38 36 36 42 C35 47 33 48 32 48 C31 48 28 46 27 42 C25 36 30 33 32 26 Z" fill="' +
      c +
      '"/>',
    leaf:
      '<path d="M16 48 C20 20 44 16 50 14 C48 40 28 48 16 48 Z" fill="#fff"/>' +
      '<path d="M18 46 C30 36 42 24 48 16" stroke="' +
      c +
      '" stroke-width="3" fill="none"/>',
    hammer:
      '<rect x="29" y="26" width="6" height="26" rx="2" fill="#fff"/>' +
      '<rect x="18" y="14" width="28" height="14" rx="3" fill="#fff"/>' +
      '<rect x="22" y="18" width="20" height="6" rx="2" fill="' +
      c +
      '"/>',
    book:
      '<rect x="14" y="16" width="36" height="30" rx="3" fill="#fff"/>' +
      '<rect x="30" y="16" width="4" height="30" fill="' +
      c +
      '"/>' +
      '<line x1="20" y1="24" x2="28" y2="24" stroke="' +
      c +
      '" stroke-width="2"/>' +
      '<line x1="36" y1="24" x2="44" y2="24" stroke="' +
      c +
      '" stroke-width="2"/>',
    wheat:
      '<rect x="30" y="20" width="4" height="32" fill="#fff"/>' +
      '<path d="M32 18 C26 22 26 28 32 30 C38 28 38 22 32 18 Z" fill="#fff"/>' +
      '<path d="M32 28 C24 30 22 36 28 40 L32 36 Z" fill="#fff"/>' +
      '<path d="M32 28 C40 30 42 36 36 40 L32 36 Z" fill="#fff"/>',
    coin:
      '<circle cx="32" cy="32" r="18" fill="#fff"/>' +
      '<circle cx="32" cy="32" r="11" fill="none" stroke="' +
      c +
      '" stroke-width="3"/>' +
      '<text x="32" y="38" font-size="14" font-weight="bold" text-anchor="middle" fill="' +
      c +
      '">$</text>',
  };
  return (
    `<svg viewBox="0 0 64 64" width="64" height="64" xmlns="http://www.w3.org/2000/svg">` +
    `<circle cx="32" cy="32" r="30" fill="${c}" opacity="0.9"/>` +
    `<circle cx="32" cy="32" r="30" fill="none" stroke="#00000033" stroke-width="2"/>` +
    shapes[shape] +
    `</svg>`
  );
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
