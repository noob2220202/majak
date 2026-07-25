import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * SQLite 저장소 (PLAN.md §3.1·§6.4).
 * 진행 중 대국은 서버 메모리에만 있고, 완료 대국 로그·전적·엽전 지갑만 저장한다.
 * 엽전 지급 로직은 Phase 5 — 스키마와 보상 계산 근거(인간 수·완주·순위)는 지금부터 기록.
 */
export type AppDatabase = Database.Database;

export function openDatabase(dbPath: string): AppDatabase {
  if (dbPath !== ':memory:') {
    mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db: AppDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      rules_json TEXT NOT NULL,
      seed_hash TEXT NOT NULL,
      seed TEXT,
      end_reason TEXT,
      human_count INTEGER NOT NULL,
      practice INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS game_players (
      game_id TEXT NOT NULL REFERENCES games(id),
      seat INTEGER NOT NULL,
      user_id TEXT REFERENCES users(id),
      nickname TEXT NOT NULL,
      is_bot INTEGER NOT NULL,
      -- 탈주(재접속 포기) 시 0: 보상 지급 근거 (§6.2)
      completed INTEGER NOT NULL DEFAULT 1,
      final_rank INTEGER,
      raw_score INTEGER,
      uma INTEGER,
      PRIMARY KEY (game_id, seat)
    );

    CREATE TABLE IF NOT EXISTS wallets (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      balance INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id),
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      game_id TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS unlocks (
      user_id TEXT NOT NULL REFERENCES users(id),
      item_id TEXT NOT NULL,
      PRIMARY KEY (user_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS loadouts (
      user_id TEXT NOT NULL REFERENCES users(id),
      slot TEXT NOT NULL,
      item_id TEXT NOT NULL,
      PRIMARY KEY (user_id, slot)
    );

    -- 등급·레이팅 (Phase 5): 유생 → 진사 → 급제 → 장원
    CREATE TABLE IF NOT EXISTS ratings (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      points INTEGER NOT NULL DEFAULT 0,
      games INTEGER NOT NULL DEFAULT 0
    );

    -- 레이팅 반영 이력 (gameId 기준 멱등 키)
    CREATE TABLE IF NOT EXISTS rating_log (
      user_id TEXT NOT NULL REFERENCES users(id),
      game_id TEXT NOT NULL,
      delta INTEGER NOT NULL,
      points_after INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, game_id)
    );

    CREATE INDEX IF NOT EXISTS idx_game_players_user ON game_players(user_id);
    CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger(user_id);
    CREATE INDEX IF NOT EXISTS idx_ledger_user_game ON ledger(user_id, game_id);
  `);
}
