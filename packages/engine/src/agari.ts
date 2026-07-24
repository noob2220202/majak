import { enumerateDecompositions, type Decomposition } from './decompose';
import { calculateFu } from './fu';
import { isKan, meldKind, type Meld } from './meld';
import { basePointsOf, yakumanBasePoints, type LimitName } from './score';
import { doraKindFromIndicator, isDragon, isRedFiveId, isWind, kindOfTile } from './tiles';
import type { TileId, TileKind } from './types';
import {
  evaluateDecomposition,
  type WinInput,
  type YakuEntry,
  type YakumanEntry,
} from './yaku';

/** 화료 종합 판정 입력 */
export interface AgariInput extends WinInput {
  /** 은닉 부분 실물 패 id (화료패 포함) — 적도라 계산용 */
  readonly concealedTileIds: readonly TileId[];
  /** 공개된 도라표시패 종류 */
  readonly doraIndicators: readonly TileKind[];
  /** 우라도라표시패 종류 (리치 화료자만, 룰 OFF면 빈 배열) */
  readonly uraIndicators: readonly TileKind[];
}

export interface AgariResult {
  readonly yakuman: readonly YakumanEntry[];
  /** 일반역 + 도라 엔트리 (역만이면 빈 배열) */
  readonly yaku: readonly YakuEntry[];
  /** 총 판수 (도라 포함, 역만이면 0) */
  readonly han: number;
  /** 역만 배수 합 (역만 아니면 0) */
  readonly yakumanPower: number;
  readonly fu: number;
  readonly basePoints: number;
  readonly limit: LimitName;
  /** 파오 대상이 되는 부로 인덱스 (대삼원·대사희 완성 울기), 없으면 null */
  readonly paoMeldIndex: number | null;
  /** 채택된 해석 (디버그·복기용) */
  readonly decomposition: Decomposition;
}

/** 도라·적도라·우라도라 엔트리 계산 (역이 확정된 뒤에만 가산) */
function doraEntries(input: AgariInput): YakuEntry[] {
  const out: YakuEntry[] = [];
  const allKinds: TileKind[] = input.concealedTileIds.map(kindOfTile);
  const allIds: TileId[] = [...input.concealedTileIds];
  for (const meld of input.melds) {
    for (const id of meld.tiles) {
      allKinds.push(kindOfTile(id));
      allIds.push(id);
    }
  }

  let dora = 0;
  for (const indicator of input.doraIndicators) {
    const target = doraKindFromIndicator(indicator);
    dora += allKinds.filter((k) => k === target).length;
  }
  if (dora > 0) out.push({ id: 'dora', name: '도라', han: dora });

  if (input.rules.redFives) {
    const aka = allIds.filter((id) => isRedFiveId(id)).length;
    if (aka > 0) out.push({ id: 'akaDora', name: '적도라', han: aka });
  }

  if (input.uraIndicators.length > 0) {
    let ura = 0;
    for (const indicator of input.uraIndicators) {
      const target = doraKindFromIndicator(indicator);
      ura += allKinds.filter((k) => k === target).length;
    }
    if (ura > 0) out.push({ id: 'uraDora', name: '우라도라', han: ura });
  }
  return out;
}

/**
 * 파오(책임지불) 판정: 대삼원의 3번째 삼원 면자 / 대사희의 4번째 풍 면자가
 * 울기로 완성된 경우 그 부로의 인덱스를 돌려준다 (§2.6).
 */
function findPaoMeldIndex(
  yakuman: readonly YakumanEntry[],
  input: AgariInput,
): number | null {
  if (!input.rules.pao) return null;
  const hasDaisangen = yakuman.some((y) => y.id === 'daisangen');
  const hasDaisuushii = yakuman.some((y) => y.id === 'daisuushii');
  if (!hasDaisangen && !hasDaisuushii) return null;

  const check = (predicate: (k: TileKind) => boolean, required: number): number | null => {
    const meldIndexes: number[] = [];
    input.melds.forEach((meld, index) => {
      if (meld.type !== 'chi' && predicate(meldKind(meld))) meldIndexes.push(index);
    });
    if (meldIndexes.length !== required) return null; // 일부가 손안 안커면 파오 없음
    const last = meldIndexes[meldIndexes.length - 1] as number;
    const lastMeld = input.melds[last] as Meld;
    if (lastMeld.type === 'ankan') return null; // 스스로 뽑은 안깡은 책임 없음
    return last;
  };

  if (hasDaisangen) {
    const idx = check(isDragon, 3);
    if (idx !== null) return idx;
  }
  if (hasDaisuushii) {
    const idx = check(isWind, 4);
    if (idx !== null) return idx;
  }
  return null;
}

/**
 * 화료 종합 판정: 모든 해석을 열거해 고점법(역만 배수 → 판수 → 부수)으로
 * 최고 해석을 채택한다. 역이 하나도 없으면 null (화료 불가 — 役 없음).
 */
export function evaluateWin(input: AgariInput): AgariResult | null {
  const decomps = enumerateDecompositions(
    input.concealedCounts,
    input.melds.length,
    input.winningKind,
  );
  if (decomps.length === 0) return null;

  let best: AgariResult | null = null;
  const dora = doraEntries(input);
  const doraHan = dora.reduce((sum, d) => sum + d.han, 0);

  for (const decomp of decomps) {
    const result = evaluateDecomposition(decomp, input);
    let candidate: AgariResult | null = null;

    if (result.yakuman.length > 0) {
      const power = result.yakuman.reduce((sum, y) => sum + y.power, 0);
      const { basePoints, limit } = yakumanBasePoints(power);
      candidate = {
        yakuman: result.yakuman,
        yaku: [],
        han: 0,
        yakumanPower: power,
        fu: calculateFu(decomp, input, result),
        basePoints,
        limit,
        paoMeldIndex: findPaoMeldIndex(result.yakuman, input),
        decomposition: decomp,
      };
    } else if (result.yaku.length > 0) {
      const fu = calculateFu(decomp, input, result);
      const yakuWithDora = [...result.yaku, ...dora];
      const han = result.yaku.reduce((sum, y) => sum + y.han, 0) + doraHan;
      const { basePoints, limit } = basePointsOf(han, fu, input.rules);
      candidate = {
        yakuman: [],
        yaku: yakuWithDora,
        han,
        yakumanPower: 0,
        fu,
        basePoints,
        limit,
        paoMeldIndex: null,
        decomposition: decomp,
      };
    }

    if (!candidate) continue;
    if (
      !best ||
      candidate.yakumanPower > best.yakumanPower ||
      (candidate.yakumanPower === best.yakumanPower &&
        (candidate.han > best.han ||
          (candidate.han === best.han && candidate.fu > best.fu)))
    ) {
      best = candidate;
    }
  }
  return best;
}

/** 부로를 포함한 전체 깡 수 (사깡산료·스깡즈 판정 보조) */
export function kanCount(melds: readonly Meld[]): number {
  return melds.filter(isKan).length;
}
