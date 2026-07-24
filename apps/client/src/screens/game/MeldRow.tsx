import { isKan, type Meld } from '@cheongiwa/engine';
import { Tile } from '../../tiles/Tile';

/** 부로 면자 표시 (안깡은 양끝 뒷면). */
export function MeldRow({ melds, width = 22 }: { melds: Meld[]; width?: number }) {
  if (melds.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {melds.map((meld, mi) => (
        <div key={mi} className="flex gap-px">
          {meld.tiles.map((id, ti) => {
            const ankanHidden = meld.type === 'ankan' && (ti === 0 || ti === 3);
            return (
              <Tile
                key={id}
                tileId={id}
                width={width}
                faceDown={ankanHidden}
                glow={isKan(meld) && !ankanHidden && ti === 1 ? null : null}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
