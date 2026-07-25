import type { ShopItem, ShopSlot, WalletView } from '@cheongiwa/protocol';
import type { AppDatabase } from './db';

/**
 * 저잣거리 상점 (PLAN.md §6.3).
 * 판매 상품은 전부 코스메틱 — 승패·판정·매칭에 영향을 주지 않는다 (§6.1-2).
 */

export const CATALOG: ShopItem[] = [
  // 패 뒷면 (§4.4 수막새가 기본)
  { id: 'tileBack.sumaksae', slot: 'tileBack', name: '수막새', description: '쪽빛 바탕에 금박 수막새 — 기본', price: 0 },
  { id: 'tileBack.yeonhwa', slot: 'tileBack', name: '연화문', description: '연꽃이 겹으로 피어난 문양', price: 800 },
  { id: 'tileBack.dokkaebi', slot: 'tileBack', name: '도깨비문', description: '귀면와의 부릅뜬 눈', price: 1200 },
  { id: 'tileBack.taegeuk', slot: 'tileBack', name: '태극', description: '삼태극이 도는 문양', price: 1500 },

  // 테이블
  { id: 'table.noirok', slot: 'table', name: '뇌록', description: '깊은 녹색 펠트 — 기본', price: 0 },
  { id: 'table.jjokbit', slot: 'table', name: '쪽빛', description: '쪽으로 물들인 남색 상', price: 1000 },
  { id: 'table.meok', slot: 'table', name: '먹색', description: '먹을 갈아놓은 듯한 흑청색', price: 1400 },
  { id: 'table.jadan', slot: 'table', name: '자단', description: '붉은 자단목 결이 도는 상', price: 2000 },

  // 화료 연출
  { id: 'winEffect.basic', slot: 'winEffect', name: '기본', description: '단정한 병풍 연출 — 기본', price: 0 },
  { id: 'winEffect.maehwa', slot: 'winEffect', name: '금박 매화', description: '금박 매화가 흩날린다', price: 2000 },
  { id: 'winEffect.cheongryong', slot: 'winEffect', name: '청룡 붓선', description: '푸른 붓선이 화면을 가른다', price: 3000 },

  // 이모티콘 팩 (탈 모티프)
  { id: 'emote.none', slot: 'emote', name: '없음', description: '이모티콘을 쓰지 않음 — 기본', price: 0 },
  { id: 'emote.hahoe', slot: 'emote', name: '하회탈 8종', description: '너털웃음 짓는 하회탈', price: 1200 },
  { id: 'emote.gaksi', slot: 'emote', name: '각시탈 8종', description: '단아한 각시탈', price: 1200 },
];

const BY_ID = new Map(CATALOG.map((i) => [i.id, i]));

/** 슬롯별 기본(무료) 아이템 */
export const DEFAULT_LOADOUT: Record<ShopSlot, string> = {
  tileBack: 'tileBack.sumaksae',
  table: 'table.noirok',
  winEffect: 'winEffect.basic',
  emote: 'emote.none',
};

export function findItem(itemId: string): ShopItem | undefined {
  return BY_ID.get(itemId);
}

export function balanceOf(db: AppDatabase, userId: string): number {
  const row = db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(userId) as
    | { balance: number }
    | undefined;
  return row?.balance ?? 0;
}

export function walletView(db: AppDatabase, userId: string): WalletView {
  const unlockedRows = db
    .prepare('SELECT item_id FROM unlocks WHERE user_id = ?')
    .all(userId) as Array<{ item_id: string }>;
  const loadoutRows = db
    .prepare('SELECT slot, item_id FROM loadouts WHERE user_id = ?')
    .all(userId) as Array<{ slot: string; item_id: string }>;

  const loadout = { ...DEFAULT_LOADOUT };
  for (const row of loadoutRows) {
    if (row.slot in loadout) loadout[row.slot as ShopSlot] = row.item_id;
  }
  // 기본 아이템은 항상 보유로 취급
  const unlocked = new Set(unlockedRows.map((r) => r.item_id));
  for (const item of CATALOG) if (item.price === 0) unlocked.add(item.id);

  return { balance: balanceOf(db, userId), unlocked: [...unlocked], loadout };
}

export type BuyResult =
  | { ok: true; wallet: WalletView }
  | { ok: false; message: string };

/** 구매: 잔액 검증 → 차감 → 원장 기록 → 해금 (단일 트랜잭션) */
export function buyItem(db: AppDatabase, userId: string, itemId: string): BuyResult {
  const item = findItem(itemId);
  if (!item) return { ok: false, message: '없는 상품입니다' };
  if (item.price === 0) return { ok: false, message: '기본 제공 상품입니다' };

  const already = db
    .prepare('SELECT 1 FROM unlocks WHERE user_id = ? AND item_id = ?')
    .get(userId, itemId);
  if (already) return { ok: false, message: '이미 보유한 상품입니다' };

  const balance = balanceOf(db, userId);
  if (balance < item.price) return { ok: false, message: '엽전이 부족합니다' };

  const tx = db.transaction(() => {
    db.prepare('UPDATE wallets SET balance = balance - ? WHERE user_id = ?').run(item.price, userId);
    db.prepare(
      'INSERT INTO ledger (user_id, delta, reason, game_id, created_at) VALUES (?, ?, ?, NULL, ?)',
    ).run(userId, -item.price, `buy:${itemId}`, Date.now());
    db.prepare('INSERT OR IGNORE INTO unlocks (user_id, item_id) VALUES (?, ?)').run(userId, itemId);
  });
  tx();

  return { ok: true, wallet: walletView(db, userId) };
}

export type EquipResult =
  | { ok: true; wallet: WalletView }
  | { ok: false; message: string };

/** 장착: 보유 확인 후 슬롯 갱신 */
export function equipItem(
  db: AppDatabase,
  userId: string,
  slot: ShopSlot,
  itemId: string,
): EquipResult {
  const item = findItem(itemId);
  if (!item || item.slot !== slot) return { ok: false, message: '장착할 수 없는 상품입니다' };
  if (item.price > 0) {
    const owned = db
      .prepare('SELECT 1 FROM unlocks WHERE user_id = ? AND item_id = ?')
      .get(userId, itemId);
    if (!owned) return { ok: false, message: '보유하지 않은 상품입니다' };
  }
  db.prepare(
    `INSERT INTO loadouts (user_id, slot, item_id) VALUES (?, ?, ?)
     ON CONFLICT(user_id, slot) DO UPDATE SET item_id = excluded.item_id`,
  ).run(userId, slot, itemId);
  return { ok: true, wallet: walletView(db, userId) };
}

/** 대국 화면에서 상대 패 뒷면을 보여주기 위한 조회 */
export function loadoutOf(db: AppDatabase, userId: string): Record<ShopSlot, string> {
  return walletView(db, userId).loadout;
}
