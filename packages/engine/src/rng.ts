/**
 * 결정론적 PRNG — 같은 시드면 같은 대국이 재현된다 (리플레이·시뮬레이션·시드 검증의 기반).
 * 서버는 crypto로 시드 문자열을 만들고, 셔플 자체는 이 PRNG로 수행한다
 * (시드 공개만으로 전 과정을 재검증할 수 있게 하기 위함 — PLAN.md §1.2-3).
 */
export interface Rng {
  /** [0, 2^32) 정수 */
  nextUint32(): number;
}

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** splitmix32 — 시드 확장용 */
function splitmix32(state: number): () => number {
  let s = state >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    return (z ^ (z >>> 15)) >>> 0;
  };
}

/** xoshiro128** — 빠르고 품질 좋은 32비트 PRNG */
export function createRng(seed: string | number): Rng {
  const base = typeof seed === 'number' ? seed >>> 0 : fnv1a(seed);
  const sm = splitmix32(base);
  let s0 = sm();
  let s1 = sm();
  let s2 = sm();
  let s3 = sm();
  // 전부 0인 상태 방지
  if ((s0 | s1 | s2 | s3) === 0) s0 = 1;

  const rotl = (x: number, k: number): number => ((x << k) | (x >>> (32 - k))) >>> 0;

  return {
    nextUint32(): number {
      const result = (Math.imul(rotl(Math.imul(s1, 5) >>> 0, 7), 9) >>> 0) >>> 0;
      const t = (s1 << 9) >>> 0;
      s2 = (s2 ^ s0) >>> 0;
      s3 = (s3 ^ s1) >>> 0;
      s1 = (s1 ^ s2) >>> 0;
      s0 = (s0 ^ s3) >>> 0;
      s2 = (s2 ^ t) >>> 0;
      s3 = rotl(s3, 11);
      return result;
    },
  };
}

/** [0, bound) 무편향 정수 (rejection sampling) */
export function nextInt(rng: Rng, bound: number): number {
  if (!Number.isInteger(bound) || bound <= 0 || bound > 0x100000000) {
    throw new RangeError(`유효하지 않은 bound: ${bound}`);
  }
  const limit = 0x100000000 - (0x100000000 % bound);
  let v = rng.nextUint32();
  while (v >= limit) v = rng.nextUint32();
  return v % bound;
}

/** Fisher–Yates 셔플 (제자리) */
export function shuffleInPlace<T>(arr: T[], rng: Rng): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = nextInt(rng, i + 1);
    const tmp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = tmp;
  }
}
