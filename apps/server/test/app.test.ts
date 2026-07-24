import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION } from '@cheongiwa/protocol';
import { buildServer } from '../src/app';

describe('buildServer', () => {
  it('healthz가 서비스 정보와 프로토콜 버전을 반환한다', async () => {
    const app = await buildServer({ staticDir: null, dbPath: ':memory:' });
    try {
      const res = await app.inject({ method: 'GET', url: '/healthz' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        ok: true,
        service: 'cheongiwa-server',
        protocolVersion: PROTOCOL_VERSION,
      });
    } finally {
      await app.close();
    }
  });

  it('정적 서빙 비활성 시 알 수 없는 경로는 404 JSON', async () => {
    const app = await buildServer({ staticDir: null, dbPath: ':memory:' });
    try {
      const res = await app.inject({ method: 'GET', url: '/nope' });
      expect(res.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});
