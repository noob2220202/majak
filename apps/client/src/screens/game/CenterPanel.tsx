import type { RoundStartView } from '@cheongiwa/protocol';
import { Tile } from '../../tiles/Tile';
import { WIND_LABEL } from '../../store/eventText';
import { useGame } from '../../store/game';

/**
 * 마작상 한가운데 — 단청 팔각 문양(`table-center`) 위에 장·국을 얹고,
 * 도라 표시패는 그 아래 슬롯판(`panel-dora`)에 놓는다.
 *
 * 문양 한가운데에 연꽃이 있어 글자와 부딪힌다. 원화를 다시 뽑는 대신
 * 가운데만 어둡게 덮었다 — 테두리 단청과 기와는 그대로 살아 있다.
 */

export function CenterPanel({ round }: { round: RoundStartView }) {
  const wind = WIND_LABEL[round.roundWind - 27] ?? '';
  const myBack = useGame((s) => s.wallet?.loadout.tileBack);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[158px]">
        <img
          src="/art/table-center.webp"
          alt=""
          aria-hidden="true"
          className="block h-auto w-full"
          style={{ filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.55))' }}
        />
        {/* 연꽃을 눌러 글자 자리를 낸다 */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-[22%] rounded-full"
          style={{
            background:
              'radial-gradient(closest-side, rgba(8,12,26,0.92) 55%, rgba(8,12,26,0) 100%)',
          }}
        />
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p
              className="text-[26px] font-black leading-none text-hanji"
              style={{
                fontFamily: 'var(--font-serif-kr)',
                textShadow: '0 2px 6px rgba(0,0,0,0.95)',
              }}
            >
              {wind}
              {(round.kyoku % 4) + 1}국
            </p>
            {round.honba > 0 && (
              <p className="mt-0.5 text-[11px] leading-none text-hanji/75">{round.honba}본장</p>
            )}
            <p className="mt-1 flex items-center justify-center gap-2 text-[11px] leading-none text-hanji/60">
              <span className="tabular-nums">잔여 {round.liveRemaining}</span>
              {/* 공탁은 상 위에 놓인 리치봉 그 자체다 — 엽전이 아니라 봉을 보여 준다 */}
              {round.pot > 0 && (
                <span className="flex items-center gap-1 text-gold-hi" title="공탁">
                  <img
                    src="/art/icon-riichi-stick.webp"
                    alt=""
                    aria-hidden="true"
                    className="h-[15px] w-auto"
                  />
                  <span className="tabular-nums">{round.pot}</span>
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* 도라 표시패 — 빈 칸은 아직 뒤집히지 않은 자리다 */}
      <div className="relative -mt-1 w-[196px]" role="group" aria-label="도라 표시패">
        <img
          src="/art/panel-dora.webp"
          alt=""
          aria-hidden="true"
          className="pointer-events-none block h-auto w-full"
          style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))' }}
        />
        <div className="absolute inset-x-[6%] bottom-[24%] top-[36%] flex items-center justify-center gap-[2px]">
          {round.doraIndicators.map((kind, i) => (
            <Tile key={i} kind={kind} width={24} />
          ))}
          {Array.from({ length: Math.max(0, 5 - round.doraIndicators.length) }).map((_, i) => (
            <Tile key={`b${i}`} faceDown width={24} backId={myBack} dimmed />
          ))}
        </div>
      </div>
    </div>
  );
}
