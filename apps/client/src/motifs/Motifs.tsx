import { memo } from 'react';

/**
 * 한국 전통 문양 라이브러리 (PLAN.md §4.3).
 * 전부 자체 제작 SVG — 이모지·유니코드 특수문자 미사용 (§9-5).
 */

/** 처마 실루엣: 완만한 현수곡선 + 수막새 반복 (게임 시그니처 셰이프) */
export const Eaves = memo(function Eaves({
  height = 96,
  fill = 'var(--ink)',
  className = '',
}: {
  height?: number;
  fill?: string;
  className?: string;
}) {
  const W = 1440;
  const H = 200;
  // 양끝이 위로 들리고 가운데가 처지는 처마 곡선
  const EDGE = 34;
  const CTRL = 168;
  const N = 17;
  const pt = (t: number): { x: number; y: number } => ({
    x: W * t,
    y: (1 - t) ** 2 * EDGE + 2 * (1 - t) * t * CTRL + t ** 2 * EDGE,
  });
  const caps = Array.from({ length: N }, (_, i) => pt((i + 0.5) / N));
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ height, width: '100%', display: 'block' }}
      className={className}
      aria-hidden="true"
    >
      {/* 지붕면 */}
      <path d={`M0,0 H${W} V${EDGE} Q${W / 2},${CTRL} 0,${EDGE} Z`} fill={fill} />
      {/* 처마 끝선 (금박 하이라이트) */}
      <path
        d={`M0,${EDGE} Q${W / 2},${CTRL} ${W},${EDGE}`}
        fill="none"
        stroke="var(--gold)"
        strokeOpacity={0.32}
        strokeWidth={2.5}
      />
      {/* 기왓골: 지붕면의 세로 결 */}
      {Array.from({ length: N }, (_, i) => {
        const p = pt((i + 0.5) / N);
        return (
          <line
            key={`r${i}`}
            x1={p.x}
            y1={0}
            x2={p.x}
            y2={p.y - 4}
            stroke="var(--gold)"
            strokeOpacity={0.1}
            strokeWidth={2}
          />
        );
      })}
      {/* 수막새 (서까래 끝단) */}
      {caps.map((p) => (
        <g key={p.x}>
          <circle cx={p.x} cy={p.y + 3} r={12} fill={fill} />
          <circle cx={p.x} cy={p.y + 3} r={7} fill="none" stroke="var(--gold)" strokeOpacity={0.42} strokeWidth={1.6} />
          <circle cx={p.x} cy={p.y + 3} r={2.4} fill="var(--gold)" fillOpacity={0.55} />
        </g>
      ))}
    </svg>
  );
});

/** 단청 머리초 보더: 삼청·뇌록·장단 3색 반복 + 금선 (2~4px 두께) */
export const DancheongBorder = memo(function DancheongBorder({
  height = 6,
  className = '',
}: {
  height?: number;
  className?: string;
}) {
  const seg = 34;
  return (
    <svg
      viewBox={`0 0 ${seg} 12`}
      preserveAspectRatio="none"
      style={{ height, width: '100%', display: 'block' }}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <pattern id="dancheong" width={seg} height="12" patternUnits="userSpaceOnUse">
          <rect width={seg} height="12" fill="var(--dan-blue)" />
          <path d={`M0 0 H${seg / 2} L${seg / 2 - 5} 6 L${seg / 2} 12 H0 Z`} fill="var(--dan-green)" />
          <path d={`M${seg / 2} 0 H${seg} L${seg - 5} 6 L${seg} 12 H${seg / 2} Z`} fill="var(--dan-orange)" opacity={0.9} />
          <circle cx={seg / 2} cy={6} r={2} fill="var(--hanji)" opacity={0.85} />
          <rect x={seg - 1.5} width="1.5" height="12" fill="var(--gold)" />
        </pattern>
      </defs>
      <rect width={seg} height="12" fill="url(#dancheong)" />
    </svg>
  );
});

/** 엽전: 가운데 사각 구멍 (공탁·재화 표시) */
export const Yeopjeon = memo(function Yeopjeon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="coin" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="var(--gold-hi)" />
          <stop offset="60%" stopColor="var(--gold)" />
          <stop offset="100%" stopColor="#8a6d2c" />
        </linearGradient>
      </defs>
      <circle cx={12} cy={12} r={11} fill="url(#coin)" stroke="#6f5522" strokeWidth={1} />
      <rect x={8.5} y={8.5} width={7} height={7} rx={1} fill="var(--ink)" />
    </svg>
  );
});

/** 수막새 문양 (패 뒷면·아이콘 공용): 연화 6판 + 겹 고리 */
export const Sumaksae = memo(function Sumaksae({
  size = 36,
  color = 'var(--gold)',
  opacity = 1,
}: {
  size?: number;
  color?: string;
  opacity?: number;
}) {
  // 연화 8판을 잎 모양(뾰족한 타원)으로 그려 작은 크기에서도 형태가 살아난다
  const petals = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ display: 'block', opacity }}>
      <circle cx={50} cy={50} r={46} fill="none" stroke={color} strokeWidth={3} />
      <circle cx={50} cy={50} r={39} fill="none" stroke={color} strokeWidth={1.2} opacity={0.5} />
      {petals.map((a, i) => (
        <path
          key={i}
          d="M50 16 C 58 26, 58 36, 50 44 C 42 36, 42 26, 50 16 Z"
          fill={color}
          opacity={0.92}
          transform={`rotate(${(a * 180) / Math.PI} 50 50)`}
        />
      ))}
      <circle cx={50} cy={50} r={8} fill={color} />
      <circle cx={50} cy={50} r={3.5} fill="var(--hanji)" opacity={0.5} />
    </svg>
  );
});

/** 조각보 로딩: 색면이 조각보처럼 맞춰지는 기하 애니메이션 */
export function JogakboLoader({ size = 120 }: { size?: number }) {
  const cells = [
    { x: 0, y: 0, w: 2, h: 2, c: 'var(--dan-blue)', d: 0 },
    { x: 2, y: 0, w: 2, h: 1, c: 'var(--dan-red)', d: 0.1 },
    { x: 4, y: 0, w: 1, h: 3, c: 'var(--gold)', d: 0.2 },
    { x: 2, y: 1, w: 1, h: 2, c: 'var(--dan-green)', d: 0.3 },
    { x: 3, y: 1, w: 1, h: 1, c: 'var(--hanji)', d: 0.4 },
    { x: 3, y: 2, w: 2, h: 2, c: 'var(--dan-orange)', d: 0.5 },
    { x: 0, y: 2, w: 2, h: 3, c: 'var(--dan-green)', d: 0.6 },
    { x: 2, y: 3, w: 1, h: 2, c: 'var(--dan-blue)', d: 0.7 },
    { x: 3, y: 4, w: 2, h: 1, c: 'var(--hanji)', d: 0.8 },
  ];
  return (
    <svg viewBox="0 0 5 5" width={size} height={size} aria-label="불러오는 중">
      {cells.map((c, i) => (
        <rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} fill={c.c} opacity={0.9}>
          <animate
            attributeName="opacity"
            values="0.15;0.95;0.15"
            dur="1.8s"
            begin={`${c.d}s`}
            repeatCount="indefinite"
          />
        </rect>
      ))}
      <rect width="5" height="5" fill="none" stroke="var(--gold)" strokeWidth={0.06} opacity={0.5} />
    </svg>
  );
}
