import type { RankTier, RankView } from '@cheongiwa/protocol';
import type { AppDatabase } from './db';
import type { SessionEndSummary } from './session';

/**
 * 등급 (PLAN.md §3.2·§7 — 한국식 명칭: 유생 → 진사 → 급제 → 장원).
 *
 * 안쪽에 있는 숫자는 **MMR 하나뿐**이다. 티어·급수는 그 구간에 이름을 붙인 것이고,
 * MMR 수치 자체는 서버 밖으로 나가지 않는다 — 매칭 상대를 고르고 등락을 계산하는
 * 데만 쓴다. 화면에 숫자를 내보내면 사람들이 티어 대신 숫자를 보게 되고,
 * 티어는 장식으로 전락한다.
 *
 * 오르기만 하는 별도 점수를 두지 않으므로 **강등이 있다**. MMR이 내려가면 급수도
 * 따라 내려간다 — 티어가 지금 실력을 뜻하려면 그래야 한다.
 */

// ── MMR ───────────────────────────────────────────────────────────────

/** 처음 앉는 자리 = 유생 5급. 아래위로 갈 곳이 다 있다 */
export const INITIAL_RATING = 1500;
/** 이 국까지는 배치 대국으로 보고 등락이 크다 */
export const PLACEMENT_GAMES = 5;
/** 아무리 져도 이 밑으로는 안 내려간다 (매칭 폭이 무의미해질 만큼 벌어지는 것 방지) */
const RATING_FLOOR = 1000;

/** 4인 반장 순위점. 동풍전은 분산이 커서 줄인다 */
const RANK_POINTS: readonly [number, number, number, number] = [30, 10, -10, -30];

/**
 * MMR 등락.
 *
 * `순위점 + (평균 상대 MMR − 내 MMR) / 40` — 나보다 센 사람들 사이에서 이기면
 * 더 오르고, 약한 사람들 사이에서 지면 더 깎인다. 여기에 대국 수가 쌓일수록
 * 작아지는 보정계수를 곱해 값이 실력에 수렴하게 한다.
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

// ── 티어 구간 ─────────────────────────────────────────────────────────

interface TierSpec {
  tier: RankTier;
  /** 이 등급이 시작되는 MMR */
  floor: number;
  /** 등급 안 단계 수 */
  steps: number;
  /** 한 단계 폭 (MMR) */
  span: number;
}

/**
 * 한 단계 = MMR 60. 시작값 1500이 유생 5급 한가운데에 오도록 바닥을 잡았다.
 * 유생 9급(1260) 아래는 더 내려갈 칸이 없고, MMR 하한(1000)이 그 아래를 받친다.
 */
const STEP = 60;
export const TIERS: TierSpec[] = [
  { tier: '유생', floor: 1260, steps: 9, span: STEP },
  { tier: '진사', floor: 1800, steps: 9, span: STEP },
  { tier: '급제', floor: 2340, steps: 9, span: STEP },
  { tier: '장원', floor: 2880, steps: 9, span: STEP },
];

function specFor(rating: number): TierSpec {
  let found = TIERS[0] as TierSpec;
  for (const spec of TIERS) if (rating >= spec.floor) found = spec;
  return found;
}

const isTopTier = (spec: TierSpec): boolean => spec.tier === TIERS[TIERS.length - 1]?.tier;

/** MMR → 화면에 보이는 등급. 이 함수 밖으로 MMR 수치가 새어 나가지 않는다. */
export function rankViewOf(rating: number, games: number): RankView {
  const spec = specFor(rating);
  const within = Math.max(0, rating - spec.floor);
  const step = Math.min(spec.steps, Math.floor(within / spec.span) + 1); // 1..steps
  const top = isTopTier(spec);

  // 유생~급제는 9급 → 1급으로 내려가고, 장원만 1단 → 9단으로 올라간다
  const grade = top ? null : spec.steps - step + 1;
  const dan = top ? step : null;

  return {
    tier: spec.tier,
    grade,
    dan,
    label: top ? `${spec.tier} ${dan}단` : `${spec.tier} ${grade}급`,
    games,
    placementLeft: Math.max(0, PLACEMENT_GAMES - games),
  };
}

// ── 저장 ──────────────────────────────────────────────────────────────

interface RatingRow {
  games: number;
  rating: number;
}

function ensureRow(db: AppDatabase, userId: string): RatingRow {
  db.prepare('INSERT OR IGNORE INTO ratings (user_id, games, rating) VALUES (?, 0, ?)').run(
    userId,
    INITIAL_RATING,
  );
  return db.prepare('SELECT games, rating FROM ratings WHERE user_id = ?').get(userId) as RatingRow;
}

export function rankOf(db: AppDatabase, userId: string): RankView {
  const row = ensureRow(db, userId);
  return rankViewOf(row.rating, row.games);
}

/** 매칭에만 쓰는 값 — 클라로 나가면 안 된다 */
export function mmrOf(db: AppDatabase, userId: string): number {
  return ensureRow(db, userId).rating;
}

/** 이 대국을 이미 반영했는가 (멱등) */
function alreadyRated(db: AppDatabase, userId: string, gameId: string): boolean {
  return (
    db
      .prepare('SELECT 1 FROM rating_log WHERE user_id = ? AND game_id = ? LIMIT 1')
      .get(userId, gameId) !== undefined
  );
}

/**
 * 대국 결과를 MMR에 반영한다 (§6.2와 같은 조건: 인간 2인 이상·연습 아님·완주).
 * userId별 갱신된 등급 표기를 돌려준다.
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

  // 대국 **전** MMR을 먼저 전부 읽어 둔다. 한 명씩 갱신하면서 계산하면 뒤에
  // 처리되는 사람이 이미 바뀐 상대 값을 보게 되어 좌석 순서에 따라 결과가 달라진다.
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

    const others = [...before.entries()].filter(([id]) => id !== userId).map(([, r]) => r.rating);
    const opponentAvg =
      others.length > 0 ? others.reduce((a, b) => a + b, 0) / others.length : INITIAL_RATING;
    const delta = ratingDelta({
      rating: row.rating,
      opponentAvg,
      rank: standing.rank,
      games: row.games,
      hanchan,
    });
    const rating = Math.max(RATING_FLOOR, Math.round((row.rating + delta) * 10) / 10);

    db.transaction(() => {
      db.prepare('UPDATE ratings SET games = games + 1, rating = ? WHERE user_id = ?').run(
        rating,
        userId,
      );
      db.prepare(
        'INSERT INTO rating_log (user_id, game_id, delta, rating_after, created_at) VALUES (?, ?, ?, ?, ?)',
      ).run(userId, summary.gameId, delta, rating, now);
    })();

    out.set(userId, rankViewOf(rating, row.games + 1));
  }
  return out;
}
