import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, Panel } from '../components/ui';
import { send } from '../net/socket';
import { useGame } from '../store/game';
import { AccountPanel } from './AccountPanel';
import { AuthCard } from './AuthCard';
import { Scene } from './Scene';
import { Plaque } from '../components/Plaque';
import { LobbyHud } from '../components/LobbyHud';
import { Yeopjeon } from '../motifs/Motifs';

/** 로비에 세울 수 있는 캐릭터. 클릭하면 다음 사람으로 넘어간다 (표시 전용) */
const CAST = [
  { id: 'dan', name: '단' },
  { id: 'mae', name: '매' },
  { id: 'seol', name: '설' },
  { id: 'ru', name: '루' },
] as const;

/** 대국 보상 획득 내역 — 로비 복귀 시 떠올랐다가 사라진다 (§6.2) */
function RewardFloat() {
  const rewards = useGame((s) => s.rewards);
  const clearRewards = useGame((s) => s.clearRewards);

  useEffect(() => {
    if (!rewards) return;
    const id = setTimeout(clearRewards, 6000);
    return () => clearTimeout(id);
  }, [rewards, clearRewards]);

  return (
    <AnimatePresence>
      {rewards && (
        <motion.div
          key={rewards.gameId}
          initial={{ opacity: 0, x: -16, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -18 }}
          transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          // 세로 화면에서는 띄울 빈자리가 없다 — 현판을 가리지 않게 흐름 안에 끼워 넣고,
          // 넓은 화면에서만 좌상단에 띄운다
          // 명패·현판과 같은 톤으로 — 회색 박스만 혼자 놀지 않게
          className="pointer-events-auto relative z-20 mb-3 w-full max-w-md cursor-pointer rounded-lg border-2 border-gold/50 bg-[#1a2030]/95 p-3 shadow-[0_6px_16px_rgba(0,0,0,0.5)] md:absolute md:left-5 md:top-14 md:mb-0 md:w-56"
          onClick={clearRewards}
        >
          <p className="text-xs font-semibold tracking-wider text-gold" style={{ fontFamily: 'var(--font-serif-kr)' }}>
            엽전을 받았습니다
          </p>
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {rewards.lines.map((line) => (
              <li key={line.reason} className="flex justify-between text-[11px] text-hanji/70">
                <span>{line.label}</span>
                <span className="tabular-nums text-gold-hi">+{line.amount.toLocaleString()}</span>
              </li>
            ))}
          </ul>
          <div className="mt-1.5 flex justify-between border-t border-hanji/15 pt-1.5 text-sm font-bold text-gold-hi">
            <span className="flex items-center gap-1">
              <Yeopjeon size={13} />합계
            </span>
            <span className="tabular-nums">+{rewards.total.toLocaleString()}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MainMenu() {
  const { queue, fillOffer } = useGame();
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  if (queue) {
    return (
      <Panel className="w-full text-center">
        <p className="text-lg font-semibold text-hanji">빠른 대전 대기 중…</p>
        <p className="mt-1 text-sm text-hanji/60">
          {Math.floor(queue.waitingMs / 1000)}초 경과 · 대기 {queue.position}번째
        </p>
        {/* 실력대를 좁게 잡고 시작해 기다릴수록 넓힌다. MMR 수치는 보여 주지 않고
            "지금 얼마나 넓혀 찾고 있는지"만 알린다 (§3.2) */}
        <p className="mt-1 text-xs text-hanji/45">
          {queue.band < 600
            ? '비슷한 실력대에서 찾는 중'
            : queue.band < 1600
              ? '범위를 넓혀 찾는 중'
              : '실력대를 크게 열고 찾는 중'}
        </p>
        {fillOffer && (
          <div className="mt-4 rounded-lg bg-dan-orange/20 p-3 ring-1 ring-dan-orange/40">
            <p className="text-sm text-hanji">인원이 부족합니다. 봇으로 채우고 시작할까요?</p>
            <div className="mt-3 flex justify-center gap-2">
              <Button variant="seal" onClick={() => send.fillAccept(true)}>
                봇과 시작
              </Button>
              <Button variant="ghost" onClick={() => send.fillAccept(false)}>
                계속 대기
              </Button>
            </div>
          </div>
        )}
        <Button variant="ghost" className="mt-4" onClick={() => send.cancelQueue()}>
          취소
        </Button>
      </Panel>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="w-full"
    >
      {!joining ? (
        <div className="flex flex-col gap-2">
          <Plaque tone="indigo" index={0} label="빠른 대전" sub="실력이 비슷한 넷을 찾습니다" onClick={() => send.quickMatch()} />
          <Plaque tone="wood" index={1} label="친선방" sub="방을 만들어 벗을 부릅니다" onClick={() => send.roomCreate()} />
          <Plaque tone="vermilion" index={2} label="코드 참가" sub="여섯 자리 코드로 들어갑니다" onClick={() => setJoining(true)} />
          <Plaque tone="slate" index={3} label="연습 대국" sub="봇 3인과 둡니다" onClick={() => send.practice()} />
        </div>
      ) : (
        <Panel>
          <label className="text-sm font-semibold text-hanji/80">방 코드 6자리</label>
          <input
            value={code}
            maxLength={6}
            autoFocus
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && send.roomJoin(code)}
            className="mt-1.5 w-full rounded-md bg-white/90 px-3 py-2 text-center text-xl font-black tracking-[0.4em] text-ink outline-none"
            placeholder="ABC123"
          />
          <div className="mt-3 flex gap-2">
            <Button
              className="flex-1"
              disabled={code.length !== 6}
              onClick={() => send.roomJoin(code)}
            >
              참가
            </Button>
            <Button variant="ghost" onClick={() => setJoining(false)}>
              뒤로
            </Button>
          </div>
        </Panel>
      )}
    </motion.div>
  );
}

export function Lobby() {
  const userId = useGame((s) => s.userId);
  const simplified = useGame((s) => s.simplified);
  const [castIndex, setCastIndex] = useState(0);
  const cast = CAST[castIndex] ?? CAST[0];

  return (
    <Scene id="lobby" simplified={simplified}>
      <h1
        className="pointer-events-none absolute left-6 top-4 z-10 text-2xl font-black tracking-[0.35em] text-hanji drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
        style={{ fontFamily: 'var(--font-serif-kr)' }}
      >
        청기와
      </h1>

      {/* 마작상 — 클릭하면 다음 사람으로 바뀐다. 판정에 영향 없는 순수 표시 요소 */}
      {userId && (
        <button
          type="button"
          onClick={() => setCastIndex((i) => (i + 1) % CAST.length)}
          aria-label={`마작상 ${cast.name} — 눌러서 바꾸기`}
          title={`${cast.name} — 눌러서 바꾸기`}
          className="absolute bottom-0 left-[1%] z-20 hidden h-[86vh] max-h-[860px] w-[clamp(220px,26vw,430px)] md:block"
        >
          <AnimatePresence mode="wait">
            <motion.img
              key={cast.id}
              src={`/art/char-${cast.id}-full.webp`}
              alt=""
              aria-hidden="true"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 18 }}
              transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
              className="h-full w-full object-contain object-bottom"
              style={{ filter: 'drop-shadow(0 12px 30px rgba(0,0,0,0.55))' }}
            />
          </AnimatePresence>
        </button>
      )}

      {/* pt-14: 좌상단 제목과 겹치지 않게 본문 시작점을 내린다 */}
      <main className="pointer-events-none relative z-10 flex min-h-dvh flex-col items-center justify-center px-4 pb-8 pt-14 md:items-end md:py-8 md:pr-[6vw]">
        {userId && <RewardFloat />}
        <div className="pointer-events-auto flex w-full max-w-md flex-col gap-2 md:w-[min(34vw,min(46vh,460px))] md:max-w-none">
          {userId && <LobbyHud />}
          {userId ? <MainMenu /> : <AuthCard />}
        </div>
      </main>

      <AccountPanel />
    </Scene>
  );
}
