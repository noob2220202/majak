import type { CSSProperties } from 'react';
import type { LocalGame } from '../../store/game';
import { CenterPanel } from './CenterPanel';
import { DiscardPile } from './DiscardPile';
import { MeldRow } from './MeldRow';
import { OpponentHand } from './OpponentHand';
import { SeatPlate } from './SeatPlate';
import { relativePos, ROT, type RelPos } from './geometry';

/** 상대 위치별 앵커 (%): 버림패·이름표·상대 손패 */
const DISCARD_ANCHOR: Record<RelPos, CSSProperties> = {
  self: { left: '50%', top: '72%' },
  top: { left: '50%', top: '28%' },
  left: { left: '23%', top: '50%' },
  right: { left: '77%', top: '50%' },
};
// 이름표는 모서리 쪽으로 빼서 상대 손패와 겹치지 않게 한다
const PLATE_ANCHOR: Record<RelPos, CSSProperties> = {
  self: { left: '50%', top: '95%' },
  top: { left: '50%', top: '5%' },
  left: { left: '15%', top: '86%' },
  right: { left: '85%', top: '14%' },
};
const HAND_ANCHOR: Record<RelPos, CSSProperties> = {
  self: { display: 'none' },
  top: { left: '50%', top: '13%' },
  left: { left: '8%', top: '50%' },
  right: { left: '92%', top: '50%' },
};

const centered = (extra = ''): string =>
  `absolute -translate-x-1/2 -translate-y-1/2 ${extra}`;

export function Board({
  game,
  reserveRatio,
}: {
  game: LocalGame;
  reserveRatio: number | null;
}) {
  const positions: RelPos[] = ['self', 'right', 'top', 'left'];

  return (
    <div
      className="tex-wood relative mx-auto aspect-square w-full max-w-[600px] rounded-[26px] p-3"
      style={{
        background: 'linear-gradient(150deg, #4a3524 0%, #35251a 55%, #241810 100%)',
        boxShadow: '0 18px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,220,180,0.18)',
      }}
    >
      <div
        className="relative h-full w-full rounded-2xl"
        style={{
          background: 'radial-gradient(ellipse at center, #24594c 0%, #1e4b3f 45%, #14332b 100%)',
          boxShadow: 'inset 0 0 70px rgba(0,0,0,0.55), inset 0 0 0 2px rgba(200,162,75,0.18)',
        }}
      >
      {/* 중앙 정보판 */}
      <div className={centered()} style={{ left: '50%', top: '50%' }}>
        <CenterPanel round={game.round} />
      </div>

      {positions.map((pos) => {
        const seat = game.seats.find((s) => relativePos(s.seat, game.mySeat) === pos);
        if (!seat) return null;
        const active = game.activeSeat === seat.seat && game.phase !== 'ended';
        return (
          <div key={pos}>
            {/* 상대 손패 뒷면 */}
            {pos !== 'self' && (
              <div className={centered()} style={HAND_ANCHOR[pos]}>
                <OpponentHand
                  meldCount={seat.melds.length}
                  holding={active}
                  pos={pos}
                  width={pos === 'top' ? 18 : 14}
                />
              </div>
            )}

            {/* 버림패 + 부로 */}
            <div className={centered()} style={DISCARD_ANCHOR[pos]}>
              <div style={{ transform: `rotate(${ROT[pos]}deg)` }}>
                <DiscardPile seat={seat} width={pos === 'self' ? 26 : 22} />
              </div>
            </div>

            {/* 이름표 */}
            <div className={centered('z-10')} style={PLATE_ANCHOR[pos]}>
              <SeatPlate
                seat={seat}
                dealer={game.round.dealer}
                active={active}
                reserveRatio={active && seat.seat === game.mySeat ? reserveRatio : null}
              />
            </div>
          </div>
        );
      })}

        {/* 내 부로: 하단 우측 */}
        <div className="absolute bottom-2 right-3">
          <MeldRow melds={game.seats[game.mySeat]?.melds ?? []} width={22} />
        </div>
      </div>
    </div>
  );
}
