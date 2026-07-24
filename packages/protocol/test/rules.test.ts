import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, RuleSettingsSchema } from '../src';

describe('RuleSettingsSchema', () => {
  it('빈 입력이면 PLAN.md §2 기본값 전체가 채워진다', () => {
    expect(DEFAULT_RULES).toEqual({
      gameLength: 'hanchan',
      redFives: true,
      uraDora: true,
      uma: [15, 5, -5, -15],
      tripleRonDraw: true,
      kanDoraReveal: 'afterDiscard',
      chankan: true,
      kuitan: true,
      renpuuJantouFu: 4,
      pao: true,
      doubleYakuman: true,
      multipleYakuman: true,
      kazoeYakuman: true,
      kiriageMangan: false,
      nagashiMangan: true,
      westEntry: true,
      tobi: true,
      agariYame: true,
    });
  });

  it('부분 설정은 기본값 위에 덮어쓴다', () => {
    const rules = RuleSettingsSchema.parse({ gameLength: 'tonpuu', kuitan: false });
    expect(rules.gameLength).toBe('tonpuu');
    expect(rules.kuitan).toBe(false);
    expect(rules.redFives).toBe(true);
  });

  it('우마 합이 0이 아니면 거부한다', () => {
    const result = RuleSettingsSchema.safeParse({ uma: [15, 5, -5, -10] });
    expect(result.success).toBe(false);
  });

  it('연풍패 머리 부수는 4 또는 2만 허용한다', () => {
    expect(RuleSettingsSchema.safeParse({ renpuuJantouFu: 2 }).success).toBe(true);
    expect(RuleSettingsSchema.safeParse({ renpuuJantouFu: 3 }).success).toBe(false);
  });

  it('스키마 기본값은 엔진 DEFAULT_RULES와 항상 일치한다 (단일 정본)', () => {
    expect(RuleSettingsSchema.parse({})).toEqual(DEFAULT_RULES);
  });
});
