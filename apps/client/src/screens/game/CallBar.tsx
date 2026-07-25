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
  simplified = false,
  onRiichiArm,
  onAction,
}: {
  choices: ChoicesView;
  riichiArm: boolean;
  simplified?: boolean;
  onRiichiArm: (v: boolean) => void;
  onAction: (action: GameActionPayload) => void;
}) {
  const [chiPick, setChiPick] = useState(false);
  const [kanPick, setKanPick] = useState(false);
  // 도장이 순차로 "쾅쾅" 찍히도록 지연을 준다
  let stampIndex = 0;
  const nextDelay = (): number => stampIndex++ * 55;

  if (choices.kind === 'reaction') {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {choices.canRon && (
          <SealButton label="론" delay={nextDelay()} simplified={simplified} onClick={() => onAction({ type: 'ron' })} />
        )}
        {choices.canPon && (
          <SealButton label="퐁" delay={nextDelay()} simplified={simplified} onClick={() => onAction({ type: 'pon' })} />
        )}
        {choices.canDaiminkan && (
          <SealButton label="깡" delay={nextDelay()} simplified={simplified} onClick={() => onAction({ type: 'daiminkan' })} />
        )}
        {choices.chiCombos.length > 0 &&
          (choices.chiCombos.length === 1 ? (
            <SealButton
              label="치"
              delay={nextDelay()}
              simplified={simplified}
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
            <SealButton label="치" delay={nextDelay()} simplified={simplified} onClick={() => setChiPick(true)} />
          ))}
        <SealButton label="패스" variant="pass" delay={nextDelay()} simplified={simplified} onClick={() => onAction({ type: 'pass' })} />
      </div>
    );
  }

  // turn
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {choices.canTsumo && <SealButton label="쯔모" delay={nextDelay()} simplified={simplified} onClick={() => onAction({ type: 'tsumo' })} />}
      {choices.riichiDiscards.length > 0 &&
        (riichiArm ? (
          <SealButton label="취소" variant="pass" delay={nextDelay()} simplified={simplified} onClick={() => onRiichiArm(false)} />
        ) : (
          <SealButton label="리치" delay={nextDelay()} simplified={simplified} onClick={() => onRiichiArm(true)} />
        ))}
      {choices.ankanKinds.length > 0 &&
        (choices.ankanKinds.length === 1 ? (
          <SealButton
            label="안깡"
            delay={nextDelay()}
            simplified={simplified}
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
          <SealButton label="안깡" delay={nextDelay()} simplified={simplified} onClick={() => setKanPick(true)} />
        ))}
      {choices.shouminkanTiles.length > 0 && (
        <SealButton
          label="가깡"
          delay={nextDelay()}
          simplified={simplified}
          onClick={() =>
            onAction({ type: 'shouminkan', tileId: choices.shouminkanTiles[0] as number })
          }
        />
      )}
      {choices.canKyuushu && (
        <SealButton label="구종" delay={nextDelay()} simplified={simplified} onClick={() => onAction({ type: 'kyuushu' })} />
      )}
    </div>
  );
}
