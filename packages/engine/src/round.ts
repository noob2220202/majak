import { evaluateWin, type AgariResult } from './agari';
import { meldKind, type Meld } from './meld';
import { RIICHI_DEPOSIT, NOTEN_PENALTY_TOTAL, type RuleSettings } from './rules';
import { ronPoints, tsumoPayments, yakumanBasePoints } from './score';
import { isTenpai, shanten, winningKinds } from './shanten';
import { countsFromKinds, isWind, isYaochuu, kindOfTile, EAST } from './tiles';
import type { Seat, TileId, TileKind } from './types';
import { nextSeat, SEATS } from './types';
import {
  createWall,
  dealHands,
  doraIndicatorKinds,
  drawLive,
  drawRinshan,
  revealDora,
  sortHand,
  uraIndicatorKinds,
  type WallState,
} from './wall';

// ──────────────────────────────────────────────────────────────────
// 상태 모델
// ──────────────────────────────────────────────────────────────────

export interface DiscardEntry {
  readonly tileId: TileId;
  /** 리치 선언패 (가로로 눕힘) */
  readonly riichi: boolean;
  /** 다른 사람이 울어간 경우 그 좌석 */
  calledBy: Seat | null;
  /** 쯔모기리 여부 (연출용) */
  readonly tsumogiri: boolean;
}

export interface RiichiState {
  readonly double: boolean;
  /** 일발 유효 구간인가 */
  ippatsu: boolean;
  /** 선언패가 통과되어 공탁이 성립했는가 */
  accepted: boolean;
}

export interface PlayerState {
  hand: TileId[];
  melds: Meld[];
  discards: DiscardEntry[];
  riichi: RiichiState | null;
  /** 현재 쯔모패 (hand에 포함되지 않음) */
  drawnTile: TileId | null;
  /** 동순 후리텐 (자신의 다음 타패까지) */
  temporaryFuriten: boolean;
  /** 리치 후 론 놓침 → 영구 후리텐 */
  riichiFuriten: boolean;
  /** 첫 타패를 이미 했는가 (더블리치·천화·지화·구종구패 판정) */
  hasDiscarded: boolean;
  hasDrawn: boolean;
}

export type AbortiveReason =
  | 'kyuushu'
  | 'suufonRenda'
  | 'suuchaRiichi'
  | 'suukaikan'
  | 'tripleRon';

export interface WinEntry {
  readonly seat: Seat;
  /** 론이면 방총자, 쯔모면 null */
  readonly from: Seat | null;
  readonly agari: AgariResult;
  /** 이 화료로 얻은 점수 (공탁·본장 포함) */
  readonly gained: number;
  /** 파오 책임자 */
  readonly pao: Seat | null;
}

export type RoundResult =
  | {
      readonly type: 'win';
      readonly wins: readonly WinEntry[];
      readonly deltas: readonly number[];
      readonly dealerRepeats: boolean;
      readonly potRemaining: number;
    }
  | {
      readonly type: 'exhaustive';
      readonly tenpai: readonly boolean[];
      readonly nagashi: readonly Seat[];
      readonly deltas: readonly number[];
      readonly dealerRepeats: boolean;
      readonly potRemaining: number;
    }
  | {
      readonly type: 'abortive';
      readonly reason: AbortiveReason;
      readonly deltas: readonly number[];
      readonly dealerRepeats: true;
      readonly potRemaining: number;
    };

export type ReactionOffer =
  | { type: 'ron' }
  | { type: 'pon' }
  | { type: 'daiminkan' }
  | { type: 'chi'; combos: ReadonlyArray<readonly [TileId, TileId]> };

interface ReactionWindow {
  /** discard: 타패에 대한 반응 / chankan: 가깡 / ankan: 안깡(국사 론만) */
  kind: 'discard' | 'chankan' | 'ankan';
  from: Seat;
  tileId: TileId;
  offers: Map<Seat, ReactionOffer[]>;
  responses: Map<Seat, RoundAction>;
  /** 창깡 윈도우일 때: 통과 시 완성할 깡 정보 */
  pendingKan?: { seat: Seat; meld: Meld; replaceMeldIndex: number | null };
}

export type RoundPhase = 'turn' | 'reaction' | 'ended';

export interface RoundState {
  readonly rules: RuleSettings;
  readonly dealer: Seat;
  readonly roundWind: TileKind;
  readonly honba: number;
  /** 공탁 (1000점 단위 개수) — 이월분 포함, 리치 성립 시 증가 */
  pot: number;
  scores: number[];
  /** 국 시작 시점 점수 (델타 계산 기준) */
  readonly initialScores: readonly number[];
  readonly wall: WallState;
  readonly players: [PlayerState, PlayerState, PlayerState, PlayerState];
  active: Seat;
  phase: RoundPhase;
  /** 현재 쯔모가 해저패였는가 */
  haiteiDrawn: boolean;
  /** 직전 쯔모가 영상패였는가 */
  rinshanDraw: boolean;
  /** 아무 울기도 일어나지 않은 첫 바퀴인가 (더블리치·구종구패·사풍연타·천화·지화) */
  uninterrupted: boolean;
  totalKans: number;
  kanOwners: Set<Seat>;
  /** 대명깡·가깡의 신도라 공개 대기 수 */
  pendingKanDora: number;
  /** 사깡산료 대기: 다음 타패 통과 시 유국 */
  suukaikanPending: boolean;
  reaction: ReactionWindow | null;
  lastDiscard: { seat: Seat; tileId: TileId } | null;
  events: RoundEvent[];
  result: RoundResult | null;
}

export type RoundEvent =
  | { type: 'deal'; dealer: Seat; doraIndicator: TileKind }
  | { type: 'draw'; seat: Seat; tileId: TileId; rinshan: boolean }
  | { type: 'discard'; seat: Seat; tileId: TileId; riichi: boolean; tsumogiri: boolean }
  | { type: 'call'; seat: Seat; meld: Meld }
  | { type: 'riichiAccepted'; seat: Seat }
  | { type: 'doraRevealed'; indicator: TileKind }
  | { type: 'kyuushuDeclared'; seat: Seat }
  | { type: 'win'; seat: Seat; from: Seat | null }
  | { type: 'end'; result: RoundResult };

// ──────────────────────────────────────────────────────────────────
// 액션
// ──────────────────────────────────────────────────────────────────

export type RoundAction =
  | { type: 'discard'; tileId: TileId; riichi?: boolean }
  | { type: 'tsumo' }
  | { type: 'ron' }
  | { type: 'pon' }
  | { type: 'daiminkan' }
  | { type: 'chi'; tiles: readonly [TileId, TileId] }
  | { type: 'ankan'; kind: TileKind }
  | { type: 'shouminkan'; tileId: TileId }
  | { type: 'kyuushu' }
  | { type: 'pass' };

export interface TurnChoices {
  readonly discards: readonly TileId[];
  /** 리치 선언 시 버릴 수 있는 패 (비어 있으면 리치 불가) */
  readonly riichiDiscards: readonly TileId[];
  readonly canTsumo: boolean;
  readonly ankanKinds: readonly TileKind[];
  readonly shouminkanTiles: readonly TileId[];
  readonly canKyuushu: boolean;
}

// ──────────────────────────────────────────────────────────────────
// 생성
// ──────────────────────────────────────────────────────────────────

export interface RoundConfig {
  readonly rules: RuleSettings;
  readonly dealer: Seat;
  readonly roundWind: TileKind;
  readonly honba: number;
  readonly pot: number;
  readonly scores: readonly number[];
  /** 셔플 완료된 136 순열 */
  readonly wallOrder: readonly TileId[];
}

export function startRound(config: RoundConfig): RoundState {
  const wall = createWall(config.wallOrder);
  const hands = dealHands(wall);
  const players = SEATS.map((seat) => ({
    hand: hands[seat] as TileId[],
    melds: [],
    discards: [],
    riichi: null,
    drawnTile: null,
    temporaryFuriten: false,
    riichiFuriten: false,
    hasDiscarded: false,
    hasDrawn: false,
  })) as unknown as RoundState['players'];

  const state: RoundState = {
    rules: config.rules,
    dealer: config.dealer,
    roundWind: config.roundWind,
    honba: config.honba,
    pot: config.pot,
    scores: [...config.scores],
    initialScores: [...config.scores],
    wall,
    players,
    active: config.dealer,
    phase: 'turn',
    haiteiDrawn: false,
    rinshanDraw: false,
    uninterrupted: true,
    totalKans: 0,
    kanOwners: new Set(),
    pendingKanDora: 0,
    suukaikanPending: false,
    reaction: null,
    lastDiscard: null,
    events: [],
    result: null,
  };
  state.events.push({
    type: 'deal',
    dealer: config.dealer,
    doraIndicator: doraIndicatorKinds(wall)[0] as TileKind,
  });
  performDraw(state);
  return state;
}

// ──────────────────────────────────────────────────────────────────
// 공통 헬퍼
// ──────────────────────────────────────────────────────────────────

function player(state: RoundState, seat: Seat): PlayerState {
  return state.players[seat];
}

export function seatWindOf(state: RoundState, seat: Seat): TileKind {
  return EAST + ((seat - state.dealer + 4) % 4);
}

function handCounts(p: PlayerState, includeDrawn: boolean): number[] {
  const kinds = p.hand.map(kindOfTile);
  if (includeDrawn && p.drawnTile !== null) kinds.push(kindOfTile(p.drawnTile));
  return countsFromKinds(kinds);
}

function currentWaits(p: PlayerState): TileKind[] {
  return winningKinds(handCounts(p, false), p.melds.length);
}

/** 후리텐 (§2.5): 자기 버림패 + 동순 + 리치 영구 */
export function isFuriten(state: RoundState, seat: Seat): boolean {
  const p = player(state, seat);
  if (p.riichiFuriten || p.temporaryFuriten) return true;
  const waits = currentWaits(p);
  if (waits.length === 0) return false;
  return p.discards.some((d) => waits.includes(kindOfTile(d.tileId)));
}

function buildWinInput(
  state: RoundState,
  seat: Seat,
  winTileId: TileId,
  winType: 'tsumo' | 'ron',
  flags: { rinshan?: boolean; chankan?: boolean },
): Parameters<typeof evaluateWin>[0] {
  const p = player(state, seat);
  const concealedIds = [...p.hand, winTileId];
  const riichi = p.riichi?.accepted ?? false;
  const isHaitei = winType === 'tsumo' && state.haiteiDrawn && !flags.rinshan;
  const isHoutei = winType === 'ron' && state.wall.liveRemaining === 0 && !flags.chankan;
  const isFirstUninterrupted = state.uninterrupted && !p.hasDiscarded;
  return {
    rules: state.rules,
    concealedCounts: countsFromKinds(concealedIds.map(kindOfTile)),
    concealedTileIds: concealedIds,
    melds: p.melds,
    winningKind: kindOfTile(winTileId),
    winType,
    seatWind: seatWindOf(state, seat),
    roundWind: state.roundWind,
    riichi,
    doubleRiichi: p.riichi?.double ?? false,
    ippatsu: (p.riichi?.accepted && p.riichi.ippatsu) ?? false,
    rinshan: flags.rinshan ?? false,
    chankan: flags.chankan ?? false,
    haitei: isHaitei,
    houtei: isHoutei,
    tenhou: winType === 'tsumo' && seat === state.dealer && isFirstUninterrupted && !flags.rinshan,
    chihou: winType === 'tsumo' && seat !== state.dealer && isFirstUninterrupted && !flags.rinshan,
    doraIndicators: doraIndicatorKinds(state.wall),
    uraIndicators: riichi && state.rules.uraDora ? uraIndicatorKinds(state.wall) : [],
  };
}

function winCheck(
  state: RoundState,
  seat: Seat,
  winTileId: TileId,
  winType: 'tsumo' | 'ron',
  flags: { rinshan?: boolean; chankan?: boolean } = {},
): AgariResult | null {
  const p = player(state, seat);
  const counts = countsFromKinds([...p.hand.map(kindOfTile), kindOfTile(winTileId)]);
  if (shanten(counts, p.melds.length) !== -1) return null;
  return evaluateWin(buildWinInput(state, seat, winTileId, winType, flags));
}

/** 안깡에 대한 국사무쌍 창깡 여부 */
function kokushiChankanPossible(state: RoundState, seat: Seat, kanKind: TileKind): boolean {
  if (!state.rules.chankan || !isYaochuu(kanKind)) return false;
  const p = player(state, seat);
  const counts = countsFromKinds([...p.hand.map(kindOfTile), kanKind]);
  if (p.melds.length > 0) return false;
  // 국사무쌍 형태로만 화료 가능해야 함
  const result = evaluateWin(buildWinInput(state, seat, kanKind * 4, 'ron', { chankan: true }));
  return result !== null && result.yakuman.some((y) => y.id === 'kokushi' || y.id === 'kokushi13') &&
    shanten(counts, 0) === -1;
}

// ──────────────────────────────────────────────────────────────────
// 턴 진행
// ──────────────────────────────────────────────────────────────────

/** 쯔모 (라이브 소진이면 황패유국 처리) */
function performDraw(state: RoundState): void {
  if (state.wall.liveRemaining === 0) {
    resolveExhaustiveDraw(state);
    return;
  }
  const p = player(state, state.active);
  const tile = drawLive(state.wall);
  p.drawnTile = tile;
  p.hasDrawn = true;
  state.haiteiDrawn = state.wall.liveRemaining === 0;
  state.rinshanDraw = false;
  state.phase = 'turn';
  state.events.push({ type: 'draw', seat: state.active, tileId: tile, rinshan: false });
}

function performRinshanDraw(state: RoundState): void {
  const p = player(state, state.active);
  const tile = drawRinshan(state.wall);
  p.drawnTile = tile;
  state.rinshanDraw = true;
  state.haiteiDrawn = false;
  state.phase = 'turn';
  state.events.push({ type: 'draw', seat: state.active, tileId: tile, rinshan: true });
}

/** 현재 턴 좌석의 가능한 행동 (서버가 game.choices로 전송) */
export function turnChoices(state: RoundState): TurnChoices {
  if (state.phase !== 'turn') {
    return {
      discards: [],
      riichiDiscards: [],
      canTsumo: false,
      ankanKinds: [],
      shouminkanTiles: [],
      canKyuushu: false,
    };
  }
  const seat = state.active;
  const p = player(state, seat);
  const afterCall = p.drawnTile === null; // 치·퐁 직후

  // 타패 후보
  let discards: TileId[];
  if (p.riichi) {
    discards = p.drawnTile !== null ? [p.drawnTile] : [];
  } else {
    discards = [...p.hand];
    if (p.drawnTile !== null) discards.push(p.drawnTile);
    if (afterCall) discards = discards.filter((t) => !isKuikaeForbidden(p, t));
  }

  // 쯔모 화료
  const canTsumo =
    p.drawnTile !== null &&
    winCheck(state, seat, p.drawnTile, 'tsumo', { rinshan: state.rinshanDraw }) !== null;

  // 리치 (§2.4)
  const riichiDiscards: TileId[] = [];
  if (
    !p.riichi &&
    !afterCall &&
    p.melds.every((m) => m.type === 'ankan') &&
    (state.scores[seat] as number) >= RIICHI_DEPOSIT &&
    state.wall.liveRemaining >= 4
  ) {
    const all = [...p.hand, ...(p.drawnTile !== null ? [p.drawnTile] : [])];
    // 종류 단위로 텐파이 유지 여부를 판정하고, 통과 종류의 모든 실물 패를 후보로
    const passingKinds = new Set<TileKind>();
    const checked = new Set<TileKind>();
    for (const t of all) {
      const k = kindOfTile(t);
      if (checked.has(k)) continue;
      checked.add(k);
      const remaining = removeOne(all, t).map(kindOfTile);
      if (isTenpai(countsFromKinds(remaining), p.melds.length)) passingKinds.add(k);
    }
    for (const t of all) {
      if (passingKinds.has(kindOfTile(t))) riichiDiscards.push(t);
    }
  }

  // 안깡·가깡 (깡 4개 상한, 라이브 잔여 1장 이상)
  const ankanKinds: TileKind[] = [];
  const shouminkanTiles: TileId[] = [];
  if (p.drawnTile !== null && state.totalKans < 4 && state.wall.liveRemaining >= 1) {
    const counts = handCounts(p, true);
    for (let k = 0; k < 34; k++) {
      if ((counts[k] as number) === 4 && ankanAllowed(state, seat, k)) ankanKinds.push(k);
    }
    if (!p.riichi) {
      for (const t of [...p.hand, p.drawnTile]) {
        const k = kindOfTile(t);
        if (p.melds.some((m) => m.type === 'pon' && meldKind(m) === k)) {
          shouminkanTiles.push(t);
        }
      }
    }
  }

  // 구종구패 (첫 순, 울기 없음, 요구패 9종+)
  let canKyuushu = false;
  if (state.uninterrupted && !p.hasDiscarded && p.drawnTile !== null && p.melds.length === 0) {
    const counts = handCounts(p, true);
    let types = 0;
    for (let k = 0; k < 34; k++) {
      if ((counts[k] as number) > 0 && isYaochuu(k)) types++;
    }
    canKyuushu = types >= 9;
  }

  return { discards, riichiDiscards, canTsumo, ankanKinds, shouminkanTiles, canKyuushu };
}

/** 리치 후 안깡 제한 (§2.4): 쯔모패 종류 + 대기 불변일 때만 */
function ankanAllowed(state: RoundState, seat: Seat, kind: TileKind): boolean {
  const p = player(state, seat);
  if (!p.riichi) return true;
  if (p.drawnTile === null || kindOfTile(p.drawnTile) !== kind) return false;
  // 깡 전 대기 == 깡 후 대기
  const before = currentWaits(p);
  const afterKinds = p.hand.map(kindOfTile).filter((k) => k !== kind);
  const after = winningKinds(countsFromKinds(afterKinds), p.melds.length + 1);
  return before.length === after.length && before.every((w, i) => w === after[i]);
}

/** 쿠이카에 금지: 방금 울어간 패와 같은 종류·스지 반대끝 즉시 타패 금지 */
function isKuikaeForbidden(p: PlayerState, tileId: TileId): boolean {
  const lastMeld = p.melds[p.melds.length - 1];
  if (!lastMeld || lastMeld.type === 'ankan') return false;
  const k = kindOfTile(tileId);
  const calledKind = kindOfTile(lastMeld.calledTileId);
  if (k === calledKind) return true;
  if (lastMeld.type === 'chi') {
    const start = meldKind(lastMeld);
    const pos = calledKind - start;
    // 양끝 치의 반대끝 (예: 45에 3을 치 → 6 타패 금지)
    if (pos === 0 && start % 9 <= 5 && k === start + 3) return true;
    if (pos === 2 && start % 9 >= 1 && k === start - 1) return true;
  }
  return false;
}

function removeOne(tiles: readonly TileId[], target: TileId): TileId[] {
  const idx = tiles.indexOf(target);
  if (idx < 0) throw new Error(`패가 없음: ${target}`);
  return [...tiles.slice(0, idx), ...tiles.slice(idx + 1)];
}

// ──────────────────────────────────────────────────────────────────
// 액션 적용
// ──────────────────────────────────────────────────────────────────

export function applyAction(state: RoundState, seat: Seat, action: RoundAction): void {
  if (state.phase === 'ended') throw new Error('이미 종료된 국');
  if (state.phase === 'reaction') {
    applyReaction(state, seat, action);
    return;
  }
  if (seat !== state.active) throw new Error(`턴이 아님: seat ${seat}`);
  const choices = turnChoices(state);

  switch (action.type) {
    case 'discard': {
      const pool = action.riichi ? choices.riichiDiscards : choices.discards;
      if (!pool.includes(action.tileId)) throw new Error('버릴 수 없는 패');
      performDiscard(state, seat, action.tileId, action.riichi ?? false);
      return;
    }
    case 'tsumo': {
      if (!choices.canTsumo) throw new Error('쯔모 화료 불가');
      const p = player(state, seat);
      const result = winCheck(state, seat, p.drawnTile as TileId, 'tsumo', {
        rinshan: state.rinshanDraw,
      }) as AgariResult;
      finishWithWins(state, [{ seat, from: null, agari: result }]);
      return;
    }
    case 'ankan': {
      if (!choices.ankanKinds.includes(action.kind)) throw new Error('안깡 불가');
      performAnkan(state, seat, action.kind);
      return;
    }
    case 'shouminkan': {
      if (!choices.shouminkanTiles.includes(action.tileId)) throw new Error('가깡 불가');
      performShouminkan(state, seat, action.tileId);
      return;
    }
    case 'kyuushu': {
      if (!choices.canKyuushu) throw new Error('구종구패 선언 불가');
      state.events.push({ type: 'kyuushuDeclared', seat });
      finishAbortive(state, 'kyuushu');
      return;
    }
    default:
      throw new Error(`턴에서 불가능한 액션: ${action.type}`);
  }
}

function performDiscard(state: RoundState, seat: Seat, tileId: TileId, riichi: boolean): void {
  const p = player(state, seat);
  const tsumogiri = p.drawnTile === tileId;

  // 손패 갱신
  if (tsumogiri) {
    p.drawnTile = null;
  } else {
    p.hand = removeOne(p.hand, tileId);
    if (p.drawnTile !== null) {
      p.hand.push(p.drawnTile);
      p.drawnTile = null;
    }
    sortHand(p.hand);
  }

  if (riichi) {
    p.riichi = {
      double: state.uninterrupted && !p.hasDiscarded,
      ippatsu: true,
      accepted: false,
    };
  }
  // 자신의 타패로 동순 후리텐 해제
  p.temporaryFuriten = false;
  // 일발 소멸 (자신의 다음 타패 도달)
  if (p.riichi && p.riichi.accepted) p.riichi.ippatsu = false;

  p.discards.push({ tileId, riichi, calledBy: null, tsumogiri });
  p.hasDiscarded = true;
  state.lastDiscard = { seat, tileId };
  state.events.push({ type: 'discard', seat, tileId, riichi, tsumogiri });

  // 대명깡·가깡 신도라 공개 (타패 시)
  if (state.pendingKanDora > 0 && state.rules.kanDoraReveal === 'afterDiscard') {
    revealPendingDora(state);
  }

  openReactionWindow(state, 'discard', seat, tileId);
}

function revealPendingDora(state: RoundState): void {
  while (state.pendingKanDora > 0) {
    revealDora(state.wall);
    state.pendingKanDora--;
    const kinds = doraIndicatorKinds(state.wall);
    state.events.push({ type: 'doraRevealed', indicator: kinds[kinds.length - 1] as TileKind });
  }
}

function performAnkan(state: RoundState, seat: Seat, kind: TileKind): void {
  const p = player(state, seat);
  const all = [...p.hand, ...(p.drawnTile !== null ? [p.drawnTile] : [])];
  const ids = all.filter((t) => kindOfTile(t) === kind);
  if (ids.length !== 4) throw new Error('안깡 4장 미달');
  p.hand = all.filter((t) => kindOfTile(t) !== kind);
  sortHand(p.hand);
  p.drawnTile = null;

  const meld: Meld = { type: 'ankan', tiles: ids as [TileId, TileId, TileId, TileId] };

  // 안깡 국사 창깡 윈도우
  const robbers = SEATS.filter(
    (s) => s !== seat && kokushiChankanPossible(state, s, kind) && !isFuriten(state, s),
  );
  breakIppatsuAll(state);
  state.uninterrupted = false;

  if (robbers.length > 0) {
    openKanReactionWindow(state, 'ankan', seat, ids[0] as TileId, meld, robbers);
    return;
  }
  completeKan(state, seat, meld, null);
}

function performShouminkan(state: RoundState, seat: Seat, tileId: TileId): void {
  const p = player(state, seat);
  const kind = kindOfTile(tileId);
  const meldIndex = p.melds.findIndex((m) => m.type === 'pon' && meldKind(m) === kind);
  if (meldIndex < 0) throw new Error('해당 퐁이 없음');
  const pon = p.melds[meldIndex] as Extract<Meld, { type: 'pon' }>;

  // 손·쯔모패에서 제거
  if (p.drawnTile === tileId) p.drawnTile = null;
  else {
    p.hand = removeOne(p.hand, tileId);
    if (p.drawnTile !== null) {
      p.hand.push(p.drawnTile);
      p.drawnTile = null;
      sortHand(p.hand);
    }
  }

  const meld: Meld = {
    type: 'shouminkan',
    tiles: sortHand([...pon.tiles, tileId]) as [TileId, TileId, TileId, TileId],
    calledTileId: pon.calledTileId,
    addedTileId: tileId,
    from: pon.from,
  };

  breakIppatsuAll(state);
  state.uninterrupted = false;

  // 창깡 윈도우 (§2.3)
  if (state.rules.chankan) {
    const robbers = SEATS.filter((s) => {
      if (s === seat || isFuriten(state, s)) return false;
      return winCheck(state, s, tileId, 'ron', { chankan: true }) !== null;
    });
    if (robbers.length > 0) {
      openKanReactionWindow(state, 'chankan', seat, tileId, meld, robbers, meldIndex);
      return;
    }
  }
  completeKan(state, seat, meld, meldIndex);
}

/** 깡 확정: 면자 등록 → 신도라 처리 → 영상패 쯔모 */
function completeKan(
  state: RoundState,
  seat: Seat,
  meld: Meld,
  replaceMeldIndex: number | null,
): void {
  const p = player(state, seat);
  if (replaceMeldIndex !== null) p.melds[replaceMeldIndex] = meld;
  else p.melds.push(meld);
  state.events.push({ type: 'call', seat, meld });

  state.totalKans++;
  state.kanOwners.add(seat);

  // 신도라: 안깡은 즉시, 대명깡·가깡은 타패 시 (또는 즉시 옵션)
  if (meld.type === 'ankan' || state.rules.kanDoraReveal === 'immediate') {
    state.pendingKanDora++;
    revealPendingDora(state);
  } else {
    state.pendingKanDora++;
  }

  // 사깡산료 대기 (2인 이상 합계 4깡 — 타패 통과 후 유국)
  if (state.totalKans === 4 && state.kanOwners.size >= 2) {
    state.suukaikanPending = true;
  }

  state.active = seat;
  performRinshanDraw(state);
}

function breakIppatsuAll(state: RoundState): void {
  for (const s of SEATS) {
    const r = player(state, s).riichi;
    if (r) r.ippatsu = false;
  }
}

// ──────────────────────────────────────────────────────────────────
// 반응 (론·퐁·깡·치)
// ──────────────────────────────────────────────────────────────────

function openReactionWindow(state: RoundState, kind: 'discard', from: Seat, tileId: TileId): void {
  const offers = new Map<Seat, ReactionOffer[]>();
  const tileKind = kindOfTile(tileId);
  const canCall = state.wall.liveRemaining > 0;

  for (const seat of SEATS) {
    if (seat === from) continue;
    const p = player(state, seat);
    const list: ReactionOffer[] = [];

    // 론 (후리텐이면 불가)
    if (!isFuriten(state, seat) && winCheck(state, seat, tileId, 'ron') !== null) {
      list.push({ type: 'ron' });
    }

    if (!p.riichi && canCall) {
      const sameKind = p.hand.filter((t) => kindOfTile(t) === tileKind);
      if (sameKind.length >= 2) list.push({ type: 'pon' });
      if (sameKind.length >= 3 && state.totalKans < 4) list.push({ type: 'daiminkan' });

      // 치: 상가의 타패만
      if (seat === nextSeat(from) && tileKind < 27) {
        const combos: Array<readonly [TileId, TileId]> = [];
        const pick = (k: TileKind): TileId | undefined =>
          p.hand.find((t) => kindOfTile(t) === k);
        const pos = tileKind % 9;
        const candidates: Array<[TileKind, TileKind]> = [];
        if (pos >= 2) candidates.push([tileKind - 2, tileKind - 1]);
        if (pos >= 1 && pos <= 7) candidates.push([tileKind - 1, tileKind + 1]);
        if (pos <= 6) candidates.push([tileKind + 1, tileKind + 2]);
        for (const [a, b] of candidates) {
          const ta = pick(a);
          const tb = pick(b);
          if (ta !== undefined && tb !== undefined) combos.push([ta, tb]);
        }
        if (combos.length > 0) list.push({ type: 'chi', combos });
      }
    }

    if (list.length > 0) offers.set(seat, list);
  }

  if (offers.size === 0) {
    settleDiscardWithoutClaim(state, from);
    return;
  }
  state.phase = 'reaction';
  state.reaction = { kind, from, tileId, offers, responses: new Map() };
}

function openKanReactionWindow(
  state: RoundState,
  kind: 'chankan' | 'ankan',
  from: Seat,
  tileId: TileId,
  meld: Meld,
  robbers: Seat[],
  replaceMeldIndex: number | null = null,
): void {
  const offers = new Map<Seat, ReactionOffer[]>();
  for (const seat of robbers) offers.set(seat, [{ type: 'ron' }]);
  state.phase = 'reaction';
  state.reaction = {
    kind,
    from,
    tileId,
    offers,
    responses: new Map(),
    pendingKan: { seat: from, meld, replaceMeldIndex },
  };
}

/** 현재 반응 대기 좌석과 선택지 (서버가 game.choices로 전송) */
export function reactionOffers(state: RoundState): ReadonlyMap<Seat, ReactionOffer[]> {
  if (state.phase !== 'reaction' || !state.reaction) return new Map();
  const remaining = new Map<Seat, ReactionOffer[]>();
  for (const [seat, offers] of state.reaction.offers) {
    if (!state.reaction.responses.has(seat)) remaining.set(seat, offers);
  }
  return remaining;
}

function applyReaction(state: RoundState, seat: Seat, action: RoundAction): void {
  const window = state.reaction;
  if (!window) throw new Error('반응 대기 상태가 아님');
  const offers = window.offers.get(seat);
  if (!offers) throw new Error('반응 권한이 없는 좌석');
  if (window.responses.has(seat)) throw new Error('이미 응답함');

  const valid =
    action.type === 'pass' ||
    offers.some((o) => {
      if (o.type !== action.type) return false;
      if (action.type === 'chi' && o.type === 'chi') {
        return o.combos.some(
          (c) => (c[0] === action.tiles[0] && c[1] === action.tiles[1]) ||
            (c[0] === action.tiles[1] && c[1] === action.tiles[0]),
        );
      }
      return true;
    });
  if (!valid) throw new Error(`허용되지 않은 반응: ${action.type}`);

  window.responses.set(seat, action);
  if (window.responses.size < window.offers.size) return; // 아직 대기

  resolveReactions(state);
}

function resolveReactions(state: RoundState): void {
  const window = state.reaction as ReactionWindow;
  state.reaction = null;

  const rons: Seat[] = [];
  let ponSeat: Seat | null = null;
  let kanSeat: Seat | null = null;
  let chi: { seat: Seat; tiles: readonly [TileId, TileId] } | null = null;

  for (const [seat, action] of window.responses) {
    if (action.type === 'ron') rons.push(seat);
    else if (action.type === 'pon') ponSeat = seat;
    else if (action.type === 'daiminkan') kanSeat = seat;
    else if (action.type === 'chi') chi = { seat, tiles: action.tiles };
  }

  // 대기패 통과에 따른 후리텐 갱신 (론 선언자 제외)
  const tileKind = kindOfTile(window.tileId);
  for (const [seat] of window.offers) {
    if (rons.includes(seat)) continue;
    const p = player(state, seat);
    if (currentWaits(p).includes(tileKind)) {
      p.temporaryFuriten = true;
      if (p.riichi?.accepted) p.riichiFuriten = true;
    }
  }
  // 반응 권한이 없었더라도 대기패가 지나가면 동순 후리텐 (역 없는 대기 등)
  for (const seat of SEATS) {
    if (seat === window.from || window.offers.has(seat)) continue;
    const p = player(state, seat);
    if (currentWaits(p).includes(tileKind)) {
      p.temporaryFuriten = true;
      if (p.riichi?.accepted) p.riichiFuriten = true;
    }
  }

  if (rons.length > 0) {
    // 트리플론 유국 (§2.2)
    if (rons.length === 3 && state.rules.tripleRonDraw) {
      finishAbortive(state, 'tripleRon');
      return;
    }
    const flags =
      window.kind === 'discard' ? {} : ({ chankan: true } as { chankan: boolean });
    const wins = rons.map((seat) => ({
      seat,
      from: window.from,
      agari: winCheck(state, seat, window.tileId, 'ron', flags) as AgariResult,
    }));
    finishWithWins(state, wins, {
      tileId: window.tileId,
      source: window.kind === 'discard' ? 'discard' : 'kan',
    });
    return;
  }

  // 창깡·안깡 윈도우 통과 → 깡 확정
  if (window.pendingKan) {
    completeKan(state, window.pendingKan.seat, window.pendingKan.meld,
      window.pendingKan.replaceMeldIndex);
    return;
  }

  // 울기 (론 > 퐁·깡 > 치)
  if (kanSeat !== null) {
    executeDaiminkan(state, kanSeat, window);
    return;
  }
  if (ponSeat !== null) {
    executePon(state, ponSeat, window);
    return;
  }
  if (chi) {
    executeChi(state, chi.seat, chi.tiles, window);
    return;
  }

  settleDiscardWithoutClaim(state, window.from);
}

function markCalled(state: RoundState, from: Seat, caller: Seat): void {
  const discards = player(state, from).discards;
  const last = discards[discards.length - 1];
  if (last) last.calledBy = caller;
  breakIppatsuAll(state);
  state.uninterrupted = false;
}

function executePon(state: RoundState, seat: Seat, window: ReactionWindow): void {
  acceptRiichiIfPending(state, window.from);
  markCalled(state, window.from, seat);
  const p = player(state, seat);
  const kind = kindOfTile(window.tileId);
  const own = p.hand.filter((t) => kindOfTile(t) === kind).slice(0, 2);
  for (const t of own) p.hand = removeOne(p.hand, t);
  const meld: Meld = {
    type: 'pon',
    tiles: sortHand([...own, window.tileId]) as [TileId, TileId, TileId],
    calledTileId: window.tileId,
    from: window.from,
  };
  p.melds.push(meld);
  state.events.push({ type: 'call', seat, meld });
  state.active = seat;
  state.phase = 'turn';
  p.drawnTile = null;
}

function executeDaiminkan(state: RoundState, seat: Seat, window: ReactionWindow): void {
  acceptRiichiIfPending(state, window.from);
  markCalled(state, window.from, seat);
  const p = player(state, seat);
  const kind = kindOfTile(window.tileId);
  const own = p.hand.filter((t) => kindOfTile(t) === kind);
  for (const t of own) p.hand = removeOne(p.hand, t);
  const meld: Meld = {
    type: 'daiminkan',
    tiles: sortHand([...own, window.tileId]) as [TileId, TileId, TileId, TileId],
    calledTileId: window.tileId,
    from: window.from,
  };
  state.active = seat;
  completeKan(state, seat, meld, null);
}

function executeChi(
  state: RoundState,
  seat: Seat,
  tiles: readonly [TileId, TileId],
  window: ReactionWindow,
): void {
  acceptRiichiIfPending(state, window.from);
  markCalled(state, window.from, seat);
  const p = player(state, seat);
  p.hand = removeOne(p.hand, tiles[0]);
  p.hand = removeOne(p.hand, tiles[1]);
  const meld: Meld = {
    type: 'chi',
    tiles: sortHand([tiles[0], tiles[1], window.tileId]) as [TileId, TileId, TileId],
    calledTileId: window.tileId,
    from: window.from,
  };
  p.melds.push(meld);
  state.events.push({ type: 'call', seat, meld });
  state.active = seat;
  state.phase = 'turn';
  p.drawnTile = null;
}

/** 리치 선언패가 울기로 넘어가도 리치는 성립 */
function acceptRiichiIfPending(state: RoundState, seat: Seat): void {
  const p = player(state, seat);
  if (p.riichi && !p.riichi.accepted) {
    p.riichi.accepted = true;
    state.scores[seat] = (state.scores[seat] as number) - RIICHI_DEPOSIT;
    state.pot++;
    state.events.push({ type: 'riichiAccepted', seat });
  }
}

/** 타패가 아무에게도 울리지 않고 통과 */
function settleDiscardWithoutClaim(state: RoundState, from: Seat): void {
  acceptRiichiIfPending(state, from);

  // 사가리치: 4인 전원 리치 성립 (§2.4)
  const riichiCount = SEATS.filter((s) => player(state, s).riichi?.accepted).length;
  if (riichiCount === 4) {
    finishAbortive(state, 'suuchaRiichi');
    return;
  }

  // 사깡산료 (§2.3)
  if (state.suukaikanPending) {
    finishAbortive(state, 'suukaikan');
    return;
  }

  // 사풍연타 (§2.9): 첫 바퀴 4인이 같은 풍패
  if (state.uninterrupted) {
    const firsts = SEATS.map((s) => player(state, s).discards[0]);
    if (firsts.every((d) => d !== undefined)) {
      const kinds = firsts.map((d) => kindOfTile((d as DiscardEntry).tileId));
      const first = kinds[0] as TileKind;
      if (isWind(first) && kinds.every((k) => k === first)) {
        finishAbortive(state, 'suufonRenda');
        return;
      }
    }
  }

  state.active = nextSeat(from);
  performDraw(state);
}

// ──────────────────────────────────────────────────────────────────
// 국 종료 처리
// ──────────────────────────────────────────────────────────────────

function deltasFromInitial(state: RoundState): number[] {
  return SEATS.map((s) => (state.scores[s] as number) - (state.initialScores[s] as number));
}

function finishAbortive(state: RoundState, reason: AbortiveReason): void {
  const result: RoundResult = {
    type: 'abortive',
    reason,
    deltas: deltasFromInitial(state),
    dealerRepeats: true,
    potRemaining: state.pot,
  };
  endRound(state, result);
}

function resolveExhaustiveDraw(state: RoundState): void {
  // 나가시만관 (§2.9)
  const nagashi: Seat[] = [];
  if (state.rules.nagashiMangan) {
    for (const seat of SEATS) {
      const p = player(state, seat);
      const allYaochuu =
        p.discards.length > 0 &&
        p.discards.every((d) => isYaochuu(kindOfTile(d.tileId)) && d.calledBy === null);
      if (allYaochuu) nagashi.push(seat);
    }
  }

  const tenpaiFlags = SEATS.map((seat) => {
    const p = player(state, seat);
    return isTenpai(handCounts(p, false), p.melds.length);
  });

  if (nagashi.length > 0) {
    // 만관 상당 지급 (쯔모 취급). 노텐벌부는 없음.
    for (const seat of nagashi) {
      const dealerWin = seat === state.dealer;
      const pay = tsumoPayments(2000, dealerWin);
      for (const other of SEATS) {
        if (other === seat) continue;
        const amount = other === state.dealer && !dealerWin ? pay.fromDealer : pay.fromNonDealer;
        state.scores[other] = (state.scores[other] as number) - amount;
        state.scores[seat] = (state.scores[seat] as number) + amount;
      }
    }
  } else {
    // 노텐벌부 총 3,000점 (§2.9)
    const tenpaiSeats = SEATS.filter((s) => tenpaiFlags[s]);
    const notenSeats = SEATS.filter((s) => !tenpaiFlags[s]);
    if (tenpaiSeats.length > 0 && notenSeats.length > 0) {
      const gain = NOTEN_PENALTY_TOTAL / tenpaiSeats.length;
      const loss = NOTEN_PENALTY_TOTAL / notenSeats.length;
      for (const s of tenpaiSeats) state.scores[s] = (state.scores[s] as number) + gain;
      for (const s of notenSeats) state.scores[s] = (state.scores[s] as number) - loss;
    }
  }

  const result: RoundResult = {
    type: 'exhaustive',
    tenpai: tenpaiFlags,
    nagashi,
    deltas: deltasFromInitial(state),
    dealerRepeats: tenpaiFlags[state.dealer] as boolean,
    potRemaining: state.pot, // 유국 시 공탁 이월
  };
  endRound(state, result);
}

function finishWithWins(
  state: RoundState,
  rawWins: Array<{ seat: Seat; from: Seat | null; agari: AgariResult }>,
  ronTile?: { tileId: TileId; source: 'discard' | 'kan' },
): void {
  // 더블론: 방총자 기준 반시계로 가까운 순서 정렬 (§2.2)
  const orderFrom = (from: Seat | null, seat: Seat): number =>
    from === null ? 0 : (seat - from + 4) % 4;
  const wins = [...rawWins].sort(
    (a, b) => orderFrom(a.from, a.seat) - orderFrom(b.from, b.seat),
  );

  // 화료패 소재 정리: 론패는 강에서 회수(calledBy) 후 첫 화료자 손패에 편입
  if (ronTile && wins.length > 0) {
    const firstWinner = (wins[0] as { seat: Seat }).seat;
    if (ronTile.source === 'discard') {
      const from = (wins[0] as { from: Seat | null }).from as Seat;
      const discards = player(state, from).discards;
      const last = discards[discards.length - 1];
      if (last) last.calledBy = firstWinner;
    }
    player(state, firstWinner).hand.push(ronTile.tileId);
  }

  const entries: WinEntry[] = [];
  wins.forEach((win, index) => {
    const { seat, from, agari } = win;
    const dealerWin = seat === state.dealer;
    const gainedBefore = state.scores[seat] as number;

    // 파오 좌석
    let pao: Seat | null = null;
    if (agari.paoMeldIndex !== null) {
      const meld = player(state, seat).melds[agari.paoMeldIndex] as Meld;
      if (meld.type !== 'ankan') pao = meld.from;
    }

    const paoEntry = agari.yakuman.find(
      (y) => y.id === 'daisangen' || y.id === 'daisuushii',
    );
    const paoBase = pao !== null && paoEntry ? yakumanBasePoints(paoEntry.power).basePoints : 0;
    const normalBase = agari.basePoints - paoBase;

    if (from === null) {
      // 쯔모
      const honbaEach = state.honba * 100;
      if (paoBase > 0 && pao !== null) {
        // 파오분은 파오 대상이 전액 (론 상당액), 나머지는 통상 쯔모 분담
        const paoAmount = ronPoints(paoBase, dealerWin) + honbaEach * 3;
        state.scores[pao] = (state.scores[pao] as number) - paoAmount;
        state.scores[seat] = (state.scores[seat] as number) + paoAmount;
        if (normalBase > 0) {
          const pay = tsumoPayments(normalBase, dealerWin);
          for (const other of SEATS) {
            if (other === seat) continue;
            const amount =
              other === state.dealer && !dealerWin ? pay.fromDealer : pay.fromNonDealer;
            state.scores[other] = (state.scores[other] as number) - amount;
            state.scores[seat] = (state.scores[seat] as number) + amount;
          }
        }
      } else {
        const pay = tsumoPayments(agari.basePoints, dealerWin);
        for (const other of SEATS) {
          if (other === seat) continue;
          const amount =
            (other === state.dealer && !dealerWin ? pay.fromDealer : pay.fromNonDealer) +
            honbaEach;
          state.scores[other] = (state.scores[other] as number) - amount;
          state.scores[seat] = (state.scores[seat] as number) + amount;
        }
      }
    } else {
      // 론 — 본장은 첫 번째(가까운) 화료자만 (§2.2)
      const honba = index === 0 ? state.honba * 300 : 0;
      if (paoBase > 0 && pao !== null) {
        const paoHalf = ronPoints(paoBase, dealerWin) / 2;
        const fromAmount = ronPoints(normalBase > 0 ? normalBase : 0, dealerWin) + paoHalf + honba;
        state.scores[from] = (state.scores[from] as number) - fromAmount;
        state.scores[pao] = (state.scores[pao] as number) - paoHalf;
        state.scores[seat] = (state.scores[seat] as number) + fromAmount + paoHalf;
      } else {
        const amount = ronPoints(agari.basePoints, dealerWin) + honba;
        state.scores[from] = (state.scores[from] as number) - amount;
        state.scores[seat] = (state.scores[seat] as number) + amount;
      }
    }

    // 공탁 리치봉: 첫 번째 화료자가 전부 (§2.2·§2.4)
    if (index === 0 && state.pot > 0) {
      state.scores[seat] = (state.scores[seat] as number) + state.pot * RIICHI_DEPOSIT;
      state.pot = 0;
    }

    state.events.push({ type: 'win', seat, from });
    entries.push({
      seat,
      from,
      agari,
      gained: (state.scores[seat] as number) - gainedBefore,
      pao,
    });
  });

  const result: RoundResult = {
    type: 'win',
    wins: entries,
    deltas: deltasFromInitial(state),
    dealerRepeats: entries.some((w) => w.seat === state.dealer),
    potRemaining: state.pot,
  };
  endRound(state, result);
}

function endRound(state: RoundState, result: RoundResult): void {
  state.phase = 'ended';
  state.result = result;
  state.reaction = null;
  state.events.push({ type: 'end', result });
}
