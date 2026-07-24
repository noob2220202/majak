import {
  DEFAULT_RULES,
  EAST,
  kindOfTile,
  parseTiles,
  reactionOffers,
  applyAction,
  startRound,
  turnChoices,
  TOTAL_TILES,
  type RoundState,
  type RuleSettings,
  type Seat,
  type TileId,
  type TileKind,
} from '../src';

/**
 * 조작 패산 헬퍼: 좌석별 배패·쯔모 순서·영상패·도라표시패를 표기로 지정한다.
 * 지정하지 않은 자리는 남은 id를 오름차순으로 채운다 (결정론).
 */
export interface RigSpec {
  hands: [string, string, string, string];
  /** 라이브 쯔모 순서 (인덱스 0부터). null이면 필러. 최대 70. */
  draws?: Array<string | null>;
  /** 영상패 (최대 4) */
  rinshan?: string[];
  /** 도라표시패 (1~5) */
  doraInd?: string;
  /** 우라도라표시패 (1~5) */
  ura?: string;
  dealer?: Seat;
  honba?: number;
  pot?: number;
  scores?: number[];
  roundWind?: TileKind;
  rules?: Partial<RuleSettings>;
}

const RED_KINDS = [4, 13, 22];

class WallAllocator {
  private next = new Map<TileKind, number>();
  private used = new Set<TileId>();

  /** 일반 5는 1번 사본부터 배정해 의도치 않은 적5를 피한다. '0m' 표기만 0번(적) 사용. */
  take(kind: TileKind, red = false): TileId {
    if (red) {
      const id = kind * 4;
      if (this.used.has(id)) throw new Error(`적5 중복: ${kind}`);
      this.used.add(id);
      return id;
    }
    const start = RED_KINDS.includes(kind) ? 1 : 0;
    let copy = this.next.get(kind) ?? start;
    if (copy > 3) {
      // 적5 자리(0번)가 남아 있으면 마지막으로 사용, 아니면 소진
      if (RED_KINDS.includes(kind) && !this.used.has(kind * 4)) {
        copy = 0;
        this.next.set(kind, 5);
      } else {
        throw new Error(`종류 ${kind} 5장째 요청`);
      }
    } else {
      this.next.set(kind, copy + 1);
    }
    const id = kind * 4 + copy;
    if (this.used.has(id)) throw new Error(`종류 ${kind} 5장째 요청 (id 중복)`);
    this.used.add(id);
    return id;
  }

  fillers(): TileId[] {
    const out: TileId[] = [];
    for (let id = 0; id < TOTAL_TILES; id++) {
      if (!this.used.has(id)) out.push(id);
    }
    return out;
  }
}

export function rig(spec: RigSpec): RoundState {
  const alloc = new WallAllocator();
  const order = new Array<TileId>(TOTAL_TILES).fill(-1);

  spec.hands.forEach((hand, seat) => {
    const parsed = parseTiles(hand);
    if (parsed.length !== 13) throw new Error(`좌석 ${seat} 배패는 13장: ${parsed.length}`);
    parsed.forEach((t, i) => {
      order[seat * 13 + i] = alloc.take(t.kind, t.red);
    });
  });

  (spec.draws ?? []).forEach((notation, i) => {
    if (notation === null) return;
    const parsed = parseTiles(notation);
    if (parsed.length !== 1) throw new Error(`쯔모 지정은 1장씩: ${notation}`);
    const t = parsed[0] as { kind: TileKind; red: boolean };
    order[52 + i] = alloc.take(t.kind, t.red);
  });

  (spec.rinshan ?? []).forEach((notation, i) => {
    const t = parseTiles(notation)[0] as { kind: TileKind; red: boolean };
    order[122 + i] = alloc.take(t.kind, t.red);
  });

  if (spec.doraInd) {
    parseTiles(spec.doraInd).forEach((t, i) => {
      order[126 + i] = alloc.take(t.kind);
    });
  }
  if (spec.ura) {
    parseTiles(spec.ura).forEach((t, i) => {
      order[131 + i] = alloc.take(t.kind);
    });
  }

  const fillers = alloc.fillers();
  let f = 0;
  for (let i = 0; i < TOTAL_TILES; i++) {
    if (order[i] === -1) order[i] = fillers[f++] as TileId;
  }

  return startRound({
    rules: { ...DEFAULT_RULES, ...spec.rules },
    dealer: spec.dealer ?? 0,
    roundWind: spec.roundWind ?? EAST,
    honba: spec.honba ?? 0,
    pot: spec.pot ?? 0,
    scores: spec.scores ?? [25000, 25000, 25000, 25000],
    wallOrder: order,
  });
}

/** 표기 종류의 패를 (손패+쯔모패에서) 찾아 버린다 */
export function discardKind(
  state: RoundState,
  seat: Seat,
  notation: string,
  riichi = false,
): void {
  const kind = (parseTiles(notation)[0] as { kind: TileKind }).kind;
  const choices = turnChoices(state);
  const pool = riichi ? choices.riichiDiscards : choices.discards;
  const tile = pool.find((t) => kindOfTile(t) === kind);
  if (tile === undefined) {
    throw new Error(`버릴 수 있는 ${notation}이 없음 (좌석 ${seat})`);
  }
  applyAction(state, seat, { type: 'discard', tileId: tile, riichi });
}

/** 현재 쯔모패를 그대로 버린다 */
export function tsumogiri(state: RoundState, seat: Seat): void {
  const drawn = state.players[seat].drawnTile;
  if (drawn === null) throw new Error(`쯔모패가 없음 (좌석 ${seat})`);
  applyAction(state, seat, { type: 'discard', tileId: drawn });
}

/** 반응 대기 중이면 전원 패스 */
export function passAll(state: RoundState): void {
  while (state.phase === 'reaction') {
    const pending = reactionOffers(state);
    const seat = [...pending.keys()].sort((a, b) => a - b)[0];
    if (seat === undefined) throw new Error('반응 대기인데 대기 좌석이 없음');
    applyAction(state, seat, { type: 'pass' });
  }
}

/** 활성 좌석이 쯔모기리하고 반응은 전원 패스 (n회 반복) */
export function cycleTsumogiri(state: RoundState, times: number): void {
  for (let i = 0; i < times; i++) {
    const phase: string = state.phase;
    if (phase !== 'turn') throw new Error('턴 상태가 아님');
    tsumogiri(state, state.active);
    passAll(state);
    if ((state.phase as string) === 'ended') return;
  }
}

/** 국이 끝날 때까지 전원 쯔모기리·전원 패스 */
export function runOutTsumogiri(state: RoundState): void {
  let guard = 0;
  while (state.phase !== 'ended') {
    if (++guard > 400) throw new Error('국이 끝나지 않음');
    if (state.phase === 'turn') tsumogiri(state, state.active);
    else passAll(state);
  }
}
