import { memo, type ReactNode } from 'react';
import { motion } from 'framer-motion';

/**
 * 원화 배경 레이어 (ART-DIRECTION.md 핸드오프).
 *
 * 배경 그림은 `public/art/*.webp` 에서 오고, 그 위에 얹는 분위기(꽃잎·스크림)는 코드로 만든다.
 * 원화가 로드되기 전이나 실패했을 때는 bg-night 단색이 보인다.
 * 새 배경을 넣을 때는 handoff 에 파일을 두고 `pnpm build-art` 를 돌린 뒤 여기에 슬롯만 추가한다.
 */

export type SceneId = 'lobby' | 'room' | 'hall' | 'quarters' | 'result';

/** 18~06시에는 로비를 야경으로 바꾼다 */
const isNight = (): boolean => {
  const h = new Date().getHours();
  return h >= 18 || h < 6;
};

const SRC: Record<SceneId, string> = {
  lobby: '/art/bg-lobby.webp',
  room: '/art/bg-room.webp',
  hall: '/art/bg-hall.webp',
  quarters: '/art/bg-quarters.webp',
  result: '/art/bg-result.webp',
};

/** 장면마다 UI가 얹히는 자리가 달라 어둡기·초점 위치를 다르게 잡는다 */
const TREATMENT: Record<SceneId, { position: string; scrim: string }> = {
  lobby: {
    position: 'center 62%',
    scrim:
      'linear-gradient(180deg, rgba(8,13,30,0.72) 0%, rgba(8,13,30,0.12) 22%, rgba(8,13,30,0.10) 60%, rgba(8,13,30,0.55) 100%)',
  },
  room: {
    position: 'center 55%',
    scrim:
      'linear-gradient(180deg, rgba(8,13,30,0.80) 0%, rgba(8,13,30,0.42) 30%, rgba(8,13,30,0.55) 100%)',
  },
  hall: {
    position: 'center 45%',
    scrim: 'radial-gradient(ellipse at 50% 45%, rgba(8,13,30,0.15) 0%, rgba(8,13,30,0.72) 100%)',
  },
  quarters: {
    position: 'center 50%',
    scrim:
      'linear-gradient(180deg, rgba(8,13,30,0.70) 0%, rgba(8,13,30,0.25) 30%, rgba(8,13,30,0.50) 100%)',
  },
  result: {
    position: 'center 40%',
    scrim: 'linear-gradient(160deg, rgba(8,13,30,0.55) 0%, rgba(8,13,30,0.80) 100%)',
  },
};

/** 흩날리는 꽃잎 — 간소화 모드에서는 끈다 */
const PETALS = [9, 23, 38, 52, 67, 79, 91];

export const Scene = memo(function Scene({
  id,
  simplified = false,
  children,
  className = '',
}: {
  id: SceneId;
  simplified?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const { position, scrim } = TREATMENT[id];
  const src = id === 'lobby' && isNight() ? '/art/bg-lobby-night.webp' : SRC[id];

  return (
    <div className={`relative min-h-dvh overflow-hidden bg-night ${className}`}>
      <div
        className="absolute inset-0 bg-cover"
        style={{ backgroundImage: `url(${src})`, backgroundPosition: position }}
      />
      <div className="absolute inset-0" style={{ background: scrim }} />

      {!simplified && id !== 'hall' && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {PETALS.map((left, i) => (
            <motion.span
              key={i}
              initial={{ y: -30, opacity: 0, rotate: 0 }}
              animate={{ y: '106vh', opacity: [0, 0.8, 0.8, 0], rotate: 260 }}
              transition={{
                duration: 16 + (i % 4) * 3,
                delay: i * 2.1,
                repeat: Infinity,
                ease: 'linear',
              }}
              className="absolute top-0"
              style={{
                left: `${left}%`,
                width: 9,
                height: 9,
                borderRadius: '60% 0 60% 0',
                background: i % 3 === 0 ? '#f6dbe6' : '#f3c7d8',
                filter: 'drop-shadow(0 0 3px rgba(255,220,235,0.5))',
              }}
            />
          ))}
        </div>
      )}

      <div className="relative">{children}</div>
    </div>
  );
});
