import type { JSX } from 'react';

/**
 * 마작패 앞면 도안 (PLAN.md §4.4·§9-5).
 * 통·삭은 SVG 도형, 만·자패는 전통 공용 CJK 도안을 serif로 렌더한다.
 * 유니코드 마작 문자(🀇 등)·이모지는 사용하지 않는다.
 *
 * 좌표계: viewBox 0 0 100 134 (세로 3:4 근사).
 */
const INK = '#20242e';
const RED = '#a8322a';
const GREEN = '#2f6b46';
const PIN = '#2b3d63';

const MAN_NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const HONOR_CHARS = ['東', '南', '西', '北'];

/** 종류별 점/막대 배치 (0..100 좌표) */
const LAYOUTS: Record<number, Array<[number, number]>> = {
  1: [[50, 67]],
  2: [
    [50, 42],
    [50, 92],
  ],
  3: [
    [28, 36],
    [50, 67],
    [72, 98],
  ],
  4: [
    [34, 42],
    [66, 42],
    [34, 92],
    [66, 92],
  ],
  5: [
    [33, 40],
    [67, 40],
    [50, 67],
    [33, 94],
    [67, 94],
  ],
  6: [
    [34, 38],
    [66, 38],
    [34, 67],
    [66, 67],
    [34, 96],
    [66, 96],
  ],
  7: [
    [34, 33],
    [66, 33],
    [50, 52],
    [34, 74],
    [66, 74],
    [34, 100],
    [66, 100],
  ],
  8: [
    [34, 32],
    [66, 32],
    [34, 55],
    [66, 55],
    [34, 82],
    [66, 82],
    [34, 105],
    [66, 105],
  ],
  9: [
    [28, 38],
    [50, 38],
    [72, 38],
    [28, 67],
    [50, 67],
    [72, 67],
    [28, 96],
    [50, 96],
    [72, 96],
  ],
};

function pinDot(x: number, y: number, r: number, color: string, key: number): JSX.Element {
  return (
    <g key={key}>
      <circle cx={x} cy={y} r={r} fill="none" stroke={color} strokeWidth={2.4} />
      <circle cx={x} cy={y} r={r * 0.42} fill={color} />
    </g>
  );
}

function souStick(x: number, y: number, color: string, key: number): JSX.Element {
  const w = 9;
  const h = 24;
  return (
    <g key={key}>
      <rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx={4}
        fill="none"
        stroke={color}
        strokeWidth={2.2}
      />
      <line x1={x} y1={y - h / 2 + 4} x2={x} y2={y + h / 2 - 4} stroke={color} strokeWidth={1.6} />
    </g>
  );
}

function textFace(char: string, color: string): JSX.Element {
  return (
    <text
      x={50}
      y={72}
      textAnchor="middle"
      fontSize={62}
      fontWeight={800}
      fill={color}
      style={{ fontFamily: 'var(--font-serif-kr)' }}
    >
      {char}
    </text>
  );
}

/** 종류(0..33)와 적5 여부 → 앞면 도안 */
export function tileFaceArt(kind: number, red: boolean): JSX.Element {
  // 만수 (0..8): 숫자 + 萬
  if (kind < 9) {
    const color = red ? RED : INK;
    return (
      <g>
        <text
          x={50}
          y={54}
          textAnchor="middle"
          fontSize={44}
          fontWeight={800}
          fill={color}
          style={{ fontFamily: 'var(--font-serif-kr)' }}
        >
          {MAN_NUMERALS[kind]}
        </text>
        <text
          x={50}
          y={110}
          textAnchor="middle"
          fontSize={40}
          fontWeight={700}
          fill={red ? RED : '#7a2b24'}
          style={{ fontFamily: 'var(--font-serif-kr)' }}
        >
          萬
        </text>
      </g>
    );
  }

  // 통수 (9..17)
  if (kind < 18) {
    const n = kind - 9 + 1;
    const color = red ? RED : PIN;
    const layout = LAYOUTS[n] ?? [];
    const r = n >= 9 ? 8 : n === 1 ? 20 : 11;
    if (n === 1) {
      // 1통: 겹 고리 도안
      return (
        <g>
          <circle cx={50} cy={67} r={22} fill="none" stroke={color} strokeWidth={3} />
          <circle cx={50} cy={67} r={13} fill="none" stroke={color} strokeWidth={2.4} />
          <circle cx={50} cy={67} r={5} fill={red ? RED : '#b3892f'} />
        </g>
      );
    }
    return <g>{layout.map(([x, y], i) => pinDot(x, y, r, color, i))}</g>;
  }

  // 삭수 (18..26)
  if (kind < 27) {
    const n = kind - 18 + 1;
    const color = red ? RED : GREEN;
    if (n === 1) {
      // 1삭: 새 도안 (참새) — 간략 벡터
      return (
        <g stroke={color} strokeWidth={2.4} fill="none">
          <ellipse cx={50} cy={70} rx={16} ry={22} fill={color} opacity={0.12} />
          <path d="M50 44 q14 10 8 30 q-8 20 -8 22 q0 -2 -8 -22 q-6 -20 8 -30 z" fill={color} />
          <circle cx={50} cy={40} r={7} fill={color} />
          <circle cx={50} cy={39} r={2} fill="#fff" />
          <path d="M43 96 h14" strokeWidth={3} />
        </g>
      );
    }
    return <g>{(LAYOUTS[n] ?? []).map(([x, y], i) => souStick(x, y, color, i))}</g>;
  }

  // 풍패 (27..30)
  if (kind < 31) {
    return textFace(HONOR_CHARS[kind - 27] ?? '', INK);
  }
  // 백 (31): 빈 테두리 도안
  if (kind === 31) {
    return (
      <rect
        x={26}
        y={30}
        width={48}
        height={74}
        rx={6}
        fill="none"
        stroke={PIN}
        strokeWidth={3}
      />
    );
  }
  // 발 (32): 녹색 發
  if (kind === 32) return textFace('發', GREEN);
  // 중 (33): 적색 中
  return textFace('中', RED);
}
