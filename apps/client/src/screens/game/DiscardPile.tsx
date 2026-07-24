import type { SeatView } from '../../store/game';
import { Tile } from '../../tiles/Tile';

/**
 * 한 플레이어의 버림패(강). 6장씩 줄바꿈, 리치 선언패는 가로로 눕히고
 * 울려간 패는 흐리게 표시. 회전은 부모(Board)에서 처리한다.
 */
export function DiscardPile({ seat, width = 24 }: { seat: SeatView; width?: number }) {
  return (
    <div
      className="grid content-start gap-0.5"
      style={{ gridTemplateColumns: `repeat(6, ${width + 2}px)`, minHeight: width * 4 + 4 }}
    >
      {seat.discards.map((d, i) => (
        <div key={i} style={{ width: width + 2, height: (width * 4) / 3 + 2 }}>
          <Tile
            tileId={d.tileId}
            width={width}
            rotated={d.riichi}
            dimmed={d.calledBy !== null}
          />
        </div>
      ))}
    </div>
  );
}
