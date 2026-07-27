import { motion } from 'framer-motion';
import type { AbortiveReason } from '@cheongiwa/engine';
import type { RoundResultView, WinResultView } from '@cheongiwa/protocol';
import type { LocalGame } from '../../store/game';
import { Tile } from '../../tiles/Tile';
import { MeldRow } from './MeldRow';
import { Byeongpung } from '../../effects/Byeongpung';
import { CountUp } from '../../effects/CountUp';
import { DancheongBorder } from '../../motifs/Motifs';

const ABORTIVE_LABEL: Record<AbortiveReason, string> = {
  kyuushu: '구종구패',
  suufonRenda: '사풍연타',
  suuchaRiichi: '사가리치',
  suukaikan: '사깡산료',
  tripleRon: '트리플 론',
};

function seatName(game: LocalGame, seat: number): string {
  return game.players.find((p) => p.seat === seat)?.nickname ?? `${seat}번`;
}

function WinCard({
  win,
  game,
  simplified,
}: {
  win: WinResultView;
  game: LocalGame;
  simplified: boolean;
}) {
  const isYakuman = win.yakuman.length > 0;
  return (
    <div className="rounded-xl bg-ink/55 p-3 ring-1 ring-gold/20">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-semibold text-hanji">{seatName(game, win.seat)}</span>
        <span className="text-xs text-hanji/60">
          {win.from !== null ? `론 (←${seatName(game, win.from)})` : '쯔모'}
        </span>
        {win.pao !== null && (
          <span className="rounded bg-dan-red/30 px-1.5 text-[10px] text-hanji">
            파오 {seatName(game, win.pao)}
          </span>
        )}
      </div>

      <div className="mb-2 flex flex-wrap items-end gap-0.5">
        {win.hand.tiles.map((id) => (
          <Tile key={id} tileId={id} width={26} glow={id === win.winningTile ? 'gold' : null} />
        ))}
        <div className="ml-2">
          <MeldRow melds={win.hand.melds} width={24} />
        </div>
      </div>

      {win.uraIndicators.length > 0 && (
        <div className="mb-2 flex items-center gap-1">
          <span className="text-[10px] text-hanji/50">우라</span>
          {win.uraIndicators.map((k, i) => (
            <Tile key={i} kind={k} width={18} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {isYakuman
          ? win.yakuman.map((y) => (
              <span key={y.id} className="rounded bg-dan-red px-2 py-0.5 text-xs font-bold text-hanji">
                {y.name} {y.power > 1 ? '더블역만' : '역만'}
              </span>
            ))
          : win.yaku.map((y, i) => (
              <motion.span
                key={y.id + i}
                initial={simplified ? false : { scale: 1.35, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: simplified ? 0 : i * 0.07, duration: simplified ? 0 : 0.18, ease: [0.3, 1.4, 0.5, 1] }}
                className="rounded border border-hanji/15 bg-hanji/10 px-2 py-0.5 text-xs text-hanji"
              >
                {y.name} <span className="text-gold-hi">{y.han}판</span>
              </motion.span>
            ))}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        {!isYakuman && <span className="text-sm text-hanji/60">{win.fu}부 {win.han}판</span>}
        {win.limit && <span className="text-sm font-bold text-gold-hi">{win.limit}</span>}
        <CountUp
          to={win.gained}
          prefix="+"
          simplified={simplified}
          className="ml-auto text-xl font-black text-gold-hi"
        />
      </div>
    </div>
  );
}

/** 만관 이상이면 병풍, 역만이면 금박 파티클 (§4.5) */
const LIMIT_RANK: Record<string, number> = {
  만관: 1,
  하네만: 2,
  배만: 3,
  삼배만: 4,
  역만: 5,
};

export function RoundResultOverlay({
  result,
  game,
  simplified = false,
  onContinue,
}: {
  result: RoundResultView;
  game: LocalGame;
  simplified?: boolean;
  onContinue: () => void;
}) {
  const big =
    result.type === 'win'
      ? result.wins.reduce((max, w) => Math.max(max, LIMIT_RANK[w.limit ?? ''] ?? 0), 0)
      : 0;
  const isYakuman = result.type === 'win' && result.wins.some((w) => w.yakuman.length > 0);
  // 병풍 색은 화료자(더블론이면 첫 화료자)가 장착한 연출을 따른다 (§6.3)
  const winEffect =
    result.type === 'win'
      ? game.profiles.find((p) => p.seat === result.wins[0]?.seat)?.winEffect
      : undefined;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: simplified ? 0.05 : 0.25 }}
      className="absolute inset-0 z-30 grid place-items-center overflow-hidden bg-ink/88 p-4"
      onClick={onContinue}
    >
      {/* 결과 배경 원화 — 병풍 연출보다 뒤에 깔린다 */}
      <div
        className="pointer-events-none absolute inset-0 -z-20 bg-cover bg-[center_40%] opacity-70"
        style={{ backgroundImage: 'url(/art/bg-result.webp)' }}
        aria-hidden="true"
      />
      {/* 만관 이상: 병풍이 펼쳐짐 / 역만: 금박 파티클 */}
      {big >= 1 && (
        <Byeongpung gold={isYakuman || big >= 5} simplified={simplified} effectId={winEffect} />
      )}

      <motion.div
        initial={{ scale: simplified ? 1 : 0.94, y: simplified ? 0 : 10 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ duration: simplified ? 0.05 : 0.3, ease: [0.2, 0.8, 0.2, 1] }}
        // 최종 결과와 같은 남색 판으로 맞춘다 — 국 결과만 회색 한지 카드라
        // 두 결과 화면이 다른 게임처럼 보였다
        className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border-2 border-gold/40 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.6)]"
        style={{ background: 'linear-gradient(160deg, #2c3040 0%, #1e2436 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-x-0 top-0 overflow-hidden rounded-t-2xl">
          <DancheongBorder height={5} />
        </div>

        {result.type === 'win' && (
          <div className="flex flex-col gap-3 pt-2">
            <h2
              className={`text-center text-3xl font-black tracking-widest text-gold-hi ${simplified ? '' : 'anim-brush'}`}
              style={{ fontFamily: 'var(--font-serif-kr)' }}
            >
              화료
            </h2>
            {result.wins.map((w) => (
              <WinCard key={w.seat} win={w} game={game} simplified={simplified} />
            ))}
          </div>
        )}

        {result.type === 'exhaustive' && (
          <div>
            <h2
              className={`mb-3 pt-2 text-center text-3xl font-black tracking-widest text-gold-hi/85 ${simplified ? '' : 'anim-brush'}`}
              style={{ fontFamily: 'var(--font-serif-kr)' }}
            >
              황패유국
            </h2>
            <p className="text-center text-sm text-hanji/70">
              텐파이:{' '}
              {result.tenpai
                .map((t, i) => (t ? seatName(game, i) : null))
                .filter(Boolean)
                .join(', ') || '없음'}
              {result.nagashi.length > 0 &&
                ` · 나가시만관 ${result.nagashi.map((s) => seatName(game, s)).join(', ')}`}
            </p>
            {result.revealed.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {result.revealed.map((h) => (
                  <div key={h.seat} className="rounded-lg bg-ink/50 p-2">
                    <p className="mb-1 text-xs text-hanji/60">{seatName(game, h.seat)}</p>
                    <div className="flex flex-wrap gap-0.5">
                      {h.tiles.map((id) => (
                        <Tile key={id} tileId={id} width={22} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {result.type === 'abortive' && (
          <div>
            <h2
              className={`pt-2 text-center text-3xl font-black tracking-widest text-gold-hi/85 ${simplified ? '' : 'anim-brush'}`}
              style={{ fontFamily: 'var(--font-serif-kr)' }}
            >
              도중유국
            </h2>
            <p className="mt-2 text-center text-sm text-hanji/70">{ABORTIVE_LABEL[result.reason]}</p>
          </div>
        )}

        <div className="mt-4 grid grid-cols-4 gap-2 rounded-lg bg-ink/40 p-2 text-center">
          {result.scores.map((score, seat) => (
            <div key={seat}>
              <p className="truncate text-[11px] text-hanji/55">{seatName(game, seat)}</p>
              <CountUp
                to={score}
                simplified={simplified}
                className="block text-sm font-bold text-hanji"
              />
              <p
                className={`text-xs tabular-nums ${
                  (result.deltas[seat] ?? 0) > 0
                    ? 'text-dan-green'
                    : (result.deltas[seat] ?? 0) < 0
                      ? 'text-dan-red'
                      : 'text-hanji/40'
                }`}
              >
                {(result.deltas[seat] ?? 0) > 0 ? '+' : ''}
                {result.deltas[seat] ?? 0}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-3 text-center text-xs text-hanji/45">화면을 누르면 계속</p>
      </motion.div>
    </motion.div>
  );
}
