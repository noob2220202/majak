import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ShopItem } from '@cheongiwa/protocol';
import { useGame } from '../../store/game';

/**
 * 이모티콘 팔레트 (§7 Phase 5 이모티콘 소통).
 *
 * 저잣거리에서 산 탈을 대국 중에 띄운다. 도배는 서버가 좌석당 쿨다운으로 막고,
 * 받는 쪽은 음소거로 아예 안 볼 수 있다.
 */
export function EmoteBar() {
  const wallet = useGame((s) => s.wallet);
  const sendEmote = useGame((s) => s.sendEmote);
  const muted = useGame((s) => s.emotesMuted);
  const setMuted = useGame((s) => s.setEmotesMuted);
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<ShopItem[]>([]);
  /** 서버 쿨다운(3초)과 맞춘 로컬 잠금 — 눌러도 안 나가는 걸 눈으로 알려준다 */
  const [cooldown, setCooldown] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetch('/api/shop/catalog')
      .then((r) => r.json() as Promise<ShopItem[]>)
      .then((items) => {
        if (alive) setCatalog(items.filter((i) => i.slot === 'emote'));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const mine = catalog.filter((i) => i.price === 0 || (wallet?.unlocked.includes(i.id) ?? false));
  if (mine.length === 0) return null;

  const send = (itemId: string): void => {
    if (cooldown) return;
    sendEmote(itemId);
    setCooldown(true);
    setTimeout(() => setCooldown(false), 3000);
    setOpen(false);
  };

  return (
    <div className="relative">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute bottom-full right-0 mb-2 flex gap-1 rounded-xl bg-ink/90 p-2 ring-1 ring-gold/30"
          >
            {mine.map((item) => (
              <button
                key={item.id}
                onClick={() => send(item.id)}
                disabled={cooldown}
                title={item.name}
                aria-label={item.name}
                className="grid size-11 place-items-center rounded-lg bg-hanji/10 transition hover:bg-hanji/20 disabled:opacity-40"
              >
                <img
                  src={`/art/${item.id.replace('.', '-')}.webp`}
                  alt=""
                  aria-hidden="true"
                  className="size-9 object-contain"
                  onError={(e) => {
                    // 원화가 아직 없는 탈은 이름 첫 글자로 대체한다
                    const el = e.currentTarget;
                    el.style.display = 'none';
                    el.parentElement?.insertAdjacentText('beforeend', item.name.slice(0, 1));
                  }}
                />
              </button>
            ))}
            <button
              onClick={() => setMuted(!muted)}
              className={`grid size-11 place-items-center rounded-lg text-[10px] font-semibold leading-tight transition ${
                muted ? 'bg-dan-red/30 text-hanji' : 'bg-hanji/10 text-hanji/60'
              }`}
              title={muted ? '이모티콘 다시 보기' : '상대 이모티콘 숨기기'}
            >
              {muted ? '숨김\n중' : '숨기기'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="이모티콘"
        title="이모티콘"
        className="grid size-10 place-items-center rounded-lg bg-ink/60 ring-1 ring-gold/25 transition hover:brightness-125"
      >
        <img src="/art/icon-game-emote.webp" alt="" aria-hidden="true" className="size-7" />
      </button>
    </div>
  );
}
