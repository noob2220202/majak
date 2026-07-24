import { shuffleInPlace, type Rng } from './rng';
import { kindOfTile, TOTAL_TILES } from './tiles';
import type { Seat, TileId, TileKind } from './types';

/**
 * 패산 (PLAN.md §2.1).
 *
 * 물리 배치를 논리 순서로 단순화한 모델 (ASSUMPTIONS 참조):
 * - order[0..51]    : 배패 (좌석 0~3, 각 13장)
 * - order[52..121]  : 라이브 패산 70장 (앞에서부터 쯔모)
 * - order[122..135] : 왕패 14장 = 영상패 4 (122~125) + 도라표시 5 (126~130) + 우라 5 (131~135)
 *
 * 깡이 나면 liveRemaining을 1 줄여 해저 위치를 당긴다 (왕패 14장 상시 유지와 등가).
 */
export interface WallState {
  readonly order: readonly TileId[];
  /** 다음 라이브 쯔모 인덱스 */
  nextLive: number;
  /** 남은 라이브 쯔모 수 */
  liveRemaining: number;
  rinshanDrawn: number;
  /** 공개된 도라표시패 수 (1~5) */
  doraRevealed: number;
}

export const DEAL_TILES = 52;
export const LIVE_TILES = 70;
const RINSHAN_BASE = 122;
const DORA_BASE = 126;
const URA_BASE = 131;

export function createWall(order: readonly TileId[]): WallState {
  if (order.length !== TOTAL_TILES) throw new RangeError(`패산은 136장: ${order.length}`);
  const seen = new Set(order);
  if (seen.size !== TOTAL_TILES) throw new RangeError('패산에 중복 id가 있음');
  return {
    order,
    nextLive: DEAL_TILES,
    liveRemaining: LIVE_TILES,
    rinshanDrawn: 0,
    doraRevealed: 1,
  };
}

export function shuffledWall(rng: Rng): WallState {
  const order = Array.from({ length: TOTAL_TILES }, (_, i) => i);
  shuffleInPlace(order, rng);
  return createWall(order);
}

/** 좌석별 배패 13장 (kind 순 정렬) */
export function dealHands(wall: WallState): [TileId[], TileId[], TileId[], TileId[]] {
  const hands = [0, 1, 2, 3].map((seat) => {
    const tiles = wall.order.slice(seat * 13, seat * 13 + 13) as TileId[];
    return sortHand(tiles);
  });
  return hands as [TileId[], TileId[], TileId[], TileId[]];
}

export function sortHand(tiles: TileId[]): TileId[] {
  return tiles.sort((a, b) => kindOfTile(a) - kindOfTile(b) || a - b);
}

export function drawLive(wall: WallState): TileId {
  if (wall.liveRemaining <= 0) throw new Error('라이브 패산이 비었음');
  const tile = wall.order[wall.nextLive] as TileId;
  wall.nextLive++;
  wall.liveRemaining--;
  return tile;
}

/** 깡 후 영상패 쯔모 (왕패 보충으로 라이브 1장이 왕패로 이동 → 해저가 당겨짐) */
export function drawRinshan(wall: WallState): TileId {
  if (wall.rinshanDrawn >= 4) throw new Error('영상패 소진');
  if (wall.liveRemaining <= 0) throw new Error('라이브 패산이 비어 깡 불가');
  const tile = wall.order[RINSHAN_BASE + wall.rinshanDrawn] as TileId;
  wall.rinshanDrawn++;
  wall.liveRemaining--;
  return tile;
}

/** 신도라 공개 (최대 5) */
export function revealDora(wall: WallState): void {
  if (wall.doraRevealed >= 5) throw new Error('도라표시패는 최대 5장');
  wall.doraRevealed++;
}

export function doraIndicatorKinds(wall: WallState): TileKind[] {
  const out: TileKind[] = [];
  for (let i = 0; i < wall.doraRevealed; i++) {
    out.push(kindOfTile(wall.order[DORA_BASE + i] as TileId));
  }
  return out;
}

export function uraIndicatorKinds(wall: WallState): TileKind[] {
  const out: TileKind[] = [];
  for (let i = 0; i < wall.doraRevealed; i++) {
    out.push(kindOfTile(wall.order[URA_BASE + i] as TileId));
  }
  return out;
}

/** 배패 직후 자기 차례가 seat인 좌석의 첫 쯔모 순서 확인용 (디버그) */
export function nextDrawSeat(dealer: Seat, drawCount: number): Seat {
  return ((dealer + drawCount) % 4) as Seat;
}
