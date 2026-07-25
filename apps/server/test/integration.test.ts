import { createHash } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  AuthWelcome,
  ChoicesView,
  GameEndView,
  GameSnapshotView,
  GameStartView,
  PublicGameEvent,
  RoomStateView,
  ServerErrorView,
} from '@cheongiwa/protocol';
import { buildServer, contextOf, type ServerApp } from '../src/app';

/**
 * 프로토콜 통합 테스트 (PLAN.md §8.2):
 * 정상 대국 완주 / 불법 액션 거부 / 타임아웃 / 재접속·봇 대체 / 손패 비노출.
 */

interface TestContext {
  app: ServerApp;
  url: string;
  clients: ClientSocket[];
}

let ctx: TestContext | null = null;

async function startServer(session: Record<string, number> = {}): Promise<TestContext> {
  const app = await buildServer({
    staticDir: null,
    dbPath: ':memory:',
    session: {
      turnBaseMs: 4000,
      reserveMs: 2000,
      resultDelayMs: 0,
      botDelayMs: 0,
      reconnectWindowMs: 60000,
      ...session,
    },
    matchmaking: { fillOfferAfterMs: 250, fillDecideMs: 400, tickMs: 40 },
  });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const port = (app.server.address() as AddressInfo).port;
  const created: TestContext = { app, url: `http://127.0.0.1:${port}`, clients: [] };
  ctx = created;
  return created;
}

function connect(url: string): ClientSocket {
  const socket = connectClient(url, { transports: ['websocket'], forceNew: true });
  ctx?.clients.push(socket);
  return socket;
}

function once<T>(socket: ClientSocket, event: string, timeoutMs = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${event} 대기 시간 초과`)),
      timeoutMs,
    );
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

async function hello(socket: ClientSocket, nickname: string): Promise<AuthWelcome> {
  const welcome = once<AuthWelcome>(socket, 'auth.welcome');
  socket.emit('auth.hello', { nickname });
  return welcome;
}

/** room.state가 조건을 만족할 때까지 대기 (소켓 간 순서 레이스 방지) */
function waitRoomState(
  socket: ClientSocket,
  predicate: (state: RoomStateView) => boolean,
  timeoutMs = 10000,
): Promise<RoomStateView> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('room.state 조건 대기 초과')), timeoutMs);
    const handler = (state: RoomStateView): void => {
      if (predicate(state)) {
        clearTimeout(timer);
        socket.off('room.state', handler);
        resolve(state);
      }
    };
    socket.on('room.state', handler);
  });
}

/** 조건을 만족하는 game.choices 가 올 때까지 대기 (앞선 선택지는 패스로 넘긴다) */
function waitChoices(
  socket: ClientSocket,
  predicate: (c: ChoicesView) => boolean,
  timeoutMs = 30000,
): Promise<ChoicesView> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('game.choices', handler);
      reject(new Error('game.choices 조건 대기 초과'));
    }, timeoutMs);
    const handler = (c: ChoicesView): void => {
      if (predicate(c)) {
        clearTimeout(timer);
        socket.off('game.choices', handler);
        resolve(c);
        return;
      }
      if (c.kind === 'reaction') socket.emit('game.action', { type: 'pass' });
    };
    socket.on('game.choices', handler);
  });
}

function autoAll(socket: ClientSocket): void {
  socket.emit('settings.auto', { autoWin: true, autoSkipCalls: true, autoTsumogiri: true });
}

afterEach(async () => {
  if (!ctx) return;
  for (const c of ctx.clients) c.disconnect();
  await ctx.app.close();
  ctx = null;
});

describe('봇 지연 + settings.auto 동시 진입 (회귀: 봇 이중 착수 크래시)', () => {
  it('game.start 직후 settings.auto가 봇 타이머와 겹쳐도 크래시 없이 완주한다', async () => {
    // botDelayMs>0 이면 봇 액션이 setTimeout으로 예약된다. 클라가 game.start 직후
    // 보내는 settings.auto가 step()을 호출해 같은 봇 액션이 이중 예약되던 버그의 회귀.
    const { url } = await startServer({ botDelayMs: 15, resultDelayMs: 5 });
    const socket = connect(url);
    await hello(socket, '회귀');
    const started = once<GameStartView>(socket, 'game.start');
    socket.emit('lobby.practice');
    await started;
    autoAll(socket); // 봇 타이머가 이미 예약된 상태에서 step() 트리거
    const end = await once<GameEndView>(socket, 'game.end', 60000);
    expect(end.standings).toHaveLength(4);
  }, 90000);
});

describe('국 결과 표시 중 재진입 (회귀: 결과 타이머 이중 예약)', () => {
  it('결과 대기 중 settings.auto가 반복돼도 다음 국이 정상 진행된다', async () => {
    // 결과 지연이 길면 그 사이 step()이 다시 호출될 수 있다. 그때 handleRoundEnd가
    // 재진입해 advanceGame이 두 번 실행되며 "종료된 국이 없음"으로 죽던 버그의 회귀.
    const { url } = await startServer({ botDelayMs: 0, resultDelayMs: 400 });
    const socket = connect(url);
    await hello(socket, '재진입');
    const started = once<GameStartView>(socket, 'game.start');
    socket.emit('lobby.practice');
    await started;
    autoAll(socket);

    // 결과가 뜰 때마다 자동설정을 다시 보내 step() 재진입을 유도
    socket.on('game.roundResult', () => {
      for (let i = 0; i < 3; i++) autoAll(socket);
    });

    const end = await once<GameEndView>(socket, 'game.end', 90000);
    expect(end.standings).toHaveLength(4);
  }, 120000);
});

describe('연습 대국 (봇 3) 완주', () => {
  it('game.start → 진행 → game.end, 시드 커밋-공개 검증', async () => {
    const { url } = await startServer();
    const socket = connect(url);
    await hello(socket, '유저A');

    const started = once<GameStartView>(socket, 'game.start');
    socket.emit('lobby.practice');
    const start = await started;
    expect(start.players).toHaveLength(4);
    expect(start.players.filter((p) => p.isBot)).toHaveLength(3);
    expect(start.seedHash).toMatch(/^[a-f0-9]{64}$/);

    autoAll(socket);

    let roundResults = 0;
    socket.on('game.roundResult', () => roundResults++);
    const end = await once<GameEndView>(socket, 'game.end', 60000);

    expect(end.standings).toHaveLength(4);
    expect(roundResults).toBeGreaterThan(0);
    // 공정성 증명: 공개된 시드의 해시가 시작 시 커밋과 일치 (§1.2-3)
    expect(createHash('sha256').update(end.seed).digest('hex')).toBe(end.seedHash);
    expect(end.seedHash).toBe(start.seedHash);
  }, 90000);
});

describe('불법 액션 거부 (§8.2)', () => {
  it('손에 없는 패 타패·차례 아닌 행동을 서버가 거부한다', async () => {
    const { url } = await startServer({ turnBaseMs: 8000, reserveMs: 4000 });
    const socket = connect(url);
    await hello(socket, '유저B');

    const started = once<GameStartView>(socket, 'game.start');
    const dealt = once<{ tiles: number[] }>(socket, 'game.deal');
    socket.emit('lobby.practice');
    await started;
    const deal = await dealt;

    // 내 차례가 올 때까지 대기.
    // 첫 game.choices 가 항상 자기 차례인 것은 아니다 — 상대 타패에 울기 기회(reaction)가
    // 먼저 올 수 있어, 시드에 따라 갈리는 플레이키 테스트였다. turn 이 올 때까지 넘긴다.
    const choices = await waitChoices(socket, (c) => c.kind === 'turn');
    const legal = (choices as Extract<ChoicesView, { kind: 'turn' }>).discards;

    // 손에 없는 패 → 거부
    const illegalTile = Array.from({ length: 136 }, (_, i) => i).find(
      (t) => !legal.includes(t),
    ) as number;
    const err1 = once<ServerErrorView>(socket, 'server.error');
    socket.emit('game.action', { type: 'discard', tileId: illegalTile });
    expect((await err1).code).toBe('ILLEGAL_ACTION');

    // 지금은 론 불가 → 거부
    const err2 = once<ServerErrorView>(socket, 'server.error');
    socket.emit('game.action', { type: 'ron' });
    expect((await err2).code).toBe('ILLEGAL_ACTION');

    // 정상 타패는 수리
    socket.emit('game.action', { type: 'discard', tileId: legal[0] as number });
    const event = await once<PublicGameEvent>(socket, 'game.event');
    // 어떤 공개 이벤트든 진행되면 성공 (타패 or 후속)
    expect(event).toBeTruthy();
    expect(deal.tiles).toHaveLength(13);
  }, 60000);
});

describe('턴 타이머 (§3.4)', () => {
  it('시간 초과 시 서버가 쯔모기리한다', async () => {
    const { url } = await startServer({ turnBaseMs: 120, reserveMs: 120 });
    const socket = connect(url);
    const me = await hello(socket, '유저C');
    void me;

    const started = once<GameStartView>(socket, 'game.start');
    socket.emit('lobby.practice');
    const start = await started;

    // 아무 행동도 하지 않아도 내 좌석의 타패가 발생해야 한다
    const myDiscard = await new Promise<PublicGameEvent>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('타임아웃 쯔모기리가 없음')), 20000);
      socket.on('game.event', (e: PublicGameEvent) => {
        if (e.type === 'discard' && e.seat === start.seat) {
          clearTimeout(timer);
          resolve(e);
        }
      });
    });
    expect(myDiscard.type).toBe('discard');
  }, 30000);
});

describe('친선방 → 대국, 강제 종료 → 봇 대체 → 재접속 (완료 기준 시나리오)', () => {
  it('2인 + 봇2 대국에서 1인 이탈·복귀까지 완주한다', async () => {
    // 봇·결과 지연을 주어 대국이 순식간에 끝나기 전에 재접속을 검증한다
    const { url } = await startServer({ botDelayMs: 30, resultDelayMs: 300 });
    const a = connect(url);
    const b = connect(url);
    await hello(a, '갑');
    const welcomeB = await hello(b, '을');
    const tokenB = welcomeB.token as string;

    // 방 구성
    const roomState = once<RoomStateView>(a, 'room.state');
    a.emit('room.create');
    const room = await roomState;
    expect(room.code).toMatch(/^[A-Z0-9]{6}$/);

    const bJoined = once<RoomStateView>(b, 'room.state');
    b.emit('room.join', { code: room.code });
    await bJoined;
    const allReady = waitRoomState(
      a,
      (s) => s.members.length === 4 && s.members.every((m) => m.ready),
    );
    b.emit('room.ready', { ready: true });
    a.emit('room.addBot');
    a.emit('room.addBot');
    await allReady;

    const startA = once<GameStartView>(a, 'game.start');
    const startB = once<GameStartView>(b, 'game.start');
    const bDealP = once<{ tiles: number[] }>(b, 'game.deal');
    a.emit('room.start');
    const [sa, sb] = await Promise.all([startA, startB]);
    expect(sa.gameId).toBe(sb.gameId);

    autoAll(a);
    // B는 수동 → 어느 정도 진행 후 강제 종료
    const bDeal = await bDealP;
    expect(bDeal.tiles).toHaveLength(13);

    const disconnected = new Promise<void>((resolve) => {
      a.on('game.event', (e: PublicGameEvent) => {
        if (e.type === 'playerConnection' && e.seat === sb.seat && !e.connected) resolve();
      });
    });
    b.disconnect();
    await disconnected;

    // B가 봇 대체된 상태에서도 대국은 진행된다
    await once<PublicGameEvent>(a, 'game.event', 20000);

    // 재접속: 토큰 인증 → activeGameId → 스냅샷 복귀
    const b2 = connect(url);
    const welcomeBack = once<AuthWelcome>(b2, 'auth.welcome');
    b2.emit('auth.hello', { token: tokenB });
    const back = await welcomeBack;
    expect(back.activeGameId).toBe(sa.gameId);

    const snapshotP = once<GameSnapshotView>(b2, 'sync.snapshot');
    b2.emit('sync.request');
    const snapshot = await snapshotP;
    expect(snapshot.seat).toBe(sb.seat);
    expect(snapshot.myHand.length).toBeGreaterThan(0);
    autoAll(b2);

    const [endA, endB] = await Promise.all([
      once<GameEndView>(a, 'game.end', 90000),
      once<GameEndView>(b2, 'game.end', 90000),
    ]);
    expect(endA.seed).toBe(endB.seed);
  }, 120000);
});

describe('은닉 정보 비노출 (§8.2 보안 자가 점검)', () => {
  it('타인 손패·쯔모패는 어떤 페이로드에도 실리지 않는다', async () => {
    const { url } = await startServer();
    const a = connect(url);
    const b = connect(url);
    await hello(a, '관찰자');
    await hello(b, '상대');

    // A가 받는 모든 메시지 수집
    const received: Array<{ event: string; payload: unknown }> = [];
    a.onAny((event: string, payload: unknown) => received.push({ event, payload }));

    const roomState = once<RoomStateView>(a, 'room.state');
    a.emit('room.create');
    const room = await roomState;
    b.emit('room.join', { code: room.code });
    await once<RoomStateView>(b, 'room.state');
    const allReady = waitRoomState(
      a,
      (s) => s.members.length === 4 && s.members.every((m) => m.ready),
    );
    b.emit('room.ready', { ready: true });
    a.emit('room.addBot');
    a.emit('room.addBot');
    await allReady;

    const startA = once<GameStartView>(a, 'game.start');
    a.emit('room.start');
    await startA;
    autoAll(a);
    autoAll(b);

    // 중간 스냅샷도 검사 대상에 포함
    await once<PublicGameEvent>(a, 'game.event');
    const snapP = once<GameSnapshotView>(a, 'sync.snapshot');
    a.emit('sync.request');
    const snapshot = await snapP;

    await once<GameEndView>(a, 'game.end', 90000);

    // 1) 쯔모 공개 이벤트에는 tileId가 없다
    const drawEvents = received
      .filter((m) => m.event === 'game.event')
      .map((m) => m.payload as PublicGameEvent)
      .filter((e) => e.type === 'draw');
    expect(drawEvents.length).toBeGreaterThan(0);
    for (const e of drawEvents) {
      expect('tileId' in e).toBe(false);
    }

    // 2) game.deal은 국마다 1회(자기 것)만 온다
    const rounds = received
      .map((m) => m.payload as PublicGameEvent)
      .filter((p) => (p as PublicGameEvent)?.type === 'roundStart').length;
    const deals = received.filter((m) => m.event === 'game.deal').length;
    expect(deals).toBe(rounds);

    // 3) 스냅샷의 타인 좌석에는 손패가 없고 장수만 있다
    for (const p of snapshot.players) {
      expect('hand' in p).toBe(false);
      expect('tiles' in p).toBe(false);
      expect(typeof p.handCount).toBe('number');
    }
    expect(Array.isArray(snapshot.myHand)).toBe(true);

    // 4) game.draw(개인 쯔모패)는 자기 것만 수신
    const myDraws = received.filter((m) => m.event === 'game.draw').length;
    const publicDrawsOfMe = drawEvents.filter((e) => e.seat === snapshot.seat).length;
    expect(myDraws).toBe(publicDrawsOfMe);
  }, 120000);
});

describe('빠른 대전 (§3.2)', () => {
  it('4인이 모이면 자동 시작한다', async () => {
    const { url } = await startServer();
    const sockets = [connect(url), connect(url), connect(url), connect(url)];
    await Promise.all(sockets.map((s, i) => hello(s, `대전${i}`)));

    const starts = sockets.map((s) => once<GameStartView>(s, 'game.start'));
    for (const s of sockets) s.emit('lobby.quickMatch');
    const views = await Promise.all(starts);
    expect(new Set(views.map((v) => v.gameId)).size).toBe(1);
    expect(new Set(views.map((v) => v.seat)).size).toBe(4);
    for (const s of sockets) autoAll(s);
    await once<GameEndView>(sockets[0] as ClientSocket, 'game.end', 90000);
  }, 120000);

  it('60초(테스트 250ms) 미달 시 봇 충원 제안 → 수락하면 시작', async () => {
    const { url } = await startServer();
    const socket = connect(url);
    await hello(socket, '외톨이');

    const offer = once<{ decideMs: number }>(socket, 'lobby.fillOffer', 5000);
    socket.emit('lobby.quickMatch');
    await offer;

    const started = once<GameStartView>(socket, 'game.start', 5000);
    socket.emit('lobby.fillAccept', { accept: true });
    const start = await started;
    expect(start.players.filter((p) => p.isBot)).toHaveLength(3);
  }, 30000);
});

describe('저잣거리·지갑 프로토콜 (§6.3)', () => {
  it('카탈로그 조회 → 구매 → 장착이 지갑 상태로 반영된다', async () => {
    const { url, app } = await startServer();

    const res = await app.inject({ method: 'GET', url: '/api/shop/catalog' });
    expect(res.statusCode).toBe(200);
    const catalog = res.json() as Array<{ id: string; slot: string; price: number }>;
    const paid = catalog.find((i) => i.slot === 'tileBack' && i.price > 0);
    expect(paid).toBeDefined();

    const socket = connect(url);
    const welcome = await hello(socket, '장돌뱅이');
    // 첫 접속은 빈곤 구제로 기준선까지 채워진다 (§6.2)
    expect(welcome.wallet.balance).toBeGreaterThan(0);
    expect(welcome.rank.tier).toBe('유생');
    expect(welcome.wallet.loadout.tileBack).toBe('tileBack.sumaksae');

    // 잔액이 모자란 구매는 거부되고 지갑은 그대로
    const rejected = once<ServerErrorView>(socket, 'server.error', 5000);
    socket.emit('shop.buy', { itemId: paid?.id });
    expect((await rejected).code).toBe('BAD_REQUEST');

    // 엽전을 채워주고 다시 구매 → 잔액 차감 + 해금
    contextOf(app)
      .db.prepare('UPDATE wallets SET balance = 9999 WHERE user_id = ?')
      .run(welcome.userId);
    const bought = once<{ balance: number; unlocked: string[] }>(socket, 'wallet.state', 5000);
    socket.emit('shop.buy', { itemId: paid?.id });
    const afterBuy = await bought;
    expect(afterBuy.balance).toBe(9999 - (paid?.price ?? 0));
    expect(afterBuy.unlocked).toContain(paid?.id);

    // 장착하면 loadout이 바뀐다
    const equipped = once<{ loadout: Record<string, string> }>(socket, 'wallet.state', 5000);
    socket.emit('shop.equip', { slot: 'tileBack', itemId: paid?.id });
    expect((await equipped).loadout.tileBack).toBe(paid?.id);

    // 대국 시작 시 그 뒷면이 좌석 프로필로 전달된다 (상대에게도 보인다)
    const started = once<GameStartView>(socket, 'game.start', 10000);
    socket.emit('lobby.practice');
    const start = await started;
    expect(start.profiles).toHaveLength(4);
    expect(start.profiles[start.seat]?.tileBack).toBe(paid?.id);
    // 봇 좌석은 기본 프로필 — 등급 표시 없음
    const botSeat = start.players.find((p) => p.isBot)?.seat ?? 1;
    expect(start.profiles[botSeat]?.tier).toBeNull();
  }, 30000);
});
