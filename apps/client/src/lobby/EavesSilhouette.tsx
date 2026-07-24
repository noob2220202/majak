const WIDTH = 1440;
const EDGE_Y = 42; // 처마 양끝 (들려 올라간 곡선 끝)
const CTRL_Y = 138; // 곡선 제어점 (중앙이 아래로 처지는 현수곡선)
const SUMAKSAE_COUNT = 15;

/** 처마 곡선 위의 점 (2차 베지에, x는 t에 대해 선형) */
function curvePoint(t: number): { x: number; y: number } {
  const y = (1 - t) ** 2 * EDGE_Y + 2 * (1 - t) * t * CTRL_Y + t ** 2 * EDGE_Y;
  return { x: WIDTH * t, y };
}

/**
 * 궁궐 처마 실루엣 — 게임의 시그니처 셰이프 (PLAN.md §4.3).
 * 완만한 현수곡선 아래로 수막새(원형 막새기와)가 늘어선다. 자체 제작 SVG.
 */
export function EavesSilhouette() {
  const sumaksae = Array.from({ length: SUMAKSAE_COUNT }, (_, i) =>
    curvePoint((i + 0.5) / SUMAKSAE_COUNT),
  );

  return (
    <svg
      viewBox={`0 0 ${WIDTH} 170`}
      preserveAspectRatio="none"
      className="h-24 w-full sm:h-28"
      role="presentation"
      aria-hidden="true"
    >
      <path
        d={`M0,0 H${WIDTH} V${EDGE_Y} Q${WIDTH / 2},${CTRL_Y} 0,${EDGE_Y} Z`}
        fill="var(--ink)"
      />
      {sumaksae.map((p) => (
        <g key={p.x}>
          <circle cx={p.x} cy={p.y + 2} r={11} fill="var(--ink)" />
          <circle
            cx={p.x}
            cy={p.y + 2}
            r={6.5}
            fill="none"
            stroke="var(--gold)"
            strokeOpacity={0.4}
            strokeWidth={1.5}
          />
        </g>
      ))}
    </svg>
  );
}
