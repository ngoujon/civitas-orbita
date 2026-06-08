/**
 * Bus d'evenements typé (pub/sub).
 *
 * Permet le couplage faible entre systemes : un systeme emet un evenement,
 * d'autres s'y abonnent sans dependance directe.
 *
 * Generique sur une carte d'evenements `TEvents` (cle -> type du payload).
 */

export type EventMap = Record<string, unknown>;
export type Handler<T> = (payload: T) => void;

export class EventBus<TEvents extends EventMap> {
  private readonly handlers = new Map<keyof TEvents, Set<Handler<unknown>>>();

  /** Abonne un handler. Renvoie une fonction de desabonnement. */
  on<K extends keyof TEvents>(event: K, handler: Handler<TEvents[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<unknown>);
    return () => this.off(event, handler);
  }

  /** Abonnement unique : se desabonne apres le premier appel. */
  once<K extends keyof TEvents>(event: K, handler: Handler<TEvents[K]>): () => void {
    const off = this.on(event, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off<K extends keyof TEvents>(event: K, handler: Handler<TEvents[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<unknown>);
  }

  /** Emet un evenement vers tous les abonnes. */
  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    // Copie defensive : un handler peut se desabonner pendant l'iteration.
    for (const handler of [...set]) {
      (handler as Handler<TEvents[K]>)(payload);
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
