import { useEffect, useRef, useState } from 'react';
import type { GameActionPayload } from '@cheongiwa/protocol';
import type { TileId } from '@cheongiwa/engine';
import { Button } from '../../components/ui';
import { send } from '../../net/socket';
import { useGame } from '../../store/game';
import { Board } from './Board';
import { CallBar } from './CallBar';
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
      <div className="grid min-h-dvh place-items-center bg-felt text-hanji">
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
    <div className="relative min-h-dvh bg-gradient-to-b from-[#183b32] to-[#0f261f] px-3 py-3">
      {/* 상단 바 */}
      <div className="mx-auto mb-2 flex max-w-6xl items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="px-3 py-1.5 text-sm" onClick={() => send.syncRequest()}>
            동기화
          </Button>
          {connection !== 'connected' && (
            <span className="rounded bg-dan-red/30 px-2 py-1 text-xs text-hanji">
              재연결 중…
            </span>
          )}
        </div>
        <span className="text-xs text-hanji/40">시드 {game.seedHash.slice(0, 10)}…</span>
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

      {/* 국 결과 오버레이 */}
      {game.roundResult && !gameEnd && (
        <RoundResultOverlay
          result={game.roundResult}
          game={game}
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
