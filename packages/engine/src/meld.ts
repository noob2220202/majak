import { kindOfTile } from './tiles';
import type { Seat, TileId, TileKind } from './types';

/**
 * 부로(울기) 면자. tiles는 항상 종류 오름차순 정렬.
 * 시간 순서는 소유자의 melds 배열 순서가 보존한다 (파오 판정에 사용).
 */
export type Meld =
  | { type: 'chi'; tiles: [TileId, TileId, TileId]; calledTileId: TileId; from: Seat }
  | { type: 'pon'; tiles: [TileId, TileId, TileId]; calledTileId: TileId; from: Seat }
  | {
      type: 'daiminkan';
      tiles: [TileId, TileId, TileId, TileId];
      calledTileId: TileId;
      from: Seat;
    }
  | {
      type: 'shouminkan';
      tiles: [TileId, TileId, TileId, TileId];
      calledTileId: TileId;
      /** 퐁 후 가깡으로 추가한 패 */
      addedTileId: TileId;
      from: Seat;
    }
  | { type: 'ankan'; tiles: [TileId, TileId, TileId, TileId] };

export function isKan(meld: Meld): boolean {
  return meld.type === 'ankan' || meld.type === 'daiminkan' || meld.type === 'shouminkan';
}

/** 멘젠 판정용: 안깡만 멘젠을 깨지 않는다 */
export function breaksConcealment(meld: Meld): boolean {
  return meld.type !== 'ankan';
}

/** 치의 시작 종류 / 퐁·깡의 종류 */
export function meldKind(meld: Meld): TileKind {
  if (meld.type === 'chi') {
    return Math.min(...meld.tiles.map(kindOfTile));
  }
  return kindOfTile(meld.tiles[0]);
}

/** 부로에 포함된 종류별 장수 (counts[34]에 더하기 위한 목록) */
export function meldTileKinds(meld: Meld): TileKind[] {
  return meld.tiles.map(kindOfTile);
}
