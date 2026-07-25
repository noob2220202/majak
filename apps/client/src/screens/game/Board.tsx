import type { CSSProperties } from 'react';
import { tableStyle } from '../../cosmetics/tileBacks';
import { useElementSize } from '../../hooks/useElementSize';
import { useGame, type LocalGame } from '../../store/game';
import { CenterPanel } from './CenterPanel';
import { DiscardPile } from './DiscardPile';
import { MeldRow } from './MeldRow';
import { EmoteBubble } from '../../effects/EmoteBubble';
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
// 부로는 각 좌석 손패 바깥쪽으로 — 이름표·버림패와 겹치지 않는 자리
const MELD_ANCHOR: Record<RelPos, CSSProperties> = {
  self: { display: 'none' },
  top: { left: '16%', top: '13%' },
  left: { left: '8%', top: '18%' },
  right: { left: '92%', top: '82%' },
};

const centered = (extra = ''): string =>
  `absolute -translate-x-1/2 -translate-y-1/2 ${extra}`;

/**
 * 마작상의 논리 크기. 자리 앵커는 %지만 패·정보판은 고정 px이라
 * 좁은 화면에서는 상만 줄고 안쪽 조각들은 그대로 남아 넘쳤다.
 * 그래서 600px짜리 판을 통째로 축소한다 — 비율이 어떤 폭에서도 그대로 유지된다.
 */
const BOARD_SIZE = 600;
/** 세로가 짧은 화면(가로로 눕힌 폰)에서 판이 너무 쪼그라들지 않게 하는 하한 */
const BOARD_MIN = 170;

export function Board({
  game,
  reserveRatio,
}: {
  game: LocalGame;
  reserveRatio: number | null;
}) {
  const positions: RelPos[] = ['self', 'right', 'top', 'left'];
  // 마작상은 내가 장착한 것으로 보인다 (§6.3 — 표시 전용)
  const table = tableStyle(useGame((s) => s.wallet?.loadout.table));
  const emotes = useGame((s) => s.emotes);
  const simplified = useGame((s) => s.simplified);
  // 바깥 칸의 크기는 CSS가 정하고(부모의 남는 자리 전부), 판은 가로·세로 중
  // 작은 쪽에 맞춰 정사각으로 앉는다. 폰을 눕히면 세로가 먼저 바닥나므로
  // 폭만 보고 맞추면 판이 화면 아래로 흘러넘친다.
  const { ref, width, height } = useElementSize<HTMLDivElement>();
  const measured = Math.min(width || BOARD_SIZE, height || BOARD_SIZE);
  const side = Math.min(BOARD_SIZE, Math.max(BOARD_MIN, measured));
  const scale = side / BOARD_SIZE;

  return (
    // 안쪽 판을 absolute 로 띄우지 않으면 600px 크기가 그대로 바깥 칸을 밀어낸다
    // (transform 은 그리는 크기만 바꿀 뿐 레이아웃 크기는 그대로다).
    <div ref={ref} data-board className="relative h-full w-full">
      <div
        className="tex-wood absolute rounded-[26px] p-3"
        style={{
          width: BOARD_SIZE,
          height: BOARD_SIZE,
          left: Math.max(0, Math.round((width - side) / 2)),
          top: Math.max(0, Math.round((height - side) / 2)),
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          background: table.rim,
          boxShadow: '0 18px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,220,180,0.18)',
        }}
      >
        <div
          className="relative h-full w-full rounded-2xl"
          style={{
            background: table.felt,
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
            const profile = game.profiles.find((p) => p.seat === seat.seat);
            return (
              <div key={pos}>
                {/* 상대 손패 뒷면 — 각자 장착한 뒷면이 보인다 */}
                {pos !== 'self' && (
                  <div className={centered()} style={HAND_ANCHOR[pos]}>
                    <OpponentHand
                      meldCount={seat.melds.length}
                      holding={active}
                      pos={pos}
                      width={pos === 'top' ? 18 : 14}
                      backId={profile?.tileBack}
                    />
                  </div>
                )}

                {/* 상대 부로 — 무엇을 울었는지 보여야 손을 읽을 수 있다 */}
                {pos !== 'self' && seat.melds.length > 0 && (
                  <div className={centered()} style={MELD_ANCHOR[pos]}>
                    <div style={{ transform: `rotate(${ROT[pos]}deg)` }}>
                      <MeldRow melds={seat.melds} width={16} backId={profile?.tileBack} />
                    </div>
                  </div>
                )}

                {/* 버림패 */}
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
                    profile={profile}
                  />
                  <EmoteBubble
                    balloon={emotes[seat.seat] ?? null}
                    pos={pos}
                    simplified={simplified}
                  />
                </div>
              </div>
            );
          })}

          {/* 내 부로: 하단 우측 (안깡 뒷면은 내가 장착한 것) */}
          <div className="absolute bottom-2 right-3">
            <MeldRow
              melds={game.seats[game.mySeat]?.melds ?? []}
              width={22}
              backId={game.profiles.find((p) => p.seat === game.mySeat)?.tileBack}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
