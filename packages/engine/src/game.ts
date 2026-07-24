import { createRng, shuffleInPlace, type Rng } from './rng';
import { GOAL_POINTS, RIICHI_DEPOSIT, STARTING_POINTS, type RuleSettings } from './rules';
import { EAST, TOTAL_TILES } from './tiles';
import type { Seat, TileKind } from './types';
import { SEATS } from './types';
import { startRound, type RoundResult, type RoundState } from './round';

/**
 * 반장전(또는 동풍전) 전체 흐름 (PLAN.md §2.2·§2.9·§2.10).
 * 좌석 0 = 기가(起家). kyoku k의 친 = k % 4, 장풍 = floor(k / 4).
 */

export interface GameConfig {
  readonly rules: RuleSettings;
  readonly seed: string;
}

export type GameEndReason = 'finished' | 'tobi' | 'agariYame' | 'suddenDeathGoal';

export interface FinalStanding {
  readonly seat: Seat;
  readonly rank: number;
  readonly rawScore: number;
  readonly uma: number;
  /** 소프트 점수 = (rawScore − 25,000)/1000 + 우마 (오카 없음). 전체 합 0. */
  readonly finalPoints: number;
}

export interface GameState {
  readonly rules: RuleSettings;
  readonly seed: string;
  readonly rng: Rng;
  scores: number[];
  /** 현재 국 인덱스: 0=동1, 4=남1, 8=서1(서든데스) */
  kyoku: number;
  honba: number;
  pot: number;
  round: RoundState | null;
  phase: 'playing' | 'ended';
  endReason: GameEndReason | null;
  standings: FinalStanding[] | null;
  history: RoundResult[];
}

export function dealerOf(kyoku: number): Seat {
  return (kyoku % 4) as Seat;
}

export function roundWindOf(kyoku: number): TileKind {
  return EAST + Math.floor(kyoku / 4);
}

/** 정규 국 수 (반장전 8, 동풍전 4). 서든데스는 +4국까지. */
function normalKyokuCount(rules: RuleSettings): number {
  return rules.gameLength === 'hanchan' ? 8 : 4;
}

export function startGame(config: GameConfig): GameState {
  const state: GameState = {
    rules: config.rules,
    seed: config.seed,
    rng: createRng(config.seed),
    scores: SEATS.map(() => STARTING_POINTS),
    kyoku: 0,
    honba: 0,
    pot: 0,
    round: null,
    phase: 'playing',
    endReason: null,
    standings: null,
    history: [],
  };
  beginRound(state);
  return state;
}

function beginRound(state: GameState): void {
  const order = Array.from({ length: TOTAL_TILES }, (_, i) => i);
  shuffleInPlace(order, state.rng);
  state.round = startRound({
    rules: state.rules,
    dealer: dealerOf(state.kyoku),
    roundWind: roundWindOf(state.kyoku),
    honba: state.honba,
    pot: state.pot,
    scores: state.scores,
    wallOrder: order,
  });
}

export interface AdvanceOptions {
  /** 오라스 아가리야메 선택 (기본 true = 종료) */
  readonly agariYame?: boolean;
}

/**
 * 종료된 국의 결과를 반영하고 다음 국을 시작하거나 대국을 끝낸다.
 * 라운드가 'ended'가 아닐 때 호출하면 오류.
 */
export function advanceGame(state: GameState, options: AdvanceOptions = {}): void {
  const round = state.round;
  if (!round || round.phase !== 'ended' || !round.result) {
    throw new Error('종료된 국이 없음');
  }
  const result = round.result;
  state.scores = [...round.scores];
  state.pot = result.potRemaining;
  state.history.push(result);
  state.round = null;

  // 토비 (§2.10)
  if (state.rules.tobi && state.scores.some((s) => s < 0)) {
    endGame(state, 'tobi');
    return;
  }

  const dealer = dealerOf(state.kyoku);
  const normalCount = normalKyokuCount(state.rules);
  const isAllLast = state.kyoku === normalCount - 1;
  const inSuddenDeath = state.kyoku >= normalCount;

  // 본장·연친 (§2.9)
  let dealerRepeats: boolean;
  if (result.type === 'win') {
    dealerRepeats = result.dealerRepeats;
    state.honba = dealerRepeats ? state.honba + 1 : 0;
  } else {
    dealerRepeats = result.dealerRepeats;
    state.honba = state.honba + 1;
  }

  // 서든데스: 국 종료 시 30,000점 도달자가 있으면 즉시 종료 (§2.10)
  if (inSuddenDeath && state.scores.some((s) => s >= GOAL_POINTS)) {
    endGame(state, 'suddenDeathGoal');
    return;
  }

  // 아가리야메 (§2.10): 오라스(또는 서든데스 각 국)에서 친이 화료/텐파이 유국 + 단독 1위
  // (도중유국은 해당 없음)
  const dealerKeeps =
    result.type === 'win' || result.type === 'exhaustive' ? result.dealerRepeats : false;
  if (
    state.rules.agariYame &&
    (isAllLast || inSuddenDeath) &&
    dealerRepeats &&
    dealerKeeps &&
    isSoleFirst(state.scores, dealer) &&
    (options.agariYame ?? true)
  ) {
    endGame(state, 'agariYame');
    return;
  }

  if (dealerRepeats) {
    beginRound(state);
    return;
  }

  // 친 이동
  const nextKyoku = state.kyoku + 1;
  if (nextKyoku >= normalCount) {
    // 정규 국 종료: 30,000점 이상이 있으면 종료, 없고 서입 룰이면 연장
    const someoneReached = state.scores.some((s) => s >= GOAL_POINTS);
    const canExtend = state.rules.westEntry && nextKyoku < normalCount + 4;
    if (someoneReached || !canExtend) {
      endGame(state, 'finished');
      return;
    }
  }
  state.kyoku = nextKyoku;
  beginRound(state);
}

function isSoleFirst(scores: readonly number[], seat: Seat): boolean {
  const mine = scores[seat] as number;
  return SEATS.every((s) => s === seat || (scores[s] as number) < mine);
}

function endGame(state: GameState, reason: GameEndReason): void {
  state.phase = 'ended';
  state.endReason = reason;

  const scores = [...state.scores];
  // 남은 공탁은 1위에게 (§2.4) — 순위는 공탁 반영 전 점수 + 기가순
  const order = [...SEATS].sort(
    (a, b) => (scores[b] as number) - (scores[a] as number) || a - b,
  );
  if (state.pot > 0) {
    const first = order[0] as Seat;
    scores[first] = (scores[first] as number) + state.pot * RIICHI_DEPOSIT;
    state.pot = 0;
    state.scores = scores;
  }

  state.standings = order.map((seat, index) => {
    const uma = state.rules.uma[index] as number;
    const raw = scores[seat] as number;
    // 소프트 점수 (오카 없음, §2.2): (점수 − 시작점)/1000 + 우마. 전체 합은 0.
    const finalPoints = Math.round(((raw - STARTING_POINTS) / 1000 + uma) * 10) / 10;
    return { seat, rank: index + 1, rawScore: raw, uma, finalPoints };
  });
}
