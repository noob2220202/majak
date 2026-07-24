import { EAST, type Seat } from '@cheongiwa/engine';

export type RelPos = 'self' | 'right' | 'top' | 'left';

/** 절대 좌석 → 내 시점 상대 위치 (self=하단, right=하가, top=대면, left=상가) */
export function relativePos(seat: Seat, mySeat: Seat): RelPos {
  const d = (seat - mySeat + 4) % 4;
  return (['self', 'right', 'top', 'left'] as const)[d] as RelPos;
}

/** 버림패·손패 회전각 (deg) — 각 플레이어가 자기 앞을 향하도록 */
export const ROT: Record<RelPos, number> = {
  self: 0,
  right: 270,
  top: 180,
  left: 90,
};

/** 좌석의 자풍 (dealer=동) */
export function seatWind(seat: number, dealer: number): number {
  return EAST + ((seat - dealer + 4) % 4);
}

export const SEAT_WIND_LABEL = ['동', '남', '서', '북'];
