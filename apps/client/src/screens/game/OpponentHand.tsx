import { Tile } from '../../tiles/Tile';
import type { RelPos } from './geometry';

/** 상대 손패(뒷면). 은닉 부분 장수 = 13 - 3×부로, 활성 턴이면 홀딩 1장 추가. */
export function OpponentHand({
  meldCount,
  holding,
  pos,
  width = 20,
}: {
  meldCount: number;
  holding: boolean;
  pos: RelPos;
  width?: number;
}) {
  const count = 13 - meldCount * 3;
  const vertical = pos === 'left' || pos === 'right';
  const backs = Array.from({ length: count });

  return (
    <div className={`flex ${vertical ? 'flex-col' : 'flex-row'} items-center gap-px`}>
      {backs.map((_, i) => (
        <Tile key={i} faceDown width={width} rotated={vertical} />
      ))}
      {holding && (
        <div className={vertical ? 'mt-1.5' : 'ml-1.5'}>
          <Tile faceDown width={width} rotated={vertical} />
        </div>
      )}
    </div>
  );
}
