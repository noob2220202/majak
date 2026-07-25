import type { RewardLineView, RewardsView } from '@cheongiwa/protocol';
import type { AppDatabase } from './db';
import { balanceOf } from './shop';
import type { SessionEndSummary } from './session';

/**
 * 엽전 경제 (PLAN.md §6.1~6.2).
 *
 * - 무료 재화. 현금 결제·유저 간 거래·베팅 없음.
 * - 지갑 변경은 서버만 수행하고, 모든 증감은 append-only 원장에 사유와 함께 남긴다.
 * - 지급은 gameId 기준 멱등 (재접속·중복 정산으로 이중 지급되지 않는다).
 */

export const REWARD = {
  /** 반장전 완주 기본 보상 */
  hanchan: 100,
  /** 동풍전 완주 기본 보상 */
  tonpuu: 50,
  /** 순위 보너스 (1~4위) */
  rank: [80, 40, 20, 10],
  /** 오늘의 첫 대국 */
  daily: 50,
  /** 역만 화료 기념 (계정당 역별 1회) */
  yakuman: 500,
  /** 빈곤 구제 기준선 (하루 1회, 이 값까지 채워준다) */
  reliefFloor: 200,
} as const;

const LABEL: Record<string, string> = {
  base: '완주 보상',
  rank1: '1위',
  rank2: '2위',
  rank3: '3위',
  rank4: '4위',
  daily: '오늘의 첫 대국',
  relief: '빈곤 구제',
};

const dayKey = (ts: number): string => new Date(ts).toISOString().slice(0, 10);

function credit(
  db: AppDatabase,
  userId: string,
  delta: number,
  reason: string,
  gameId: string | null,
  at: number,
): void {
  db.prepare('INSERT OR IGNORE INTO wallets (user_id, balance) VALUES (?, 0)').run(userId);
  db.prepare('UPDATE wallets SET balance = balance + ? WHERE user_id = ?').run(delta, userId);
  db.prepare(
    'INSERT INTO ledger (user_id, delta, reason, game_id, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(userId, delta, reason, gameId, at);
}

/** 이 대국에 대해 이미 지급했는가 (멱등 키: user_id + game_id) */
function alreadyPaid(db: AppDatabase, userId: string, gameId: string): boolean {
  return (
    db.prepare('SELECT 1 FROM ledger WHERE user_id = ? AND game_id = ? LIMIT 1').get(userId, gameId) !==
    undefined
  );
}

/** 역만 기념은 계정당 역별 1회 */
function yakumanClaimed(db: AppDatabase, userId: string, yakumanId: string): boolean {
  return (
    db
      .prepare('SELECT 1 FROM ledger WHERE user_id = ? AND reason = ? LIMIT 1')
      .get(userId, `yakuman:${yakumanId}`) !== undefined
  );
}

/** 이 대국에서 각 좌석이 화료한 역만 id 목록 (중복 제거) */
function yakumanBySeat(summary: SessionEndSummary): Map<number, Set<string>> {
  const out = new Map<number, Set<string>>();
  for (const result of summary.game.history) {
    if (result.type !== 'win') continue;
    for (const win of result.wins) {
      for (const y of win.agari.yakuman) {
        const set = out.get(win.seat) ?? new Set<string>();
        set.add(y.id);
        out.set(win.seat, set);
      }
    }
  }
  return out;
}

/**
 * 대국 종료 보상 지급 (§6.2).
 *
 * 지급 조건: 인간 플레이어 2인 이상 · 연습 모드 아님 · 본인이 완주(탈주 아님).
 * 좌석별 지급 내역을 userId 기준으로 돌려준다 (로비 표시용).
 */
export function grantGameRewards(
  db: AppDatabase,
  summary: SessionEndSummary,
  now = Date.now(),
): Map<string, RewardsView> {
  const out = new Map<string, RewardsView>();
  const humans = summary.seats.filter((s) => !s.isBot);
  // 봇 상대 어뷰징 방지 — 인간 2인 이상 대국만 보상 (§6.2)
  if (summary.practice || humans.length < 2) return out;

  const standings = summary.game.standings ?? [];
  const yakumanSeats = yakumanBySeat(summary);
  const baseAmount = summary.rules.gameLength === 'hanchan' ? REWARD.hanchan : REWARD.tonpuu;

  for (const seat of humans) {
    const userId = seat.userId;
    if (!userId) continue;
    if (!seat.completed) continue; // 탈주(재접속 포기) 시 무보상
    if (alreadyPaid(db, userId, summary.gameId)) continue; // 멱등

    const lines: RewardLineView[] = [];
    const add = (reason: string, label: string, amount: number): void => {
      if (amount > 0) lines.push({ reason, label, amount });
    };

    add('base', LABEL.base as string, baseAmount);

    const standing = standings.find((s) => s.seat === seat.seat);
    if (standing) {
      const bonus = REWARD.rank[standing.rank - 1] ?? 0;
      add(`rank${standing.rank}`, LABEL[`rank${standing.rank}`] ?? `${standing.rank}위`, bonus);
    }

    // 오늘의 첫 대국
    const todayPaid = db
      .prepare(
        `SELECT 1 FROM ledger WHERE user_id = ? AND reason = 'daily' AND created_at >= ? LIMIT 1`,
      )
      .get(userId, Date.parse(`${dayKey(now)}T00:00:00.000Z`));
    if (!todayPaid) add('daily', LABEL.daily as string, REWARD.daily);

    // 역만 화료 기념 (계정당 역별 1회)
    for (const yakumanId of yakumanSeats.get(seat.seat) ?? []) {
      if (yakumanClaimed(db, userId, yakumanId)) continue;
      lines.push({
        reason: `yakuman:${yakumanId}`,
        label: '역만 화료 기념',
        amount: REWARD.yakuman,
      });
    }

    if (lines.length === 0) continue;
    const total = lines.reduce((sum, l) => sum + l.amount, 0);
    const tx = db.transaction(() => {
      for (const line of lines) credit(db, userId, line.amount, line.reason, summary.gameId, now);
    });
    tx();

    out.set(userId, {
      gameId: summary.gameId,
      lines,
      total,
      balance: balanceOf(db, userId),
    });
  }
  return out;
}

/**
 * 빈곤 구제 (§6.2): 잔액이 기준선 미만이면 하루 1회 기준선까지 채워준다.
 * 접속 시 호출한다. 지급했으면 내역을 돌려준다.
 */
export function grantReliefIfNeeded(
  db: AppDatabase,
  userId: string,
  now = Date.now(),
): RewardsView | null {
  const balance = balanceOf(db, userId);
  if (balance >= REWARD.reliefFloor) return null;

  const todayStart = Date.parse(`${dayKey(now)}T00:00:00.000Z`);
  const claimed = db
    .prepare(
      `SELECT 1 FROM ledger WHERE user_id = ? AND reason = 'relief' AND created_at >= ? LIMIT 1`,
    )
    .get(userId, todayStart);
  if (claimed) return null;

  const delta = REWARD.reliefFloor - balance;
  credit(db, userId, delta, 'relief', null, now);
  const line: RewardLineView = { reason: 'relief', label: LABEL.relief as string, amount: delta };
  return {
    gameId: '',
    lines: [line],
    total: delta,
    balance: balanceOf(db, userId),
  };
}

/** 원장 최근 내역 (상점 화면 표시용) */
export function recentLedger(db: AppDatabase, userId: string, limit = 20) {
  return db
    .prepare(
      'SELECT delta, reason, created_at AS createdAt FROM ledger WHERE user_id = ? ORDER BY id DESC LIMIT ?',
    )
    .all(userId, limit) as Array<{ delta: number; reason: string; createdAt: number }>;
}
