/**
 * Salle de monde multijoueur en memoire (simulation autoritaire simplifiee).
 */

import type { GameCommand } from './protocol.js';
import { verifyToken } from '../auth.js';

export interface WorldMember {
  userId: number;
  email: string;
  ws: import('ws').WebSocket;
  playerId: string;
}

export interface WorldRoomData {
  worldId: string;
  tick: number;
  /** JSON serialise de WorldState ou GameState solo. */
  stateJson: string;
  members: Map<number, WorldMember>;
  tickTimer: ReturnType<typeof setInterval> | null;
}

const rooms = new Map<string, WorldRoomData>();

export function getOrCreateRoom(worldId: string, initialStateJson: string): WorldRoomData {
  let room = rooms.get(worldId);
  if (!room) {
    room = {
      worldId,
      tick: 0,
      stateJson: initialStateJson,
      members: new Map(),
      tickTimer: null,
    };
    room.tickTimer = setInterval(() => {
      room!.tick++;
      broadcast(room!, { type: 'tick', worldId, tick: room!.tick });
    }, 100);
    rooms.set(worldId, room);
  }
  return room;
}

export function joinRoom(
  worldId: string,
  token: string,
  ws: import('ws').WebSocket,
): { ok: true; room: WorldRoomData; member: WorldMember } | { ok: false; reason: string } {
  const payload = verifyToken(token);
  if (!payload) return { ok: false, reason: 'Session invalide.' };

  const room = rooms.get(worldId);
  if (!room) return { ok: false, reason: 'Monde introuvable.' };

  const playerId = String(payload.sub);
  const member: WorldMember = {
    userId: payload.sub,
    email: payload.email,
    ws,
    playerId,
  };
  room.members.set(payload.sub, member);

  ws.send(
    JSON.stringify({
      type: 'snapshot',
      worldId,
      tick: room.tick,
      stateJson: room.stateJson,
      playerId,
    }),
  );

  broadcast(room, { type: 'player_joined', playerId, email: payload.email }, payload.sub);
  return { ok: true, room, member };
}

export function leaveRoom(userId: number, worldId: string): void {
  const room = rooms.get(worldId);
  if (!room) return;
  const member = room.members.get(userId);
  if (member) {
    room.members.delete(userId);
    broadcast(room, { type: 'player_left', playerId: member.playerId });
  }
  if (room.members.size === 0) {
    if (room.tickTimer) clearInterval(room.tickTimer);
    rooms.delete(worldId);
  }
}

export function applyCommand(
  worldId: string,
  userId: number,
  seq: number,
  cmd: GameCommand,
): { ok: boolean; reason?: string } {
  const room = rooms.get(worldId);
  if (!room) return { ok: false, reason: 'Monde introuvable.' };

  try {
    const parsed = JSON.parse(room.stateJson) as { state?: Record<string, unknown> };
    const state = (parsed.state ?? parsed) as Record<string, unknown>;

    switch (cmd.type) {
      case 'enqueue_build': {
        const queue = (state.constructionQueue as string[]) ?? [];
        if (queue.length >= 5) return { ok: false, reason: 'queue_full' };
        queue.push(String(cmd.building));
        state.constructionQueue = queue;
        parsed.state = state;
        break;
      }
      default:
        return { ok: false, reason: `commande_non_supportee:${cmd.type}` };
    }

    room.stateJson = JSON.stringify(parsed.state ? parsed : { version: 1, savedAt: new Date().toISOString(), state });
    const member = room.members.get(userId);
    broadcast(room, {
      type: 'command_applied',
      seq,
      playerId: member?.playerId ?? String(userId),
      tick: room.tick,
    });
    broadcast(room, {
      type: 'snapshot',
      worldId,
      tick: room.tick,
      stateJson: room.stateJson,
      playerId: member?.playerId ?? String(userId),
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'etat_invalide' };
  }
}

function broadcast(room: WorldRoomData, msg: Record<string, unknown>, exceptUserId?: number): void {
  const data = JSON.stringify(msg);
  for (const [uid, member] of room.members) {
    if (uid === exceptUserId) continue;
    if (member.ws.readyState === 1) member.ws.send(data);
  }
}

export function setRoomState(worldId: string, stateJson: string): void {
  const room = rooms.get(worldId);
  if (room) room.stateJson = stateJson;
}
