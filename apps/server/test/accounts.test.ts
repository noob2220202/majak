import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  changePassword,
  generateRecoveryCode,
  issueSession,
  logIn,
  resetPassword,
  resetLoginAttempts,
  revokeSession,
  signUp,
} from '../src/accounts';
import { authenticate } from '../src/auth';
import { openDatabase, type AppDatabase } from '../src/db';
import { buyItem, walletView } from '../src/shop';

/**
 * 정식 계정 (PLAN.md §3.1).
 *
 * 핵심 불변식:
 * - 게스트가 가입하면 **같은 userId** 를 이어받아 엽전·보유 코스메틱이 그대로 남는다.
 * - 비밀번호·복구 코드는 원문이 DB 어디에도 없다.
 * - 비밀번호를 바꾸면 다른 기기의 세션이 끊기고 지금 기기만 남는다.
 * - 복구 코드는 1회용이다.
 */

let db: AppDatabase;
const NOW = Date.parse('2026-07-26T12:00:00.000Z');
const PW = 'giwa-1234';

beforeEach(() => {
  db = openDatabase(':memory:');
  resetLoginAttempts();
});

afterEach(() => {
  db.close();
});

const ok = <T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> => {
  expect(r.ok, 'message' in r ? String(r.message) : '실패').toBe(true);
  return r as Extract<T, { ok: true }>;
};

describe('가입', () => {
  it('아이디·비밀번호로 계정을 만들고 바로 세션 토큰을 받는다', async () => {
    const r = ok(await signUp(db, { loginId: 'giwabot', password: PW, nickname: '기와' }, NOW));
    expect(r.loginId).toBe('giwabot');
    expect(r.token).toMatch(/^[a-f0-9]{64}$/);
    expect(r.recoveryCode).toMatch(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);

    const authed = authenticate(db, { token: r.token });
    expect(authed?.userId).toBe(r.userId);
    expect(authed?.loginId).toBe('giwabot');
  });

  it('비밀번호·복구 코드 원문은 DB 어디에도 남지 않는다', async () => {
    const r = ok(await signUp(db, { loginId: 'giwabot', password: PW, nickname: '기와' }, NOW));
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(r.userId) as Record<
      string,
      unknown
    >;
    const dumped = JSON.stringify(row);
    expect(dumped).not.toContain(PW);
    expect(dumped).not.toContain(r.recoveryCode);
    expect(String(row.password_hash)).toMatch(/^scrypt\$/);
    // 세션 토큰도 해시로만 저장된다
    const sessions = db.prepare('SELECT token_hash FROM sessions').all() as Array<{
      token_hash: string;
    }>;
    expect(sessions.map((s) => s.token_hash)).not.toContain(r.token);
  });

  it('아이디는 대소문자를 가리지 않고, 같은 아이디는 두 번 못 만든다', async () => {
    ok(await signUp(db, { loginId: 'giwabot', password: PW, nickname: '기와' }, NOW));
    const dup = await signUp(db, { loginId: 'GiwaBot', password: PW, nickname: '다른사람' }, NOW);
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.message).toContain('이미');

    const login = ok(await logIn(db, { loginId: 'GIWABOT', password: PW }, NOW));
    expect(login.loginId).toBe('giwabot');
  });

  it('아이디·비밀번호 규칙을 어기면 거부한다', async () => {
    const cases: Array<[string, string]> = [
      ['ab', PW], // 너무 짧음
      ['1giwa', PW], // 숫자로 시작
      ['giwa-bot', PW], // 허용 안 되는 문자
      ['giwabot', 'short1'], // 비밀번호 8자 미만
      ['giwabot', 'giwabot'], // 아이디와 같음
    ];
    for (const [loginId, password] of cases) {
      const r = await signUp(db, { loginId, password, nickname: '기와' }, NOW);
      expect(r.ok, `${loginId}/${password} 는 거부돼야 한다`).toBe(false);
    }
  });
});

describe('게스트 승격', () => {
  it('게스트가 가입하면 같은 계정을 이어받아 엽전·보유 코스메틱이 남는다', async () => {
    const guest = authenticate(db, { nickname: '나그네' });
    expect(guest?.loginId).toBeNull();
    const guestId = guest?.userId as string;

    db.prepare('UPDATE wallets SET balance = 2000 WHERE user_id = ?').run(guestId);
    expect(buyItem(db, guestId, 'tileBack.yeonhwa').ok).toBe(true);

    const r = ok(
      await signUp(
        db,
        { loginId: 'nageune', password: PW, nickname: '나그네', guestUserId: guestId },
        NOW,
      ),
    );
    expect(r.userId).toBe(guestId);

    const wallet = walletView(db, guestId);
    expect(wallet.balance).toBe(2000 - 800);
    expect(wallet.unlocked).toContain('tileBack.yeonhwa');
  });

  it('이미 로그인한 계정으로는 다시 가입할 수 없다', async () => {
    const r = ok(await signUp(db, { loginId: 'giwabot', password: PW, nickname: '기와' }, NOW));
    const again = await signUp(
      db,
      { loginId: 'giwabot2', password: PW, nickname: '기와', guestUserId: r.userId },
      NOW,
    );
    expect(again.ok).toBe(false);
  });
});

describe('로그인', () => {
  beforeEach(async () => {
    ok(await signUp(db, { loginId: 'giwabot', password: PW, nickname: '기와' }, NOW));
  });

  it('비밀번호가 틀리면 아이디 존재 여부를 알려 주지 않는다', async () => {
    const wrongPw = await logIn(db, { loginId: 'giwabot', password: 'wrong-password' }, NOW);
    const noSuchId = await logIn(db, { loginId: 'nosuchid', password: PW }, NOW);
    expect(wrongPw.ok).toBe(false);
    expect(noSuchId.ok).toBe(false);
    if (!wrongPw.ok && !noSuchId.ok) expect(wrongPw.message).toBe(noSuchId.message);
  });

  it('연속 실패하면 잠시 잠그고, 성공하면 실패 기록이 지워진다', async () => {
    for (let i = 0; i < 5; i++) {
      await logIn(db, { loginId: 'giwabot', password: 'wrong-password' }, NOW);
    }
    const locked = await logIn(db, { loginId: 'giwabot', password: PW }, NOW);
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.message).toContain('시도가 많습니다');

    // 잠금이 풀린 뒤에는 올바른 비밀번호로 들어갈 수 있다
    const later = ok(await logIn(db, { loginId: 'giwabot', password: PW }, NOW + 60_000));
    expect(later.userId).toBeTruthy();
    // 실패 기록이 지워졌으므로 곧바로 또 로그인해도 잠기지 않는다
    ok(await logIn(db, { loginId: 'giwabot', password: PW }, NOW + 60_001));
  });

  it('기기마다 다른 토큰을 받아 동시에 접속할 수 있다', async () => {
    const a = ok(await logIn(db, { loginId: 'giwabot', password: PW }, NOW));
    const b = ok(await logIn(db, { loginId: 'giwabot', password: PW }, NOW + 1));
    expect(a.token).not.toBe(b.token);
    expect(authenticate(db, { token: a.token })?.userId).toBe(a.userId);
    expect(authenticate(db, { token: b.token })?.userId).toBe(a.userId);

    revokeSession(db, a.token);
    expect(authenticate(db, { token: a.token })).toBeNull();
    expect(authenticate(db, { token: b.token })?.userId).toBe(a.userId);
  });
});

describe('비밀번호 변경', () => {
  it('바꾸면 다른 기기 세션은 끊기고 지금 기기만 남는다', async () => {
    const first = ok(await signUp(db, { loginId: 'giwabot', password: PW, nickname: '기와' }, NOW));
    const other = ok(await logIn(db, { loginId: 'giwabot', password: PW }, NOW + 1));

    const changed = await changePassword(
      db,
      first.userId,
      { current: PW, next: 'newpass-9876' },
      first.token,
      NOW + 2,
    );
    expect(changed.ok).toBe(true);

    expect(authenticate(db, { token: first.token })?.userId).toBe(first.userId);
    expect(authenticate(db, { token: other.token })).toBeNull();

    resetLoginAttempts();
    expect((await logIn(db, { loginId: 'giwabot', password: PW }, NOW + 3)).ok).toBe(false);
    ok(await logIn(db, { loginId: 'giwabot', password: 'newpass-9876' }, NOW + 60_000));
  });

  it('지금 비밀번호가 틀리면 거부한다', async () => {
    const r = ok(await signUp(db, { loginId: 'giwabot', password: PW, nickname: '기와' }, NOW));
    const bad = await changePassword(
      db,
      r.userId,
      { current: 'not-the-password', next: 'newpass-9876' },
      r.token,
      NOW + 1,
    );
    expect(bad.ok).toBe(false);
  });

  it('게스트에게는 바꿀 비밀번호가 없다', async () => {
    const guest = authenticate(db, { nickname: '나그네' });
    const r = await changePassword(
      db,
      guest?.userId as string,
      { current: 'x', next: 'newpass-9876' },
      null,
      NOW,
    );
    expect(r.ok).toBe(false);
  });
});

describe('복구 코드', () => {
  it('한 번 쓰면 새 코드로 갈리고 옛 코드는 안 먹는다', async () => {
    const r = ok(await signUp(db, { loginId: 'giwabot', password: PW, nickname: '기와' }, NOW));
    const code = r.recoveryCode as string;

    const reset = ok(
      await resetPassword(
        db,
        { loginId: 'giwabot', recoveryCode: code, password: 'recovered-1' },
        NOW + 1,
      ),
    );
    expect(reset.userId).toBe(r.userId);
    expect(reset.recoveryCode).toBeTruthy();
    expect(reset.recoveryCode).not.toBe(code);

    // 옛 코드 재사용 불가
    const again = await resetPassword(
      db,
      { loginId: 'giwabot', recoveryCode: code, password: 'recovered-2' },
      NOW + 2,
    );
    expect(again.ok).toBe(false);

    // 재설정 뒤에는 모든 기기가 끊긴다 (새로 받은 토큰만 유효)
    expect(authenticate(db, { token: r.token })).toBeNull();
    expect(authenticate(db, { token: reset.token })?.userId).toBe(r.userId);
  });

  it('대시·소문자를 섞어 넣어도 받아 준다', async () => {
    const r = ok(await signUp(db, { loginId: 'giwabot', password: PW, nickname: '기와' }, NOW));
    const messy = (r.recoveryCode as string).replace(/-/g, '').toLowerCase();
    expect(
      (
        await resetPassword(
          db,
          { loginId: 'giwabot', recoveryCode: messy, password: 'recovered-1' },
          NOW + 1,
        )
      ).ok,
    ).toBe(true);
  });

  it('발급 코드는 매번 다르다', () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateRecoveryCode()));
    expect(codes.size).toBe(200);
  });
});

describe('옛 DB 승격', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'cheongiwa-legacy-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('users.token_hash 시절 DB를 열면 게스트 토큰이 그대로 살아 있다', () => {
    const file = path.join(dir, 'legacy.db');
    const legacyToken = 'a'.repeat(64);
    // 계정 도입 전 스키마를 손으로 만든다 (users 에 token_hash, sessions 없음)
    const legacy = new Database(file);
    legacy.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        nickname TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL
      );
      CREATE TABLE wallets (user_id TEXT PRIMARY KEY REFERENCES users(id), balance INTEGER NOT NULL DEFAULT 0);
    `);
    const hash = createHash('sha256').update(legacyToken).digest('hex');
    legacy
      .prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?)')
      .run('old-user', '옛사람', hash, NOW, NOW);
    legacy.prepare('INSERT INTO wallets VALUES (?, ?)').run('old-user', 1234);
    legacy.close();

    const upgraded = openDatabase(file);
    try {
      const authed = authenticate(upgraded, { token: legacyToken });
      expect(authed?.userId).toBe('old-user');
      expect(authed?.nickname).toBe('옛사람');
      expect(authed?.loginId).toBeNull();
      expect(walletView(upgraded, 'old-user').balance).toBe(1234);
      // 승격 뒤에는 그 게스트가 그대로 가입할 수 있다
      expect(issueSession(upgraded, 'old-user', NOW)).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      upgraded.close();
    }
  });
});
