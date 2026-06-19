/**
 * Gateway WebSocket multijoueur.
 */

import type { Server } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import { applyCommand, joinRoom, leaveRoom } from '../game/WorldRoom.js';
import type { WsClientMessage } from '../game/protocol.js';

export function attachWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? '', 'http://localhost');
    const token = url.searchParams.get('token') ?? '';
    const worldId = url.searchParams.get('worldId') ?? '';

    if (!token || !worldId) {
      ws.close(4001, 'token et worldId requis');
      return;
    }

    const joined = joinRoom(worldId, token, ws);
    if (!joined.ok) {
      ws.close(4003, joined.reason);
      return;
    }

    const userId = joined.member.userId;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as WsClientMessage;
        if (msg.type === 'command') {
          const result = applyCommand(worldId, userId, msg.seq, msg.payload);
          if (!result.ok) {
            ws.send(JSON.stringify({ type: 'reject', seq: msg.seq, reason: result.reason ?? 'rejet' }));
          }
        }
      } catch {
        ws.send(JSON.stringify({ type: 'reject', seq: 0, reason: 'message_invalide' }));
      }
    });

    ws.on('close', () => {
      leaveRoom(userId, worldId);
    });
  });
}
