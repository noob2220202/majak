import { describe, expect, it } from 'vitest';
import {
  advanceGame,
  DEFAULT_RULES,
  dealerOf,
  roundWindOf,
  startGame,
  EAST,
  SOUTH,
  WEST,
  type GameState,
  type RoundResult,
} from '../src';

/** 진행 중인 국을 강제로 원하는 결과로 종료시킨다 (게임 흐름 단위 테스트용) */
function forceResult(game: GameState, result: RoundResult, scores?: number[]): void {
  const round = game.round;
  if (!round) throw new Error('진행 중인 국이 없음');
  if (scores) round.scores = scores;
  round.phase = 'ended';
  round.result = result;
}

const winResult = (winnerSeat: number, dealerSeat: number): RoundResult => ({
  type: 'win',
  wins: [],
  deltas: [0, 0, 0, 0],
  dealerRepeats: winnerSeat === dealerSeat,
  potRemaining: 0,
});

const exhaustiveResult = (tenpai: boolean[], dealerSeat: number): RoundResult => ({
  type: 'exhaustive',
  tenpai,
  nagashi: [],
  deltas: [0, 0, 0, 0],
  dealerRepeats: tenpai[dealerSeat] as boolean,
  potRemaining: 0,
});

describe('국 진행 (§2.2·§2.9)', () => {
  it('kyoku → 친·장풍 매핑', () => {
    expect(dealerOf(0)).toBe(0);
    expect(dealerOf(3)).toBe(3);
    expect(dealerOf(4)).toBe(0);
    expect(roundWindOf(0)).toBe(EAST);
    expect(roundWindOf(4)).toBe(SOUTH);
    expect(roundWindOf(8)).toBe(WEST);
  });

  it('친 화료 → 연친 + 본장 증가', () => {
    const game = startGame({ rules: DEFAULT_RULES, seed: 't1' });
    forceResult(game, winResult(0, 0));
    advanceGame(game);
    expect(game.kyoku).toBe(0);
    expect(game.honba).toBe(1);
  });

  it('자 화료 → 친 이동 + 본장 0', () => {
    const game = startGame({ rules: DEFAULT_RULES, seed: 't2' });
    forceResult(game, winResult(0, 0));
    advanceGame(game); // 본장 1
    forceResult(game, winResult(2, 0));
    advanceGame(game);
    expect(game.kyoku).toBe(1);
    expect(game.honba).toBe(0);
  });

  it('유국: 친 텐파이면 연친, 노텐이면 이동 — 본장은 언제나 +1', () => {
    const game = startGame({ rules: DEFAULT_RULES, seed: 't3' });
    forceResult(game, exhaustiveResult([true, false, false, false], 0));
    advanceGame(game);
    expect(game.kyoku).toBe(0);
    expect(game.honba).toBe(1);
    forceResult(game, exhaustiveResult([false, true, false, false], 0));
    advanceGame(game);
    expect(game.kyoku).toBe(1);
    expect(game.honba).toBe(2);
  });

  it('도중유국은 친 유지 + 본장 +1', () => {
    const game = startGame({ rules: DEFAULT_RULES, seed: 't4' });
    forceResult(game, {
      type: 'abortive',
      reason: 'kyuushu',
      deltas: [0, 0, 0, 0],
      dealerRepeats: true,
      potRemaining: 0,
    });
    advanceGame(game);
    expect(game.kyoku).toBe(0);
    expect(game.honba).toBe(1);
  });
});

describe('종료 조건 (§2.10)', () => {
  it('토비: 0점 미만 즉시 종료 (0점은 속행)', () => {
    const game = startGame({ rules: DEFAULT_RULES, seed: 't5' });
    forceResult(game, winResult(1, 0), [25000, 33100, 42000, -100]);
    advanceGame(game);
    expect(game.phase).toBe('ended');
    expect(game.endReason).toBe('tobi');

    const zero = startGame({ rules: DEFAULT_RULES, seed: 't6' });
    forceResult(zero, winResult(1, 0), [25000, 45000, 30000, 0]);
    advanceGame(zero);
    expect(zero.phase).toBe('playing');
  });

  it('남4 종료: 30,000점 이상이 있으면 종료 + 우마·공탁 정산', () => {
    const game = startGame({ rules: DEFAULT_RULES, seed: 't7' });
    game.kyoku = 7; // 남4
    forceResult(
      game,
      { ...winResult(1, 3), potRemaining: 2 },
      [20000, 41000, 15000, 22000],
    );
    advanceGame(game);
    expect(game.phase).toBe('ended');
    expect(game.endReason).toBe('finished');
    const standings = game.standings ?? [];
    // 남은 공탁 2개는 1위(s1)에게
    expect(standings[0]).toMatchObject({ seat: 1, rawScore: 43000, uma: 15, finalPoints: 58000 });
    expect(standings.map((s) => s.seat)).toEqual([1, 3, 0, 2]);
    expect(standings.map((s) => s.uma)).toEqual([15, 5, -5, -15]);
  });

  it('동점은 기가순 (앉은 순서 우선)', () => {
    const game = startGame({ rules: DEFAULT_RULES, seed: 't8' });
    game.kyoku = 7;
    forceResult(game, winResult(1, 3), [30000, 30000, 20000, 20000]);
    advanceGame(game);
    const standings = game.standings ?? [];
    expect(standings.map((s) => s.seat)).toEqual([0, 1, 2, 3]);
  });

  it('서입: 남4 종료 시 30,000 미달이면 서든데스 연장, 도달 국으로 종료', () => {
    const game = startGame({ rules: DEFAULT_RULES, seed: 't9' });
    game.kyoku = 7;
    forceResult(game, winResult(1, 3), [26000, 28000, 24000, 22000]);
    advanceGame(game);
    expect(game.phase).toBe('playing');
    expect(game.kyoku).toBe(8); // 서1
    expect(roundWindOf(game.kyoku)).toBe(WEST);

    forceResult(game, winResult(1, 0), [24000, 31000, 24000, 21000]);
    advanceGame(game);
    expect(game.phase).toBe('ended');
    expect(game.endReason).toBe('suddenDeathGoal');
  });

  it('서입 OFF면 남4에서 무조건 종료', () => {
    const game = startGame({ rules: { ...DEFAULT_RULES, westEntry: false }, seed: 't10' });
    game.kyoku = 7;
    forceResult(game, winResult(1, 3), [26000, 28000, 24000, 22000]);
    advanceGame(game);
    expect(game.phase).toBe('ended');
    expect(game.endReason).toBe('finished');
  });

  it('서4까지 미달이어도 종료', () => {
    const game = startGame({ rules: DEFAULT_RULES, seed: 't11' });
    game.kyoku = 11; // 서4
    forceResult(game, winResult(1, 3), [26000, 28000, 24000, 22000]);
    advanceGame(game);
    expect(game.phase).toBe('ended');
  });

  it('아가리야메: 오라스 친 단독 1위 화료 시 종료 선택', () => {
    const game = startGame({ rules: DEFAULT_RULES, seed: 't12' });
    game.kyoku = 7; // 남4 (친 = s3)
    forceResult(game, winResult(3, 3), [24000, 23000, 20000, 33000]);
    advanceGame(game); // 기본: 종료 선택
    expect(game.phase).toBe('ended');
    expect(game.endReason).toBe('agariYame');

    const cont = startGame({ rules: DEFAULT_RULES, seed: 't13' });
    cont.kyoku = 7;
    forceResult(cont, winResult(3, 3), [24000, 23000, 20000, 33000]);
    advanceGame(cont, { agariYame: false }); // 속행 선택
    expect(cont.phase).toBe('playing');
    expect(cont.kyoku).toBe(7); // 연친
    expect(cont.honba).toBe(1);
  });

  it('아가리야메 조건 미달(단독 1위 아님)이면 연친', () => {
    const game = startGame({ rules: DEFAULT_RULES, seed: 't14' });
    game.kyoku = 7;
    forceResult(game, winResult(3, 3), [34000, 23000, 20000, 33000]);
    advanceGame(game);
    expect(game.phase).toBe('playing');
    expect(game.kyoku).toBe(7);
  });

  it('동풍전은 동4가 오라스', () => {
    const game = startGame({ rules: { ...DEFAULT_RULES, gameLength: 'tonpuu' }, seed: 't15' });
    game.kyoku = 3; // 동4
    forceResult(game, winResult(1, 3), [20000, 41000, 17000, 22000]);
    advanceGame(game);
    expect(game.phase).toBe('ended');
  });
});
