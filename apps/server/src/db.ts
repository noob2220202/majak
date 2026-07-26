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
  // 옛 스키마를 먼저 걷어내야 아래 CREATE 들과 모양이 맞는다
  upgradeLegacyUsers(db);
  upgradeLegacyRatings(db);
  migrate(db);
  return db;
}

/** users 가 옛 모양(token_hash 칸)인지 */
function isLegacyUsers(db: AppDatabase): boolean {
  const cols = db.pragma('table_info(users)') as Array<{ name: string }>;
  return cols.length > 0 && cols.some((c) => c.name === 'token_hash');
}

/**
 * 정식 계정 도입 (PLAN.md §3.1 "정식 계정은 Phase 5") 이전 DB 승격.
 *
 * 세션 토큰이 `users.token_hash` 한 칸에 있으면 계정당 기기가 하나뿐이라
 * (휴대폰에서 로그인하면 데스크톱이 끊긴다) 별도 `sessions` 표로 뺀다.
 * NOT NULL UNIQUE 제약은 ALTER 로 못 푸므로 users 를 통째로 재구축한다.
 * 기존 게스트는 토큰째 옮겨 재접속이 끊기지 않는다.
 */
function upgradeLegacyUsers(db: AppDatabase): void {
  if (!isLegacyUsers(db)) return;

  // 외래키가 users 를 참조하므로 재구축 동안만 끈다 (트랜잭션 안에서는 무시되는 PRAGMA다)
  db.pragma('foreign_keys = OFF');
  db.transaction(() => {
    db.exec(`
      CREATE TABLE users_v1 (
        id TEXT PRIMARY KEY,
        nickname TEXT NOT NULL,
        login_id TEXT UNIQUE,
        password_hash TEXT,
        recovery_hash TEXT,
        created_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL
      );

      INSERT INTO users_v1 (id, nickname, login_id, password_hash, recovery_hash,
                            created_at, last_seen_at)
        SELECT id, nickname, NULL, NULL, NULL, created_at, last_seen_at FROM users;

      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        created_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL
      );

      INSERT OR IGNORE INTO sessions (token_hash, user_id, created_at, last_seen_at)
        SELECT token_hash, id, created_at, last_seen_at FROM users;

      DROP TABLE users;
      ALTER TABLE users_v1 RENAME TO users;
    `);
  })();
  db.pragma('foreign_keys = ON');

  const broken = db.pragma('foreign_key_check') as unknown[];
  if (broken.length > 0) {
    throw new Error(`계정 마이그레이션 후 외래키 위반 ${broken.length}건`);
  }
}

/**
 * 등급을 티어 + MMR 하나로 단일화하기 전 DB 승격.
 *
 * 예전에는 오르기만 하는 등급 점수(points)와 매칭용 실력 점수(rating)를 따로 뒀는데,
 * 겉으로 보이는 것을 티어 하나로 줄이면서 points 는 쓸 곳이 없어졌다. SQLite 는
 * 칸을 지우려면 표를 다시 만들어야 하므로 rating·games 만 옮겨 담는다.
 */
function upgradeLegacyRatings(db: AppDatabase): void {
  const cols = db.pragma('table_info(ratings)') as Array<{ name: string }>;
  if (cols.length === 0 || !cols.some((c) => c.name === 'points')) return;
  const hadRating = cols.some((c) => c.name === 'rating');

  db.pragma('foreign_keys = OFF');
  db.transaction(() => {
    db.exec(`
      CREATE TABLE ratings_v1 (
        user_id TEXT PRIMARY KEY REFERENCES users(id),
        games INTEGER NOT NULL DEFAULT 0,
        rating REAL NOT NULL DEFAULT 1500
      );
      INSERT INTO ratings_v1 (user_id, games, rating)
        SELECT user_id, games, ${hadRating ? 'rating' : '1500'} FROM ratings;
      DROP TABLE ratings;
      ALTER TABLE ratings_v1 RENAME TO ratings;

      -- 이력은 등급 점수 기준이라 더 못 읽는다. 멱등 키(user_id, game_id)만 남긴다.
      CREATE TABLE rating_log_v1 (
        user_id TEXT NOT NULL REFERENCES users(id),
        game_id TEXT NOT NULL,
        delta REAL NOT NULL,
        rating_after REAL NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, game_id)
      );
      INSERT INTO rating_log_v1 (user_id, game_id, delta, rating_after, created_at)
        SELECT user_id, game_id, 0, 1500, created_at FROM rating_log;
      DROP TABLE rating_log;
      ALTER TABLE rating_log_v1 RENAME TO rating_log;
    `);
  })();
  db.pragma('foreign_keys = ON');
}

function migrate(db: AppDatabase): void {
  db.exec(`
    -- 게스트는 login_id 가 NULL 이다. 가입하면 같은 행에 아이디·비밀번호가 붙어
    -- 엽전·전적·등급·코스메틱을 그대로 이어받는다.
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      -- 소문자로만 저장해 대소문자 구분 없이 유일하다
      login_id TEXT UNIQUE,
      password_hash TEXT,
      -- 이메일이 없으므로 비밀번호 분실 대비는 1회용 복구 코드다 (해시로만 보관)
      recovery_hash TEXT,
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL
    );

    -- 기기별 세션 토큰. 계정 하나가 여러 기기에서 동시에 접속할 수 있다.
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL
    );

    -- 소셜 로그인(구글·카카오·네이버)을 나중에 붙일 자리. 지금은 비어 있다.
    CREATE TABLE IF NOT EXISTS identities (
      provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL,
      PRIMARY KEY (provider, provider_user_id)
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

    -- 등급 (§3.2): 안쪽 숫자는 MMR 하나뿐이고 티어·급수는 그 구간의 이름이다.
    -- MMR 은 서버 밖으로 나가지 않는다 — 매칭과 등락 계산에만 쓴다.
    CREATE TABLE IF NOT EXISTS ratings (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      games INTEGER NOT NULL DEFAULT 0,
      rating REAL NOT NULL DEFAULT 1500
    );

    -- 반영 이력 (gameId 기준 멱등 키)
    CREATE TABLE IF NOT EXISTS rating_log (
      user_id TEXT NOT NULL REFERENCES users(id),
      game_id TEXT NOT NULL,
      delta REAL NOT NULL,
      rating_after REAL NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, game_id)
    );

    CREATE INDEX IF NOT EXISTS idx_game_players_user ON game_players(user_id);
    CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger(user_id);
    CREATE INDEX IF NOT EXISTS idx_ledger_user_game ON ledger(user_id, game_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  `);
}

