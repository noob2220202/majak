import type { RuleSettings } from './rules';

/**
 * 점수표 (PLAN.md §2.8).
 * 기본점 = 부 × 2^(2+판), 2,000 초과는 만관 이상 등급으로 절삭.
 */

export type LimitName = '만관' | '하네만' | '배만' | '삼배만' | '역만' | null;

export interface BasePointsResult {
  readonly basePoints: number;
  readonly limit: LimitName;
}

/** 일반역 화료의 기본점 (역만은 yakumanBasePoints 사용) */
export function basePointsOf(han: number, fu: number, rules: RuleSettings): BasePointsResult {
  if (han >= 13 && rules.kazoeYakuman) return { basePoints: 8000, limit: '역만' };
  if (han >= 11) return { basePoints: 6000, limit: '삼배만' };
  if (han >= 8) return { basePoints: 4000, limit: '배만' };
  if (han >= 6) return { basePoints: 3000, limit: '하네만' };

  if (rules.kiriageMangan && ((han === 4 && fu === 30) || (han === 3 && fu === 60))) {
    return { basePoints: 2000, limit: '만관' };
  }
  const raw = fu * Math.pow(2, 2 + han);
  if (raw > 2000) return { basePoints: 2000, limit: '만관' };
  return { basePoints: raw, limit: null };
}

/** 역만 기본점 (power 합계 = 역만 배수, 더블·복합 포함) */
export function yakumanBasePoints(totalPower: number): BasePointsResult {
  return { basePoints: 8000 * totalPower, limit: '역만' };
}

const ceil100 = (v: number): number => Math.ceil(v / 100) * 100;

/** 론 화료 시 방총자가 내는 점수 (본장 제외) */
export function ronPoints(basePoints: number, winnerIsDealer: boolean): number {
  return ceil100(basePoints * (winnerIsDealer ? 6 : 4));
}

export interface TsumoPayments {
  /** 친이 내는 점수 (화료자가 친이면 사용 안 함) */
  readonly fromDealer: number;
  /** 자 각각이 내는 점수 */
  readonly fromNonDealer: number;
}

/** 쯔모 화료 시 각자 부담 (본장 제외, 개별 100점 절상) */
export function tsumoPayments(basePoints: number, winnerIsDealer: boolean): TsumoPayments {
  if (winnerIsDealer) {
    const each = ceil100(basePoints * 2);
    return { fromDealer: 0, fromNonDealer: each };
  }
  return { fromDealer: ceil100(basePoints * 2), fromNonDealer: ceil100(basePoints) };
}
