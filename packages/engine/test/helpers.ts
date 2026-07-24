import {
  countsFromKinds,
  DEFAULT_RULES,
  EAST,
  evaluateWin,
  parseTiles,
  type AgariInput,
  type AgariResult,
  type Meld,
  type RuleSettings,
  type Seat,
  type TileId,
  type TileKind,
} from '../src';

/**
 * 테스트 픽스처 헬퍼: mpsz 표기로 화료 입력을 조립한다.
 * 패 id는 종류별 사본 카운터로 배정하며 적5('0m' 등)는 0번 사본을 쓴다.
 */

interface MeldSpec {
  type: Meld['type'];
  /** 예: '234m', '5555z'. 가깡은 4장 표기. */
  tiles: string;
  from?: Seat;
}

export interface WinSpec {
  /** 은닉 손패 (화료패 포함) */
  hand: string;
  /** 화료패 1장 표기 (적5는 '0m') */
  win: string;
  type?: 'tsumo' | 'ron';
  melds?: MeldSpec[];
  seat?: 'E' | 'S' | 'W' | 'N';
  round?: 'E' | 'S' | 'W';
  riichi?: boolean;
  doubleRiichi?: boolean;
  ippatsu?: boolean;
  rinshan?: boolean;
  chankan?: boolean;
  haitei?: boolean;
  houtei?: boolean;
  tenhou?: boolean;
  chihou?: boolean;
  /** 도라표시패 표기 (예: '4p1z') */
  dora?: string;
  /** 우라도라표시패 표기 */
  ura?: string;
  rules?: Partial<RuleSettings>;
}

const WIND_KIND = { E: 27, S: 28, W: 29, N: 30 } as const;

class TileAllocator {
  private next = new Map<TileKind, number>();

  take(kind: TileKind, red: boolean): TileId {
    if (red) return kind * 4; // 적5 = 0번 사본
    let copy = this.next.get(kind) ?? 1; // 일반 패는 1번부터 (적5 자리 회피)
    // 4장 다 쓰면 0번(비적용 룰 대비)으로 순환
    if (copy > 3) copy = 0;
    this.next.set(kind, copy + 1);
    return kind * 4 + copy;
  }
}

export function buildWin(spec: WinSpec): AgariInput {
  const alloc = new TileAllocator();
  const handParsed = parseTiles(spec.hand);
  const concealedTileIds = handParsed.map((t) => alloc.take(t.kind, t.red));
  const concealedCounts = countsFromKinds(handParsed.map((t) => t.kind));

  const melds: Meld[] = (spec.melds ?? []).map((m) => {
    const parsed = parseTiles(m.tiles);
    const ids = parsed.map((t) => alloc.take(t.kind, t.red));
    const from = m.from ?? (3 as Seat);
    if (m.type === 'ankan') {
      return { type: 'ankan', tiles: ids as [TileId, TileId, TileId, TileId] };
    }
    if (m.type === 'daiminkan' || m.type === 'shouminkan') {
      const base = {
        tiles: ids as [TileId, TileId, TileId, TileId],
        calledTileId: ids[0] as TileId,
        from,
      };
      return m.type === 'daiminkan'
        ? { type: 'daiminkan', ...base }
        : { type: 'shouminkan', ...base, addedTileId: ids[3] as TileId };
    }
    return {
      type: m.type,
      tiles: ids as [TileId, TileId, TileId],
      calledTileId: ids[0] as TileId,
      from,
    };
  });

  const winParsed = parseTiles(spec.win);
  if (winParsed.length !== 1) throw new Error(`화료패는 1장: ${spec.win}`);

  return {
    rules: { ...DEFAULT_RULES, ...spec.rules },
    concealedCounts,
    concealedTileIds,
    melds,
    winningKind: (winParsed[0] as { kind: TileKind }).kind,
    winType: spec.type ?? 'ron',
    seatWind: spec.seat ? WIND_KIND[spec.seat] : WIND_KIND.S,
    roundWind: spec.round ? WIND_KIND[spec.round] : EAST,
    riichi: spec.riichi ?? false,
    doubleRiichi: spec.doubleRiichi ?? false,
    ippatsu: spec.ippatsu ?? false,
    rinshan: spec.rinshan ?? false,
    chankan: spec.chankan ?? false,
    haitei: spec.haitei ?? false,
    houtei: spec.houtei ?? false,
    tenhou: spec.tenhou ?? false,
    chihou: spec.chihou ?? false,
    doraIndicators: spec.dora ? parseTiles(spec.dora).map((t) => t.kind) : [],
    uraIndicators: spec.ura ? parseTiles(spec.ura).map((t) => t.kind) : [],
  };
}

export function winResult(spec: WinSpec): AgariResult | null {
  return evaluateWin(buildWin(spec));
}

export function yakuIds(result: AgariResult | null): string[] {
  if (!result) return [];
  return [...result.yakuman.map((y) => y.id), ...result.yaku.map((y) => y.id)];
}

export function hanOf(result: AgariResult | null, id: string): number | undefined {
  return result?.yaku.find((y) => y.id === id)?.han;
}
