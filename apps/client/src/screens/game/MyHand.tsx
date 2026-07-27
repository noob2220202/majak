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
 * 손패 받침 (`panel-hand-rest`).
 *
 * 원화 UI 조각은 늘리지 않는 것이 원칙인데(문양이 뭉개진다) 이건 예외다 —
 * **애초에 늘릴 것을 알고 뽑았다**. 프롬프트에서 단청 마구리는 양 끝에만 두고
 * 가운데는 결만 있는 평평한 나무로 지시했다. 그래서 마구리는 원화를 제 비율로
 * 두고, 가운데만 결 색으로 이어 붙인다. 손패 장수에 따라 폭이 계속 바뀌므로
 * 통짜로 늘리면 마구리가 세로로 5배 눌린다.
 */
const CAP_ASPECT = 0.9; // 마구리 가로/세로 (원화 720×88 에서 잰 값)
const REST_CAP = {
  backgroundImage: 'url(/art/panel-hand-rest.webp)',
  backgroundSize: 'auto 100%',
  backgroundRepeat: 'no-repeat',
} as const;
/** 가운데 색은 원화 한가운데를 세로로 훑어 뽑았다 — 마구리와 이음매가 안 보이게 */
const REST_MIDDLE = {
  background:
    'linear-gradient(180deg, #3b2517 0%, #5e3826 18%, #653d2b 50%, #55321f 78%, #3a2013 100%)',
  boxShadow: 'inset 0 1px 0 rgba(215,170,105,0.35)',
} as const;

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

  // 손패가 마룻바닥 위에 떠 있는 것처럼 보여 받침을 깐다.
  const ledge = Math.max(11, Math.round(width * 0.42));
  const cap = Math.round(ledge * CAP_ASPECT);
  const overhang = Math.round(width * 0.16);

  return (
    // overflow-x-clip 은 안전망 — 재기 전 첫 프레임에도 화면을 밀어내지 않는다
    // (clip 은 hidden 과 달리 세로 넘침을 그대로 두므로 패 호버 연출이 안 잘린다)
    <div ref={ref} className="flex w-full min-w-0 justify-center overflow-x-clip">
      <div className="relative flex items-end" style={{ paddingBottom: ledge }}>
        {/* 받침 — 마구리만 원화, 가운데는 결뿐이라 CSS 로 잇는다 (위 주석 참고) */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 flex items-stretch"
          style={{
            left: -overhang,
            right: -overhang,
            height: ledge,
            filter: 'drop-shadow(0 5px 12px rgba(0,0,0,0.65))',
          }}
        >
          <span style={{ width: cap, ...REST_CAP, backgroundPosition: 'left center' }} />
          <span className="flex-1" style={REST_MIDDLE} />
          <span style={{ width: cap, ...REST_CAP, backgroundPosition: 'right center' }} />
        </span>
        {hand.map((id) => renderTile(id, false))}
        {drawn !== null && renderTile(drawn, true)}
      </div>
    </div>
  );
}
