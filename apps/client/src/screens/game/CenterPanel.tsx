import type { RoundStartView } from '@cheongiwa/protocol';
import { Tile } from '../../tiles/Tile';
import { WIND_LABEL } from '../../store/eventText';
import { useGame } from '../../store/game';

/** 엽전 아이콘 (가운데 사각 구멍) — 공탁 표시 (§4.3) */
function Yeopjeon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <circle cx={12} cy={12} r={11} fill="#c8a24b" stroke="#8a6d2c" strokeWidth={1.5} />
      <rect x={8} y={8} width={8} height={8} rx={1} fill="#1e2436" />
    </svg>
  );
}

export function CenterPanel({ round }: { round: RoundStartView }) {
  const wind = WIND_LABEL[round.roundWind - 27] ?? '';
  const myBack = useGame((s) => s.wallet?.loadout.tileBack);
  return (
    <div className="grid place-items-center rounded-2xl bg-giwa/90 p-3 text-center ring-2 ring-ink/60 shadow-2xl">
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-black text-hanji" style={{ fontFamily: 'var(--font-serif-kr)' }}>
          {wind}
          {(round.kyoku % 4) + 1}국
        </span>
        {round.honba > 0 && <span className="text-sm text-hanji/70">{round.honba}본장</span>}
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-hanji/60">
        <span>잔여 {round.liveRemaining}</span>
        {round.pot > 0 && (
          <span className="flex items-center gap-1 text-gold-hi">
            <Yeopjeon /> {round.pot}
          </span>
        )}
      </div>
      {/* 도라 표시패 — 원화 슬롯판 위에 실제 패를 올린다. 빈 칸은 아직 뒤집히지 않은 자리다 */}
      <div className="relative mt-1.5 w-[186px]" role="group" aria-label="도라 표시패">
        <img
          src="/art/panel-dora.webp"
          alt=""
          aria-hidden="true"
          className="pointer-events-none w-full"
          style={{ aspectRatio: 490 / 178 }}
        />
        <div className="absolute inset-x-[6%] bottom-[24%] top-[36%] flex items-center justify-center gap-[2px]">
          {round.doraIndicators.map((kind, i) => (
            <Tile key={i} kind={kind} width={21} />
          ))}
          {Array.from({ length: Math.max(0, 5 - round.doraIndicators.length) }).map((_, i) => (
            <Tile key={`b${i}`} faceDown width={21} backId={myBack} dimmed />
          ))}
        </div>
      </div>
    </div>
  );
}
