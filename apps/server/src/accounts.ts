import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import type { AppDatabase } from './db';

/**
 * 정식 계정 (PLAN.md §3.1 — "정식 계정/OAuth는 Phase 5").
 *
 * 아이디/비밀번호 자체 계정만 다룬다. 소셜 로그인은 `identities` 표만 미리 깔아 두고
 * 붙이지 않았다 — 각 사에서 받은 client id/secret 과 공개 HTTPS 주소가 있어야
 * 실제로 동작하는지 확인할 수 있기 때문이다.
 *
 * 저장하는 것은 전부 해시다. 비밀번호는 scrypt(Node 내장 — 새 의존성 0),
 * 세션 토큰과 복구 코드는 SHA-256. 원문은 어디에도 남기지 않고 로그로도 찍지 않는다.
 */

// ── 비밀번호 해싱 ─────────────────────────────────────────────────────

/** N=16384·r=8 → 약 16MB·수십 ms. Node 기본 maxmem(32MB) 안에 든다. */
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

function scryptAsync(password: string, salt: Buffer, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      keylen,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
      (err, derived) => (err ? reject(err) : resolve(derived)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  // 아이디가 없을 때도 같은 시간을 쓰도록 더미 해시로 한 번 돌린다 (계정 존재 여부 노출 방지)
  const target = stored ?? DUMMY_HASH;
  const parts = target.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[4] as string, 'hex');
  const expected = Buffer.from(parts[5] as string, 'hex');
  const derived = await scryptAsync(password, salt, expected.length);
  const match = derived.length === expected.length && timingSafeEqual(derived, expected);
  return stored === null ? false : match;
}

/** 존재하지 않는 아이디에도 같은 계산 비용을 쓰기 위한 고정 해시 (값 자체는 의미 없다) */
const DUMMY_HASH = `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${'00'.repeat(16)}$${'00'.repeat(64)}`;

// ── 아이디·비밀번호 규칙 ───────────────────────────────────────────────

const LOGIN_ID_RE = /^[a-z][a-z0-9_]{3,15}$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

export function normalizeLoginId(raw: string): string {
  return raw.trim().toLowerCase();
}

/** 규칙 위반이면 사람이 읽을 사유, 통과면 null */
export function checkLoginId(loginId: string): string | null {
  if (!LOGIN_ID_RE.test(loginId)) {
    return '아이디는 영문 소문자로 시작하는 4~16자(영문·숫자·밑줄)여야 합니다';
  }
  return null;
}

export function checkPassword(password: string, loginId: string): string | null {
  const pw = password.normalize('NFKC');
  if (pw.length < PASSWORD_MIN) return `비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다`;
  if (pw.length > PASSWORD_MAX) return `비밀번호는 ${PASSWORD_MAX}자 이하여야 합니다`;
  if (pw.toLowerCase() === loginId) return '비밀번호를 아이디와 다르게 정하세요';
  return null;
}

// ── 복구 코드 ─────────────────────────────────────────────────────────

/** 헷갈리는 글자(0·O·1·I·L)를 뺀 알파벳 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** `A1B2C-D3E4F-G5H6J-K7M8N` 꼴. 화면에 딱 한 번 보여 주고 해시만 남긴다. */
export function generateRecoveryCode(): string {
  const bytes = randomBytes(20);
  const chars = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length] as string);
  return [0, 5, 10, 15].map((i) => chars.slice(i, i + 5).join('')).join('-');
}

const sha256 = (v: string): string => createHash('sha256').update(v).digest('hex');

/** 사용자가 대시·소문자를 빼먹거나 섞어 넣어도 받아들인다 */
function normalizeRecoveryCode(raw: string): string {
  const flat = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return flat.length === 20 ? [0, 5, 10, 15].map((i) => flat.slice(i, i + 5)).join('-') : flat;
}

// ── 세션 토큰 ─────────────────────────────────────────────────────────

/** 기존 게스트 토큰과 같은 모양(64자 hex)이라 프로토콜 스키마를 건드리지 않는다 */
export function issueSession(db: AppDatabase, userId: string, now = Date.now()): string {
  const token = randomBytes(32).toString('hex');
  db.prepare(
    'INSERT INTO sessions (token_hash, user_id, created_at, last_seen_at) VALUES (?, ?, ?, ?)',
  ).run(sha256(token), userId, now, now);
  return token;
}

export function revokeSession(db: AppDatabase, token: string): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

/** 비밀번호를 바꾸면 다른 기기의 세션을 전부 끊는다 (지금 쓰는 것만 남긴다) */
function revokeOtherSessions(db: AppDatabase, userId: string, keepToken: string | null): void {
  if (keepToken) {
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?').run(
      userId,
      sha256(keepToken),
    );
  } else {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  }
}

// ── 계정 조회 ─────────────────────────────────────────────────────────

export interface AccountRow {
  id: string;
  nickname: string;
  login_id: string | null;
  password_hash: string | null;
  recovery_hash: string | null;
}

export function findByLoginId(db: AppDatabase, loginId: string): AccountRow | undefined {
  return db.prepare('SELECT * FROM users WHERE login_id = ?').get(loginId) as
    | AccountRow
    | undefined;
}

export function findById(db: AppDatabase, userId: string): AccountRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as AccountRow | undefined;
}

// ── 로그인 시도 제한 ───────────────────────────────────────────────────

/**
 * 아이디별 실패 횟수를 메모리에 센다. 서버가 단일 프로세스이므로 이걸로 충분하고,
 * 재시작하면 초기화되지만 무차별 대입을 늦추는 목적에는 문제가 없다.
 */
const FAIL_THRESHOLD = 5;
const FIRST_LOCK_MS = 30_000;
const MAX_LOCK_MS = 15 * 60_000;

interface Attempt {
  fails: number;
  lockedUntil: number;
}
const attempts = new Map<string, Attempt>();

export function lockRemainingMs(loginId: string, now = Date.now()): number {
  const a = attempts.get(loginId);
  return a && a.lockedUntil > now ? a.lockedUntil - now : 0;
}

function noteFailure(loginId: string, now: number): void {
  const a = attempts.get(loginId) ?? { fails: 0, lockedUntil: 0 };
  a.fails++;
  if (a.fails >= FAIL_THRESHOLD) {
    const over = a.fails - FAIL_THRESHOLD;
    a.lockedUntil = now + Math.min(MAX_LOCK_MS, FIRST_LOCK_MS * 2 ** over);
  }
  attempts.set(loginId, a);
}

function clearFailures(loginId: string): void {
  attempts.delete(loginId);
}

/** 테스트용 — 시도 기록을 비운다 */
export function resetLoginAttempts(): void {
  attempts.clear();
}

// ── 가입 · 로그인 · 비밀번호 ───────────────────────────────────────────

export interface AccountResult {
  ok: true;
  userId: string;
  nickname: string;
  loginId: string;
  token: string;
  /** 가입·복구 직후에만 — 화면에 한 번 보여 주고 서버는 해시만 갖는다 */
  recoveryCode?: string;
}
export interface AccountFailure {
  ok: false;
  message: string;
}
export type AccountOutcome = AccountResult | AccountFailure;

/**
 * 가입. `guestUserId` 가 주어지면 그 게스트를 **승격**한다 — 같은 행에 아이디가 붙으므로
 * 엽전·전적·등급·코스메틱이 그대로 남는다. 없으면 새 계정을 만든다.
 */
export async function signUp(
  db: AppDatabase,
  input: { loginId: string; password: string; nickname: string; guestUserId?: string | null },
  now = Date.now(),
): Promise<AccountOutcome> {
  const loginId = normalizeLoginId(input.loginId);
  const idError = checkLoginId(loginId);
  if (idError) return { ok: false, message: idError };
  const pwError = checkPassword(input.password, loginId);
  if (pwError) return { ok: false, message: pwError };

  const nickname = input.nickname.trim();
  if (nickname.length === 0) return { ok: false, message: '닉네임을 입력하세요' };

  if (findByLoginId(db, loginId)) return { ok: false, message: '이미 쓰는 아이디입니다' };

  const guest = input.guestUserId ? findById(db, input.guestUserId) : undefined;
  if (guest && guest.login_id !== null) {
    return { ok: false, message: '이미 계정에 로그인되어 있습니다' };
  }

  const passwordHash = await hashPassword(input.password);
  const recoveryCode = generateRecoveryCode();
  const recoveryHash = sha256(recoveryCode);

  const userId = guest?.id ?? randomUUID();
  db.transaction(() => {
    if (guest) {
      db.prepare(
        'UPDATE users SET login_id = ?, password_hash = ?, recovery_hash = ?, nickname = ?, last_seen_at = ? WHERE id = ?',
      ).run(loginId, passwordHash, recoveryHash, nickname, now, userId);
    } else {
      db.prepare(
        `INSERT INTO users (id, nickname, login_id, password_hash, recovery_hash, created_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(userId, nickname, loginId, passwordHash, recoveryHash, now, now);
      db.prepare('INSERT INTO wallets (user_id, balance) VALUES (?, 0)').run(userId);
    }
  })();

  const token = issueSession(db, userId, now);
  return { ok: true, userId, nickname, loginId, token, recoveryCode };
}

export async function logIn(
  db: AppDatabase,
  input: { loginId: string; password: string },
  now = Date.now(),
): Promise<AccountOutcome> {
  const loginId = normalizeLoginId(input.loginId);
  const remaining = lockRemainingMs(loginId, now);
  if (remaining > 0) {
    return {
      ok: false,
      message: `로그인 시도가 많습니다. ${Math.ceil(remaining / 1000)}초 뒤에 다시 시도하세요`,
    };
  }

  const row = findByLoginId(db, loginId);
  const ok = await verifyPassword(input.password, row?.password_hash ?? null);
  if (!ok || !row) {
    noteFailure(loginId, now);
    // 아이디가 없는 것인지 비밀번호가 틀린 것인지 구분해 주지 않는다
    return { ok: false, message: '아이디 또는 비밀번호가 올바르지 않습니다' };
  }

  clearFailures(loginId);
  db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(now, row.id);
  const token = issueSession(db, row.id, now);
  return { ok: true, userId: row.id, nickname: row.nickname, loginId, token };
}

export async function changePassword(
  db: AppDatabase,
  userId: string,
  input: { current: string; next: string },
  keepToken: string | null,
  now = Date.now(),
): Promise<{ ok: true } | AccountFailure> {
  const row = findById(db, userId);
  if (!row || row.login_id === null) {
    return { ok: false, message: '게스트는 비밀번호가 없습니다' };
  }
  const pwError = checkPassword(input.next, row.login_id);
  if (pwError) return { ok: false, message: pwError };
  if (!(await verifyPassword(input.current, row.password_hash))) {
    return { ok: false, message: '지금 비밀번호가 올바르지 않습니다' };
  }

  const hash = await hashPassword(input.next);
  db.prepare('UPDATE users SET password_hash = ?, last_seen_at = ? WHERE id = ?').run(
    hash,
    now,
    userId,
  );
  revokeOtherSessions(db, userId, keepToken);
  return { ok: true };
}

/**
 * 복구 코드로 비밀번호 재설정. 코드는 **1회용**이라 성공하면 새 코드를 발급하고,
 * 이 계정의 세션을 전부 끊는다 (코드가 유출됐다면 남의 기기부터 끊어야 한다).
 */
export async function resetPassword(
  db: AppDatabase,
  input: { loginId: string; recoveryCode: string; password: string },
  now = Date.now(),
): Promise<AccountOutcome> {
  const loginId = normalizeLoginId(input.loginId);
  const remaining = lockRemainingMs(loginId, now);
  if (remaining > 0) {
    return {
      ok: false,
      message: `시도가 많습니다. ${Math.ceil(remaining / 1000)}초 뒤에 다시 시도하세요`,
    };
  }
  const pwError = checkPassword(input.password, loginId);
  if (pwError) return { ok: false, message: pwError };

  const row = findByLoginId(db, loginId);
  const given = sha256(normalizeRecoveryCode(input.recoveryCode));
  const stored = row?.recovery_hash ?? null;
  const match =
    stored !== null &&
    given.length === stored.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(stored));
  if (!row || !match) {
    noteFailure(loginId, now);
    return { ok: false, message: '아이디 또는 복구 코드가 올바르지 않습니다' };
  }

  clearFailures(loginId);
  const passwordHash = await hashPassword(input.password);
  const recoveryCode = generateRecoveryCode();
  db.prepare(
    'UPDATE users SET password_hash = ?, recovery_hash = ?, last_seen_at = ? WHERE id = ?',
  ).run(passwordHash, sha256(recoveryCode), now, row.id);
  revokeOtherSessions(db, row.id, null);

  const token = issueSession(db, row.id, now);
  return { ok: true, userId: row.id, nickname: row.nickname, loginId, token, recoveryCode };
}
