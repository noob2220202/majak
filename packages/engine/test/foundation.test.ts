import { describe, expect, it } from 'vitest';
import {
  CHUN,
  countsFromNotation,
  createRng,
  doraKindFromIndicator,
  EAST,
  HAKU,
  HATSU,
  isSimple,
  isTerminal,
  isYaochuu,
  NORTH,
  nextInt,
  parseTiles,
  shuffleInPlace,
  tileKindToNotation,
  YAOCHUU_KINDS,
} from '../src';

describe('parseTiles (mpsz 표기 파싱)', () => {
  it('수패·자패·적5를 파싱한다', () => {
    const parsed = parseTiles('123m055p11z');
    expect(parsed.map((t) => tileKindToNotation(t.kind, t.red))).toEqual([
      '1m',
      '2m',
      '3m',
      '0p',
      '5p',
      '5p',
      '1z',
      '1z',
    ]);
    expect(parsed[3]?.red).toBe(true);
    expect(parsed[4]?.red).toBe(false);
  });

  it('counts로 변환한다', () => {
    const counts = countsFromNotation('111m19p777z');
    expect(counts[0]).toBe(3); // 1만 ×3
    expect(counts[9]).toBe(1); // 1통
    expect(counts[17]).toBe(1); // 9통
    expect(counts[33]).toBe(3); // 중 ×3
    expect(counts.reduce((a, b) => a + b, 0)).toBe(8);
  });

  it('잘못된 표기는 거부한다', () => {
    expect(() => parseTiles('12x')).toThrow();
    expect(() => parseTiles('m')).toThrow();
    expect(() => parseTiles('123')).toThrow();
    expect(() => parseTiles('8z')).toThrow();
    expect(() => parseTiles('0z')).toThrow();
  });
});

describe('패 분류', () => {
  it('요구패 = 1·9·자패 13종', () => {
    expect(YAOCHUU_KINDS).toHaveLength(13);
    for (let k = 0; k < 34; k++) {
      expect(isYaochuu(k)).toBe(YAOCHUU_KINDS.includes(k));
      expect(isSimple(k)).toBe(!YAOCHUU_KINDS.includes(k));
    }
  });

  it('노두패는 수패 1·9만', () => {
    expect(isTerminal(0)).toBe(true); // 1만
    expect(isTerminal(8)).toBe(true); // 9만
    expect(isTerminal(4)).toBe(false); // 5만
    expect(isTerminal(EAST)).toBe(false); // 자패는 노두패가 아님
  });
});

describe('도라 순환 (§2.1)', () => {
  it('수패: 9 다음은 1', () => {
    expect(doraKindFromIndicator(0)).toBe(1); // 1만 → 2만
    expect(doraKindFromIndicator(8)).toBe(0); // 9만 → 1만
    expect(doraKindFromIndicator(17)).toBe(9); // 9통 → 1통
    expect(doraKindFromIndicator(26)).toBe(18); // 9삭 → 1삭
  });

  it('풍패: 동→남→서→북→동', () => {
    expect(doraKindFromIndicator(EAST)).toBe(EAST + 1);
    expect(doraKindFromIndicator(NORTH)).toBe(EAST);
  });

  it('삼원패: 백→발→중→백', () => {
    expect(doraKindFromIndicator(HAKU)).toBe(HATSU);
    expect(doraKindFromIndicator(CHUN)).toBe(HAKU);
  });
});

describe('결정론적 RNG', () => {
  it('같은 시드 → 같은 수열, 다른 시드 → 다른 수열', () => {
    const a1 = createRng('seed-1');
    const a2 = createRng('seed-1');
    const b = createRng('seed-2');
    const seqA1 = Array.from({ length: 16 }, () => a1.nextUint32());
    const seqA2 = Array.from({ length: 16 }, () => a2.nextUint32());
    const seqB = Array.from({ length: 16 }, () => b.nextUint32());
    expect(seqA1).toEqual(seqA2);
    expect(seqA1).not.toEqual(seqB);
  });

  it('nextInt는 범위를 지키고 경계를 검증한다', () => {
    const rng = createRng(42);
    for (let i = 0; i < 1000; i++) {
      const v = nextInt(rng, 136);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(136);
    }
    expect(() => nextInt(rng, 0)).toThrow(RangeError);
  });

  it('셔플은 순열이며 결정론적이다', () => {
    const base = Array.from({ length: 136 }, (_, i) => i);
    const x = [...base];
    const y = [...base];
    shuffleInPlace(x, createRng('game-seed'));
    shuffleInPlace(y, createRng('game-seed'));
    expect(x).toEqual(y);
    expect(x).not.toEqual(base);
    expect([...x].sort((a, b) => a - b)).toEqual(base);
  });
});
