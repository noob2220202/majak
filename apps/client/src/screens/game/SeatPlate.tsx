import type { SeatView } from '../../store/game';
import { SEAT_WIND_LABEL, seatWind } from './geometry';

/** 좌석 이름표: 이름·자풍·점수·리치·턴 표시. 예비시간 링은 활성 좌석에만. */
export function SeatPlate({
  seat,
  dealer,
  active,
  reserveRatio,
}: {
  seat: SeatView;
  dealer: number;
  active: boolean;
  reserveRatio: number | null;
}) {
  const wind = SEAT_WIND_LABEL[seatWind(seat.seat, dealer) - 27] ?? '';
  return (
    <div
      className={`relative rounded-lg px-3 py-1.5 text-center ring-1 transition ${
        active ? 'bg-gold/25 ring-gold shadow-[0_0_12px_rgba(230,200,122,0.5)]' : 'bg-ink/70 ring-hanji/15'
      }`}
    >
      <div className="flex items-center justify-center gap-1.5">
        <span
          className={`grid size-5 place-items-center rounded text-xs font-bold ${
            seat.seat === dealer ? 'bg-dan-red text-hanji' : 'bg-hanji/15 text-hanji/80'
          }`}
          style={{ fontFamily: 'var(--font-serif-kr)' }}
        >
          {wind}
        </span>
        <span className="max-w-24 truncate text-sm font-semibold text-hanji">
          {seat.nickname}
          {seat.isBot && <span className="ml-0.5 text-hanji/40">봇</span>}
        </span>
        {!seat.connected && !seat.isBot && (
          <span className="text-xs text-dan-red">끊김</span>
        )}
      </div>
      <div className="mt-0.5 flex items-center justify-center gap-2">
        <span className="text-base font-bold tabular-nums text-gold-hi">{seat.score.toLocaleString()}</span>
        {seat.riichi?.accepted && (
          <span className="rounded bg-dan-red px-1 text-[10px] font-bold text-hanji">리치</span>
        )}
      </div>
      {active && reserveRatio !== null && (
        <div className="absolute inset-x-2 -bottom-1 h-1 overflow-hidden rounded-full bg-ink/60">
          <div
            className="h-full bg-gold transition-[width] duration-1000 ease-linear"
            style={{ width: `${Math.max(0, Math.min(1, reserveRatio)) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
