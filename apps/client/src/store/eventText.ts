import { kindOfTile, tileKindToNotation, type Seat } from '@cheongiwa/engine';
import type { PublicGameEvent } from '@cheongiwa/protocol';

/** 패 종류 한국어 이름 (역명·로그 표기용) */
const SUIT_LABEL = ['만', '통', '삭'];
const HONOR_LABEL = ['동', '남', '서', '북', '백', '발', '중'];

export function tileLabel(kind: number): string {
  if (kind < 27) {
    const num = (kind % 9) + 1;
    return `${num}${SUIT_LABEL[Math.floor(kind / 9)]}`;
  }
  return HONOR_LABEL[kind - 27] ?? tileKindToNotation(kind);
}

export const WIND_LABEL = ['동', '남', '서', '북'];

const seatName = (
  seat: Seat,
  players: Array<{ seat: Seat; nickname: string }>,
): string => players.find((p) => p.seat === seat)?.nickname ?? `${seat}번`;

const MELD_LABEL: Record<string, string> = {
  chi: '치',
  pon: '퐁',
  daiminkan: '대명깡',
  shouminkan: '가깡',
  ankan: '안깡',
};

/** 공개 이벤트 → 로그 한 줄 */
export function describeEvent(
  event: PublicGameEvent,
  players: Array<{ seat: Seat; nickname: string }>,
): string {
  switch (event.type) {
    case 'roundStart': {
      const wind = WIND_LABEL[event.info.roundWind - 27] ?? '';
      return `── ${wind}${(event.info.kyoku % 4) + 1}국 ${event.info.honba}본장 시작`;
    }
    case 'discard':
      return `${seatName(event.seat, players)} 타패 ${tileLabel(kindOfTile(event.tileId))}${
        event.riichi ? ' · 리치 선언' : ''
      }`;
    case 'call':
      return `${seatName(event.seat, players)} ${MELD_LABEL[event.meld.type] ?? '울기'}`;
    case 'riichiAccepted':
      return `${seatName(event.seat, players)} 리치 성립 (공탁 ${event.pot})`;
    case 'doraRevealed':
      return `신도라 공개 ${tileLabel(event.indicator)}`;
    case 'kyuushuDeclared':
      return `${seatName(event.seat, players)} 구종구패`;
    case 'playerConnection':
      return `${seatName(event.seat, players)} ${event.connected ? '재접속' : '연결 끊김 (봇 대체)'}`;
    default:
      return '';
  }
}
