import { useState } from 'react';
import { tileKindToNotation, type TileId } from '@cheongiwa/engine';
import type { ChoicesView, GameActionPayload } from '@cheongiwa/protocol';
import { SealButton } from '../../components/ui';
import { Tile } from '../../tiles/Tile';
import { tileLabel } from '../../store/eventText';

/** 콜 도장 버튼 묶음 (§5.2 손패 우측). 반응/턴에 따라 다른 액션. */
export function CallBar({
  choices,
  riichiArm,
  onRiichiArm,
  onAction,
}: {
  choices: ChoicesView;
  riichiArm: boolean;
  onRiichiArm: (v: boolean) => void;
  onAction: (action: GameActionPayload) => void;
}) {
  const [chiPick, setChiPick] = useState(false);
  const [kanPick, setKanPick] = useState(false);

  if (choices.kind === 'reaction') {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {choices.canRon && <SealButton label="론" onClick={() => onAction({ type: 'ron' })} />}
        {choices.canPon && <SealButton label="퐁" onClick={() => onAction({ type: 'pon' })} />}
        {choices.canDaiminkan && (
          <SealButton label="깡" onClick={() => onAction({ type: 'daiminkan' })} />
        )}
        {choices.chiCombos.length > 0 &&
          (choices.chiCombos.length === 1 ? (
            <SealButton
              label="치"
              onClick={() => onAction({ type: 'chi', tiles: choices.chiCombos[0] as [TileId, TileId] })}
            />
          ) : chiPick ? (
            <div className="flex items-center gap-1.5 rounded-lg bg-ink/70 p-1.5">
              {choices.chiCombos.map((combo, i) => (
                <button
                  key={i}
                  onClick={() => onAction({ type: 'chi', tiles: combo })}
                  className="flex gap-px rounded p-0.5 hover:bg-hanji/15"
                >
                  {combo.map((id) => (
                    <Tile key={id} tileId={id} width={22} />
                  ))}
                </button>
              ))}
            </div>
          ) : (
            <SealButton label="치" onClick={() => setChiPick(true)} />
          ))}
        <SealButton label="패스" variant="pass" onClick={() => onAction({ type: 'pass' })} />
      </div>
    );
  }

  // turn
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {choices.canTsumo && <SealButton label="쯔모" onClick={() => onAction({ type: 'tsumo' })} />}
      {choices.riichiDiscards.length > 0 &&
        (riichiArm ? (
          <SealButton label="취소" variant="pass" onClick={() => onRiichiArm(false)} />
        ) : (
          <SealButton label="리치" onClick={() => onRiichiArm(true)} />
        ))}
      {choices.ankanKinds.length > 0 &&
        (choices.ankanKinds.length === 1 ? (
          <SealButton
            label="안깡"
            onClick={() => onAction({ type: 'ankan', kind: choices.ankanKinds[0] as number })}
          />
        ) : kanPick ? (
          <div className="flex items-center gap-1 rounded-lg bg-ink/70 p-1.5">
            {choices.ankanKinds.map((k) => (
              <button
                key={k}
                onClick={() => onAction({ type: 'ankan', kind: k })}
                className="rounded px-2 py-1 text-sm text-hanji hover:bg-hanji/15"
                title={tileKindToNotation(k)}
              >
                {tileLabel(k)}
              </button>
            ))}
          </div>
        ) : (
          <SealButton label="안깡" onClick={() => setKanPick(true)} />
        ))}
      {choices.shouminkanTiles.length > 0 && (
        <SealButton
          label="가깡"
          onClick={() =>
            onAction({ type: 'shouminkan', tileId: choices.shouminkanTiles[0] as number })
          }
        />
      )}
      {choices.canKyuushu && (
        <SealButton label="구종" onClick={() => onAction({ type: 'kyuushu' })} />
      )}
    </div>
  );
}
