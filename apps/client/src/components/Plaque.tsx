import { memo } from 'react';
import { motion } from 'framer-motion';

/**
 * 현판 버튼 (레퍼런스 로비의 대문짝만한 메뉴).
 *
 * 그림은 원화(`/art/plaque-menu-*.webp`)이고 글자는 코드로 얹는다. 원화마다 지붕 높이와
 * 좌우 장식(초롱·잉어)이 달라 글자가 앉는 자리가 조금씩 다르므로, 판 안쪽 비율을
 * 이미지별로 지정한다.
 */

export type PlaqueId = 1 | 2 | 3 | 4;

/** 판 안쪽(글자가 앉는 영역)의 비율 — 이미지 원본 기준 */
const INSET: Record<PlaqueId, { top: string; bottom: string; left: string; right: string }> = {
  1: { top: '30%', bottom: '13%', left: '13%', right: '13%' },
  2: { top: '36%', bottom: '14%', left: '17%', right: '17%' },
  3: { top: '30%', bottom: '13%', left: '21%', right: '21%' },
  4: { top: '32%', bottom: '12%', left: '13%', right: '13%' },
};

/** 판 바탕색에 맞춘 글자색 */
const INK: Record<PlaqueId, { color: string; shadow: string }> = {
  1: { color: '#f4eddd', shadow: '0 2px 6px rgba(0,0,0,0.75)' },
  2: { color: '#3a2312', shadow: '0 1px 2px rgba(255,240,210,0.55)' },
  3: { color: '#f9ecd8', shadow: '0 2px 6px rgba(80,10,10,0.8)' },
  4: { color: '#f2f0ea', shadow: '0 2px 6px rgba(0,0,0,0.7)' },
};

export const Plaque = memo(function Plaque({
  id,
  label,
  sub,
  onClick,
  disabled = false,
  index = 0,
}: {
  id: PlaqueId;
  label: string;
  sub?: string;
  onClick: () => void;
  disabled?: boolean;
  index?: number;
}) {
  const inset = INSET[id];
  const ink = INK[id];

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45, delay: index * 0.08, ease: [0.2, 0.8, 0.2, 1] }}
      whileHover={disabled ? undefined : { scale: 1.035, y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.985 }}
      className="relative block w-full disabled:opacity-45"
      aria-label={label}
    >
      {/* 비율은 이미지가 정한다 — 원화를 갈아끼워도 안 깨지게 */}
      <img
        src={`/art/plaque-menu-${id}.webp`}
        alt=""
        aria-hidden="true"
        className="block h-auto w-full"
        style={{ filter: 'drop-shadow(0 8px 18px rgba(0,0,0,0.5))' }}
      />
      <span
        className="absolute flex flex-col items-center justify-center"
        style={{ top: inset.top, bottom: inset.bottom, left: inset.left, right: inset.right }}
      >
        <span
          className="text-[clamp(1.4rem,3.4vw,2.5rem)] font-black leading-none tracking-[0.18em]"
          style={{ fontFamily: 'var(--font-serif-kr)', color: ink.color, textShadow: ink.shadow }}
        >
          {label}
        </span>
        {sub && (
          <span
            className="mt-1 text-[clamp(0.6rem,1vw,0.75rem)] tracking-wide opacity-75"
            style={{ color: ink.color }}
          >
            {sub}
          </span>
        )}
      </span>
    </motion.button>
  );
});
