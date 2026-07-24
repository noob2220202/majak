import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PlayerStats } from '@cheongiwa/protocol';
import type { AppDatabase } from './db';

/**
 * 게스트 인증 (PLAN.md §3.1): 닉네임 → 세션 토큰 발급 (클라 localStorage 보관).
 * 토큰은 해시로만 저장한다. 정식 계정/OAuth는 Phase 5.
 */

export interface AuthedUser {
  userId: string;
  nickname: string;
  /** 신규 발급 시에만 존재 */
  issuedToken?: string;
}

const sha256 = (v: string): string => createHash('sha256').update(v).digest('hex');

interface UserRow {
  id: string;
  nickname: string;
}

export function authenticate(
  db: AppDatabase,
  input: { nickname?: string; token?: string },
): AuthedUser | null {
  const now = Date.now();
  if (input.token) {
    const row = db
      .prepare('SELECT id, nickname FROM users WHERE token_hash = ?')
      .get(sha256(input.token)) as UserRow | undefined;
    if (!row) return null;
    const nickname = input.nickname?.trim() || row.nickname;
    db.prepare('UPDATE users SET last_seen_at = ?, nickname = ? WHERE id = ?').run(
      now,
      nickname,
      row.id,
    );
    return { userId: row.id, nickname };
  }

  const nickname = input.nickname?.trim();
  if (!nickname) return null;
  const token = randomBytes(32).toString('hex');
  const userId = randomUUID();
  db.prepare(
    'INSERT INTO users (id, nickname, token_hash, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)',
  ).run(userId, nickname, sha256(token), now, now);
  db.prepare('INSERT INTO wallets (user_id, balance) VALUES (?, 0)').run(userId);
  return { userId, nickname, issuedToken: token };
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
