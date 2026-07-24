import { motion } from 'framer-motion';
import type { AbortiveReason } from '@cheongiwa/engine';
import type { RoundResultView, WinResultView } from '@cheongiwa/protocol';
import type { LocalGame } from '../../store/game';
import { Tile } from '../../tiles/Tile';
import { MeldRow } from './MeldRow';

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

function WinCard({ win, game }: { win: WinResultView; game: LocalGame }) {
  const isYakuman = win.yakuman.length > 0;
  return (
    <div className="rounded-xl bg-ink/60 p-3 ring-1 ring-hanji/10">
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
                initial={{ scale: 1.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.05, duration: 0.15 }}
                className="rounded bg-hanji/10 px-2 py-0.5 text-xs text-hanji"
              >
                {y.name} <span className="text-gold-hi">{y.han}판</span>
              </motion.span>
            ))}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        {!isYakuman && <span className="text-sm text-hanji/60">{win.fu}부 {win.han}판</span>}
        {win.limit && <span className="text-sm font-bold text-gold-hi">{win.limit}</span>}
        <span className="ml-auto text-lg font-black text-gold-hi">+{win.gained}</span>
      </div>
    </div>
  );
}

export function RoundResultOverlay({
  result,
  game,
  onContinue,
}: {
  result: RoundResultView;
  game: LocalGame;
  onContinue: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-30 grid place-items-center bg-ink/70 p-4 backdrop-blur-sm"
      onClick={onContinue}
    >
      <motion.div
        initial={{ scale: 0.94, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-giwa p-4 ring-1 ring-hanji/15"
        onClick={(e) => e.stopPropagation()}
      >
        {result.type === 'win' && (
          <div className="flex flex-col gap-3">
            <h2 className="text-center text-2xl font-black text-hanji" style={{ fontFamily: 'var(--font-serif-kr)' }}>
              화료
            </h2>
            {result.wins.map((w) => (
              <WinCard key={w.seat} win={w} game={game} />
            ))}
          </div>
        )}

        {result.type === 'exhaustive' && (
          <div>
            <h2 className="mb-3 text-center text-2xl font-black text-hanji" style={{ fontFamily: 'var(--font-serif-kr)' }}>
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
            <h2 className="text-center text-2xl font-black text-hanji" style={{ fontFamily: 'var(--font-serif-kr)' }}>
              도중유국
            </h2>
            <p className="mt-2 text-center text-sm text-hanji/70">{ABORTIVE_LABEL[result.reason]}</p>
          </div>
        )}

        <div className="mt-4 grid grid-cols-4 gap-2 rounded-lg bg-ink/40 p-2 text-center">
          {result.scores.map((score, seat) => (
            <div key={seat}>
              <p className="truncate text-[11px] text-hanji/55">{seatName(game, seat)}</p>
              <p className="text-sm font-bold tabular-nums text-hanji">{score.toLocaleString()}</p>
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
