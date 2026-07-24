import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { Server as SocketIOServer } from 'socket.io';
import { PROTOCOL_VERSION } from '@cheongiwa/protocol';

export interface BuildServerOptions {
  /** 클라 정적 파일 경로. null이면 비활성, 생략 시 자동 탐지(STATIC_DIR env → apps/client/dist) */
  staticDir?: string | null;
  logger?: boolean;
}

/** STATIC_DIR env 우선, 없으면 모노레포 내 클라 빌드 산출물을 찾는다. */
export function resolveDefaultStaticDir(): string | null {
  const fromEnv = process.env.STATIC_DIR;
  if (fromEnv) return fromEnv;
  const candidate = fileURLToPath(new URL('../../client/dist', import.meta.url));
  return existsSync(candidate) ? candidate : null;
}

/**
 * Fastify 앱 + Socket.IO 서버를 구성한다 (listen은 호출부 책임).
 * 게임 프로토콜(§3.3)은 Phase 2에서 이 위에 얹는다.
 */
export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });

  app.get('/healthz', async () => ({
    ok: true,
    service: 'cheongiwa-server',
    protocolVersion: PROTOCOL_VERSION,
  }));

  const staticDir = options.staticDir !== undefined ? options.staticDir : resolveDefaultStaticDir();
  if (staticDir) {
    await app.register(fastifyStatic, { root: staticDir });
    // SPA 폴백: 알 수 없는 GET 경로는 index.html로
    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && !request.url.startsWith('/socket.io')) {
        return reply.sendFile('index.html');
      }
      return reply.code(404).send({ error: 'not found' });
    });
  }

  const io = new SocketIOServer(app.server, { serveClient: false });
  io.on('connection', (socket) => {
    app.log.info({ socketId: socket.id }, 'socket connected');
    socket.emit('server.hello', { protocolVersion: PROTOCOL_VERSION });
    socket.on('disconnect', (reason) => {
      app.log.info({ socketId: socket.id, reason }, 'socket disconnected');
    });
  });

  app.addHook('onClose', (_instance, done) => {
    // http 서버는 fastify가 닫으므로 여기서는 소켓 연결만 정리한다
    io.disconnectSockets(true);
    io.engine.close();
    done();
  });

  return app;
}
