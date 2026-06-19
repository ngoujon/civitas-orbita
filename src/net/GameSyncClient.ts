/**
 * Client WebSocket : sync multijoueur avec le serveur autoritaire.
 */

import type { GameCommand } from '@/game/commands';
import type { WsClientMessage, WsServerMessage } from './protocol';
import { deserialize } from '@/core/SaveSystem';
import type { GameState } from '@/game/GameState';

export type GameSyncHandlers = {
  onSnapshot: (state: GameState, tick: number, playerId: string) => void;
  onTick: (tick: number) => void;
  onReject: (seq: number, reason: string) => void;
};

export class GameSyncClient {
  private ws: WebSocket | null = null;
  private seq = 0;
  private reconnectTimer: number | null = null;
  private lastWorldId: string | null = null;
  private lastToken: string | null = null;

  constructor(private readonly handlers: GameSyncHandlers) {}

  connect(token: string, worldId: string): void {
    this.lastToken = token;
    this.lastWorldId = worldId;
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host;
    const url = `${proto}://${host}/ws?token=${encodeURIComponent(token)}&worldId=${encodeURIComponent(worldId)}`;
    this.ws = new WebSocket(url);

    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data)) as WsServerMessage;
      this.handleMessage(msg);
    };

    this.ws.onclose = () => {
      this.scheduleReconnect();
    };
  }

  disconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  sendCommand(cmd: GameCommand): number {
    const seq = ++this.seq;
    this.send({ type: 'command', seq, payload: cmd });
    return seq;
  }

  private send(msg: WsClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private handleMessage(msg: WsServerMessage): void {
    switch (msg.type) {
      case 'snapshot': {
        const state = deserialize(msg.stateJson);
        this.handlers.onSnapshot(state, msg.tick, msg.playerId);
        break;
      }
      case 'tick':
        this.handlers.onTick(msg.tick);
        break;
      case 'reject':
        this.handlers.onReject(msg.seq, msg.reason);
        break;
    }
  }

  private scheduleReconnect(): void {
    if (!this.lastToken || !this.lastWorldId) return;
    if (this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.lastToken && this.lastWorldId) {
        this.connect(this.lastToken, this.lastWorldId);
      }
    }, 3000);
  }
}
