import { describe, expect, it } from 'vitest';
import {
  chiitoiShanten,
  countsFromNotation,
  createRng,
  isTenpai,
  kokushiShanten,
  nextInt,
  shanten,
  standardShanten,
  TILE_KIND_COUNT,
  winningKinds,
} from '../src';

/** [표기, 부로 수, 기대 샹텐] */
const KNOWN_CASES: Array<[string, number, number]> = [
  // ── 화료형 (-1) ──
  ['123m456m789m123p11z', 0, -1],
  ['123m456p789s11122z', 0, -1],
  ['11122233344455m', 0, -1], // 스안커 형태
  ['22345678m234p567s', 0, -1],
  ['1122m3344p5566s77z', 0, -1], // 치토이츠
  ['19m19p19s12345677z', 0, -1], // 국사무쌍
  ['11123m', 3, -1], // 부로 3 + 111m/123m + ... = 11 머리 화료
  ['11m', 4, -1], // 부로 4 + 머리
  // ── 텐파이 (0) ──
  ['123m456p789s1122z', 0, 0], // 샨퐁
  ['123m456p78s11122z', 0, 0], // 량면
  ['123m456p789s1112z', 0, 0], // 단기
  ['2345678m123p111s', 0, 0], // 다면 대기
  ['1234567m111p345s', 0, 0],
  ['19m19p19s1234567z', 0, 0], // 국사 13면
  ['19m19p19s1234566z', 0, 0], // 국사 단일 대기
  ['1122m3344p556s77z', 0, 0], // 치토이 텐파이
  ['1124m', 3, 0], // 부로 3 + 머리 + 간짱
  ['1m', 4, 0], // 부로 4 + 단기
  // ── 1샹텐 ──
  ['123m456p12p78s11z7z', 0, 1],
  ['1122m3344p1556s7z', 0, 1], // 치토이 1샹텐 (5쌍)
  ['19m19p19s123456z5m', 0, 1], // 국사 12종 노페어
  ['1245m112p', 2, 1],
  ['123m456p789s14s22z', 0, 1], // 3면자 + 머리 + 고립 2장
  // ── 2샹텐 이상 ──
  ['19m19p19s12345z22m', 0, 2], // 국사 11종 (수패 머리는 무효)
  ['1245m1245p1245s1z', 0, 4], // 타쯔 6개지만 상한 4
  ['147m147p147s1234z', 0, 6], // 완전 고립 → 치토이 경로가 최소
  ['258m258p258s1234z', 0, 6],
  // ── 형태별 개별 계산기 ──
];

describe('샹텐 — 알려진 손 (수작성)', () => {
  for (const [notation, melds, expected] of KNOWN_CASES) {
    it(`${notation} (부로 ${melds}) → ${expected}`, () => {
      expect(shanten(countsFromNotation(notation), melds)).toBe(expected);
    });
  }

  it('개별 계산기 값', () => {
    // 치토이: 같은 패 4장은 쌍 1개로만 계산 + 7종 미달 보정
    expect(chiitoiShanten(countsFromNotation('1111m223344p556s'))).toBe(2);
    // 국사: 부로가 있으면 불가
    expect(kokushiShanten(countsFromNotation('19m19p19s1234z'), 1)).toBe(Number.POSITIVE_INFINITY);
    // 일반형: 부로 반영
    expect(standardShanten(countsFromNotation('19m19p19s1234z'), 1)).toBeGreaterThan(0);
  });

  it('대기패 계산 — 량면·샨퐁·단기·국사13면', () => {
    expect(winningKinds(countsFromNotation('123m456p78s11122z'))).toEqual([23, 26]); // 6s, 9s
    expect(winningKinds(countsFromNotation('123m456p789s1122z'))).toEqual([27, 28]); // 1z, 2z
    expect(winningKinds(countsFromNotation('123m456p789s1112z'))).toEqual([28]); // 2z 단기
    expect(winningKinds(countsFromNotation('19m19p19s1234567z'))).toHaveLength(13);
    expect(isTenpai(countsFromNotation('123m456p789s1122z'))).toBe(true);
    expect(isTenpai(countsFromNotation('147m147p147s1234z'))).toBe(false);
  });

  it('자기 손에 4장 있는 종류는 대기에서 제외된다 (카라텐 처리 기반)', () => {
    // 1111m234m...: 1m 대기(단기)는 4장 전부 보유라 제외, 4m 대기(111m+123m+44m)만 남는다
    const a = countsFromNotation('1111m234m456p789s');
    expect(a.reduce((x, y) => x + y, 0)).toBe(13);
    expect(winningKinds(a)).toEqual([3]); // 4m
    // 2222m345m...: 2m 제외, 5m 대기(222m+345m+55m)만
    const b = countsFromNotation('2222m345m456p789s');
    expect(winningKinds(b)).toEqual([4]); // 5m
    expect(winningKinds(b)).not.toContain(1);
  });

  it('머리+타쯔 2+2 분할 유령 텐파이 방지 (같은 종류 4장)', () => {
    // 66m 7777m 45m 8m 백×4: 백을 머리+커쯔후보로 2+2 분할하면 가짜 텐파이가 된다
    const counts = countsFromNotation('456678m7788m111z');
    expect(counts.reduce((x, y) => x + y, 0)).toBe(13);
    // 위 손과 별개로, 실패 사례를 직접 고정: 4m5m66m7777m8m + 백×4
    const freak = countsFromNotation('45m66m77778m1111z');
    expect(freak.reduce((x, y) => x + y, 0)).toBe(13);
    expect(shanten(freak)).toBe(1); // 유령 타쯔로 0이 되면 안 됨
  });
});

// ──────────────────────────────────────────────────────────────────
// 브루트포스 대조 (differential testing, PLAN §8.1)
//
// 축소 우주(1~9만 + 백·발)에서 화료형 14장을 전수 열거해 두고,
// shanten(h) = min over W (h에서 W까지 부족한 장수) - 1 이라는 정의로
// 정확한 샹텐을 계산해 엔진 결과와 대조한다.
// ──────────────────────────────────────────────────────────────────

const UNIVERSE: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 31, 32]; // 1m..9m, 백, 발

interface WinHand {
  counts: number[];
}

function buildWinningHands(): WinHand[] {
  // 면자 타입: 커쯔 11종 + 슌쯔 7종 (123m..789m)
  const setTypes: number[][] = [];
  for (const k of UNIVERSE) {
    const c = new Array<number>(TILE_KIND_COUNT).fill(0);
    c[k] = 3;
    setTypes.push(c);
  }
  for (let start = 0; start <= 6; start++) {
    const c = new Array<number>(TILE_KIND_COUNT).fill(0);
    c[start] = 1;
    c[start + 1] = 1;
    c[start + 2] = 1;
    setTypes.push(c);
  }

  const seen = new Set<string>();
  const hands: WinHand[] = [];
  const tryAdd = (counts: number[]): void => {
    if (counts.some((c) => c > 4)) return;
    const key = counts.join(',');
    if (seen.has(key)) return;
    seen.add(key);
    hands.push({ counts });
  };

  // 일반형: 면자 4 + 머리 (타입 중복 허용 조합)
  const n = setTypes.length;
  for (let a = 0; a < n; a++)
    for (let b = a; b < n; b++)
      for (let c = b; c < n; c++)
        for (let d = c; d < n; d++) {
          const base = new Array<number>(TILE_KIND_COUNT).fill(0);
          for (const st of [setTypes[a], setTypes[b], setTypes[c], setTypes[d]]) {
            for (let k = 0; k < TILE_KIND_COUNT; k++) base[k] += (st as number[])[k] as number;
          }
          if (base.some((x) => x > 4)) continue;
          for (const pk of UNIVERSE) {
            const full = base.slice();
            (full[pk] as number) += 2;
            tryAdd(full);
          }
        }

  // 치토이츠: 우주에서 7종 선택
  const pick = (start: number, chosen: number[]): void => {
    if (chosen.length === 7) {
      const c = new Array<number>(TILE_KIND_COUNT).fill(0);
      for (const k of chosen) c[k] = 2;
      tryAdd(c);
      return;
    }
    for (let i = start; i < UNIVERSE.length; i++) pick(i + 1, [...chosen, UNIVERSE[i] as number]);
  };
  pick(0, []);

  return hands;
}

function bruteShanten(counts: readonly number[], winHands: readonly WinHand[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const w of winHands) {
    let missing = 0;
    for (const k of UNIVERSE) {
      const need = (w.counts[k] as number) - (counts[k] as number);
      if (need > 0) missing += need;
    }
    if (missing - 1 < best) best = missing - 1;
  }
  return best;
}

describe('샹텐 — 브루트포스 대조 (축소 우주 400손)', () => {
  const winHands = buildWinningHands();

  it('화료형 전수 열거가 유효하다', () => {
    expect(winHands.length).toBeGreaterThan(1000);
    for (const w of winHands.slice(0, 50)) {
      expect(w.counts.reduce((a, b) => a + b, 0)).toBe(14);
    }
  });

  it('무작위 400손에서 엔진 샹텐 == 브루트포스 샹텐', () => {
    const rng = createRng('shanten-differential-v1');
    // 우주 전체 패 풀 (종류당 4장)
    for (let trial = 0; trial < 400; trial++) {
      const counts = new Array<number>(TILE_KIND_COUNT).fill(0);
      // 절반은 구조적 생성(면자·타쯔 섞기)으로 낮은 샹텐도 커버
      if (trial % 2 === 0) {
        let tiles = 0;
        while (tiles < 13) {
          const mode = nextInt(rng, 3);
          if (mode === 0 && tiles <= 10) {
            // 슌쯔 or 커쯔
            if (nextInt(rng, 2) === 0) {
              const start = nextInt(rng, 7);
              if (
                (counts[start] as number) < 4 &&
                (counts[start + 1] as number) < 4 &&
                (counts[start + 2] as number) < 4
              ) {
                (counts[start] as number)++;
                (counts[start + 1] as number)++;
                (counts[start + 2] as number)++;
                tiles += 3;
              }
            } else {
              const k = UNIVERSE[nextInt(rng, UNIVERSE.length)] as number;
              if ((counts[k] as number) <= 1) {
                counts[k] = (counts[k] as number) + 3;
                tiles += 3;
              }
            }
          } else if (mode === 1 && tiles <= 11) {
            const k = UNIVERSE[nextInt(rng, UNIVERSE.length)] as number;
            if ((counts[k] as number) <= 2) {
              counts[k] = (counts[k] as number) + 2;
              tiles += 2;
            }
          } else {
            const k = UNIVERSE[nextInt(rng, UNIVERSE.length)] as number;
            if ((counts[k] as number) < 4) {
              counts[k] = (counts[k] as number) + 1;
              tiles += 1;
            }
          }
        }
      } else {
        // 완전 무작위
        for (let t = 0; t < 13; t++) {
          let k = UNIVERSE[nextInt(rng, UNIVERSE.length)] as number;
          while ((counts[k] as number) >= 4) k = UNIVERSE[nextInt(rng, UNIVERSE.length)] as number;
          counts[k] = (counts[k] as number) + 1;
        }
      }

      const expected = bruteShanten(counts, winHands);
      const actual = shanten(counts);
      if (actual !== expected) {
        const notation = counts
          .map((c, k) => `${k}:${c}`)
          .filter((s) => !s.endsWith(':0'))
          .join(' ');
        throw new Error(`불일치 (trial ${trial}): ${notation} 엔진=${actual} 브루트=${expected}`);
      }
    }
  });
});
