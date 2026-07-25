import { z } from 'zod';

/**
 * 엽전 경제·상점·등급 (PLAN.md §6).
 *
 * 원칙: 엽전은 무료 재화 — 현금 결제·유저 간 거래·베팅 없음.
 * 살 수 있는 것은 전부 코스메틱이며 승패·판정·매칭에 영향을 주지 않는다.
 */

/** 상점 슬롯 (장착 카테고리) */
export const SHOP_SLOTS = ['tileBack', 'table', 'winEffect', 'emote'] as const;
export type ShopSlot = (typeof SHOP_SLOTS)[number];

export interface ShopItem {
  id: string;
  slot: ShopSlot;
  name: string;
  description: string;
  /** 0이면 기본 지급(무료) */
  price: number;
}

/** 지갑·보유·장착 상태 */
export interface WalletView {
  balance: number;
  /** 보유(해금)한 아이템 id */
  unlocked: string[];
  /** 슬롯별 장착 아이템 id */
  loadout: Record<ShopSlot, string>;
}

/** 원장 한 줄 (획득/소비 내역) */
export interface LedgerEntryView {
  delta: number;
  reason: string;
  createdAt: number;
}

/** 대국 종료 후 지급 내역 (로비에서 플로팅 표시) */
export interface RewardLineView {
  reason: string;
  label: string;
  amount: number;
}

export interface RewardsView {
  gameId: string;
  lines: RewardLineView[];
  total: number;
  balance: number;
}

// ── 등급 (§7 Phase 5: 유생→진사→급제→장원) ──────────────────────

export const RANK_TIERS = ['유생', '진사', '급제', '장원'] as const;
export type RankTier = (typeof RANK_TIERS)[number];

export interface RankView {
  /** 누적 레이팅 점수 */
  points: number;
  tier: RankTier;
  /** 등급 내 단계 (1~3, 장원은 1) */
  level: number;
  /** 다음 승단까지 필요한 점수 (최고 등급이면 null) */
  toNext: number | null;
  games: number;
}

// ── 클라 → 서버 요청 스키마 ────────────────────────────────────

export const ShopBuySchema = z.object({ itemId: z.string().min(1).max(64) });
export const ShopEquipSchema = z.object({
  slot: z.enum(SHOP_SLOTS),
  itemId: z.string().min(1).max(64),
});
export type ShopBuy = z.infer<typeof ShopBuySchema>;
export type ShopEquip = z.infer<typeof ShopEquipSchema>;

/** 대국 좌석에 표시할 상대 프로필 (등급·장착 코스메틱) */
export interface SeatProfileView {
  seat: number;
  tier: RankTier | null;
  level: number;
  /** 상대 패 뒷면 — 각자 장착한 것이 보인다 */
  tileBack: string;
  /** 화료 연출 — 그 좌석이 화료했을 때 모두에게 보인다 */
  winEffect: string;
}
