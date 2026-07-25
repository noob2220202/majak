import { useEffect, useRef, useState } from 'react';
import type { GameActionPayload } from '@cheongiwa/protocol';
import type { TileId } from '@cheongiwa/engine';
import { Button } from '../../components/ui';
import { ArtIconButton } from '../../components/art';
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
  const deadlineRef = useRef<number | null>(null);

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

  return (
    <div
      className={`relative min-h-dvh px-3 py-3 ${simplified ? 'reduced-motion' : ''}`}
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
      {/* 상단 바 */}
      <div className="mx-auto mb-2 flex max-w-6xl items-center justify-between">
        <div className="flex items-center gap-3">
          <ArtIconButton icon="icon-game-sync" label="동기화" size={34} onClick={() => send.syncRequest()} />
          {connection !== 'connected' && (
            <span className="rounded bg-dan-red/30 px-2 py-1 text-xs text-hanji">
              재연결 중…
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-hanji/40">시드 {game.seedHash.slice(0, 10)}…</span>
          <EmoteBar />
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl gap-3">
        {/* 좌: 보드 + 손패 */}
        <div className="flex-1">
          <Board game={game} reserveRatio={reserveRatio} />

          {/* 대기패 표시 */}
          <div className="mt-3 flex min-h-9 justify-center">
            <WaitsStrip game={game} rules={game.rules} />
          </div>

          {/* 내 손패 + 콜 버튼 */}
          <div className="mt-2 flex items-end justify-between gap-4">
            <MyHand
              hand={game.myHand}
              drawn={game.myDrawn}
              meldCount={myMelds}
              choices={choices}
              hints={hints}
              riichiArm={riichiArm}
              onDiscard={onDiscard}
            />
            <div className="min-h-[64px] shrink-0">
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
        <div className="hidden lg:block">
          <SidePanel />
        </div>
      </div>

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
