import type { Socket } from 'socket.io';
import type { QueueStateView } from '@cheongiwa/protocol';
import type { SessionSeatInit } from './session';

/**
 * 빠른 대전 매칭 큐 (PLAN.md §3.2): 단일 큐(반장전 기본룰).
 * 4인이 모이면 자동 시작, 60초 미달 시 봇 충원 여부를 대기자에게 묻는다.
 */

interface QueueEntry {
  userId: string;
  nickname: string;
  socket: Socket;
  joinedAt: number;
  fillOffered: boolean;
  fillAccepted: boolean | null;
  offerAt?: number;
}

export interface MatchmakingOptions {
  /** 봇 충원 제안까지 대기 시간 */
  fillOfferAfterMs: number;
  /** 제안 후 응답 대기 시간 */
  fillDecideMs: number;
  tickMs: number;
}

export const DEFAULT_MATCHMAKING: MatchmakingOptions = {
  fillOfferAfterMs: 60000,
  fillDecideMs: 10000,
  tickMs: 1000,
};

const BOT_NAMES = ['달빛', '소나무', '기와'];

export class Matchmaking {
  private readonly queue: QueueEntry[] = [];
  private readonly options: MatchmakingOptions;
  private readonly startGame: (seats: SessionSeatInit[]) => void;
  private timer: NodeJS.Timeout | null = null;

  constructor(options: MatchmakingOptions, startGame: (seats: SessionSeatInit[]) => void) {
    this.options = options;
    this.startGame = startGame;
  }

  begin(): void {
    this.timer = setInterval(() => this.tick(), this.options.tickMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  enqueue(userId: string, nickname: string, socket: Socket): void {
    if (this.queue.some((e) => e.userId === userId)) return;
    this.queue.push({
      userId,
      nickname,
      socket,
      joinedAt: Date.now(),
      fillOffered: false,
      fillAccepted: null,
    });
    this.broadcastQueueState();
    this.tick();
  }

  cancel(userId: string): void {
    const idx = this.queue.findIndex((e) => e.userId === userId);
    if (idx >= 0) {
      const [entry] = this.queue.splice(idx, 1);
      entry?.socket.emit('lobby.queue', {
        inQueue: false,
        position: 0,
        waitingMs: 0,
      } satisfies QueueStateView);
      this.broadcastQueueState();
    }
  }

  handleDisconnect(socketId: string): void {
    const entry = this.queue.find((e) => e.socket.id === socketId);
    if (entry) this.cancel(entry.userId);
  }

  acceptFill(userId: string, accept: boolean): void {
    const entry = this.queue.find((e) => e.userId === userId);
    if (!entry || !entry.fillOffered) return;
    entry.fillAccepted = accept;
    if (!accept) {
      // 거절: 계속 대기 (타이머 리셋)
      entry.joinedAt = Date.now();
      entry.fillOffered = false;
      entry.fillAccepted = null;
    }
    this.tick();
  }

  inQueue(userId: string): boolean {
    return this.queue.some((e) => e.userId === userId);
  }

  private tick(): void {
    // 4인 충족 → 즉시 시작
    while (this.queue.length >= 4) {
      const four = this.queue.splice(0, 4);
      this.startGame(
        four.map((e) => ({
          kind: 'human' as const,
          userId: e.userId,
          nickname: e.nickname,
          socket: e.socket,
        })),
      );
    }

    const now = Date.now();
    for (const entry of this.queue) {
      if (!entry.fillOffered && now - entry.joinedAt >= this.options.fillOfferAfterMs) {
        entry.fillOffered = true;
        entry.fillAccepted = null;
        entry.offerAt = now;
        entry.socket.emit('lobby.fillOffer', { decideMs: this.options.fillDecideMs });
      }
    }

    // 수락자 그룹 → 봇 충원 시작 (응답 시한 초과는 거절 취급)
    const accepters = this.queue.filter((e) => e.fillOffered && e.fillAccepted === true);
    if (accepters.length > 0) {
      const group = accepters.slice(0, 3);
      for (const e of group) {
        const idx = this.queue.indexOf(e);
        if (idx >= 0) this.queue.splice(idx, 1);
      }
      const seats: SessionSeatInit[] = group.map((e) => ({
        kind: 'human' as const,
        userId: e.userId,
        nickname: e.nickname,
        socket: e.socket,
      }));
      let b = 0;
      while (seats.length < 4) {
        seats.push({
          kind: 'bot',
          userId: null,
          nickname: `${BOT_NAMES[b % BOT_NAMES.length]} 봇`,
          socket: null,
        });
        b++;
      }
      this.startGame(seats);
    }

    for (const entry of this.queue) {
      if (
        entry.fillOffered &&
        entry.fillAccepted === null &&
        entry.offerAt !== undefined &&
        now - entry.offerAt >= this.options.fillDecideMs
      ) {
        // 무응답 → 거절 취급, 계속 대기
        entry.fillOffered = false;
        entry.joinedAt = now;
      }
    }

    this.broadcastQueueState();
  }

  private broadcastQueueState(): void {
    const now = Date.now();
    this.queue.forEach((entry, index) => {
      entry.socket.emit('lobby.queue', {
        inQueue: true,
        position: index + 1,
        waitingMs: now - entry.joinedAt,
      } satisfies QueueStateView);
    });
  }
}
