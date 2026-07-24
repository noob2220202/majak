/** 반장전(동1~남4) / 동풍전(동1~동4) */
export type GameLength = 'hanchan' | 'tonpuu';
/** 대명깡·가깡의 신도라 공개 시점 (안깡은 항상 즉시) */
export type KanDoraReveal = 'afterDiscard' | 'immediate';

/**
 * 룰 토글 전체 (PLAN.md §2). 엔진의 모든 판정은 이 설정 객체를 입력으로 받는다.
 * 외부 입력 검증(zod)은 `@cheongiwa/protocol`이 담당하고, 여기서는 순수 타입과
 * 기본값만 정의한다 (엔진 의존성 0 유지).
 */
export interface RuleSettings {
  gameLength: GameLength;
  /** 적도라 (만·통·삭 5 각 1장) — §2.1 */
  redFives: boolean;
  /** 우라도라 + 깡우라 — §2.1 */
  uraDora: boolean;
  /** 순위 우마 (1~4위 순, 합 0) — §2.2 */
  uma: [number, number, number, number];
  /** 트리플론 유국 (false면 3인 론 인정) — §2.2 */
  tripleRonDraw: boolean;
  /** §2.3 */
  kanDoraReveal: KanDoraReveal;
  /** 창깡: 가깡에 론 (안깡은 국사무쌍만) — §2.3 */
  chankan: boolean;
  /** 쿠이탕 — §2.3 */
  kuitan: boolean;
  /** 연풍패(장풍=자풍) 머리 부수 — §2.8 */
  renpuuJantouFu: 4 | 2;
  /** 파오 (대삼원·대사희 책임지불) — §2.6 */
  pao: boolean;
  /** 더블역만 인정 — §2.7 */
  doubleYakuman: boolean;
  /** 복합역만 합산 — §2.7 */
  multipleYakuman: boolean;
  /** 카조에 역만 (false면 13판+는 삼배만 상한) — §2.7 */
  kazoeYakuman: boolean;
  /** 키리아게 만관 — §2.8 */
  kiriageMangan: boolean;
  /** 나가시만관 — §2.9 */
  nagashiMangan: boolean;
  /** 서입 (남4 종료 시 30,000 미달이면 서든데스) — §2.10 */
  westEntry: boolean;
  /** 토비 (0점 미만 즉시 종료, 0점은 속행) — §2.10 */
  tobi: boolean;
  /** 아가리야메 — §2.10 */
  agariYame: boolean;
}

/** 표준 반장전 기본 룰 (PLAN.md §2 기본값 전체) */
export const DEFAULT_RULES: RuleSettings = Object.freeze({
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
}) as RuleSettings;

/** 시작 점수 — §2.2 (토글 아님) */
export const STARTING_POINTS = 25000;
/** 반환 기준점 (서입·종료 판정) — §2.10 */
export const GOAL_POINTS = 30000;
/** 리치 공탁 — §2.4 */
export const RIICHI_DEPOSIT = 1000;
/** 노텐벌부 총액 — §2.9 */
export const NOTEN_PENALTY_TOTAL = 3000;
