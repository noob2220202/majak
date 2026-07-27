import { useEffect, useRef, useState } from 'react';
import type { GameActionPayload } from '@cheongiwa/protocol';
import type { TileId } from '@cheongiwa/engine';
import { Button } from '../../components/ui';
import { ArtIconButton } from '../../components/art';
import { useElementSize } from '../../hooks/useElementSize';
import { send } from '../../net/socket';
import { useGame } from '../../store/game';
import { unlockAudio } from '../../audio/sfx';
import { Announce } from '../../effects/Announce';
import { Board } from './Board';
import { CallBar } from './CallBar';
import { EmoteBar } from './EmoteBar';
import { GameEndOverlay } from './GameEndOverlay';
import { MyHand } from './MyHand';
import { RoundResultOverlay } from './RoundResultOverlay';
import { SidePanel } from './SidePanel';
import { WaitsStrip } from './WaitsStrip';

/** 상단 좌·우 덩어리 — 로비 현판과 같은 남색+금테 */
const TOP_PILL =
  'flex items-center gap-2 rounded-full border border-gold/35 bg-[#141a28]/85 px-2.5 py-1 shadow-[0_4px_14px_rgba(0,0,0,0.5)]';

export function GameScreen() {
  const game = useGame((s) => s.game);
  const gameEnd = useGame((s) => s.gameEnd);
  const connection = useGame((s) => s.connection);
  const hints = useGame((s) => s.hints);
  const simplified = useGame((s) => s.simplified);
  const announces = useGame((s) => s.announces);
  const clearGameEnd = useGame((s) => s.clearGameEnd);

  const [riichiArm, setRiichiArm] = useState(false);
  const [reserveRatio, setReserveRatio] = useState<number | null>(null);
  /** 좁은 화면에서는 사이드 패널을 서랍으로 연다 (설정·역 일람·기록에 닿을 길이 없었다) */
  const [panelOpen, setPanelOpen] = useState(false);
  const deadlineRef = useRef<number | null>(null);
  const { ref: rootRef, height: rootH } = useElementSize<HTMLDivElement>();

  const choices = game?.choices ?? null;

  // 결정 대기 타이머 (예비시간 링)
  useEffect(() => {
    setRiichiArm(false);
    if (!choices) {
      deadlineRef.current = null;
      setReserveRatio(null);
      return;
    }
    const total = choices.timeout.baseMs + choices.timeout.reserveMs;
    deadlineRef.current = Date.now() + total;
    const id = setInterval(() => {
      if (deadlineRef.current === null) return;
      const remain = deadlineRef.current - Date.now();
      setReserveRatio(Math.max(0, remain / total));
      if (remain <= 0) clearInterval(id);
    }, 200);
    return () => clearInterval(id);
  }, [choices]);

  if (!game) {
    return (
      <div
        className="grid min-h-dvh place-items-center bg-night text-hanji"
        style={{
          backgroundImage: 'url(/art/bg-loading.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="text-center">
          <p className="text-lg">대국 정보를 불러오는 중…</p>
          <Button variant="ghost" className="mt-4" onClick={() => send.syncRequest()}>
            다시 동기화
          </Button>
        </div>
      </div>
    );
  }

  const act = (action: GameActionPayload): void => {
    unlockAudio(); // 사용자 제스처에서 오디오 컨텍스트 활성화
    send.gameAction(action);
    setRiichiArm(false);
    // 낙관적으로 선택지 제거 (중복 전송 방지)
    useGame.setState((s) => (s.game ? { game: { ...s.game, choices: null } } : {}));
  };

  const onDiscard = (tileId: TileId, riichi: boolean): void => {
    act({ type: 'discard', tileId, riichi });
  };

  const myMelds = game.seats[game.mySeat]?.melds.length ?? 0;
  // 폰을 눕히면 세로가 390px뿐이라, 패를 46px로 두면 손패가 마작상보다 커진다.
  // 화면 높이에 비례해 상한을 낮춰 둘의 크기 균형을 맞춘다.
  const tileCap = rootH === 0 ? 46 : Math.max(20, Math.min(46, Math.round(rootH * 0.075)));

  return (
    <div
      ref={rootRef}
      className={`relative flex min-h-dvh flex-col overflow-x-clip px-2 py-3 sm:px-3 ${simplified ? 'reduced-motion' : ''}`}
      // 마작상 뒤 한옥 대청 — 중앙은 마작상에 가려지므로 좌우 기둥만 보인다.
      // 별도 레이어 대신 이 요소의 배경으로 깔아야 모든 자식 뒤에 확실히 들어간다.
      style={{
        backgroundImage:
          'radial-gradient(ellipse at 50% 46%, rgba(8,13,30,0.08) 0%, rgba(8,13,30,0.74) 100%),' +
          ' url(/art/bg-hall.webp)',
        backgroundSize: 'cover, cover',
        backgroundPosition: 'center, center 45%',
        backgroundAttachment: 'fixed, fixed',
        backgroundColor: '#080d1e',
      }}
    >
      {/* 상단 바 — 단추가 배경 위에 그냥 떠 있으면 화면에 속하지 않은 것처럼 보인다.
          로비 현판과 같은 남색+금테를 입히되, 화면 폭만큼 늘린 빈 캡슐이 되지 않게
          내용만큼만 감싸는 두 덩어리로 나눈다 */}
      <div className="mx-auto mb-2 flex w-full max-w-6xl shrink-0 items-start justify-between gap-2">
        <div className={TOP_PILL}>
          <ArtIconButton
            icon="icon-game-sync"
            label="동기화"
            size={30}
            onClick={() => send.syncRequest()}
          />
          {connection !== 'connected' && (
            <span className="rounded bg-dan-red/40 px-2 py-1 text-xs text-hanji">재연결 중…</span>
          )}
        </div>
        <div className={TOP_PILL}>
          <span className="hidden px-1 text-xs text-hanji/40 sm:inline" title="공정성 증명 시드">
            {game.seedHash.slice(0, 8)}…
          </span>
          <EmoteBar />
          {/* 사이드 패널이 접히는 폭에서만 나오는 서랍 손잡이 */}
          <ArtIconButton
            icon="icon-game-settings"
            label="설정"
            size={30}
            className="lg:hidden"
            onClick={() => setPanelOpen(true)}
          />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-3">
        {/* 좌: 보드 + 손패. min-w-0 이 없으면 flex 항목이 내용 폭 아래로 안 줄어 화면을 민다 */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* 마작상은 남는 자리를 통째로 받아 그 안에서 정사각으로 앉는다.
              min-h-0 이 있어야 flex 항목이 내용보다 작아질 수 있다 */}
          <div className="min-h-0 flex-1">
            <Board game={game} reserveRatio={reserveRatio} />
          </div>

          {/* 대기패 표시 */}
          <div className="mt-2 flex min-h-9 shrink-0 justify-center">
            <WaitsStrip game={game} rules={game.rules} />
          </div>

          {/* 내 손패 + 콜 버튼 — 좁으면 콜 버튼을 손패 위로 올린다.
              손패는 늘 화면 아래(엄지 닿는 자리)에 둔다 */}
          <div className="flex shrink-0 flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <MyHand
              hand={game.myHand}
              drawn={game.myDrawn}
              meldCount={myMelds}
              choices={choices}
              hints={hints}
              riichiArm={riichiArm}
              maxWidth={tileCap}
              onDiscard={onDiscard}
            />
            <div className="flex min-h-[52px] shrink-0 justify-center sm:min-h-[64px] sm:justify-end">
              {choices && (
                <CallBar
                  choices={choices}
                  riichiArm={riichiArm}
                  simplified={simplified}
                  onRiichiArm={setRiichiArm}
                  onAction={act}
                />
              )}
            </div>
          </div>
        </div>

        {/* 우: 사이드 패널 */}
        <div className="hidden w-64 shrink-0 lg:block">
          <SidePanel />
        </div>
      </div>

      {/* 좁은 화면용 사이드 패널 서랍 */}
      {panelOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden" role="dialog" aria-label="설정">
          <button
            type="button"
            aria-label="닫기"
            className="absolute inset-0 bg-ink/70"
            onClick={() => setPanelOpen(false)}
          />
          {/* 배경이 비치면 글씨가 안 읽혀서 서랍 바닥은 불투명하게 깐다 */}
          <div className="relative ml-auto flex h-dvh w-[min(16rem,86vw)] flex-col bg-giwa">
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="shrink-0 bg-giwa/90 py-2 text-sm font-semibold text-hanji"
            >
              닫기
            </button>
            <div className="min-h-0 flex-1">
              <SidePanel />
            </div>
          </div>
        </div>
      )}

      {/* 선언 연출 (리치·울기·화료·유국) */}
      <Announce items={announces} simplified={simplified} />

      {/* 국 결과 오버레이 */}
      {game.roundResult && !gameEnd && (
        <RoundResultOverlay
          result={game.roundResult}
          game={game}
          simplified={simplified}
          onContinue={() => {
            useGame.setState((s) => (s.game ? { game: { ...s.game, roundResult: null } } : {}));
          }}
        />
      )}

      {/* 최종 결과 */}
      {gameEnd && <GameEndOverlay end={gameEnd} game={game} onLobby={clearGameEnd} />}
    </div>
  );
}
