import { HONOR_START, TILE_KIND_COUNT, YAOCHUU_KINDS } from './tiles';
import type { TileKind } from './types';

/**
 * 샹텐 계산기 (PLAN.md §8.1).
 *
 * 값: -1 = 화료형, 0 = 텐파이, n = n샹텐.
 *
 * 일반형은 "부족 장수 최소화" 정의를 그대로 계산한다:
 *   shanten = min over 유효한 화료형 W (종류당 ≤4장) of Σ max(0, W[k] − hand[k]) − 1
 * 수트별로 (면자 s개, 머리 p개)를 만드는 최소 추가 장수를 DP로 구하고
 * (전역 캐시), 그룹 결합으로 전체 최솟값을 얻는다. 종류당 4장 제한이 DP 안에
 * 강제되므로 "5번째 패가 필요한 유령 대기"가 원천적으로 생기지 않는다.
 */

const INF = 99;

/** 수트 벡터(9칸) → [s(0..4)][p(0..1)] 최소 추가 장수 테이블 (10칸 평탄화) */
const suitDistCache = new Map<number, Uint8Array>();

function encodeSuitVec(vec: readonly number[]): number {
  let key = 0;
  for (let i = 0; i < 9; i++) key = key * 5 + (vec[i] ?? 0);
  return key;
}

/**
 * 한 수트에서 슌쯔·커쯔 s개 + 머리 p개를 만들 때 필요한 최소 추가 장수.
 * 상태: (위치 i, 남은 면자 s, 남은 머리 p, 직전 시작 슌쯔 a, 전전 시작 슌쯔 b).
 * 각 위치 사용 장수(커쯔3 + 머리2 + 슌쯔 통과분)는 4장을 넘을 수 없다.
 */
function suitDistance(vec: readonly number[]): Uint8Array {
  const key = encodeSuitVec(vec);
  const cached = suitDistCache.get(key);
  if (cached) return cached;

  const memo = new Map<number, number>();

  const rec = (i: number, sRem: number, pRem: number, a: number, b: number): number => {
    if (i === 9) return sRem === 0 && pRem === 0 && a === 0 && b === 0 ? 0 : INF;
    const memoKey = ((((i * 5 + sRem) * 2 + pRem) * 5 + a) * 5 + b) | 0;
    const hit = memo.get(memoKey);
    if (hit !== undefined) return hit;

    const have = vec[i] as number;
    let best = INF;
    for (let t = 0; t <= Math.min(1, sRem); t++) {
      for (let q = 0; q <= pRem; q++) {
        const maxRuns = i <= 6 ? sRem - t : 0;
        for (let r = 0; r <= maxRuns; r++) {
          const used = 3 * t + 2 * q + a + b + r;
          if (used > 4) continue;
          const cost = used > have ? used - have : 0;
          if (cost >= best) continue;
          const rest = rec(i + 1, sRem - t - r, pRem - q, r, a);
          if (cost + rest < best) best = cost + rest;
        }
      }
    }
    memo.set(memoKey, best);
    return best;
  };

  const table = new Uint8Array(10);
  for (let s = 0; s <= 4; s++) {
    for (let p = 0; p <= 1; p++) {
      table[s * 2 + p] = rec(0, s, p, 0, 0);
    }
  }
  suitDistCache.set(key, table);
  return table;
}

/** 자패 7종에서 커쯔 s개 + 머리 p개를 만들 최소 추가 장수 (같은 종류에 커쯔+머리 중복 불가) */
function honorDistance(counts: readonly number[]): Uint8Array {
  let dp = new Uint8Array(10).fill(INF);
  dp[0] = 0;
  for (let k = HONOR_START; k < TILE_KIND_COUNT; k++) {
    const c = counts[k] as number;
    const tripletCost = c >= 3 ? 0 : 3 - c;
    const pairCost = c >= 2 ? 0 : 2 - c;
    const next = new Uint8Array(10).fill(INF);
    for (let s = 0; s <= 4; s++) {
      for (let p = 0; p <= 1; p++) {
        const cur = dp[s * 2 + p] as number;
        if (cur >= INF) continue;
        // 이 종류 미사용
        if (cur < (next[s * 2 + p] as number)) next[s * 2 + p] = cur;
        // 커쯔
        if (s < 4 && cur + tripletCost < (next[(s + 1) * 2 + p] as number)) {
          next[(s + 1) * 2 + p] = cur + tripletCost;
        }
        // 머리
        if (p < 1 && cur + pairCost < (next[s * 2 + 1] as number)) {
          next[s * 2 + 1] = cur + pairCost;
        }
      }
    }
    dp = next;
  }
  return dp;
}

function assertHandSize(counts: readonly number[], meldCount: number): number {
  let total = 0;
  for (let k = 0; k < TILE_KIND_COUNT; k++) {
    const c = counts[k] as number;
    if (!Number.isInteger(c) || c < 0 || c > 4) {
      throw new RangeError(`counts[${k}]가 유효하지 않음: ${c}`);
    }
    total += c;
  }
  const expect13 = 13 - meldCount * 3;
  const expect14 = 14 - meldCount * 3;
  if (total !== expect13 && total !== expect14) {
    throw new RangeError(`손패 장수 오류: ${total}장 (부로 ${meldCount})`);
  }
  return total;
}

/** 일반형(4면자 1머리) 샹텐 — 부족 장수 최소화 DP (정확) */
export function standardShanten(counts: readonly number[], meldCount = 0): number {
  assertHandSize(counts, meldCount);
  const targetSets = 4 - meldCount;

  const vec = new Array<number>(9);
  const tables: Uint8Array[] = [];
  for (let s = 0; s < 3; s++) {
    for (let i = 0; i < 9; i++) vec[i] = counts[s * 9 + i] as number;
    tables.push(suitDistance(vec));
  }
  tables.push(honorDistance(counts));

  // 그룹 결합: dp[s][p] = 최소 추가 장수
  let dp = new Uint8Array(10).fill(INF);
  dp[0] = 0;
  for (const table of tables) {
    const next = new Uint8Array(10).fill(INF);
    for (let s = 0; s <= 4; s++) {
      for (let p = 0; p <= 1; p++) {
        const cur = dp[s * 2 + p] as number;
        if (cur >= INF) continue;
        for (let ds = 0; ds + s <= 4; ds++) {
          for (let dq = 0; dq + p <= 1; dq++) {
            const add = table[ds * 2 + dq] as number;
            if (add >= INF) continue;
            const idx = (s + ds) * 2 + (p + dq);
            if (cur + add < (next[idx] as number)) next[idx] = cur + add;
          }
        }
      }
    }
    dp = next;
  }

  const needed = dp[targetSets * 2 + 1] as number;
  return needed >= INF ? 8 : needed - 1;
}

/** 치토이츠 샹텐 (멘젠 한정 — 부로가 있으면 불가). 같은 패 4장은 쌍 1개, 7종 미달 보정 포함. */
export function chiitoiShanten(counts: readonly number[], meldCount = 0): number {
  if (meldCount > 0) return Number.POSITIVE_INFINITY;
  let pairs = 0;
  let kinds = 0;
  for (let k = 0; k < TILE_KIND_COUNT; k++) {
    const c = counts[k] as number;
    if (c >= 1) kinds++;
    if (c >= 2) pairs++;
  }
  return 6 - pairs + Math.max(0, 7 - kinds);
}

/** 국사무쌍 샹텐 (멘젠 한정) */
export function kokushiShanten(counts: readonly number[], meldCount = 0): number {
  if (meldCount > 0) return Number.POSITIVE_INFINITY;
  let types = 0;
  let hasPair = false;
  for (const k of YAOCHUU_KINDS) {
    const c = counts[k] as number;
    if (c >= 1) types++;
    if (c >= 2) hasPair = true;
  }
  return 13 - types - (hasPair ? 1 : 0);
}

/** 종합 샹텐: 일반형·치토이·국사 중 최솟값 */
export function shanten(counts: readonly number[], meldCount = 0): number {
  let best = standardShanten(counts, meldCount);
  if (meldCount === 0) {
    const c = chiitoiShanten(counts);
    if (c < best) best = c;
    const k = kokushiShanten(counts);
    if (k < best) best = k;
  }
  return best;
}

/** 14장(부로 제외 손패 기준) 화료형인가 */
export function isAgariShape(counts: readonly number[], meldCount = 0): boolean {
  return shanten(counts, meldCount) === -1;
}

/**
 * 13장 손패의 대기패(화료패) 목록.
 * 자기 손에 이미 4장 있는 종류는 물리적으로 낼 수 없으므로 제외
 * (전부 그런 경우 = 순수 카라텐 → 대기 없음).
 */
export function winningKinds(counts: readonly number[], meldCount = 0): TileKind[] {
  const waits: TileKind[] = [];
  const work = counts.slice();
  for (let k = 0; k < TILE_KIND_COUNT; k++) {
    if ((work[k] as number) >= 4) continue;
    work[k] = (work[k] as number) + 1;
    if (shanten(work, meldCount) === -1) waits.push(k);
    work[k] = (work[k] as number) - 1;
  }
  return waits;
}

/** 13장 손패가 텐파이인가 — 유국 노텐벌부 판정 기준 (실제 낼 수 있는 대기가 있어야 함) */
export function isTenpai(counts: readonly number[], meldCount = 0): boolean {
  return winningKinds(counts, meldCount).length > 0;
}

/** 유효패: 뽑으면 샹텐이 줄어드는 종류 목록 (봇의 타패 평가용) */
export function usefulKinds(counts: readonly number[], meldCount = 0): TileKind[] {
  const current = shanten(counts, meldCount);
  const out: TileKind[] = [];
  const work = counts.slice();
  for (let k = 0; k < TILE_KIND_COUNT; k++) {
    if ((work[k] as number) >= 4) continue;
    work[k] = (work[k] as number) + 1;
    if (shanten(work, meldCount) < current) out.push(k);
    work[k] = (work[k] as number) - 1;
  }
  return out;
}
