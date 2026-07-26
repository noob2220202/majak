import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import { z } from 'zod';
import type { RoundAction } from '@cheongiwa/engine';
import {
  AuthChangePasswordSchema,
  AuthHelloSchema,
  AuthLogInSchema,
  AuthRecoverSchema,
  AuthSignUpSchema,
  AutoSettingsSchema,
  FillAcceptSchema,
  GameActionSchema,
  PROTOCOL_VERSION,
  RoomCodeSchema,
  RoomReadySchema,
  RuleSettingsSchema,
  EmoteSendSchema,
  ShopBuySchema,
  ShopEquipSchema,
  type AuthWelcome,
  type ServerErrorView,
} from '@cheongiwa/protocol';
import {
  changePassword,
  findById,
  logIn,
  resetPassword,
  revokeSession,
  signUp,
  type AccountOutcome,
} from './accounts';
import { authenticate, statsOf } from './auth';
import { openDatabase, type AppDatabase } from './db';
import { grantGameRewards, grantReliefIfNeeded } from './economy';
import { DEFAULT_MATCHMAKING, Matchmaking, type MatchmakingOptions } from './matchmaking';
import { applyGameRatings, rankOf } from './ranks';
import { persistGame } from './records';
import { RoomManager } from './rooms';
import { buyItem, CATALOG, equipItem, walletView } from './shop';
import {
  DEFAULT_SESSION_OPTIONS,
  GameSession,
  type SessionOptions,
  type SessionSeatInit,
} from './session';

export interface BuildServerOptions {
  /** 클라 정적 파일 경로. null이면 비활성, 생략 시 자동 탐지(STATIC_DIR env → apps/client/dist) */
  staticDir?: string | null;
  logger?: boolean;
  dbPath?: string;
  session?: Partial<SessionOptions>;
  matchmaking?: Partial<MatchmakingOptions>;
}

/** STATIC_DIR env 우선, 없으면 모노레포 내 클라 빌드 산출물을 찾는다. */
export function resolveDefaultStaticDir(): string | null {
  const fromEnv = process.env.STATIC_DIR;
  if (fromEnv) return fromEnv;
  const candidate = fileURLToPath(new URL('../../client/dist', import.meta.url));
  return existsSync(candidate) ? candidate : null;
}

interface SocketData {
  userId: string | null;
  nickname: string;
  /** 이 연결이 쓰고 있는 세션 토큰 — 로그아웃·비밀번호 변경에서 이것만 남기거나 지운다 */
  token: string | null;
}

export interface ServerContext {
  db: AppDatabase;
  io: SocketIOServer;
  sessions: Map<string, GameSession>;
  sessionByUser: Map<string, string>;
}

/**
 * Fastify + Socket.IO 서버 구성 (PLAN.md §3).
 * 서버 권위: 모든 판정·셔플·배패는 여기서만 일어난다.
 */
export async function buildServer(options: BuildServerOptions = {}) {
  const app = Fastify({ logger: options.logger ?? false });
  const db = openDatabase(options.dbPath ?? process.env.DB_PATH ?? 'data/cheongiwa.db');
  const sessionOptions: SessionOptions = { ...DEFAULT_SESSION_OPTIONS, ...options.session };

  app.get('/api/shop/catalog', async () => CATALOG);

  app.get('/healthz', async () => ({
    ok: true,
    service: 'cheongiwa-server',
    protocolVersion: PROTOCOL_VERSION,
  }));

  const staticDir = options.staticDir !== undefined ? options.staticDir : resolveDefaultStaticDir();
  if (staticDir) {
    await app.register(fastifyStatic, { root: staticDir });
    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && !request.url.startsWith('/socket.io')) {
        return reply.sendFile('index.html');
      }
      return reply.code(404).send({ error: 'not found' });
    });
  }

  const io = new SocketIOServer(app.server, { serveClient: false });
  const rooms = new RoomManager(io);
  const sessions = new Map<string, GameSession>();
  const sessionByUser = new Map<string, string>();
  /** 보상·등급 알림 전송용 (userId → 현재 소켓) */
  const socketsByUser = new Map<string, Socket>();

  const launchSession = (
    seats: SessionSeatInit[],
    rules: unknown,
    practice: boolean,
  ): GameSession => {
    // 좌석별 공개 프로필(등급·패 뒷면)을 붙인다 — 표시용, 판정에는 쓰이지 않는다 (§6.1-2)
    const withProfiles = seats.map((s) => {
      if (!s.userId) return s;
      const rank = rankOf(db, s.userId);
      const { loadout } = walletView(db, s.userId);
      return {
        ...s,
        profile: {
          tier: rank.games > 0 ? rank.tier : null,
          level: rank.level,
          tileBack: loadout.tileBack,
          winEffect: loadout.winEffect,
        },
      };
    });
    const session = new GameSession(
      io,
      withProfiles,
      RuleSettingsSchema.parse(rules ?? {}),
      { ...sessionOptions, practice },
      (summary) => {
        persistGame(db, summary);
        // 엽전 보상 + 등급 반영 (§6.2 — 인간 2인 이상·연습 아님·완주, gameId 멱등)
        const rewards = grantGameRewards(db, summary);
        const ranks = applyGameRatings(db, summary);
        for (const seat of summary.seats) {
          if (!seat.userId) continue;
          const target = socketsByUser.get(seat.userId);
          if (target) {
            const reward = rewards.get(seat.userId);
            if (reward) target.emit('wallet.rewards', reward);
            const rank = ranks.get(seat.userId);
            if (rank) target.emit('rank.state', rank);
            target.emit('wallet.state', walletView(db, seat.userId));
          }
          if (sessionByUser.get(seat.userId) === summary.gameId) {
            sessionByUser.delete(seat.userId);
          }
        }
        sessions.delete(summary.gameId);
      },
    );
    sessions.set(session.id, session);
    for (const seat of seats) {
      if (seat.userId) sessionByUser.set(seat.userId, session.id);
    }
    session.start();
    return session;
  };

  const matchmaking = new Matchmaking(
    { ...DEFAULT_MATCHMAKING, ...options.matchmaking },
    (seats) => launchSession(seats, {}, false),
  );
  matchmaking.begin();

  const sendError = (socket: Socket, code: ServerErrorView['code'], message: string): void => {
    socket.emit('server.error', { code, message } satisfies ServerErrorView);
  };

  /** 게스트면 null */
  const accountLoginId = (userId: string): string | null => findById(db, userId)?.login_id ?? null;

  io.on('connection', (socket) => {
    const data: SocketData = { userId: null, nickname: '', token: null };
    socket.emit('server.hello', { protocolVersion: PROTOCOL_VERSION });

    const requireAuth = (): string | null => {
      if (!data.userId) {
        sendError(socket, 'UNAUTHENTICATED', '먼저 auth.hello로 인증하세요');
        return null;
      }
      return data.userId;
    };

    /** zod 검증 + 에러 통일 래퍼 (비동기 핸들러도 받는다 — 비밀번호 해싱이 비동기다) */
    const on = <S extends z.ZodTypeAny>(
      event: string,
      schema: S | null,
      handler: (payload: z.infer<S>) => void | Promise<void>,
    ): void => {
      const fail = (error: unknown): void => {
        if (error instanceof z.ZodError) {
          sendError(socket, 'BAD_REQUEST', `${event}: 잘못된 요청`);
        } else {
          sendError(socket, 'BAD_REQUEST', error instanceof Error ? error.message : '요청 처리 실패');
        }
      };
      socket.on(event, (raw: unknown) => {
        try {
          const payload = schema ? schema.parse(raw ?? {}) : (undefined as z.infer<S>);
          void Promise.resolve(handler(payload)).catch(fail);
        } catch (error) {
          fail(error);
        }
      });
    };

    /**
     * 인증 성공 후 공통 처리: 소켓에 신원을 붙이고, 진행 중 대국이 있으면 다시 잇고,
     * 지갑·등급·빈곤 구제를 실어 `auth.welcome` 을 보낸다.
     */
    const welcome = (
      user: { userId: string; nickname: string; loginId: string | null },
      extra: { token?: string; recoveryCode?: string } = {},
    ): void => {
      const previous = data.userId;
      if (previous && previous !== user.userId && socketsByUser.get(previous) === socket) {
        socketsByUser.delete(previous);
      }
      data.userId = user.userId;
      data.nickname = user.nickname;
      if (extra.token) data.token = extra.token;

      // 진행 중 대국 재접속 바인딩
      const activeId = sessionByUser.get(user.userId) ?? null;
      let activeGameId: string | null = null;
      if (activeId) {
        const session = sessions.get(activeId);
        if (session && !session.isEnded && session.rebind(user.userId, socket) !== null) {
          activeGameId = activeId;
        }
      }

      socketsByUser.set(user.userId, socket);
      // 빈곤 구제: 잔액이 기준선 미만이면 하루 1회 충전 (§6.2)
      const relief = grantReliefIfNeeded(db, user.userId);

      const payload: AuthWelcome = {
        userId: user.userId,
        nickname: user.nickname,
        account: user.loginId === null ? null : { loginId: user.loginId },
        stats: statsOf(db, user.userId),
        activeGameId,
        wallet: walletView(db, user.userId),
        rank: rankOf(db, user.userId),
        pendingRewards: relief,
      };
      if (extra.token) payload.token = extra.token;
      if (extra.recoveryCode) payload.recoveryCode = extra.recoveryCode;
      socket.emit('auth.welcome', payload);
    };

    /**
     * 비밀번호 해싱은 한 번에 16MB·수십 ms를 쓴다. 인증 전에도 부를 수 있는 창구라
     * 연결 하나가 연달아 두드리면 그것만으로 서버가 눌린다 — 한 연결당 한 번에 하나,
     * 그리고 최소 간격을 둔다. (아이디별 실패 잠금은 accounts.ts 가 따로 센다)
     */
    // 사람이 비밀번호를 고쳐 치고 다시 누르는 데는 이보다 훨씬 오래 걸린다.
    // 정정 재시도를 막지 않으면서 자동 연타만 걸러내는 선.
    const AUTH_MIN_GAP_MS = 150;
    let authInFlight = false;
    let lastAuthAt = 0;
    const throttleAuth = (): boolean => {
      const now = Date.now();
      if (authInFlight || now - lastAuthAt < AUTH_MIN_GAP_MS) {
        sendError(socket, 'BAD_REQUEST', '잠시 후 다시 시도하세요');
        return true;
      }
      lastAuthAt = now;
      authInFlight = true;
      return false;
    };

    /** 대국·방에 묶인 채로 신원을 갈아치우면 좌석 주인이 어긋난다 */
    const busy = (): boolean => {
      const userId = data.userId;
      if (userId && sessionByUser.has(userId)) {
        sendError(socket, 'BAD_REQUEST', '대국 중에는 계정을 바꿀 수 없습니다');
        return true;
      }
      return false;
    };

    const afterAccount = (result: AccountOutcome): void => {
      if (!result.ok) {
        sendError(socket, 'BAD_REQUEST', result.message);
        return;
      }
      const extra: { token: string; recoveryCode?: string } = { token: result.token };
      if (result.recoveryCode) extra.recoveryCode = result.recoveryCode;
      welcome(
        { userId: result.userId, nickname: result.nickname, loginId: result.loginId },
        extra,
      );
    };

    on('auth.hello', AuthHelloSchema, (payload) => {
      const authed = authenticate(db, payload);
      if (!authed) {
        sendError(socket, 'UNAUTHENTICATED', '유효하지 않은 토큰입니다');
        return;
      }
      data.token = authed.issuedToken ?? payload.token ?? null;
      const extra = authed.issuedToken ? { token: authed.issuedToken } : {};
      welcome(authed, extra);
    });

    on('auth.signUp', AuthSignUpSchema, async (payload) => {
      if (busy() || throttleAuth()) return;
      try {
        // 게스트로 놀던 중이면 그 계정을 승격한다 — 엽전·전적·등급·코스메틱이 그대로 남는다
        if (data.userId) rooms.leave(data.userId);
        afterAccount(await signUp(db, { ...payload, guestUserId: data.userId }));
      } finally {
        authInFlight = false;
      }
    });

    on('auth.logIn', AuthLogInSchema, async (payload) => {
      if (busy() || throttleAuth()) return;
      try {
        if (data.userId) rooms.leave(data.userId);
        afterAccount(await logIn(db, payload));
      } finally {
        authInFlight = false;
      }
    });

    on('auth.recover', AuthRecoverSchema, async (payload) => {
      if (busy() || throttleAuth()) return;
      try {
        if (data.userId) rooms.leave(data.userId);
        afterAccount(await resetPassword(db, payload));
      } finally {
        authInFlight = false;
      }
    });

    on('auth.logOut', null, () => {
      const userId = requireAuth();
      if (!userId) return;
      if (busy()) return;
      rooms.leave(userId);
      matchmaking.cancel(userId);
      if (data.token) revokeSession(db, data.token);
      if (socketsByUser.get(userId) === socket) socketsByUser.delete(userId);
      data.userId = null;
      data.nickname = '';
      data.token = null;
      socket.emit('auth.loggedOut', {});
    });

    on('auth.changePassword', AuthChangePasswordSchema, async (payload) => {
      const userId = requireAuth();
      if (!userId || throttleAuth()) return;
      try {
        // 지금 쓰는 기기는 남기고 나머지 세션만 끊는다
        const result = await changePassword(db, userId, payload, data.token);
        if (!result.ok) {
          sendError(socket, 'BAD_REQUEST', result.message);
          return;
        }
        welcome({ userId, nickname: data.nickname, loginId: accountLoginId(userId) });
      } finally {
        authInFlight = false;
      }
    });

    on('lobby.quickMatch', null, () => {
      const userId = requireAuth();
      if (!userId) return;
      if (sessionByUser.has(userId)) {
        sendError(socket, 'BAD_REQUEST', '진행 중인 대국이 있습니다');
        return;
      }
      rooms.leave(userId);
      matchmaking.enqueue(userId, data.nickname, socket);
    });

    on('lobby.cancel', null, () => {
      const userId = requireAuth();
      if (!userId) return;
      matchmaking.cancel(userId);
    });

    on('lobby.fillAccept', FillAcceptSchema, (payload) => {
      const userId = requireAuth();
      if (!userId) return;
      matchmaking.acceptFill(userId, payload.accept);
    });

    on('lobby.practice', null, () => {
      const userId = requireAuth();
      if (!userId) return;
      if (sessionByUser.has(userId)) {
        sendError(socket, 'BAD_REQUEST', '진행 중인 대국이 있습니다');
        return;
      }
      // 연습: 같은 방 구조를 그대로 사용 (§3.2 — 코드 경로 분리 없음)
      rooms.create(userId, data.nickname, socket, { practice: true });
      const { room, seats } = rooms.startSeats(userId);
      launchSession(seats, room.rules, true);
    });

    on('room.create', z.object({ rules: z.unknown().optional() }).optional(), (payload) => {
      const userId = requireAuth();
      if (!userId) return;
      matchmaking.cancel(userId);
      const room = rooms.create(userId, data.nickname, socket);
      if (payload && payload.rules !== undefined) {
        rooms.setRules(userId, RuleSettingsSchema.parse(payload.rules));
      }
      socket.emit('room.state', rooms.stateView(rooms.roomOfUser(userId) ?? room));
    });

    on('room.join', RoomCodeSchema, (payload) => {
      const userId = requireAuth();
      if (!userId) return;
      matchmaking.cancel(userId);
      rooms.join(userId, data.nickname, socket, payload.code);
    });

    on('room.leave', null, () => {
      const userId = requireAuth();
      if (!userId) return;
      rooms.leave(userId);
    });

    on('room.ready', RoomReadySchema, (payload) => {
      const userId = requireAuth();
      if (!userId) return;
      rooms.setReady(userId, payload.ready);
    });

    on('room.addBot', null, () => {
      const userId = requireAuth();
      if (!userId) return;
      rooms.addBot(userId);
    });

    on('room.setRules', z.object({ rules: z.unknown() }), (payload) => {
      const userId = requireAuth();
      if (!userId) return;
      rooms.setRules(userId, RuleSettingsSchema.parse(payload.rules));
    });

    on('room.start', null, () => {
      const userId = requireAuth();
      if (!userId) return;
      const { room, seats } = rooms.startSeats(userId);
      launchSession(seats, room.rules, room.practice);
    });

    on('game.action', GameActionSchema, (payload) => {
      const userId = requireAuth();
      if (!userId) return;
      const sessionId = sessionByUser.get(userId);
      const session = sessionId ? sessions.get(sessionId) : undefined;
      if (!session) {
        sendError(socket, 'NOT_IN_GAME', '진행 중인 대국이 없습니다');
        return;
      }
      const result = session.handleAction(userId, payload as RoundAction);
      if (!result.ok) sendError(socket, 'ILLEGAL_ACTION', result.message);
    });

    on('settings.auto', AutoSettingsSchema, (payload) => {
      const userId = requireAuth();
      if (!userId) return;
      const sessionId = sessionByUser.get(userId);
      const session = sessionId ? sessions.get(sessionId) : undefined;
      session?.setAutoSettings(userId, payload);
    });

    on('wallet.request', null, () => {
      const userId = requireAuth();
      if (!userId) return;
      socket.emit('wallet.state', walletView(db, userId));
      socket.emit('rank.state', rankOf(db, userId));
    });

    on('shop.buy', ShopBuySchema, (payload) => {
      const userId = requireAuth();
      if (!userId) return;
      const result = buyItem(db, userId, payload.itemId);
      if (!result.ok) {
        sendError(socket, 'BAD_REQUEST', result.message);
        return;
      }
      socket.emit('wallet.state', result.wallet);
    });

    on('shop.equip', ShopEquipSchema, (payload) => {
      const userId = requireAuth();
      if (!userId) return;
      const result = equipItem(db, userId, payload.slot, payload.itemId);
      if (!result.ok) {
        sendError(socket, 'BAD_REQUEST', result.message);
        return;
      }
      socket.emit('wallet.state', result.wallet);
    });

    on('emote.send', EmoteSendSchema, (payload) => {
      const userId = requireAuth();
      if (!userId) return;
      const sessionId = sessionByUser.get(userId);
      const session = sessionId ? sessions.get(sessionId) : undefined;
      if (!session) {
        sendError(socket, 'NOT_IN_GAME', '진행 중인 대국이 없습니다');
        return;
      }
      const seat = session.seatOfUser(userId);
      if (seat === null) return;
      // 산 것만 쓸 수 있다 — 무료 기본품은 CATALOG 가격 0으로 판별한다
      const item = CATALOG.find((i) => i.id === payload.itemId && i.slot === 'emote');
      if (!item) {
        sendError(socket, 'BAD_REQUEST', '없는 이모티콘입니다');
        return;
      }
      const owned = item.price === 0 || walletView(db, userId).unlocked.includes(item.id);
      if (!owned) {
        sendError(socket, 'BAD_REQUEST', '보유하지 않은 이모티콘입니다');
        return;
      }
      // 쿨다운에 걸리면 조용히 무시한다 — 도배 방지이지 오류가 아니다
      session.sendEmote(seat, item.id);
    });

    on('sync.request', null, () => {
      const userId = requireAuth();
      if (!userId) return;
      const sessionId = sessionByUser.get(userId);
      const session = sessionId ? sessions.get(sessionId) : undefined;
      const snapshot = session?.snapshotFor(userId);
      if (!snapshot) {
        sendError(socket, 'NOT_IN_GAME', '재접속할 대국이 없습니다');
        return;
      }
      socket.emit('sync.snapshot', snapshot);
    });

    socket.on('disconnect', () => {
      for (const [uid, bound] of socketsByUser) {
        if (bound.id === socket.id) socketsByUser.delete(uid);
      }
      rooms.handleDisconnect(socket.id);
      matchmaking.handleDisconnect(socket.id);
      for (const session of sessions.values()) {
        session.markDisconnected(socket.id);
      }
    });
  });

  app.addHook('onClose', (_instance, done) => {
    matchmaking.stop();
    for (const session of sessions.values()) session.dispose();
    sessions.clear();
    io.disconnectSockets(true);
    io.engine.close();
    db.close();
    done();
  });

  return Object.assign(app, { ctx: { db, io, sessions, sessionByUser } });
}

export type ServerApp = Awaited<ReturnType<typeof buildServer>>;

/**
 * 서버 내부 상태 접근 (테스트·스크립트용).
 * FastifyInstance가 thenable이라 `await` 과정에서 부착한 필드의 타입이 벗겨지므로
 * 여기서 한 번만 되살린다.
 */
export function contextOf(app: ServerApp): ServerContext {
  return (app as ServerApp & { ctx: ServerContext }).ctx;
}
