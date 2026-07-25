import { useEffect, useRef } from 'react';

/**
 * 점수 카운트업 (PLAN.md §4.5 화료 연출).
 *
 * 프레임마다 setState하면 오버레이 전체가 리렌더되어 프레임이 드랍된다.
 * 따라서 DOM 텍스트만 직접 갱신한다 (React 리렌더 0회).
 */
export function CountUp({
  to,
  duration = 700,
  simplified = false,
  prefix = '',
  className = '',
}: {
  to: number;
  duration?: number;
  simplified?: boolean;
  prefix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const render = (v: number): void => {
      el.textContent = `${prefix}${v.toLocaleString()}`;
    };
    if (simplified) {
      render(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / duration);
      render(Math.round(to * (1 - (1 - t) ** 3))); // easeOutCubic
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    render(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration, simplified, prefix]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {prefix}
      {simplified ? to.toLocaleString() : '0'}
    </span>
  );
}
