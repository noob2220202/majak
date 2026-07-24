/**
 * 패 종류 인덱스 (0..33).
 *
 * - `0..8`   만수 1~9
 * - `9..17`  통수 1~9
 * - `18..26` 삭수 1~9
 * - `27..30` 풍패 동·남·서·북
 * - `31..33` 삼원패 백·발·중
 */
export type TileKind = number;

/**
 * 개별 패 id (0..135). `kind * 4 + copy(0..3)`이므로 id만으로
 * 종류를 항상 복원할 수 있다. 대국 내내 불변.
 */
export type TileId = number;

/** 물리적 패 한 장. */
export interface Tile {
  readonly id: TileId;
  readonly kind: TileKind;
  /** 적도라(적5) 여부 */
  readonly red: boolean;
}

/** 좌석 인덱스. 0 = 기가(起家, 동1국 시작 시 동). 시계 반대 방향으로 0→1→2→3. */
export type Seat = 0 | 1 | 2 | 3;

export const SEATS: readonly Seat[] = [0, 1, 2, 3];

/** 다음 좌석 (반시계 = 턴 순서) */
export function nextSeat(seat: Seat): Seat {
  return ((seat + 1) % 4) as Seat;
}
