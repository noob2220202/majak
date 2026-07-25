import { createBotV1, type Bot } from './bot';
import { advanceGame, startGame, type GameState } from './game';
import { reactionOffers, type RoundState } from './round';
import { applyAction } from './round';
import { DEFAULT_RULES, type RuleSettings } from './rules';
import { TOTAL_TILES } from './tiles';
import { SEATS } from './types';

/**
 * 봇 자동 대국 시뮬레이션 (PLAN.md Phase 1 완료 기준).
 * 불변식: 4인 점수 합 + 공탁 = 100,000 / 패 총량 136 보존 / 결정론.
 */

export interface SimulationStats {
  games: number;
  rounds: number;
  wins: number;
  tsumoWins: number;
  ronWins: number;
  doubleRons: number;
  exhaustive: number;
  abortive: Record<string, number>;
  yakuCounts: Map<string, number>;
  yakumanCounts: Map<string, number>;
  riichiDeclared: number;
  callsMade: number;
  maxActionCount: number;
}

export function emptyStats(): SimulationStats {
  return {
    games: 0,
    rounds: 0,
    wins: 0,
    tsumoWins: 0,
    ronWins: 0,
    doubleRons: 0,
    exhaustive: 0,
    abortive: {},
    yakuCounts: new Map(),
    yakumanCounts: new Map(),
    riichiDeclared: 0,
    callsMade: 0,
    maxActionCount: 0,
  };
}

function checkTileConservation(round: RoundState): void {
  // 전수 검증: 손패 + 쯔모패 + 버림패(울리지 않은 것) + 부로 + 남은 패산 = 136, 중복 없음
  let total = 0;
  const seen = new Set<number>();
  const add = (id: number): void => {
    if (seen.has(id)) throw new Error(`패 중복: ${id}`);
    seen.add(id);
    total++;
  };
  for (const seat of SEATS) {
    const p = round.players[seat];
    for (const t of p.hand) add(t);
    if (p.drawnTile !== null) add(p.drawnTile);
    for (const m of p.melds) for (const t of m.tiles) add(t);
    for (const d of p.discards) if (d.calledBy === null) add(d.tileId);
  }
  // 리액션 윈도우에 걸린 타패 (아직 강에 있음 — discards에 이미 포함됨)
  // 남은 패산: nextLive 이후 라이브 + 영상 잔여 + 도라·우라 영역
  for (let i = round.wall.nextLive; i < 122; i++) add(round.wall.order[i] as number);
  for (let i = 122 + round.wall.rinshanDrawn; i < TOTAL_TILES; i++) {
    add(round.wall.order[i] as number);
  }
  if (total !== TOTAL_TILES) {
    throw new Error(`패 총량 위반: ${total} ≠ 136`);
  }
}

function checkScoreInvariant(game: GameState): void {
  const round = game.round;
  const scores = round ? round.scores : game.scores;
  const pot = round ? round.pot : game.pot;
  const sum = scores.reduce((a, b) => a + b, 0) + pot * 1000;
  if (sum !== 100000) {
    throw new Error(`점수 합 위반: ${sum} ≠ 100,000`);
  }
}

function recordResult(stats: SimulationStats, round: RoundState): void {
  const result = round.result;
  if (!result) return;
  stats.rounds++;
  if (result.type === 'win') {
    stats.wins += result.wins.length;
    if (result.wins.length >= 2) stats.doubleRons++;
    for (const w of result.wins) {
      if (w.from === null) stats.tsumoWins++;
      else stats.ronWins++;
      for (const y of w.agari.yaku) {
        stats.yakuCounts.set(y.id, (stats.yakuCounts.get(y.id) ?? 0) + 1);
      }
      for (const y of w.agari.yakuman) {
        stats.yakumanCounts.set(y.id, (stats.yakumanCounts.get(y.id) ?? 0) + 1);
      }
    }
  } else if (result.type === 'exhaustive') {
    stats.exhaustive++;
  } else {
    stats.abortive[result.reason] = (stats.abortive[result.reason] ?? 0) + 1;
  }
  for (const seat of SEATS) {
    if (round.players[seat].riichi?.accepted) stats.riichiDeclared++;
    stats.callsMade += round.players[seat].melds.length;
  }
}

/** 한 국을 봇으로 끝까지 진행 */
function playRoundOut(round: RoundState, bots: readonly Bot[], stats: SimulationStats): void {
  let actions = 0;
  const limit = 3000; // 무한 루프 안전장치 (정상 국은 수백 액션 이내)
  while (round.phase !== 'ended') {
    if (++actions > limit) throw new Error('국이 끝나지 않음 (액션 한도 초과)');
    if (round.phase === 'turn') {
      const seat = round.active;
      const action = (bots[seat] as Bot).chooseTurnAction(round, seat);
      applyAction(round, seat, action);
    } else {
      const pending = reactionOffers(round);
      const seats = [...pending.keys()].sort((a, b) => a - b);
      for (const seat of seats) {
        const action = (bots[seat] as Bot).chooseReaction(round, seat);
        applyAction(round, seat, action);
        if ((round as RoundState).phase !== 'reaction') break; // 이미 해소됨
      }
    }
  }
  if (actions > stats.maxActionCount) stats.maxActionCount = actions;
}

export interface SimulationOptions {
  readonly games: number;
  readonly seedPrefix?: string;
  readonly rules?: RuleSettings;
  /** 국 단위 불변식 검사 (성능 비용 있음) */
  readonly checkInvariants?: boolean;
  /** 좌석별 봇을 직접 지정 (봇 대결용). 생략하면 전원 v1 */
  readonly makeBots?: () => Bot[];
}

export function runSimulation(options: SimulationOptions): SimulationStats {
  const stats = emptyStats();
  const rules = options.rules ?? DEFAULT_RULES;
  const bots: Bot[] = options.makeBots ? options.makeBots() : SEATS.map(() => createBotV1());

  for (let g = 0; g < options.games; g++) {
    const game = startGame({ rules, seed: `${options.seedPrefix ?? 'sim'}-${g}` });
    let guard = 0;
    while (game.phase === 'playing') {
      if (++guard > 200) throw new Error('대국이 끝나지 않음 (국 수 한도 초과)');
      const round = game.round;
      if (!round) throw new Error('진행 중인 국이 없음');
      playRoundOut(round, bots, stats);
      if (options.checkInvariants ?? true) {
        checkTileConservation(round);
        checkScoreInvariant(game);
      }
      recordResult(stats, round);
      advanceGame(game); // 봇은 항상 아가리야메 선택
      if (options.checkInvariants ?? true) checkScoreInvariant(game);
    }
    stats.games++;
  }
  return stats;
}

/** 같은 시드 → 같은 최종 결과 (결정론 검증용 요약) */
export function gameFingerprint(seed: string, rules: RuleSettings = DEFAULT_RULES): string {
  const bots: Bot[] = SEATS.map(() => createBotV1());
  const game = startGame({ rules, seed });
  const stats = emptyStats();
  let guard = 0;
  while (game.phase === 'playing') {
    if (++guard > 200) throw new Error('대국이 끝나지 않음');
    playRoundOut(game.round as RoundState, bots, stats);
    advanceGame(game);
  }
  const standings = (game.standings ?? [])
    .map((s) => `${s.seat}:${s.rawScore}:${s.uma}`)
    .join('|');
  return `${game.endReason}#${game.history.length}#${standings}`;
}

export function formatStats(stats: SimulationStats): string {
  const yaku = [...stats.yakuCounts.entries()].sort((a, b) => b[1] - a[1]);
  const yakuman = [...stats.yakumanCounts.entries()].sort((a, b) => b[1] - a[1]);
  const lines = [
    `대국 ${stats.games} / 국 ${stats.rounds}`,
    `화료 ${stats.wins} (쯔모 ${stats.tsumoWins} · 론 ${stats.ronWins} · 더블론 ${stats.doubleRons})`,
    `황패유국 ${stats.exhaustive} / 도중유국 ${JSON.stringify(stats.abortive)}`,
    `리치 ${stats.riichiDeclared} / 울기 ${stats.callsMade}`,
    `야쿠 상위: ${yaku
      .slice(0, 12)
      .map(([id, n]) => `${id}=${n}`)
      .join(', ')}`,
    `역만: ${yakuman.map(([id, n]) => `${id}=${n}`).join(', ') || '없음'}`,
  ];
  return lines.join('\n');
}
