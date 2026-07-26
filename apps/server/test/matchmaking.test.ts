import type { Socket } from 'socket.io';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueueStateView } from '@cheongiwa/protocol';
import { DEFAULT_MATCHMAKING, Matchmaking } from '../src/matchmaking';
import type { SessionSeatInit } from '../src/session';

/**
 * 레이팅 매칭 (PLAN.md §3.2 — "레이팅 매칭은 Phase 5").
 *
 * 핵심 불변식:
 * - 실력이 가까운 사람끼리 먼저 묶인다.
 * - 화면에 보여 준 허용 폭(±band)을 어기고 붙이지 않는다.
 * - 실력이 외진 사람도 기다리면 순서가 온다 (굶김 방지).
 */

interface FakeSocket {
  id: string;
  emit: (event: string, payload: unknown) => void;
  sent: Array<[string, unknown]>;
}

function fakeSocket(id: string): FakeSocket {
  const sent: Array<[string, unknown]> = [];
  return { id, sent, emit: (event, payload) => sent.push([event, payload]) };
}

const T0 = Date.parse('2026-07-26T12:00:00.000Z');

let started: SessionSeatInit[][] = [];
let mm: Matchmaking;
const sockets = new Map<string, FakeSocket>();

function make(options: Partial<typeof DEFAULT_MATCHMAKING> = {}): Matchmaking {
  return new Matchmaking({ ...DEFAULT_MATCHMAKING, ...options }, (seats) => {
    started.push(seats);
  });
}

/** userId 는 이름 그대로, rating 을 붙여 큐에 넣는다 */
function join(id: string, rating: number): void {
  const socket = fakeSocket(id);
  sockets.set(id, socket);
  mm.enqueue(id, id, socket as unknown as Socket, rating);
}

/** 마지막으로 받은 대기 상태 */
function queueState(id: string): QueueStateView | undefined {
  const sent = sockets.get(id)?.sent ?? [];
  for (let i = sent.length - 1; i >= 0; i--) {
    const entry = sent[i] as [string, unknown];
    if (entry[0] === 'lobby.queue') return entry[1] as QueueStateView;
  }
  return undefined;
}

const idsOf = (seats: SessionSeatInit[]): string[] =>
  seats.map((s) => s.userId ?? '봇').sort();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  started = [];
  sockets.clear();
});

afterEach(() => {
  mm.stop();
  vi.useRealTimers();
});

describe('실력대 묶기', () => {
  it('실력이 가까운 4인을 골라 붙인다', () => {
    mm = make();
    mm.begin();
    // 1500대 넷 + 한참 센 둘. 폭(±200) 안에서 가까운 넷이 나가야 한다
    join('a', 1500);
    join('b', 1520);
    join('c', 1480);
    join('d', 2400);
    join('e', 2450);
    join('f', 1540);

    expect(started).toHaveLength(1);
    expect(idsOf(started[0] as SessionSeatInit[])).toEqual(['a', 'b', 'c', 'f']);
    // 남은 둘은 계속 대기
    expect(mm.inQueue('d')).toBe(true);
    expect(mm.inQueue('e')).toBe(true);
  });

  it('폭 밖이면 인원이 차도 붙이지 않는다', () => {
    mm = make();
    mm.begin();
    join('a', 1000);
    join('b', 1600);
    join('c', 2200);
    join('d', 2800);

    expect(started).toHaveLength(0);
    expect(mm.inQueue('a')).toBe(true);
  });

  it('기다릴수록 폭이 넓어져 결국 붙는다', () => {
    // 봇 충원 제안이 끼어들지 않게 충분히 뒤로 미룬다
    mm = make({ fillOfferAfterMs: 10 * 60_000 });
    mm.begin();
    join('a', 1000);
    join('b', 1600);
    join('c', 2200);
    join('d', 2800);
    expect(started).toHaveLength(0);

    // 20/초로 넓어지므로 ±1800 이 되려면 80초. 넷 다 같은 시각에 들어왔다.
    vi.advanceTimersByTime(90_000);
    expect(started).toHaveLength(1);
    expect(idsOf(started[0] as SessionSeatInit[])).toEqual(['a', 'b', 'c', 'd']);
  });

  it('보여 준 폭보다 넓게 붙이지 않는다 — 양쪽 기준을 모두 본다', () => {
    mm = make({ fillOfferAfterMs: 10 * 60_000 });
    mm.begin();
    // 오래 기다린 사람의 폭은 넓어졌지만, 방금 들어온 사람의 폭은 아직 좁다
    join('old', 1000);
    vi.advanceTimersByTime(60_000); // old 의 폭 ±1400
    join('n1', 2300);
    join('n2', 2320);
    join('n3', 2340);

    // old 기준으로는 받아들일 수 있어도 신규 셋의 폭(±200)이 old 를 배제한다
    expect(started).toHaveLength(0);
    expect(queueState('n1')?.band).toBe(DEFAULT_MATCHMAKING.ratingBand);

    // 신규 셋도 충분히 기다리면 넷이 함께 나간다
    vi.advanceTimersByTime(70_000);
    expect(started).toHaveLength(1);
    expect(idsOf(started[0] as SessionSeatInit[])).toEqual(['n1', 'n2', 'n3', 'old']);
  });

  it('맞는 상대가 있으면 오래 기다린 사람이 신규보다 먼저 들어간다', () => {
    mm = make({ fillOfferAfterMs: 10 * 60_000 });
    mm.begin();
    join('waited', 900);
    vi.advanceTimersByTime(30_000);

    // 900대 셋(waited 와 맞음) + 1500대 넷(자기들끼리 맞음)이 동시에 들어온다
    join('near1', 950);
    join('near2', 1000);
    join('far1', 1500);
    join('far2', 1510);
    join('far3', 1520);
    join('near3', 1050);

    // 먼저 나간 판에 오래 기다린 사람이 들어 있어야 한다
    expect(started.length).toBeGreaterThanOrEqual(1);
    expect(idsOf(started[0] as SessionSeatInit[])).toContain('waited');
  });

  it('맞는 상대가 없으면 남을 붙잡지 않고, 대신 봇 충원을 제안받는다', () => {
    // 실력이 외진 한 명은 "아무나와 붙인다"가 아니라 "봇과 시작하겠냐"로 풀어야 한다.
    // 신규의 좁은 폭을 억지로 넓히면 화면에 보여 준 약속을 어기게 된다.
    mm = make({ fillOfferAfterMs: 20_000, fillDecideMs: 5_000 });
    mm.begin();
    join('lonely', 800);
    vi.advanceTimersByTime(5_000);

    join('x1', 1500);
    join('x2', 1510);
    join('x3', 1520);
    join('x4', 1530);

    // 신규 넷의 폭(±200)이 lonely(700 차이)를 못 받아들여 넷끼리 나간다
    expect(started).toHaveLength(1);
    expect(idsOf(started[0] as SessionSeatInit[])).toEqual(['x1', 'x2', 'x3', 'x4']);
    expect(mm.inQueue('lonely')).toBe(true);

    // 대신 오래 기다린 만큼 봇 충원 제안이 온다
    vi.advanceTimersByTime(20_000);
    expect((sockets.get('lonely')?.sent ?? []).some(([e]) => e === 'lobby.fillOffer')).toBe(true);
  });

  it('실력이 동떨어진 한 명이 큐 앞에 있어도 뒤가 멈추지 않는다', () => {
    mm = make({ fillOfferAfterMs: 10 * 60_000 });
    mm.begin();
    join('outlier', 800);
    vi.advanceTimersByTime(1_000);
    join('a', 1500);
    join('b', 1505);
    join('c', 1510);
    join('d', 1515);

    expect(started).toHaveLength(1);
    expect(idsOf(started[0] as SessionSeatInit[])).toEqual(['a', 'b', 'c', 'd']);
    expect(mm.inQueue('outlier')).toBe(true);
  });
});

describe('대기 상태', () => {
  it('허용 폭만 실어 보내고 MMR 수치는 내보내지 않는다', () => {
    mm = make({ fillOfferAfterMs: 10 * 60_000 });
    mm.begin();
    join('a', 1732.5);

    const state = queueState('a');
    expect(state).toMatchObject({ inQueue: true, band: DEFAULT_MATCHMAKING.ratingBand });
    // MMR 은 매칭에만 쓰는 값이라 대기 상태에 실리면 안 된다
    expect(JSON.stringify(state)).not.toContain('1732');
    expect(Object.keys(state ?? {})).not.toContain('rating');

    vi.advanceTimersByTime(30_000);
    // 20/초 × 30초 = 600 만큼 넓어진다
    expect(queueState('a')?.band).toBe(DEFAULT_MATCHMAKING.ratingBand + 600);
  });

  it('폭은 상한을 넘지 않는다', () => {
    mm = make({ fillOfferAfterMs: 60 * 60_000 });
    mm.begin();
    join('a', 1500);
    vi.advanceTimersByTime(30 * 60_000);
    expect(queueState('a')?.band).toBe(DEFAULT_MATCHMAKING.maxBand);
  });

  it('취소하면 큐에서 빠진다', () => {
    mm = make();
    mm.begin();
    join('a', 1500);
    mm.cancel('a');
    expect(mm.inQueue('a')).toBe(false);
    expect(queueState('a')?.inQueue).toBe(false);
  });
});

describe('봇 충원 (기존 흐름 유지)', () => {
  it('오래 못 잡히면 봇 충원을 묻고, 수락하면 봇으로 채워 시작한다', () => {
    mm = make({ fillOfferAfterMs: 5_000, fillDecideMs: 3_000 });
    mm.begin();
    join('a', 1500);

    vi.advanceTimersByTime(6_000);
    const offered = (sockets.get('a')?.sent ?? []).some(([e]) => e === 'lobby.fillOffer');
    expect(offered).toBe(true);

    mm.acceptFill('a', true);
    expect(started).toHaveLength(1);
    const seats = started[0] as SessionSeatInit[];
    expect(seats).toHaveLength(4);
    expect(seats.filter((s) => s.kind === 'bot')).toHaveLength(3);
  });
});

describe('두 시계 분리', () => {
  it('봇 충원 제안을 넘겨도 실력 허용 폭은 계속 넓어진다', () => {
    // 대기 시계와 "다시 물어볼 시계"를 한 칸에 두면, 제안을 넘길 때마다 폭이
    // 처음으로 되감겨 아무리 기다려도 실력 차가 큰 상대와는 영영 안 붙는다.
    mm = make({ fillOfferAfterMs: 10_000, fillDecideMs: 2_000 });
    mm.begin();
    join('a', 1500);

    // 제안 → 무응답 → 다시 대기 를 세 번 반복
    vi.advanceTimersByTime(45_000);
    expect(queueState('a')?.band).toBe(
      DEFAULT_MATCHMAKING.ratingBand + 45 * DEFAULT_MATCHMAKING.bandWidenPerSec,
    );
    expect(queueState('a')?.waitingMs).toBe(45_000);
  });

  it('제안을 거절해도 대기 시간이 0으로 돌아가지 않는다', () => {
    mm = make({ fillOfferAfterMs: 10_000, fillDecideMs: 30_000 });
    mm.begin();
    join('a', 1500);
    vi.advanceTimersByTime(11_000);
    mm.acceptFill('a', false);
    expect(queueState('a')?.waitingMs).toBe(11_000);
  });
});
