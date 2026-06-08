/**
 * Systeme de sauvegarde JSON versionne.
 *
 * Enveloppe { version, savedAt, state } stockee en localStorage.
 * Prend en charge les migrations entre versions de schema pour que les
 * anciennes sauvegardes restent chargeables apres une mise a jour.
 *
 * Generique sur le type d'etat `TState` (le GameState pur et serialisable).
 */

export interface SaveEnvelope<TState> {
  version: number;
  savedAt: number;
  state: TState;
}

/** Migration : transforme un etat brut de version N vers N+1. */
export type Migration = (rawState: unknown) => unknown;

export interface SaveSystemOptions {
  /** Cle de stockage localStorage. */
  storageKey: string;
  /** Version courante du schema. */
  currentVersion: number;
  /**
   * Migrations indexees par version SOURCE.
   * migrations[1] transforme une sauvegarde v1 en v2, etc.
   */
  migrations?: Record<number, Migration>;
}

export class SaveSystem<TState> {
  constructor(private readonly opts: SaveSystemOptions) {}

  get storageKey(): string {
    return this.opts.storageKey;
  }

  hasSave(): boolean {
    return localStorage.getItem(this.opts.storageKey) !== null;
  }

  /** Serialise et persiste l'etat. */
  save(state: TState): void {
    const envelope: SaveEnvelope<TState> = {
      version: this.opts.currentVersion,
      savedAt: Date.now(),
      state,
    };
    localStorage.setItem(this.opts.storageKey, JSON.stringify(envelope));
  }

  /** Exporte la sauvegarde sous forme de chaine JSON (telechargement, partage). */
  export(state: TState): string {
    const envelope: SaveEnvelope<TState> = {
      version: this.opts.currentVersion,
      savedAt: Date.now(),
      state,
    };
    return JSON.stringify(envelope, null, 2);
  }

  /** Charge et migre l'etat depuis le stockage. Null si absent ou corrompu. */
  load(): TState | null {
    const raw = localStorage.getItem(this.opts.storageKey);
    if (raw === null) return null;
    try {
      return this.parse(raw);
    } catch (err) {
      console.error('[SaveSystem] Echec du chargement :', err);
      return null;
    }
  }

  /** Parse + migre une chaine JSON (import manuel ou localStorage). */
  parse(raw: string): TState {
    const parsed = JSON.parse(raw) as Partial<SaveEnvelope<unknown>>;
    if (typeof parsed.version !== 'number') {
      throw new Error('Sauvegarde invalide : version manquante.');
    }

    let version = parsed.version;
    let state = parsed.state;
    const migrations = this.opts.migrations ?? {};

    while (version < this.opts.currentVersion) {
      const migrate = migrations[version];
      if (!migrate) {
        throw new Error(`Aucune migration de la version ${version} vers ${version + 1}.`);
      }
      state = migrate(state);
      version++;
    }

    if (version !== this.opts.currentVersion) {
      throw new Error(
        `Version de sauvegarde ${version} incompatible avec ${this.opts.currentVersion}.`,
      );
    }

    return state as TState;
  }

  clear(): void {
    localStorage.removeItem(this.opts.storageKey);
  }
}
