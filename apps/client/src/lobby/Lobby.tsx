import { useState } from 'react';
import { motion } from 'framer-motion';
import { useConnectionStore, type ConnectionStatus } from '../store/connection';
import { EavesSilhouette } from './EavesSilhouette';

const MENU_ITEMS = [
  { key: 'quick', label: '빠른 대전' },
  { key: 'room', label: '친선방' },
  { key: 'practice', label: '연습 대국' },
] as const;

const STATUS_DOT: Record<ConnectionStatus, string> = {
  connected: 'bg-dan-green',
  connecting: 'bg-gold animate-pulse',
  disconnected: 'bg-dan-red',
};

function ConnectionBadge() {
  const status = useConnectionStore((s) => s.status);
  const protocolVersion = useConnectionStore((s) => s.serverProtocolVersion);

  const label =
    status === 'connected'
      ? `서버 연결됨${protocolVersion !== null ? ` · 프로토콜 v${protocolVersion}` : ''}`
      : status === 'connecting'
        ? '서버 연결 중'
        : '서버 연결 끊김';

  return (
    <p className="flex items-center justify-center gap-2 text-sm text-hanji/60">
      <span aria-hidden="true" className={`size-2 rounded-full ${STATUS_DOT[status]}`} />
      {label}
    </p>
  );
}

/** 플레이스홀더 로비 (Phase 0) — 실제 매칭·방 기능은 Phase 3에서 연결된다. */
export function Lobby() {
  const [nickname, setNickname] = useState('');

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-giwa to-night">
      <header className="relative">
        <EavesSilhouette />
        <h1
          className="pointer-events-none absolute inset-x-0 top-3 text-center text-lg font-bold tracking-[0.5em] text-hanji/80"
          style={{ fontFamily: 'var(--font-serif-kr)' }}
        >
          청기와
        </h1>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
          className="w-full max-w-sm rounded-xl bg-hanji p-8 text-ink shadow-2xl"
        >
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
            placeholder="대국에서 쓸 이름"
            className="mt-1.5 w-full rounded-md border border-giwa/25 bg-white/70 px-3 py-2 text-ink outline-none transition focus:border-dan-blue focus:ring-2 focus:ring-dan-blue/30"
          />

          <div className="mt-6 flex flex-col gap-2.5">
            {MENU_ITEMS.map((item, index) => (
              <button
                key={item.key}
                type="button"
                disabled
                title="Phase 3에서 활성화됩니다"
                className={
                  index === 0
                    ? 'w-full cursor-not-allowed rounded-md bg-giwa py-2.5 font-semibold text-hanji opacity-50'
                    : 'w-full cursor-not-allowed rounded-md border border-giwa/40 py-2.5 font-semibold text-giwa opacity-50'
                }
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-ink/45">
            대국 기능은 Phase 3에서 열립니다 — 지금은 스캐폴드 빌드입니다
          </p>
        </motion.section>
      </main>

      <footer className="pb-6">
        <ConnectionBadge />
      </footer>
    </div>
  );
}
