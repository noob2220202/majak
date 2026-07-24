import type { AppDatabase } from './db';
import type { SessionEndSummary } from './session';

/**
 * 완료 대국 저장 (PLAN.md §3.1·§6.4).
 * 보상 계산 근거(인간 수·완주 여부·최종 순위)를 남긴다 — 엽전 지급은 Phase 5.
 * gameId 기준 멱등 (§6.2 이중 지급 방지 전제).
 */
export function persistGame(db: AppDatabase, summary: SessionEndSummary): void {
  const now = Date.now();
  const humanCount = summary.seats.filter((s) => !s.isBot).length;

  const insertGame = db.prepare(
    `INSERT OR IGNORE INTO games
      (id, started_at, ended_at, rules_json, seed_hash, seed, end_reason, human_count, practice, completed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
  );
  const insertPlayer = db.prepare(
    `INSERT OR IGNORE INTO game_players
      (game_id, seat, user_id, nickname, is_bot, completed, final_rank, raw_score, uma)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const standings = summary.game.standings ?? [];
  const tx = db.transaction(() => {
    insertGame.run(
      summary.gameId,
      now,
      now,
      JSON.stringify(summary.rules),
      summary.seedHash,
      summary.seed,
      summary.game.endReason ?? 'finished',
      humanCount,
      summary.practice ? 1 : 0,
    );
    for (const seat of summary.seats) {
      const standing = standings.find((st) => st.seat === seat.seat);
      insertPlayer.run(
        summary.gameId,
        seat.seat,
        seat.userId,
        seat.nickname,
        seat.isBot ? 1 : 0,
        seat.completed ? 1 : 0,
        standing?.rank ?? null,
        standing?.rawScore ?? null,
        standing?.uma ?? null,
      );
    }
  });
  tx();
}
