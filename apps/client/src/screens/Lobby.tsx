import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, ConnectionBadge, Panel } from '../components/ui';
import { send } from '../net/socket';
import { useGame } from '../store/game';
import { unlockAudio } from '../audio/sfx';
import { NightSky } from './NightSky';
import { Sumaksae, Yeopjeon } from '../motifs/Motifs';

function AuthCard() {
  const [nickname, setNickname] = useState(
    () => localStorage.getItem('cheongiwa.nick') ?? '',
  );
  const connection = useGame((s) => s.connection);
  const submit = (): void => {
    const nick = nickname.trim();
    if (nick.length === 0) return;
    unlockAudio(); // 사용자 제스처에서 오디오 활성화 (§4.6)
    send.authHello({ nickname: nick });
  };
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="tex-hanji relative w-full max-w-sm rounded-xl bg-hanji p-8 text-ink shadow-2xl ring-1 ring-gold/30"
    >
      <div className="mb-2 flex justify-center">
        <Sumaksae size={46} color="var(--giwa)" opacity={0.85} />
      </div>
      <h2
        className="text-center text-4xl font-black tracking-widest"
        style={{ fontFamily: 'var(--font-serif-kr)' }}
      >
        청기와
      </h2>
      <p className="mt-2 text-center text-sm text-ink/60">한국 전통 온라인 리치마작</p>
      <label htmlFor="nickname" className="mt-8 block text-sm font-semibold text-ink/80">
        닉네임
      </label>
      <input
        id="nickname"
        type="text"
        value={nickname}
        maxLength={12}
        onChange={(e) => setNickname(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="대국에서 쓸 이름"
        className="mt-1.5 w-full rounded-md border border-giwa/25 bg-white/70 px-3 py-2 text-ink outline-none transition focus:border-dan-blue focus:ring-2 focus:ring-dan-blue/30"
      />
      <button
        onClick={submit}
        disabled={connection !== 'connected' || nickname.trim().length === 0}
        className="mt-6 w-full rounded-md bg-giwa py-2.5 font-semibold text-hanji transition hover:brightness-110 disabled:opacity-40"
      >
        입장
      </button>
      <p className="mt-3 text-center text-xs text-ink/45">
        게스트 입장 — 재접속용 토큰이 이 브라우저에 저장됩니다
      </p>
    </motion.section>
  );
}

/** 상단 현판: 엽전 잔액 + 등급 + 저잣거리 입구 (§6.3) */
function WalletBar() {
  const wallet = useGame((s) => s.wallet);
  const rank = useGame((s) => s.rank);
  const setShopOpen = useGame((s) => s.setShopOpen);

  return (
    <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
      {rank && (
        <span
          className="rounded-lg bg-ink/60 px-3 py-1.5 text-sm font-semibold text-gold ring-1 ring-gold/25"
          style={{ fontFamily: 'var(--font-serif-kr)' }}
          title={rank.toNext !== null ? `승단까지 ${rank.toNext}점` : '최고 등급'}
        >
          {rank.tier}
          {rank.level > 0 && ` ${rank.level}`}
        </span>
      )}
      <span className="flex items-center gap-1.5 rounded-lg bg-ink/60 px-3 py-1.5 text-sm font-bold tabular-nums text-gold-hi ring-1 ring-gold/25">
        <Yeopjeon size={14} />
        {(wallet?.balance ?? 0).toLocaleString()}
      </span>
      <button
        onClick={() => setShopOpen(true)}
        className="rounded-lg bg-giwa px-3 py-1.5 text-sm font-semibold text-hanji ring-1 ring-gold/30 transition hover:brightness-110"
        style={{ fontFamily: 'var(--font-serif-kr)' }}
      >
        저잣거리
      </button>
    </div>
  );
}

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
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -18 }}
          transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          className="tex-hanji absolute right-3 top-16 z-20 w-56 cursor-pointer rounded-xl bg-giwa p-3 ring-1 ring-gold/35"
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
  const { nickname, stats, queue, fillOffer } = useGame();
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  if (queue) {
    return (
      <Panel className="w-full max-w-sm text-center">
        <p className="text-lg font-semibold text-hanji">빠른 대전 대기 중…</p>
        <p className="mt-1 text-sm text-hanji/60">
          {Math.floor(queue.waitingMs / 1000)}초 경과 · 대기 {queue.position}번째
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
      className="w-full max-w-sm"
    >
      <div className="mb-4 flex items-center justify-between rounded-lg bg-hanji/10 px-4 py-2.5 ring-1 ring-gold/20">
        <span className="flex items-center gap-2 font-semibold text-hanji">
          <Yeopjeon size={15} />
          {nickname}
        </span>
        {stats && (
          <span className="text-xs text-hanji/60 tabular-nums">
            {stats.games}국 · 1위 {stats.top1}
            {stats.avgRank !== null ? ` · 평균 ${stats.avgRank}위` : ''}
          </span>
        )}
      </div>

      {!joining ? (
        <div className="flex flex-col gap-2.5">
          <Button className="py-3 text-lg" onClick={() => send.quickMatch()}>
            빠른 대전
          </Button>
          <Button variant="ghost" className="py-3" onClick={() => send.roomCreate()}>
            친선방 만들기
          </Button>
          <Button variant="ghost" className="py-3" onClick={() => setJoining(true)}>
            코드로 참가
          </Button>
          <Button variant="subtle" className="py-3" onClick={() => send.practice()}>
            연습 대국 (봇 3인)
          </Button>
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
  const connection = useGame((s) => s.connection);
  const userId = useGame((s) => s.userId);
  const simplified = useGame((s) => s.simplified);

  return (
    <NightSky simplified={simplified}>
      <h1
        className="pointer-events-none absolute inset-x-0 -top-24 text-center text-xl font-bold tracking-[0.5em] text-hanji/85"
        style={{ fontFamily: 'var(--font-serif-kr)' }}
      >
        청기와
      </h1>
      {userId && (
        <>
          <WalletBar />
          <RewardFloat />
        </>
      )}
      <main className="flex min-h-[calc(100dvh-104px)] flex-col items-center justify-center px-4 py-8">
        {userId ? <MainMenu /> : <AuthCard />}
        <footer className="mt-8">
          <ConnectionBadge status={connection} />
        </footer>
      </main>
    </NightSky>
  );
}
