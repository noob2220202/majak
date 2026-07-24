import type { Decomposition, StandardDecomposition } from './decompose';
import { breaksConcealment, isKan, meldKind, type Meld } from './meld';
import type { RuleSettings } from './rules';
import {
  HAKU,
  HATSU,
  HONOR_START,
  isDragon,
  isHonor,
  isTerminal,
  isWind,
  isYaochuu,
  TILE_KIND_COUNT,
  tileKindToNotation,
} from './tiles';
import type { TileKind } from './types';

/** 화료 판정 입력 (라운드 상태기계가 채워서 넘긴다) */
export interface WinInput {
  readonly rules: RuleSettings;
  /** 은닉 부분 counts (화료패 포함, 14 − 3×부로) */
  readonly concealedCounts: readonly number[];
  readonly melds: readonly Meld[];
  readonly winningKind: TileKind;
  readonly winType: 'tsumo' | 'ron';
  /** 자풍 (27..30) */
  readonly seatWind: TileKind;
  /** 장풍 (27..29) */
  readonly roundWind: TileKind;
  readonly riichi?: boolean;
  readonly doubleRiichi?: boolean;
  readonly ippatsu?: boolean;
  /** 영상개화 (쯔모) */
  readonly rinshan?: boolean;
  /** 창깡 (론) */
  readonly chankan?: boolean;
  /** 해저모월 (쯔모) */
  readonly haitei?: boolean;
  /** 하저로어 (론) */
  readonly houtei?: boolean;
  readonly tenhou?: boolean;
  readonly chihou?: boolean;
}

export interface YakuEntry {
  readonly id: string;
  readonly name: string;
  readonly han: number;
}

export interface YakumanEntry {
  readonly id: string;
  readonly name: string;
  /** 1 = 역만, 2 = 더블역만 */
  readonly power: 1 | 2;
}

export interface YakuResult {
  readonly yakuman: readonly YakumanEntry[];
  readonly yaku: readonly YakuEntry[];
}

/** 평가용 그룹 (손 면자 + 부로 통합) */
export interface EvalGroup {
  readonly type: 'run' | 'triplet' | 'kan';
  readonly start: TileKind;
  /** 안커·안깡 여부 (론으로 완성된 커쯔는 밍커 취급) */
  readonly concealed: boolean;
  /** 화료패를 포함한 그룹인가 (손 그룹만 해당) */
  readonly winTile: boolean;
}

export function isMenzen(melds: readonly Meld[]): boolean {
  return melds.every((m) => !breaksConcealment(m));
}

/** 손 면자 + 부로 → 평가 그룹 목록 */
export function buildGroups(decomp: StandardDecomposition, input: WinInput): EvalGroup[] {
  const groups: EvalGroup[] = decomp.sets.map((set, index) => {
    const winTile = decomp.winGroupIndex === index;
    return {
      type: set.type,
      start: set.start,
      // 론으로 완성한 커쯔는 안커로 세지 않는다 (§2.7 산안커·스안커 기준)
      concealed: set.type === 'triplet' ? !(winTile && input.winType === 'ron') : true,
      winTile,
    };
  });
  for (const meld of input.melds) {
    groups.push({
      type: meld.type === 'chi' ? 'run' : isKan(meld) ? 'kan' : 'triplet',
      start: meldKind(meld),
      concealed: meld.type === 'ankan',
      winTile: false,
    });
  }
  return groups;
}

/** 전체 패(은닉 + 부로) 종류별 장수 */
export function allTileCounts(input: WinInput): number[] {
  const counts = input.concealedCounts.slice();
  for (const meld of input.melds) {
    for (const id of meld.tiles) {
      const k = Math.floor(id / 4);
      counts[k] = (counts[k] as number) + 1;
    }
  }
  return counts;
}

function dragonName(kind: TileKind): string {
  return kind === HAKU ? '백' : kind === HATSU ? '발' : '중';
}

function windName(kind: TileKind): string {
  return ['동', '남', '서', '북'][kind - HONOR_START] as string;
}

const GREEN_KINDS: readonly TileKind[] = [19, 20, 21, 23, 25, HATSU]; // 2·3·4·6·8삭 + 발

/** 상황역 (형태와 무관) */
function situationalYaku(input: WinInput, menzen: boolean): YakuEntry[] {
  const out: YakuEntry[] = [];
  if (input.doubleRiichi) out.push({ id: 'doubleRiichi', name: '더블리치', han: 2 });
  else if (input.riichi) out.push({ id: 'riichi', name: '리치', han: 1 });
  if (input.ippatsu) out.push({ id: 'ippatsu', name: '일발', han: 1 });
  if (menzen && input.winType === 'tsumo') {
    out.push({ id: 'menzenTsumo', name: '멘젠쯔모', han: 1 });
  }
  if (input.rinshan && input.winType === 'tsumo') {
    out.push({ id: 'rinshan', name: '영상개화', han: 1 });
  }
  if (input.chankan && input.winType === 'ron') {
    out.push({ id: 'chankan', name: '창깡', han: 1 });
  }
  if (input.haitei && input.winType === 'tsumo') {
    out.push({ id: 'haitei', name: '해저모월', han: 1 });
  }
  if (input.houtei && input.winType === 'ron') {
    out.push({ id: 'houtei', name: '하저로어', han: 1 });
  }
  return out;
}

/** 색 관련 (혼일색·청일색) — 모든 형태 공통 */
function flushYaku(counts: readonly number[], menzen: boolean): YakuEntry[] {
  const suits = new Set<number>();
  let honors = false;
  for (let k = 0; k < TILE_KIND_COUNT; k++) {
    if ((counts[k] as number) === 0) continue;
    if (isHonor(k)) honors = true;
    else suits.add(Math.floor(k / 9));
  }
  if (suits.size !== 1) return [];
  if (honors) return [{ id: 'honitsu', name: '혼일색', han: menzen ? 3 : 2 }];
  return [{ id: 'chinitsu', name: '청일색', han: menzen ? 6 : 5 }];
}

function isAllYaochuu(counts: readonly number[]): boolean {
  for (let k = 0; k < TILE_KIND_COUNT; k++) {
    if ((counts[k] as number) > 0 && !isYaochuu(k)) return false;
  }
  return true;
}

function isAllHonors(counts: readonly number[]): boolean {
  for (let k = 0; k < HONOR_START; k++) {
    if ((counts[k] as number) > 0) return false;
  }
  return true;
}

function isAllTerminals(counts: readonly number[]): boolean {
  for (let k = 0; k < TILE_KIND_COUNT; k++) {
    if ((counts[k] as number) > 0 && !isTerminal(k)) return false;
  }
  return true;
}

function isAllGreen(counts: readonly number[]): boolean {
  for (let k = 0; k < TILE_KIND_COUNT; k++) {
    if ((counts[k] as number) > 0 && !GREEN_KINDS.includes(k)) return false;
  }
  return true;
}

/** 구련보등 판정 (멘젠 + 부로 0 전제) */
function chuurenCheck(
  counts: readonly number[],
  winningKind: TileKind,
): { ok: boolean; junsei: boolean } {
  const suits = new Set<number>();
  for (let k = 0; k < TILE_KIND_COUNT; k++) {
    if ((counts[k] as number) === 0) continue;
    if (isHonor(k)) return { ok: false, junsei: false };
    suits.add(Math.floor(k / 9));
  }
  if (suits.size !== 1) return { ok: false, junsei: false };
  const base = [...suits][0] as number;
  const need = [3, 1, 1, 1, 1, 1, 1, 1, 3];
  let extra = -1;
  for (let i = 0; i < 9; i++) {
    const c = counts[base * 9 + i] as number;
    const n = need[i] as number;
    if (c === n) continue;
    if (c === n + 1 && extra < 0) {
      extra = base * 9 + i;
      continue;
    }
    return { ok: false, junsei: false };
  }
  if (extra < 0) return { ok: false, junsei: false };
  // 순정: 화료패를 빼면 정확히 1112345678999 → 남는 1장이 화료패
  return { ok: true, junsei: extra === winningKind };
}

/** 일반형 해석 하나에 대한 전체 판정 */
export function evaluateStandard(decomp: StandardDecomposition, input: WinInput): YakuResult {
  const menzen = isMenzen(input.melds);
  const groups = buildGroups(decomp, input);
  const counts = allTileCounts(input);
  const rules = input.rules;

  const triplets = groups.filter((g) => g.type !== 'run');
  const runs = groups.filter((g) => g.type === 'run');
  const concealedTriplets = triplets.filter((g) => g.concealed);
  const kans = groups.filter((g) => g.type === 'kan');

  // ── 역만 ──
  const yakuman: YakumanEntry[] = [];
  const dbl = (cond: boolean): 1 | 2 => (cond && rules.doubleYakuman ? 2 : 1);

  if (input.tenhou) yakuman.push({ id: 'tenhou', name: '천화', power: 1 });
  if (input.chihou) yakuman.push({ id: 'chihou', name: '지화', power: 1 });

  if (triplets.length === 4 && concealedTriplets.length === 4) {
    const tanki = decomp.wait === 'tanki';
    yakuman.push(
      tanki
        ? { id: 'suuankouTanki', name: '스안커 단기', power: dbl(true) }
        : { id: 'suuankou', name: '스안커', power: 1 },
    );
  }
  const dragonTriplets = triplets.filter((g) => isDragon(g.start));
  if (dragonTriplets.length === 3) {
    yakuman.push({ id: 'daisangen', name: '대삼원', power: 1 });
  }
  const windTriplets = triplets.filter((g) => isWind(g.start));
  if (windTriplets.length === 4) {
    yakuman.push({ id: 'daisuushii', name: '대사희', power: dbl(true) });
  } else if (windTriplets.length === 3 && isWind(decomp.pair)) {
    yakuman.push({ id: 'shousuushii', name: '소사희', power: 1 });
  }
  if (isAllHonors(counts)) yakuman.push({ id: 'tsuuiisou', name: '자일색', power: 1 });
  if (isAllTerminals(counts)) yakuman.push({ id: 'chinroutou', name: '청노두', power: 1 });
  if (isAllGreen(counts)) yakuman.push({ id: 'ryuuiisou', name: '녹일색', power: 1 });
  if (kans.length === 4) yakuman.push({ id: 'suukantsu', name: '스깡즈', power: 1 });
  if (menzen && input.melds.length === 0) {
    const chuuren = chuurenCheck(counts, input.winningKind);
    if (chuuren.ok) {
      yakuman.push(
        chuuren.junsei
          ? { id: 'junseiChuuren', name: '순정구련보등', power: dbl(true) }
          : { id: 'chuuren', name: '구련보등', power: 1 },
      );
    }
  }

  if (yakuman.length > 0) {
    const best = [...yakuman].sort((a, b) => b.power - a.power)[0] as YakumanEntry;
    const list = rules.multipleYakuman ? yakuman : [best];
    return { yakuman: list, yaku: [] };
  }

  // ── 일반역 ──
  const yaku: YakuEntry[] = situationalYaku(input, menzen);

  // 핑후
  const pairIsYakuhai =
    isDragon(decomp.pair) || decomp.pair === input.seatWind || decomp.pair === input.roundWind;
  if (menzen && runs.length === 4 && !pairIsYakuhai && decomp.wait === 'ryanmen') {
    yaku.push({ id: 'pinfu', name: '핑후', han: 1 });
  }

  // 탕야오 (쿠이탕 OFF면 멘젠 한정)
  if (counts.every((c, k) => c === 0 || !isYaochuu(k))) {
    if (menzen || rules.kuitan) yaku.push({ id: 'tanyao', name: '탕야오', han: 1 });
  }

  // 이페코·량페코 (멘젠 한정, 손 슌쯔만)
  if (menzen) {
    const runCounts = new Map<number, number>();
    for (const set of decomp.sets) {
      if (set.type === 'run') runCounts.set(set.start, (runCounts.get(set.start) ?? 0) + 1);
    }
    let identicalPairs = 0;
    for (const c of runCounts.values()) identicalPairs += Math.floor(c / 2);
    if (identicalPairs === 2) yaku.push({ id: 'ryanpeiko', name: '량페코', han: 3 });
    else if (identicalPairs === 1) yaku.push({ id: 'iipeiko', name: '이페코', han: 1 });
  }

  // 역패
  for (const g of triplets) {
    if (isDragon(g.start)) {
      yaku.push({ id: `yakuhai:${tileKindToNotation(g.start)}`, name: `역패 ${dragonName(g.start)}`, han: 1 });
    }
    if (g.start === input.roundWind) {
      yaku.push({ id: 'roundWind', name: `장풍 ${windName(g.start)}`, han: 1 });
    }
    if (g.start === input.seatWind) {
      yaku.push({ id: 'seatWind', name: `자풍 ${windName(g.start)}`, han: 1 });
    }
  }

  // 산색동순
  for (let pos = 0; pos <= 6; pos++) {
    const hasAll = [0, 1, 2].every((suit) =>
      runs.some((g) => g.start === suit * 9 + pos),
    );
    if (hasAll) {
      yaku.push({ id: 'sanshokuDoujun', name: '산색동순', han: menzen ? 2 : 1 });
      break;
    }
  }

  // 산색동각
  for (let pos = 0; pos <= 8; pos++) {
    const hasAll = [0, 1, 2].every((suit) =>
      triplets.some((g) => g.start === suit * 9 + pos),
    );
    if (hasAll) {
      yaku.push({ id: 'sanshokuDoukou', name: '산색동각', han: 2 });
      break;
    }
  }

  // 일기통관
  for (let suit = 0; suit < 3; suit++) {
    const hasAll = [0, 3, 6].every((pos) => runs.some((g) => g.start === suit * 9 + pos));
    if (hasAll) {
      yaku.push({ id: 'ittsu', name: '일기통관', han: menzen ? 2 : 1 });
      break;
    }
  }

  // 찬타·준찬타 (슌쯔 1개 이상 필요 — 슌쯔 없는 형태는 혼로두·청노두 계열)
  if (runs.length >= 1 && isYaochuu(decomp.pair)) {
    const allGroupsYaochuu = groups.every((g) => {
      if (g.type === 'run') return g.start % 9 === 0 || g.start % 9 === 6;
      return isYaochuu(g.start);
    });
    if (allGroupsYaochuu) {
      const hasHonor = isHonor(decomp.pair) || groups.some((g) => isHonor(g.start));
      yaku.push(
        hasHonor
          ? { id: 'chanta', name: '찬타', han: menzen ? 2 : 1 }
          : { id: 'junchan', name: '준찬타', han: menzen ? 3 : 2 },
      );
    }
  }

  // 토이토이·산안커·산깡즈·쇼산겐·혼로두
  if (triplets.length === 4) yaku.push({ id: 'toitoi', name: '토이토이', han: 2 });
  if (concealedTriplets.length === 3) yaku.push({ id: 'sanankou', name: '산안커', han: 2 });
  if (kans.length === 3) yaku.push({ id: 'sankantsu', name: '산깡즈', han: 2 });
  if (dragonTriplets.length === 2 && isDragon(decomp.pair)) {
    yaku.push({ id: 'shousangen', name: '쇼산겐', han: 2 });
  }
  if (isAllYaochuu(counts)) yaku.push({ id: 'honroutou', name: '혼로두', han: 2 });

  // 혼일색·청일색
  yaku.push(...flushYaku(counts, menzen));

  return { yakuman: [], yaku };
}

/** 치토이츠 해석 판정 */
export function evaluateChiitoi(input: WinInput): YakuResult {
  const counts = input.concealedCounts;
  const menzen = true;

  if (isAllHonors(counts)) {
    return { yakuman: [{ id: 'tsuuiisou', name: '자일색', power: 1 }], yaku: [] };
  }

  const yaku: YakuEntry[] = situationalYaku(input, menzen);
  yaku.push({ id: 'chiitoi', name: '치토이츠', han: 2 });
  if (counts.every((c, k) => c === 0 || !isYaochuu(k))) {
    yaku.push({ id: 'tanyao', name: '탕야오', han: 1 });
  }
  if (isAllYaochuu(counts)) yaku.push({ id: 'honroutou', name: '혼로두', han: 2 });
  yaku.push(...flushYaku(counts, menzen));
  return { yakuman: [], yaku };
}

/** 국사무쌍 판정 */
export function evaluateKokushi(thirteenWait: boolean, input: WinInput): YakuResult {
  const power = thirteenWait && input.rules.doubleYakuman ? 2 : 1;
  const entry: YakumanEntry = thirteenWait
    ? { id: 'kokushi13', name: '국사무쌍 13면', power }
    : { id: 'kokushi', name: '국사무쌍', power: 1 };
  const extra: YakumanEntry[] = [];
  if (input.tenhou) extra.push({ id: 'tenhou', name: '천화', power: 1 });
  if (input.chihou) extra.push({ id: 'chihou', name: '지화', power: 1 });
  const list = [entry, ...extra];
  return { yakuman: input.rules.multipleYakuman ? list : [list[0] as YakumanEntry], yaku: [] };
}

/** 해석 하나에 대한 판정 진입점 */
export function evaluateDecomposition(decomp: Decomposition, input: WinInput): YakuResult {
  if (decomp.kind === 'standard') return evaluateStandard(decomp, input);
  if (decomp.kind === 'chiitoi') return evaluateChiitoi(input);
  return evaluateKokushi(decomp.thirteenWait, input);
}
