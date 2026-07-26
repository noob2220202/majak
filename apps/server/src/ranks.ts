import type { RankTier, RankView } from '@cheongiwa/protocol';
import type { AppDatabase } from './db';
import type { SessionEndSummary } from './session';

/**
 * 등급·실력 점수 (PLAN.md §7 Phase 5 — 한국식 명칭: 유생 → 진사 → 급제 → 장원).
 *
 * 값이 **두 개**다. 하는 일이 다르기 때문이다.
 *
 *  - **등급 점수(points)**: 오르기만 한다. 승단은 성취 표시이므로 강등이 없어야
 *    계속 둘 마음이 든다. 등급 안은 9급에서 1급으로 내려가고(바둑·태권도와 같은
 *    방향), 최고 등급인 장원만 1단부터 올라간다.
 *  - **실력 점수(rating)**: 오르내린다. 비슷한 실력끼리 붙이는 데 쓰는 값이라
 *    실제 실력을 따라가야 하고, 오르기만 하면 매칭 기준으로 못 쓴다.
 *
 * 둘 다 봇 대국·연습은 반영하지 않는다.
 */

interface TierSpec {
  tier: RankTier;
  /** 이 등급의 시작 점수 */
  floor: number;
  /** 등급 안 단계 수 */
  steps: number;
  /** 한 단계 폭 */
  span: number;
  /** 순위별 등급 점수 증감 (1~4위) */
  delta: [number, number, number, number];
}

/**
 * 상위 등급일수록 하위 순위 페널티가 커져 승단이 유지되기 어렵다.
 * 급수 9칸씩이라 등급 하나를 통과하려면 `span × 9` 점이 필요하다.
 */
export const TIERS: TierSpec[] = [
  { tier: '유생', floor: 0, steps: 9, span: 100, delta: [60, 25, 0, -15] },
  { tier: '진사', floor: 900, steps: 9, span: 150, delta: [60, 20, -10, -35] },
  { tier: '급제', floor: 2250, steps: 9, span: 200, delta: [55, 15, -20, -55] },
  { tier: '장원', floor: 4050, steps: 9, span: 400, delta: [50, 10, -30, -70] },
];

/** 등급은 강등되지 않도록 각 등급의 바닥을 하한으로 둔다 (등급 안 단계는 내려감) */
function specFor(points: number): TierSpec {
  let found = TIERS[0] as TierSpec;
  for (const spec of TIERS) if (points >= spec.floor) found = spec;
  return found;
}

const isTopTier = (spec: TierSpec): boolean => spec.tier === TIERS[TIERS.length - 1]?.tier;

// ── 실력 점수 ─────────────────────────────────────────────────────────

/** 처음 앉는 자리 — 매칭이 여기부터 갈라진다 */
export const INITIAL_RATING = 1500;
/** 이 국까지는 배치 대국으로 보고 점수가 크게 움직인다 */
export const PLACEMENT_GAMES = 5;
/** 아무리 져도 이 밑으로는 안 내려간다 (매칭 폭이 무의미해질 만큼 벌어지는 것 방지) */
const RATING_FLOOR = 500;

/** 4인 반장 순위점. 동풍전은 분산이 커서 줄인다 */
const RANK_POINTS: readonly [number, number, number, number] = [30, 10, -10, -30];

/**
 * 실력 점수 증감.
 *
 * `순위점 + (평균 상대 점수 − 내 점수) / 40` — 나보다 센 사람들 사이에서 이기면
 * 더 오르고, 약한 사람들 사이에서 지면 더 깎인다. 여기에 대국 수가 쌓일수록
 * 작아지는 보정계수를 곱해 점수가 실력에 수렴하게 한다.
 */
export function ratingDelta(input: {
  rating: number;
  opponentAvg: number;
  /** 1~4 */
  rank: number;
  /** 이 대국 **전까지** 둔 대국 수 */
  games: number;
  hanchan: boolean;
}): number {
  const base = RANK_POINTS[input.rank - 1] ?? 0;
  const gap = (input.opponentAvg - input.rating) / 40;
  // 배치 구간은 그대로, 이후 400국까지 서서히 줄어 0.2에서 멈춘다
  const settle = input.games < 400 ? 1 - input.games * 0.002 : 0.2;
  const raw = (base + gap) * settle * (input.hanchan ? 1 : 0.8);
  return Math.round(raw * 10) / 10;
}

// ── 표시용 뷰 ─────────────────────────────────────────────────────────

export function rankViewOf(points: number, games: number, rating: number): RankView {
  const spec = specFor(points);
  const within = points - spec.floor;
  const step = Math.min(spec.steps, Math.floor(within / spec.span) + 1); // 1..steps
  const top = isTopTier(spec);

  // 유생~급제는 9급 → 1급으로 내려가고, 장원만 1단 → 9단으로 올라간다
  const grade = top ? null : spec.steps - step + 1;
  const dan = top ? step : null;
  const label = top ? `${spec.tier} ${dan}단` : `${spec.tier} ${grade}급`;

  const atCeiling = top && step === spec.steps;
  const nextStepAt = spec.floor + step * spec.span;
  const toNext = atCeiling ? null : Math.max(0, nextStepAt - points);

  return {
    points,
    tier: spec.tier,
    grade,
    dan,
    label,
    toNext,
    games,
    rating: Math.round(rating * 10) / 10,
    placementLeft: Math.max(0, PLACEMENT_GAMES - games),
  };
}

interface RatingRow {
  points: number;
  games: number;
  rating: number;
}

function ensureRow(db: AppDatabase, userId: string): RatingRow {
  db.prepare(
    'INSERT OR IGNORE INTO ratings (user_id, points, games, rating) VALUES (?, 0, 0, ?)',
  ).run(userId, INITIAL_RATING);
  return db.prepare('SELECT points, games, rating FROM ratings WHERE user_id = ?').get(userId) as
    RatingRow;
}

export function rankOf(db: AppDatabase, userId: string): RankView {
  const row = ensureRow(db, userId);
  return rankViewOf(row.points, row.games, row.rating);
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
 * 대국 결과를 등급·실력 점수에 반영한다 (§6.2와 같은 조건: 인간 2인 이상·연습 아님·완주).
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
  const hanchan = summary.rules.gameLength === 'hanchan';

  // 대국 **전** 점수를 먼저 전부 읽어 둔다. 한 명씩 갱신하면서 계산하면
  // 뒤에 처리되는 사람이 이미 바뀐 상대 점수를 보게 되어 순서에 따라 결과가 달라진다.
  const before = new Map<string, RatingRow>();
  for (const seat of humans) {
    if (!seat.userId || !seat.completed) continue;
    if (!standings.some((s) => s.seat === seat.seat)) continue;
    before.set(seat.userId, ensureRow(db, seat.userId));
  }
  if (before.size === 0) return out;

  for (const [userId, row] of before) {
    if (alreadyRated(db, userId, summary.gameId)) continue;
    const seat = humans.find((s) => s.userId === userId);
    const standing = standings.find((s) => s.seat === seat?.seat);
    if (!seat || !standing) continue;

    // 등급 점수 — 순위만 본다
    const spec = specFor(row.points);
    const rawDelta = spec.delta[standing.rank - 1] ?? 0;
    // 동풍전은 절반 반영 (짧은 대국의 분산 보정)
    const delta = hanchan ? rawDelta : Math.round(rawDelta / 2);
    const points = Math.max(0, row.points + delta);

    // 실력 점수 — 상대의 세기를 함께 본다
    const others = [...before.entries()].filter(([id]) => id !== userId).map(([, r]) => r.rating);
    const opponentAvg =
      others.length > 0 ? others.reduce((a, b) => a + b, 0) / others.length : INITIAL_RATING;
    const rDelta = ratingDelta({
      rating: row.rating,
      opponentAvg,
      rank: standing.rank,
      games: row.games,
      hanchan,
    });
    const rating = Math.max(RATING_FLOOR, Math.round((row.rating + rDelta) * 10) / 10);

    db.transaction(() => {
      db.prepare(
        'UPDATE ratings SET points = ?, games = games + 1, rating = ? WHERE user_id = ?',
      ).run(points, rating, userId);
      db.prepare(
        `INSERT INTO rating_log (user_id, game_id, delta, points_after, rating_delta, rating_after, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(userId, summary.gameId, delta, points, rDelta, rating, now);
    })();

    out.set(userId, rankViewOf(points, row.games + 1, rating));
  }
  return out;
}
