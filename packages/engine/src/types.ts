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
