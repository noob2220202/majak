import {
  countsFromKinds,
  evaluateWin,
  isTenpai,
  kindOfTile,
  ronPoints,
  winningKinds,
  type Meld,
  type RuleSettings,
  type Seat,
  type TileId,
} from '@cheongiwa/engine';
import type { RoundStartView } from '@cheongiwa/protocol';
import { seatWind } from './geometry';

export interface WaitInfo {
  kind: number;
  /** 예상 판수 (도라 포함, 론 기준). null = 역 없음 */
  han: number | null;
  /** 예상 론 점수 */
  points: number | null;
}

/** 13장 손패(부로 제외)의 대기패 + 예상 점수 (§5.3) */
export function analyzeWaits(
  handKinds: number[],
  melds: Meld[],
  handIds: TileId[],
  round: RoundStartView,
  mySeat: Seat,
  rules: RuleSettings,
  riichiAccepted: boolean,
): WaitInfo[] {
  // 손패가 과도기 상태(장수 불일치)면 분석하지 않는다 — 엔진은 정확한 장수를 요구
  if (handKinds.length !== 13 - melds.length * 3) return [];
  const counts = countsFromKinds(handKinds);
  const waits = winningKinds(counts, melds.length);
  const isDealer = mySeat === round.dealer;
  return waits.map((kind) => {
    const result = evaluateWin({
      rules,
      concealedCounts: countsFromKinds([...handKinds, kind]),
      concealedTileIds: [...handIds, kind * 4 + 1],
      melds,
      winningKind: kind,
      winType: 'ron',
      seatWind: seatWind(mySeat, round.dealer),
      roundWind: round.roundWind,
      riichi: riichiAccepted,
      doubleRiichi: false,
      ippatsu: false,
      rinshan: false,
      chankan: false,
      haitei: false,
      houtei: false,
      tenhou: false,
      chihou: false,
      doraIndicators: round.doraIndicators,
      uraIndicators: [],
    });
    if (!result) return { kind, han: null, points: null };
    const han = result.yakuman.length > 0 ? -result.yakumanPower : result.han;
    return { kind, han, points: ronPoints(result.basePoints, isDealer) };
  });
}

/**
 * 14장(손패 + 쯔모) 중 버리면 텐파이가 되는 타패 종류 (유효패 힌트, §5.3).
 */
export function tenpaiDiscards(
  handKinds: number[],
  drawnKind: number | null,
  meldCount: number,
): Set<number> {
  const all = drawnKind !== null ? [...handKinds, drawnKind] : [...handKinds];
  // 타패 후 13-3×부로 장이 되는 상태에서만 유효 (14장 손패 기준)
  if (all.length !== 14 - meldCount * 3) return new Set();
  const result = new Set<number>();
  const seen = new Set<number>();
  for (const k of all) {
    if (seen.has(k)) continue;
    seen.add(k);
    const remaining = [...all];
    remaining.splice(remaining.indexOf(k), 1);
    if (isTenpai(countsFromKinds(remaining), meldCount)) result.add(k);
  }
  return result;
}

/** 후리텐: 대기패 중 하나라도 자기 버림패에 있으면 참 (§2.5) */
export function isFuritenLocal(waits: number[], myDiscards: TileId[]): boolean {
  if (waits.length === 0) return false;
  const discarded = new Set(myDiscards.map(kindOfTile));
  return waits.some((w) => discarded.has(w));
}
