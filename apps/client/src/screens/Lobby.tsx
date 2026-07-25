import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, ConnectionBadge, Panel } from '../components/ui';
import { send } from '../net/socket';
import { useGame } from '../store/game';
import { unlockAudio } from '../audio/sfx';
import { Scene } from './Scene';
import { Plaque } from '../components/Plaque';
import { ArtIconButton } from '../components/art';
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

/** 로비에 세울 수 있는 캐릭터. 클릭하면 다음 사람으로 넘어간다 (표시 전용) */
const CAST = [
  { id: 'dan', name: '단' },
  { id: 'mae', name: '매' },
  { id: 'seol', name: '설' },
  { id: 'ru', name: '루' },
] as const;

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
      <span className="flex items-center gap-1.5 rounded-lg bg-ink/60 py-1.5 pl-2 pr-3 text-sm font-bold tabular-nums text-gold-hi ring-1 ring-gold/25">
        <img src="/art/icon-yeopjeon.webp" alt="" aria-hidden="true" className="size-6" />
        {(wallet?.balance ?? 0).toLocaleString()}
      </span>
      <ArtIconButton
        icon="icon-nav-shop"
        label="저잣거리"
        size={38}
        onClick={() => setShopOpen(true)}
      />
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
          initial={{ opacity: 0, x: -16, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -18 }}
          transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          // 세로 화면에서는 띄울 빈자리가 없다 — 현판을 가리지 않게 흐름 안에 끼워 넣고,
          // 넓은 화면에서만 좌상단에 띄운다
          className="tex-hanji pointer-events-auto relative z-20 mb-3 w-full max-w-md cursor-pointer rounded-xl bg-giwa/95 p-3 ring-1 ring-gold/35 md:absolute md:left-5 md:top-14 md:mb-0 md:w-56"
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
      className="w-full max-w-md md:w-[min(34vw,min(46vh,460px))] md:max-w-none"
    >
      <div className="mb-2 flex items-center justify-between rounded-lg bg-ink/55 px-4 py-2 ring-1 ring-gold/25">
        <span className="flex items-center gap-2 font-semibold text-hanji">
          <span className="relative block size-9 shrink-0">
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
        <div className="flex flex-col">
          <Plaque id={1} index={0} label="빠른 대전" onClick={() => send.quickMatch()} />
          <div className="-mt-[3.5%]">
            <Plaque id={2} index={1} label="친선방" sub="방을 만들어 벗을 부릅니다" onClick={() => send.roomCreate()} />
          </div>
          <div className="-mt-[3.5%]">
            <Plaque id={3} index={2} label="코드 참가" sub="여섯 자리 코드로 들어갑니다" onClick={() => setJoining(true)} />
          </div>
          <div className="-mt-[3.5%]">
            <Plaque id={4} index={3} label="연습 대국" sub="봇 3인과 둡니다" onClick={() => send.practice()} />
          </div>
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
      {userId && <WalletBar />}

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

      {/* pt-16: 세로 화면에서 본문이 제목·잔액바 밑에서 시작하도록 자리를 비운다 */}
      <main className="pointer-events-none relative z-10 flex min-h-dvh flex-col items-center justify-center px-4 pb-8 pt-16 md:items-end md:py-8 md:pr-[6vw]">
        {userId && <RewardFloat />}
        <div className="pointer-events-auto w-full md:w-auto">{userId ? <MainMenu /> : <AuthCard />}</div>
        <footer className="pointer-events-auto mt-6">
          <ConnectionBadge status={connection} />
        </footer>
      </main>
    </Scene>
  );
}
