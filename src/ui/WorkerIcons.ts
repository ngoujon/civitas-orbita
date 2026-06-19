/** Icone SVG procedurale : groupe de travailleurs (zero asset externe). */

const OUTLINE = '#202840';

export function workerIconSVG(size = 20, accent = '#6abe30'): string {
  return (
    `<svg viewBox="0 0 48 48" width="${size}" height="${size}" class="worker-icon-svg" ` +
    `xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
    `<circle cx="24" cy="24" r="21" fill="${accent}" opacity="0.15"/>` +
    `<circle cx="24" cy="24" r="21" fill="none" stroke="${accent}" stroke-width="2" opacity="0.75"/>` +
    person(18, 14, accent, 0.85) +
    person(30, 16, accent, 1) +
    person(24, 20, accent, 0.95) +
    `</svg>`
  );
}

function person(cx: number, headY: number, shirt: string, scale: number): string {
  const s = scale;
  const headR = 4.5 * s;
  const bodyW = 8 * s;
  const bodyH = 9 * s;
  const legH = 6 * s;
  const x = cx - bodyW / 2;
  const bodyY = headY + headR * 2 - 1;
  return (
    `<circle cx="${cx}" cy="${headY + headR}" r="${headR}" fill="#ffe0b0" stroke="${OUTLINE}" stroke-width="1.2"/>` +
    `<rect x="${x}" y="${bodyY}" width="${bodyW}" height="${bodyH}" rx="1" fill="${shirt}" stroke="${OUTLINE}" stroke-width="1.2"/>` +
    `<rect x="${x + 1}" y="${bodyY + bodyH}" width="${bodyW * 0.4}" height="${legH}" fill="#4a3020" stroke="${OUTLINE}" stroke-width="1"/>` +
    `<rect x="${x + bodyW * 0.55}" y="${bodyY + bodyH}" width="${bodyW * 0.4}" height="${legH}" fill="#4a3020" stroke="${OUTLINE}" stroke-width="1"/>`
  );
}
