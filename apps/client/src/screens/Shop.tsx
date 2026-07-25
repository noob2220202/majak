import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { ShopItem, ShopSlot } from '@cheongiwa/protocol';
import { Button } from '../components/ui';
import { ArtBack, ArtCorners, ArtTab, ArtTitle } from '../components/art';
import { DancheongBorder } from '../motifs/Motifs';
import { getSocket } from '../net/socket';
import { useGame } from '../store/game';
import { Tile } from '../tiles/Tile';
import { tableStyle } from '../cosmetics/tileBacks';

/**
 * 저잣거리 (PLAN.md §6.3) — 한지 좌판 컨셉.
 * 파는 것은 전부 코스메틱이며 구매 전 미리보기가 필수다.
 */

const SLOT_LABEL: Record<ShopSlot, string> = {
  tileBack: '패 뒷면',
  table: '마작상',
  winEffect: '화료 연출',
  emote: '이모티콘',
};

const SLOT_ORDER: ShopSlot[] = ['tileBack', 'table', 'winEffect', 'emote'];

/** 상품 미리보기 — 슬롯별로 실제 렌더 결과를 보여준다 */
function Preview({ item }: { item: ShopItem }) {
  if (item.slot === 'tileBack') {
    return (
      <div className="flex items-end justify-center gap-1 py-1">
        {[0, 1, 2].map((i) => (
          <Tile key={i} faceDown width={i === 1 ? 38 : 30} backId={item.id} />
        ))}
      </div>
    );
  }
  if (item.slot === 'table') {
    const style = tableStyle(item.id);
    return (
      <div className="grid place-items-center py-1">
        <div className="rounded-lg p-1.5" style={{ background: style.rim }}>
          <div className="size-16 rounded-md" style={{ background: style.felt }} />
        </div>
      </div>
    );
  }
  if (item.slot === 'winEffect') {
    const grads: Record<string, string> = {
      'winEffect.basic': 'linear-gradient(150deg,#23283c,#12151f)',
      'winEffect.maehwa': 'linear-gradient(150deg,#3a2f18,#16120a)',
      'winEffect.cheongryong': 'linear-gradient(150deg,#1c3350,#0d1a2b)',
    };
    return (
      <div className="grid place-items-center py-1">
        <div
          className="grid h-16 w-24 place-items-center rounded-md ring-1 ring-gold/25"
          style={{ background: grads[item.id] ?? grads['winEffect.basic'] }}
        >
          <span className="text-xs text-gold-hi" style={{ fontFamily: 'var(--font-serif-kr)' }}>
            화료
          </span>
        </div>
      </div>
    );
  }
  // 이모티콘: 탈 실루엣 미리보기
  const isGaksi = item.id.endsWith('gaksi');
  return (
    <div className="grid place-items-center py-1">
      <svg viewBox="0 0 100 100" width={62} height={62} aria-hidden="true">
        <ellipse cx={50} cy={54} rx={32} ry={38} fill={isGaksi ? '#f0dcc8' : '#d8a06a'} />
        <path
          d={isGaksi ? 'M32 46 q8 -7 16 0' : 'M30 44 q10 -9 20 0'}
          fill="none"
          stroke="#2a2320"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <path
          d={isGaksi ? 'M56 46 q8 -7 16 0' : 'M54 44 q10 -9 20 0'}
          fill="none"
          stroke="#2a2320"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <path d="M36 70 q14 12 28 0" fill="none" stroke="#8d3b2f" strokeWidth={4} strokeLinecap="round" />
        {isGaksi && <circle cx={50} cy={22} r={7} fill="#c03b2e" />}
      </svg>
    </div>
  );
}

function ItemCard({ item }: { item: ShopItem }) {
  const wallet = useGame((s) => s.wallet);
  const owned = item.price === 0 || (wallet?.unlocked.includes(item.id) ?? false);
  const equipped = wallet?.loadout[item.slot] === item.id;
  const affordable = (wallet?.balance ?? 0) >= item.price;

  return (
    <div
      className={`tex-hanji relative rounded-xl p-3 ring-1 transition ${
        equipped ? 'bg-gold/15 ring-gold/50' : 'bg-hanji/8 ring-hanji/12'
      }`}
    >
      {/* 장착 중이면 목패를 걸어둔다 */}
      {equipped && (
        <img
          src="/art/tag-inuse.webp"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -right-2 -top-4 z-10 w-7 drop-shadow-[0_3px_6px_rgba(0,0,0,0.6)]"
        />
      )}
      <Preview item={item} />
      <div className="mt-2">
        <p className="flex items-center justify-between font-semibold text-hanji">
          {item.name}
          {equipped && <span className="text-[10px] text-gold-hi">장착 중</span>}
        </p>
        <p className="mt-0.5 h-8 text-[11px] leading-snug text-hanji/50">{item.description}</p>
      </div>

      {equipped ? (
        <div className="mt-1 grid h-9 place-items-center rounded-md bg-gold/20 text-sm text-gold-hi">
          사용 중
        </div>
      ) : owned ? (
        <Button
          variant="ghost"
          className="mt-1 h-9 w-full py-0 text-sm"
          onClick={() => getSocket().emit('shop.equip', { slot: item.slot, itemId: item.id })}
        >
          장착
        </Button>
      ) : (
        <Button
          variant={affordable ? 'primary' : 'subtle'}
          disabled={!affordable}
          className="mt-1 flex h-9 w-full items-center justify-center gap-1.5 py-0 text-sm"
          onClick={() => getSocket().emit('shop.buy', { itemId: item.id })}
        >
          <img src="/art/icon-yeopjeon.webp" alt="" aria-hidden="true" className="size-4" />
          {item.price.toLocaleString()}냥
        </Button>
      )}
    </div>
  );
}

export function Shop() {
  const setShopOpen = useGame((s) => s.setShopOpen);
  const wallet = useGame((s) => s.wallet);
  const [catalog, setCatalog] = useState<ShopItem[]>([]);
  const [slot, setSlot] = useState<ShopSlot>('tileBack');

  useEffect(() => {
    let alive = true;
    void fetch('/api/shop/catalog')
      .then((r) => r.json() as Promise<ShopItem[]>)
      .then((items) => {
        if (alive) setCatalog(items);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const items = catalog.filter((i) => i.slot === slot);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-40 grid place-items-center bg-ink/85 p-4"
      onClick={() => setShopOpen(false)}
    >
      <motion.div
        initial={{ scale: 0.95, y: 12, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.97, opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-giwa ring-1 ring-gold/25"
      >
        <div className="absolute inset-x-0 top-0">
          <DancheongBorder height={5} />
        </div>

        <ArtCorners size={38} />

        <div className="flex items-start justify-between px-5 pb-2 pt-6">
          <div>
            <ArtTitle className="w-[clamp(150px,20vw,220px)]">저잣거리</ArtTitle>
            <p className="mt-1 text-xs text-hanji/45">
              파는 것은 전부 치레거리입니다 — 승패에는 영향이 없습니다
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full bg-ink/50 py-1.5 pl-2 pr-3 text-sm font-bold text-gold-hi ring-1 ring-gold/25">
              <img src="/art/icon-yeopjeon.webp" alt="" aria-hidden="true" className="size-6" />
              {(wallet?.balance ?? 0).toLocaleString()}냥
            </span>
            <ArtBack label="닫기" onClick={() => setShopOpen(false)} />
          </div>
        </div>

        <div className="flex items-end gap-0.5 border-b border-hanji/10 px-5">
          {SLOT_ORDER.map((s) => (
            <ArtTab key={s} active={slot === s} onClick={() => setSlot(s)}>
              {SLOT_LABEL[s]}
            </ArtTab>
          ))}
        </div>

        <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-5 sm:grid-cols-4">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
          {items.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-hanji/40">
              좌판을 불러오는 중…
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
