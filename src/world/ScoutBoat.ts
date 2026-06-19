/**
 * Etat d un bateau eclaireur (decouverte de la mer).
 */

export type ScoutBoatPhase = 'exploring' | 'returning' | 'docked';

export interface ScoutBoatState {
  id: string;
  portId: string;
  x: number;
  y: number;
  heading: number;
  targetX: number;
  targetY: number;
  /** exploring = vers le brouillard ; returning = retour au port ; docked = au quai. */
  phase: ScoutBoatPhase;
  /** Pause apres avoir atteint une zone inexploree. */
  waitTimer: number;
  /** Compteur pour cibles deterministes. */
  trip: number;
}
