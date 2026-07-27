import { memo } from 'react';
import { motion } from 'framer-motion';

/**
 * 현판 버튼 (로비 대문짝 메뉴).
 *
 * 전에는 항목마다 **다른 원화**를 썼다 — 구름+금박 / 초롱 / 잉어+학 / 연화문. 프롬프트에
 * "통일"이라고 적는다고 붙지 않는다. 통일감은 같은 그림을 재사용해야 나온다.
 * 그래서 프레임은 `plaque-menu.webp` 한 장이고, 항목마다 다른 것은 **판 색과 글자**뿐이다.
 *
 * 프레임 안쪽은 완전히 뚫려 있어(alpha 0) 판 색을 CSS로 뒤에 깐다. 덕분에 색을
 * 바꾸려고 원화를 다시 뽑을 일이 없다.
 */

export type PlaqueTone = 'indigo' | 'wood' | 'vermilion' | 'slate';

/** 원화에서 실측한 구멍 위치 (1002×346 기준) */
const HOLE = { top: '17.9%', bottom: '13.0%', left: '7.7%', right: '8.0%' };

/** 판 바탕과 그 위 글자색 — 팔레트(PALETTE)에서 그대로 가져왔다 */
const TONE: Record<PlaqueTone, { panel: string; ink: string; shadow: string }> = {
  indigo: {
    panel: 'linear-gradient(180deg, #2a3350 0%, #1a2030 100%)',
    ink: '#f4eddd',
    shadow: '0 2px 8px rgba(0,0,0,0.8)',
  },
  wood: {
    panel: 'linear-gradient(180deg, #8a5a2e 0%, #6b431f 100%)',
    ink: '#fbf1dc',
    shadow: '0 2px 8px rgba(50,25,5,0.85)',
  },
  vermilion: {
    panel: 'linear-gradient(180deg, #b8422f 0%, #8d2c20 100%)',
    ink: '#fdf0dd',
    shadow: '0 2px 8px rgba(70,10,5,0.85)',
  },
  slate: {
    panel: 'linear-gradient(180deg, #3d5a4f 0%, #27423a 100%)',
    ink: '#f2f0ea',
    shadow: '0 2px 8px rgba(0,0,0,0.75)',
  },
};

export const Plaque = memo(function Plaque({
  tone,
  label,
  sub,
  onClick,
  disabled = false,
  index = 0,
}: {
  tone: PlaqueTone;
  label: string;
  sub?: string;
  onClick: () => void;
  disabled?: boolean;
  index?: number;
}) {
  const t = TONE[tone];

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45, delay: index * 0.08, ease: [0.2, 0.8, 0.2, 1] }}
      whileHover={disabled ? undefined : { scale: 1.03, y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.985 }}
      className="group relative block w-full disabled:opacity-45"
      aria-label={label}
    >
      {/* 판 색 — 프레임 구멍 뒤에 깔린다 */}
      <span
        aria-hidden="true"
        className="absolute rounded-[2px]"
        style={{
          top: HOLE.top,
          bottom: HOLE.bottom,
          left: HOLE.left,
          right: HOLE.right,
          background: t.panel,
          boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.45)',
        }}
      />

      {/* 프레임 — 비율은 이미지가 정한다 */}
      <img
        src="/art/plaque-menu.webp"
        alt=""
        aria-hidden="true"
        className="relative block h-auto w-full transition group-hover:brightness-110"
        style={{ filter: 'drop-shadow(0 8px 18px rgba(0,0,0,0.5))' }}
      />

      <span
        className="absolute flex flex-col items-center justify-center"
        style={{ top: HOLE.top, bottom: HOLE.bottom, left: HOLE.left, right: HOLE.right }}
      >
        <span
          className="text-[clamp(1.4rem,3.2vw,2.4rem)] font-black leading-none tracking-[0.18em]"
          style={{ fontFamily: 'var(--font-serif-kr)', color: t.ink, textShadow: t.shadow }}
        >
          {label}
        </span>
        {sub && (
          <span
            className="mt-1.5 text-[clamp(0.6rem,1vw,0.78rem)] tracking-wide opacity-75"
            style={{ color: t.ink }}
          >
            {sub}
          </span>
        )}
      </span>
    </motion.button>
  );
});
