import type { ReactNode } from 'react';
import { useGame } from '../store/game';
import { ArtIconButton } from './art';

/**
 * 로비 상단 명패 — 프사·닉네임·등급·엽전·저잣거리가 **한 판 안에** 들어간다.
 *
 * 전에는 잔액바(absolute right-3 top-3)와 이름표(메뉴 기둥 안)가 서로 모르는 채로
 * 같은 자리에 그려져 겹쳤다. 두 덩어리를 하나로 합치면 겹칠 수가 없다 —
 * 좌표를 맞추는 게 아니라 같은 흐름에 넣는 것이 답이다.
 */

/**
 * 작은 목패 칩 — 등급·엽전이 앉는 자리.
 * 원화(`chip-slot`)를 배경으로 늘려 쓴다. 알약 모양이라 가로로 늘려도 안 뭉개진다.
 */
function Chip({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span
      className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 px-5 text-sm font-bold text-gold-hi"
      title={title}
      style={{
        backgroundImage: 'url(/art/chip-slot.webp)',
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {children}
    </span>
  );
}

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
          원화 비율(5:1)을 그대로 두면 이 폭에서 높이가 70px로 눌려 글자가 갇힌다.
          가로 띠만으로 된 단순한 프레임이라 배경으로 깔아 세로만 늘려도 문양이 안 뭉개진다. */}
      <div
        className="relative h-[72px] w-full"
        style={{
          backgroundImage: 'url(/art/panel-profile.webp)',
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
          filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.5))',
        }}
      >
        <button
          type="button"
          onClick={() => setAccountOpen(true)}
          // 좌우 끝은 붉은 마구리라 글자가 안 보인다 — 크림색 판 안쪽으로만 앉힌다
          className="absolute inset-0 flex min-w-0 items-center gap-3 px-[14%] text-left transition hover:brightness-105"
        >
          <span className="relative block aspect-square h-[74%] shrink-0">
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
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="flex items-center gap-1.5">
              <span
                className="truncate text-[clamp(0.85rem,1.5vw,1.05rem)] font-black text-ink"
                style={{ fontFamily: 'var(--font-serif-kr)' }}
              >
                {nickname}
              </span>
              {!account && (
                <span className="shrink-0 rounded bg-dan-red/15 px-1.5 py-px text-[10px] font-bold text-dan-red">
                  게스트
                </span>
              )}
            </span>
            {stats && (
              <span className="truncate text-[11px] tabular-nums text-ink/55">
                {stats.games}국 · 1위 {stats.top1}
                {stats.avgRank !== null ? ` · 평균 ${stats.avgRank}위` : ''}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* 2단 — 등급·엽전 칩과 저잣거리. 명패 밖으로 빼야 서로 숨 쉴 자리가 난다.
          저잣거리 단추는 아이콘 밑에 글자가 붙으므로 줄 높이를 넉넉히 준다 */}
      <div className="flex min-h-[52px] items-center gap-2">
        {rank && (
          <Chip
            title={
              rank.placementLeft > 0
                ? `배치 대국 ${rank.placementLeft}국 남음 — 이 동안은 등급이 크게 움직입니다`
                : `${rank.games}국`
            }
          >
            <span style={{ fontFamily: 'var(--font-serif-kr)' }}>{rank.label}</span>
          </Chip>
        )}

        <Chip title="엽전">
          <img src="/art/icon-yeopjeon.webp" alt="" aria-hidden="true" className="size-5" />
          <span className="tabular-nums">{(wallet?.balance ?? 0).toLocaleString()}</span>
        </Chip>

        <span className="ml-auto shrink-0">
          <ArtIconButton
            icon="icon-nav-shop"
            label="저잣거리"
            size={34}
            onClick={() => setShopOpen(true)}
          />
        </span>
      </div>
    </div>
  );
}
