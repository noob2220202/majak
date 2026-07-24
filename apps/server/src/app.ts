import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import { z } from 'zod';
import type { RoundAction } from '@cheongiwa/engine';
import {
  AuthHelloSchema,
  AutoSettingsSchema,
  FillAcceptSchema,
  GameActionSchema,
  PROTOCOL_VERSION,
  RoomCodeSchema,
  RoomReadySchema,
  RuleSettingsSchema,
  type AuthWelcome,
  type ServerErrorView,
} from '@cheongiwa/protocol';
import { authenticate, statsOf } from './auth';
import { openDatabase, type AppDatabase } from './db';
import { DEFAULT_MATCHMAKING, Matchmaking, type MatchmakingOptions } from './matchmaking';
import { persistGame } from './records';
import { RoomManager } from './rooms';
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

  const launchSession = (
    seats: SessionSeatInit[],
    rules: unknown,
    practice: boolean,
  ): GameSession => {
    const session = new GameSession(
      io,
      seats,
      RuleSettingsSchema.parse(rules ?? {}),
      { ...sessionOptions, practice },
      (summary) => {
        persistGame(db, summary);
        sessions.delete(summary.gameId);
        for (const seat of summary.seats) {
          if (seat.userId && sessionByUser.get(seat.userId) === summary.gameId) {
            sessionByUser.delete(seat.userId);
          }
        }
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

  io.on('connection', (socket) => {
    const data: SocketData = { userId: null, nickname: '' };
    socket.emit('server.hello', { protocolVersion: PROTOCOL_VERSION });

    const requireAuth = (): string | null => {
      if (!data.userId) {
        sendError(socket, 'UNAUTHENTICATED', '먼저 auth.hello로 인증하세요');
        return null;
      }
      return data.userId;
    };

    /** zod 검증 + 에러 통일 래퍼 */
    const on = <S extends z.ZodTypeAny>(
      event: string,
      schema: S | null,
      handler: (payload: z.infer<S>) => void,
    ): void => {
      socket.on(event, (raw: unknown) => {
        try {
          const payload = schema ? schema.parse(raw ?? {}) : (undefined as z.infer<S>);
          handler(payload);
        } catch (error) {
          if (error instanceof z.ZodError) {
            sendError(socket, 'BAD_REQUEST', `${event}: 잘못된 요청`);
          } else {
            sendError(
              socket,
              'BAD_REQUEST',
              error instanceof Error ? error.message : '요청 처리 실패',
            );
          }
        }
      });
    };

    on('auth.hello', AuthHelloSchema, (payload) => {
      const authed = authenticate(db, payload);
      if (!authed) {
        sendError(socket, 'UNAUTHENTICATED', '유효하지 않은 토큰입니다');
        return;
      }
      data.userId = authed.userId;
      data.nickname = authed.nickname;

      // 진행 중 대국 재접속 바인딩
      const activeId = sessionByUser.get(authed.userId) ?? null;
      let activeGameId: string | null = null;
      if (activeId) {
        const session = sessions.get(activeId);
        if (session && !session.isEnded && session.rebind(authed.userId, socket) !== null) {
          activeGameId = activeId;
        }
      }

      const welcome: AuthWelcome = {
        userId: authed.userId,
        nickname: authed.nickname,
        stats: statsOf(db, authed.userId),
        activeGameId,
      };
      if (authed.issuedToken) welcome.token = authed.issuedToken;
      socket.emit('auth.welcome', welcome);
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
