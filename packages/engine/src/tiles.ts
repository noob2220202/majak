import type { Tile, TileId, TileKind } from './types';

/** 패 종류 수 (수패 27 + 자패 7) */
export const TILE_KIND_COUNT = 34;
/** 종류당 장수 */
export const COPIES_PER_KIND = 4;
/** 총 패 수 (PLAN.md §2.1) */
export const TOTAL_TILES = TILE_KIND_COUNT * COPIES_PER_KIND;

/** 적5가 될 수 있는 종류: 5만 / 5통 / 5삭 */
export const RED_FIVE_KINDS: readonly TileKind[] = [4, 13, 22];

/** 자패 시작 인덱스 (동) */
export const HONOR_START = 27;
export const EAST = 27;
export const SOUTH = 28;
export const WEST = 29;
export const NORTH = 30;
export const HAKU = 31; // 백
export const HATSU = 32; // 발
export const CHUN = 33; // 중

/** 요구패 (1·9·자패) 종류 목록 */
export const YAOCHUU_KINDS: readonly TileKind[] = [
  0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33,
];

/** id → 종류 인덱스 */
export function kindOfTile(id: TileId): TileKind {
  return Math.floor(id / 4);
}

function assertValidKind(kind: TileKind): void {
  if (!Number.isInteger(kind) || kind < 0 || kind >= TILE_KIND_COUNT) {
    throw new RangeError(`유효하지 않은 패 종류: ${kind}`);
  }
}

/** 수트 인덱스: 0 만 / 1 통 / 2 삭 / 3 자패 */
export function suitOf(kind: TileKind): 0 | 1 | 2 | 3 {
  return Math.floor(kind / 9) as 0 | 1 | 2 | 3;
}

/** 수패면 1~9, 자패면 0 */
export function numberOf(kind: TileKind): number {
  return kind < HONOR_START ? (kind % 9) + 1 : 0;
}

export function isHonor(kind: TileKind): boolean {
  return kind >= HONOR_START;
}

export function isWind(kind: TileKind): boolean {
  return kind >= EAST && kind <= NORTH;
}

export function isDragon(kind: TileKind): boolean {
  return kind >= HAKU;
}

/** 노두패 (수패 1·9) */
export function isTerminal(kind: TileKind): boolean {
  return kind < HONOR_START && (kind % 9 === 0 || kind % 9 === 8);
}

/** 요구패 (1·9·자패) */
export function isYaochuu(kind: TileKind): boolean {
  return isHonor(kind) || isTerminal(kind);
}

/** 중장패 (2~8 수패) */
export function isSimple(kind: TileKind): boolean {
  return !isYaochuu(kind);
}

/**
 * 도라표시패 → 도라 종류 (§2.1).
 * 수패: 9 다음은 1. 풍패: 동→남→서→북→동. 삼원패: 백→발→중→백.
 */
export function doraKindFromIndicator(indicator: TileKind): TileKind {
  assertValidKind(indicator);
  if (indicator < HONOR_START) {
    const suitBase = indicator - (indicator % 9);
    return suitBase + ((indicator % 9) + 1) % 9;
  }
  if (indicator <= NORTH) {
    return EAST + ((indicator - EAST + 1) % 4);
  }
  return HAKU + ((indicator - HAKU + 1) % 3);
}

export interface TileSetOptions {
  /** 적도라 사용 여부 (기본 ON — 만·통·삭 5 각 1장을 적5로 교체) */
  readonly redFives: boolean;
}

/** 이 id가 적5인가 (적도라 룰 ON 기준: 각 5의 0번째 사본) */
export function isRedFiveId(id: TileId): boolean {
  return id % 4 === 0 && RED_FIVE_KINDS.includes(kindOfTile(id));
}

/**
 * 136장 전체 패를 생성한다 (셔플하지 않은 id 오름차순).
 * 적도라 ON이면 각 5의 0번째 사본(copy 0)이 적5가 된다.
 */
export function buildTileSet(options: TileSetOptions = { redFives: true }): readonly Tile[] {
  const tiles: Tile[] = [];
  for (let id = 0; id < TOTAL_TILES; id++) {
    tiles.push({ id, kind: kindOfTile(id), red: options.redFives && isRedFiveId(id) });
  }
  return tiles;
}

const SUIT_LETTERS = ['m', 'p', 's'] as const;

/**
 * 종류 → mpsz 표기.
 * 수패는 `'1m'~'9m' / '1p'~'9p' / '1s'~'9s'` (적5는 `'0m'` 등 0 표기),
 * 자패는 `'1z'~'7z'` (동남서북·백발중 순).
 */
export function tileKindToNotation(kind: TileKind, red = false): string {
  assertValidKind(kind);
  if (kind < HONOR_START) {
    const suit = SUIT_LETTERS[Math.floor(kind / 9)];
    const num = (kind % 9) + 1;
    return `${red ? 0 : num}${suit}`;
  }
  return `${kind - HONOR_START + 1}z`;
}

/** 패 → mpsz 표기 */
export function tileToNotation(tile: Tile): string {
  return tileKindToNotation(tile.kind, tile.red);
}

/** 표기 파싱 결과: 종류 + 적5 여부 */
export interface ParsedTile {
  readonly kind: TileKind;
  readonly red: boolean;
}

/**
 * mpsz 문자열 파싱: `'123m055p11z'` → 1만 2만 3만, 적5통 5통 5통, 동 동.
 * `0` = 해당 수트의 적5. 공백은 무시. 테스트 픽스처·로그의 표준 표기.
 */
export function parseTiles(notation: string): ParsedTile[] {
  const out: ParsedTile[] = [];
  let digits: number[] = [];
  for (const ch of notation.replace(/\s/g, '')) {
    if (ch >= '0' && ch <= '9') {
      digits.push(ch.charCodeAt(0) - 48);
      continue;
    }
    const suitIndex = ch === 'm' ? 0 : ch === 'p' ? 1 : ch === 's' ? 2 : ch === 'z' ? 3 : -1;
    if (suitIndex < 0) throw new Error(`알 수 없는 수트 문자: '${ch}' (${notation})`);
    if (digits.length === 0) throw new Error(`수트 앞에 숫자가 없음: ${notation}`);
    for (const d of digits) {
      if (suitIndex === 3) {
        if (d < 1 || d > 7) throw new Error(`자패 범위는 1z~7z: ${d}z`);
        out.push({ kind: HONOR_START + d - 1, red: false });
      } else if (d === 0) {
        out.push({ kind: suitIndex * 9 + 4, red: true });
      } else {
        out.push({ kind: suitIndex * 9 + d - 1, red: false });
      }
    }
    digits = [];
  }
  if (digits.length > 0) throw new Error(`끝에 수트 문자가 없음: ${notation}`);
  return out;
}

/** 종류 배열 → counts[34] */
export function countsFromKinds(kinds: readonly TileKind[]): number[] {
  const counts = new Array<number>(TILE_KIND_COUNT).fill(0);
  for (const k of kinds) {
    assertValidKind(k);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

/** 표기 → counts[34] (적5 정보는 버림 — 샹텐·형태 판정용) */
export function countsFromNotation(notation: string): number[] {
  return countsFromKinds(parseTiles(notation).map((t) => t.kind));
}
