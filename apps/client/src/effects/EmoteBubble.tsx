import { memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { RelPos } from '../screens/game/geometry';

/**
 * 이모티콘 말풍선 (§7 Phase 5 이모티콘 소통).
 * 좌석 이름표 옆에 탈이 튀어나왔다가 사라진다. 판을 가리지 않도록 작게 띄운다.
 */

export interface EmoteBalloon {
  /** 같은 좌석이 연속으로 보내도 각각 표시되도록 서버가 주는 구분자 */
  nonce: number;
  seat: number;
  itemId: string;
}

/** 상대 위치에 따라 말풍선이 튀어나오는 방향 */
const POP: Record<RelPos, { x: number; y: number }> = {
  self: { x: 0, y: -14 },
  top: { x: 0, y: 14 },
  left: { x: 18, y: 0 },
  right: { x: -18, y: 0 },
};

export const EmoteBubble = memo(function EmoteBubble({
  balloon,
  pos,
  simplified = false,
}: {
  balloon: EmoteBalloon | null;
  pos: RelPos;
  simplified?: boolean;
}) {
  const off = POP[pos];
  return (
    <AnimatePresence>
      {balloon && (
        <motion.div
          key={balloon.nonce}
          initial={{ opacity: 0, scale: 0.5, x: -off.x, y: -off.y }}
          animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: simplified ? 0.05 : 0.24, ease: [0.3, 1.5, 0.5, 1] }}
          className="pointer-events-none absolute left-1/2 top-0 z-30 -translate-x-1/2 -translate-y-full pb-1"
        >
          <div className="rounded-xl bg-hanji/95 p-1 ring-1 ring-gold/40 shadow-lg">
            <img
              src={`/art/${balloon.itemId.replace('.', '-')}.webp`}
              alt=""
              aria-hidden="true"
              className="size-11 object-contain"
              onError={(e) => {
                // 원화가 아직 없는 이모티콘은 조용히 숨긴다 (탈 6종은 미생성분)
                e.currentTarget.style.visibility = 'hidden';
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
