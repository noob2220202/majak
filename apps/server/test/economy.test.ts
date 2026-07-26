import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_RULES, type GameState, type RuleSettings, type Seat } from '@cheongiwa/engine';
import { openDatabase, type AppDatabase } from '../src/db';
import { grantGameRewards, grantReliefIfNeeded, recentLedger, REWARD } from '../src/economy';
import { applyGameRatings, PLACEMENT_GAMES, rankOf, rankViewOf, ratingDelta } from '../src/ranks';
import { buyItem, CATALOG, equipItem, walletView } from '../src/shop';
import type { SessionEndSummary } from '../src/session';

/**
 * 엽전 경제·상점·등급 테스트 (PLAN.md §6, §8.2).
 *
 * 핵심 불변식:
 * - 지급은 gameId 기준 멱등 — 같은 대국을 두 번 정산해도 한 번만 지급된다.
 * - 봇 대국·연습 대국·탈주자에게는 지급하지 않는다.
 * - 지갑 변경은 전부 원장에 사유와 함께 남는다.
 * - 상점 상품은 전부 코스메틱 — 잔액과 보유 여부만 검증한다.
 */

let db: AppDatabase;

const DAY = 24 * 60 * 60 * 1000;
/** 테스트 기준 시각 — 하루 경계를 넘지 않는 정오로 고정 */
const NOON = Date.parse('2026-03-05T12:00:00.000Z');

function addUser(id: string): string {
  db.prepare('INSERT INTO users (id, nickname, created_at, last_seen_at) VALUES (?, ?, ?, ?)').run(
    id,
    id,
    NOON,
    NOON,
  );
  db.prepare('INSERT INTO wallets (user_id, balance) VALUES (?, 0)').run(id);
  return id;
}

/** rank 순서대로 좌석을 배치한 최종 순위표 */
function standingsFor(order: Seat[]): GameState['standings'] {
  return order.map((seat, i) => ({
    seat,
    rank: i + 1,
    rawScore: 40000 - i * 10000,
    uma: [15, 5, -5, -15][i] as number,
    finalPoints: 0,
  }));
}

interface SummaryOptions {
  gameId?: string;
  practice?: boolean;
  /** 좌석별 userId — null이면 봇 */
  users?: Array<string | null>;
  /** 완주하지 않은(탈주) 좌석 */
  abandoned?: Seat[];
  order?: Seat[];
  gameLength?: RuleSettings['gameLength'];
  history?: GameState['history'];
}

function makeSummary(options: SummaryOptions = {}): SessionEndSummary {
  const users = options.users ?? ['u1', 'u2', 'u3', 'u4'];
  const order = options.order ?? ([0, 1, 2, 3] as Seat[]);
  const rules: RuleSettings = {
    ...DEFAULT_RULES,
    gameLength: options.gameLength ?? 'hanchan',
  };
  const game = {
    standings: standingsFor(order),
    history: options.history ?? [],
  } as unknown as GameState;

  return {
    gameId: options.gameId ?? 'game-1',
    seed: 'seed',
    seedHash: 'hash',
    rules,
    practice: options.practice ?? false,
    game,
    seats: users.map((userId, i) => ({
      seat: i as Seat,
      userId,
      nickname: userId ?? `봇${i}`,
      isBot: userId === null,
      completed: !(options.abandoned ?? []).includes(i as Seat),
    })),
  };
}

beforeEach(() => {
  db = openDatabase(':memory:');
  for (const id of ['u1', 'u2', 'u3', 'u4']) addUser(id);
});

describe('엽전 보상 (§6.2)', () => {
  it('완주·순위·첫 대국 보상을 지급하고 원장에 남긴다', () => {
    const rewards = grantGameRewards(db, makeSummary(), NOON);

    const first = rewards.get('u1');
    expect(first).toBeDefined();
    expect(first?.total).toBe(REWARD.hanchan + (REWARD.rank[0] as number) + REWARD.daily);
    expect(first?.balance).toBe(first?.total);
    expect(first?.lines.map((l) => l.reason)).toEqual(['base', 'rank1', 'daily']);

    // 4위도 순위 보너스를 받는다 (전원 지급, 승패로 재화가 사라지지 않음)
    expect(rewards.get('u4')?.total).toBe(
      REWARD.hanchan + (REWARD.rank[3] as number) + REWARD.daily,
    );

    const ledger = recentLedger(db, 'u1');
    expect(ledger).toHaveLength(3);
    expect(ledger.every((row) => row.delta > 0)).toBe(true);
  });

  it('같은 gameId를 두 번 정산해도 한 번만 지급한다 (멱등)', () => {
    grantGameRewards(db, makeSummary(), NOON);
    const balanceAfterFirst = walletView(db, 'u1').balance;

    const second = grantGameRewards(db, makeSummary(), NOON);
    expect(second.size).toBe(0);
    expect(walletView(db, 'u1').balance).toBe(balanceAfterFirst);
  });

  it('연습 대국은 지급하지 않는다', () => {
    const rewards = grantGameRewards(db, makeSummary({ practice: true }), NOON);
    expect(rewards.size).toBe(0);
    expect(walletView(db, 'u1').balance).toBe(0);
  });

  it('인간이 1명뿐인 대국(봇 3인)은 지급하지 않는다', () => {
    const rewards = grantGameRewards(
      db,
      makeSummary({ users: ['u1', null, null, null] }),
      NOON,
    );
    expect(rewards.size).toBe(0);
    expect(walletView(db, 'u1').balance).toBe(0);
  });

  it('탈주한 좌석은 지급 대상에서 빠진다', () => {
    const rewards = grantGameRewards(db, makeSummary({ abandoned: [1] }), NOON);
    expect(rewards.has('u1')).toBe(true);
    expect(rewards.has('u2')).toBe(false);
    expect(walletView(db, 'u2').balance).toBe(0);
  });

  it('동풍전은 완주 보상이 절반이다', () => {
    const rewards = grantGameRewards(db, makeSummary({ gameLength: 'tonpuu' }), NOON);
    const base = rewards.get('u1')?.lines.find((l) => l.reason === 'base');
    expect(base?.amount).toBe(REWARD.tonpuu);
  });

  it('첫 대국 보상은 하루 한 번만, 다음 날 다시 지급된다', () => {
    grantGameRewards(db, makeSummary({ gameId: 'g1' }), NOON);
    grantGameRewards(db, makeSummary({ gameId: 'g2' }), NOON + 60_000);
    const sameDay = recentLedger(db, 'u1').filter((r) => r.reason === 'daily');
    expect(sameDay).toHaveLength(1);

    grantGameRewards(db, makeSummary({ gameId: 'g3' }), NOON + DAY);
    const nextDay = recentLedger(db, 'u1').filter((r) => r.reason === 'daily');
    expect(nextDay).toHaveLength(2);
  });

  it('역만 기념은 계정당 역별 1회만 지급한다', () => {
    const yakumanHistory = [
      {
        type: 'win',
        wins: [{ seat: 0 as Seat, agari: { yakuman: [{ id: 'kokushi' }] } }],
      },
    ] as unknown as GameState['history'];

    const first = grantGameRewards(
      db,
      makeSummary({ gameId: 'g1', history: yakumanHistory }),
      NOON,
    );
    expect(
      first.get('u1')?.lines.some((l) => l.reason === 'yakuman:kokushi'),
    ).toBe(true);

    const second = grantGameRewards(
      db,
      makeSummary({ gameId: 'g2', history: yakumanHistory }),
      NOON + 60_000,
    );
    expect(
      second.get('u1')?.lines.some((l) => l.reason === 'yakuman:kokushi'),
    ).toBe(false);
  });
});

describe('빈곤 구제 (§6.2)', () => {
  it('기준선 미만이면 기준선까지 채우고, 같은 날 두 번은 주지 않는다', () => {
    const granted = grantReliefIfNeeded(db, 'u1', NOON);
    expect(granted?.total).toBe(REWARD.reliefFloor);
    expect(walletView(db, 'u1').balance).toBe(REWARD.reliefFloor);

    // 다시 0으로 만들어도 같은 날은 추가 지급 없음
    db.prepare('UPDATE wallets SET balance = 0 WHERE user_id = ?').run('u1');
    expect(grantReliefIfNeeded(db, 'u1', NOON + 60_000)).toBeNull();

    // 다음 날은 다시 지급
    expect(grantReliefIfNeeded(db, 'u1', NOON + DAY)?.total).toBe(REWARD.reliefFloor);
  });

  it('기준선 이상이면 지급하지 않는다', () => {
    db.prepare('UPDATE wallets SET balance = ? WHERE user_id = ?').run(REWARD.reliefFloor, 'u1');
    expect(grantReliefIfNeeded(db, 'u1', NOON)).toBeNull();
  });
});

describe('저잣거리 상점 (§6.3)', () => {
  const paid = CATALOG.find((i) => i.price > 0 && i.slot === 'tileBack');

  it('카탈로그는 전부 코스메틱 슬롯이며 슬롯마다 무료 기본품이 있다', () => {
    for (const slot of ['tileBack', 'table', 'winEffect', 'emote'] as const) {
      const inSlot = CATALOG.filter((i) => i.slot === slot);
      expect(inSlot.length).toBeGreaterThan(0);
      expect(inSlot.filter((i) => i.price === 0)).toHaveLength(1);
    }
  });

  it('잔액이 모자라면 구매를 거부한다', () => {
    const result = buyItem(db, 'u1', paid!.id);
    expect(result.ok).toBe(false);
    expect(walletView(db, 'u1').balance).toBe(0);
  });

  it('구매하면 차감·원장 기록·해금이 한 번에 일어나고, 재구매는 거부한다', () => {
    db.prepare('UPDATE wallets SET balance = 5000 WHERE user_id = ?').run('u1');

    const result = buyItem(db, 'u1', paid!.id);
    expect(result.ok).toBe(true);
    expect(walletView(db, 'u1').balance).toBe(5000 - paid!.price);
    expect(walletView(db, 'u1').unlocked).toContain(paid!.id);

    const entry = recentLedger(db, 'u1').find((r) => r.reason === `buy:${paid!.id}`);
    expect(entry?.delta).toBe(-paid!.price);

    const again = buyItem(db, 'u1', paid!.id);
    expect(again.ok).toBe(false);
    expect(walletView(db, 'u1').balance).toBe(5000 - paid!.price);
  });

  it('보유하지 않은 상품은 장착할 수 없다', () => {
    const result = equipItem(db, 'u1', 'tileBack', paid!.id);
    expect(result.ok).toBe(false);
    expect(walletView(db, 'u1').loadout.tileBack).toBe('tileBack.sumaksae');
  });

  it('구매한 상품은 장착되고 슬롯이 바뀐다', () => {
    db.prepare('UPDATE wallets SET balance = 5000 WHERE user_id = ?').run('u1');
    buyItem(db, 'u1', paid!.id);

    const result = equipItem(db, 'u1', 'tileBack', paid!.id);
    expect(result.ok).toBe(true);
    expect(result.ok && result.wallet.loadout.tileBack).toBe(paid!.id);

    // 무료 기본품으로 되돌리는 것은 언제나 가능
    expect(equipItem(db, 'u1', 'tileBack', 'tileBack.sumaksae').ok).toBe(true);
    expect(walletView(db, 'u1').loadout.tileBack).toBe('tileBack.sumaksae');
  });

  it('슬롯이 다른 상품은 장착을 거부한다', () => {
    expect(equipItem(db, 'u1', 'table', 'tileBack.sumaksae').ok).toBe(false);
  });
});

describe('등급·레이팅 (§7 Phase 5)', () => {
  it('첫 대국 전에는 유생 1단·0점이다', () => {
    const rank = rankOf(db, 'u1');
    expect(rank.tier).toBe('유생');
    expect(rank.points).toBe(0);
    expect(rank.games).toBe(0);
  });

  it('순위대로 점수가 오르내리고 0점 아래로는 내려가지 않는다', () => {
    const ranks = applyGameRatings(db, makeSummary(), NOON);
    expect(ranks.get('u1')?.points).toBe(60); // 유생 1위
    expect(ranks.get('u2')?.points).toBe(25);
    expect(ranks.get('u3')?.points).toBe(0);
    expect(ranks.get('u4')?.points).toBe(0); // -15이지만 하한 0
    expect(ranks.get('u1')?.games).toBe(1);
  });

  it('같은 대국을 두 번 반영해도 점수는 한 번만 움직인다 (멱등)', () => {
    applyGameRatings(db, makeSummary(), NOON);
    const after = rankOf(db, 'u1');

    const second = applyGameRatings(db, makeSummary(), NOON);
    expect(second.size).toBe(0);
    expect(rankOf(db, 'u1')).toEqual(after);
  });

  it('동풍전은 증감이 절반이다', () => {
    const ranks = applyGameRatings(db, makeSummary({ gameLength: 'tonpuu' }), NOON);
    expect(ranks.get('u1')?.points).toBe(30);
  });

  it('연습·봇 대국은 레이팅에 반영하지 않는다', () => {
    expect(applyGameRatings(db, makeSummary({ practice: true }), NOON).size).toBe(0);
    expect(
      applyGameRatings(db, makeSummary({ users: ['u1', null, null, null] }), NOON).size,
    ).toBe(0);
    expect(rankOf(db, 'u1').points).toBe(0);
  });

  it('점수 구간마다 급수·단이 올바르게 매겨진다', () => {
    // 유생~급제는 9급에서 1급으로 내려가고, 장원만 단으로 올라간다
    expect(rankViewOf(0, 1, 1500)).toMatchObject({ tier: '유생', grade: 9, label: '유생 9급' });
    expect(rankViewOf(850, 1, 1500)).toMatchObject({ tier: '유생', grade: 1, label: '유생 1급' });
    expect(rankViewOf(900, 1, 1500)).toMatchObject({ tier: '진사', grade: 9, label: '진사 9급' });
    expect(rankViewOf(2250, 1, 1500)).toMatchObject({ tier: '급제', grade: 9 });
    expect(rankViewOf(4050, 1, 1500)).toMatchObject({
      tier: '장원',
      grade: null,
      dan: 1,
      label: '장원 1단',
    });
    // 최고 단계에 닿으면 더 올릴 곳이 없다
    expect(rankViewOf(99999, 1, 1500)).toMatchObject({ tier: '장원', dan: 9, toNext: null });
  });

  it('toNext 는 다음 단계까지 남은 점수다', () => {
    expect(rankViewOf(0, 1, 1500).toNext).toBe(100); // 유생 9급 → 8급
    expect(rankViewOf(850, 1, 1500).toNext).toBe(50); // 유생 1급 → 진사 승단
  });
});

describe('실력 점수 (§3.2 레이팅 매칭)', () => {
  it('같은 실력끼리면 순위점이 그대로 반영된다 (배치 구간)', () => {
    const same = { rating: 1500, opponentAvg: 1500, games: 0, hanchan: true };
    expect(ratingDelta({ ...same, rank: 1 })).toBe(30);
    expect(ratingDelta({ ...same, rank: 2 })).toBe(10);
    expect(ratingDelta({ ...same, rank: 3 })).toBe(-10);
    expect(ratingDelta({ ...same, rank: 4 })).toBe(-30);
  });

  it('센 상대들 사이에서 이기면 더 오르고, 약한 상대들 사이에서 지면 더 깎인다', () => {
    const base = { rating: 1500, games: 0, hanchan: true };
    const vsStrong = ratingDelta({ ...base, opponentAvg: 1900, rank: 1 });
    const vsEqual = ratingDelta({ ...base, opponentAvg: 1500, rank: 1 });
    expect(vsStrong).toBeGreaterThan(vsEqual);

    const lostToWeak = ratingDelta({ ...base, opponentAvg: 1100, rank: 4 });
    const lostToEqual = ratingDelta({ ...base, opponentAvg: 1500, rank: 4 });
    expect(lostToWeak).toBeLessThan(lostToEqual);
  });

  it('대국 수가 쌓일수록 변동 폭이 줄어 실력에 수렴한다', () => {
    const at = (games: number): number =>
      ratingDelta({ rating: 1500, opponentAvg: 1500, rank: 1, games, hanchan: true });
    expect(at(0)).toBeGreaterThan(at(100));
    expect(at(100)).toBeGreaterThan(at(399));
    // 400국 이후로는 더 줄지 않는다
    expect(at(400)).toBe(at(1000));
    expect(at(400)).toBeCloseTo(30 * 0.2, 5);
  });

  it('동풍전은 반장전보다 덜 움직인다', () => {
    const base = { rating: 1500, opponentAvg: 1500, rank: 1, games: 0 };
    expect(ratingDelta({ ...base, hanchan: false })).toBeLessThan(
      ratingDelta({ ...base, hanchan: true }),
    );
  });

  it('대국 결과가 실력 점수에 반영되고 처리 순서에 좌우되지 않는다', () => {
    // u1 만 세게 만들어 둔다 — 사람마다 상대 평균이 달라지게 한다
    db.prepare(
      'INSERT INTO ratings (user_id, points, games, rating) VALUES (?, 0, 0, 2000)',
    ).run('u1');

    applyGameRatings(db, makeSummary(), NOON);
    const after = (id: string): number =>
      (db.prepare('SELECT rating FROM ratings WHERE user_id = ?').get(id) as { rating: number })
        .rating;

    // 1위 u1 은 올랐고, 4위 u4 는 깎였다
    expect(after('u1')).toBeGreaterThan(2000);
    expect(after('u4')).toBeLessThan(1500);

    // 상대 평균은 '대국 전' 점수로 계산한다 — u2(2위)의 상대 평균은 (2000+1500+1500)/3
    const expectedU2 =
      1500 +
      ratingDelta({
        rating: 1500,
        opponentAvg: (2000 + 1500 + 1500) / 3,
        rank: 2,
        games: 0,
        hanchan: true,
      });
    expect(after('u2')).toBeCloseTo(expectedU2, 5);
  });

  it('같은 대국을 두 번 정산해도 실력 점수는 한 번만 움직인다', () => {
    applyGameRatings(db, makeSummary(), NOON);
    const once = rankOf(db, 'u1').rating;
    applyGameRatings(db, makeSummary(), NOON);
    expect(rankOf(db, 'u1').rating).toBe(once);
  });

  it('배치 대국 남은 수를 알려 준다', () => {
    expect(rankOf(db, 'u1').placementLeft).toBe(PLACEMENT_GAMES);
    applyGameRatings(db, makeSummary(), NOON);
    expect(rankOf(db, 'u1').placementLeft).toBe(PLACEMENT_GAMES - 1);
  });
});
