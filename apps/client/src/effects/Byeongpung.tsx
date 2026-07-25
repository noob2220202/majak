import { memo } from 'react';
import { motion } from 'framer-motion';

/** 화료 연출 코스메틱 (§6.3) — 병풍 폭 색과 산수 색만 바꾼다 */
const VARIANTS: Record<string, { panel: string; ink: string }> = {
  'winEffect.basic': { panel: 'linear-gradient(150deg, #23283c 0%, #1a1e2e 55%, #12151f 100%)', ink: 'rgba(244,237,221,0.07)' },
  'winEffect.maehwa': { panel: 'linear-gradient(150deg, #3a2f18 0%, #241d10 55%, #16120a 100%)', ink: 'rgba(200,162,75,0.14)' },
  'winEffect.cheongryong': { panel: 'linear-gradient(150deg, #1c3350 0%, #142740 55%, #0d1a2b 100%)', ink: 'rgba(120,190,235,0.13)' },
};

/**
 * 병풍 연출 (PLAN.md §4.5): 만관 이상 화료 시 배경에 3폭 병풍이 펼쳐진다(900ms).
 * 역만이면 금박 파티클이 추가된다. 폭 색은 화료자가 장착한 연출을 따른다 (§6.3).
 */
export const Byeongpung = memo(function Byeongpung({
  panels = 3,
  gold = false,
  simplified = false,
  effectId,
}: {
  panels?: number;
  gold?: boolean;
  simplified?: boolean;
  effectId?: string;
}) {
  const list = Array.from({ length: panels });
  // 역만(gold)은 항상 금박 병풍이 우선한다
  const variant =
    (gold ? VARIANTS['winEffect.maehwa'] : VARIANTS[effectId ?? 'winEffect.basic']) ??
    (VARIANTS['winEffect.basic'] as { panel: string; ink: string });
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 flex items-stretch justify-center gap-1 px-6 py-10">
        {list.map((_, i) => (
          <motion.div
            key={i}
            initial={{ scaleX: simplified ? 1 : 0.02, opacity: simplified ? 1 : 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{
              duration: simplified ? 0.05 : 0.9,
              delay: simplified ? 0 : i * 0.12,
              ease: [0.2, 0.8, 0.2, 1],
            }}
            className="tex-hanji relative flex-1 rounded-sm"
            style={{
              transformOrigin: i < list.length / 2 ? 'right center' : 'left center',
              background: variant.panel,
              boxShadow: 'inset 0 0 40px rgba(0,0,0,0.6)',
              borderLeft: '1px solid rgba(200,162,75,0.25)',
              borderRight: '1px solid rgba(200,162,75,0.25)',
            }}
          >
            {/* 폭마다 은은한 산수 실루엣 */}
            <svg viewBox="0 0 100 300" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
              <path
                d={`M0 ${230 + i * 6} Q 26 ${180 - i * 12} 52 ${222 - i * 4} Q 78 ${252 + i * 3} 100 ${210 - i * 8} L100 300 L0 300 Z`}
                fill={variant.ink}
              />
              <circle cx={70 - i * 12} cy={62 + i * 10} r={13} fill={gold ? 'rgba(230,200,122,0.2)' : 'rgba(244,237,221,0.09)'} />
            </svg>
          </motion.div>
        ))}
      </div>

      {/* 역만: 금박 파티클 — CSS 애니메이션(합성 스레드)으로 처리해 프레임 드랍 방지 */}
      {gold && !simplified && (
        <div className="absolute inset-0">
          {Array.from({ length: 16 }).map((_, i) => {
            const left = (i * 41) % 100;
            const size = 4 + (i % 4) * 2.5;
            return (
              <span
                key={i}
                className="absolute top-0 anim-gold-flake"
                style={{
                  left: `${left}%`,
                  width: size,
                  height: size * 1.4,
                  background: 'linear-gradient(140deg, #f3dd9c, #c8a24b)',
                  borderRadius: '30% 60% 40% 50%',
                  boxShadow: '0 0 8px rgba(230,200,122,0.7)',
                  animationDuration: `${3.6 + (i % 5) * 0.5}s`,
                  animationDelay: `${(i % 7) * 0.18}s`,
                  willChange: 'transform, opacity',
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});
