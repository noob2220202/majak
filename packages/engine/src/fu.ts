import type { Decomposition } from './decompose';
import { isDragon, isYaochuu } from './tiles';
import { buildGroups, isMenzen, type WinInput, type YakuResult } from './yaku';

/**
 * 부(符) 계산 (PLAN.md §2.8).
 * 치토이츠 25부 고정(절상 없음), 핑후 쯔모 20부, 울고 핑후형 론 30부 특례 포함.
 */
export function calculateFu(decomp: Decomposition, input: WinInput, result: YakuResult): number {
  if (decomp.kind === 'chiitoi') return 25;
  if (decomp.kind === 'kokushi') return 0; // 역만 — 부 무의미

  const menzen = isMenzen(input.melds);
  const hasPinfu = result.yaku.some((y) => y.id === 'pinfu');
  let fu = 20;

  // 화료 방식
  if (input.winType === 'ron' && menzen) fu += 10;
  if (input.winType === 'tsumo' && !hasPinfu) fu += 2;

  // 대기
  if (decomp.wait === 'kanchan' || decomp.wait === 'penchan' || decomp.wait === 'tanki') {
    fu += 2;
  }

  // 머리
  if (isDragon(decomp.pair)) {
    fu += 2;
  } else {
    const seat = decomp.pair === input.seatWind;
    const round = decomp.pair === input.roundWind;
    if (seat && round) fu += input.rules.renpuuJantouFu;
    else if (seat || round) fu += 2;
  }

  // 면자
  for (const g of buildGroups(decomp, input)) {
    if (g.type === 'run') continue;
    let value = g.type === 'kan' ? 8 : 2;
    if (g.concealed) value *= 2;
    if (isYaochuu(g.start)) value *= 2;
    fu += value;
  }

  // 울고 핑후형 론 = 30부 처리
  if (fu === 20 && input.winType === 'ron') fu = 30;

  // 10부 절상
  return Math.ceil(fu / 10) * 10;
}
