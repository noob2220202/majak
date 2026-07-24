import { z } from 'zod';
import type { RuleSettings } from '@cheongiwa/engine';
import { DEFAULT_RULES } from '@cheongiwa/engine';

/**
 * 친선방 룰 토글 입력 검증 스키마 (PLAN.md §2).
 * 정본 타입·기본값은 엔진(`RuleSettings`, `DEFAULT_RULES`)이 소유하고,
 * 이 스키마는 외부 입력(방 설정)을 그 타입으로 검증·보정하는 역할만 한다.
 */
export const RuleSettingsSchema = z.object({
  gameLength: z.enum(['hanchan', 'tonpuu']).default(DEFAULT_RULES.gameLength),
  redFives: z.boolean().default(DEFAULT_RULES.redFives),
  uraDora: z.boolean().default(DEFAULT_RULES.uraDora),
  uma: z
    .tuple([z.number().int(), z.number().int(), z.number().int(), z.number().int()])
    .refine((u) => u[0] + u[1] + u[2] + u[3] === 0, { message: '우마 합은 0이어야 합니다' })
    .default([...DEFAULT_RULES.uma]),
  tripleRonDraw: z.boolean().default(DEFAULT_RULES.tripleRonDraw),
  kanDoraReveal: z.enum(['afterDiscard', 'immediate']).default(DEFAULT_RULES.kanDoraReveal),
  chankan: z.boolean().default(DEFAULT_RULES.chankan),
  kuitan: z.boolean().default(DEFAULT_RULES.kuitan),
  renpuuJantouFu: z.union([z.literal(4), z.literal(2)]).default(DEFAULT_RULES.renpuuJantouFu),
  pao: z.boolean().default(DEFAULT_RULES.pao),
  doubleYakuman: z.boolean().default(DEFAULT_RULES.doubleYakuman),
  multipleYakuman: z.boolean().default(DEFAULT_RULES.multipleYakuman),
  kazoeYakuman: z.boolean().default(DEFAULT_RULES.kazoeYakuman),
  kiriageMangan: z.boolean().default(DEFAULT_RULES.kiriageMangan),
  nagashiMangan: z.boolean().default(DEFAULT_RULES.nagashiMangan),
  westEntry: z.boolean().default(DEFAULT_RULES.westEntry),
  tobi: z.boolean().default(DEFAULT_RULES.tobi),
  agariYame: z.boolean().default(DEFAULT_RULES.agariYame),
});

// 스키마 출력 타입이 엔진 RuleSettings와 정확히 일치하는지 컴파일 타임 검증
type SchemaOutput = z.infer<typeof RuleSettingsSchema>;
type AssertMutuallyAssignable<A extends B, B extends C, C = A> = never;
export type _RuleSchemaMatchesEngine = AssertMutuallyAssignable<SchemaOutput, RuleSettings>;

export type { RuleSettings };
export { DEFAULT_RULES };

/** 부분 입력 → 완전한 룰 설정 (기본값 채움 + 검증) */
export function resolveRules(input: unknown): RuleSettings {
  return RuleSettingsSchema.parse(input ?? {});
}
