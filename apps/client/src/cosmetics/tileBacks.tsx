import type { JSX } from 'react';

/**
 * 패 뒷면 코스메틱 (PLAN.md §6.3). 전부 오리지널 SVG.
 * 작게 그릴 때(detailed=false)는 문양이 뭉치므로 단순형으로 대체한다.
 */

export interface TileBackStyle {
  /** 바탕 그라데이션 */
  background: string;
  /** 문양 (viewBox 0 0 100 134 기준) */
  art: (detailed: boolean) => JSX.Element;
}

const GOLD = '#c8a24b';
const GOLD_HI = '#e6c87a';

function frame(): JSX.Element {
  return (
    <rect x={6} y={7} width={88} height={120} rx={9} fill="none" stroke={GOLD} strokeOpacity={0.25} strokeWidth={2} />
  );
}

/** 수막새 (기본) — 연화 6판 + 겹 고리 */
function sumaksaeArt(detailed: boolean): JSX.Element {
  const petals = [0, 1, 2, 3, 4, 5].map((i) => (i * Math.PI) / 3);
  return (
    <g>
      {detailed && frame()}
      <circle
        cx={50}
        cy={67}
        r={detailed ? 30 : 26}
        fill="none"
        stroke={GOLD}
        strokeOpacity={detailed ? 0.95 : 0.75}
        strokeWidth={detailed ? 3 : 5}
      />
      {detailed && (
        <>
          <circle cx={50} cy={67} r={22} fill="none" stroke={GOLD} strokeOpacity={0.45} strokeWidth={1.2} />
          {petals.map((a, i) => (
            <ellipse
              key={i}
              cx={50 + Math.cos(a) * 14}
              cy={67 + Math.sin(a) * 14}
              rx={7}
              ry={4.2}
              fill={GOLD}
              opacity={0.8}
              transform={`rotate(${(a * 180) / Math.PI} ${50 + Math.cos(a) * 14} ${67 + Math.sin(a) * 14})`}
            />
          ))}
        </>
      )}
      <circle cx={50} cy={67} r={detailed ? 6 : 8} fill={GOLD_HI} />
    </g>
  );
}

/** 연화문 — 겹으로 핀 연꽃 (8판 + 속판 8) */
function yeonhwaArt(detailed: boolean): JSX.Element {
  const outer = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);
  const inner = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4 + Math.PI / 8);
  return (
    <g>
      {detailed && frame()}
      {detailed &&
        outer.map((a, i) => (
          <path
            key={`o${i}`}
            d="M50 28 C 60 40, 60 54, 50 64 C 40 54, 40 40, 50 28 Z"
            fill={GOLD}
            opacity={0.55}
            transform={`rotate(${(a * 180) / Math.PI} 50 67)`}
          />
        ))}
      {inner.map((a, i) => (
        <path
          key={`i${i}`}
          d="M50 40 C 57 50, 57 58, 50 66 C 43 58, 43 50, 50 40 Z"
          fill={GOLD_HI}
          opacity={detailed ? 0.85 : 0.6}
          transform={`rotate(${(a * 180) / Math.PI} 50 67)`}
        />
      ))}
      <circle cx={50} cy={67} r={detailed ? 7 : 9} fill={GOLD_HI} />
    </g>
  );
}

/** 도깨비문 — 귀면와(부릅뜬 눈·뿔·이빨) */
function dokkaebiArt(detailed: boolean): JSX.Element {
  if (!detailed) {
    return (
      <g>
        <circle cx={50} cy={67} r={26} fill="none" stroke={GOLD} strokeOpacity={0.8} strokeWidth={5} />
        <circle cx={40} cy={62} r={5} fill={GOLD_HI} />
        <circle cx={60} cy={62} r={5} fill={GOLD_HI} />
      </g>
    );
  }
  return (
    <g>
      {frame()}
      {/* 뿔 */}
      <path d="M28 40 C 24 26, 34 22, 38 32" fill="none" stroke={GOLD} strokeWidth={3.4} strokeLinecap="round" />
      <path d="M72 40 C 76 26, 66 22, 62 32" fill="none" stroke={GOLD} strokeWidth={3.4} strokeLinecap="round" />
      {/* 얼굴 윤곽 */}
      <path
        d="M50 34 C 70 34, 80 50, 78 70 C 76 92, 64 104, 50 104 C 36 104, 24 92, 22 70 C 20 50, 30 34, 50 34 Z"
        fill="none"
        stroke={GOLD}
        strokeWidth={3}
      />
      {/* 눈 */}
      <ellipse cx={38} cy={62} rx={8} ry={6.5} fill={GOLD} opacity={0.9} />
      <ellipse cx={62} cy={62} rx={8} ry={6.5} fill={GOLD} opacity={0.9} />
      <circle cx={38} cy={62} r={2.6} fill="#1a2b50" />
      <circle cx={62} cy={62} r={2.6} fill="#1a2b50" />
      {/* 코·입·이빨 */}
      <path d="M50 70 L 46 80 H 54 Z" fill={GOLD} opacity={0.75} />
      <path d="M34 86 Q 50 96 66 86" fill="none" stroke={GOLD} strokeWidth={2.6} />
      <path d="M40 87 L 42 93 L 45 87 M55 87 L 58 93 L 60 87" fill="none" stroke={GOLD_HI} strokeWidth={2} />
    </g>
  );
}

/** 태극 — 삼태극 (홍·청·황) */
function taegeukArt(detailed: boolean): JSX.Element {
  const R = detailed ? 30 : 26;
  return (
    <g>
      {detailed && frame()}
      <g transform={`translate(50 67)`}>
        {/* 삼태극: 세 갈래가 도는 형태 */}
        {[
          { rot: 0, color: '#c9433a' },
          { rot: 120, color: '#3f7ea8' },
          { rot: 240, color: GOLD_HI },
        ].map((p, i) => (
          <path
            key={i}
            d={`M0 0 L0 ${-R} A ${R} ${R} 0 0 1 ${R * Math.sin((2 * Math.PI) / 3)} ${-R * Math.cos((2 * Math.PI) / 3)} Z`}
            fill={p.color}
            opacity={0.92}
            transform={`rotate(${p.rot})`}
          />
        ))}
        <circle r={R} fill="none" stroke={GOLD} strokeWidth={detailed ? 3 : 4} />
      </g>
    </g>
  );
}

export const TILE_BACKS: Record<string, TileBackStyle> = {
  'tileBack.sumaksae': {
    background: 'linear-gradient(160deg, #33528f 0%, #243b6b 52%, #1a2b50 100%)',
    art: sumaksaeArt,
  },
  'tileBack.yeonhwa': {
    background: 'linear-gradient(160deg, #7a3550 0%, #5a2440 52%, #3d1830 100%)',
    art: yeonhwaArt,
  },
  'tileBack.dokkaebi': {
    background: 'linear-gradient(160deg, #2f5a4a 0%, #1f4437 52%, #14302a 100%)',
    art: dokkaebiArt,
  },
  'tileBack.taegeuk': {
    background: 'linear-gradient(160deg, #2f3448 0%, #23273a 52%, #171a29 100%)',
    art: taegeukArt,
  },
};

export const DEFAULT_TILE_BACK = 'tileBack.sumaksae';

export function tileBackStyle(id: string | undefined): TileBackStyle {
  return TILE_BACKS[id ?? DEFAULT_TILE_BACK] ?? (TILE_BACKS[DEFAULT_TILE_BACK] as TileBackStyle);
}

/** 테이블(마작상) 코스메틱 — 펠트 + 나무 테두리 */
export const TABLE_STYLES: Record<string, { felt: string; rim: string }> = {
  'table.noirok': {
    felt: 'radial-gradient(ellipse at center, #24594c 0%, #1e4b3f 45%, #14332b 100%)',
    rim: 'linear-gradient(150deg, #4a3524 0%, #35251a 55%, #241810 100%)',
  },
  'table.jjokbit': {
    felt: 'radial-gradient(ellipse at center, #27456f 0%, #1f3860 45%, #142442 100%)',
    rim: 'linear-gradient(150deg, #3f3a58 0%, #2c2840 55%, #1d1a2c 100%)',
  },
  'table.meok': {
    felt: 'radial-gradient(ellipse at center, #2b3038 0%, #22262d 45%, #16181d 100%)',
    rim: 'linear-gradient(150deg, #3a3a3a 0%, #282828 55%, #191919 100%)',
  },
  'table.jadan': {
    felt: 'radial-gradient(ellipse at center, #4a2b26 0%, #3c221e 45%, #271512 100%)',
    rim: 'linear-gradient(150deg, #6b3a26 0%, #4d2819 55%, #331810 100%)',
  },
};

export const DEFAULT_TABLE = 'table.noirok';

export function tableStyle(id: string | undefined): { felt: string; rim: string } {
  return TABLE_STYLES[id ?? DEFAULT_TABLE] ?? (TABLE_STYLES[DEFAULT_TABLE] as { felt: string; rim: string });
}
