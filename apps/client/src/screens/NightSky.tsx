import { memo } from 'react';
import { motion } from 'framer-motion';
import { Eaves } from '../motifs/Motifs';

/**
 * 로비·대기방 공용 배경 (PLAN.md §5.1): 밤하늘 그라데이션 + 달 + 궁궐 처마.
 * 원화 이미지(`/assets/lobby-bg.webp`)가 준비되면 배경 레이어만 교체한다
 * (ART-DIRECTION.md 핸드오프 — 현재는 벡터 배경).
 */
export const NightSky = memo(function NightSky({
  simplified = false,
  children,
}: {
  simplified?: boolean;
  children?: React.ReactNode;
}) {
  const petals = [12, 28, 47, 63, 81, 92];
  return (
    <div className="relative min-h-dvh overflow-hidden bg-night">
      {/* 하늘 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, #080d1e 0%, #101528 45%, #1a2340 78%, #232c4a 100%)',
        }}
      />

      {/* 별 */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        {Array.from({ length: 34 }).map((_, i) => (
          <circle
            key={i}
            cx={`${(i * 173) % 100}%`}
            cy={`${(i * 47) % 46}%`}
            r={i % 6 === 0 ? 1.5 : 0.9}
            fill="#e8ecff"
            opacity={0.12 + (i % 7) * 0.055}
          />
        ))}
      </svg>

      {/* 달 — 우상단 UI(나가기 등)와 겹치지 않도록 아래쪽에 배치 */}
      <div
        className="absolute right-[9%] top-[36%] size-24 rounded-full"
        style={{
          background: 'radial-gradient(circle at 38% 34%, #fbf6e4 0%, #efe3c2 55%, #d9c9a0 100%)',
          boxShadow: '0 0 70px 22px rgba(243,234,208,0.18)',
          opacity: 0.9,
        }}
      />

      {/* 원경 능선 */}
      <svg
        className="absolute inset-x-0 bottom-0 h-[42%] w-full"
        viewBox="0 0 1440 400"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M0 210 Q 300 140 640 200 Q 980 258 1440 190 L1440 400 L0 400 Z" fill="#0d1428" opacity={0.85} />
        <path d="M0 300 Q 360 250 760 296 Q 1120 336 1440 288 L1440 400 L0 400 Z" fill="#080d1c" />
      </svg>

      {/* 흩날리는 꽃잎 */}
      {!simplified &&
        petals.map((left, i) => (
          <motion.span
            key={i}
            initial={{ y: -24, opacity: 0, rotate: 0 }}
            animate={{ y: '105vh', opacity: [0, 0.75, 0.75, 0], rotate: 240 }}
            transition={{ duration: 15 + (i % 4) * 3, delay: i * 2.4, repeat: Infinity, ease: 'linear' }}
            className="pointer-events-none absolute top-0"
            style={{
              left: `${left}%`,
              width: 8,
              height: 8,
              borderRadius: '60% 0 60% 0',
              background: '#f3dbe4',
              opacity: 0.7,
            }}
          />
        ))}

      {/* 상단 처마 (시그니처 셰이프) — 기와 청회색 (§4.1) */}
      <header className="relative">
        <Eaves height={124} fill="var(--giwa)" />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-3"
          style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.45), transparent)' }}
        />
      </header>

      <div className="relative">{children}</div>
    </div>
  );
});
