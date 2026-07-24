/** 역 일람 참조 데이터 (§5.3 역 일람 패널). PLAN §2.7 기준. */
export interface YakuRef {
  name: string;
  han: string;
  note?: string;
}

export const YAKU_LIST: YakuRef[] = [
  { name: '리치', han: '1판', note: '멘젠 텐파이 · 1,000점 공탁' },
  { name: '일발', han: '1판', note: '리치 후 한 바퀴 내 화료' },
  { name: '멘젠쯔모', han: '1판', note: '멘젠 자력 쯔모' },
  { name: '핑후', han: '1판', note: '전부 슌쯔 · 비역패 머리 · 량면' },
  { name: '탕야오', han: '1판(울면 1)', note: '2~8만 사용' },
  { name: '이페코', han: '1판', note: '같은 슌쯔 2벌 (멘젠)' },
  { name: '역패', han: '1판', note: '장풍·자풍·백·발·중 커쯔' },
  { name: '창깡 / 영상개화 / 해저 / 하저', han: '1판' },
  { name: '더블리치', han: '2판', note: '첫 타패에 리치' },
  { name: '치토이츠', han: '2판', note: '7쌍 · 25부 고정' },
  { name: '혼로두 / 토이토이 / 산안커 / 산깡즈', han: '2판' },
  { name: '산색동각 / 쇼산겐', han: '2판' },
  { name: '산색동순 / 일기통관 / 찬타', han: '2판(울면 1)' },
  { name: '혼일색', han: '3판(울면 2)' },
  { name: '준찬타', han: '3판(울면 2)' },
  { name: '량페코', han: '3판', note: '이페코 2벌 (멘젠)' },
  { name: '청일색', han: '6판(울면 5)' },
  { name: '국사무쌍 / 스안커 / 대삼원', han: '역만' },
  { name: '소사희 / 자일색 / 청노두 / 녹일색', han: '역만' },
  { name: '스깡즈 / 구련보등 / 천화 / 지화', han: '역만' },
  { name: '국사13면 / 스안커단기 / 순정구련 / 대사희', han: '더블역만' },
];
