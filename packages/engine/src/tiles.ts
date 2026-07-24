import type { Tile, TileId, TileKind } from './types';

/** 패 종류 수 (수패 27 + 자패 7) */
export const TILE_KIND_COUNT = 34;
/** 종류당 장수 */
export const COPIES_PER_KIND = 4;
/** 총 패 수 (PLAN.md §2.1) */
export const TOTAL_TILES = TILE_KIND_COUNT * COPIES_PER_KIND;

/** 적5가 될 수 있는 종류: 5만 / 5통 / 5삭 */
export const RED_FIVE_KINDS: readonly TileKind[] = [4, 13, 22];

/** id → 종류 인덱스 */
export function kindOfTile(id: TileId): TileKind {
  return Math.floor(id / 4);
}

function assertValidKind(kind: TileKind): void {
  if (!Number.isInteger(kind) || kind < 0 || kind >= TILE_KIND_COUNT) {
    throw new RangeError(`유효하지 않은 패 종류: ${kind}`);
  }
}

export interface TileSetOptions {
  /** 적도라 사용 여부 (기본 ON — 만·통·삭 5 각 1장을 적5로 교체) */
  readonly redFives: boolean;
}

/**
 * 136장 전체 패를 생성한다 (셔플하지 않은 id 오름차순).
 * 적도라 ON이면 각 5의 0번째 사본(copy 0)이 적5가 된다.
 * 셔플·패산 구성은 Phase 1에서 별도 함수로 구현한다.
 */
export function buildTileSet(options: TileSetOptions = { redFives: true }): readonly Tile[] {
  const tiles: Tile[] = [];
  for (let id = 0; id < TOTAL_TILES; id++) {
    const kind = kindOfTile(id);
    const red = options.redFives && id % 4 === 0 && RED_FIVE_KINDS.includes(kind);
    tiles.push({ id, kind, red });
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
  if (kind < 27) {
    const suit = SUIT_LETTERS[Math.floor(kind / 9)];
    const num = (kind % 9) + 1;
    return `${red ? 0 : num}${suit}`;
  }
  return `${kind - 27 + 1}z`;
}

/** 패 → mpsz 표기 */
export function tileToNotation(tile: Tile): string {
  return tileKindToNotation(tile.kind, tile.red);
}
