/**
 * Instance d'un batiment posee sur la carte.
 *
 * Donnee PURE et serialisable (fait partie de GameState). Aucune reference
 * a Pixi ou a une fonction. La definition (couts, production) vit dans config.
 */

import type { BuildingId } from '@/config/buildings';
import type { SectorCoord } from '@/world/Sector';

export interface BuildingInstance {
  /** Identifiant d'instance unique. */
  readonly id: string;
  /** Proprietaire (multijoueur) ; absent en solo. */
  ownerId?: string;
  /** Type de batiment (cle vers la config). */
  readonly def: BuildingId;
  /** Secteur occupe (mutable lors d'un deplacement). */
  sector: SectorCoord;
  /** Niveau d'amelioration (1 = base). */
  level: number;
  /** Travailleurs actuellement affectes. */
  workers: number;
  /**
   * Progression de construction en secondes ecoulees.
   * Quand >= buildTime de la def, le batiment est operationnel.
   */
  buildProgress: number;
  /** Vrai une fois la construction terminee. */
  complete: boolean;
}

export function createBuildingInstance(
  id: string,
  def: BuildingId,
  sector: SectorCoord,
  instant: boolean,
): BuildingInstance {
  return {
    id,
    def,
    sector,
    level: 1,
    workers: 0,
    buildProgress: instant ? Number.POSITIVE_INFINITY : 0,
    complete: instant,
  };
}
