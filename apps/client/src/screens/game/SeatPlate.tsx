import { TierBadge } from '../../components/TierBadge';
import type { SeatProfileView } from '@cheongiwa/protocol';
import type { SeatView } from '../../store/game';
import { SEAT_WIND_LABEL, seatWind } from './geometry';

/**
 * 좌석 이름표 — 원화 명패(`nameplate`) 위에 이름을 얹고, 점수는 점수봉 옆에 둔다.
 *
 * 명패는 6:1 이라 두 줄이 안 들어간다. 이름은 명패 안, 점수는 명패 아래 —
 * 비율은 이미지가 정하게 두고(원화 UI 조각 공통 방식) 폭만 정해 준다.
 */

/** 원화(526×87)에서 잰 남색 판 위치 */
const FACE = { left: '14.3%', right: '12.5%', top: '9.2%', bottom: '16.1%' };

/** 명패 폭. 마작상 논리 좌표(600px) 기준이라 상이 줄면 같이 줄어든다 */
const PLATE_W = 168;

export function SeatPlate({
  seat,
  dealer,
  active,
  reserveRatio,
  profile,
}: {
  seat: SeatView;
  dealer: number;
  active: boolean;
  reserveRatio: number | null;
  profile?: SeatProfileView;
}) {
  const wind = SEAT_WIND_LABEL[seatWind(seat.seat, dealer) - 27] ?? '';
  const isDealer = seat.seat === dealer;

  return (
    <div className="relative flex flex-col items-center" style={{ width: PLATE_W }}>
      {/* 차례인 좌석은 명패 뒤에서 등불처럼 밝아진다 */}
      {active && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-2 rounded-full"
          style={{
            background:
              'radial-gradient(ellipse at 50% 35%, rgba(230,200,122,0.42) 0%, transparent 70%)',
          }}
        />
      )}

      <div className="relative w-full">
        <img
          src="/art/nameplate.webp"
          alt=""
          aria-hidden="true"
          className="block h-auto w-full transition"
          style={{
            filter: active
              ? 'drop-shadow(0 0 10px rgba(230,200,122,0.75)) brightness(1.18)'
              : 'drop-shadow(0 3px 8px rgba(0,0,0,0.6))',
          }}
        />
        <span
          className="absolute flex items-center justify-center gap-1 overflow-hidden"
          style={FACE}
        >
          <span
            className={`grid size-[15px] shrink-0 place-items-center rounded-[3px] text-[10px] font-bold leading-none ${
              isDealer ? 'bg-dan-red text-hanji' : 'bg-hanji/20 text-hanji/85'
            }`}
            style={{ fontFamily: 'var(--font-serif-kr)' }}
            title={isDealer ? '장가' : undefined}
          >
            {wind}
          </span>
          <span className="truncate text-[12px] font-bold leading-none text-hanji">
            {seat.nickname}
          </span>
          {seat.isBot && <span className="shrink-0 text-[10px] text-hanji/45">봇</span>}
          {!seat.connected && !seat.isBot && (
            <span className="shrink-0 text-[10px] font-bold text-dan-red">끊김</span>
          )}
        </span>
      </div>

      {/* 점수. 리치를 걸었으면 내놓은 리치봉이 옆에 붙는다 —
          점수봉 아이콘도 붙여 봤지만 13px에서는 사선 막대라 슬래시로 읽혔다 */}
      <div className="-mt-0.5 flex items-center justify-center gap-1">
        <span
          className="text-[14px] font-bold leading-none tabular-nums text-gold-hi"
          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
        >
          {seat.score.toLocaleString()}
        </span>
        {seat.riichi?.accepted && (
          <img
            src="/art/icon-riichi-stick.webp"
            alt=""
            aria-hidden="true"
            title="리치"
            className="h-[13px] w-auto shrink-0"
          />
        )}
      </div>

      {profile?.tier && profile.rankLabel && (
        <TierBadge
          tier={profile.tier}
          label={profile.rankLabel}
          size={11}
          className="text-[9px] font-semibold tracking-wider text-gold/70"
        />
      )}

      {active && reserveRatio !== null && (
        <div className="mt-0.5 h-1 w-3/4 overflow-hidden rounded-full bg-ink/70">
          <div
            className="h-full bg-gold transition-[width] duration-1000 ease-linear"
            style={{ width: `${Math.max(0, Math.min(1, reserveRatio)) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
