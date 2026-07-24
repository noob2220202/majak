import { useState } from 'react';
import { motion } from 'framer-motion';
import type { GameEndView } from '@cheongiwa/protocol';
import type { LocalGame } from '../../store/game';
import { Button } from '../../components/ui';

const RANK_LABEL = ['1위', '2위', '3위', '4위'];
const END_REASON: Record<string, string> = {
  finished: '종국',
  tobi: '토비 종료',
  agariYame: '아가리야메',
  suddenDeathGoal: '서든데스 도달',
};

/** 최종 결과 (§5.1-5): 병풍 배경 순위표 + 우마 정산 + 시드 검증 */
export function GameEndOverlay({
  end,
  game,
  onLobby,
}: {
  end: GameEndView;
  game: LocalGame | null;
  onLobby: () => void;
}) {
  const [showSeed, setShowSeed] = useState(false);
  const seatName = (seat: number): string =>
    game?.players.find((p) => p.seat === seat)?.nickname ?? `${seat}번`;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-ink/85 p-4 backdrop-blur">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        className="w-full max-w-md rounded-2xl bg-giwa p-6 ring-1 ring-gold/30"
        style={{
          background:
            'linear-gradient(160deg, #2c3040 0%, #1e2436 100%)',
        }}
      >
        <h2
          className="text-center text-3xl font-black tracking-widest text-gold-hi"
          style={{ fontFamily: 'var(--font-serif-kr)' }}
        >
          최종 결과
        </h2>
        <p className="mt-1 text-center text-xs text-hanji/50">{END_REASON[end.endReason] ?? end.endReason}</p>

        <div className="mt-5 flex flex-col gap-2">
          {end.standings.map((s, i) => (
            <motion.div
              key={s.seat}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.15 + i * 0.12 }}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
                i === 0 ? 'bg-gold/20 ring-1 ring-gold/40' : 'bg-ink/40'
              }`}
            >
              <span
                className={`grid size-8 place-items-center rounded-full font-black ${
                  i === 0 ? 'bg-gold text-ink' : 'bg-hanji/15 text-hanji'
                }`}
              >
                {i + 1}
              </span>
              <div className="flex-1">
                <p className="font-semibold text-hanji">{seatName(s.seat)}</p>
                <p className="text-xs text-hanji/55 tabular-nums">
                  {s.rawScore.toLocaleString()}점 · 우마 {s.uma > 0 ? '+' : ''}
                  {s.uma}
                </p>
              </div>
              <span className="text-xl font-black tabular-nums text-gold-hi">
                {s.finalPoints > 0 ? '+' : ''}
                {s.finalPoints.toFixed(1)}
              </span>
              <span className="text-xs text-hanji/40">{RANK_LABEL[i]}</span>
            </motion.div>
          ))}
        </div>

        <div className="mt-5 rounded-lg bg-ink/40 p-3">
          <button
            onClick={() => setShowSeed((v) => !v)}
            className="flex w-full items-center justify-between text-left text-xs text-hanji/60"
          >
            <span>공정성 증명 (시드 검증)</span>
            <span className="text-gold-hi">{showSeed ? '접기' : '보기'}</span>
          </button>
          {showSeed && (
            <div className="mt-2 break-all text-[10px] leading-relaxed text-hanji/50">
              <p className="text-hanji/70">시드 커밋 (시작 시 공개):</p>
              <p className="font-mono">{end.seedHash}</p>
              <p className="mt-1 text-hanji/70">시드 원본 (종료 시 공개):</p>
              <p className="font-mono">{end.seed}</p>
              <p className="mt-1 text-hanji/40">
                sha256(시드) == 커밋 → 셔플이 사전 고정되었음을 누구나 검증할 수 있습니다.
              </p>
            </div>
          )}
        </div>

        <Button className="mt-5 w-full py-3" onClick={onLobby}>
          로비로
        </Button>
      </motion.div>
    </div>
  );
}
