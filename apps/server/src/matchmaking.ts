import type { Socket } from 'socket.io';
import type { QueueStateView } from '@cheongiwa/protocol';
import type { SessionSeatInit } from './session';

/**
 * 빠른 대전 매칭 큐 (PLAN.md §3.2 — "레이팅 매칭은 Phase 5").
 *
 * 실력 점수가 비슷한 4인을 묶되, **아무도 굶지 않게** 한다. 사람이 적은 시간대에
 * 실력대를 엄히 지키면 영영 안 잡히므로, 기다린 만큼 허용 폭이 넓어진다.
 * 그래도 못 채우면 기존 흐름대로 봇 충원을 묻는다.
 */

interface QueueEntry {
  userId: string;
  nickname: string;
  socket: Socket;
  /** 매칭 기준이 되는 실력 점수 (§3.2) */
  rating: number;
  /** 큐에 들어온 시각. 실력 허용 폭은 여기서만 자란다 — 절대 되감지 않는다 */
  joinedAt: number;
  /**
   * 봇 충원을 다시 물어볼 기준 시각. 제안을 거절·무시하면 이 값만 미뤄지고
   * `joinedAt` 은 그대로다 — 두 시계를 한 칸에 두면 제안을 넘길 때마다 실력 폭이
   * 처음으로 되감겨 아무리 기다려도 안 넓어진다.
   */
  fillTimerFrom: number;
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
  /** 처음 허용하는 실력 차 */
  ratingBand: number;
  /** 1초 기다릴 때마다 넓어지는 폭 */
  bandWidenPerSec: number;
  /** 여기까지 넓어지면 사실상 전원 허용 */
  maxBand: number;
}

export const DEFAULT_MATCHMAKING: MatchmakingOptions = {
  fillOfferAfterMs: 60000,
  fillDecideMs: 10000,
  tickMs: 1000,
  ratingBand: 200,
  bandWidenPerSec: 20,
  maxBand: 3000,
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

  enqueue(userId: string, nickname: string, socket: Socket, rating: number): void {
    if (this.queue.some((e) => e.userId === userId)) return;
    this.queue.push({
      userId,
      nickname,
      socket,
      rating,
      joinedAt: Date.now(),
      fillTimerFrom: Date.now(),
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
      if (entry) {
        entry.socket.emit('lobby.queue', {
          inQueue: false,
          position: 0,
          waitingMs: 0,
          band: 0,
        } satisfies QueueStateView);
      }
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
      // 거절: 계속 대기. 다시 물어보는 시계만 미루고 대기 시간은 이어 간다
      entry.fillTimerFrom = Date.now();
      entry.fillOffered = false;
      entry.fillAccepted = null;
    }
    this.tick();
  }

  inQueue(userId: string): boolean {
    return this.queue.some((e) => e.userId === userId);
  }

  /** 이 사람이 지금 받아들이는 실력 차 (기다린 만큼 넓어진다) */
  private bandFor(entry: QueueEntry, now: number): number {
    const waited = Math.max(0, now - entry.joinedAt) / 1000;
    return Math.min(
      this.options.maxBand,
      this.options.ratingBand + waited * this.options.bandWidenPerSec,
    );
  }

  /**
   * 서로가 서로의 허용 폭 안에 있어야 붙인다.
   * 한쪽 기준만 보면 화면에 "±200 안에서 찾는 중"이라 해 놓고 훨씬 센 사람을
   * 앉히게 된다 — 보여 준 약속을 어기지 않으려면 양쪽을 다 봐야 한다.
   */
  private fits(a: QueueEntry, b: QueueEntry, now: number): boolean {
    const allowed = Math.min(this.bandFor(a, now), this.bandFor(b, now));
    return Math.abs(a.rating - b.rating) <= allowed;
  }

  /**
   * 4인 묶음을 고른다. 기준(anchor)은 **가장 오래 기다린 사람** — 그래야 실력이
   * 외진 사람도 순서가 돌아온다. 거기서부터 실력이 가까운 순으로, 이미 뽑은
   * 전원과 맞는 사람만 채운다.
   *
   * 기준자로 넷을 못 채우면 다음 사람으로 넘어간다. 안 그러면 실력이 동떨어진
   * 한 명이 큐 맨 앞에 있는 것만으로 뒤 전체가 멈춘다.
   */
  private takeGroup(now: number): QueueEntry[] | null {
    if (this.queue.length < 4) return null;
    const byWait = [...this.queue].sort((a, b) => a.joinedAt - b.joinedAt);

    for (const anchor of byWait) {
      const candidates = byWait
        .filter((e) => e !== anchor)
        .sort(
          (a, b) =>
            Math.abs(a.rating - anchor.rating) - Math.abs(b.rating - anchor.rating) ||
            a.joinedAt - b.joinedAt,
        );

      const group = [anchor];
      for (const c of candidates) {
        if (group.length === 4) break;
        if (group.every((g) => this.fits(g, c, now))) group.push(c);
      }
      if (group.length < 4) continue;

      for (const e of group) {
        const idx = this.queue.indexOf(e);
        if (idx >= 0) this.queue.splice(idx, 1);
      }
      return group;
    }
    return null;
  }

  private seatsOf(entries: QueueEntry[]): SessionSeatInit[] {
    return entries.map((e) => ({
      kind: 'human' as const,
      userId: e.userId,
      nickname: e.nickname,
      socket: e.socket,
    }));
  }

  private tick(): void {
    const now = Date.now();

    // 실력대가 맞는 4인이 모이는 대로 시작
    for (;;) {
      const group = this.takeGroup(now);
      if (!group) break;
      this.startGame(this.seatsOf(group));
    }

    for (const entry of this.queue) {
      if (!entry.fillOffered && now - entry.fillTimerFrom >= this.options.fillOfferAfterMs) {
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
      const seats = this.seatsOf(group);
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
        // 무응답 → 거절 취급, 계속 대기 (실력 폭은 계속 넓어진다)
        entry.fillOffered = false;
        entry.fillTimerFrom = now;
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
        band: Math.round(this.bandFor(entry, now)),
      } satisfies QueueStateView);
    });
  }
}
