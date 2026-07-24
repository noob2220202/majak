import type { JSX } from 'react';
import { kindOfTile, type TileId } from '@cheongiwa/engine';
import type { ChoicesView } from '@cheongiwa/protocol';
import { Tile } from '../../tiles/Tile';
import { tenpaiDiscards } from './handAnalysis';

/** 내 손패 + 쯔모패. 타패 클릭, 유효패 힌트, 리치 무장 시 선언패만 활성. */
export function MyHand({
  hand,
  drawn,
  meldCount,
  choices,
  hints,
  riichiArm,
  onDiscard,
}: {
  hand: TileId[];
  drawn: TileId | null;
  meldCount: number;
  choices: ChoicesView | null;
  hints: boolean;
  riichiArm: boolean;
  onDiscard: (tileId: TileId, riichi: boolean) => void;
}) {
  const isTurn = choices?.kind === 'turn';
  const legal = new Set(isTurn ? choices.discards : []);
  const riichiLegal = new Set(isTurn ? choices.riichiDiscards : []);

  const hintKinds =
    hints && isTurn && !riichiArm
      ? tenpaiDiscards(hand.map(kindOfTile), drawn !== null ? kindOfTile(drawn) : null, meldCount)
      : new Set<number>();

  const renderTile = (id: TileId, isDrawn: boolean): JSX.Element => {
    const selectable = riichiArm ? riichiLegal.has(id) : legal.has(id);
    const hinted = hintKinds.has(kindOfTile(id));
    return (
      <Tile
        key={id}
        tileId={id}
        width={46}
        selectable={selectable}
        glow={riichiArm && riichiLegal.has(id) ? 'red' : hinted && selectable ? 'gold' : null}
        dimmed={isTurn ? !selectable : false}
        onClick={() => selectable && onDiscard(id, riichiArm)}
        style={{ marginLeft: isDrawn ? 18 : 0 }}
        ariaLabel={isDrawn ? '쯔모패' : undefined}
      />
    );
  };

  return (
    <div className="flex items-end">
      {hand.map((id) => renderTile(id, false))}
      {drawn !== null && renderTile(drawn, true)}
    </div>
  );
}
