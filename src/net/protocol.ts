/**
 * Protocole WebSocket multijoueur (partage client / serveur).
 */

import type { GameCommand } from '@/game/commands';

export type WsClientMessage =
  | { type: 'join'; worldId: string; lastTick?: number }
  | { type: 'command'; seq: number; payload: GameCommand };

export type WsServerMessage =
  | { type: 'snapshot'; worldId: string; tick: number; stateJson: string; playerId: string }
  | { type: 'tick'; worldId: string; tick: number }
  | { type: 'command_applied'; seq: number; playerId: string; tick: number }
  | { type: 'reject'; seq: number; reason: string }
  | { type: 'player_joined'; playerId: string; email: string }
  | { type: 'player_left'; playerId: string };
