/** Types de commandes (miroir client pour le serveur). */

export type GameCommand =
  | { type: 'enqueue_build'; building: string }
  | { type: 'build'; building: string; sector: { ring: number; index: number } }
  | { type: 'demolish'; buildingId: string }
  | { type: string; [key: string]: unknown };

export type WsClientMessage =
  | { type: 'join'; worldId: string; lastTick?: number }
  | { type: 'command'; seq: number; payload: GameCommand };
