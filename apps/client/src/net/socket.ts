import { io, type Socket } from 'socket.io-client';
import type { GameActionPayload } from '@cheongiwa/protocol';

/**
 * 서버 소켓 단일 인스턴스 (PLAN.md §3.3).
 * 클라이언트는 렌더링·입력 전달만 담당하고, 판정은 서버 엔진이 한다.
 */
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({ transports: ['websocket'], autoConnect: true });
  }
  return socket;
}

/** 서버로 보내는 이벤트 (타입 안전 래퍼) */
export const send = {
  authHello(payload: { nickname?: string; token?: string }): void {
    getSocket().emit('auth.hello', payload);
  },
  quickMatch(): void {
    getSocket().emit('lobby.quickMatch');
  },
  cancelQueue(): void {
    getSocket().emit('lobby.cancel');
  },
  fillAccept(accept: boolean): void {
    getSocket().emit('lobby.fillAccept', { accept });
  },
  practice(): void {
    getSocket().emit('lobby.practice');
  },
  roomCreate(rules?: unknown): void {
    getSocket().emit('room.create', rules ? { rules } : {});
  },
  roomJoin(code: string): void {
    getSocket().emit('room.join', { code });
  },
  roomLeave(): void {
    getSocket().emit('room.leave');
  },
  roomReady(ready: boolean): void {
    getSocket().emit('room.ready', { ready });
  },
  roomAddBot(): void {
    getSocket().emit('room.addBot');
  },
  roomSetRules(rules: unknown): void {
    getSocket().emit('room.setRules', { rules });
  },
  roomStart(): void {
    getSocket().emit('room.start');
  },
  gameAction(action: GameActionPayload): void {
    getSocket().emit('game.action', action);
  },
  autoSettings(auto: { autoWin: boolean; autoSkipCalls: boolean; autoTsumogiri: boolean }): void {
    getSocket().emit('settings.auto', auto);
  },
  syncRequest(): void {
    getSocket().emit('sync.request');
  },
};
