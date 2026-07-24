import { HONOR_START, TILE_KIND_COUNT, YAOCHUU_KINDS } from './tiles';
import type { TileKind } from './types';

/**
 * 화료한 손(부로 제외 은닉 부분, 화료패 포함)의 모든 해석을 열거한다.
 * 고점법(§2.6)은 이 목록 전체에 대해 판수→부수를 비교해 최댓값을 채택한다.
 */

/** 은닉 부분에서 뽑아낸 면자 */
export interface HandSet {
  readonly type: 'run' | 'triplet';
  /** run이면 시작 종류, triplet이면 그 종류 */
  readonly start: TileKind;
}

export type WaitKind = 'ryanmen' | 'kanchan' | 'penchan' | 'shanpon' | 'tanki';

/** 일반형 해석 하나 (화료패 배치까지 확정된 상태) */
export interface StandardDecomposition {
  readonly kind: 'standard';
  readonly pair: TileKind;
  readonly sets: readonly HandSet[];
  /** 화료패가 속한 그룹: sets 인덱스, 머리면 -1 */
  readonly winGroupIndex: number;
  readonly wait: WaitKind;
}

export interface ChiitoiDecomposition {
  readonly kind: 'chiitoi';
  readonly pairs: readonly TileKind[];
}

export interface KokushiDecomposition {
  readonly kind: 'kokushi';
  readonly pairKind: TileKind;
  /** 화료패를 빼기 전 13장이 13종을 모두 갖췄는가 (13면 대기) */
  readonly thirteenWait: boolean;
}

export type Decomposition = StandardDecomposition | ChiitoiDecomposition | KokushiDecomposition;

/** 남은 counts를 면자만으로 전부 분해 (모든 조합) */
function decomposeSets(counts: number[], from: number, acc: HandSet[], out: HandSet[][]): void {
  let i = from;
  while (i < TILE_KIND_COUNT && counts[i] === 0) i++;
  if (i === TILE_KIND_COUNT) {
    out.push([...acc]);
    return;
  }
  const c = counts[i] as number;
  // 커쯔
  if (c >= 3) {
    counts[i] = c - 3;
    acc.push({ type: 'triplet', start: i });
    decomposeSets(counts, i, acc, out);
    acc.pop();
    counts[i] = c;
  }
  // 슌쯔 (수패, 같은 수트 내에서만)
  if (i < HONOR_START && i % 9 <= 6) {
    const c1 = counts[i + 1] as number;
    const c2 = counts[i + 2] as number;
    if (c1 > 0 && c2 > 0) {
      counts[i] = c - 1;
      counts[i + 1] = c1 - 1;
      counts[i + 2] = c2 - 1;
      acc.push({ type: 'run', start: i });
      decomposeSets(counts, i, acc, out);
      acc.pop();
      counts[i] = c;
      counts[i + 1] = c1;
      counts[i + 2] = c2;
    }
  }
}

function waitKindOf(set: HandSet, winKind: TileKind): WaitKind {
  if (set.type === 'triplet') return 'shanpon';
  const pos = winKind - set.start; // 0, 1, 2
  if (pos === 1) return 'kanchan';
  // 12+3 또는 89+7 형태만 펜짱
  if (set.start % 9 === 0 && pos === 2) return 'penchan';
  if (set.start % 9 === 6 && pos === 0) return 'penchan';
  return 'ryanmen';
}

/**
 * 일반형 해석 전체 열거.
 * counts: 은닉 부분(화료패 포함, 14 - 3×부로 장).
 * winKind: 화료패 종류. 화료패가 들어갈 수 있는 모든 그룹 배치를 각각 별개 해석으로 낸다.
 */
export function enumerateStandard(
  counts: readonly number[],
  meldCount: number,
  winKind: TileKind,
): StandardDecomposition[] {
  const out: StandardDecomposition[] = [];
  const work = counts.slice();
  for (let pair = 0; pair < TILE_KIND_COUNT; pair++) {
    if ((work[pair] as number) < 2) continue;
    work[pair] = (work[pair] as number) - 2;
    const setCombos: HandSet[][] = [];
    decomposeSets(work, 0, [], setCombos);
    work[pair] = (work[pair] as number) + 2;

    for (const sets of setCombos) {
      if (sets.length !== 4 - meldCount) continue;
      // 화료패 배치: 머리(단기) 또는 화료패를 포함하는 각 면자
      if (pair === winKind) {
        out.push({ kind: 'standard', pair, sets, winGroupIndex: -1, wait: 'tanki' });
      }
      const seen = new Set<string>();
      sets.forEach((set, index) => {
        const contains =
          set.type === 'triplet'
            ? set.start === winKind
            : winKind >= set.start && winKind <= set.start + 2;
        if (!contains) return;
        // 동일 형태 면자에 대한 중복 배치 제거 (예: 같은 슌쯔 2개)
        const key = `${set.type}:${set.start}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.push({
          kind: 'standard',
          pair,
          sets,
          winGroupIndex: index,
          wait: waitKindOf(set, winKind),
        });
      });
    }
  }
  return out;
}

/** 치토이츠 해석 (멘젠 한정, 7종 각 2장) */
export function enumerateChiitoi(
  counts: readonly number[],
  meldCount: number,
): ChiitoiDecomposition | null {
  if (meldCount > 0) return null;
  const pairs: TileKind[] = [];
  for (let k = 0; k < TILE_KIND_COUNT; k++) {
    const c = counts[k] as number;
    if (c === 0) continue;
    if (c !== 2) return null;
    pairs.push(k);
  }
  return pairs.length === 7 ? { kind: 'chiitoi', pairs } : null;
}

/** 국사무쌍 해석 (멘젠 한정) */
export function enumerateKokushi(
  counts: readonly number[],
  meldCount: number,
  winKind: TileKind,
): KokushiDecomposition | null {
  if (meldCount > 0) return null;
  let pairKind = -1;
  for (let k = 0; k < TILE_KIND_COUNT; k++) {
    const c = counts[k] as number;
    if (c === 0) continue;
    if (!YAOCHUU_KINDS.includes(k)) return null;
    if (c === 2) {
      if (pairKind >= 0) return null;
      pairKind = k;
    } else if (c !== 1) {
      return null;
    }
  }
  if (pairKind < 0) return null;
  // 13종 전부 있는지 (1장 종류 12 + 2장 종류 1)
  for (const k of YAOCHUU_KINDS) {
    if ((counts[k] as number) === 0) return null;
  }
  // 13면 대기: 화료패를 빼도 13종이 모두 남아 있었는가
  const thirteenWait = pairKind === winKind;
  return { kind: 'kokushi', pairKind, thirteenWait };
}

/** 모든 해석 열거 (일반형 + 치토이 + 국사) */
export function enumerateDecompositions(
  counts: readonly number[],
  meldCount: number,
  winKind: TileKind,
): Decomposition[] {
  const out: Decomposition[] = [...enumerateStandard(counts, meldCount, winKind)];
  const chiitoi = enumerateChiitoi(counts, meldCount);
  if (chiitoi) out.push(chiitoi);
  const kokushi = enumerateKokushi(counts, meldCount, winKind);
  if (kokushi) out.push(kokushi);
  return out;
}
