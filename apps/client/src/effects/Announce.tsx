import { AnimatePresence, motion } from 'framer-motion';
import { memo } from 'react';

/**
 * 선언 연출 (PLAN.md §4.5): 리치·울기·화료 순간의 큰 글자 오버레이.
 * 붓 스트로크로 글자가 드러나고, 리치는 금빛 vignette가 1회 맥동한다.
 */

export type AnnounceKind = 'riichi' | 'call' | 'tsumo' | 'ron' | 'ryuukyoku';

export interface AnnounceItem {
  id: number;
  kind: AnnounceKind;
  text: string;
  /** 내 시점 상대 위치 (등장 방향) */
  from: 'self' | 'left' | 'top' | 'right';
}

/**
 * 선언에 대응하는 전각 도장 원화. 있으면 글자 대신 도장을 찍는다.
 * 유국처럼 도장이 없는 선언은 기존 붓글씨 텍스트로 그대로 나온다.
 */
const STAMP: Record<string, string> = {
  퐁: 'pon',
  치: 'chi',
  깡: 'kan',
  리치: 'riichi',
  론: 'ron',
  쯔모: 'tsumo',
};

const COLOR: Record<AnnounceKind, string> = {
  riichi: 'var(--gold-hi)',
  call: 'var(--hanji)',
  tsumo: 'var(--gold-hi)',
  ron: 'var(--seal)',
  ryuukyoku: 'var(--hanji)',
};

const OFFSET: Record<AnnounceItem['from'], { x: number; y: number }> = {
  self: { x: 0, y: 90 },
  top: { x: 0, y: -90 },
  left: { x: -140, y: 0 },
  right: { x: 140, y: 0 },
};

export const Announce = memo(function Announce({
  items,
  simplified,
}: {
  items: AnnounceItem[];
  simplified: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      <AnimatePresence>
        {items.map((item) => {
          const off = OFFSET[item.from];
          const stamp = STAMP[item.text];
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: simplified ? 1 : 1.35, x: off.x, y: off.y }}
              animate={{ opacity: 1, scale: 1, x: off.x * 0.35, y: off.y * 0.35 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: simplified ? 0.08 : 0.28, ease: [0.2, 0.8, 0.2, 1] }}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            >
              {stamp ? (
                // 도장은 살짝 기울여 찍어야 눌러 찍은 느낌이 난다
                <motion.img
                  src={`/art/fx-call-${stamp}.webp`}
                  alt={item.text}
                  initial={{ rotate: simplified ? -4 : -14 }}
                  animate={{ rotate: -4 }}
                  transition={{ duration: simplified ? 0 : 0.22, ease: [0.3, 1.4, 0.5, 1] }}
                  className="w-[clamp(120px,17vw,210px)]"
                  style={{ filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.7))' }}
                />
              ) : (
                <span
                  className={simplified ? '' : 'anim-brush'}
                  style={{
                    display: 'block',
                    fontFamily: 'var(--font-serif-kr)',
                    fontWeight: 900,
                    fontSize: 78,
                    letterSpacing: '0.1em',
                    color: COLOR[item.kind],
                    textShadow:
                      '0 2px 0 rgba(0,0,0,0.55), 0 0 26px rgba(0,0,0,0.65), 0 0 46px rgba(230,200,122,0.35)',
                  }}
                >
                  {item.text}
                </span>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* 리치 선언: 금빛 vignette 1회 맥동 */}
      <AnimatePresence>
        {items.some((i) => i.kind === 'riichi') && !simplified && (
          <motion.div
            key="riichi-vignette"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, times: [0, 0.35, 1] }}
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at center, transparent 42%, rgba(230,200,122,0.28) 78%, rgba(230,200,122,0.5) 100%)',
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
});
