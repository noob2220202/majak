import type { RankTier, RankView } from '@cheongiwa/protocol';
import type { AppDatabase } from './db';
import type { SessionEndSummary } from './session';

/**
 * 등급·레이팅 (PLAN.md §7 Phase 5 — 한국식 명칭: 유생 → 진사 → 급제 → 장원).
 *
 * 순위로만 오르내리는 단순한 누적 점수제. 상위 등급일수록 하위 순위 페널티가 커져
 * 승단이 유지되기 어렵게 만든다. 봇 대국·연습은 반영하지 않는다.
 */

interface TierSpec {
  tier: RankTier;
  /** 이 등급의 시작 점수 */
  floor: number;
  /** 등급 내 단계 수 */
  levels: number;
  /** 단계당 점수 폭 */
  span: number;
  /** 순위별 증감 (1~4위) */
  delta: [number, number, number, number];
}

export const TIERS: TierSpec[] = [
  { tier: '유생', floor: 0, levels: 3, span: 300, delta: [60, 25, 0, -15] },
  { tier: '진사', floor: 900, levels: 3, span: 400, delta: [60, 20, -10, -35] },
  { tier: '급제', floor: 2100, levels: 3, span: 500, delta: [55, 15, -20, -55] },
  { tier: '장원', floor: 3600, levels: 1, span: 1000, delta: [50, 10, -30, -70] },
];

/** 등급은 강등되지 않도록 각 등급의 바닥을 하한으로 둔다 (하위 단계로는 내려감) */
function specFor(points: number): TierSpec {
  let found = TIERS[0] as TierSpec;
  for (const spec of TIERS) if (points >= spec.floor) found = spec;
  return found;
}

export function rankViewOf(points: number, games: number): RankView {
  const spec = specFor(points);
  const within = points - spec.floor;
  const level = Math.min(spec.levels, Math.floor(within / spec.span) + 1);
  const isTop = spec.tier === TIERS[TIERS.length - 1]?.tier;
  const nextFloor = isTop ? null : (TIERS[TIERS.indexOf(spec) + 1] as TierSpec).floor;
  return {
    points,
    tier: spec.tier,
    level,
    toNext: nextFloor === null ? null : Math.max(0, nextFloor - points),
    games,
  };
}

function ensureRow(db: AppDatabase, userId: string): { points: number; games: number } {
  db.prepare('INSERT OR IGNORE INTO ratings (user_id, points, games) VALUES (?, 0, 0)').run(userId);
  return db.prepare('SELECT points, games FROM ratings WHERE user_id = ?').get(userId) as {
    points: number;
    games: number;
  };
}

export function rankOf(db: AppDatabase, userId: string): RankView {
  const row = ensureRow(db, userId);
  return rankViewOf(row.points, row.games);
}

/** 이 대국의 레이팅을 이미 반영했는가 (멱등) */
function alreadyRated(db: AppDatabase, userId: string, gameId: string): boolean {
  return (
    db
      .prepare('SELECT 1 FROM rating_log WHERE user_id = ? AND game_id = ? LIMIT 1')
      .get(userId, gameId) !== undefined
  );
}

/**
 * 대국 결과를 레이팅에 반영한다 (§6.2와 같은 조건: 인간 2인 이상·연습 아님·완주).
 * userId별 갱신된 등급을 돌려준다.
 */
export function applyGameRatings(
  db: AppDatabase,
  summary: SessionEndSummary,
  now = Date.now(),
): Map<string, RankView> {
  const out = new Map<string, RankView>();
  const humans = summary.seats.filter((s) => !s.isBot);
  if (summary.practice || humans.length < 2) return out;

  const standings = summary.game.standings ?? [];
  for (const seat of humans) {
    const userId = seat.userId;
    if (!userId || !seat.completed) continue;
    if (alreadyRated(db, userId, summary.gameId)) continue;
    const standing = standings.find((s) => s.seat === seat.seat);
    if (!standing) continue;

    const before = ensureRow(db, userId);
    const spec = specFor(before.points);
    const raw = spec.delta[standing.rank - 1] ?? 0;
    // 동풍전은 절반 반영 (짧은 대국의 분산 보정)
    const delta = summary.rules.gameLength === 'hanchan' ? raw : Math.round(raw / 2);
    const points = Math.max(0, before.points + delta);

    const tx = db.transaction(() => {
      db.prepare('UPDATE ratings SET points = ?, games = games + 1 WHERE user_id = ?').run(
        points,
        userId,
      );
      db.prepare(
        'INSERT INTO rating_log (user_id, game_id, delta, points_after, created_at) VALUES (?, ?, ?, ?, ?)',
      ).run(userId, summary.gameId, delta, points, now);
    });
    tx();

    out.set(userId, rankViewOf(points, before.games + 1));
  }
  return out;
}
