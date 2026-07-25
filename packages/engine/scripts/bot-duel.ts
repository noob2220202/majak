/**
 * 봇 v1 vs v2 맞대결 (개발용 계측 스크립트).
 *
 *   pnpm --filter @cheongiwa/engine duel 400
 *
 * 같은 시드로 배치를 뒤집어 두 번 돌려 자리 유불리(친 순서)를 상쇄한다.
 * 결과는 좌석당 평균 소프트 점수·순위 분포·화료/방총 횟수로 본다.
 */
import {
  DEFAULT_RULES,
  advanceGame,
  applyAction,
  createBotV1,
  createBotV2,
  reactionOffers,
  startGame,
  SEATS,
  type Bot,
  type RoundState,
} from '../src/index';

const GAMES = Number(process.argv[2] ?? 200);

interface Tally {
  points: number;
  top1: number;
  top2: number;
  last: number;
  wins: number;
  deals: number;
  riichi: number;
  seats: number;
}

const blank = (): Tally => ({
  points: 0,
  top1: 0,
  top2: 0,
  last: 0,
  wins: 0,
  deals: 0,
  riichi: 0,
  seats: 0,
});

/** simulate.ts 의 playRoundOut 과 같은 순서로 국을 끝까지 돌린다 */
function playRound(round: RoundState, bots: readonly Bot[], riichiBySeat: number[]): void {
  let actions = 0;
  while (round.phase !== 'ended') {
    if (++actions > 3000) throw new Error('국이 끝나지 않음');
    if (round.phase === 'turn') {
      const seat = round.active;
      const action = (bots[seat] as Bot).chooseTurnAction(round, seat);
      if (action.type === 'discard' && action.riichi) riichiBySeat[seat] = (riichiBySeat[seat] ?? 0) + 1;
      applyAction(round, seat, action);
    } else {
      const seats = [...reactionOffers(round).keys()].sort((a, b) => a - b);
      for (const seat of seats) {
        applyAction(round, seat, (bots[seat] as Bot).chooseReaction(round, seat));
        if (round.phase !== 'reaction') break;
      }
    }
  }
}

function playGame(seed: string, v2Seats: ReadonlySet<number>) {
  const bots: Bot[] = SEATS.map((s) => (v2Seats.has(s) ? createBotV2() : createBotV1()));
  const game = startGame({ rules: DEFAULT_RULES, seed });
  const riichi = SEATS.map(() => 0);
  const wins = SEATS.map(() => 0);
  const deals = SEATS.map(() => 0);

  let guard = 0;
  while (game.phase === 'playing') {
    if (++guard > 200) throw new Error('국 수 한도 초과');
    const round = game.round;
    if (!round) break;
    playRound(round, bots, riichi);
    const res = round.result;
    if (res?.type === 'win') {
      for (const w of res.wins) {
        wins[w.seat] = (wins[w.seat] ?? 0) + 1;
        if (w.from !== null) deals[w.from] = (deals[w.from] ?? 0) + 1;
      }
    }
    advanceGame(game);
  }
  return { standings: game.standings ?? [], riichi, wins, deals };
}

const v2 = blank();
const v1 = blank();

for (let g = 0; g < GAMES; g++) {
  for (const layout of [new Set([0, 2]), new Set([1, 3])]) {
    const { standings, riichi, wins, deals } = playGame(`duel-${g}`, layout);
    for (const st of standings) {
      const t = layout.has(st.seat) ? v2 : v1;
      t.seats++;
      t.points += st.finalPoints;
      if (st.rank === 1) t.top1++;
      if (st.rank <= 2) t.top2++;
      if (st.rank === 4) t.last++;
    }
    for (const s of SEATS) {
      const t = layout.has(s) ? v2 : v1;
      t.wins += wins[s] ?? 0;
      t.deals += deals[s] ?? 0;
      t.riichi += riichi[s] ?? 0;
    }
  }
}

const row = (name: string, t: Tally): string =>
  `${name}  평균 ${(t.points / t.seats).toFixed(2).padStart(6)}점` +
  `  1위 ${((t.top1 / t.seats) * 100).toFixed(1).padStart(5)}%` +
  `  연대 ${((t.top2 / t.seats) * 100).toFixed(1).padStart(5)}%` +
  `  4위 ${((t.last / t.seats) * 100).toFixed(1).padStart(5)}%` +
  `  화료 ${(t.wins / t.seats).toFixed(2)}  방총 ${(t.deals / t.seats).toFixed(2)}` +
  `  리치 ${(t.riichi / t.seats).toFixed(2)}`;

console.log(`${GAMES}반장 × 배치 2가지 · 좌석 표본 v2 ${v2.seats} / v1 ${v1.seats}`);
console.log(row('v2', v2));
console.log(row('v1', v1));
console.log(
  `\n평균 점수 차 ${((v2.points / v2.seats - v1.points / v1.seats)).toFixed(2)}점 (v2 - v1)`,
);
