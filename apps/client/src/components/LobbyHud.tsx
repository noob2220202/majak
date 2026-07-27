import { useGame } from '../store/game';
import { Chip } from './Chip';
import { TierBadge } from './TierBadge';

/**
 * 로비 상단 명패 — 프사·닉네임·등급·엽전·저잣거리가 **한 판 안에** 들어간다.
 *
 * 전에는 잔액바(absolute right-3 top-3)와 이름표(메뉴 기둥 안)가 서로 모르는 채로
 * 같은 자리에 그려져 겹쳤다. 두 덩어리를 하나로 합치면 겹칠 수가 없다 —
 * 좌표를 맞추는 게 아니라 같은 흐름에 넣는 것이 답이다.
 */
export function LobbyHud() {
  const nickname = useGame((s) => s.nickname);
  const account = useGame((s) => s.account);
  const stats = useGame((s) => s.stats);
  const wallet = useGame((s) => s.wallet);
  const rank = useGame((s) => s.rank);
  const setShopOpen = useGame((s) => s.setShopOpen);
  const setAccountOpen = useGame((s) => s.setAccountOpen);

  return (
    <div className="pointer-events-auto flex w-full flex-col gap-1.5">
      {/* 1단 — 이름 명패.
          높이를 px로 박으면 폭에 따라 원화가 늘거나 눌린다. 비율은 이미지가 정하게 두고
          글자만 그 위에 얹는다 (원화 UI 조각 공통 방식). */}
      <div className="relative w-full">
        <img
          src="/art/panel-profile.webp"
          alt=""
          aria-hidden="true"
          className="block h-auto w-full"
          style={{ filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.5))' }}
        />
        <button
          type="button"
          onClick={() => setAccountOpen(true)}
          className="absolute inset-0 flex items-center text-left transition hover:brightness-110"
          title="계정"
        >
          {/* 초상은 왼쪽 붉은 마구리 위에 앉힌다. 크림판(판 높이의 57%)은 초상이
              들어가기엔 낮아, 판 전체 높이를 쓰는 자리로 옮겼다. */}
          <span className="relative ml-[2.5%] block aspect-square h-[88%] shrink-0">
            <img
              src="/art/char-dan-bust.webp"
              alt=""
              aria-hidden="true"
              className="absolute inset-[18%] size-[64%] rounded-full object-cover object-top"
            />
            <img
              src="/art/frame-avatar.webp"
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-contain"
            />
          </span>

          {/* 크림판은 오른쪽 14%에서 끝나고 그 뒤는 붉은 마구리다 — 글자가 넘어가면 안 보인다 */}
          <span className="flex min-w-0 flex-1 items-baseline gap-1.5 pl-[2%] pr-[15%]">
            <span
              className="truncate text-[clamp(0.8rem,1.4vw,1.05rem)] font-black text-ink"
              style={{ fontFamily: 'var(--font-serif-kr)' }}
            >
              {nickname}
            </span>
            {!account && (
              <span className="shrink-0 rounded bg-dan-red/15 px-1.5 py-px text-[10px] font-bold text-dan-red">
                게스트
              </span>
            )}
            {stats && (
              <span className="ml-auto shrink-0 text-[11px] tabular-nums text-ink/55">
                {stats.games}국 · 1위 {stats.top1}
                {stats.avgRank !== null ? ` · 평균 ${stats.avgRank}위` : ''}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* 2단 — 등급·엽전·저잣거리. 셋 다 같은 목패 칩이다.
          저잣거리만 아이콘+글자 버튼으로 두었더니 그것만 다른 물건처럼 보였다. */}
      <div className="flex items-center gap-2">
        {rank && (
          <Chip
            title={
              rank.placementLeft > 0
                ? `배치 대국 ${rank.placementLeft}국 남음 — 이 동안은 등급이 크게 움직입니다`
                : `${rank.games}국`
            }
          >
            {/* 대국 화면에서는 12px라 문양이 안 보인다 — 로비에서는 크게 보여 준다 */}
            <TierBadge tier={rank.tier} label={rank.label} size={22} />
          </Chip>
        )}

        <Chip title="엽전">
          <img src="/art/icon-yeopjeon.webp" alt="" aria-hidden="true" className="size-5" />
          <span className="tabular-nums">{(wallet?.balance ?? 0).toLocaleString()}</span>
        </Chip>

        <button
          type="button"
          onClick={() => setShopOpen(true)}
          className="ml-auto shrink-0 transition hover:brightness-110 active:scale-95"
        >
          <Chip title="저잣거리">
            <img
              src="/art/icon-nav-shop.webp"
              alt=""
              aria-hidden="true"
              className="h-6 w-auto"
            />
            <span style={{ fontFamily: 'var(--font-serif-kr)' }}>저잣거리</span>
          </Chip>
        </button>
      </div>
    </div>
  );
}
