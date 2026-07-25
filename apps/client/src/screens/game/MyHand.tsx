import { type JSX } from 'react';
import { kindOfTile, type TileId } from '@cheongiwa/engine';
import type { ChoicesView } from '@cheongiwa/protocol';
import { Tile } from '../../tiles/Tile';
import { useElementSize } from '../../hooks/useElementSize';
import { tenpaiDiscards } from './handAnalysis';

/** 데스크톱 기본 폭 / 좁은 화면에서 줄어들 수 있는 하한 */
const TILE_MAX = 46;
const TILE_MIN = 20;
/** 쯔모패를 띄우는 간격 (폭에 비례) */
const DRAWN_GAP = 0.4;

/**
 * 가용 폭에 맞춘 한 장 폭을 계산한다.
 * 46px 고정이면 14장에 660px이 필요해 세로 화면(390px)을 그대로 밀어냈다.
 */
function fitTileWidth(avail: number, count: number, cap: number): number {
  if (avail === 0 || count === 0) return cap;
  // 쯔모패 간격까지 감안해 한 장 폭을 역산한다
  const fit = Math.floor(avail / (count + DRAWN_GAP));
  return Math.max(TILE_MIN, Math.min(cap, fit));
}

/** 내 손패 + 쯔모패. 타패 클릭, 유효패 힌트, 리치 무장 시 선언패만 활성. */
export function MyHand({
  hand,
  drawn,
  meldCount,
  choices,
  hints,
  riichiArm,
  maxWidth = TILE_MAX,
  onDiscard,
}: {
  hand: TileId[];
  drawn: TileId | null;
  meldCount: number;
  choices: ChoicesView | null;
  hints: boolean;
  riichiArm: boolean;
  /** 세로가 짧은 화면에서 손패가 마작상보다 커 보이지 않게 하는 상한 */
  maxWidth?: number;
  onDiscard: (tileId: TileId, riichi: boolean) => void;
}) {
  const isTurn = choices?.kind === 'turn';
  const legal = new Set(isTurn ? choices.discards : []);
  const riichiLegal = new Set(isTurn ? choices.riichiDiscards : []);
  const { ref, width: avail } = useElementSize<HTMLDivElement>();
  const width = fitTileWidth(avail, hand.length + (drawn !== null ? 1 : 0), maxWidth);

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
        width={width}
        selectable={selectable}
        glow={riichiArm && riichiLegal.has(id) ? 'red' : hinted && selectable ? 'gold' : null}
        dimmed={isTurn ? !selectable : false}
        onClick={() => selectable && onDiscard(id, riichiArm)}
        style={{ marginLeft: isDrawn ? Math.round(width * DRAWN_GAP) : 0 }}
        ariaLabel={isDrawn ? '쯔모패' : undefined}
      />
    );
  };

  return (
    // overflow-x-clip 은 안전망 — 재기 전 첫 프레임에도 화면을 밀어내지 않는다
    // (clip 은 hidden 과 달리 세로 넘침을 그대로 두므로 패 호버 연출이 안 잘린다)
    <div ref={ref} className="flex w-full min-w-0 items-end justify-center overflow-x-clip">
      {hand.map((id) => renderTile(id, false))}
      {drawn !== null && renderTile(drawn, true)}
    </div>
  );
}
