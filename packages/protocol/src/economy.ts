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
  /** 누적 등급 점수 (오르기만 한다 — 이건 성취 표시다) */
  points: number;
  tier: RankTier;
  /**
   * 등급 안 급수. 9급에서 시작해 1급으로 **내려간다** (바둑·태권도와 같은 방향).
   * 장원은 급 대신 단을 쓰므로 null.
   */
  grade: number | null;
  /** 장원의 단. 1단에서 시작해 **올라간다**. 그 외 등급은 null */
  dan: number | null;
  /** 화면에 그대로 쓰는 표기 — "진사 4급", "장원 2단" */
  label: string;
  /** 다음 단계(급·단·승단)까지 필요한 점수. 최고 단계면 null */
  toNext: number | null;
  games: number;
  /**
   * 실력 점수 (§3.2 레이팅 매칭). 등급 점수와 달리 **내려가기도 한다** —
   * 비슷한 실력끼리 붙이는 데 쓰는 값이라 실제 실력을 따라가야 한다.
   */
  rating: number;
  /** 배치 대국 남은 수. 이 동안은 실력 점수가 크게 움직인다 (0이면 배치 완료) */
  placementLeft: number;
}

// ── 클라 → 서버 요청 스키마 ────────────────────────────────────

export const ShopBuySchema = z.object({ itemId: z.string().min(1).max(64) });
/** 대국 중 이모티콘 전송 — 보유 여부는 서버가 검증한다 */
export const EmoteSendSchema = z.object({ itemId: z.string().min(1).max(64) });
export const ShopEquipSchema = z.object({
  slot: z.enum(SHOP_SLOTS),
  itemId: z.string().min(1).max(64),
});
export type ShopBuy = z.infer<typeof ShopBuySchema>;
export type EmoteSend = z.infer<typeof EmoteSendSchema>;
export type ShopEquip = z.infer<typeof ShopEquipSchema>;

/** 누가 어떤 이모티콘을 띄웠는지 (전원에게 브로드캐스트) */
export interface EmoteShowView {
  seat: number;
  itemId: string;
  /** 같은 좌석이 연속으로 보내도 각각 표시되도록 구분 */
  nonce: number;
}

/** 대국 좌석에 표시할 상대 프로필 (등급·장착 코스메틱) */
export interface SeatProfileView {
  seat: number;
  tier: RankTier | null;
  /** "진사 4급" 처럼 좌석 이름표에 붙는 표기 (전적이 없으면 null) */
  rankLabel: string | null;
  /** 상대 패 뒷면 — 각자 장착한 것이 보인다 */
  tileBack: string;
  /** 화료 연출 — 그 좌석이 화료했을 때 모두에게 보인다 */
  winEffect: string;
}
