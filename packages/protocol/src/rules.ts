import { z } from 'zod';

/**
 * 친선방에서 조정 가능한 룰 토글 전체 (PLAN.md §2).
 * 기본값 = 표준 4인 반장전. 엔진은 이 설정 객체를 입력으로 받아 동작한다.
 */
export const RuleSettingsSchema = z.object({
  /** 반장전(동1~남4) / 동풍전(동1~동4) — §2.2 */
  gameLength: z.enum(['hanchan', 'tonpuu']).default('hanchan'),

  /** 적도라: 만·통·삭 5 각 1장을 적5로 (도라 1 취급) — §2.1 */
  redFives: z.boolean().default(true),

  /** 우라도라 (깡우라 포함, 리치 화료자만 확인) — §2.1 */
  uraDora: z.boolean().default(true),

  /** 순위 우마 (1~4위 순, 합이 0이어야 함) — §2.2 */
  uma: z
    .tuple([z.number().int(), z.number().int(), z.number().int(), z.number().int()])
    .refine((u) => u[0] + u[1] + u[2] + u[3] === 0, { message: '우마 합은 0이어야 합니다' })
    .default([15, 5, -5, -15]),

  /** 트리플론은 유국 (false면 3인 론도 인정) — §2.2 */
  tripleRonDraw: z.boolean().default(true),

  /** 대명깡·가깡의 신도라 공개 시점 (안깡은 항상 즉시) — §2.3 */
  kanDoraReveal: z.enum(['afterDiscard', 'immediate']).default('afterDiscard'),

  /** 창깡: 가깡에 론 가능 (안깡은 국사무쌍만) — §2.3 */
  chankan: z.boolean().default(true),

  /** 쿠이탕 (울고 탕야오) — §2.3 */
  kuitan: z.boolean().default(true),

  /** 연풍패(장풍=자풍) 머리 부수 — §2.8 */
  renpuuJantouFu: z.union([z.literal(4), z.literal(2)]).default(4),

  /** 파오: 대삼원·대사희 확정 면자를 울려준 자의 책임지불 — §2.6 */
  pao: z.boolean().default(true),

  /** 더블역만 인정 (국사13면·스안커단기·순정구련·대사희) — §2.7 */
  doubleYakuman: z.boolean().default(true),

  /** 복합역만 합산 인정 — §2.7 */
  multipleYakuman: z.boolean().default(true),

  /** 카조에 역만 (false면 13판 이상은 삼배만 상한) — §2.7 */
  kazoeYakuman: z.boolean().default(true),

  /** 키리아게 만관 (4판30부·3판60부를 만관 처리) — §2.8 */
  kiriageMangan: z.boolean().default(false),

  /** 나가시만관 — §2.9 */
  nagashiMangan: z.boolean().default(true),

  /** 서입: 남4 종료 시 30,000점 미달이면 서든데스 연장 — §2.10 */
  westEntry: z.boolean().default(true),

  /** 토비: 0점 미만 즉시 종료 (0점은 속행) — §2.10 */
  tobi: z.boolean().default(true),

  /** 아가리야메 — §2.10 */
  agariYame: z.boolean().default(true),
});

export type RuleSettings = z.infer<typeof RuleSettingsSchema>;

/** 표준 반장전 기본 룰 (PLAN.md §2 기본값 전체) */
export const DEFAULT_RULES: RuleSettings = RuleSettingsSchema.parse({});
