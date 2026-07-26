import type { PlayerStats } from '@cheongiwa/protocol';
import { createHash, randomUUID } from 'node:crypto';
import { issueSession } from './accounts';
import type { AppDatabase } from './db';

/**
 * 접속 인증 (PLAN.md §3.1).
 *
 * 두 갈래다.
 *  - **게스트**: 닉네임만 받아 계정 없이 바로 입장. `users.login_id` 가 NULL 이다.
 *  - **세션 토큰**: 게스트든 정식 계정이든 재접속은 이 토큰 하나로 처리한다.
 *
 * 아이디/비밀번호 가입·로그인은 `accounts.ts` 가 맡는다.
 */

export interface AuthedUser {
  userId: string;
  nickname: string;
  /** 게스트면 null */
  loginId: string | null;
  /** 신규 발급 시에만 존재 */
  issuedToken?: string;
}

const sha256 = (v: string): string => createHash('sha256').update(v).digest('hex');

interface SessionRow {
  id: string;
  nickname: string;
  login_id: string | null;
}

export function authenticate(
  db: AppDatabase,
  input: { nickname?: string; token?: string },
): AuthedUser | null {
  const now = Date.now();
  if (input.token) {
    // 세션 표가 유일한 진실이다 — 비밀번호를 바꾸면 그 행들이 지워지므로 여기서 걸린다
    const row = db
      .prepare(
        `SELECT u.id, u.nickname, u.login_id
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ?`,
      )
      .get(sha256(input.token)) as SessionRow | undefined;
    if (!row) return null;
    // 닉네임은 서버 기록이 기준이다 — 다른 기기에서 바꾼 이름을 옛 기기가 되돌리면 안 된다
    db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(now, row.id);
    db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?').run(
      now,
      sha256(input.token),
    );
    return { userId: row.id, nickname: row.nickname, loginId: row.login_id };
  }

  const nickname = input.nickname?.trim();
  if (!nickname) return null;
  const userId = randomUUID();
  db.transaction(() => {
    db.prepare(
      'INSERT INTO users (id, nickname, created_at, last_seen_at) VALUES (?, ?, ?, ?)',
    ).run(userId, nickname, now, now);
    db.prepare('INSERT INTO wallets (user_id, balance) VALUES (?, 0)').run(userId);
  })();
  const token = issueSession(db, userId, now);
  return { userId, nickname, loginId: null, issuedToken: token };
}

export function statsOf(db: AppDatabase, userId: string): PlayerStats {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS games,
              SUM(CASE WHEN final_rank = 1 THEN 1 ELSE 0 END) AS top1,
              AVG(final_rank) AS avgRank
       FROM game_players gp JOIN games g ON g.id = gp.game_id
       WHERE gp.user_id = ? AND g.completed = 1 AND g.practice = 0`,
    )
    .get(userId) as { games: number; top1: number | null; avgRank: number | null };
  return {
    games: row.games,
    top1: row.top1 ?? 0,
    avgRank: row.avgRank === null ? null : Math.round(row.avgRank * 100) / 100,
  };
}
