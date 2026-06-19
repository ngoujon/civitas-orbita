/**
 * Formatage des quantites de ressources (precision centieme max).
 */

/** Arrondit a 2 decimales (centieme). */
export function roundToCent(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Affiche une quantite avec au plus 2 decimales. */
export function formatResourceAmount(amount: number): string {
  const r = roundToCent(amount);
  if (Math.abs(r - Math.round(r)) < 1e-9) return String(Math.round(r));
  return r.toFixed(2);
}
