import { z } from 'zod';

/**
 * 클라 → 서버 이벤트 페이로드 검증 스키마 (PLAN.md §3.3).
 * 신뢰할 수 없는 입력이므로 전부 zod로 검증한다. 판정은 서버 엔진이 재검증한다.
 */

const tileId = z.number().int().min(0).max(135);
const tileKind = z.number().int().min(0).max(33);

export const AuthHelloSchema = z
  .object({
    nickname: z.string().trim().min(1).max(12).optional(),
    token: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  })
  .refine((v) => v.nickname !== undefined || v.token !== undefined, {
    message: '닉네임 또는 토큰이 필요합니다',
  });
export type AuthHello = z.infer<typeof AuthHelloSchema>;

export const RoomCodeSchema = z.object({
  code: z.string().regex(/^[A-Z0-9]{6}$/),
});
export type RoomCode = z.infer<typeof RoomCodeSchema>;

export const RoomReadySchema = z.object({ ready: z.boolean() });

/** 게임 액션 (엔진 RoundAction과 1:1 — 서버가 합법성 재검증) */
export const GameActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('discard'), tileId, riichi: z.boolean().optional() }),
  z.object({ type: z.literal('tsumo') }),
  z.object({ type: z.literal('ron') }),
  z.object({ type: z.literal('pon') }),
  z.object({ type: z.literal('daiminkan') }),
  z.object({ type: z.literal('chi'), tiles: z.tuple([tileId, tileId]) }),
  z.object({ type: z.literal('ankan'), kind: tileKind }),
  z.object({ type: z.literal('shouminkan'), tileId }),
  z.object({ type: z.literal('kyuushu') }),
  z.object({ type: z.literal('pass') }),
]);
export type GameActionPayload = z.infer<typeof GameActionSchema>;

/** 자동 편의 토글 (§3.4 — 클라 설정, 서버 반영) */
export const AutoSettingsSchema = z.object({
  autoWin: z.boolean(),
  autoSkipCalls: z.boolean(),
  autoTsumogiri: z.boolean(),
});
export type AutoSettings = z.infer<typeof AutoSettingsSchema>;

export const FillAcceptSchema = z.object({ accept: z.boolean() });

/** 클라 → 서버 이벤트 이름 (§3.3 표 + 확장분은 ASSUMPTIONS 기록) */
export const CLIENT_EVENTS = [
  'auth.hello',
  'lobby.quickMatch',
  'lobby.cancel',
  'lobby.practice',
  'lobby.fillAccept',
  'room.create',
  'room.join',
  'room.leave',
  'room.ready',
  'room.addBot',
  'room.setRules',
  'room.start',
  'game.action',
  'sync.request',
  'settings.auto',
  'shop.buy',
  'shop.equip',
  'wallet.request',
  'emote.send',
] as const;
export type ClientEventName = (typeof CLIENT_EVENTS)[number];
